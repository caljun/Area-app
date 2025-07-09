import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StartScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Area</Text>
        <Text style={styles.subtitle}>友達と場所を共有しよう</Text>
        
        <View style={styles.buttonContainer}>
          <Link href={"register" as any} asChild>
            <TouchableOpacity style={[styles.button, styles.registerButton]}>
              <Text style={styles.buttonText}>新規登録</Text>
            </TouchableOpacity>
          </Link>
          
          <Link href={"login" as any} asChild>
            <TouchableOpacity style={[styles.button, styles.loginButton]}>
              <Text style={[styles.buttonText, styles.loginButtonText]}>ログイン</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  buttonContainer: {
    width: '100%',
    gap: 15,
  },
  button: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 25,
    alignItems: 'center',
  },
  registerButton: {
    backgroundColor: '#000',
  },
  loginButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#000',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  loginButtonText: {
    color: '#000',
  },
}); 