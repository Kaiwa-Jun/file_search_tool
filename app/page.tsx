'use client';

import { useState } from 'react';
import React from 'react';

// シンプルなマークダウンパーサー
function parseMarkdown(text: string): React.ReactElement[] {
  const lines = text.split('\n');
  const elements: React.ReactElement[] = [];
  let currentParagraph: string[] = [];
  let inCodeBlock = false;
  let codeBlockLanguage = '';
  let codeBlockContent: string[] = [];

  const flushParagraph = () => {
    if (currentParagraph.length > 0) {
      const paragraphText = currentParagraph.join('\n');
      if (paragraphText.trim()) {
        elements.push(
          <p key={elements.length} style={{ marginBottom: '1rem' }}>
            {parseInlineMarkdown(paragraphText)}
          </p>
        );
      }
      currentParagraph = [];
    }
  };

  const flushCodeBlock = () => {
    if (codeBlockContent.length > 0) {
      elements.push(
        <pre
          key={elements.length}
          style={{
            backgroundColor: '#f4f4f4',
            padding: '1rem',
            borderRadius: '4px',
            overflow: 'auto',
            marginBottom: '1rem',
            border: '1px solid #ddd',
          }}
        >
          <code>{codeBlockContent.join('\n')}</code>
        </pre>
      );
      codeBlockContent = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // コードブロックの開始/終了
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
        codeBlockLanguage = '';
      } else {
        flushParagraph();
        inCodeBlock = true;
        codeBlockLanguage = line.substring(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // 見出し
    if (line.startsWith('# ')) {
      flushParagraph();
      elements.push(
        <h1 key={elements.length} style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
          {parseInlineMarkdown(line.substring(2))}
        </h1>
      );
      continue;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      elements.push(
        <h2 key={elements.length} style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
          {parseInlineMarkdown(line.substring(3))}
        </h2>
      );
      continue;
    }
    if (line.startsWith('### ')) {
      flushParagraph();
      elements.push(
        <h3 key={elements.length} style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          {parseInlineMarkdown(line.substring(4))}
        </h3>
      );
      continue;
    }

    // リスト
    if (line.match(/^[-*]\s/)) {
      flushParagraph();
      const listItems: string[] = [];
      let j = i;
      while (j < lines.length && lines[j].match(/^[-*]\s/)) {
        listItems.push(lines[j].substring(2));
        j++;
      }
      elements.push(
        <ul key={elements.length} style={{ marginBottom: '1rem', paddingLeft: '1.5rem' }}>
          {listItems.map((item, idx) => (
            <li key={idx} style={{ marginBottom: '0.25rem' }}>
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      i = j - 1;
      continue;
    }

    // 空行
    if (line.trim() === '') {
      flushParagraph();
      continue;
    }

    currentParagraph.push(line);
  }

  flushParagraph();
  flushCodeBlock();

  return elements.length > 0 ? elements : [<p key={0}>{text}</p>];
}

// インラインマークダウンのパース（強調、コード、リンクなど）
function parseInlineMarkdown(text: string): (string | React.ReactElement)[] {
  const parts: (string | React.ReactElement)[] = [];
  let currentIndex = 0;
  let keyCounter = 0;

  // コード（バッククォート）
  const codeRegex = /`([^`]+)`/g;
  let match;
  const codeMatches: Array<{ start: number; end: number; content: string }> = [];
  while ((match = codeRegex.exec(text)) !== null) {
    codeMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[1],
    });
  }

  // 太字（**text**）
  const boldRegex = /\*\*([^*]+)\*\*/g;
  const boldMatches: Array<{ start: number; end: number; content: string }> = [];
  while ((match = boldRegex.exec(text)) !== null) {
    boldMatches.push({
      start: match.index,
      end: match.index + match[0].length,
      content: match[1],
    });
  }

  // イタリック（*text*）- 太字と重複しないもののみ
  const italicRegex = /\*([^*]+)\*/g;
  const italicMatches: Array<{ start: number; end: number; content: string }> = [];
  while ((match = italicRegex.exec(text)) !== null) {
    // 太字と重複しないか確認
    const isBold = boldMatches.some(
      (b) => b.start <= match!.index && match!.index < b.end
    );
    if (!isBold) {
      italicMatches.push({
        start: match.index,
        end: match.index + match[0].length,
        content: match[1],
      });
    }
  }

  // すべてのマッチを統合してソート
  const allMatches = [
    ...codeMatches.map((m) => ({ ...m, type: 'code' as const })),
    ...boldMatches.map((m) => ({ ...m, type: 'bold' as const })),
    ...italicMatches.map((m) => ({ ...m, type: 'italic' as const })),
  ].sort((a, b) => a.start - b.start);

  // 重複を除去（ネストはサポートしない）
  const nonOverlappingMatches: typeof allMatches = [];
  for (const m of allMatches) {
    const overlaps = nonOverlappingMatches.some(
      (existing) =>
        (m.start >= existing.start && m.start < existing.end) ||
        (m.end > existing.start && m.end <= existing.end) ||
        (m.start <= existing.start && m.end >= existing.end)
    );
    if (!overlaps) {
      nonOverlappingMatches.push(m);
    }
  }

  // テキストをパーツに分割
  for (const m of nonOverlappingMatches) {
    if (m.start > currentIndex) {
      parts.push(text.substring(currentIndex, m.start));
    }

    if (m.type === 'code') {
      parts.push(
        <code
          key={keyCounter++}
          style={{
            backgroundColor: '#f4f4f4',
            padding: '0.2rem 0.4rem',
            borderRadius: '3px',
            fontFamily: 'monospace',
            fontSize: '0.9em',
          }}
        >
          {m.content}
        </code>
      );
    } else if (m.type === 'bold') {
      parts.push(<strong key={keyCounter++}>{m.content}</strong>);
    } else if (m.type === 'italic') {
      parts.push(<em key={keyCounter++}>{m.content}</em>);
    }

    currentIndex = m.end;
  }

  if (currentIndex < text.length) {
    parts.push(text.substring(currentIndex));
  }

  return parts.length > 0 ? parts : [text];
}

type Citation = {
  fileUri?: string;
  chunkIndex?: number;
  pageNumber?: number;
  text?: string;
};

type Status = 'idle' | 'uploading' | 'indexing' | 'asking' | 'success' | 'error';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<Citation[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');

  // ファイル選択のハンドラー
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // MIMEタイプのバリデーション（UI側）
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
        'application/msword', // DOC (古い形式)
        'application/json',
        'text/markdown',
        'text/plain',
        'text/x-markdown',
      ];

      if (!allowedTypes.includes(selectedFile.type)) {
        setError(`無効なファイル形式です。許可されている形式: PDF, Word (DOCX), TXT, Markdown, JSON`);
        setFile(null);
        return;
      }

      setFile(selectedFile);
      setError(null);
      setAnswer('');
      setCitations([]);
      setStoreName(null);
    }
  };

  // ストア作成処理
  const handleUpload = async () => {
    if (!file) {
      setError('ファイルを選択してください');
      return;
    }

    setStatus('uploading');
    setStatusMessage('ファイルをアップロード中...');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/store', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'ファイルのアップロードに失敗しました');
      }

      setStatus('indexing');
      setStatusMessage('インデックス作成中...');

      const data = await response.json();
      setStoreName(data.storeName);
      setStatus('success');
      setStatusMessage('ファイルの取り込みが完了しました');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      setStatusMessage('');
    }
  };

  // 質問送信処理
  const handleAsk = async () => {
    if (!storeName) {
      setError('まずファイルをアップロードしてください');
      return;
    }

    if (!question.trim()) {
      setError('質問を入力してください');
      return;
    }

    setStatus('asking');
    setStatusMessage('質問を処理中...');
    setError(null);
    setAnswer('');
    setCitations([]);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          storeName,
          question,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        // 404エラー（モデルが見つからない）の特別処理
        if (response.status === 404) {
          throw new Error(
            data.error || 'モデルが見つかりません。利用可能なモデル名を確認してください。'
          );
        }
        // 429エラー（クォータ制限）の特別処理
        if (response.status === 429) {
          let errorMsg = data.error || 'APIの利用制限に達しました。しばらく待ってから再試行してください。';
          if (data.suggestion) {
            errorMsg += `\n\n${data.suggestion}`;
          }
          throw new Error(errorMsg);
        }
        throw new Error(data.error || '質問の処理に失敗しました');
      }

      const data = await response.json();
      setAnswer(data.answer || '');
      setCitations(data.citations || []);
      setStatus('success');
      setStatusMessage('回答を取得しました');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      setStatusMessage('');
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>File Search Tool</h1>

      {/* ファイル選択セクション */}
      <section style={{ marginBottom: '2rem' }}>
        <h2>1. ファイルを選択</h2>
        <div style={{ marginBottom: '1rem' }}>
          <input
            type="file"
            accept=".pdf,.docx,.doc,.json,.md,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/json,text/markdown,text/plain"
            onChange={handleFileChange}
            disabled={status === 'uploading' || status === 'indexing'}
          />
          {file && (
            <p style={{ marginTop: '0.5rem', color: '#666' }}>
              選択されたファイル: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>
        <button
          onClick={handleUpload}
          disabled={!file || status === 'uploading' || status === 'indexing'}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: file && status !== 'uploading' && status !== 'indexing' ? 'pointer' : 'not-allowed',
            opacity: file && status !== 'uploading' && status !== 'indexing' ? 1 : 0.5,
          }}
        >
          {status === 'uploading' || status === 'indexing' ? '処理中...' : 'アップロード'}
        </button>
      </section>

      {/* 質問セクション */}
      <section style={{ marginBottom: '2rem' }}>
        <h2>2. 質問を入力</h2>
        <div style={{ marginBottom: '1rem' }}>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="例: この手順を要約してください"
            rows={4}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontFamily: 'inherit',
            }}
            disabled={!storeName || status === 'asking'}
          />
        </div>
        <button
          onClick={handleAsk}
          disabled={!storeName || !question.trim() || status === 'asking'}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: storeName && question.trim() && status !== 'asking' ? 'pointer' : 'not-allowed',
            opacity: storeName && question.trim() && status !== 'asking' ? 1 : 0.5,
          }}
        >
          {status === 'asking' ? '処理中...' : '質問を送信'}
        </button>
      </section>

      {/* ステータス表示 */}
      {statusMessage && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: status === 'error' ? '#fee' : '#e6f7ff',
            border: `1px solid ${status === 'error' ? '#fcc' : '#91d5ff'}`,
            borderRadius: '4px',
            marginBottom: '1rem',
          }}
        >
          {statusMessage}
        </div>
      )}

      {/* エラー表示 */}
      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            marginBottom: '1rem',
            color: '#c00',
          }}
        >
          <strong>エラー:</strong> {error}
        </div>
      )}

      {/* 回答表示 */}
      {answer && (
        <section style={{ marginBottom: '2rem' }}>
          <h2>回答</h2>
          <div
            style={{
              padding: '1.5rem',
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              lineHeight: '1.6',
            }}
          >
            {parseMarkdown(answer)}
          </div>
        </section>
      )}

      {/* 引用表示 */}
      {citations.length > 0 && (
        <section>
          <h2>引用元</h2>
          {citations.map((citation, index) => (
            <div
              key={index}
              style={{
                padding: '1rem',
                backgroundColor: '#f9f9f9',
                border: '1px solid #ddd',
                borderRadius: '4px',
                marginBottom: '0.5rem',
              }}
            >
              {citation.pageNumber && (
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
                  ページ {citation.pageNumber}
                </p>
              )}
              {citation.text && (
                <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>
                  {citation.text}
                </p>
              )}
              {citation.fileUri && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.8rem', color: '#999' }}>
                  URI: {citation.fileUri}
                </p>
              )}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
