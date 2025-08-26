# Area App Backend

Area AppのバックエンドAPIサーバーです。iOSアプリケーションとの完全な互換性を提供します。

## 🚀 **新機能（iOSアプリ対応）**

### **認証システムの拡張**
- ✅ **5ステップ登録フロー** - 段階的なユーザー登録
- ✅ **Apple ID認証** - Apple Sign In対応
- ✅ **JWT認証** - セキュアなトークンベース認証
- ✅ **プロフィール完全性チェック** - プロフィール完成度の自動判定

### **通知システム**
- ✅ **リアルタイム通知** - 友達申請、エリア招待、位置情報更新
- ✅ **通知設定** - ユーザーごとの通知カスタマイズ
- ✅ **プッシュ通知対応** - iOSアプリ用の通知管理

### **位置情報共有**
- ✅ **リアルタイム位置更新** - Socket.ioによる即座の位置共有
- ✅ **友達位置表示** - 友達の現在位置を地図上に表示
- ✅ **位置履歴** - 過去の位置情報の管理

## 機能

- ユーザー認証（JWT + Apple ID）
- エリア管理（作成、更新、削除、共有）
- フレンド機能（追加、リクエスト管理）
- 位置情報管理（リアルタイム共有）
- 画像アップロード（Cloudinary）
- リアルタイム通信（Socket.io）
- 通知システム（友達申請、エリア招待、位置更新）

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

- `POST /api/auth/register` - 従来のユーザー登録
- `POST /api/auth/register/step1` - ステップ1: メールアドレス確認
- `POST /api/auth/register/step2` - ステップ2: Now ID確認
- `POST /api/auth/register/step3` - ステップ3: ユーザー名確認
- `POST /api/auth/register/step4` - ステップ4: パスワード確認
- `POST /api/auth/register/step5` - ステップ5: プロフィール画像設定
- `POST /api/auth/apple` - Apple ID認証
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
- `GET /api/areas/:id/members` - エリアメンバー一覧
- `POST /api/areas/:id/members` - メンバー追加
- `DELETE /api/areas/:id/members/:userId` - メンバー削除
- `GET /api/areas/memberships` - 参加エリア一覧

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

### 通知

- `POST /api/notifications` - 通知作成
- `GET /api/notifications` - 通知一覧取得
- `GET /api/notifications/:id` - 通知詳細
- `PUT /api/notifications/:id/read` - 通知を既読にする
- `PUT /api/notifications/:id` - 通知更新
- `DELETE /api/notifications/:id` - 通知削除
- `PUT /api/notifications/read-all` - 全通知を既読にする
- `GET /api/notifications/settings` - 通知設定取得
- `PUT /api/notifications/settings` - 通知設定更新

### 画像

- `POST /api/images/upload` - 画像アップロード
- `GET /api/images` - ユーザーの画像一覧
- `GET /api/images/:id` - 画像詳細
- `DELETE /api/images/:id` - 画像削除

## データベーススキーマ

詳細は `prisma/schema.prisma` を参照してください。

### 新しく追加されたモデル

**Notification**
- 通知の基本情報（タイプ、タイトル、メッセージ）
- 送信者・受信者の関連付け
- 既読・削除状態の管理

**NotificationSettings**
- ユーザーごとの通知設定
- プッシュ通知・メール通知の有効/無効
- 通知タイプ別の設定

## iOSアプリ対応

### 認証フロー

1. **Apple ID認証**: `POST /api/auth/apple`
2. **5ステップ登録**: 段階的なユーザー登録
3. **JWTトークン**: 認証後のAPI呼び出し

### プロフィール完全性チェック

すべての認証エンドポイントで、ユーザーのプロフィール完成度を自動判定します：

**レスポンス形式**:
```json
{
  "token": "jwt_token_here",
  "user": { ... },
  "isNewUser": true/false,
  "profileComplete": true/false,
  "missingFields": ["field1", "field2"]
}
```

**判定項目**:
- `name`: ユーザー名
- `areaId`: Area ID
- `profileImage`: プロフィール画像

**用途**:
- フロントエンドでのプロフィール完成度表示
- 新規ユーザーのガイダンス
- プロフィール更新の促進

### 通知システム

- **友達申請**: 自動通知作成
- **エリア招待**: エリア共有時の通知
- **位置情報更新**: リアルタイム位置共有通知

### 位置情報共有

- **リアルタイム更新**: Socket.ioによる即座の反映
- **友達位置表示**: 地図上での友達位置表示
- **位置履歴**: 過去の移動履歴の管理

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

## トラブルシューティング

### よくある問題

1. **データベース接続エラー**
   - MongoDB AtlasのIP制限を確認
   - 接続文字列の形式を確認

2. **通知が作成されない**
   - データベーススキーマの同期を確認
   - Prismaクライアントの再生成

3. **Apple ID認証エラー**
   - 環境変数の設定を確認
   - Apple Developer Programの設定確認

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。 