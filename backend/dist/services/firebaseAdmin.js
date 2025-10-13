"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeFirebaseAdmin = initializeFirebaseAdmin;
exports.sendPushNotification = sendPushNotification;
exports.sendPushNotificationToMultiple = sendPushNotificationToMultiple;
exports.sendAreaEntryExitNotification = sendAreaEntryExitNotification;
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const fs_1 = __importDefault(require("fs"));
let isInitialized = false;
function initializeFirebaseAdmin() {
    if (isInitialized) {
        console.log('Firebase Admin SDK は既に初期化されています');
        return;
    }
    try {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (serviceAccountJson) {
            const serviceAccount = JSON.parse(serviceAccountJson);
            firebase_admin_1.default.initializeApp({
                credential: firebase_admin_1.default.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id,
            });
            console.log('✅ Firebase Admin SDK が初期化されました（環境変数JSON使用）');
            isInitialized = true;
            return;
        }
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        if (serviceAccountPath && fs_1.default.existsSync(serviceAccountPath)) {
            const serviceAccount = JSON.parse(fs_1.default.readFileSync(serviceAccountPath, 'utf-8'));
            firebase_admin_1.default.initializeApp({
                credential: firebase_admin_1.default.credential.cert(serviceAccount),
                projectId: serviceAccount.project_id,
            });
            console.log('✅ Firebase Admin SDK が初期化されました（ファイル使用）');
            isInitialized = true;
            return;
        }
        console.warn('⚠️ Firebase Admin SDK: 認証情報が設定されていません');
        console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_JSON または FIREBASE_SERVICE_ACCOUNT_PATH を設定してください');
    }
    catch (error) {
        console.error('❌ Firebase Admin SDK の初期化に失敗:', error);
        console.error('Push通知機能は利用できません');
    }
}
async function sendPushNotification(deviceToken, title, body, data) {
    if (!isInitialized) {
        console.warn('⚠️ Firebase Admin SDK が初期化されていません。Push通知を送信できません。');
        return false;
    }
    try {
        const message = {
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
        const response = await firebase_admin_1.default.messaging().send(message);
        console.log('✅ Push通知送信成功:', response);
        return true;
    }
    catch (error) {
        console.error('❌ Push通知送信失敗:', error);
        if (error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered') {
            console.error('無効なデバイストークン:', deviceToken);
        }
        return false;
    }
}
async function sendPushNotificationToMultiple(deviceTokens, title, body, data) {
    if (!isInitialized) {
        console.warn('⚠️ Firebase Admin SDK が初期化されていません。Push通知を送信できません。');
        return { successCount: 0, failureCount: deviceTokens.length };
    }
    if (deviceTokens.length === 0) {
        return { successCount: 0, failureCount: 0 };
    }
    try {
        const message = {
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
        const response = await firebase_admin_1.default.messaging().sendEachForMulticast(message);
        console.log(`✅ Push通知一括送信完了: 成功 ${response.successCount}, 失敗 ${response.failureCount}`);
        response.responses.forEach((resp, idx) => {
            if (!resp.success) {
                console.error(`❌ デバイストークン ${deviceTokens[idx]} への送信失敗:`, resp.error);
            }
        });
        return {
            successCount: response.successCount,
            failureCount: response.failureCount,
        };
    }
    catch (error) {
        console.error('❌ Push通知一括送信失敗:', error);
        return { successCount: 0, failureCount: deviceTokens.length };
    }
}
async function sendAreaEntryExitNotification(deviceTokens, title, body, data) {
    if (!isInitialized) {
        console.warn('⚠️ Firebase Admin SDK が初期化されていません。Push通知を送信できません。');
        return { successCount: 0, failureCount: deviceTokens.length };
    }
    if (deviceTokens.length === 0) {
        return { successCount: 0, failureCount: 0 };
    }
    try {
        const message = {
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
        const response = await firebase_admin_1.default.messaging().sendEachForMulticast(message);
        console.log(`✅ エリア入退場通知送信完了: 成功 ${response.successCount}, 失敗 ${response.failureCount}`);
        return {
            successCount: response.successCount,
            failureCount: response.failureCount,
        };
    }
    catch (error) {
        console.error('❌ エリア入退場通知送信失敗:', error);
        return { successCount: 0, failureCount: deviceTokens.length };
    }
}
exports.default = firebase_admin_1.default;
