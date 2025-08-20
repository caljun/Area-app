import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import Mapbox from '@rnmapbox/maps';
import { ChevronDown, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useLocationTracking } from '../../hooks/useLocationTracking';
import { handleApiError } from '../../utils/apiHelpers';
import api from '../api';

interface Friend {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  profileImage?: string;
}

interface Area {
  id: string;
  name: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
}

// エリアごとの友達データ（実際のAPIでは動的に取得）
const mockAreaFriends: { [areaId: string]: Friend[] } = {};

const mockAreas: Area[] = [];

export default function HomeScreen() {
  const { user } = useAuth();
  const { location, isTracking, error: locationError } = useLocationTracking();
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [showAreaSelector, setShowAreaSelector] = useState(false);
  const [areaFriends, setAreaFriends] = useState<Friend[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  // エリア一覧を取得
  useEffect(() => {
    const fetchAreas = async () => {
      try {
        const response = await api.get('/areas');
        const fetchedAreas = response.data.areas.map((area: any) => ({
          id: area.id,
          name: area.name,
          coordinates: area.coordinates
        }));
        setAreas(fetchedAreas);
        if (fetchedAreas.length > 0) {
          setSelectedArea(fetchedAreas[0]);
        }
      } catch (error) {
        console.error('Failed to fetch areas:', error);
        // エラーハンドリングを改善
        const fallbackAreas = handleApiError(error, mockAreas);
        setAreas(fallbackAreas);
        setSelectedArea(fallbackAreas[0] || null);
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchAreas();
    }
  }, [user]);

  // エリアが変更されたときに友達リストを更新
  useEffect(() => {
    const fetchAreaFriends = async () => {
      if (!selectedArea) return;
      
      setIsLoadingFriends(true);
      try {
        const response = await api.get(`/locations/area/${selectedArea.id}/friends`);
        const friends = response.data.friends.map((friend: any) => ({
          id: friend.id,
          name: friend.name,
          latitude: friend.location?.latitude || 0,
          longitude: friend.location?.longitude || 0,
          profileImage: friend.profileImage
        }));
        setAreaFriends(friends);
      } catch (error) {
        console.error('Failed to fetch area friends:', error);
        // エラーハンドリングを改善
        const fallbackFriends = handleApiError(error, mockAreaFriends[selectedArea.id] || []);
        setAreaFriends(fallbackFriends);
      } finally {
        setIsLoadingFriends(false);
      }
    };

    fetchAreaFriends();
  }, [selectedArea]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000" />
        <Text style={styles.loadingText}>エリアを読み込み中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Mapbox.MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Street}
        centerCoordinate={[139.6503, 35.6762] as any}
        zoomLevel={10}
        {...({} as any)}
      >
        {selectedArea && (
          <Mapbox.ShapeSource
            id="areaPolygonSource"
            shape={{
              type: 'Feature',
              geometry: {
                type: 'Polygon',
                coordinates: [selectedArea.coordinates.map(point => [point.longitude, point.latitude])]
              },
              properties: {}
            }}
          >
            <Mapbox.FillLayer
              id="areaPolygonFill"
              style={{
                fillColor: 'rgba(0, 0, 0, 0.1)',
                fillOutlineColor: '#000'
              }}
            />
          </Mapbox.ShapeSource>
        )}

        {areaFriends.map((friend) => (
          <Mapbox.PointAnnotation
            key={friend.id}
            id={`friend-${friend.id}`}
            coordinate={[friend.longitude, friend.latitude]}
            title={friend.name}
          >
            <View style={styles.markerContainer}>
              <View style={styles.markerPin}>
                <Text style={styles.markerText}>{friend.name[0]}</Text>
              </View>
              <View style={styles.markerLabel}>
                <Text style={styles.markerLabelText}>{friend.name}</Text>
              </View>
            </View>
          </Mapbox.PointAnnotation>
        ))}
      </Mapbox.MapView>

      {/* ▼ オーバーレイ（タイトル＋エリア選択） */}
      <View style={styles.overlay}>
        <Text style={styles.title}>ホーム</Text>

        <TouchableOpacity
          style={styles.areaSelector}
          onPress={() => setShowAreaSelector(true)}
        >
          <Text style={styles.areaSelectorText}>
            {selectedArea ? selectedArea.name : 'エリアを選択'}
          </Text>
          <ChevronDown size={20} color="#000" />
        </TouchableOpacity>
        
        {selectedArea && (
          <View style={styles.areaInfo}>
            <Text style={styles.areaInfoText}>
              {areaFriends.length}人の友達がこのエリアにいます
            </Text>
          </View>
        )}
      </View>

      {/* ▼ エリア選択モーダル */}
      <Modal
        visible={showAreaSelector}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAreaSelector(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>エリアを選択</Text>
              <TouchableOpacity
                onPress={() => setShowAreaSelector(false)}
                style={styles.closeButton}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.areaList}>
              {areas.map((area) => (
                <TouchableOpacity
                  key={area.id}
                  style={[
                    styles.areaItem,
                    selectedArea?.id === area.id && styles.selectedAreaItem,
                  ]}
                  onPress={() => {
                    setSelectedArea(area);
                    setShowAreaSelector(false);
                  }}>
                  <Text
                    style={[
                      styles.areaItemText,
                      selectedArea?.id === area.id && styles.selectedAreaItemText,
                    ]}>
                    {area.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowAreaSelector(false)}>
              <Text style={styles.closeModalButtonText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  map: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  areaSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  areaSelectorText: {
    fontSize: 16,
    color: '#000',
    marginRight: 5,
  },
  markerContainer: {
    alignItems: 'center',
  },
  markerPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  markerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  markerLabel: {
    backgroundColor: '#000',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 5,
  },
  markerLabelText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    minWidth: 280,
    maxHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    padding: 5,
  },
  areaList: {
    maxHeight: 300,
  },
  areaItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: '#f5f5f5',
  },
  selectedAreaItem: {
    backgroundColor: '#000',
  },
  areaItemText: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
  },
  selectedAreaItemText: {
    color: '#fff',
  },
  closeModalButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 10,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  closeModalButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  areaInfo: {
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  areaInfoText: {
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
  },
});
