import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';

interface LocationUpdate {
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
}

interface FriendStatus {
  userId: string;
  isOnline: boolean;
  lastSeen: Date;
}

export const useWebSocket = () => {
  const { user, token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [locationUpdates, setLocationUpdates] = useState<LocationUpdate[]>([]);
  const [friendStatuses, setFriendStatuses] = useState<FriendStatus[]>([]);

  // WebSocket接続を確立
  const connectWebSocket = () => {
    if (!user || !token) return;

    try {
      // バックエンドのWebSocketサーバーに接続
      socketRef.current = io(process.env.EXPO_PUBLIC_WS_URL || 'http://localhost:3000', {
        auth: {
          token: token
        },
        transports: ['websocket', 'polling']
      });

      // 接続イベント
      socketRef.current.on('connect', () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        
        // ユーザーIDでルームに参加
        socketRef.current?.emit('join', user.id);
      });

      // 切断イベント
      socketRef.current.on('disconnect', () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
      });

      // 位置情報更新イベント
      socketRef.current.on('locationUpdate', (data: LocationUpdate) => {
        setLocationUpdates(prev => [...prev, data]);
      });

      // 友達のオンライン状態更新
      socketRef.current.on('friendStatusUpdate', (data: FriendStatus) => {
        setFriendStatuses(prev => {
          const existing = prev.find(status => status.userId === data.userId);
          if (existing) {
            return prev.map(status => 
              status.userId === data.userId ? data : status
            );
          }
          return [...prev, data];
        });
      });

      // エラーハンドリング
      socketRef.current.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        setIsConnected(false);
      });

    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setIsConnected(false);
    }
  };

  // 位置情報を送信
  const sendLocationUpdate = (latitude: number, longitude: number) => {
    if (socketRef.current && isConnected && user) {
      const locationData: LocationUpdate = {
        userId: user.id,
        latitude,
        longitude,
        timestamp: new Date()
      };
      
      socketRef.current.emit('updateLocation', locationData);
    }
  };

  // オンライン状態を送信
  const sendOnlineStatus = (isOnline: boolean) => {
    if (socketRef.current && isConnected && user) {
      socketRef.current.emit('updateStatus', {
        userId: user.id,
        isOnline,
        lastSeen: new Date()
      });
    }
  };

  // WebSocket接続を切断
  const disconnectWebSocket = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
  };

  // コンポーネントのマウント時に接続
  useEffect(() => {
    if (user && token) {
      connectWebSocket();
    }

    // アンマウント時に切断
    return () => {
      disconnectWebSocket();
    };
  }, [user, token]);

  // アプリの状態変更時にオンライン状態を更新
  useEffect(() => {
    if (isConnected) {
      sendOnlineStatus(true);
    }
  }, [isConnected]);

  return {
    isConnected,
    locationUpdates,
    friendStatuses,
    sendLocationUpdate,
    sendOnlineStatus,
    connectWebSocket,
    disconnectWebSocket
  };
}; 