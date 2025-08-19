import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useRegistration } from '../../contexts/RegistrationContext';
import ProgressBar from '../../components/ProgressBar';

export default function CompleteScreen() {
  const router = useRouter();
  const { register } = useAuth();
  const { registrationData, clearRegistrationData } = useRegistration();
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    // 登録処理を実行
    handleRegistration();
  }, []);

  const handleRegistration = async () => {
    if (!registrationData.username || !registrationData.nowId || !registrationData.email || !registrationData.password) {
      Alert.alert('エラー', '登録情報が不完全です。最初からやり直してください。');
      router.replace('/start/onboarding');
      return;
    }

    setIsRegistering(true);
    try {
      await register(
        registrationData.email,
        registrationData.nowId,
        registrationData.username,
        registrationData.password,
        registrationData.profileImage
      );
      
      // 登録成功後、登録データをクリア
      clearRegistrationData();
      
      Alert.alert('登録完了', 'アカウントの作成が完了しました！');
      router.replace('/(tabs)');
    } catch (error: any) {
      Alert.alert('登録エラー', error.message);
      router.replace('/start/onboarding');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProgressBar 
        currentStep={6} 
        totalSteps={6} 
        stepNames={['ユーザー名', 'Now ID', 'メールアドレス', 'パスワード', 'プロフィール画像', '位置情報']}
      />
      
      <View style={styles.content}>
        <Text style={styles.title}>登録完了！</Text>
        <Text style={styles.subtitle}>
          {isRegistering ? 'アカウントを作成中...' : '友達とつながろう！'}
        </Text>
        
        {isRegistering && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>しばらくお待ちください</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#000', marginBottom: 16 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 40, textAlign: 'center' },
  loadingContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
}); 