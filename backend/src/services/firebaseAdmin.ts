import admin from 'firebase-admin';

let isInitialized = false;

/**
 * Firebase Admin SDKの初期化（再有効化）
 */
export function initializeFirebaseAdmin() {
  if (isInitialized) {
    console.log('Firebase Admin SDK は既に初期化されています');
    return;
  }

  try {
    // 環境変数からサービスアカウント情報を取得
    const serviceAccount: admin.ServiceAccount = {
      type: 'service_account',
      project_id: process.env.FIREBASE_PROJECT_ID || 'area-90c52',
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || 'bf1a1c060ee8fd2fd5daee5b267f3bd88599382a',
      private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDexCWLl+nZISNs
uS2rf1kzOKWfxNQ2rmo6btvkeu1rySb8S55feo+UIx6xpTEfG3vqf5XnTIlVy4/+
dXmcZ6vjUdHvlfT8MYeuIXllrnoj/6DFXdJnzKJed72QEiYzwGbbaQFMk+vxQwDZ
RUIjtwtRiZwCify7XbB6/Fijz9KncHFiiihXb70PLUde1PkT84uZ7PiKpNCUdP4R
2uz2kBjEMcN5AX2Q2PxtmoJMBBBf/85l6falrBibIkVPps8WIdYLt0fYqVI97VMe
Ftlvq0pT9vtxUDr4KZDSVMKmIjJQBVePG9zTIBOe4DM99xlQFvXrcvrywzhr53KY
+ZZuYISLAgMBAAECggEAUq5hsxSg3o6+q7l1enxLWsgRLSIsk9kbo3GHGyAHJCTm
W+kjMJP4W4bHey7xcvbMAOb2+AD/zkC+QrdOel8+PKKfNXomkj49+kMBYFyoh9j2
zpp6oD0jHMX7rVAXLskgRBqOuWIDxinU1E+w8zmasVpOdeDKVa659IPZ0H8v1CYl
52OYSFIgKmU9UabFh/S9s8ieC8r/g9g7XAmhujqPuaBUAC59wBnNRt+8pCgs75rk
2Gncd8dgOLLOIUtxKsUW6hR4GOeZ/ViHxIiGlX+NTOOUPnKEIxX07JB6KLmPrKfq
olfQGPcMWMq3ggxoQx5s36W1xYCYH9/4rNcPZGPI+QKBgQD7P5p0AP6y/KstijVh
g1iHHmG2h+YHGYD4SrX+wt8GXKMulqeNT7jlR3j4l/yoez6OqMfz9sJcofMNcv7A
LrhkaIY8P19zhXbBSNoXFBjP0DBZPD9qj7wg8Akr0rOBD3J4Mj5Y14nKrdc8b3kR
dewyroAfIo7swAiO/EqW17gQuQKBgQDi+qYp4p3Y1Bw3rcbqGDWLjq3eeOF+P509
4r/w7IczgG5FOvt8/u0wy4Qb5frBKzj63+c3o/Fpa2D6rset2JM5RGUB7EbAKeJS
fHIG7dE/fqWEbaWvh1o0IwwoDK7BWixcszJ+xTC4s5UijxLHYTFVz2kANE7nthQK
ulQIqTn1YwKBgC63ouaTEMkDRmkPW+Gn5JwrQAwKtPD5AwwoCDM41PN/4i/Vf449
Fqo7YfkHeclyMS2hoJxyc615x5HmogvmJA83iE5Hkl4OoQhLnZHRANQTaAoPs9MC
qv6M44eshAgpcSV8Yi9u1IZFUNJCAAcJIEREQjqH2H+ZLX441z25GtaxAoGAWjpR
O20+WidXYDrQS9Z70pJRQ5LB8LHRC/zLWDZuOGbhbtvXhQTBvRfp2D0/xPItoGzJ
OTEOkl2BG6XG8rCZNbaegHkwVstPkIKvwVlgSOFLYq1Do9cmYHteJb2E6o+x+tex
RvuUNpgMvMQrLt7QAdCFaPNiOnIC3ZDcPuUmiQkCgYEA6WMICm+vQ4XknTTO566P
nuoiZsqbcoQtievU5REwqW4TXjp7HH5DNGKXcJVyplS2vaYQzuwsvobO5VbLU2vB
QQlODrgdieTdnt4nmoNhSTEeuWLo3W539wfV+V3yqv2MTjPaaG0+Ccp8JYIAMHI8
e+ReKvJraIOVuVSDdGHi7nE=
-----END PRIVATE KEY-----`,
      client_email: process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-fbsvc@area-90c52.iam.gserviceaccount.com',
      client_id: process.env.FIREBASE_CLIENT_ID || '114145158376487522101',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40area-90c52.iam.gserviceaccount.com',
      universe_domain: 'googleapis.com'
    };

    // 必須環境変数の確認
    if (!serviceAccount.project_id || !serviceAccount.private_key || !serviceAccount.client_email) {
      console.warn('⚠️ Firebase Admin SDK: 必須環境変数が設定されていません');
      console.warn('⚠️ 必要な環境変数: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL');
      console.warn('⚠️ デフォルト値を使用して初期化を試行します');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('✅ Firebase Admin SDK が初期化されました（環境変数使用）');
    console.log(`プロジェクトID: ${serviceAccount.project_id}`);
    console.log(`クライアントメール: ${serviceAccount.client_email}`);
    isInitialized = true;
  } catch (error) {
    console.error('❌ Firebase Admin SDK の初期化に失敗:', error);
    console.error('Push通知機能は利用できません');
    
    // エラーの詳細をログ出力
    if (error instanceof Error) {
      console.error('エラー詳細:', error.message);
      if (error.message.includes('invalid_grant')) {
        console.error('🔍 invalid_grantエラーの原因:');
        console.error('1. サービスアカウントの権限不足');
        console.error('2. プロジェクトIDの不一致');
        console.error('3. private_keyの形式エラー');
        console.error('4. クライアントメールの不一致');
      }
    }
  }
}

/**
 * Push通知を送信（再有効化）
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
            alert: {
              title,
              body,
            },
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
 * 複数のデバイスにPush通知を送信（再有効化）
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
            alert: {
              title,
              body,
            },
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

/**
 * エリア入退場通知を送信（再有効化）
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

