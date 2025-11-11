import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // APIキーの確認
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY is not set' },
        { status: 500 }
      );
    }

    // リクエストボディから storeName と question を取得
    const body = await request.json();
    const { storeName, question } = body;

    // 入力値のバリデーション
    if (!storeName || typeof storeName !== 'string') {
      return NextResponse.json(
        { error: 'storeName is required and must be a string' },
        { status: 400 }
      );
    }

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return NextResponse.json(
        { error: 'question is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Gemini API クライアントの初期化
    const genAI = new GoogleGenAI({ apiKey });

    // モデル名を環境変数から取得（デフォルトは gemini-2.5-flash）
    // File Search機能は Gemini 2.5 Pro と Gemini 2.5 Flash でのみ利用可能
    const modelName = process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash';

    // File Search Tool を指定して質問を実行
    // storeName が完全なリソース名でない場合、プレフィックスを追加
    const fileSearchStoreName = storeName.startsWith('fileSearchStores/')
      ? storeName
      : `fileSearchStores/${storeName}`;

    const result = await genAI.models.generateContent({
      model: modelName,
      contents: question, // 文字列として直接渡す（ドキュメントに従う）
      config: {
        tools: [
          {
            fileSearch: {
              fileSearchStoreNames: [fileSearchStoreName],
            },
          },
        ],
      },
    });

    // デバッグ用：resultオブジェクトの構造を確認
    console.log('Result type:', typeof result);
    console.log('Result keys:', Object.keys(result || {}));

    // result自体がGenerateContentResponseオブジェクト
    const response = result;

    // デバッグ用：レスポンス構造を確認（candidatesのみ）
    console.log('Candidates:', JSON.stringify(response.candidates, null, 2));

    // content.partsの確認
    const candidate = response.candidates?.[0];
    const contentParts = candidate?.content?.parts;
    console.log('Content parts:', JSON.stringify(contentParts, null, 2));

    // textはgetterプロパティ（メソッドではない）
    let text = response.text;

    // textがundefinedの場合、partsから直接抽出を試みる
    if (!text && contentParts && contentParts.length > 0) {
      console.log('Attempting to extract text from parts directly');
      text = contentParts
        .filter((part: { text?: string }) => part.text)
        .map((part: { text?: string }) => part.text)
        .join('');
    }

    // それでもtextがない場合のエラーハンドリング
    if (!text) {
      console.error('No text in response after all attempts');
      console.error('Full response:', JSON.stringify(response, null, 2));

      // groundingMetadataにデータがある場合は、取得したコンテンツを表示
      const groundingText = candidate?.groundingMetadata?.groundingChunks?.[0]?.retrievedContext?.text;
      if (groundingText) {
        return NextResponse.json(
          {
            error: 'モデルがテキストを生成しませんでしたが、関連するコンテンツを取得できました。',
            details: 'File Searchで取得したコンテンツ',
            retrievedContent: groundingText.substring(0, 500) + '...', // 最初の500文字のみ
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          error: 'モデルからテキストレスポンスを取得できませんでした。',
          details: 'レスポンスにテキストが含まれていません。モデルの設定やFile Search Storeを確認してください。',
          debugInfo: {
            hasCandidate: !!candidate,
            hasContent: !!candidate?.content,
            hasParts: !!contentParts,
            partsLength: contentParts?.length || 0,
          }
        },
        { status: 500 }
      );
    }

    // 引用（citations）情報を抽出
    const citations: Array<{
      fileUri?: string;
      chunkIndex?: number;
      pageNumber?: number;
      text?: string;
    }> = [];

    // レスポンスから引用情報を取得
    if (response.candidates && response.candidates[0]?.groundingMetadata) {
      const groundingMetadata = response.candidates[0].groundingMetadata;
      console.log('Grounding metadata:', JSON.stringify(groundingMetadata, null, 2));

      if (groundingMetadata.groundingChunks) {
        groundingMetadata.groundingChunks.forEach((chunk) => {
          citations.push({
            fileUri: chunk.file?.uri,
            chunkIndex: chunk.chunkIndex,
            pageNumber: chunk.file?.displayName
              ? parseInt(chunk.file.displayName.match(/page-(\d+)/)?.[1] || '0')
              : undefined,
            text: chunk.text,
          });
        });
      }
    } else {
      console.log('No grounding metadata found in response');
    }

    // 成功レスポンス
    return NextResponse.json({
      answer: text,
      citations,
    });
  } catch (error) {
    console.error('Ask error:', error);

    // 404エラー（モデルが見つからない）の処理
    if (
      error &&
      typeof error === 'object' &&
      (('status' in error && error.status === 404) ||
        ('error' in error &&
          typeof error.error === 'object' &&
          error.error !== null &&
          'code' in error.error &&
          error.error.code === 404))
    ) {
      let errorMessage =
        '指定されたモデルが見つかりません。環境変数 GEMINI_MODEL_NAME で利用可能なモデル名を指定してください。';
      
      // エラーメッセージの抽出を試みる
      if (error && typeof error === 'object') {
        if (
          'error' in error &&
          typeof error.error === 'object' &&
          error.error !== null &&
          'message' in error.error &&
          typeof error.error.message === 'string'
        ) {
          errorMessage = error.error.message;
        }
      }

      return NextResponse.json(
        {
          error: 'モデルが見つかりません。利用可能なモデル名を確認してください。',
          details: errorMessage,
          suggestion:
            'File Search機能は Gemini 2.5 モデルでのみ利用可能です。環境変数 GEMINI_MODEL_NAME に gemini-2.5-flash または gemini-2.5-pro を設定してください。',
        },
        { status: 404 }
      );
    }

    // 429エラー（クォータ制限）の処理
    if (
      error &&
      typeof error === 'object' &&
      (('status' in error && error.status === 429) ||
        ('error' in error &&
          typeof error.error === 'object' &&
          error.error !== null &&
          'code' in error.error &&
          error.error.code === 429))
    ) {
      let errorMessage = 'API quota exceeded. Please wait a moment and try again.';
      let retryAfter: number | null = null;
      
      // エラーメッセージの抽出を試みる
      if (error && typeof error === 'object') {
        if ('message' in error && typeof error.message === 'string') {
          errorMessage = error.message;
        } else if (
          'error' in error &&
          typeof error.error === 'object' &&
          error.error !== null &&
          'message' in error.error &&
          typeof error.error.message === 'string'
        ) {
          errorMessage = error.error.message;
          
          // "Please retry in X.XXXXs" の形式から再試行までの時間を抽出
          const retryMatch = error.error.message.match(/Please retry in ([\d.]+)s/i);
          if (retryMatch) {
            retryAfter = Math.ceil(parseFloat(retryMatch[1]));
          }
        }
        
        // details から RetryInfo を探す
        if (
          'error' in error &&
          typeof error.error === 'object' &&
          error.error !== null &&
          'details' in error.error &&
          Array.isArray(error.error.details)
        ) {
          const retryInfo = error.error.details.find(
            (detail: { '@type'?: string; retryDelay?: string }) =>
              detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo'
          );
          if (retryInfo && retryInfo.retryDelay) {
            // retryDelay は "4s" のような形式の可能性がある
            const delayMatch = String(retryInfo.retryDelay).match(/([\d.]+)/);
            if (delayMatch) {
              retryAfter = Math.ceil(parseFloat(delayMatch[1]));
            }
          }
        }
      }

      // モデル名が含まれている場合、無料プランで利用できない可能性を案内
      const modelName = process.env.GEMINI_MODEL_NAME || 'gemini-2.5-flash';
      const isExpModel = modelName.includes('-exp');
      const suggestion = isExpModel
        ? `実験的モデル（${modelName}）は無料プランでは利用できない可能性があります。環境変数 GEMINI_MODEL_NAME を gemini-2.5-flash に変更してみてください。`
        : undefined;

      return NextResponse.json(
        {
          error: retryAfter
            ? `APIの利用制限に達しました。約${retryAfter}秒後に再試行してください。`
            : 'APIの利用制限に達しました。しばらく待ってから再試行してください。',
          details: errorMessage,
          retryAfter,
          suggestion,
        },
        { status: 429 }
      );
    }

    // その他のエラー
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to process question',
      },
      { status: 500 }
    );
  }
}
