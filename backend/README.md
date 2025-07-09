# Area App Backend

Area AppのバックエンドAPIサーバーです。

## 機能

- ユーザー認証（JWT）
- エリア管理（作成、更新、削除、共有）
- フレンド機能（追加、リクエスト管理）
- 位置情報管理
- リアルタイム通信（Socket.io）

## 技術スタック

- **Node.js** + **Express.js**
- **TypeScript**
- **Prisma** (ORM)
- **PostgreSQL** (データベース)
- **Socket.io** (リアルタイム通信)
- **JWT** (認証)
- **Zod** (バリデーション)

## セットアップ

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`env.example`をコピーして`.env`ファイルを作成し、必要な値を設定してください：

```bash
cp env.example .env
```

### 3. データベースのセットアップ

```bash
# Prismaクライアントの生成
npm run db:generate

# データベースのマイグレーション
npm run db:migrate
```

### 4. 開発サーバーの起動

```bash
npm run dev
```

サーバーは `http://localhost:3000` で起動します。

## API エンドポイント

### 認証

- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `GET /api/auth/me` - 現在のユーザー情報

### ユーザー

- `GET /api/users/profile` - プロフィール取得
- `GET /api/users/search/:nowId` - ユーザー検索

### エリア

- `GET /api/areas` - ユーザーのエリア一覧
- `GET /api/areas/public` - 公開エリア一覧
- `GET /api/areas/:id` - エリア詳細
- `POST /api/areas` - エリア作成
- `PUT /api/areas/:id` - エリア更新
- `DELETE /api/areas/:id` - エリア削除

### フレンド

- `GET /api/friends` - フレンド一覧
- `GET /api/friends/requests` - フレンドリクエスト一覧
- `POST /api/friends/request` - フレンドリクエスト送信
- `PUT /api/friends/request/:requestId` - フレンドリクエスト応答
- `GET /api/friends/area-requests` - エリア共有リクエスト一覧
- `POST /api/friends/area-request` - エリア共有リクエスト送信
- `PUT /api/friends/area-request/:requestId` - エリア共有リクエスト応答

### 位置情報

- `POST /api/locations` - 位置情報更新
- `GET /api/locations/friends` - フレンドの位置情報
- `GET /api/locations/history` - 位置情報履歴

## データベーススキーマ

詳細は `prisma/schema.prisma` を参照してください。

## 開発

### スクリプト

- `npm run dev` - 開発サーバー起動
- `npm run build` - TypeScriptコンパイル
- `npm run start` - 本番サーバー起動
- `npm run db:generate` - Prismaクライアント生成
- `npm run db:push` - データベーススキーマ同期
- `npm run db:migrate` - データベースマイグレーション
- `npm run db:studio` - Prisma Studio起動

### 環境変数

| 変数名 | 説明 | デフォルト |
|--------|------|------------|
| `PORT` | サーバーポート | 3000 |
| `NODE_ENV` | 環境 | development |
| `DATABASE_URL` | データベースURL | - |
| `JWT_SECRET` | JWT秘密鍵 | - |
| `JWT_EXPIRES_IN` | JWT有効期限 | 7d |
| `CORS_ORIGIN` | CORS許可オリジン | http://localhost:8081 |
| `RATE_LIMIT_WINDOW_MS` | レート制限ウィンドウ | 900000 |
| `RATE_LIMIT_MAX_REQUESTS` | レート制限最大リクエスト数 | 100 | 