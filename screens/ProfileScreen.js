import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Alert,
  Modal,
  Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CryptoService } from '../services/CryptoService';

const INTERESTS = [
  'Спорт', 'Музыка', 'Кино', 'Путешествия', 'Искусство',
  'Технологии', 'Книги', 'Кулинария', 'Фотография', 'Игры'
];

const ProfileScreen = ({ navigation }) => {
  const [profile, setProfile] = useState({
    name: '',
    description: '',
    avatar: null,
    interests: [],
    phoneNumber: '',
  });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [tempValue, setTempValue] = useState('');
  const [tempInterests, setTempInterests] = useState([]);
  const [settings, setSettings] = useState({
    notifications: true,
    showOnlineStatus: true,
    allowVoiceCalls: true,
    allowVideoCalls: true,
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const profileData = await AsyncStorage.getItem('profileData');
      const phoneNumber = await AsyncStorage.getItem('phoneNumber');
      
      if (profileData) {
        const parsedProfile = JSON.parse(profileData);
        setProfile({
          name: 'Мой профиль', // В реальном приложении будет имя из профиля
          description: parsedProfile.description || '',
          avatar: parsedProfile.avatar || null,
          interests: parsedProfile.interests || [],
          phoneNumber: phoneNumber || '',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const saveProfile = async (updatedProfile) => {
    try {
      const currentData = await AsyncStorage.getItem('profileData');
      const parsedData = currentData ? JSON.parse(currentData) : {};
      
      const newData = {
        ...parsedData,
        ...updatedProfile,
      };
      
      await AsyncStorage.setItem('profileData', JSON.stringify(newData));
      setProfile(prev => ({ ...prev, ...updatedProfile }));
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить профиль');
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
        const newAvatar = result.assets[0].uri;
        await saveProfile({ avatar: newAvatar });
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выбрать изображение');
    }
  };

  const openEditModal = (field) => {
    setEditingField(field);
    if (field === 'description') {
      setTempValue(profile.description);
    } else if (field === 'interests') {
      setTempInterests([...profile.interests]);
    }
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    try {
      if (editingField === 'description') {
        await saveProfile({ description: tempValue });
      } else if (editingField === 'interests') {
        await saveProfile({ interests: tempInterests });
      }
      setShowEditModal(false);
      setEditingField(null);
      setTempValue('');
      setTempInterests([]);
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сохранить изменения');
    }
  };

  const toggleInterest = (interest) => {
    setTempInterests(prev => 
      prev.includes(interest) 
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const logout = () => {
    Alert.alert(
      'Выход',
      'Вы уверены, что хотите выйти из аккаунта?',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Выйти', style: 'destructive', onPress: confirmLogout },
      ]
    );
  };

  const confirmLogout = async () => {
    try {
      await AsyncStorage.multiRemove([
        'userToken',
        'profileData',
        'profileComplete',
        'phoneNumber',
      ]);
      await CryptoService.clearKeys();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выйти из аккаунта');
    }
  };

  const renderEditModal = () => (
    <Modal
      visible={showEditModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowEditModal(false)}>
            <Text style={styles.modalCancelText}>Отмена</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>
            {editingField === 'description' ? 'Редактировать описание' : 'Редактировать интересы'}
          </Text>
          <TouchableOpacity onPress={saveEdit}>
            <Text style={styles.modalSaveText}>Сохранить</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          {editingField === 'description' ? (
            <TextInput
              style={styles.descriptionInput}
              value={tempValue}
              onChangeText={setTempValue}
              placeholder="Расскажите о себе..."
              multiline
              textAlignVertical="top"
              placeholderTextColor="#94a3b8"
            />
          ) : (
            <View style={styles.interestsContainer}>
              {INTERESTS.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  style={[
                    styles.interestChip,
                    tempInterests.includes(interest) && styles.interestChipSelected
                  ]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text style={[
                    styles.interestText,
                    tempInterests.includes(interest) && styles.interestTextSelected
                  ]}>
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  const renderSettingsModal = () => (
    <Modal
      visible={showSettings}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowSettings(false)}>
            <Text style={styles.modalCancelText}>Закрыть</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Настройки</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Уведомления</Text>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Уведомления</Text>
              <Switch
                value={settings.notifications}
                onValueChange={(value) => setSettings(prev => ({ ...prev, notifications: value }))}
              />
            </View>
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Приватность</Text>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Показывать статус онлайн</Text>
              <Switch
                value={settings.showOnlineStatus}
                onValueChange={(value) => setSettings(prev => ({ ...prev, showOnlineStatus: value }))}
              />
            </View>
          </View>

          <View style={styles.settingsSection}>
            <Text style={styles.sectionTitle}>Звонки</Text>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Разрешить аудиозвонки</Text>
              <Switch
                value={settings.allowVoiceCalls}
                onValueChange={(value) => setSettings(prev => ({ ...prev, allowVoiceCalls: value }))}
              />
            </View>
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Разрешить видеозвонки</Text>
              <Switch
                value={settings.allowVideoCalls}
                onValueChange={(value) => setSettings(prev => ({ ...prev, allowVideoCalls: value }))}
              />
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Профиль</Text>
        <TouchableOpacity 
          style={styles.settingsButton}
          onPress={() => setShowSettings(true)}
        >
          <Text style={styles.settingsButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>📷</Text>
            </View>
          )}
          <View style={styles.avatarEditButton}>
            <Text style={styles.avatarEditButtonText}>✏️</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.profileName}>{profile.name}</Text>
        <Text style={styles.profilePhone}>{profile.phoneNumber}</Text>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoItem}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoLabel}>Описание</Text>
            <TouchableOpacity onPress={() => openEditModal('description')}>
              <Text style={styles.editButton}>Изменить</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.infoValue}>
            {profile.description || 'Добавьте описание профиля'}
          </Text>
        </View>

        <View style={styles.infoItem}>
          <View style={styles.infoHeader}>
            <Text style={styles.infoLabel}>Интересы</Text>
            <TouchableOpacity onPress={() => openEditModal('interests')}>
              <Text style={styles.editButton}>Изменить</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.interestsDisplay}>
            {profile.interests.length > 0 ? (
              profile.interests.map((interest, index) => (
                <View key={index} style={styles.interestTag}>
                  <Text style={styles.interestTagText}>{interest}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noInterestsText}>Выберите интересы</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.actionsSection}>
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>📊 Статистика</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>💝 Мои матчи</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>🔒 Безопасность</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionButtonText}>❓ Помощь</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutButtonText}>Выйти из аккаунта</Text>
        </TouchableOpacity>
      </View>

      {renderEditModal()}
      {renderSettingsModal()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'System',
  },
  settingsButton: {
    padding: 8,
  },
  settingsButtonText: {
    fontSize: 20,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f1f5f9',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    fontSize: 30,
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditButtonText: {
    fontSize: 14,
    color: '#ffffff',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
    fontFamily: 'System',
  },
  profilePhone: {
    fontSize: 16,
    color: '#64748b',
    fontFamily: 'System',
  },
  infoSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  infoItem: {
    marginBottom: 24,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'System',
  },
  editButton: {
    fontSize: 14,
    color: '#2563eb',
    fontFamily: 'System',
  },
  infoValue: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 22,
    fontFamily: 'System',
  },
  interestsDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestTag: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestTagText: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'System',
  },
  noInterestsText: {
    fontSize: 16,
    color: '#94a3b8',
    fontStyle: 'italic',
    fontFamily: 'System',
  },
  actionsSection: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionButton: {
    paddingVertical: 16,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  actionButtonText: {
    fontSize: 16,
    color: '#1e293b',
    fontFamily: 'System',
  },
  logoutSection: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  logoutButton: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#64748b',
    fontFamily: 'System',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'System',
  },
  modalSaveText: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
    fontFamily: 'System',
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  descriptionInput: {
    fontSize: 16,
    color: '#1e293b',
    textAlignVertical: 'top',
    minHeight: 120,
    fontFamily: 'System',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
  settingsSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
    fontFamily: 'System',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  settingLabel: {
    fontSize: 16,
    color: '#1e293b',
    fontFamily: 'System',
  },
});

export default ProfileScreen;
