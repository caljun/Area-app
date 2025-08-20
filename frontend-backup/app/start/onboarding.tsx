import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function OnboardingScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Areaへようこそ！</Text>
        <Text style={styles.subtitle}>友達と場所を共有しよう</Text>
        
        <View style={styles.featureContainer}>
          <Text style={styles.featureTitle}>✨ 主な機能</Text>
          <Text style={styles.featureText}>• 友達とエリアを共有</Text>
          <Text style={styles.featureText}>• リアルタイムで位置情報を確認</Text>
          <Text style={styles.featureText}>• プライベートな空間を作成</Text>
        </View>
        
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/start/username')}
        >
          <Text style={styles.buttonText}>新規登録</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/start/login')}
        >
          <Text style={styles.secondaryButtonText}>ログイン</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#000', marginBottom: 16 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 32, textAlign: 'center' },
  featureContainer: {
    backgroundColor: '#f8f8f8',
    padding: 20,
    borderRadius: 12,
    marginBottom: 40,
    width: '100%',
  },
  featureTitle: { fontSize: 18, fontWeight: 'bold', color: '#000', marginBottom: 12 },
  featureText: { fontSize: 14, color: '#666', marginBottom: 4 },
  button: {
    backgroundColor: '#000',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 48,
    marginBottom: 16,
    width: '100%',
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 48,
    width: '100%',
  },
  secondaryButtonText: { color: '#000', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
}); 