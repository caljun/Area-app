import { View, Text, TouchableOpacity, Image, StyleSheet, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useState, useEffect } from 'react';
import api from '../api';
import { useAuth } from '../../contexts/AuthContext';
import { useRegistration } from '../../contexts/RegistrationContext';
import { handleApiError } from '../../utils/apiHelpers';
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
      let res;
      
      // 登録フローかプロフィール編集かを判定
      if (backPath === '/profile') {
        // プロフィール編集の場合（認証が必要）
        if (!token) {
          Alert.alert('エラー', '認証トークンが見つかりません。ログインし直してください。');
          return;
        }
        
        const headers = {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        };
        
        res = await api.post('/images/upload', formData, { headers });
        updateUser({ profileImage: res.data.image.url });
        await api.put('/users/profile', { profileImage: res.data.image.url });
        router.replace(backPath);
      } else {
        // 新規登録の場合（認証不要）
        res = await api.post('/images/upload-registration', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        updateRegistrationData({ profileImage: res.data.image.url });
      }
      
      setUploadedUrl(res.data.image.url);
    } catch (e: any) {
      handleApiError(e, null);
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
