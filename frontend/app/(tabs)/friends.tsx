import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Modal, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Mapbox from '@rnmapbox/maps';
import { UserPlus, Check, X, Plus } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import api from '../api';

interface Friend {
  id: string;
  name: string;
  nowId: string;
  isOnline: boolean;
}

interface FriendRequest {
  id: string;
  name: string;
  nowId: string;
}

interface AreaRequest {
  id: string;
  friendName: string;
  areaName: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
}

interface Area {
  id: string;
  name: string;
  coordinates: Array<{ latitude: number; longitude: number }>;
}

const mockFriends: Friend[] = [];

const mockFriendRequests: FriendRequest[] = [];

const mockAreaRequests: AreaRequest[] = [];

const mockMyAreas: Area[] = [];

export default function FriendsScreen() {
  const { user } = useAuth();
  const [nowId, setNowId] = useState('');
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [areaRequests, setAreaRequests] = useState<AreaRequest[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [myAreas, setMyAreas] = useState<Area[]>([]);
  const [showAreaMap, setShowAreaMap] = useState<AreaRequest | null>(null);
  const [showAreaSelector, setShowAreaSelector] = useState<Friend | null>(null);
  const [showAreaMembers, setShowAreaMembers] = useState<Area | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // 友達リストとリクエストを取得
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        // 友達リスト取得
        const friendsResponse = await api.get('/api/friends');
        const fetchedFriends = friendsResponse.data.friends.map((friend: any) => ({
          id: friend.friend.id,
          name: friend.friend.name,
          nowId: friend.friend.nowId,
          isOnline: true // オンライン状態は別途実装
        }));
        setFriends(fetchedFriends);

        // 友達リクエスト取得
        const requestsResponse = await api.get('/api/friends/requests');
        const fetchedRequests = requestsResponse.data.requests.map((req: any) => ({
          id: req.id,
          name: req.sender.name,
          nowId: req.sender.nowId
        }));
        setFriendRequests(fetchedRequests);

        // エリア招待リクエスト取得
        const areaRequestsResponse = await api.get('/api/friends/area-requests');
        const fetchedAreaRequests = areaRequestsResponse.data.requests.map((req: any) => ({
          id: req.id,
          friendName: req.sender.name,
          areaName: req.area.name,
          coordinates: req.area.coordinates
        }));
        setAreaRequests(fetchedAreaRequests);

        // 自分のエリア取得
        const areasResponse = await api.get('/api/areas');
        const fetchedAreas = areasResponse.data.areas.map((area: any) => ({
          id: area.id,
          name: area.name,
          coordinates: area.coordinates
        }));
        setMyAreas(fetchedAreas);

      } catch (error) {
        console.error('Failed to fetch friends data:', error);
        // エラー時はモックデータを使用
        setFriends(mockFriends);
        setFriendRequests(mockFriendRequests);
        setAreaRequests(mockAreaRequests);
        setMyAreas(mockMyAreas);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const sendFriendRequest = async () => {
    if (!nowId.trim()) return;
    
    setIsLoadingRequests(true);
    try {
      // ユーザー検索APIを呼び出してユーザーIDを取得
      const searchResponse = await api.get(`/api/users/search/${nowId}`);
      const targetUserId = searchResponse.data.user.id;
      
      // 友達リクエスト送信
      await api.post('/api/friends/request', { receiverId: targetUserId });
      Alert.alert('成功', '友達リクエストを送信しました');
      setNowId('');
    } catch (error: any) {
      Alert.alert('エラー', error.response?.data?.error || 'リクエストの送信に失敗しました');
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const handleFriendRequest = async (requestId: string, accept: boolean) => {
    setIsLoadingRequests(true);
    try {
      await api.put(`/api/friends/request/${requestId}`, { 
        status: accept ? 'ACCEPTED' : 'REJECTED' 
      });
      setFriendRequests(prev => prev.filter(req => req.id !== requestId));
      if (accept) {
        // 友達リストを再取得
        const friendsResponse = await api.get('/api/friends');
        const fetchedFriends = friendsResponse.data.friends.map((friend: any) => ({
          id: friend.friend.id,
          name: friend.friend.name,
          nowId: friend.friend.nowId,
          isOnline: true
        }));
        setFriends(fetchedFriends);
      }
    } catch (error: any) {
      Alert.alert('エラー', error.response?.data?.error || 'リクエストの処理に失敗しました');
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const handleAreaRequest = async (requestId: string, accept: boolean) => {
    setIsLoadingRequests(true);
    try {
      await api.put(`/api/friends/area-request/${requestId}`, { 
        status: accept ? 'ACCEPTED' : 'REJECTED' 
      });
      setAreaRequests(prev => prev.filter(req => req.id !== requestId));
    } catch (error: any) {
      Alert.alert('エラー', error.response?.data?.error || 'リクエストの処理に失敗しました');
    } finally {
      setIsLoadingRequests(false);
    }
  };

  const sendAreaRequest = async (friend: Friend, area: Area) => {
    try {
      await api.post('/api/friends/area-request', {
        receiverId: friend.id,
        areaId: area.id
      });
      Alert.alert('成功', `${friend.name}にエリア招待を送信しました`);
      setShowAreaSelector(null);
    } catch (error: any) {
      Alert.alert('エラー', error.response?.data?.error || 'エリア招待の送信に失敗しました');
    }
  };

  const addFriendToArea = async (friend: Friend, area: Area) => {
    try {
      await api.post(`/api/areas/${area.id}/members`, {
        userId: friend.id
      });
      Alert.alert('成功', `${friend.name}を${area.name}に追加しました`);
      setShowAreaSelector(null);
    } catch (error: any) {
      Alert.alert('エラー', error.response?.data?.error || 'エリアへの追加に失敗しました');
    }
  };

  const removeFriendFromArea = async (friendId: string, areaId: string) => {
    try {
      await api.delete(`/api/areas/${areaId}/members/${friendId}`);
      Alert.alert('成功', '友達をエリアから削除しました');
    } catch (error: any) {
      Alert.alert('エラー', error.response?.data?.error || 'エリアからの削除に失敗しました');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>友達情報を読み込み中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const renderFriendRequest = ({ item }: { item: FriendRequest }) => (
    <View style={styles.requestItem}>
      <View style={styles.requestInfo}>
        <Text style={styles.requestName}>{item.name}</Text>
        <Text style={styles.requestId}>ID: {item.nowId}</Text>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => handleFriendRequest(item.id, true)}
        >
          <Check size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleFriendRequest(item.id, false)}
        >
          <X size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAreaRequest = ({ item }: { item: AreaRequest }) => (
    <View style={styles.requestItem}>
      <View style={styles.requestInfo}>
        <Text style={styles.requestName}>{item.friendName}</Text>
        <Text style={styles.requestId}>エリア: {item.areaName}</Text>
        <TouchableOpacity
          style={styles.viewMapButton}
          onPress={() => setShowAreaMap(item)}
        >
          <Text style={styles.viewMapText}>範囲を確認</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.acceptButton]}
          onPress={() => handleAreaRequest(item.id, true)}
        >
          <Check size={16} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleAreaRequest(item.id, false)}
        >
          <X size={16} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFriend = ({ item }: { item: Friend }) => (
    <View style={styles.friendItem}>
      <View style={styles.friendInfo}>
        <View style={styles.friendHeader}>
          <Text style={styles.friendName}>{item.name}</Text>
          <View style={[styles.onlineStatus, item.isOnline && styles.onlineActive]} />
        </View>
        <Text style={styles.friendId}>ID: {item.nowId}</Text>
      </View>
      <TouchableOpacity
        style={styles.addAreaButton}
        onPress={() => setShowAreaSelector(item)}
      >
        <Plus size={16} color="#000" />
        <Text style={styles.addAreaText}>エリア追加</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAreaMember = ({ item }: { item: Friend }) => (
    <View style={styles.friendItem}>
      <View style={styles.friendInfo}>
        <View style={styles.friendHeader}>
          <Text style={styles.friendName}>{item.name}</Text>
          <View style={[styles.onlineStatus, item.isOnline && styles.onlineActive]} />
        </View>
        <Text style={styles.friendId}>ID: {item.nowId}</Text>
      </View>
      <TouchableOpacity
        style={[styles.addAreaButton, styles.removeButton]}
        onPress={() => showAreaMembers && removeFriendFromArea(item.id, showAreaMembers.id)}
      >
        <Text style={styles.removeButtonText}>削除</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>友達</Text>
        </View>

        <View style={styles.addFriendSection}>
          <Text style={styles.sectionTitle}>友達追加</Text>
          <View style={styles.addFriendInput}>
            <TextInput
              style={styles.input}
              placeholder="Now IDを入力"
              placeholderTextColor="#999"
              value={nowId}
              onChangeText={setNowId}
            />
            <TouchableOpacity
              style={[styles.sendButton, nowId.trim() && styles.sendButtonActive]}
              onPress={sendFriendRequest}
              disabled={!nowId.trim()}
            >
              <UserPlus size={20} color={nowId.trim() ? '#fff' : '#999'} />
            </TouchableOpacity>
          </View>
          <View style={{ marginTop: 10 }}>
            <Text style={{ color: '#666', fontSize: 13 }}>あなたのID</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#333', marginRight: 10 }}>my_now_id_123</Text>
              <TouchableOpacity style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#eee', borderRadius: 6 }}>
                <Text style={{ fontSize: 13, color: '#666' }}>コピー</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {friendRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>友達リクエスト</Text>
            <FlatList
              data={friendRequests}
              keyExtractor={(item) => item.id}
              renderItem={renderFriendRequest}
              scrollEnabled={false}
            />
          </View>
        )}

        {areaRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>エリア追加リクエスト</Text>
            <FlatList
              data={areaRequests}
              keyExtractor={(item) => item.id}
              renderItem={renderAreaRequest}
              scrollEnabled={false}
            />
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>友達一覧</Text>
          <FlatList
            data={friends}
            keyExtractor={(item) => item.id}
            renderItem={renderFriend}
            scrollEnabled={false}
          />
        </View>
      </ScrollView>

      {/* Area Map Modal */}
      <Modal
        visible={!!showAreaMap}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAreaMap(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.mapModalContent}>
            <View style={styles.mapModalHeader}>
              <Text style={styles.mapModalTitle}>
                {showAreaMap?.areaName} の範囲
              </Text>
              <TouchableOpacity onPress={() => setShowAreaMap(null)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>
            {showAreaMap && (
              <Mapbox.MapView
                style={styles.modalMap}
                styleURL={Mapbox.StyleURL.Street}
                centerCoordinate={[showAreaMap.coordinates[0].longitude, showAreaMap.coordinates[0].latitude] as any}
                zoomLevel={12}
              >
                <Mapbox.ShapeSource
                  id="areaPolygonSource"
                  shape={{
                    type: 'Feature',
                    geometry: {
                      type: 'Polygon',
                      coordinates: [showAreaMap.coordinates.map(point => [point.longitude, point.latitude])]
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
              </Mapbox.MapView>
            )}
          </View>
        </View>
      </Modal>

      {/* Area Selector Modal */}
      <Modal
        visible={!!showAreaSelector}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAreaSelector(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.areaSelectorContent}>
            <View style={styles.areaSelectorHeader}>
              <Text style={styles.areaSelectorTitle}>
                {showAreaSelector?.name} をエリアに追加
              </Text>
              <TouchableOpacity onPress={() => setShowAreaSelector(null)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={myAreas}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.areaOption}
                  onPress={() => showAreaSelector && addFriendToArea(showAreaSelector, item)}
                >
                  <Text style={styles.areaOptionText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
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
          <View style={styles.areaSelectorContent}>
            <View style={styles.areaSelectorHeader}>
              <Text style={styles.areaSelectorTitle}>
                {showAreaMembers?.name} のメンバー
              </Text>
              <TouchableOpacity onPress={() => setShowAreaMembers(null)}>
                <X size={24} color="#000" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={friends.filter(friend => friend.id === '1' || friend.id === '2')}
              keyExtractor={(item) => item.id}
              renderItem={renderAreaMember}
            />
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
  addFriendSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 15,
  },
  addFriendInput: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  sendButton: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: '#000',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  list: {
    // maxHeight: 200, を削除
  },
  requestItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    marginBottom: 10,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  requestId: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  viewMapButton: {
    marginTop: 5,
  },
  viewMapText: {
    fontSize: 14,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#28a745',
  },
  rejectButton: {
    backgroundColor: '#dc3545',
  },
  friendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    marginBottom: 10,
  },
  friendInfo: {
    flex: 1,
  },
  friendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  onlineStatus: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ccc',
  },
  onlineActive: {
    backgroundColor: '#28a745',
  },
  friendId: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  addAreaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  addAreaText: {
    fontSize: 12,
    color: '#000',
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#dc3545',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapModalContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    width: '90%',
    height: '70%',
    overflow: 'hidden',
  },
  mapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  mapModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  modalMap: {
    flex: 1,
  },
  areaSelectorContent: {
    backgroundColor: '#fff',
    borderRadius: 15,
    width: '80%',
    maxHeight: '60%',
    overflow: 'hidden',
  },
  areaSelectorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  areaSelectorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    flex: 1,
  },
  areaOption: {
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  areaOptionText: {
    fontSize: 16,
    color: '#000',
    textAlign: 'center',
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
  sendButtonDisabled: {
    backgroundColor: '#999',
  },
});