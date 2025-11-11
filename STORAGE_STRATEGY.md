# データ保存戦略について

## 質問への回答

**ベクトル値をDBに保存する必要はありません。**

DBに保存する必要があるのは、**`storeName`（File Search Storeの識別子）だけ**です。

## なぜベクトル値をDBに保存する必要がないのか

### File Search Store のデータは既に永続化されている

1. **ベクトルデータは既に保存されている**
   - File Search Store にアップロードしたファイルは、Gemini APIが管理するデータベースに保存されます
   - ベクトル化されたデータも含めて、全て永続的に保存されています
   - 明示的に削除しない限り、データは保持されます

2. **`storeName` があればアクセス可能**
   - `storeName`（例: `fileSearchStores/1234567890`）は、File Search Storeを識別するためのIDです
   - このIDがあれば、いつでもそのFile Search Storeにアクセスできます
   - ベクトルデータに直接アクセスする必要はありません

## 現在の問題点

### 現状の実装

```typescript
// app/page.tsx
const [storeName, setStoreName] = useState<string | null>(null)
```

**問題**: `storeName` がフロントエンドの状態（React state）でしか保持されていないため、ページリロードで消えてしまいます。

### データの所在

```
┌─────────────────────────────────────┐
│  Gemini API (File Search Store)    │
│  ┌───────────────────────────────┐ │
│  │ ファイルデータ                │ │
│  │ ベクトルデータ（エンベディング）│ │
│  │ メタデータ                     │ │
│  └───────────────────────────────┘ │
│  ID: fileSearchStores/1234567890   │
└─────────────────────────────────────┘
         ↑
         │ storeName があればアクセス可能
         │
┌─────────────────────────────────────┐
│  フロントエンド（React State）     │
│  storeName: "fileSearchStores/..." │ ← これが消える
└─────────────────────────────────────┘
```

## 解決策：DBに保存するもの

### 必要なデータ

DBに保存する必要があるのは、**`storeName` だけ**です：

```sql
-- 例: セッション管理テーブル
CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  store_name TEXT NOT NULL,  -- File Search Store の識別子
  file_name TEXT,             -- 元のファイル名（表示用）
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 不要なデータ

以下のデータは**DBに保存する必要がありません**：

- ❌ ベクトル値（エンベディング）
- ❌ チャンクデータ
- ❌ ファイルの内容
- ❌ メタデータ（ページ番号など）

これらは全て File Search Store に保存されており、`storeName` があればアクセスできます。

## 実装例

### オプション1: セッション管理（簡易版）

```typescript
// app/api/store/route.ts
export async function POST(request: NextRequest) {
  // ... 既存のコード ...

  const storeName = store.name

  // セッションIDを生成（簡易版：実際はDBに保存）
  const sessionId = crypto.randomUUID()

  // セッションストレージに保存（実際はDB推奨）
  // ここでは例として、レスポンスに含める
  return NextResponse.json({
    storeName,
    sessionId, // フロントエンドで保存
  })
}
```

```typescript
// app/page.tsx
useEffect(() => {
  // ページロード時にセッションを復元
  const savedSession = localStorage.getItem('fileSearchSession');
  if (savedSession) {
    const { storeName } = JSON.parse(savedSession);
    setStoreName(storeName);
  }
}, []);

const handleUpload = async () => {
  // ... 既存のコード ...

  const response = await fetch('/api/store', {...});
  const { storeName, sessionId } = await response.json();

  // localStorageに保存（ページリロード後も保持）
  localStorage.setItem('fileSearchSession', JSON.stringify({
    storeName,
    sessionId,
  }));

  setStoreName(storeName);
};
```

### オプション2: データベースを使用（本格版）

```typescript
// app/api/store/route.ts
import { db } from '@/lib/db' // データベースクライアント

export async function POST(request: NextRequest) {
  // ... 既存のコード ...

  const storeName = store.name

  // DBにセッション情報を保存
  const session = await db.sessions.create({
    data: {
      storeName,
      fileName: file.name,
      userId: getUserId(request), // 認証情報から取得
    },
  })

  return NextResponse.json({
    storeName,
    sessionId: session.id,
  })
}
```

```typescript
// app/api/session/route.ts
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId')

  const session = await db.sessions.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  return NextResponse.json({
    storeName: session.storeName,
    fileName: session.fileName,
  })
}
```

## データフロー図

### 現在の実装（ページリロードで消える）

```
1. ファイルアップロード
   ↓
2. File Search Store 作成・保存（Gemini API）
   ↓
3. storeName を React State に保存
   ↓
4. ページリロード
   ↓
5. ❌ storeName が消える（React State がリセット）
   ↓
6. ❌ File Search Store にはアクセスできない
   （storeName が分からないため）
```

### 改善後の実装（DBに storeName を保存）

```
1. ファイルアップロード
   ↓
2. File Search Store 作成・保存（Gemini API）
   ↓
3. storeName を DB に保存
   ↓
4. ページリロード
   ↓
5. ✅ DB から storeName を取得
   ↓
6. ✅ File Search Store にアクセス可能
   （storeName が分かるため）
```

## まとめ

### DBに保存するもの

- ✅ **`storeName`** - File Search Store の識別子（必須）
- ✅ **`fileName`** - 元のファイル名（表示用、オプション）
- ✅ **`createdAt`** - 作成日時（オプション）
- ✅ **`userId`** - ユーザーID（マルチユーザー対応の場合）

### DBに保存しないもの

- ❌ **ベクトル値** - File Search Store に既に保存されている
- ❌ **チャンクデータ** - File Search Store に既に保存されている
- ❌ **ファイルの内容** - File Search Store に既に保存されている
- ❌ **メタデータ** - File Search Store に既に保存されている

### 重要なポイント

1. **ベクトルデータは既に保存されている**
   - File Search Store にアップロードした時点で、Gemini APIが自動的にベクトル化して保存しています

2. **`storeName` があればアクセス可能**
   - `storeName` は File Search Store への「鍵」のようなものです
   - この鍵さえあれば、いつでも File Search Store にアクセスできます

3. **DBは「鍵の保管庫」として機能**
   - DBに保存するのは、File Search Store へのアクセス方法（`storeName`）だけです
   - 実際のデータ（ベクトルなど）は File Search Store に保存されています

## 実装の優先順位

### 最小限の実装（すぐに実装可能）

- **localStorage に `storeName` を保存**
- ページロード時に復元
- データベース不要

### 本格的な実装（将来的に）

- **データベースにセッション情報を保存**
- ユーザーごとの管理
- 複数ファイルの管理
- 履歴機能
