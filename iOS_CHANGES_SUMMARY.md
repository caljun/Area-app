# iOS側の修正内容サマリー

**修正日**: 2025年10月11日  
**目的**: Firebase Cloud Messaging（FCM）統合によるバックグラウンドPush通知対応

---

## 📱 修正したファイル

### ✅ `Area/Area/AreaApp.swift`

たった1つのファイルのみ修正しました。

---

## 🔧 具体的な修正内容

### 1. インポート追加

```swift
import FirebaseMessaging
```

**場所**: ファイル冒頭（11行目）

---

### 2. `AppDelegate` に `MessagingDelegate` を追加

**変更前**:
```swift
class AppDelegate: NSObject, UIApplicationDelegate {
```

**変更後**:
```swift
class AppDelegate: NSObject, UIApplicationDelegate, MessagingDelegate {
```

**場所**: 138行目

---

### 3. `didFinishLaunchingWithOptions` にFirebase Messaging設定を追加

**変更前**:
```swift
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
    print("✅ AppDelegate: Background Fetch を設定")
    return true
}
```

**変更後**:
```swift
func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
    UIApplication.shared.setMinimumBackgroundFetchInterval(UIApplication.backgroundFetchIntervalMinimum)
    
    // Firebase Messaging のデリゲートを設定
    Messaging.messaging().delegate = self
    
    // リモート通知に登録
    application.registerForRemoteNotifications()
    
    print("✅ AppDelegate: Background Fetch と Firebase Messaging を設定")
    return true
}
```

**場所**: 141-152行目

---

### 4. APNsトークンをFirebaseに渡す処理を追加

**変更前**:
```swift
func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
    let token = tokenParts.joined()
    print("✅ デバイストークン: \(token)")
}
```

**変更後**:
```swift
func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    // APNsトークンをFirebase Messagingに渡す
    Messaging.messaging().apnsToken = deviceToken
    
    let tokenParts = deviceToken.map { data in String(format: "%02.2hhx", data) }
    let token = tokenParts.joined()
    print("✅ APNsデバイストークン: \(token)")
}
```

**場所**: 180-187行目

---

### 5. 新規メソッド追加（3つ）

#### ① FCMトークン受信処理

```swift
/// FCMトークンを受信した時の処理
func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("✅ FCMトークン取得成功")
    print("📱 FCMトークン: \(fcmToken ?? "nil")")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    guard let fcmToken = fcmToken else {
        print("❌ FCMトークンが取得できませんでした")
        return
    }
    
    // FCMトークンをバックエンドに送信
    sendFCMTokenToBackend(fcmToken)
}
```

**場所**: 196-209行目

---

#### ② バックグラウンドPush通知受信処理

```swift
/// バックグラウンドでPush通知を受信した時の処理
func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any]) async -> UIBackgroundFetchResult {
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print("📱 Push通知を受信（バックグラウンド）")
    print("📦 userInfo: \(userInfo)")
    print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    
    // Push通知のデータを確認
    guard let action = userInfo["action"] as? String else {
        print("⚠️ Push通知にactionが含まれていません")
        return .noData
    }
    
    print("🎬 action: \(action)")
    
    // 友達が移動した通知の場合、位置情報を更新
    if action == "friend_moved" {
        print("📍 友達が移動しました - 位置情報を同期開始")
        
        // LocationServiceを使って友達の位置情報を取得
        if let locationService = locationService {
            await locationService.fetchFriendsLocations()
            print("✅ バックグラウンドで友達の位置情報を更新しました")
            return .newData
        } else {
            print("❌ LocationServiceが設定されていません")
            return .noData
        }
    }
    
    return .noData
}
```

**場所**: 212-242行目

**重要**: このメソッドにより、アプリがバックグラウンドの時でもPush通知を受信すると自動的に友達の位置情報を同期します。

---

#### ③ FCMトークンをバックエンドに送信

```swift
/// FCMトークンをバックエンドに送信
private func sendFCMTokenToBackend(_ fcmToken: String) {
    // UserDefaultsから認証トークンを取得
    guard let authToken = UserDefaults.standard.string(forKey: "authToken") else {
        print("⚠️ 認証トークンが見つかりません - FCMトークン送信をスキップ")
        return
    }
    
    Task {
        do {
            let url = URL(string: "https://area-app.onrender.com/api/notifications/device-token")!
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            
            let body = ["deviceToken": fcmToken]
            request.httpBody = try JSONEncoder().encode(body)
            
            let (_, response) = try await URLSession.shared.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                if httpResponse.statusCode == 200 {
                    print("✅ FCMトークンをバックエンドに送信しました")
                } else {
                    print("❌ FCMトークン送信失敗: HTTPステータス \(httpResponse.statusCode)")
                }
            }
        } catch {
            print("❌ FCMトークン送信エラー: \(error.localizedDescription)")
        }
    }
}
```

**場所**: 247-278行目

---

## 📋 修正内容の要約

### 追加した機能

| 機能 | 説明 |
|---|---|
| **Firebase Messaging統合** | FCMトークンを取得してバックエンドに送信 |
| **バックグラウンドPush受信** | アプリがバックグラウンドでもPush通知を受信 |
| **自動位置情報同期** | Push通知受信時に友達の位置情報を自動で取得 |

### 変更した箇所

| 箇所 | 変更内容 | 行数 |
|---|---|---|
| インポート | `FirebaseMessaging` を追加 | 11行目 |
| AppDelegate | `MessagingDelegate` を追加 | 138行目 |
| 初期化処理 | Firebase Messaging設定を追加 | 145-149行目 |
| APNsトークン | Firebaseに渡す処理を追加 | 182行目 |
| **新規メソッド①** | FCMトークン受信処理 | 196-209行目 |
| **新規メソッド②** | バックグラウンドPush受信処理 | 212-242行目 |
| **新規メソッド③** | FCMトークン送信処理 | 247-278行目 |

---

## 🎯 この修正で実現できること

### シナリオ1: 友達が移動（あなたはバックグラウンド）

```
1. 友達が位置を更新
2. バックエンドからあなたのデバイスにPush通知送信
3. あなたのiPhoneがバックグラウンドで短時間起動
4. 自動的に友達の最新位置情報を取得
5. メモリに保存
6. アプリをフォアグラウンドに戻すと即座に表示
```

### シナリオ2: 友達が移動（あなたはアプリ終了）

```
1. 友達が位置を更新
2. バックエンドからあなたのデバイスにPush通知送信
3. 通知センターに通知が表示
4. 通知をタップするとアプリが起動
5. 最新の位置情報が表示される
```

---

## 📝 コピー用の完全な修正内容

別のプロジェクトに適用する場合は、以下をコピーしてください：

### `AreaApp.swift` の修正

```swift
// 1. インポートに追加（ファイル冒頭）
import FirebaseMessaging

// 2. AppDelegateの定義を変更
class AppDelegate: NSObject, UIApplicationDelegate, MessagingDelegate {

// 3. didFinishLaunchingWithOptions に追加
Messaging.messaging().delegate = self
application.registerForRemoteNotifications()

// 4. didRegisterForRemoteNotificationsWithDeviceToken に追加
Messaging.messaging().apnsToken = deviceToken

// 5. 以下の3つのメソッドを追加
// - messaging(_:didReceiveRegistrationToken:)
// - application(_:didReceiveRemoteNotification:)
// - sendFCMTokenToBackend(_:)
```

詳細なコードは上記の各セクションを参照してください。

---

## ✅ 確認ポイント

修正後、以下を確認してください：

### ビルド時
- [ ] エラーなくビルドできる
- [ ] `FirebaseMessaging` のインポートエラーがない

### 実行時（Xcodeコンソール）
- [ ] アプリ起動時に「✅ FCMトークン取得成功」が表示される
- [ ] 「✅ FCMトークンをバックエンドに送信しました」が表示される

### 動作確認
- [ ] 別のデバイスから位置を更新してPush通知が届く
- [ ] バックグラウンドで通知を受信できる
- [ ] フォアグラウンドに戻った時に最新位置が表示される

---

## 🚨 注意事項

1. **`Info.plist` の確認**
   - `UIBackgroundModes` に `remote-notification` が含まれていることを確認
   - 既に設定済みなので、追加修正は不要

2. **Firebase設定ファイル**
   - `GoogleService-Info.plist` がプロジェクトに含まれていることを確認
   - 既に設定済みなので、追加修正は不要

3. **バックエンドの準備**
   - バックエンド側でFirebase Admin SDKの設定が必要
   - 詳細は `backend/FIREBASE_SETUP.md` を参照

---

## 📂 ファイルの場所

```
Area-app/
└── Area/
    └── Area/
        └── AreaApp.swift  ← このファイル1つだけ修正
```

---

**以上が、iOS（フロント）側の全ての修正内容です。**

このファイルを別のプロジェクトにコピーして適用してください。ご不明な点がございましたら、お気軽にお尋ねください！

