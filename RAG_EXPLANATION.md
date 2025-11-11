# Gemini File Search Tool と RAG について

## File Search Tool は RAG です

はい、**Gemini APIのFile Search ToolはRAG（Retrieval-Augmented Generation）システム**です。

## RAGとは

RAG（Retrieval-Augmented Generation）は、以下の2つのステップで動作します：

1. **Retrieval（検索）**: ユーザーの質問に関連する情報を知識ベースから検索
2. **Augmented Generation（拡張生成）**: 検索した情報をコンテキストとして、LLMが回答を生成

## File Search Tool の内部動作

### 1. ファイルアップロード時の処理

ファイルをアップロードすると、以下の処理が**自動的に**行われます：

```
ファイルアップロード
  ↓
テキスト抽出（PDF/Markdown/TXTから）
  ↓
チャンク分割（意味のある単位に分割）
  ↓
ベクトル化（エンベディング生成）
  ↓
File Search Store に保存
```

### 2. ベクトル化されたデータの保存

**はい、ベクトル化されたデータは保存されています。**

- **保存場所**: File Search Store（Gemini APIが管理する専用データベース）
- **保存形式**: エンベディング（ベクトル）として保存
- **モデル**: `gemini-embedding-001` が使用される（インデックス作成時のみ）
- **料金**: インデックス作成時のエンベディング生成のみ課金（保存・クエリ時の検索は無料）

### 3. 質問時の処理フロー

```
ユーザーの質問
  ↓
質問もベクトル化（エンベディング生成）
  ↓
File Search Store で類似度検索
  ↓
関連性の高いチャンクを取得
  ↓
取得したチャンクをコンテキストとして
Gemini モデルに渡す
  ↓
回答生成（引用情報付き）
```

## 今回の実装での処理

### `/api/store` エンドポイント

```typescript
// 1. File Search Store を作成
const store = await genAI.fileSearchStores.create({
  config: {
    displayName: `store-${Date.now()}`,
  },
})

// 2. ファイルをストアにアップロード
const uploadOperation = await genAI.fileSearchStores.uploadToFileSearchStore({
  fileSearchStoreName: storeName,
  file: fileBlob,
  config: {
    mimeType: file.type,
    displayName: file.name,
  },
})

// 3. インデックス完了までポーリング
// この間に、裏側で以下が実行される：
// - テキスト抽出
// - チャンク分割
// - ベクトル化（エンベディング生成）
// - File Search Store への保存
```

### `/api/ask` エンドポイント

```typescript
// File Search Tool を指定して質問を実行
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

// この処理で、裏側で以下が実行される：
// 1. 質問をベクトル化
// 2. File Search Store で類似度検索
// 3. 関連チャンクを取得
// 4. チャンクをコンテキストとして回答生成
// 5. 引用情報（groundingMetadata）を付与
```

## 開発者が意識する必要がないこと

File Search Toolを使用することで、以下の処理を**意識する必要がありません**：

- ✅ チャンク分割のロジック
- ✅ ベクトル化（エンベディング生成）の実装
- ✅ ベクトルデータベースの構築・管理
- ✅ 類似度検索のアルゴリズム
- ✅ インデックスの最適化

これらは全て**Gemini APIの裏側で自動的に処理**されます。

## 従来のRAG実装との比較

### 従来のRAG実装（自前で構築）

```
1. データの前処理
   - テキスト抽出
   - チャンク分割
   - メタデータ付与

2. ベクトル化
   - エンベディングモデルの選択
   - エンベディング生成APIの呼び出し
   - エンベディングの保存

3. ベクトルデータベースの構築
   - Pinecone、Weaviate、Chroma などの選択
   - インデックスの作成
   - データの投入

4. 検索の実装
   - クエリのベクトル化
   - 類似度検索の実行
   - 結果のランキング

5. 生成
   - 検索結果をコンテキストとして
   - LLMに渡して回答生成
```

### File Search Tool（フルマネージド）

```
1. ファイルをアップロード
   ↓
2. 質問を送信
   ↓
3. 回答と引用を取得
```

**たったこれだけ！** 裏側の処理は全て自動化されています。

## データの保存場所とアクセス

### 保存場所

- **物理的な場所**: Google Cloud のインフラ（開発者は意識不要）
- **論理的な場所**: File Search Store（`fileSearchStores/xxx` という形式のリソース名）
- **データ形式**: ベクトル（エンベディング）として保存

### アクセス方法

- **作成**: `genAI.fileSearchStores.create()`
- **ファイル追加**: `genAI.fileSearchStores.uploadToFileSearchStore()`
- **検索**: `generateContent()` で `tools.fileSearch` を指定
- **削除**: `genAI.fileSearchStores.delete()`（実装していないが可能）

### データの永続性

- File Search Store とその中のデータは**永続的**です
- 明示的に削除しない限り、データは保持されます
- ただし、今回の実装では `storeName` をフロントエンドの状態でしか保持していないため、ページリロードで「見失う」可能性があります

## 料金について

### 無料で利用できる部分

- ✅ ファイルの保存
- ✅ クエリ時の検索
- ✅ エンベディング生成（クエリ時）

### 課金される部分

- 💰 **インデックス作成時のエンベディング生成のみ**
  - モデル: `gemini-embedding-001`
  - 料金: 1ミリオントークンあたり約0.15ドル
  - 例: 10万トークンのファイル → 約0.015ドル

## まとめ

1. **File Search ToolはRAGシステム**です
2. **ベクトル化されたデータは保存されています**（File Search Storeに）
3. **開発者はベクトル化や検索の実装を意識する必要がありません**
4. **フルマネージド**で、複雑なインフラ管理が不要です
5. **料金はインデックス作成時のみ**で、検索は無料です

これにより、開発者はRAGシステムの複雑さから解放され、アプリケーションの構築に集中できるようになっています。
