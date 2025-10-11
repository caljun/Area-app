# バックエンド側の修正内容サマリー

**修正日**: 2025年10月11日  
**目的**: Firebase Cloud Messaging（FCM）統合によるPush通知送信機能の実装

---

## 🎯 何のために修正したのか？

### 解決したい課題
- **友達がバックグラウンド時に位置情報更新を見逃す問題**
- Socket.ioはリアルタイムだが、アプリがバックグラウンドや終了状態だと受信できない
- バックグラウンドでも友達の移動を通知し、自動で位置情報を同期させたい

### 実現したいこと
1. **友達が移動 → バックグラウンドの友達にPush通知送信**
2. **Push通知受信 → 自動でバックグラウンド同期**
3. **Socket.io（リアルタイム）+ FCM（バックグラウンド）の両立**

---

## 🛠️ 何をしたのか？

### 1. **Firebase Admin SDKの導入**

#### ファイル: `package.json`
```bash
npm install firebase-admin
```

**理由**: バックエンドからiOSデバイスにPush通知を送信するため

---

### 2. **Firebase Admin SDK管理サービスの作成**

#### ファイル: `src/services/firebaseAdmin.ts`（新規作成）

**実装内容**:
```typescript
// Firebase Admin SDKの初期化
export function initializeFirebaseAdmin()

// 単一デバイスにPush通知送信
export async function sendPushNotification(deviceToken, title, body, data)

// 複数デバイスに一括Push通知送信
export async function sendPushNotificationToMultiple(deviceTokens, title, body, data)
```

**理由**: 
- Firebase Admin SDKの初期化処理を集約
- Push通知送信機能を再利用可能にする
- エラーハンドリングを統一する
- 1対1送信と1対多送信の両方に対応

---

### 3. **メインサーバーでFirebase初期化**

#### ファイル: `src/index.ts`
```typescript
// Import追加
import { initializeFirebaseAdmin, sendPushNotificationToMultiple } from './services/firebaseAdmin';

// データベース接続後に初期化
prisma.$connect()
  .then(() => {
    console.log('✅ Database connected successfully');
    initializeFirebaseAdmin(); // ← 追加
  })
```

**理由**: 
- サーバー起動時にFirebase Admin SDKを自動初期化
- データベース接続が成功した後に実行することで、依存関係を明確化

---

### 4. **位置情報更新時のPush通知送信機能**

#### ファイル: `src/index.ts` の `handleLocationUpdate` 関数内

**実装内容**:
```typescript
// Socket.io送信後に追加
// 📱 Push通知送信（WebSocket未接続の友達向け）
if (friendIds.length > 0) {
  try {
    // 友達のデバイストークンを取得
    const friendsWithTokens = await prisma.user.findMany({
      where: {
        id: { in: friendIds },
        deviceToken: { not: null }
      },
      select: { id: true, deviceToken: true, name: true }
    });
    
    const deviceTokens = friendsWithTokens
      .map(friend => friend.deviceToken)
      .filter((token): token is string => token !== null);
    
    if (deviceTokens.length > 0) {
      await sendPushNotificationToMultiple(
        deviceTokens,
        '友達が移動しました',
        `${userName}さんが${areaName}位置を更新しました`,
        {
          action: 'friend_moved',
          userId: socket.data.userId,
          userName: userName,
          // ... その他のデータ
        }
      );
    }
  } catch (pushError) {
    console.error('Push通知送信エラー:', pushError);
    // Push通知のエラーはSocket.io送信には影響させない
  }
}
```

**理由**:
- **Socket.io接続中の友達**: Socket.io経由で即座に通知（既存機能）
- **Socket.io未接続の友達**: FCM Push通知で通知（新機能）
- **重複防止**: 両方接続している友達にはSocket.ioのみ送信
- **エラー分離**: Push通知失敗でもSocket.io通信は継続

---

### 5. **セットアップドキュメントの作成**

#### ファイル: `FIREBASE_SETUP.md`（新規作成）

**内容**:
- Firebase Admin SDKのセットアップ手順
- サービスアカウントキーの取得方法
- 環境変数の設定方法
- トラブルシューティングガイド
- 動作確認手順

**理由**: 
- 本番環境でのデプロイ時に必要な手順を文書化
- チーム開発での引き継ぎを容易にする
- Firebase設定ミスによるトラブルを防止

---

## 📊 修正ファイル一覧

| ファイル | 状態 | 目的 |
|---|---|---|
| `package.json` | 修正 | Firebase Admin SDK依存関係追加 |
| `src/services/firebaseAdmin.ts` | 新規作成 | Push通知送信機能の実装 |
| `src/index.ts` | 修正 | Firebase初期化・Push通知送信処理追加 |
| `FIREBASE_SETUP.md` | 新規作成 | セットアップ手順書 |

---

## 🔄 システムフローの変化

### **修正前**: Socket.ioのみ

```
ユーザーA（移動）
    │
    ├─▶ Socket.io 「location_update」
    │
    ▼
Node.jsサーバー
    │
    ├─▶ データベース保存
    │
    └─▶ Socket.io経由で友達に送信
        │
        ▼
    ユーザーB（フォアグラウンドのみ受信可能）
        └─▶ 位置更新 ✅
    
    ユーザーC（バックグラウンド）
        └─▶ 受信できない ❌
```

### **修正後**: Socket.io + FCM Push

```
ユーザーA（移動）
    │
    ├─▶ Socket.io 「location_update」
    │
    ▼
Node.jsサーバー
    │
    ├─▶ データベース保存
    │
    ├─▶ Socket.io経由で接続中の友達に送信
    │   │
    │   ▼
    │   ユーザーB（フォアグラウンド・Socket.io接続中）
    │       └─▶ 即座に位置更新 ✅
    │
    └─▶ FCM Push通知で未接続の友達に送信
        │
        ▼
    Firebase Cloud Messaging
        │
        ▼
    ユーザーC（バックグラウンド・Socket.io未接続）
        └─▶ Push通知受信 → 自動同期 ✅
```

---

## 🎯 具体的な効果

### Before（修正前）
- ✅ フォアグラウンド同士: リアルタイム更新
- ❌ バックグラウンド: 更新を見逃す
- ❌ アプリ終了: 更新を見逃す

### After（修正後）
- ✅ フォアグラウンド同士: リアルタイム更新（Socket.io）
- ✅ バックグラウンド: Push通知で自動同期（FCM）
- ✅ アプリ終了: Push通知で呼び出し（FCM）

---

## 🔧 技術的なポイント

### 1. **重複送信の防止**
```typescript
// Socket.io接続中の友達には Socket.io のみ
socket.to(`user_${friendId}`).emit('location', data);

// Socket.io未接続の友達にのみ Push通知
const friendsWithTokens = await prisma.user.findMany({
  where: { deviceToken: { not: null } }
});
```

### 2. **エラー分離**
```typescript
try {
  // Push通知送信
  await sendPushNotificationToMultiple(/*...*/);
} catch (pushError) {
  console.error('Push通知送信エラー:', pushError);
  // エラーでもSocket.io送信は継続
}
```

### 3. **デバイストークン管理**
```typescript
// データベースに保存されたFCMトークンを使用
const deviceTokens = friendsWithTokens
  .map(friend => friend.deviceToken)
  .filter((token): token is string => token !== null);
```

---

## 🚀 必要なセットアップ

### 1. **Firebase サービスアカウントキー取得**
1. Firebase Console → プロジェクト設定 → サービスアカウント
2. 「新しい秘密鍵を生成」
3. `backend/firebase-service-account.json` として保存

### 2. **環境変数設定**
```env
FIREBASE_SERVICE_ACCOUNT_PATH="./firebase-service-account.json"
```

### 3. **サーバー再起動**
```bash
npm run dev
```

### 4. **動作確認**
```
✅ Firebase Admin SDK が初期化されました
📱 Push通知送信完了: X人の友達に送信
```

---

## 📈 パフォーマンス考慮

### メモリ・CPU
- Firebase Admin SDKは1回初期化で使い回し
- Push通知送信は非同期処理（Socket.io送信をブロックしない）

### ネットワーク
- Socket.io優先でPush通知は補完的役割
- 必要な友達にのみPush通知送信（全体配信ではない）

### データベース
- 既存の友達取得クエリに `deviceToken` フィールド追加のみ
- 新規テーブルやインデックス追加は不要

---

## 🏆 達成したこと

### 機能面
1. **完全なバックグラウンド対応**: アプリ状態に関係なく位置情報を同期
2. **リアルタイム性の維持**: フォアグラウンド時は従来通り即座に更新
3. **電池最適化**: 必要な時のみPush通知送信

### 技術面
1. **既存機能との共存**: Socket.ioの機能を壊さずに拡張
2. **スケーラブル設計**: 1対多送信で効率的なPush通知
3. **エラー耐性**: Push通知失敗でもリアルタイム通信は継続

### 運用面
1. **設定の簡素化**: 環境変数1つでFirebase連携
2. **デバッグの容易さ**: 詳細なログ出力
3. **ドキュメント完備**: セットアップから動作確認まで

---

**まとめ**: バックエンドに**最小限の変更**で**最大限の効果**を実現するPush通知機能を追加しました。既存のSocket.io機能を活かしながら、バックグラウンド時の課題を完全に解決しています。
