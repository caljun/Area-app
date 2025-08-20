import { Alert } from 'react-native';

// APIエラーハンドリング関数
export const handleApiError = (error: any, fallbackData: any = null) => {
  console.error('API Error:', error);
  
  let errorMessage = 'エラーが発生しました';
  
  if (error?.response?.status === 401) {
    errorMessage = '認証エラーが発生しました。ログインし直してください。';
  } else if (error?.response?.status === 0 || error?.message?.includes('Network Error')) {
    errorMessage = 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
  } else if (error?.response?.data?.error) {
    errorMessage = error.response.data.error;
  } else if (error?.message) {
    errorMessage = error.message;
  }
  
  Alert.alert('エラー', errorMessage);
  return fallbackData;
};

// 位置情報の更新関数
export const updateLocation = async (latitude: number, longitude: number, api: any) => {
  try {
    await api.post('/locations', { latitude, longitude });
    return true;
  } catch (error) {
    console.error('Location update failed:', error);
    return false;
  }
};

// データの安全な取得関数
export const safeApiCall = async (apiCall: () => Promise<any>, fallbackData: any = null) => {
  try {
    const response = await apiCall();
    return response.data;
  } catch (error) {
    return handleApiError(error, fallbackData);
  }
};

// オンライン状態の管理
export const checkOnlineStatus = (lastSeen: Date): boolean => {
  const now = new Date();
  const diffInMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
  return diffInMinutes < 5; // 5分以内ならオンライン
}; 