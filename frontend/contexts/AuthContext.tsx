import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../app/api';

interface User {
  id: string;
  email: string;
  nowId: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, nowId: string, name: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // APIクライアントに認証ヘッダーを設定
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // アプリ起動時にトークンを復元
  useEffect(() => {
    const restoreToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('authToken');
        if (storedToken) {
          setToken(storedToken);
          // トークンが有効かチェック
          const response = await api.get('/api/auth/me');
          setUser(response.data.user);
        }
      } catch (error) {
        console.error('Token restoration failed:', error);
        await AsyncStorage.removeItem('authToken');
      } finally {
        setIsLoading(false);
      }
    };

    restoreToken();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { user: userData, token: authToken } = response.data;
      
      setUser(userData);
      setToken(authToken);
      await AsyncStorage.setItem('authToken', authToken);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || 'ログインに失敗しました');
    }
  };

  const register = async (email: string, nowId: string, name: string, password: string) => {
    try {
      const response = await api.post('/api/auth/register', { 
        email, 
        nowId, 
        name, 
        password 
      });
      const { user: userData, token: authToken } = response.data;
      
      setUser(userData);
      setToken(authToken);
      await AsyncStorage.setItem('authToken', authToken);
    } catch (error: any) {
      throw new Error(error.response?.data?.error || '登録に失敗しました');
    }
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem('authToken');
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
    }
  };

  const value: AuthContextType = {
    user,
    token,
    isLoading,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 