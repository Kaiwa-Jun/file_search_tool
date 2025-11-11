# File Search Tool の自動処理について

## 結論

**はい、その通りです！**

File Search Toolは、**チャンク化やベクトル化を自動的に行ってくれます**。今回の実装では、これらの処理に関するコードは一切書いていません。

## 実装コードの確認

### `/api/store` エンドポイントで行っていること

```typescript
// 1. File Search Store を作成
const store = await genAI.fileSearchStores.create({
  config: {
    displayName: `store-${Date.now()}`,
  },
})

// 2. ファイルをアップロード（これだけ！）
await genAI.fileSearchStores.uploadToFileSearchStore({
  fileSearchStoreName: storeName,
  file: new Blob([buffer], { type: file.type }),
  config: {
    mimeType: file.type,
    displayName: file.name,
  },
})

// 3. インデックス完了までポーリング
// この間に、Gemini APIが裏側で自動的に：
// ✅ テキスト抽出
// ✅ チャンク分割
// ✅ ベクトル化（エンベディング生成）
// ✅ File Search Store への保存
```

### `/api/ask` エンドポイントで行っていること

```typescript
// File Search Tool を指定するだけ
const result = await genAI.models.generateContent({
  model: modelName,
  contents: question,
  config: {
    tools: [
      {
        fileSearch: {
          fileSearchStoreNames: [fileSearchStoreName],
        },
      },
    ],
  },
})

// この処理で、Gemini APIが裏側で自動的に：
// ✅ 質問をベクトル化
// ✅ File Search Store で類似度検索
// ✅ 関連チャンクを取得
// ✅ チャンクをコンテキストとして回答生成
// ✅ 引用情報（groundingMetadata）を付与
```

## 実装に含まれていないもの

今回の実装コードを確認すると、以下のような処理は**一切含まれていません**：

### ❌ チャンク分割のコード

```typescript
// このようなコードは存在しない
function chunkText(text: string, chunkSize: number) { ... }
function splitBySentences(text: string) { ... }
function createOverlappingChunks(text: string) { ... }
```

### ❌ ベクトル化（エンベディング生成）のコード

```typescript
// このようなコードは存在しない
async function generateEmbedding(text: string) { ... }
const embedding = await embeddingModel.embed(text);
```

### ❌ ベクトルデータベースの操作コード

```typescript
// このようなコードは存在しない
await vectorDB.upsert(vectors)
await vectorDB.query(queryVector)
```

### ❌ 類似度検索のコード

```typescript
// このようなコードは存在しない
function cosineSimilarity(vec1: number[], vec2: number[]) { ... }
function findSimilarChunks(queryVector: number[]) { ... }
```

## 実際の処理フロー

### ファイルアップロード時（`/api/store`）

```
開発者のコード:
  ↓
genAI.fileSearchStores.uploadToFileSearchStore() を呼び出す
  ↓
【Gemini APIが自動的に処理】
  ↓
1. テキスト抽出（PDF/Markdown/TXTから）
2. チャンク分割（意味のある単位に分割）
   - 文の境界を考慮
   - 意味的なまとまりを保持
   - 適切なサイズに分割
3. ベクトル化（エンベディング生成）
   - gemini-embedding-001 を使用
   - 各チャンクをベクトルに変換
4. File Search Store に保存
   - ベクトルデータとして保存
   - メタデータ（ファイル名、ページ番号など）も保存
  ↓
インデックス完了（activeDocumentsCount > 0）
```

### 質問時（`/api/ask`）

```
開発者のコード:
  ↓
genAI.models.generateContent({ tools: [{ fileSearch: {...} }] }) を呼び出す
  ↓
【Gemini APIが自動的に処理】
  ↓
1. 質問をベクトル化
   - 質問テキストをエンベディングに変換
2. File Search Store で類似度検索
   - ベクトル空間で類似度を計算
   - コサイン類似度などを使用
   - 関連性の高いチャンクを取得
3. 関連チャンクを取得
   - トップK個のチャンクを選択
   - メタデータも一緒に取得
4. チャンクをコンテキストとして回答生成
   - 取得したチャンクをプロンプトに含める
   - Gemini モデルが回答を生成
5. 引用情報を付与
   - groundingMetadata に引用元情報を含める
  ↓
回答と引用情報を返却
```

## 従来のRAG実装との比較

### 従来のRAG実装（自前で構築する場合）

```typescript
// 1. チャンク分割の実装が必要
function chunkDocument(text: string) {
  // 文の境界で分割
  // オーバーラップを考慮
  // チャンクサイズの調整
  return chunks;
}

// 2. エンベディング生成の実装が必要
async function generateEmbeddings(chunks: string[]) {
  const embeddings = [];
  for (const chunk of chunks) {
    const embedding = await embeddingAPI.embed(chunk);
    embeddings.push(embedding);
  }
  return embeddings;
}

// 3. ベクトルデータベースへの保存が必要
async function storeVectors(embeddings: Vector[]) {
  await vectorDB.upsert({
    vectors: embeddings,
    metadata: [...],
  });
}

// 4. 検索の実装が必要
async function search(query: string) {
  const queryEmbedding = await embeddingAPI.embed(query);
  const results = await vectorDB.query({
    vector: queryEmbedding,
    topK: 5,
  });
  return results;
}

// 5. コンテキストの構築が必要
function buildContext(searchResults: Result[]) {
  return searchResults.map(r => r.text).join('\n\n');
}

// 6. LLMへのプロンプト構築が必要
const prompt = `以下の情報を参考に質問に答えてください：
${context}

質問: ${question}`;
```

### File Search Tool（今回の実装）

```typescript
// ファイルアップロード
await genAI.fileSearchStores.uploadToFileSearchStore({...});

// 質問
const result = await genAI.models.generateContent({
  tools: [{ fileSearch: {...} }],
});
```

**たったこれだけ！** 全ての処理が自動化されています。

## まとめ

1. ✅ **チャンク化は自動** - File Search Toolが自動的に行います
2. ✅ **ベクトル化は自動** - File Search Toolが自動的に行います
3. ✅ **設定不要** - チャンクサイズやエンベディングモデルの設定は不要です
4. ✅ **実装不要** - チャンク化やベクトル化のコードを書く必要はありません
5. ✅ **最適化済み** - Gemini APIが最適な方法で処理してくれます

開発者は、**ファイルをアップロードして質問を送信するだけ**で、RAGシステムが動作します。
