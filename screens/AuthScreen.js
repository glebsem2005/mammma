import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase.config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FirebaseRecaptchaVerifierModal } from 'expo-firebase-recaptcha';
import app from '../firebase.config';

const AuthScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone');
  const [loading, setLoading] = useState(false);
  const [verificationId, setVerificationId] = useState(null);
  
  const recaptchaVerifier = useRef(null);

  const formatPhoneNumber = (number) => {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.startsWith('8')) {
      return '+7' + cleaned.substring(1);
    }
    if (cleaned.startsWith('7')) {
      return '+' + cleaned;
    }
    return '+7' + cleaned;
  };

  const sendVerificationCode = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Ошибка', 'Введите номер телефона');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      const phoneProvider = new PhoneAuthProvider(auth);
      const verificationId = await phoneProvider.verifyPhoneNumber(
        formattedPhone,
        recaptchaVerifier.current
      );
      
      setVerificationId(verificationId);
      setStep('code');
      setLoading(false);
      Alert.alert('Код отправлен', `SMS код отправлен на ${formattedPhone}`);
      
    } catch (error) {
      setLoading(false);
      console.error('Phone auth error:', error);
      
      let errorMessage = 'Не удалось отправить код';
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Неверный формат номера телефона';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Слишком много попыток. Попробуйте позже';
      }
      
      Alert.alert('Ошибка', errorMessage);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) {
      Alert.alert('Ошибка', 'Введите код подтверждения');
      return;
    }

    if (!verificationId) {
      Alert.alert('Ошибка', 'Сначала запросите код');
      return;
    }

    setLoading(true);
    try {
      const credential = PhoneAuthProvider.credential(verificationId, code);
      const result = await signInWithCredential(auth, credential);
      const user = result.user;
      
      // Сохраняем данные пользователя
      await AsyncStorage.setItem('userId', user.uid);
      await AsyncStorage.setItem('phoneNumber', user.phoneNumber);
      
      // Проверяем существование профиля
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        await AsyncStorage.setItem('profileComplete', 'true');
        navigation.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        });
      } else {
        navigation.reset({
          index: 0,
          routes: [{ name: 'ProfileSetup' }],
        });
      }
      
    } catch (error) {
      setLoading(false);
      console.error('Code verification error:', error);
      
      let errorMessage = 'Неверный код подтверждения';
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Неверный код';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'Код истек';
      }
      
      Alert.alert('Ошибка', errorMessage);
    }
  };

  const renderPhoneStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Вход по номеру телефона</Text>
      <Text style={styles.subtitle}>
        Мы отправим вам код подтверждения
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="+7 (999) 123-45-67"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
        placeholderTextColor="#94a3b8"
      />
      
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={sendVerificationCode}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>Отправить код</Text>
        )}
      </TouchableOpacity>
      
      <FirebaseRecaptchaVerifierModal
        ref={recaptchaVerifier}
        firebaseConfig={app.options}
        attemptInvisibleVerification={true}
      />
    </View>
  );

  const renderCodeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Введите код</Text>
      <Text style={styles.subtitle}>
        Код отправлен на {phoneNumber}
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="123456"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        placeholderTextColor="#94a3b8"
      />
      
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={verifyCode}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>Подтвердить</Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setStep('phone')}
      >
        <Text style={styles.backButtonText}>← Назад</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>💬</Text>
          <Text style={styles.appName}>Мессенджер</Text>
        </View>
        
        {step === 'phone' ? renderPhoneStep() : renderCodeStep()}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'System',
  },
  stepContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: 'System',
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    marginBottom: 24,
    fontFamily: 'System',
    color: '#1e293b',
  },
  button: {
    width: '100%',
    height: 48,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontFamily: 'System',
  },
});

export default AuthScreen;import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { signInWithPhoneNumber, RecaptchaVerifier } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase.config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthScreen = ({ navigation }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState('phone'); // 'phone' or 'code'
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState(null);

  const formatPhoneNumber = (number) => {
    // Форматирование номера для Firebase
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.startsWith('8')) {
      return '+7' + cleaned.substring(1);
    }
    if (cleaned.startsWith('7')) {
      return '+' + cleaned;
    }
    return '+7' + cleaned;
  };

  const sendVerificationCode = async () => {
    if (!phoneNumber.trim()) {
      Alert.alert('Ошибка', 'Введите номер телефона');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      // Реальная Firebase Phone Auth
      const recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {
        size: 'invisible',
        callback: (response) => {
          console.log('reCAPTCHA solved');
        }
      }, auth);

      const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, recaptchaVerifier);
      setConfirmation(confirmationResult);
      setStep('code');
      setLoading(false);
      Alert.alert('Код отправлен', `SMS с кодом отправлен на ${formattedPhone}`);
      
    } catch (error) {
      setLoading(false);
      console.error('Phone auth error:', error);
      
      let errorMessage = 'Не удалось отправить код. Попробуйте еще раз.';
      if (error.code === 'auth/invalid-phone-number') {
        errorMessage = 'Неверный формат номера телефона';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Слишком много попыток. Попробуйте позже.';
      }
      
      Alert.alert('Ошибка', errorMessage);
    }
  };

  const verifyCode = async () => {
    if (!code.trim()) {
      Alert.alert('Ошибка', 'Введите код подтверждения');
      return;
    }

    if (!confirmation) {
      Alert.alert('Ошибка', 'Сначала запросите код подтверждения');
      return;
    }

    setLoading(true);
    try {
      // Реальная верификация кода с Firebase
      const result = await confirmation.confirm(code);
      const user = result.user;
      
      // Сохраняем токен пользователя
      const token = await user.getIdToken();
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userId', user.uid);
      await AsyncStorage.setItem('phoneNumber', user.phoneNumber);
      
      // Проверяем, существует ли профиль пользователя
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        // Пользователь уже существует, переходим к главному экрану
        await AsyncStorage.setItem('profileComplete', 'true');
        navigation.replace('Main');
      } else {
        // Новый пользователь, переходим к настройке профиля
        navigation.replace('ProfileSetup');
      }
      
    } catch (error) {
      setLoading(false);
      console.error('Code verification error:', error);
      
      let errorMessage = 'Неверный код подтверждения';
      if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Неверный код подтверждения';
      } else if (error.code === 'auth/code-expired') {
        errorMessage = 'Код подтверждения истек';
      }
      
      Alert.alert('Ошибка', errorMessage);
    }
  };

  const renderPhoneStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Вход по номеру телефона</Text>
      <Text style={styles.subtitle}>
        Мы отправим вам код подтверждения
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="+7 (999) 123-45-67"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
        autoCompleteType="tel"
        textContentType="telephoneNumber"
        placeholderTextColor="#94a3b8"
      />
      
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={sendVerificationCode}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>Отправить код</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCodeStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Введите код</Text>
      <Text style={styles.subtitle}>
        Код отправлен на номер {phoneNumber}
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="123456"
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={6}
        placeholderTextColor="#94a3b8"
      />
      
      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={verifyCode}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>Подтвердить</Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setStep('phone')}
      >
        <Text style={styles.backButtonText}>← Назад</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>💬</Text>
          <Text style={styles.appName}>Мессенджер</Text>
        </View>
        
        {step === 'phone' ? renderPhoneStep() : renderCodeStep()}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  appName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'System',
  },
  stepContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
    fontFamily: 'System',
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    fontFamily: 'System',
  },
  input: {
    width: '100%',
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    marginBottom: 24,
    fontFamily: 'System',
    color: '#1e293b',
  },
  button: {
    width: '100%',
    height: 48,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#94a3b8',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#2563eb',
    fontSize: 16,
    fontFamily: 'System',
  },
});

export default AuthScreen;
