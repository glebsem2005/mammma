import * as Contacts from 'expo-contacts';
import { Alert, Platform, PermissionsAndroid } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase.config';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class ContactsService {
  
  /**
   * Запрос разрешения на доступ к контактам
   */
  static async requestPermission() {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          {
            title: 'Доступ к контактам',
            message: 'Приложению нужен доступ к контактам для поиска друзей',
            buttonPositive: 'Разрешить',
            buttonNegative: 'Отмена',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const { status } = await Contacts.requestPermissionsAsync();
        return status === 'granted';
      }
    } catch (error) {
      console.error('Ошибка запроса разрешений:', error);
      return false;
    }
  }

  /**
   * Импорт контактов из телефона
   */
  static async importContacts() {
    try {
      console.log('📱 Импортируем контакты...');
      
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Нет разрешения на доступ к контактам');
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
        ],
      });

      console.log(`📋 Найдено ${data.length} контактов в телефоне`);
      
      const processedContacts = this.processContacts(data);
      console.log(`✅ Обработано ${processedContacts.length} контактов`);
      
      // Сохраняем локально
      await this.saveContactsToLocal(processedContacts);
      
      // Ищем зарегистрированных пользователей
      const syncedContacts = await this.syncWithServer(processedContacts);
      
      return syncedContacts;
      
    } catch (error) {
      console.error('❌ Ошибка импорта контактов:', error);
      throw new Error('Не удалось импортировать контакты: ' + error.message);
    }
  }

  /**
   * Обработка контактов из телефона
   */
  static processContacts(rawContacts) {
    const processedContacts = [];

    rawContacts.forEach(contact => {
      if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) {
        return; // Пропускаем контакты без номеров
      }

      contact.phoneNumbers.forEach((phoneNumber, index) => {
        const cleanNumber = this.cleanPhoneNumber(phoneNumber.number);
        if (cleanNumber) {
          processedContacts.push({
            id: `${contact.id}_${index}`,
            name: contact.name || 'Без имени',
            phoneNumber: cleanNumber,
            originalNumber: phoneNumber.number,
            contactId: contact.id,
            isRegistered: false,
            userId: null,
          });
        }
      });
    });

    // Удаляем дубликаты по номеру
    const uniqueContacts = this.removeDuplicateNumbers(processedContacts);
    
    // Сортируем по имени
    return uniqueContacts.sort((a, b) => 
      a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })
    );
  }

  /**
   * Очистка номера телефона
   */
  static cleanPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;

    // Удаляем все кроме цифр и +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // Приводим к международному формату
    if (cleaned.startsWith('8')) {
      cleaned = '+7' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') && cleaned.length === 11) {
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('9') && cleaned.length === 10) {
      cleaned = '+7' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      if (cleaned.length === 10) {
        cleaned = '+7' + cleaned;
      } else if (cleaned.length === 11 && cleaned.startsWith('7')) {
        cleaned = '+' + cleaned;
      }
    }

    // Проверяем валидность
    if (this.isValidPhoneNumber(cleaned)) {
      return cleaned;
    }

    return null;
  }

  /**
   * Проверка валидности номера
   */
  static isValidPhoneNumber(phoneNumber) {
    const phoneRegex = /^\+\d{7,15}$/;
    return phoneRegex.test(phoneNumber);
  }

  /**
   * Удаление дубликатов по номеру
   */
  static removeDuplicateNumbers(contacts) {
    const seen = new Map();
    const result = [];

    contacts.forEach(contact => {
      if (!seen.has(contact.phoneNumber)) {
        seen.set(contact.phoneNumber, true);
        result.push(contact);
      }
    });

    return result;
  }

  /**
   * Синхронизация с сервером Firebase
   */
  static async syncWithServer(contacts) {
    try {
      console.log('🔄 Синхронизируем с сервером...');
      
      const phoneNumbers = contacts.map(contact => contact.phoneNumber);
      const registeredUsers = [];
      
      // Firebase не поддерживает IN с более чем 10 элементами
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

      console.log(`✅ Найдено ${registeredUsers.length} зарегистрированных пользователей`);

      // Сопоставляем контакты с зарегистрированными пользователями
      const syncedContacts = contacts.map(contact => {
        const registered = registeredUsers.find(
          user => user.phoneNumber === contact.phoneNumber
        );

        return {
          ...contact,
          isRegistered: !!registered,
          userId: registered?.userId || null,
          serverName: registered?.name || null,
          avatarUrl: registered?.avatarUrl || null,
        };
      });

      await this.saveContactsToLocal(syncedContacts);
      return syncedContacts;
      
    } catch (error) {
      console.error('❌ Ошибка синхронизации:', error);
      // Возвращаем контакты без синхронизации
      return contacts.map(c => ({ ...c, isRegistered: false }));
    }
  }

  /**
   * Сохранение контактов локально
   */
  static async saveContactsToLocal(contacts) {
    try {
      await AsyncStorage.setItem('importedContacts', JSON.stringify(contacts));
      console.log('💾 Контакты сохранены локально');
    } catch (error) {
      console.error('❌ Ошибка сохранения контактов:', error);
    }
  }

  /**
   * Загрузка контактов из локального хранилища
   */
  static async loadContactsFromLocal() {
    try {
      const contactsJson = await AsyncStorage.getItem('importedContacts');
      if (contactsJson) {
        const contacts = JSON.parse(contactsJson);
        console.log(`📱 Загружено ${contacts.length} контактов из локального хранилища`);
        return contacts;
      }
      return [];
    } catch (error) {
      console.error('❌ Ошибка загрузки контактов:', error);
      return [];
    }
  }

  /**
   * Поиск контактов
   */
  static async searchContacts(query) {
    try {
      const contacts = await this.loadContactsFromLocal();
      const lowercaseQuery = query.toLowerCase();
      
      return contacts.filter(contact => 
        contact.name.toLowerCase().includes(lowercaseQuery) ||
        contact.phoneNumber.includes(query)
      );
    } catch (error) {
      console.error('❌ Ошибка поиска контактов:', error);
      return [];
    }
  }

  /**
   * Форматирование номера для отображения
   */
  static formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';

    if (phoneNumber.startsWith('+7')) {
      const number = phoneNumber.substring(2);
      if (number.length === 10) {
        return `+7 (${number.substring(0, 3)}) ${number.substring(3, 6)}-${number.substring(6, 8)}-${number.substring(8)}`;
      }
    }

    return phoneNumber;
  }
}import * as Contacts from 'expo-contacts';
import { Alert } from 'react-native';

export class ContactsService {
  static async requestPermission() {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting contacts permission:', error);
      return false;
    }
  }

  static async importContacts() {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        Alert.alert(
          'Разрешение не предоставлено',
          'Для синхронизации контактов необходимо разрешение на доступ к контактам'
        );
        return [];
      }

      // Реальный импорт контактов из устройства
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Image,
        ],
      });

      const processedContacts = this.processContacts(data);
      
      // Сохраняем контакты локально
      await this.saveContactsToLocal(processedContacts);
      
      // Синхронизируем с сервером для поиска зарегистрированных пользователей
      const syncedContacts = await this.syncWithServer(processedContacts);
      
      return syncedContacts;
    } catch (error) {
      console.error('Error importing contacts:', error);
      throw new Error('Failed to import contacts');
    }
  }

  static processContacts(rawContacts) {
    const processedContacts = [];

    rawContacts.forEach(contact => {
      if (!contact.phoneNumbers || contact.phoneNumbers.length === 0) {
        return; // Пропускаем контакты без номеров
      }

      contact.phoneNumbers.forEach(phoneNumber => {
        const cleanNumber = this.cleanPhoneNumber(phoneNumber.number);
        if (cleanNumber) {
          processedContacts.push({
            id: `${contact.id}_${phoneNumber.id}`,
            name: contact.name || 'Без имени',
            phoneNumber: cleanNumber,
            originalNumber: phoneNumber.number,
            imageUri: contact.imageAvailable ? contact.image?.uri : null,
            contactId: contact.id,
          });
        }
      });
    });

    // Удаляем дубликаты по номеру телефона
    const uniqueContacts = this.removeDuplicateNumbers(processedContacts);
    
    // Сортируем по имени
    return uniqueContacts.sort((a, b) => 
      a.name.localeCompare(b.name, 'ru', { sensitivity: 'base' })
    );
  }

  static cleanPhoneNumber(phoneNumber) {
    if (!phoneNumber) return null;

    // Удаляем все символы кроме цифр и +
    let cleaned = phoneNumber.replace(/[^\d+]/g, '');

    // Удаляем пробелы и специальные символы
    cleaned = cleaned.replace(/\s/g, '');

    // Приводим к международному формату
    if (cleaned.startsWith('8')) {
      cleaned = '+7' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') && cleaned.length === 11) {
      cleaned = '+' + cleaned;
    } else if (cleaned.startsWith('9') && cleaned.length === 10) {
      cleaned = '+7' + cleaned;
    } else if (!cleaned.startsWith('+')) {
      // Если номер не начинается с +, предполагаем российский номер
      if (cleaned.length === 10) {
        cleaned = '+7' + cleaned;
      } else if (cleaned.length === 11 && cleaned.startsWith('7')) {
        cleaned = '+' + cleaned;
      }
    }

    // Валидация: номер должен быть валидным международным номером
    if (this.isValidPhoneNumber(cleaned)) {
      return cleaned;
    }

    return null;
  }

  static isValidPhoneNumber(phoneNumber) {
    // Простая валидация международного номера
    const phoneRegex = /^\+\d{7,15}$/;
    return phoneRegex.test(phoneNumber);
  }

  static removeDuplicateNumbers(contacts) {
    const seen = new Map();
    const result = [];

    contacts.forEach(contact => {
      const key = contact.phoneNumber;
      if (!seen.has(key)) {
        seen.set(key, true);
        result.push(contact);
      }
    });

    return result;
  }

  static async syncWithServer(contacts) {
    try {
      const { collection, query, where, getDocs } = await import('firebase/firestore');
      const { db } = await import('../firebase.config');
      
      // Получаем номера телефонов для поиска
      const phoneNumbers = contacts.map(contact => contact.phoneNumber);
      
      // Ищем зарегистрированных пользователей в Firebase
      const usersRef = collection(db, 'users');
      const registeredUsers = [];
      
      // Firebase не поддерживает IN запросы с более чем 10 элементами
      // Разбиваем на chunk'и по 10
      const chunks = [];
      for (let i = 0; i < phoneNumbers.length; i += 10) {
        chunks.push(phoneNumbers.slice(i, i + 10));
      }
      
      for (const chunk of chunks) {
        const q = query(usersRef, where('phoneNumber', 'in', chunk));
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach((doc) => {
          registeredUsers.push({
            userId: doc.id,
            ...doc.data()
          });
        });
      }

      // Сопоставляем контакты с зарегистрированными пользователями
      const syncedContacts = contacts.map(contact => {
        const registeredUser = registeredUsers.find(
          user => user.phoneNumber === contact.phoneNumber
        );

        return {
          ...contact,
          isRegistered: !!registeredUser,
          userId: registeredUser?.userId || null,
          serverName: registeredUser?.name || null,
          avatarUrl: registeredUser?.avatarUrl || null,
          description: registeredUser?.description || null,
          interests: registeredUser?.interests || [],
        };
      });

      return syncedContacts;
    } catch (error) {
      console.error('Error syncing contacts with server:', error);
      // Возвращаем контакты без синхронизации в случае ошибки
      return contacts.map(contact => ({
        ...contact,
        isRegistered: false,
        userId: null,
        serverName: null,
        avatarUrl: null,
      }));
    }
  }

  static async findUsersByPhoneNumbers(phoneNumbers) {
    try {
      // В реальном приложении здесь будет запрос к Firebase
      // для поиска пользователей по номерам телефонов
      
      const demoUsers = [
        {
          phoneNumber: '+79123456789',
          userId: 'user1',
          name: 'Анна Петрова',
          avatarUrl: null,
          description: 'Люблю путешествовать',
          interests: ['Путешествия', 'Фотография'],
          isOnline: true,
        },
        {
          phoneNumber: '+79987654321',
          userId: 'user2',
          name: 'Михаил Сидоров',
          avatarUrl: null,
          description: 'Разработчик',
          interests: ['Технологии', 'Игры'],
          isOnline: false,
        },
      ];

      return demoUsers.filter(user => 
        phoneNumbers.includes(user.phoneNumber)
      );
    } catch (error) {
      console.error('Error finding users by phone numbers:', error);
      throw new Error('Failed to find users');
    }
  }

  static formatPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';

    // Форматируем номер для отображения
    if (phoneNumber.startsWith('+7')) {
      const number = phoneNumber.substring(2);
      if (number.length === 10) {
        return `+7 (${number.substring(0, 3)}) ${number.substring(3, 6)}-${number.substring(6, 8)}-${number.substring(8)}`;
      }
    }

    return phoneNumber;
  }

  static async saveContactsToLocal(contacts) {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      await AsyncStorage.setItem('importedContacts', JSON.stringify(contacts));
    } catch (error) {
      console.error('Error saving contacts to local storage:', error);
    }
  }

  static async loadContactsFromLocal() {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const contactsJson = await AsyncStorage.getItem('importedContacts');
      if (contactsJson) {
        return JSON.parse(contactsJson);
      }
      return [];
    } catch (error) {
      console.error('Error loading contacts from local storage:', error);
      return [];
    }
  }

  static async addContact(contact) {
    try {
      const contacts = await this.loadContactsFromLocal();
      const updatedContacts = [...contacts, contact];
      await this.saveContactsToLocal(updatedContacts);
      return updatedContacts;
    } catch (error) {
      console.error('Error adding contact:', error);
      throw new Error('Failed to add contact');
    }
  }

  static async removeContact(contactId) {
    try {
      const contacts = await this.loadContactsFromLocal();
      const updatedContacts = contacts.filter(c => c.id !== contactId);
      await this.saveContactsToLocal(updatedContacts);
      return updatedContacts;
    } catch (error) {
      console.error('Error removing contact:', error);
      throw new Error('Failed to remove contact');
    }
  }

  static async searchContacts(query) {
    try {
      const contacts = await this.loadContactsFromLocal();
      const lowercaseQuery = query.toLowerCase();
      
      return contacts.filter(contact => 
        contact.name.toLowerCase().includes(lowercaseQuery) ||
        contact.phoneNumber.includes(query)
      );
    } catch (error) {
      console.error('Error searching contacts:', error);
      return [];
    }
  }
}
