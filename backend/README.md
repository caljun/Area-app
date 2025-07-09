# Area App Backend

Area AppのバックエンドAPIサーバーです。

## 機能

- ユーザー認証（JWT）
- エリア管理（作成、更新、削除、共有）
- フレンド機能（追加、リクエスト管理）
- 位置情報管理
- 画像アップロード（Cloudinary）
- リアルタイム通信（Socket.io）

## 技術スタック

- **Node.js** + **Express.js**
- **TypeScript**
- **Prisma** (ORM)
- **MongoDB** (データベース)
- **Cloudinary** (画像保存)
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

#### 必要な環境変数

**MongoDB**
- `DATABASE_URL`: MongoDBの接続URL
  - ローカル: `mongodb://localhost:27017/area_app`
  - MongoDB Atlas: `mongodb+srv://username:password@cluster.mongodb.net/area_app`

**Cloudinary**
- `CLOUDINARY_CLOUD_NAME`: Cloudinaryのクラウド名
- `CLOUDINARY_API_KEY`: CloudinaryのAPIキー
- `CLOUDINARY_API_SECRET`: CloudinaryのAPIシークレット

**その他**
- `JWT_SECRET`: JWTの秘密鍵
- `MAPBOX_ACCESS_TOKEN`: Mapboxのアクセストークン

### 3. データベースのセットアップ

```bash
# Prismaクライアントの生成
npm run db:generate

# データベースのスキーマ同期
npm run db:push
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

### 画像

- `POST /api/images/upload` - 画像アップロード
- `GET /api/images` - ユーザーの画像一覧
- `GET /api/images/:id` - 画像詳細
- `DELETE /api/images/:id` - 画像削除

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
| `DATABASE_URL` | MongoDB接続URL | - |
| `JWT_SECRET` | JWT秘密鍵 | - |
| `JWT_EXPIRES_IN` | JWT有効期限 | 7d |
| `CORS_ORIGIN` | CORS許可オリジン | http://localhost:8081 |
| `CLOUDINARY_CLOUD_NAME` | Cloudinaryクラウド名 | - |
| `CLOUDINARY_API_KEY` | Cloudinary APIキー | - |
| `CLOUDINARY_API_SECRET` | Cloudinary APIシークレット | - |
| `MAPBOX_ACCESS_TOKEN` | Mapboxアクセストークン | - |
| `RATE_LIMIT_WINDOW_MS` | レート制限ウィンドウ | 900000 |
| `RATE_LIMIT_MAX_REQUESTS` | レート制限最大リクエスト数 | 100 |

## 外部サービス設定

### MongoDB Atlas
1. [MongoDB Atlas](https://www.mongodb.com/atlas)でアカウント作成
2. クラスターを作成
3. データベースユーザーを作成
4. 接続文字列を取得して`DATABASE_URL`に設定

### Cloudinary
1. [Cloudinary](https://cloudinary.com/)でアカウント作成
2. ダッシュボードから認証情報を取得
3. 環境変数に設定

### Mapbox
1. [Mapbox](https://www.mapbox.com/)でアカウント作成
2. アクセストークンを取得
3. 環境変数に設定 