import admin from 'firebase-admin';
import path from 'path';
import fs from 'fs';

let isInitialized = false;

/**
 * Firebase Admin SDKの初期化
 */
export function initializeFirebaseAdmin() {
  if (isInitialized) {
    console.log('Firebase Admin SDK は既に初期化されています');
    return;
  }

  try {
    // 方法1: 環境変数からJSON文字列を直接取得（Render本番環境用）
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    
    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      
      console.log('✅ Firebase Admin SDK が初期化されました（環境変数JSON使用）');
      isInitialized = true;
      return;
    }
    
    // 方法2: サービスアカウントキーファイルを使用（ローカル開発用）
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      
      console.log('✅ Firebase Admin SDK が初期化されました（ファイル使用）');
      isInitialized = true;
      return;
    }
    
    // どの方法も設定されていない
    console.warn('⚠️ Firebase Admin SDK: 認証情報が設定されていません');
    console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_JSON または FIREBASE_SERVICE_ACCOUNT_PATH を設定してください');
    
  } catch (error) {
    console.error('❌ Firebase Admin SDK の初期化に失敗:', error);
    console.error('Push通知機能は利用できません');
  }
}

/**
 * Push通知を送信（サイレントPush）
 */
export async function sendPushNotification(
  deviceToken: string,
  title: string,
  body: string,
  data?: { [key: string]: string }
): Promise<boolean> {
  if (!isInitialized) {
    console.warn('⚠️ Firebase Admin SDK が初期化されていません。Push通知を送信できません。');
    return false;
  }

  try {
    const message: admin.messaging.Message = {
      token: deviceToken,
      data: {
        ...data,
        title,
        body,
      },
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Push通知送信成功:', response);
    return true;
  } catch (error: any) {
    console.error('❌ Push通知送信失敗:', error);
    
    // エラー詳細をログ出力
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      console.error('無効なデバイストークン:', deviceToken);
    }
    
    return false;
  }
}

/**
 * 複数のデバイスにPush通知を送信（サイレントPush）
 */
export async function sendPushNotificationToMultiple(
  deviceTokens: string[],
  title: string,
  body: string,
  data?: { [key: string]: string }
): Promise<{ successCount: number; failureCount: number }> {
  if (!isInitialized) {
    console.warn('⚠️ Firebase Admin SDK が初期化されていません。Push通知を送信できません。');
    return { successCount: 0, failureCount: deviceTokens.length };
  }

  if (deviceTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens: deviceTokens,
      data: {
        ...data,
        title,
        body,
      },
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`✅ Push通知一括送信完了: 成功 ${response.successCount}, 失敗 ${response.failureCount}`);
    
    // 失敗したトークンをログ出力
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        console.error(`❌ デバイストークン ${deviceTokens[idx]} への送信失敗:`, resp.error);
      }
    });
    
    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('❌ Push通知一括送信失敗:', error);
    return { successCount: 0, failureCount: deviceTokens.length };
  }
}

/**
 * エリア入退場通知を送信（通知表示あり）
 */
export async function sendAreaEntryExitNotification(
  deviceTokens: string[],
  title: string,
  body: string,
  data?: { [key: string]: string }
): Promise<{ successCount: number; failureCount: number }> {
  if (!isInitialized) {
    console.warn('⚠️ Firebase Admin SDK が初期化されていません。Push通知を送信できません。');
    return { successCount: 0, failureCount: deviceTokens.length };
  }

  if (deviceTokens.length === 0) {
    return { successCount: 0, failureCount: 0 };
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens: deviceTokens,
      notification: {
        title,
        body,
      },
      data: data || {},
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body,
            },
            sound: 'default',
            badge: 1,
            category: 'AREA_ENTRY_EXIT',
          },
        },
      },
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`✅ エリア入退場通知送信完了: 成功 ${response.successCount}, 失敗 ${response.failureCount}`);
    
    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('❌ エリア入退場通知送信失敗:', error);
    return { successCount: 0, failureCount: deviceTokens.length };
  }
}

export default admin;

