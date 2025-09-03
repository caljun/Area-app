# 🚀 Area App API 更新内容

## 📋 追加されたAPIエンドポイント

### 1. チャット機能 (`/api/chat`)
- `GET /api/chat/rooms` - チャットルーム一覧取得
- `GET /api/chat/:id/messages` - 特定チャットのメッセージ取得
- `POST /api/chat/:id/messages` - メッセージ送信
- `PATCH /api/chat/:id/messages/:messageId/read` - メッセージ既読更新
- `POST /api/chat/rooms` - チャットルーム作成

### 2. エリア機能の拡張 (`/api/areas`)
- `POST /api/areas/:id/invite` - 友達をエリアに招待
- `POST /api/areas/:id/join` - エリアに参加
- `DELETE /api/areas/:id/leave` - エリアから退出
- `GET /api/areas/search` - エリア検索
- `GET /api/areas/nearby` - 近くのエリア取得

### 3. ユーザー検索機能 (`/api/users`)
- `GET /api/users/search` - ユーザー検索（名前・Area ID）

### 4. 友達機能の拡張 (`/api/friends`)
- `GET /api/friends/online` - オンラインの友達取得

## 🗄️ データベーススキーマの更新

### 新しく追加されたモデル
- `Chat` - チャットルーム
- `Message` - チャットメッセージ
- `AreaInvitation` - エリア招待

### 更新された関係
- Userモデルにチャット関連の関係を追加
- Areaモデルにエリア招待の関係を追加

## 🔧 実装の特徴

### チャット機能
- 1対1のチャットルーム
- メッセージの既読管理
- リアルタイム対応（WebSocket）

### エリア機能
- 友達のみエリアに招待可能
- パブリックエリアへの参加・退出
- 位置情報ベースの近くのエリア検索

### 検索機能
- ユーザー名・Area IDでの検索
- エリア名での検索
- 位置情報ベースの近くのエリア検索

## 🚀 使用方法

### 1. データベースの更新
```bash
cd backend
./update-database.sh
```

### 2. サーバーの再起動
```bash
npm run dev
```

## ⚠️ 注意事項

- 新しいスキーマを適用する前に、既存のデータのバックアップを取ってください
- 本番環境では、適切なマイグレーション戦略を検討してください
- 位置情報の計算は簡易版です。本格的な実装では地理空間インデックスを使用してください

## 🔍 テスト方法

### チャット機能のテスト
```bash
# チャットルーム作成
curl -X POST http://localhost:3000/api/chat/rooms \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"friendId": "FRIEND_USER_ID"}'

# メッセージ送信
curl -X POST http://localhost:3000/api/chat/CHAT_ID/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "こんにちは！"}'
```

### エリア機能のテスト
```bash
# エリア検索
curl "http://localhost:3000/api/areas/search?q=公園" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 近くのエリア取得
curl "http://localhost:3000/api/areas/nearby?lat=35.6762&lng=139.6503&radius=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📱 フロントエンドとの整合性

これらのAPIエンドポイントは、iOSアプリ（SwiftUI）の以下のファイルと完全に整合しています：

- `ChatService.swift` - チャット機能
- `AreaAPI.swift` - エリア機能
- `FriendsAPI.swift` - 友達機能
- `AuthAPI.swift` - 認証機能

フロントエンドの期待するデータ形式とレスポンス構造に合わせて実装されています。
