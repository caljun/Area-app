# Firebase Cloud Messaging (FCM) セットアップガイド

このドキュメントでは、Area AppにFirebase Cloud Messaging（FCM）を統合し、Push通知を送信できるようにする手順を説明します。

---

## 📋 前提条件

- Firebase プロジェクトが作成済み（プロジェクトID: `area-90c52`）
- iOS側で `GoogleService-Info.plist` が設定済み
- Node.js バックエンドが稼働中

---

## 🔧 バックエンド側のセットアップ

### 1. Firebase Admin SDK のインストール

既にインストール済みです。確認するには：

```bash
cd backend
npm list firebase-admin
```

### 2. Firebase サービスアカウントキーの取得

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクト `area-90c52` を選択
3. 左メニューの「プロジェクトの設定」⚙️ をクリック
4. 「サービスアカウント」タブを選択
5. 「新しい秘密鍵を生成」ボタンをクリック
6. ダウンロードされたJSONファイルを `backend/firebase-service-account.json` として保存

**⚠️ 重要**: このファイルは機密情報を含むため、Gitにコミットしないでください。

### 3. 環境変数の設定

`backend/.env` ファイルを作成し、以下の環境変数を追加：

```env
# Firebase Admin SDK (Push通知)
FIREBASE_SERVICE_ACCOUNT_PATH="./firebase-service-account.json"

# または、クラウド環境（Renderなど）の場合はプロジェクトIDのみ指定
# FIREBASE_PROJECT_ID="area-90c52"
```

既存の `.env` ファイルがある場合は、上記を追加してください。

### 4. バックエンドの起動

```bash
cd backend
npm run dev
```

起動時に以下のログが表示されれば成功です：

```
✅ Database connected successfully
✅ Firebase Admin SDK が初期化されました（サービスアカウントキー使用）
```

---

## 📱 iOS側の設定（既に完了）

以下の設定は既に実装済みです：

- ✅ Firebase SDK の初期化
- ✅ Firebase Messaging の統合
- ✅ FCMトークンの取得とバックエンドへの送信
- ✅ Push通知受信時のバックグラウンド処理
- ✅ `Info.plist` にバックグラウンドモードの設定

---

## 🧪 動作確認

### 1. FCMトークンが正しく登録されているか確認

iOS アプリを起動し、Xcodeのコンソールで以下のログを確認：

```
✅ FCMトークン取得成功
📱 FCMトークン: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
✅ FCMトークンをバックエンドに送信しました
```

### 2. Push通知が送信されるか確認

1. デバイスAでアプリを起動し、エリアに参加
2. デバイスBでアプリを起動し、同じエリアに参加
3. デバイスAをバックグラウンドに移動
4. デバイスBで位置を移動
5. デバイスAにPush通知が届き、位置情報が自動更新されることを確認

### 3. バックエンドのログで確認

デバイスBが位置を更新した時、バックエンドのログに以下が表示されます：

```
🌐 WebSocket通知送信: 1人の友達に個別送信完了
📱 Push通知送信完了: 1人の友達に送信
```

---

## 🔥 実装されている機能

### バックエンド側

1. **Firebase Admin SDK の初期化**
   - ファイル: `src/services/firebaseAdmin.ts`
   - サービスアカウントキーを使用してFirebase Admin SDKを初期化

2. **Push通知送信機能**
   - ファイル: `src/index.ts`
   - 位置情報更新時に、WebSocket未接続の友達へPush通知を送信
   - 通知内容: 「友達が移動しました」+ ユーザー名とエリア情報

### iOS側

1. **Firebase Messaging の統合**
   - ファイル: `Area/AreaApp.swift`
   - FCMトークンの取得とバックエンドへの送信

2. **バックグラウンドPush通知受信**
   - ファイル: `Area/AreaApp.swift` (`AppDelegate`)
   - Push通知を受信すると、バックグラウンドで友達の位置情報を自動同期
   - `action: "friend_moved"` の通知を処理

3. **リアルタイム同期**
   - フォアグラウンド: Socket.io経由でリアルタイム更新
   - バックグラウンド: FCM経由でPush通知を受信し、バックグラウンドで位置情報を同期

---

## 🚀 クラウド環境（Render）でのデプロイ

Renderなどのクラウド環境では、サービスアカウントキーファイルの代わりに環境変数を使用できます：

1. Firebaseコンソールでサービスアカウントキーをダウンロード
2. JSONファイルの内容を環境変数 `FIREBASE_SERVICE_ACCOUNT_JSON` に設定
3. `src/services/firebaseAdmin.ts` で環境変数から読み込むように変更

または、Application Default Credentials を使用：

```env
FIREBASE_PROJECT_ID="area-90c52"
```

---

## 🐛 トラブルシューティング

### Push通知が届かない

1. **FCMトークンが登録されているか確認**
   - データベースで `deviceToken` フィールドが設定されているか確認

2. **Firebase Admin SDK が初期化されているか確認**
   - バックエンド起動時のログを確認
   - サービスアカウントキーのパスが正しいか確認

3. **iOS側で通知権限が許可されているか確認**
   - 設定 > Area > 通知 が「許可」になっているか確認

4. **バックグラウンドモードが有効か確認**
   - `Info.plist` に `remote-notification` が含まれているか確認

### Firebase Admin SDK の初期化エラー

```
❌ Firebase Admin SDK の初期化に失敗
```

- サービスアカウントキーファイルが存在するか確認
- パスが正しいか確認（`./firebase-service-account.json`）
- JSONファイルの内容が正しいか確認

---

## 📚 参考資料

- [Firebase Cloud Messaging - iOS](https://firebase.google.com/docs/cloud-messaging/ios/client)
- [Firebase Admin SDK - Node.js](https://firebase.google.com/docs/admin/setup)
- [iOS Background Modes](https://developer.apple.com/documentation/usernotifications/handling_notifications_and_notification-related_actions)

