# Next.js アプリケーション開発ガイド

## はじめに

このドキュメントは、Next.jsを使用したモダンなWebアプリケーション開発に関する包括的なガイドです。Next.jsは、Reactベースのフレームワークで、サーバーサイドレンダリング（SSR）や静的サイト生成（SSG）などの機能を提供します。

## 目次

1. [プロジェクトのセットアップ](#プロジェクトのセットアップ)
2. [基本的なページ作成](#基本的なページ作成)
3. [APIルートの実装](#apiルートの実装)
4. [データフェッチング](#データフェッチング)
5. [ルーティング](#ルーティング)
6. [スタイリング](#スタイリング)
7. [デプロイメント](#デプロイメント)
8. [トラブルシューティング](#トラブルシューティング)

## プロジェクトのセットアップ

### 必要な環境

Next.jsプロジェクトを開始する前に、以下の環境が必要です：

- **Node.js**: バージョン18.17以上
- **npm** または **yarn** または **pnpm**: パッケージマネージャー
- **コードエディタ**: VS Code、WebStormなど

### プロジェクトの作成

新しいNext.jsプロジェクトを作成するには、以下のコマンドを実行します：

```bash
npx create-next-app@latest my-app
cd my-app
npm run dev
```

### プロジェクト構造

Next.jsプロジェクトの基本的な構造は以下の通りです：

```
my-app/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── public/
├── package.json
└── next.config.js
```

## 基本的なページ作成

### ページコンポーネント

Next.jsでは、`app`ディレクトリ内の`page.tsx`ファイルがページとして認識されます。

```typescript
export default function Home() {
  return (
    <div>
      <h1>ようこそ Next.js へ</h1>
      <p>これはホームページです</p>
    </div>
  );
}
```

### 動的コンテンツ

Reactの状態管理を使用して、動的なコンテンツを表示できます：

```typescript
'use client';

import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>カウント: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        インクリメント
      </button>
    </div>
  );
}
```

## APIルートの実装

### 基本的なAPIエンドポイント

Next.jsでは、`app/api`ディレクトリ内にAPIルートを作成できます。

```typescript
// app/api/hello/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: 'Hello, Next.js!' })
}

export async function POST(request: Request) {
  const body = await request.json()
  return NextResponse.json({ received: body })
}
```

### エラーハンドリング

APIルートでエラーハンドリングを実装する例：

```typescript
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // 何らかの処理
    const data = await fetchData()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'データの取得に失敗しました' }, { status: 500 })
  }
}
```

## データフェッチング

### サーバーコンポーネントでのデータフェッチ

Next.js 13以降では、サーバーコンポーネントで直接データをフェッチできます：

```typescript
async function getData() {
  const res = await fetch('https://api.example.com/data', {
    cache: 'no-store', // 常に最新データを取得
  });

  if (!res.ok) {
    throw new Error('データの取得に失敗しました');
  }

  return res.json();
}

export default async function Page() {
  const data = await getData();

  return <div>{/* データを表示 */}</div>;
}
```

### クライアントサイドでのデータフェッチ

クライアントコンポーネントでは、`useEffect`や`SWR`、`React Query`などを使用します：

```typescript
'use client';

import { useEffect, useState } from 'react';

export default function ClientComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then((res) => res.json())
      .then((data) => setData(data));
  }, []);

  if (!data) return <div>読み込み中...</div>;

  return <div>{/* データを表示 */}</div>;
}
```

## ルーティング

### 静的ルート

`app`ディレクトリ内にフォルダを作成することで、ルートを定義できます：

- `app/about/page.tsx` → `/about`
- `app/contact/page.tsx` → `/contact`

### 動的ルート

角括弧を使用して動的ルートを作成できます：

```typescript
// app/blog/[slug]/page.tsx
export default function BlogPost({ params }: { params: { slug: string } }) {
  return <div>ブログ投稿: {params.slug}</div>;
}
```

### ネストされたルート

フォルダ構造でネストされたルートを作成できます：

- `app/shop/products/[id]/page.tsx` → `/shop/products/123`

## スタイリング

### CSS Modules

CSS Modulesを使用して、コンポーネントにスコープされたスタイルを適用できます：

```css
/* app/components/Button.module.css */
.button {
  padding: 10px 20px;
  background-color: #0070f3;
  color: white;
  border: none;
  border-radius: 5px;
}
```

```typescript
import styles from './Button.module.css';

export default function Button() {
  return <button className={styles.button}>クリック</button>;
}
```

### Tailwind CSS

Tailwind CSSを使用する場合、`tailwind.config.js`を設定します：

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

## デプロイメント

### Vercelへのデプロイ

VercelはNext.jsの開発元が提供するホスティングプラットフォームです：

1. GitHubリポジトリにコードをプッシュ
2. Vercelアカウントにログイン
3. 新しいプロジェクトを作成
4. GitHubリポジトリを選択
5. デプロイを開始

### 環境変数の設定

本番環境で環境変数を設定するには、Vercelダッシュボードで設定するか、`vercel.json`を使用します：

```json
{
  "env": {
    "DATABASE_URL": "your-database-url"
  }
}
```

### ビルドとテスト

デプロイ前に、ローカルでビルドとテストを実行します：

```bash
npm run build
npm run start
```

## トラブルシューティング

### よくある問題と解決方法

#### 問題1: ページが表示されない

**原因**: ファイル名やディレクトリ構造が正しくない可能性があります。

**解決方法**:

- `app`ディレクトリ内に`page.tsx`ファイルが存在することを確認
- ファイル名が正確であることを確認（大文字小文字に注意）

#### 問題2: APIルートが404を返す

**原因**: ルートファイルの場所やエクスポートが正しくない可能性があります。

**解決方法**:

- `app/api/[route]/route.ts`の形式になっているか確認
- `GET`、`POST`などの関数が正しくエクスポートされているか確認

#### 問題3: スタイルが適用されない

**原因**: CSSファイルのインポートや設定が正しくない可能性があります。

**解決方法**:

- `globals.css`が`layout.tsx`でインポートされているか確認
- Tailwind CSSを使用している場合、設定ファイルを確認

### パフォーマンスの最適化

#### 画像の最適化

Next.jsの`Image`コンポーネントを使用して画像を最適化します：

```typescript
import Image from 'next/image';

export default function MyImage() {
  return (
    <Image
      src="/image.jpg"
      alt="説明"
      width={500}
      height={300}
      priority // 優先的に読み込む
    />
  );
}
```

#### コード分割

動的インポートを使用してコード分割を実装します：

```typescript
import dynamic from 'next/dynamic';

const DynamicComponent = dynamic(() => import('../components/Heavy'), {
  loading: () => <p>読み込み中...</p>,
});
```

## ベストプラクティス

### セキュリティ

- APIキーや機密情報は環境変数に保存
- ユーザー入力のバリデーションを必ず実装
- XSS攻撃を防ぐため、サニタイズを実施

### パフォーマンス

- 不要な再レンダリングを避ける
- 適切なキャッシュ戦略を実装
- 画像やアセットの最適化を実施

### コード品質

- TypeScriptを使用して型安全性を確保
- ESLintとPrettierでコードフォーマットを統一
- 適切なエラーハンドリングを実装

## まとめ

このガイドでは、Next.jsを使用したアプリケーション開発の基本的な概念と実装方法を説明しました。Next.jsは強力なフレームワークであり、適切に使用することで、高性能なWebアプリケーションを効率的に開発できます。

### 次のステップ

- Next.jsの公式ドキュメントを参照
- サンプルプロジェクトを作成して実践
- コミュニティのベストプラクティスを学習

### 参考リソース

- [Next.js公式ドキュメント](https://nextjs.org/docs)
- [React公式ドキュメント](https://react.dev)
- [Vercelプラットフォーム](https://vercel.com)

## よくある質問（FAQ）

### Q1: Next.jsとReactの違いは何ですか？

**A**: Next.jsはReactのフレームワークです。ReactはUIライブラリですが、Next.jsはルーティング、サーバーサイドレンダリング、ビルド最適化などの機能を追加します。

### Q2: サーバーコンポーネントとクライアントコンポーネントの違いは？

**A**: サーバーコンポーネントはサーバー側でレンダリングされ、クライアントに送信されます。クライアントコンポーネントはブラウザでレンダリングされ、インタラクティブな機能を提供します。

### Q3: APIルートはどのように使用しますか？

**A**: APIルートは`app/api`ディレクトリ内に作成し、`GET`、`POST`などのHTTPメソッドをエクスポートします。これにより、フルスタックアプリケーションを構築できます。

### Q4: 環境変数はどのように設定しますか？

**A**: `.env.local`ファイルに環境変数を定義し、`process.env.VARIABLE_NAME`でアクセスできます。本番環境では、ホスティングプラットフォームの設定で環境変数を設定します。

### Q5: パフォーマンスを向上させるには？

**A**: 画像の最適化、コード分割、適切なキャッシュ戦略、不要な再レンダリングの回避などが効果的です。Next.jsの`Image`コンポーネントや動的インポートを活用してください。

---

**最終更新日**: 2024年1月

**バージョン**: 1.0.0
