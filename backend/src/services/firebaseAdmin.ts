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
    // サービスアカウントキーのパスを環境変数から取得
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
    
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
      // サービスアカウントキーファイルを使用して初期化
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });
      
      console.log('✅ Firebase Admin SDK が初期化されました（サービスアカウントキー使用）');
    } else {
      // Application Default Credentials（Renderなどのクラウド環境）を使用
      // 環境変数FIREBASE_PROJECT_IDが必要
      const projectId = process.env.FIREBASE_PROJECT_ID;
      
      if (!projectId) {
        console.warn('⚠️ Firebase Admin SDK: プロジェクトIDが設定されていません');
        console.warn('⚠️ FIREBASE_PROJECT_ID または FIREBASE_SERVICE_ACCOUNT_PATH を設定してください');
        return;
      }
      
      admin.initializeApp({
        projectId: projectId,
      });
      
      console.log('✅ Firebase Admin SDK が初期化されました（Application Default Credentials使用）');
    }
    
    isInitialized = true;
  } catch (error) {
    console.error('❌ Firebase Admin SDK の初期化に失敗:', error);
    console.error('Push通知機能は利用できません');
  }
}

/**
 * Push通知を送信
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
      notification: {
        title,
        body,
      },
      data: data || {},
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
            sound: 'default',
            badge: 1,
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
 * 複数のデバイスにPush通知を送信
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
      notification: {
        title,
        body,
      },
      data: data || {},
      apns: {
        payload: {
          aps: {
            contentAvailable: true,
            sound: 'default',
            badge: 1,
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

export default admin;

