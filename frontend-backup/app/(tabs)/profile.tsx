import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput, Modal, Image, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CreditCard as Edit2, MapPin, Users, Eye, X, Camera } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import { handleApiError } from '../../utils/apiHelpers';
import api from '../api';
import { useRouter } from 'expo-router';

interface Area {
  id: string;
  name: string;
  friendCount: number;
  onlineCount: number;
  imageUrl: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
}

const mockAreas: Area[] = [];

interface UserProfile {
  name: string;
  profileImage: string;
  friendCount: number;
}

const initialProfile: UserProfile = {
  name: '',
  profileImage: '',
  friendCount: 0,
};

export default function ProfileScreen() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile>(initialProfile);
  const [areas, setAreas] = useState<Area[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(profile.name);
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [showAreaMembers, setShowAreaMembers] = useState<Area | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();

  // ユーザー情報とエリア一覧を取得
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        // ユーザー情報を更新
        setProfile({
          name: user.name,
          profileImage: user.profileImage || '', // ← 修正
          friendCount: profile.friendCount,
        });

        // エリア一覧取得
        const areasResponse = await api.get('/areas');
        const fetchedAreas = areasResponse.data.areas.map((area: any) => ({
          id: area.id,
          name: area.name,
          friendCount: 0, // エリアメンバー数は別途取得
          onlineCount: 0, // オンライン数は別途実装
          imageUrl: area.imageUrl || mockAreas[0].imageUrl,
          coordinates: area.coordinates
        }));
        setAreas(fetchedAreas);

        // 友達数取得
        const friendsResponse = await api.get('/friends');
        setProfile(prev => ({
          ...prev,
          friendCount: friendsResponse.data.friends.length
        }));

      } catch (error) {
        console.error('Failed to fetch profile data:', error);
        // エラーハンドリングを改善
        const fallbackAreas = handleApiError(error, mockAreas);
        setAreas(fallbackAreas);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // useEffect: user変更時のsetProfileをprevベースに修正
  useEffect(() => {
    if (user) {
      setProfile((prev) => ({
        ...prev,
        name: user.name,
        profileImage: user.profileImage || '',
      }));
    }
  }, [user]);

  const handleImageUploaded = (url: string) => {
    setProfile((prev) => ({ ...prev, profileImage: url }));
    updateUser({ profileImage: url });
  };

  const saveName = async () => {
    if (!tempName.trim()) return;
    
    setIsSaving(true);
    try {
      // ユーザー名更新APIを呼び出し
      await api.put('/users/profile', { name: tempName.trim() });
      setProfile({ ...profile, name: tempName.trim() });
      updateUser({ name: tempName.trim() });
      setIsEditingName(false);
      Alert.alert('成功', '名前を更新しました');
    } catch (error: any) {
      Alert.alert('エラー', error.response?.data?.error || '名前の更新に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const cancelEdit = () => {
    setTempName(profile.name);
    setIsEditingName(false);
  };

  // changeProfileImage関数を修正
  const changeProfileImage = () => {
    router.push({ pathname: '/start/avatar', params: { returnTo: '/profile' } });
  };

  // onImageUploadedコールバック関連の記述は削除（avatar.tsxでupdateUserを直接呼ぶ設計に統一）

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>プロフィール情報を読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderAreaCard = ({ item }: { item: Area }) => (
    <TouchableOpacity
      style={styles.areaCard}
      onPress={() => setSelectedArea(item)}
    >
      <Image source={{ uri: item.imageUrl }} style={styles.areaImage} />
      <View style={styles.areaInfo}>
        <View style={styles.areaHeader}>
          <Text style={styles.areaName}>{item.name}</Text>
          <View style={styles.areaActions}>
            <TouchableOpacity 
              style={styles.viewButton}
              onPress={() => setShowAreaMembers(item)}
            >
              <Users size={16} color="#666" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.viewButton}>
              <Eye size={16} color="#666" />
            </TouchableOpacity>
          </View>
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
          data={areas}
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

      {/* Area Members Modal */}
      <Modal
        visible={!!showAreaMembers}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAreaMembers(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.areaDetailContent}>
            <View style={styles.areaDetailHeader}>
              <Text style={styles.areaDetailTitle}>
                {showAreaMembers?.name} のメンバー管理
              </Text>
              <TouchableOpacity onPress={() => setShowAreaMembers(null)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.membersList}>
              <Text style={styles.membersTitle}>メンバー一覧</Text>
              <View style={styles.memberItem}>
                <Text style={styles.memberName}>田中さん</Text>
                <TouchableOpacity style={styles.removeMemberButton}>
                  <Text style={styles.removeMemberText}>削除</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.memberItem}>
                <Text style={styles.memberName}>佐藤さん</Text>
                <TouchableOpacity style={styles.removeMemberButton}>
                  <Text style={styles.removeMemberText}>削除</Text>
                </TouchableOpacity>
              </View>
            </View>
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
  areaActions: {
    flexDirection: 'row',
    gap: 10,
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
  membersList: {
    paddingTop: 10,
  },
  membersTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
    paddingHorizontal: 10,
  },
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginBottom: 8,
  },
  memberName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  removeMemberButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#ff6b6b',
    borderRadius: 5,
  },
  removeMemberText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
});