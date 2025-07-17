import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polygon } from 'react-native-maps';
import { UserPlus, Check, X, Plus } from 'lucide-react-native';

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

const mockFriends: Friend[] = [
  { id: '1', name: '田中さん', nowId: 'tanaka123', isOnline: true },
  { id: '2', name: '佐藤さん', nowId: 'sato456', isOnline: false },
  { id: '3', name: '山田さん', nowId: 'yamada789', isOnline: true },
];

const mockFriendRequests: FriendRequest[] = [
  { id: '1', name: '鈴木さん', nowId: 'suzuki999' },
];

const mockAreaRequests: AreaRequest[] = [
  {
    id: '1',
    friendName: '田中さん',
    areaName: '渋谷エリア',
    coordinates: [
      { latitude: 35.6580, longitude: 139.6980 },
      { latitude: 35.6580, longitude: 139.7080 },
      { latitude: 35.6680, longitude: 139.7080 },
      { latitude: 35.6680, longitude: 139.6980 },
    ],
  },
];

const mockMyAreas: Area[] = [
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
  {
    id: '2',
    name: '新宿エリア',
    coordinates: [
      { latitude: 35.6900, longitude: 139.6900 },
      { latitude: 35.6900, longitude: 139.7000 },
      { latitude: 35.7000, longitude: 139.7000 },
      { latitude: 35.7000, longitude: 139.6900 },
    ],
  },
];

export default function FriendsScreen() {
  const [nowId, setNowId] = useState('');
  const [friendRequests, setFriendRequests] = useState(mockFriendRequests);
  const [areaRequests, setAreaRequests] = useState(mockAreaRequests);
  const [friends, setFriends] = useState(mockFriends);
  const [showAreaMap, setShowAreaMap] = useState<AreaRequest | null>(null);
  const [showAreaSelector, setShowAreaSelector] = useState<Friend | null>(null);
  const [showAreaMembers, setShowAreaMembers] = useState<Area | null>(null);

  const sendFriendRequest = () => {
    if (nowId.trim()) {
      console.log('Friend request sent to:', nowId);
      setNowId('');
    }
  };

  const handleFriendRequest = (requestId: string, accept: boolean) => {
    setFriendRequests(prev => prev.filter(req => req.id !== requestId));
    if (accept) {
      console.log('Friend request accepted');
    }
  };

  const handleAreaRequest = (requestId: string, accept: boolean) => {
    setAreaRequests(prev => prev.filter(req => req.id !== requestId));
    console.log(`Area request ${accept ? 'accepted' : 'rejected'}`);
  };

  const sendAreaRequest = (friend: Friend, area: Area) => {
    console.log(`Area request sent to ${friend.name} for ${area.name}`);
    setShowAreaSelector(null);
  };

  const addFriendToArea = (friend: Friend, area: Area) => {
    console.log(`${friend.name} を ${area.name} に追加しました`);
    // 実際のAPIではここでPOST /api/areas/:id/members を呼び出す
    setShowAreaSelector(null);
  };

  const removeFriendFromArea = (friendId: string, areaId: string) => {
    console.log(`友達をエリアから削除しました`);
    // 実際のAPIではここでDELETE /api/areas/:id/members/:userId を呼び出す
  };

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
              <MapView
                style={styles.modalMap}
                initialRegion={{
                  latitude: showAreaMap.coordinates[0].latitude,
                  longitude: showAreaMap.coordinates[0].longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Polygon
                  coordinates={showAreaMap.coordinates}
                  fillColor="rgba(0, 0, 0, 0.1)"
                  strokeColor="#000"
                  strokeWidth={2}
                />
              </MapView>
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
              data={mockMyAreas}
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
});