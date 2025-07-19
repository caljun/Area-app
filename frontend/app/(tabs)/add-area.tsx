import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import { Check } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useRouter } from 'expo-router';
import api from '../api';

interface MapPoint {
  latitude: number;
  longitude: number;
}

export default function AddAreaScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [areaName, setAreaName] = useState('');
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const handleMapPress = (event: any) => {
    const { coordinates } = event.geometry;
    const coordinate = {
      latitude: coordinates[1],
      longitude: coordinates[0]
    };
    setPoints([...points, coordinate]);
  };

  const removeLastPoint = () => {
    if (points.length > 0) {
      setPoints(points.slice(0, -1));
    }
  };

  const createArea = async () => {
    if (!areaName.trim()) {
      Alert.alert('エラー', 'エリア名を入力してください');
      return;
    }
    if (points.length < 3) {
      Alert.alert('エラー', '最低3つのポイントが必要です');
      return;
    }

    setIsCreating(true);
    try {
      const response = await api.post('/api/areas', {
        name: areaName.trim(),
        coordinates: points,
        isPublic: false // デフォルトは非公開
      });

      Alert.alert('成功', `「${areaName}」エリアが作成されました`, [
        {
          text: 'OK',
          onPress: () => {
            setAreaName('');
            setPoints([]);
            router.back(); // 前の画面に戻る
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('エラー', error.response?.data?.error || 'エリアの作成に失敗しました');
    } finally {
      setIsCreating(false);
    }
  };

  const canCreateArea = areaName.trim() && points.length >= 3;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>エリア追加</Text>
        </View>

        <View style={styles.guideContainer}>
          <Text style={styles.instructionText}>
            地図をタップしてエリアの境界を設定してください。
          </Text>
          <Text style={styles.instructionText}>
            最低3点でエリアを作成できます。
          </Text>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="エリア名を入力"
            placeholderTextColor="#999"
            value={areaName}
            onChangeText={setAreaName}
          />
        </View>

        <View style={styles.mapContainer}>
          <Mapbox.MapView
            style={styles.map}
            styleURL={Mapbox.StyleURL.Street}
            centerCoordinate={[139.6503, 35.6762] as any}
            zoomLevel={10}
            onTouch={handleMapPress}
          >
            {points.map((point, index) => (
              <Mapbox.PointAnnotation
                key={index.toString()}
                id={`point-${index}`}
                coordinate={[point.longitude, point.latitude]}
              >
                <View style={[
                  styles.pointMarker,
                  index === points.length - 1 && styles.latestPointMarker
                ]}>
                  <Text style={styles.pointNumber}>{index + 1}</Text>
                </View>
              </Mapbox.PointAnnotation>
            ))}
            
            {points.length >= 3 && (
              <Mapbox.ShapeSource
                id="polygonSource"
                shape={{
                  type: 'Feature',
                  geometry: {
                    type: 'Polygon',
                    coordinates: [points.map(point => [point.longitude, point.latitude])]
                  },
                  properties: {}
                }}
              >
                <Mapbox.FillLayer
                  id="polygonFill"
                  style={{
                    fillColor: 'rgba(0, 0, 0, 0.1)',
                    fillOutlineColor: '#000'
                  }}
                />
              </Mapbox.ShapeSource>
            )}
          </Mapbox.MapView>
        </View>

        <View style={styles.controls}>
          <Text style={styles.pointsText}>
            設定済みポイント: {points.length}
          </Text>
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.removeButton]}
              onPress={removeLastPoint}
              disabled={points.length === 0}
            >
              <Text style={[
                styles.buttonText,
                points.length === 0 && styles.disabledButtonText
              ]}>
                最後のポイントを削除
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                styles.createButton,
                canCreateArea && styles.createButtonEnabled,
                isCreating && styles.createButtonDisabled
              ]}
              onPress={createArea}
              disabled={!canCreateArea || isCreating}
            >
              {isCreating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Check size={20} color={canCreateArea ? '#fff' : '#999'} />
              )}
              <Text style={[
                styles.buttonText,
                canCreateArea ? styles.enabledButtonText : styles.disabledButtonText
              ]}>
                {isCreating ? '作成中...' : 'エリア作成'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  guideContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 5,
  },
  instructionText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  mapContainer: {
    height: 400,
    margin: 20,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  map: {
    flex: 1,
  },
  controls: {
    padding: 20,
    backgroundColor: '#f9f9f9',
  },
  pointsText: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
    fontWeight: '600',
    marginBottom: 20,
  },
  buttonContainer: {
    gap: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    gap: 8,
  },
  removeButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  createButton: {
    backgroundColor: '#ccc',
    borderWidth: 1,
    borderColor: '#999',
  },
  createButtonEnabled: {
    backgroundColor: '#000',
    borderColor: '#000',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  enabledButtonText: {
    color: '#fff',
  },
  disabledButtonText: {
    color: '#999',
  },
  pointMarker: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  latestPointMarker: {
    backgroundColor: '#ff0000',
  },
  pointNumber: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  createButtonDisabled: {
    backgroundColor: '#999',
    borderColor: '#999',
  },
});