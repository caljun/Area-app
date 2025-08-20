import { useState, useEffect, useRef } from 'react';
import * as Location from 'expo-location';
import { updateLocation } from '../utils/apiHelpers';
import api from '../app/api';

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: Date;
}

export const useLocationTracking = (isEnabled: boolean = true) => {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const updateInterval = useRef<NodeJS.Timeout | null>(null);

  // 位置情報の権限を要求
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('位置情報の権限が拒否されました');
        return false;
      }
      return true;
    } catch (err) {
      setError('位置情報の権限取得に失敗しました');
      return false;
    }
  };

  // 現在位置を取得
  const getCurrentLocation = async () => {
    try {
      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000,
        distanceInterval: 10,
      });

      const locationData: LocationData = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        timestamp: new Date(currentLocation.timestamp),
      };

      setLocation(locationData);
      return locationData;
    } catch (err) {
      console.error('Failed to get current location:', err);
      setError('現在位置の取得に失敗しました');
      return null;
    }
  };

  // 位置情報の追跡を開始
  const startLocationTracking = async () => {
    if (!isEnabled) return;

    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    try {
      setIsTracking(true);
      setError(null);

      // 初回の位置情報を取得
      const initialLocation = await getCurrentLocation();
      if (initialLocation) {
        await updateLocation(initialLocation.latitude, initialLocation.longitude, api);
      }

      // 位置情報の変更を監視
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 30000, // 30秒ごと
          distanceInterval: 10, // 10メートル移動したら更新
        },
        async (newLocation) => {
          const locationData: LocationData = {
            latitude: newLocation.coords.latitude,
            longitude: newLocation.coords.longitude,
            timestamp: new Date(newLocation.timestamp),
          };

          setLocation(locationData);
          await updateLocation(locationData.latitude, locationData.longitude, api);
        }
      );

      // 定期的な位置情報更新（バックアップ）
      updateInterval.current = setInterval(async () => {
        const currentLocation = await getCurrentLocation();
        if (currentLocation) {
          await updateLocation(currentLocation.latitude, currentLocation.longitude, api);
        }
      }, 60000); // 1分ごと

    } catch (err) {
      console.error('Failed to start location tracking:', err);
      setError('位置情報の追跡開始に失敗しました');
      setIsTracking(false);
    }
  };

  // 位置情報の追跡を停止
  const stopLocationTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }

    if (updateInterval.current) {
      clearInterval(updateInterval.current);
      updateInterval.current = null;
    }

    setIsTracking(false);
  };

  // コンポーネントのマウント時に追跡を開始
  useEffect(() => {
    if (isEnabled) {
      startLocationTracking();
    }

    // アンマウント時に追跡を停止
    return () => {
      stopLocationTracking();
    };
  }, [isEnabled]);

  return {
    location,
    isTracking,
    error,
    startLocationTracking,
    stopLocationTracking,
    getCurrentLocation,
  };
}; 