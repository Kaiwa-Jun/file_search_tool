# Next.js × Gemini File Search Tool

## 目的

Gemini の File Search Tool を最小構成で体験し、「ストア作成 → ファイル取り込み → 質問 → 引用付き回答」の一連の流れと注意点を理解する。

学習用の題材として、"Ask the Manual"（1ファイルに質問して答えを得る）を採用。

## 対象・前提

- **フレームワーク**: Next.js（App Router）
- **UI**: 1ページ構成、ログインなし
- **方針**: 学習優先。UIは最小、ライブラリは極力使わない
- **依存**: `@google/genai` のみ（UI系ライブラリは不要）

## ユースケース

1. ユーザーが PDF/Markdown/TXT を1つアップロード
2. 「この手順を要約」「エラー対策は？」など自然言語で質問
3. 回答とともに**引用（出典チャンク）**を画面に表示

## 画面/フロー（最小）

### 画面構成

1ページに「ファイル選択」「質問入力」「送信」ボタン、結果表示領域

### フロー

1. **ファイル選択** → `/api/store` へ送信 → ストア作成＆取り込み → `storeName` 取得
2. **問い合わせ** → `/api/ask` へ質問＋`storeName` → 回答・引用を表示
3. **（任意）ストア削除**ボタンで後片付け

## 機能要件

- ✅ ストア作成・ファイル取り込み（完了までポーリングで待機）
- ✅ 質問実行（`tools.fileSearch` を指定）
- ✅ 回答テキスト表示／引用メタ情報の表示（該当ページや抜粋の識別）
- ✅ 簡易エラーハンドリング（アップロード失敗、インデックス未完了などの文言）

## 非機能要件

- 素早い体験重視（単一ファイル・小さめサイズを想定）
- 依存は `@google/genai` のみ（UI系ライブラリは不要）
- レイテンシ対策：取り込み完了ポーリングは数秒間隔、最大回数を設定

## アーキテクチャ（最小）

### フロント

- Next.js App Router の1ページ
- state: `storeName`, `question`, `answer`, `citations`, `status`

### API ルート

#### `POST /api/store`

- Node.js ランタイムで FormData を受け、`/tmp` に保存
- File Search Store 作成
- ファイル取り込み
- 完了ポーリング
- `storeName` 返却

#### `POST /api/ask`

- `storeName` と `question` を受け取る
- `generateContent` に `tools.fileSearch` を指定して実行
- 回答/引用返却

### サーバ設定

- `GEMINI_API_KEY` をサーバ側環境変数で管理（クライアントへ露出しない）

### ストレージ/DB

- 不要（学習用のため永続化しない）

## セキュリティ/運用の注意

- ✅ APIキーはサーバのみで保持（クライアントに渡さない）
- ✅ アップロードは許可 MIME のみ（pdf/markdown/txt など）を簡易バリデーション
- ✅ `/tmp` の一時ファイルはアップロード後に削除
- ⚠️ 学習用途のため公開デプロイは想定外（ローカル or 制限付き環境）

## 成功基準（受け入れ条件）

- ✅ 任意の1ファイルを取り込み、質問に対して回答＋引用が表示される
- ✅ 失敗時に原因を示す簡易メッセージが出る
- ✅ 追加学習なしで File Search の基本挙動が説明できる

## 今後の拡張アイデア（任意）

- 複数ファイル対応（同一ストアに追加）
- メタデータによる絞り込み
- 簡易セッション管理（直近の `storeName` を保持）
- ストア一覧/削除のメンテナンス画面

## セットアップ

```bash
# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env.local
# .env.local に GEMINI_API_KEY を設定

# 開発サーバー起動
npm run dev
```

## APIキーの設定と確認

### 1. APIキーの取得

1. [Google AI Studio](https://aistudio.google.com/app/apikey) にアクセス
2. 「Create API Key」をクリック
3. プロジェクトを選択（または新規作成）
4. APIキーをコピー

### 2. 環境変数の設定

`.env.local` ファイルに以下を設定：

```bash
GEMINI_API_KEY=your_api_key_here
# オプション: 使用するモデル名（デフォルトは gemini-1.5-flash）
GEMINI_MODEL_NAME=gemini-1.5-flash
```

### 3. 確認事項

#### ✅ APIキーが正しく設定されているか

- `.env.local` に `GEMINI_API_KEY` が設定されているか確認
- サーバーログで `GEMINI_API_KEY is not set` エラーが出ていないか確認

#### ✅ 使用しているモデルが無料プランで利用可能か

無料プランで利用可能なモデル：

- `gemini-1.5-flash`（推奨・高速）
- `gemini-1.5-pro`（高精度）
- `gemini-2.0-flash`（最新版、利用可能な場合）

**注意**: `gemini-2.0-flash-exp` などの実験的モデル（`-exp` サフィックス）は無料プランでは利用できません。

#### ✅ クォータの確認

1. [Google AI Studio](https://aistudio.google.com/app/projects) にアクセス
2. プロジェクトを選択
3. 「Usage」または「Quotas」タブで利用状況を確認
4. 429エラー（RESOURCE_EXHAUSTED）が発生する場合：
   - 無料プランのクォータ制限に達している可能性があります
   - しばらく待ってから再試行するか、有料プランへのアップグレードを検討してください

#### ✅ File Search Tool が有効か

File Search Tool は通常、APIキーがあれば自動的に利用可能です。特別な設定は不要です。

### 4. トラブルシューティング

#### エラー: "API quota exceeded" または "limit: 0"

- **原因**:
  - 無料プランのクォータ制限に達している
  - または、使用しているモデルが無料プランで利用できない（クォータが0に設定されている）
- **対処法**:
  1. **モデル名の変更**: `.env.local` で `GEMINI_MODEL_NAME` を無料プラン対応のモデルに変更
     ```bash
     # 実験的モデル（-exp サフィックス）は無料プランでは利用できない場合があります
     # 以下のいずれかを試してください：
     GEMINI_MODEL_NAME=gemini-2.0-flash
     # または
     GEMINI_MODEL_NAME=gemini-1.5-flash
     ```
  2. しばらく待ってから再試行（エラーメッセージに再試行までの時間が表示されます）
  3. [Google AI Studio](https://aistudio.google.com/app/projects) でクォータの使用状況を確認
  4. 有料プランへのアップグレードを検討

#### エラー: "GEMINI_API_KEY is not set"

- **原因**: 環境変数が正しく設定されていない
- **対処法**: `.env.local` ファイルに `GEMINI_API_KEY` を設定し、開発サーバーを再起動

#### エラー: "Invalid file type"

- **原因**: 許可されていないファイル形式をアップロードしている
- **対処法**: PDF、Markdown、TXT ファイルのみアップロード可能です

## 実装タスク

詳細な実装タスクは [TASKS.md](./TASKS.md) を参照してください。
