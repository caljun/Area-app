import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../../contexts/AuthContext';
import { useRegistration } from '../../contexts/RegistrationContext';
import ProgressBar from '../../components/ProgressBar';

export default function AvatarScreen() {
  const router = useRouter();
  const { updateUser, token } = useAuth();
  const { updateRegistrationData } = useRegistration();
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  // パラメータ取得（正規の方法）
  const { returnTo } = useLocalSearchParams();
  const backPath = typeof returnTo === 'string' ? returnTo : '/profile';

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      setImage(result.assets[0].uri);
      await uploadToCloudinary(result.assets[0].uri);
    }
  };

  const handleNext = () => {
    if (uploadedUrl) {
      updateRegistrationData({ profileImage: uploadedUrl });
      router.push('/start/location');
    } else {
      Alert.alert('エラー', 'プロフィール画像を選択してください');
    }
  };

  const uploadToCloudinary = async (uri: string) => {
    if (!token) {
      Alert.alert('エラー', '認証トークンが見つかりません。ログインし直してください。');
      return;
    }
    
    setUploading(true);

    const mimeType = 'image/jpeg';
    const fileExtension = 'jpg';

    const formData = new FormData();
    formData.append('image', {
      uri,
      name: `profile.${fileExtension}`,
      type: mimeType as string,
    } as any);
    formData.append('type', 'PROFILE');

    try {
      // 認証ヘッダーを明示的に設定
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'multipart/form-data',
      };
      
      const res = await api.post('/images/upload', formData, { headers });
      setUploadedUrl(res.data.image.url);
      
      // 登録フローの場合はRegistrationContextに保存、プロフィール編集の場合はAuthContextを更新
      if (backPath === '/profile') {
        updateUser({ profileImage: res.data.image.url });
        await api.put('/users/profile', { profileImage: res.data.image.url });
        router.replace(backPath);
      } else {
        // 登録フローの場合は次の画面に進む
        updateRegistrationData({ profileImage: res.data.image.url });
      }
    } catch (e: any) {
      console.error('Upload failed:', e);
      console.error('Response data:', e?.response?.data);
      console.error('Response status:', e?.response?.status);
      console.error('Network error:', e?.message);
      
      let errorMessage = '画像アップロードに失敗しました。\n';
      
      if (e?.response?.status === 401) {
        errorMessage += '認証エラー\nログインし直してください。';
      } else if (e?.response?.status === 0 || e?.message?.includes('Network Error')) {
        errorMessage += 'Network Error\nサーバーに接続できません。\nインターネット接続を確認してください。';
      } else if (e?.response?.data?.error) {
        errorMessage += e.response.data.error;
      } else if (e?.message) {
        errorMessage += e.message;
      } else {
        errorMessage += '原因不明のエラー';
      }
      
      Alert.alert('アップロードエラー', errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProgressBar 
        currentStep={5} 
        totalSteps={6} 
        stepNames={['ユーザー名', 'Now ID', 'メールアドレス', 'パスワード', 'プロフィール画像', '位置情報']}
      />
      
      <View style={styles.content}>
        <Text style={styles.title}>プロフィール画像を選択</Text>
        <Text style={styles.subtitle}>友達に表示される画像を選択してください</Text>
        
        <TouchableOpacity style={styles.avatarWrapper} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.avatar} />
          ) : (
            <Text style={styles.avatarPlaceholder}>＋</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, !uploadedUrl && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!uploadedUrl || uploading}
        >
          <Text style={styles.buttonText}>{uploading ? 'アップロード中...' : '次へ'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>戻る</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#000', marginBottom: 16 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32, textAlign: 'center' },
  avatarWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#eee',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    overflow: 'hidden',
  },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarPlaceholder: { fontSize: 48, color: '#aaa' },
  button: {
    backgroundColor: '#000',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginBottom: 16,
  },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  backButton: { marginTop: 8 },
  backButtonText: { color: '#000', fontSize: 16 },
});
