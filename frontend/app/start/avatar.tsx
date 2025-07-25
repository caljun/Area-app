import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import api from '../api';
import { useAuth } from '../../contexts/AuthContext';

export default function AvatarScreen() {
  const router = useRouter();
  const { updateUser } = useAuth();
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
      const res = await api.post('/api/images/upload', formData);
      setUploadedUrl(res.data.image.url);
      updateUser({ profileImage: res.data.image.url });
      await api.put('/api/users/profile', { profileImage: res.data.image.url });
      router.replace(backPath);
    } catch (e: any) {
      console.error('Upload failed:', e?.response?.data || e.message || e);
      alert(`画像アップロードに失敗しました。\n${e?.response?.data?.error || e.message || '原因不明のエラー'}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>プロフィール画像を選択</Text>
        <TouchableOpacity style={styles.avatarWrapper} onPress={pickImage}>
          {image ? (
            <Image source={{ uri: image }} style={styles.avatar} />
          ) : (
            <Text style={styles.avatarPlaceholder}>＋</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, !uploadedUrl && styles.buttonDisabled]}
          onPress={() => {
            if (uploadedUrl) router.push('/start/location');
          }}
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
  title: { fontSize: 24, fontWeight: 'bold', color: '#000', marginBottom: 32 },
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
