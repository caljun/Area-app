import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useRegistration } from '../../contexts/RegistrationContext';
import ProgressBar from '../../components/ProgressBar';

export default function NowIdScreen() {
  const router = useRouter();
  const { registrationData, updateRegistrationData } = useRegistration();
  const [nowid, setNowid] = useState(registrationData.nowId);
  const [error, setError] = useState('');

  useEffect(() => {
    setNowid(registrationData.nowId);
  }, [registrationData.nowId]);

  const handleNext = () => {
    if (!nowid.trim()) {
      setError('Now IDを入力してください');
      return;
    }
    
    if (nowid.length < 3) {
      setError('Now IDは3文字以上で入力してください');
      return;
    }

    // 英数字のみ許可
    if (!/^[a-zA-Z0-9_]+$/.test(nowid)) {
      setError('Now IDは英数字とアンダースコアのみ使用できます');
      return;
    }

    setError('');
    updateRegistrationData({ nowId: nowid.trim() });
    router.push('/start/email');
  };

  const handleInputChange = (text: string) => {
    setNowid(text);
    setError('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProgressBar 
        currentStep={2} 
        totalSteps={6} 
        stepNames={['ユーザー名', 'Now ID', 'メールアドレス', 'パスワード', 'プロフィール画像', '位置情報']}
      />
      
      <View style={styles.content}>
        <Text style={styles.title}>Now IDを入力</Text>
        <Text style={styles.subtitle}>ユニークなIDを設定してください</Text>
        
        <TextInput
          style={[styles.input, error && styles.inputError]}
          placeholder="Now ID"
          value={nowid}
          onChangeText={handleInputChange}
          placeholderTextColor="#aaa"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />
        
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        
        <TouchableOpacity
          style={[styles.button, !nowid.trim() && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!nowid.trim()}
        >
          <Text style={styles.buttonText}>次へ</Text>
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
  input: {
    width: '100%',
    borderBottomWidth: 1,
    borderColor: '#000',
    fontSize: 18,
    paddingVertical: 12,
    marginBottom: 8,
    color: '#000',
  },
  inputError: {
    borderColor: '#ff4444',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 14,
    marginBottom: 32,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#000',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginBottom: 16,
    width: '100%',
  },
  buttonDisabled: { backgroundColor: '#ccc' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  backButton: { marginTop: 8 },
  backButtonText: { color: '#000', fontSize: 16 },
}); 