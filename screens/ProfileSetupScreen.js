import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Contacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../firebase.config';
import { CryptoService } from '../services/CryptoService';

const INTERESTS = [
  'Спорт', 'Музыка', 'Кино', 'Путешествия', 'Искусство',
  'Технологии', 'Книги', 'Кулинария', 'Фотография', 'Игры'
];

const ProfileSetupScreen = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [contacts, setContacts] = useState([]);

  const handleNextStep = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      completeSetup();
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Ошибка', 'Нужны разрешения для доступа к галерее');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setAvatar(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Ошибка', 'Не удалось выбрать изображение');
    }
  };

  const toggleInterest = (interest) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const requestContactsPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.error('Error requesting contacts permission:', err);
        return false;
      }
    } else {
      const { status } = await Contacts.requestPermissionsAsync();
      return status === 'granted';
    }
  };

  const importContacts = async () => {
    setLoading(true);
    try {
      const hasPermission = await requestContactsPermission();
      
      if (!hasPermission) {
        Alert.alert('Разрешение отклонено', 'Для импорта контактов нужно разрешение');
        setLoading(false);
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
      });

      const processedContacts = [];
      
      for (const contact of data) {
        if (contact.phoneNumbers && contact.phoneNumbers.length > 0) {
          for (const phoneNumber of contact.phoneNumbers) {
            const cleanNumber = cleanPhoneNumber(phoneNumber.number);
            if (cleanNumber) {
              processedContacts.push({
                id: `${contact.id}_${phoneNumber.id}`,
                name: contact.name || 'Без имени',
                phoneNumber: cleanNumber,
                contactId: contact.id,
              });
            }
          }
        }
      }

      // Находим зарегистрированных пользователей
      const registeredContacts = await findRegisteredUsers(processedContacts);
      
      setContacts(registeredContacts);
      Alert.alert('Успешно', `Найдено ${registeredContacts.filter(c => c.isRegistered).length} пользователей`);
      
    } catch (error) {
      console.error('Error importing contacts:', error);
      Alert.alert('Ошибка', 'Не удалось импортировать контакты');
    } finally {
      setLoading(false);
    }
  };

  const cleanPhoneNumber = (number) => {
    const cleaned = number.replace(/\D/g, '');
    if (cleaned.startsWith('8')) {
      return '+7' + cleaned.substring(1);
    }
    if (cleaned.startsWith('7') && cleaned.length === 11) {
      return '+' + cleaned;
    }
    if (cleaned.startsWith('9') && cleaned.length === 10) {
      return '+7' + cleaned;
    }
    return cleaned.length >= 10 ? '+7' + cleaned.slice(-10) : null;
  };

  const findRegisteredUsers = async (contacts) => {
    try {
      const phoneNumbers = contacts.map(c => c.phoneNumber);
      const registeredUsers = [];
      
      // Firebase не поддерживает запросы с более чем 10 элементами
      const chunks = [];
      for (let i = 0; i < phoneNumbers.length; i += 10) {
        chunks.push(phoneNumbers.slice(i, i + 10));
      }
      
      for (const chunk of chunks) {
        const q = query(
          collection(db, 'users'), 
          where('phoneNumber', 'in', chunk)
        );
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach((doc) => {
          registeredUsers.push({
            userId: doc.id,
            ...doc.data()
          });
        });
      }

      return contacts.map(contact => {
        const registered = registeredUsers.find(u => u.phoneNumber === contact.phoneNumber);
        return {
          ...contact,
          isRegistered: !!registered,
          userId: registered?.userId || null,
        };
      });
      
    } catch (error) {
      console.error('Error finding registered users:', error);
      return contacts.map(c => ({ ...c, isRegistered: false }));
    }
  };

  const uploadAvatar = async (uri) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const userId = auth.currentUser.uid;
      const avatarRef = ref(storage, `avatars/${userId}.jpg`);
      
      await uploadBytes(avatarRef, blob);
      const downloadURL = await getDownloadURL(avatarRef);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      throw error;
    }
  };

  const completeSetup = async () => {
    if (!description.trim()) {
      Alert.alert('Ошибка', 'Добавьте описание');
      return;
    }

    if (!password.trim() || password !== confirmPassword) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Ошибка', 'Пароль должен содержать минимум 6 символов');
      return;
    }

    setLoading(true);
    try {
      // Генерируем ключи для шифрования
      const keyPair = await CryptoService.generateKeyPair();
      
      const userId = auth.currentUser.uid;
      const phoneNumber = auth.currentUser.phoneNumber;
      
      // Загружаем аватар
      let avatarUrl = null;
      if (avatar) {
        avatarUrl = await uploadAvatar(avatar);
      }
      
      // Создаем профиль пользователя
      const userProfile = {
        phoneNumber,
        publicKey: keyPair.publicKey,
        avatarUrl,
        description,
        interests: selectedInterests,
        contacts: contacts.filter(c => c.isRegistered).map(c => c.userId),
        createdAt: new Date(),
        lastSeen: new Date(),
        isOnline: true,
      };
      
      await setDoc(doc(db, 'users', userId), userProfile);
      
      // Сохраняем данные локально
      await AsyncStorage.setItem('profileData', JSON.stringify({
        userId,
        description,
        avatarUrl,
        interests: selectedInterests,
        contacts,
      }));
      
      await AsyncStorage.setItem('profileComplete', 'true');
      
      // Сохраняем зашифрованный приватный ключ
      const encryptedKey = await CryptoService.encryptLocalData(
        { privateKey: keyPair.secretKey },
        password
      );
      
      await AsyncStorage.setItem('encryptedPrivateKey', JSON.stringify(encryptedKey));
      
      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
      
    } catch (error) {
      console.error('Error completing setup:', error);
      Alert.alert('Ошибка', 'Не удалось создать профиль');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Расскажите о себе</Text>
      <Text style={styles.stepSubtitle}>
        Добавьте описание для других пользователей
      </Text>
      
      <TextInput
        style={styles.textArea}
        placeholder="Напишите о себе..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        placeholderTextColor="#94a3b8"
      />
      
      <TouchableOpacity style={styles.button} onPress={handleNextStep}>
        <Text style={styles.buttonText}>Далее</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Создайте пароль</Text>
      <Text style={styles.stepSubtitle}>
        Для защиты ваших данных на устройстве
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor="#94a3b8"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Подтвердите пароль"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        placeholderTextColor="#94a3b8"
      />
      
      <TouchableOpacity style={styles.button} onPress={handleNextStep}>
        <Text style={styles.buttonText}>Далее</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Добавьте фото</Text>
      <Text style={styles.stepSubtitle}>
        Выберите аватар для профиля
      </Text>
      
      <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>📷</Text>
          </View>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={handleNextStep}>
        <Text style={styles.buttonText}>Далее</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Интересы и контакты</Text>
      <Text style={styles.stepSubtitle}>
        Выберите интересы и импортируйте контакты
      </Text>
      
      <View style={styles.interestsContainer}>
        {INTERESTS.map((interest) => (
          <TouchableOpacity
            key={interest}
            style={[
              styles.interestChip,
              selectedInterests.includes(interest) && styles.interestChipSelected
            ]}
            onPress={() => toggleInterest(interest)}
          >
            <Text style={[
              styles.interestText,
              selectedInterests.includes(interest) && styles.interestTextSelected
            ]}>
              {interest}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity 
        style={styles.contactsButton} 
        onPress={importContacts}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#2563eb" />
        ) : (
          <Text style={styles.contactsButtonText}>
            📱 Импортировать контакты ({contacts.length})
          </Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={completeSetup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>Завершить</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return renderStep1();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Настройка профиля</Text>
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4].map((num) => (
            <View
              key={num}
              style={[
                styles.progressDot,
                num <= step && styles.progressDotActive
              ]}
            />
          ))}
        </View>
      </View>
      
      {renderCurrentStep()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
    fontFamily: 'System',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
  },
  progressDotActive: {
    backgroundColor: '#2563eb',
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'System',
  },
  stepSubtitle: {
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
    marginBottom: 16,
    fontFamily: 'System',
    color: '#1e293b',
  },
  textArea: {
    width: '100%',
    height: 120,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    marginBottom: 24,
    fontFamily: 'System',
    color: '#1e293b',
  },
  avatarContainer: {
    marginBottom: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 40,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
    justifyContent: 'center',
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  interestChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  interestText: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'System',
  },
  interestTextSelected: {
    color: '#ffffff',
  },
  contactsButton: {
    padding: import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CryptoService } from '../services/CryptoService';
import { ContactsService } from '../services/ContactsService';

const INTERESTS = [
  'Спорт', 'Музыка', 'Кино', 'Путешествия', 'Искусство',
  'Технологии', 'Книги', 'Кулинария', 'Фотография', 'Игры'
];

const ProfileSetupScreen = ({ navigation }) => {
  const [step, setStep] = useState(1); // 1-4 steps
  const [loading, setLoading] = useState(false);
  
  // Profile data
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatar, setAvatar] = useState(null);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [contacts, setContacts] = useState([]);

  const handleNextStep = () => {
    if (step < 4) {
      setStep(step + 1);
    } else {
      completeSetup();
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled) {
        setAvatar(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выбрать изображение');
    }
  };

  const toggleInterest = (interest) => {
    setSelectedInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const importContacts = async () => {
    setLoading(true);
    try {
      const importedContacts = await ContactsService.importContacts();
      setContacts(importedContacts);
      Alert.alert('Успешно', `Импортировано ${importedContacts.length} контактов`);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось импортировать контакты');
    } finally {
      setLoading(false);
    }
  };

  const completeSetup = async () => {
    if (!description.trim()) {
      Alert.alert('Ошибка', 'Добавьте описание профиля');
      return;
    }

    if (!password.trim() || password !== confirmPassword) {
      Alert.alert('Ошибка', 'Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      // Генерация ключей для E2E шифрования
      const keyPair = await CryptoService.generateKeyPair();
      
      // Сохранение профиля
      const profileData = {
        description,
        avatar,
        interests: selectedInterests,
        contacts,
        keyPair,
      };

      await AsyncStorage.setItem('profileData', JSON.stringify(profileData));
      await AsyncStorage.setItem('profileComplete', 'true');
      await AsyncStorage.setItem('userPassword', password); // В реальном приложении нужно хешировать
      
      navigation.replace('Main');
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить профиль');
    } finally {
      setLoading(false);
    }
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Расскажите о себе</Text>
      <Text style={styles.stepSubtitle}>
        Добавьте описание, чтобы другие пользователи могли узнать вас лучше
      </Text>
      
      <TextInput
        style={styles.textArea}
        placeholder="Напишите несколько слов о себе..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
        placeholderTextColor="#94a3b8"
      />
      
      <TouchableOpacity style={styles.button} onPress={handleNextStep}>
        <Text style={styles.buttonText}>Далее</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Создайте пароль</Text>
      <Text style={styles.stepSubtitle}>
        Пароль будет использоваться для защиты ваших данных на устройстве
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="Пароль"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholderTextColor="#94a3b8"
      />
      
      <TextInput
        style={styles.input}
        placeholder="Подтвердите пароль"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        placeholderTextColor="#94a3b8"
      />
      
      <TouchableOpacity style={styles.button} onPress={handleNextStep}>
        <Text style={styles.buttonText}>Далее</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Добавьте фото</Text>
      <Text style={styles.stepSubtitle}>
        Выберите фотографию для вашего профиля
      </Text>
      
      <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>📷</Text>
          </View>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={handleNextStep}>
        <Text style={styles.buttonText}>Далее</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Выберите интересы</Text>
      <Text style={styles.stepSubtitle}>
        Это поможет найти единомышленников
      </Text>
      
      <View style={styles.interestsContainer}>
        {INTERESTS.map((interest) => (
          <TouchableOpacity
            key={interest}
            style={[
              styles.interestChip,
              selectedInterests.includes(interest) && styles.interestChipSelected
            ]}
            onPress={() => toggleInterest(interest)}
          >
            <Text style={[
              styles.interestText,
              selectedInterests.includes(interest) && styles.interestTextSelected
            ]}>
              {interest}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      <TouchableOpacity style={styles.contactsButton} onPress={importContacts}>
        {loading ? (
          <ActivityIndicator color="#2563eb" />
        ) : (
          <Text style={styles.contactsButtonText}>
            📱 Импортировать контакты ({contacts.length})
          </Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={completeSetup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>Завершить</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      case 4: return renderStep4();
      default: return renderStep1();
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Настройка профиля</Text>
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4].map((num) => (
            <View
              key={num}
              style={[
                styles.progressDot,
                num <= step && styles.progressDotActive
              ]}
            />
          ))}
        </View>
      </View>
      
      {renderCurrentStep()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
    fontFamily: 'System',
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
  },
  progressDotActive: {
    backgroundColor: '#2563eb',
  },
  stepContainer: {
    alignItems: 'center',
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
    fontFamily: 'System',
  },
  stepSubtitle: {
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
    marginBottom: 16,
    fontFamily: 'System',
    color: '#1e293b',
  },
  textArea: {
    width: '100%',
    height: 120,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    marginBottom: 24,
    fontFamily: 'System',
    color: '#1e293b',
  },
  avatarContainer: {
    marginBottom: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 40,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
    justifyContent: 'center',
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  interestChipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  interestText: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'System',
  },
  interestTextSelected: {
    color: '#ffffff',
  },
  contactsButton: {
    padding: 16,
    marginBottom: 24,
  },
  contactsButtonText: {
    fontSize: 16,
    color: '#2563eb',
    textAlign: 'center',
    fontFamily: 'System',
  },
  button: {
    width: '100%',
    height: 48,
    backgroundColor: '#2563eb',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
});

export default ProfileSetupScreen;
