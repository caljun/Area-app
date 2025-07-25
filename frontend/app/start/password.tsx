import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { useRegistration } from '../../contexts/RegistrationContext';
import ProgressBar from '../../components/ProgressBar';

export default function PasswordScreen() {
  const router = useRouter();
  const { registrationData, updateRegistrationData } = useRegistration();
  const [password, setPassword] = useState(registrationData.password);
  const [error, setError] = useState('');

  useEffect(() => {
    setPassword(registrationData.password);
  }, [registrationData.password]);

  const handleNext = () => {
    if (!password.trim()) {
      setError('パスワードを入力してください');
      return;
    }
    
    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    setError('');
    updateRegistrationData({ password: password });
    router.push('/start/avatar');
  };

  const handleInputChange = (text: string) => {
    setPassword(text);
    setError('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ProgressBar 
        currentStep={4} 
        totalSteps={6} 
        stepNames={['ユーザー名', 'Now ID', 'メールアドレス', 'パスワード', 'プロフィール画像', '位置情報']}
      />
      
      <View style={styles.content}>
        <Text style={styles.title}>パスワードを入力</Text>
        <Text style={styles.subtitle}>6文字以上のパスワードを設定してください</Text>
        
        <TextInput
          style={[styles.input, error && styles.inputError]}
          placeholder="パスワード"
          value={password}
          onChangeText={handleInputChange}
          placeholderTextColor="#aaa"
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
        />
        
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        
        <TouchableOpacity
          style={[styles.button, !password.trim() && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!password.trim()}
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