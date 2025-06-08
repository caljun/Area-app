import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList, ScrollView } from 'react-native';
import MapView, { Marker, Polygon } from 'react-native-maps';
import { ChevronDown, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

const mockFriends: Friend[] = [
  { id: '1', name: '田中さん', latitude: 35.6762, longitude: 139.6503 },
  { id: '2', name: '佐藤さん', latitude: 35.6800, longitude: 139.6569 },
  { id: '3', name: '山田さん', latitude: 35.6735, longitude: 139.6585 },
];

const mockAreas: Area[] = [
  {
    id: '1',
    name: '渋谷エリア',
    coordinates: [
      { latitude: 35.6580, longitude: 139.6980 },
      { latitude: 35.6580, longitude: 139.7080 },
      { latitude: 35.6680, longitude: 139.7080 },
      { latitude: 35.6680, longitude: 139.6980 },
    ],
  },
];

export default function HomeScreen() {
  const [selectedArea, setSelectedArea] = useState<Area | null>(mockAreas[0]);
  const [showAreaSelector, setShowAreaSelector] = useState(false);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: 35.6762,
          longitude: 139.6503,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      >
        {selectedArea && (
          <Polygon
            coordinates={selectedArea.coordinates}
            fillColor="rgba(0, 0, 0, 0.1)"
            strokeColor="#000"
            strokeWidth={2}
          />
        )}

        {mockFriends.map((friend) => (
          <Marker
            key={friend.id}
            coordinate={{
              latitude: friend.latitude,
              longitude: friend.longitude,
            }}
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
          </Marker>
        ))}
      </MapView>

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
              {mockAreas.map((area) => (
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
});
