import { GoogleGenAI } from '@google/genai';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { NextRequest, NextResponse } from 'next/server';

// 許可するMIMEタイプ
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
  'application/msword', // DOC (古い形式)
  'application/json',
  'text/markdown',
  'text/plain',
  'text/x-markdown',
];

// ポーリング設定
const POLL_INTERVAL_MS = 3000; // 3秒間隔
const MAX_POLL_ATTEMPTS = 60; // 最大60回（3分）

export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    // APIキーの確認
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set' },
        { status: 500 }
      );
    }

    // FormDataからファイルを取得
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // MIMEタイプのバリデーション
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 一時ファイルに保存
    const tempDir = tmpdir();
    const uniqueFileName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.name}`;
    tempFilePath = join(tempDir, uniqueFileName);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await writeFile(tempFilePath, buffer);

    // Gemini API クライアントの初期化
    const genAI = new GoogleGenAI({ apiKey });

    // File Search Store を作成
    const store = await genAI.fileSearchStores.create({
      config: {
        displayName: `store-${Date.now()}`,
      },
    });

    const storeName = store.name;
    if (!storeName) {
      throw new Error('Failed to get store name');
    }

    // ファイルをストアにアップロード（Blob オブジェクトを使用）
    await genAI.fileSearchStores.uploadToFileSearchStore({
      fileSearchStoreName: storeName,
      file: new Blob([buffer], { type: file.type }),
      config: {
        mimeType: file.type,
        displayName: file.name,
      },
    });

    // インデックス完了までポーリング
    let pollAttempts = 0;
    let isIndexed = false;

    while (pollAttempts < MAX_POLL_ATTEMPTS && !isIndexed) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

      const storeInfo = await genAI.fileSearchStores.get({
        name: storeName,
      });

      // ストアの状態を確認（activeDocumentsCount が設定されていれば完了）
      // indexed プロパティは型定義に存在しないため、activeDocumentsCount のみチェック
      const activeCount = storeInfo.activeDocumentsCount;
      if (activeCount && typeof activeCount === 'number' && activeCount > 0) {
        isIndexed = true;
        break;
      }

      pollAttempts++;
    }

    if (!isIndexed) {
      return NextResponse.json(
        {
          error: 'Indexing timeout. Please try again later.',
          storeName, // ストア名は返す（後で再試行可能にするため）
        },
        { status: 408 }
      );
    }

    // 一時ファイルを削除
    try {
      await unlink(tempFilePath);
      tempFilePath = null;
    } catch (error) {
      console.error('Failed to delete temp file:', error);
      // エラーでも続行（一時ファイルは後で削除される）
    }

    // 成功レスポンス
    return NextResponse.json({ storeName });
  } catch (error) {
    // エラー時のクリーンアップ
    if (tempFilePath) {
      try {
        await unlink(tempFilePath);
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError);
      }
    }

    console.error('Store creation error:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create store',
      },
      { status: 500 }
    );
  }
}
