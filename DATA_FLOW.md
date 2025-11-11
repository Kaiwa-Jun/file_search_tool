# データフローの詳細説明

## 質問への回答

**はい、その通りです！**

処理の流れは以下の通りです：

1. **File Search Store の ID（`storeName`）を DB に保存**
2. **DB の ID を頼りに、Gemini API の File Search Store から情報を取得**

## 詳細な処理フロー

### ステップ1: ファイルアップロード時

```
ユーザーがファイルをアップロード
  ↓
【API: /api/store】
  ↓
1. Gemini API に File Search Store を作成
   genAI.fileSearchStores.create()
   → 返り値: { name: "fileSearchStores/1234567890" }
  ↓
2. ファイルを File Search Store にアップロード
   genAI.fileSearchStores.uploadToFileSearchStore({
     fileSearchStoreName: "fileSearchStores/1234567890",
     file: fileBlob
   })
   → 裏側で自動的に：
     - テキスト抽出
     - チャンク分割
     - ベクトル化
     - File Search Store に保存
  ↓
3. DB に storeName を保存
   INSERT INTO sessions (store_name, file_name)
   VALUES ('fileSearchStores/1234567890', 'document.pdf')
   → DB の ID: session_id = "abc-123-def"
  ↓
4. フロントエンドに返却
   { sessionId: "abc-123-def", storeName: "fileSearchStores/1234567890" }
```

### ステップ2: ページリロード後、質問を送信時

```
ユーザーが質問を入力
  ↓
【API: /api/ask】
  ↓
1. DB から storeName を取得
   SELECT store_name FROM sessions WHERE id = 'abc-123-def'
   → storeName = "fileSearchStores/1234567890"
  ↓
2. Gemini API で File Search Tool を使用
   genAI.models.generateContent({
     tools: [{
       fileSearch: {
         fileSearchStoreNames: ["fileSearchStores/1234567890"]
       }
     }]
   })
   → 裏側で自動的に：
     - 質問をベクトル化
     - File Search Store で類似度検索
     - 関連チャンクを取得
     - 回答生成
  ↓
3. 回答と引用を返却
   { answer: "...", citations: [...] }
```

## データの所在とアクセス方法

### データの保存場所

```
┌─────────────────────────────────────────────┐
│  Gemini API (File Search Store)            │
│  ┌───────────────────────────────────────┐  │
│  │ ファイルデータ                        │  │
│  │ ベクトルデータ（エンベディング）      │  │
│  │ チャンクデータ                        │  │
│  │ メタデータ（ページ番号など）          │  │
│  └───────────────────────────────────────┘  │
│  ID: fileSearchStores/1234567890           │
│  ↑                                          │
│  │ このIDがあればアクセス可能              │
└─────────────────────────────────────────────┘
         ↑
         │
┌─────────────────────────────────────────────┐
│  データベース（参照テーブル）              │
│  ┌───────────────────────────────────────┐  │
│  │ id: "abc-123-def"                     │  │
│  │ store_name: "fileSearchStores/1234..."│  │ ← これだけ保存
│  │ file_name: "document.pdf"             │  │
│  │ created_at: "2024-01-01 12:00:00"    │  │
│  └───────────────────────────────────────┘  │
│  ↑                                          │
│  │ DBのIDで検索                            │
└─────────────────────────────────────────────┘
```

### アクセスの流れ

```
1. フロントエンド: sessionId = "abc-123-def" を知っている
   ↓
2. API: DB から storeName を取得
   SELECT store_name FROM sessions WHERE id = 'abc-123-def'
   → "fileSearchStores/1234567890"
   ↓
3. API: Gemini API に storeName を渡す
   fileSearchStoreNames: ["fileSearchStores/1234567890"]
   ↓
4. Gemini API: File Search Store からデータを取得
   - ベクトル検索
   - チャンク取得
   - 回答生成
```

## 実装例

### データベーススキーマ

```sql
-- セッション管理テーブル
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT NOT NULL,  -- File Search Store の ID
  file_name TEXT,            -- 元のファイル名（表示用）
  user_id TEXT,              -- ユーザーID（オプション）
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- インデックス（検索を高速化）
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_store_name ON sessions(store_name);
```

### API実装例

#### `/api/store` - ファイルアップロード

```typescript
// app/api/store/route.ts
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  // ... 既存のコード（File Search Store 作成・ファイルアップロード） ...

  const storeName = store.name // "fileSearchStores/1234567890"

  // DB に storeName を保存
  const session = await db.sessions.create({
    data: {
      store_name: storeName, // ← これだけ保存
      file_name: file.name,
      // user_id: getUserId(request), // 認証がある場合
    },
  })

  return NextResponse.json({
    sessionId: session.id, // DB の ID
    storeName: storeName, // File Search Store の ID
  })
}
```

#### `/api/ask` - 質問処理

```typescript
// app/api/ask/route.ts
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { sessionId, question } = body // sessionId を受け取る

  // DB から storeName を取得
  const session = await db.sessions.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  const storeName = session.store_name // "fileSearchStores/1234567890"

  // Gemini API で File Search Tool を使用
  const result = await genAI.models.generateContent({
    model: modelName,
    contents: question,
    config: {
      tools: [
        {
          fileSearch: {
            fileSearchStoreNames: [storeName], // ← DB から取得した storeName を使用
          },
        },
      ],
    },
  })

  // ... 既存のコード（回答と引用の抽出） ...
}
```

#### `/api/session` - セッション情報取得

```typescript
// app/api/session/route.ts
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get('sessionId')

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
  }

  const session = await db.sessions.findUnique({
    where: { id: sessionId },
  })

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  return NextResponse.json({
    sessionId: session.id,
    storeName: session.store_name,
    fileName: session.file_name,
    createdAt: session.created_at,
  })
}
```

### フロントエンド実装例

```typescript
// app/page.tsx
export default function Home() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [storeName, setStoreName] = useState<string | null>(null)

  // ページロード時にセッションを復元
  useEffect(() => {
    const savedSessionId = localStorage.getItem('fileSearchSessionId')
    if (savedSessionId) {
      // DB からセッション情報を取得
      fetch(`/api/session?sessionId=${savedSessionId}`)
        .then((res) => res.json())
        .then((data) => {
          setSessionId(data.sessionId)
          setStoreName(data.storeName)
        })
    }
  }, [])

  const handleUpload = async () => {
    // ... ファイルアップロード処理 ...

    const response = await fetch('/api/store', {
      method: 'POST',
      body: formData,
    })

    const { sessionId, storeName } = await response.json()

    // localStorage に sessionId を保存
    localStorage.setItem('fileSearchSessionId', sessionId)

    setSessionId(sessionId)
    setStoreName(storeName)
  }

  const handleAsk = async () => {
    if (!sessionId || !question.trim()) return

    // sessionId を送信（storeName は API 側で DB から取得）
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId, // ← DB の ID を送信
        question,
      }),
    })

    // ... 既存のコード ...
  }
}
```

## データフロー図（完全版）

```
┌─────────────┐
│  ユーザー   │
└──────┬──────┘
       │
       │ 1. ファイルアップロード
       ↓
┌─────────────────────────────────────┐
│  /api/store                         │
│  1. File Search Store 作成          │
│     → storeName = "fileSearchStores/1234..."
│  2. ファイルアップロード            │
│     → ベクトル化・保存（自動）      │
│  3. DB に保存                       │
│     INSERT INTO sessions (store_name)
│     → sessionId = "abc-123-def"     │
└──────┬──────────────────────────────┘
       │
       │ { sessionId, storeName }
       ↓
┌─────────────┐
│ フロント    │
│ localStorage│
│ sessionId   │
└──────┬──────┘
       │
       │ 2. ページリロード
       ↓
┌─────────────────────────────────────┐
│  /api/session?sessionId=abc-123-def│
│  SELECT store_name FROM sessions   │
│  WHERE id = 'abc-123-def'          │
│  → storeName = "fileSearchStores/1234..."
└──────┬──────────────────────────────┘
       │
       │ { storeName }
       ↓
┌─────────────┐
│ フロント    │
│ storeName   │
└──────┬──────┘
       │
       │ 3. 質問を送信
       ↓
┌─────────────────────────────────────┐
│  /api/ask                           │
│  1. DB から storeName を取得        │
│     SELECT store_name FROM sessions │
│     WHERE id = sessionId            │
│  2. Gemini API に storeName を渡す  │
│     fileSearchStoreNames: [storeName]│
│  3. File Search Store から取得      │
│     → ベクトル検索（自動）          │
│     → チャンク取得（自動）          │
│     → 回答生成（自動）              │
└──────┬──────────────────────────────┘
       │
       │ { answer, citations }
       ↓
┌─────────────┐
│  ユーザー   │
│  回答表示   │
└─────────────┘
```

## 重要なポイント

### 1. DB に保存するのは「参照情報」だけ

- ✅ `storeName` - File Search Store の ID（必須）
- ✅ `fileName` - 表示用（オプション）
- ❌ ベクトルデータ - File Search Store に保存済み
- ❌ ファイル内容 - File Search Store に保存済み

### 2. DB の ID は「鍵の鍵」として機能

```
DB の ID (sessionId)
  ↓
DB から storeName を取得
  ↓
Gemini API の File Search Store にアクセス
  ↓
データを取得
```

### 3. データは二重に保存されない

- **File Search Store**: 実際のデータ（ベクトル、チャンクなど）
- **DB**: 参照情報（storeName）だけ

これにより、データの重複を避け、管理が簡単になります。

## まとめ

1. ✅ **File Search Store の ID を DB に保存**
2. ✅ **DB の ID を頼りに storeName を取得**
3. ✅ **storeName を使って File Search Store から情報を取得**
4. ✅ **ベクトルデータは DB に保存しない**（File Search Store に既に保存されている）

この流れで、ページリロード後も File Search Store にアクセスできるようになります。
