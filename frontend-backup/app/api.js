import axios from 'axios';
import Constants from 'expo-constants';

const api = axios.create({
  baseURL: Constants.expoConfig.extra.apiUrl + '/api',
  timeout: 10000, // 10秒タイムアウト
  headers: {
    'Content-Type': 'application/json',
  },
});

// リクエストインターセプター
api.interceptors.request.use(
  (config) => {
    // リクエスト前の処理
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// レスポンスインターセプター
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // ネットワークエラーの詳細ログ
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout:', error);
    } else if (!error.response) {
      console.error('Network error:', error);
    }
    
    return Promise.reject(error);
  }
);

export default api;
