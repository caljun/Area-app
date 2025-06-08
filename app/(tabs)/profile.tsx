import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreditCard as Edit2, MapPin, Users, Eye, X, Camera } from 'lucide-react-native';

interface Area {
  id: string;
  name: string;
  friendCount: number;
  onlineCount: number;
  imageUrl: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
}

const mockAreas: Area[] = [
  {
    id: '1',
    name: '渋谷エリア',
    friendCount: 5,
    onlineCount: 3,
    imageUrl: 'https://images.pexels.com/photos/2662116/pexels-photo-2662116.jpeg?auto=compress&cs=tinysrgb&w=400',
    coordinates: [
      { latitude: 35.6580, longitude: 139.6980 },
      { latitude: 35.6580, longitude: 139.7080 },
      { latitude: 35.6680, longitude: 139.7080 },
      { latitude: 35.6680, longitude: 139.6980 },
    ],
  },
  {
    id: '2',
    name: '新宿エリア',
    friendCount: 8,
    onlineCount: 2,
    imageUrl: 'https://images.pexels.com/photos/2339009/pexels-photo-2339009.jpeg?auto=compress&cs=tinysrgb&w=400',
    coordinates: [
      { latitude: 35.6900, longitude: 139.6900 },
      { latitude: 35.6900, longitude: 139.7000 },
      { latitude: 35.7000, longitude: 139.7000 },
      { latitude: 35.7000, longitude: 139.6900 },
    ],
  },
  {
    id: '3',
    name: '池袋エリア',
    friendCount: 3,
    onlineCount: 1,
    imageUrl: 'https://images.pexels.com/photos/1525041/pexels-photo-1525041.jpeg?auto=compress&cs=tinysrgb&w=400',
    coordinates: [
      { latitude: 35.7295, longitude: 139.7109 },
      { latitude: 35.7295, longitude: 139.7209 },
      { latitude: 35.7395, longitude: 139.7209 },
      { latitude: 35.7395, longitude: 139.7109 },
    ],
  },
  {
    id: '4',
    name: '原宿エリア',
    friendCount: 6,
    onlineCount: 4,
    imageUrl: 'https://images.pexels.com/photos/2339009/pexels-photo-2339009.jpeg?auto=compress&cs=tinysrgb&w=400',
    coordinates: [
      { latitude: 35.6702, longitude: 139.7026 },
      { latitude: 35.6702, longitude: 139.7126 },
      { latitude: 35.6802, longitude: 139.7126 },
      { latitude: 35.6802, longitude: 139.7026 },
    ],
  },
];

interface UserProfile {
  name: string;
  profileImage: string;
  friendCount: number;
}

const initialProfile: UserProfile = {
  name: 'あなたの名前',
  profileImage: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=400',
  friendCount: 12,
};

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(profile.name);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);

  const saveName = () => {
    if (tempName.trim()) {
      setProfile({ ...profile, name: tempName.trim() });
      setIsEditingName(false);
    }
  };

  const cancelEdit = () => {
    setTempName(profile.name);
    setIsEditingName(false);
  };

  const changeProfileImage = () => {
    // In a real app, this would open image picker
    console.log('Change profile image');
  };

  const renderAreaCard = ({ item }: { item: Area }) => (
    <TouchableOpacity
      style={styles.areaCard}
      onPress={() => setSelectedArea(item)}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.areaImage} />
      <View style={styles.areaInfo}>
        <View style={styles.areaHeader}>
          <Text style={styles.areaName}>{item.name}</Text>
          <TouchableOpacity style={styles.viewButton}>
            <Eye size={16} color="#666" />
          </TouchableOpacity>
        </View>
        <View style={styles.areaStats}>
          <View style={styles.statItem}>
            <Users size={14} color="#666" />
            <Text style={styles.statText}>{item.friendCount}人</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.onlineIndicator, item.onlineCount > 0 && styles.onlineActive]} />
            <Text style={styles.statText}>{item.onlineCount}人オンライン</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>プロフ</Text>
      </View>

      <View style={styles.profileSection}>
        <View style={styles.profileImageContainer}>
          <Image source={{ uri: profile.profileImage }} style={styles.profileImage} />
          <TouchableOpacity style={styles.editImageButton} onPress={changeProfileImage}>
            <Camera size={16} color="#666" />
          </TouchableOpacity>
        </View>

        <View style={styles.profileInfo}>
          {isEditingName ? (
            <View style={styles.nameEditContainer}>
              <TextInput
                style={styles.nameInput}
                value={tempName}
                onChangeText={setTempName}
                autoFocus
                selectTextOnFocus
                placeholder="名前を入力"
                placeholderTextColor="#999"
              />
              <View style={styles.nameEditButtons}>
                <TouchableOpacity
                  style={[styles.nameEditButton, styles.saveButton]}
                  onPress={saveName}
                >
                  <Text style={styles.saveButtonText}>保存</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nameEditButton, styles.cancelButton]}
                  onPress={cancelEdit}
                >
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.nameContainer}>
              <Text style={styles.profileName}>{profile.name}</Text>
              <TouchableOpacity
                style={styles.editNameButton}
                onPress={() => setIsEditingName(true)}
              >
                <Edit2 size={16} color="#666" />
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.friendCountContainer}>
            <Users size={16} color="#666" />
            <Text style={styles.friendCountText}>友達 {profile.friendCount}人</Text>
          </View>
        </View>
      </View>

      <View style={styles.areasSection}>
        <View style={styles.areasSectionHeader}>
          <Text style={styles.sectionTitle}>作成したエリア</Text>
          <View style={styles.areaCount}>
            <MapPin size={16} color="#666" />
            <Text style={styles.areaCountText}>{mockAreas.length}エリア</Text>
          </View>
        </View>

        <FlatList
          data={mockAreas}
          keyExtractor={(item) => item.id}
          renderItem={renderAreaCard}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.areasList}
          numColumns={1}
        />
      </View>

      {/* Area Detail Modal */}
      <Modal
        visible={!!selectedArea}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedArea(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.areaDetailContent}>
            <View style={styles.areaDetailHeader}>
              <Text style={styles.areaDetailTitle}>{selectedArea?.name}</Text>
              <TouchableOpacity onPress={() => setSelectedArea(null)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            {selectedArea && (
              <>
                <Image source={{ uri: selectedArea.imageUrl }} style={styles.areaDetailImage} />
                <View style={styles.areaDetailInfo}>
                  <View style={styles.areaDetailStats}>
                    <View style={styles.areaDetailStat}>
                      <Users size={20} color="#666" />
                      <Text style={styles.areaDetailStatText}>
                        {selectedArea.friendCount}人の友達
                      </Text>
                    </View>
                    <View style={styles.areaDetailStat}>
                      <View style={[styles.onlineIndicator, selectedArea.onlineCount > 0 && styles.onlineActive]} />
                      <Text style={styles.areaDetailStatText}>
                        {selectedArea.onlineCount}人オンライン
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.areaDescription}>
                    このエリアには{selectedArea.friendCount}人の友達が追加されており、
                    現在{selectedArea.onlineCount}人がオンラインです。
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
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
  profileSection: {
    flexDirection: 'row',
    padding: 20,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  profileImageContainer: {
    position: 'relative',
    marginRight: 20,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f5f5f5',
  },
  editImageButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  profileInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    marginRight: 10,
  },
  editNameButton: {
    padding: 5,
  },
  nameEditContainer: {
    marginBottom: 10,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    marginBottom: 10,
  },
  nameEditButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  nameEditButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#000',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  cancelButtonText: {
    color: '#000',
    fontWeight: '600',
  },
  friendCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  friendCountText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  areasSection: {
    flex: 1,
    padding: 20,
  },
  areasSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  areaCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  areaCountText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  areasList: {
    paddingBottom: 20,
  },
  areaCard: {
    flexDirection: 'row',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
  },
  areaImage: {
    width: 80,
    height: 80,
    backgroundColor: '#f5f5f5',
  },
  areaInfo: {
    flex: 1,
    padding: 15,
    justifyContent: 'space-between',
  },
  areaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  areaName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  viewButton: {
    padding: 2,
  },
  areaStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ccc',
  },
  onlineActive: {
    backgroundColor: '#28a745',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  areaDetailContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    width: '90%',
    maxHeight: '80%',
    overflow: 'hidden',
  },
  areaDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  areaDetailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  areaDetailImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f5f5f5',
  },
  areaDetailInfo: {
    padding: 20,
  },
  areaDetailStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
  },
  areaDetailStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  areaDetailStatText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  areaDescription: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    textAlign: 'center',
  },
});