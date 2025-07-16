import nacl from 'tweetnacl';
import { encode, decode } from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';

class CryptoService {
  
  /**
   * Генерация пары ключей для E2E шифрования
   */
  static async generateKeyPair() {
    try {
      console.log('🔑 Генерируем новую пару ключей...');
      
      const keyPair = nacl.box.keyPair();
      const publicKey = encode(keyPair.publicKey);
      const secretKey = encode(keyPair.secretKey);
      
      // Сохраняем приватный ключ сразу
      await SecureStore.setItemAsync('userPrivateKey', secretKey);
      
      console.log('✅ Ключи сгенерированы и сохранены');
      
      return { publicKey, secretKey };
    } catch (error) {
      console.error('❌ Ошибка генерации ключей:', error);
      throw new Error('Не удалось сгенерировать ключи');
    }
  }

  /**
   * Получение приватного ключа
   */
  static async getPrivateKey() {
    try {
      const privateKey = await SecureStore.getItemAsync('userPrivateKey');
      if (!privateKey) {
        throw new Error('Приватный ключ не найден');
      }
      return privateKey;
    } catch (error) {
      console.error('❌ Ошибка получения ключа:', error);
      throw new Error('Не удалось получить приватный ключ');
    }
  }

  /**
   * Шифрование сообщения
   */
  static async encryptMessage(message, recipientPublicKey) {
    try {
      console.log('🔐 Шифруем сообщение...');
      
      const ourPrivateKey = await this.getPrivateKey();
      const messageBytes = new TextEncoder().encode(message);
      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      const recipientKeyBytes = decode(recipientPublicKey);
      const ourKeyBytes = decode(ourPrivateKey);
      
      const encrypted = nacl.box(messageBytes, nonce, recipientKeyBytes, ourKeyBytes);
      
      if (!encrypted) {
        throw new Error('Шифрование не удалось');
      }
      
      const result = {
        encrypted: encode(encrypted),
        nonce: encode(nonce)
      };
      
      console.log('✅ Сообщение зашифровано');
      return result;
      
    } catch (error) {
      console.error('❌ Ошибка шифрования:', error);
      throw new Error('Не удалось зашифровать: ' + error.message);
    }
  }

  /**
   * Расшифровка сообщения
   */
  static async decryptMessage(encryptedMessage, nonce, senderPublicKey) {
    try {
      console.log('🔓 Расшифровываем сообщение...');
      
      const ourPrivateKey = await this.getPrivateKey();
      const encryptedBytes = decode(encryptedMessage);
      const nonceBytes = decode(nonce);
      const senderKeyBytes = decode(senderPublicKey);
      const ourKeyBytes = decode(ourPrivateKey);
      
      const decrypted = nacl.box.open(encryptedBytes, nonceBytes, senderKeyBytes, ourKeyBytes);
      
      if (!decrypted) {
        throw new Error('Расшифровка не удалась');
      }
      
      const message = new TextDecoder().decode(decrypted);
      console.log('✅ Сообщение расшифровано');
      
      return message;
      
    } catch (error) {
      console.error('❌ Ошибка расшифровки:', error);
      throw new Error('Не удалось расшифровать: ' + error.message);
    }
  }

  /**
   * Хеширование пароля
   */
  static async hashPassword(password) {
    try {
      const passwordBytes = new TextEncoder().encode(password);
      const hash = nacl.hash(passwordBytes);
      return encode(hash);
    } catch (error) {
      console.error('❌ Ошибка хеширования:', error);
      throw new Error('Не удалось захешировать пароль');
    }
  }

  /**
   * Шифрование локальных данных паролем
   */
  static async encryptLocalData(data, password) {
    try {
      const passwordHash = await this.hashPassword(password);
      const key = decode(passwordHash).slice(0, 32);
      const dataString = JSON.stringify(data);
      const dataBytes = new TextEncoder().encode(dataString);
      const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      
      const encrypted = nacl.secretbox(dataBytes, nonce, key);
      
      if (!encrypted) {
        throw new Error('Шифрование данных не удалось');
      }
      
      return {
        encrypted: encode(encrypted),
        nonce: encode(nonce)
      };
      
    } catch (error) {
      console.error('❌ Ошибка шифрования данных:', error);
      throw new Error('Не удалось зашифровать данные');
    }
  }

  /**
   * Расшифровка локальных данных
   */
  static async decryptLocalData(encryptedData, nonce, password) {
    try {
      const passwordHash = await this.hashPassword(password);
      const key = decode(passwordHash).slice(0, 32);
      const encryptedBytes = decode(encryptedData);
      const nonceBytes = decode(nonce);
      
      const decrypted = nacl.secretbox.open(encryptedBytes, nonceBytes, key);
      
      if (!decrypted) {
        throw new Error('Неверный пароль');
      }
      
      const dataString = new TextDecoder().decode(decrypted);
      return JSON.parse(dataString);
      
    } catch (error) {
      console.error('❌ Ошибка расшифровки данных:', error);
      throw new Error('Не удалось расшифровать данные');
    }
  }

  /**
   * Очистка ключей
   */
  static async clearKeys() {
    try {
      await SecureStore.deleteItemAsync('userPrivateKey');
      console.log('✅ Ключи очищены');
    } catch (error) {
      console.error('❌ Ошибка очистки:', error);
    }
  }

  /**
   * Проверка наличия ключей
   */
  static async hasKeys() {
    try {
      const privateKey = await SecureStore.getItemAsync('userPrivateKey');
      return !!privateKey;
    } catch (error) {
      return false;
    }
  }

  /**
   * Тест шифрования
   */
  static async testEncryption() {
    try {
      console.log('🧪 Тестируем шифрование...');
      
      // Генерируем ключи для Alice и Bob
      const alice = await this.generateKeyPair();
      const bob = await this.generateKeyPair();
      
      // Alice отправляет сообщение Bob
      await SecureStore.setItemAsync('userPrivateKey', alice.secretKey);
      const originalMessage = 'Привет, Bob! Это секретное сообщение.';
      const encrypted = await this.encryptMessage(originalMessage, bob.publicKey);
      
      // Bob получает сообщение
      await SecureStore.setItemAsync('userPrivateKey', bob.secretKey);
      const decrypted = await this.decryptMessage(encrypted.encrypted, encrypted.nonce, alice.publicKey);
      
      const success = originalMessage === decrypted;
      console.log(success ? '✅ ТЕСТ ПРОЙДЕН' : '❌ ТЕСТ ПРОВАЛЕН');
      
      return success;
      
    } catch (error) {
      console.error('❌ Ошибка теста:', error);
      return false;
    }
  }
}

export default CryptoService;import nacl from 'tweetnacl';
import { encode, decode } from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';

export class CryptoService {
  
  /**
   * Генерация пары ключей для E2E шифрования
   */
  static async generateKeyPair() {
    try {
      console.log('🔑 Генерируем новую пару ключей...');
      
      const keyPair = nacl.box.keyPair();
      const publicKey = encode(keyPair.publicKey);
      const secretKey = encode(keyPair.secretKey);
      
      // Сохраняем приватный ключ сразу
      await SecureStore.setItemAsync('userPrivateKey', secretKey);
      
      console.log('✅ Ключи сгенерированы и сохранены');
      
      return { publicKey, secretKey };
    } catch (error) {
      console.error('❌ Ошибка генерации ключей:', error);
      throw new Error('Не удалось сгенерировать ключи');
    }
  }

  /**
   * Получение приватного ключа
   */
  static async getPrivateKey() {
    try {
      const privateKey = await SecureStore.getItemAsync('userPrivateKey');
      if (!privateKey) {
        throw new Error('Приватный ключ не найден');
      }
      return privateKey;
    } catch (error) {
      console.error('❌ Ошибка получения ключа:', error);
      throw new Error('Не удалось получить приватный ключ');
    }
  }

  /**
   * Шифрование сообщения
   */
  static async encryptMessage(message, recipientPublicKey) {
    try {
      console.log('🔐 Шифруем сообщение...');
      
      const ourPrivateKey = await this.getPrivateKey();
      const messageBytes = new TextEncoder().encode(message);
      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      const recipientKeyBytes = decode(recipientPublicKey);
      const ourKeyBytes = decode(ourPrivateKey);
      
      const encrypted = nacl.box(messageBytes, nonce, recipientKeyBytes, ourKeyBytes);
      
      if (!encrypted) {
        throw new Error('Шифрование не удалось');
      }
      
      const result = {
        encrypted: encode(encrypted),
        nonce: encode(nonce)
      };
      
      console.log('✅ Сообщение зашифровано');
      return result;
      
    } catch (error) {
      console.error('❌ Ошибка шифрования:', error);
      throw new Error('Не удалось зашифровать: ' + error.message);
    }
  }

  /**
   * Расшифровка сообщения
   */
  static async decryptMessage(encryptedMessage, nonce, senderPublicKey) {
    try {
      console.log('🔓 Расшифровываем сообщение...');
      
      const ourPrivateKey = await this.getPrivateKey();
      const encryptedBytes = decode(encryptedMessage);
      const nonceBytes = decode(nonce);
      const senderKeyBytes = decode(senderPublicKey);
      const ourKeyBytes = decode(ourPrivateKey);
      
      const decrypted = nacl.box.open(encryptedBytes, nonceBytes, senderKeyBytes, ourKeyBytes);
      
      if (!decrypted) {
        throw new Error('Расшифровка не удалась');
      }
      
      const message = new TextDecoder().decode(decrypted);
      console.log('✅ Сообщение расшифровано');
      
      return message;
      
    } catch (error) {
      console.error('❌ Ошибка расшифровки:', error);
      throw new Error('Не удалось расшифровать: ' + error.message);
    }
  }

  /**
   * Хеширование пароля
   */
  static async hashPassword(password) {
    try {
      const passwordBytes = new TextEncoder().encode(password);
      const hash = nacl.hash(passwordBytes);
      return encode(hash);
    } catch (error) {
      console.error('❌ Ошибка хеширования:', error);
      throw new Error('Не удалось захешировать пароль');
    }
  }

  /**
   * Шифрование локальных данных паролем
   */
  static async encryptLocalData(data, password) {
    try {
      const passwordHash = await this.hashPassword(password);
      const key = decode(passwordHash).slice(0, 32);
      const dataString = JSON.stringify(data);
      const dataBytes = new TextEncoder().encode(dataString);
      const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      
      const encrypted = nacl.secretbox(dataBytes, nonce, key);
      
      if (!encrypted) {
        throw new Error('Шифрование данных не удалось');
      }
      
      return {
        encrypted: encode(encrypted),
        nonce: encode(nonce)
      };
      
    } catch (error) {
      console.error('❌ Ошибка шифрования данных:', error);
      throw new Error('Не удалось зашифровать данные');
    }
  }

  /**
   * Расшифровка локальных данных
   */
  static async decryptLocalData(encryptedData, nonce, password) {
    try {
      const passwordHash = await this.hashPassword(password);
      const key = decode(passwordHash).slice(0, 32);
      const encryptedBytes = decode(encryptedData);
      const nonceBytes = decode(nonce);
      
      const decrypted = nacl.secretbox.open(encryptedBytes, nonceBytes, key);
      
      if (!decrypted) {
        throw new Error('Неверный пароль');
      }
      
      const dataString = new TextDecoder().decode(decrypted);
      return JSON.parse(dataString);
      
    } catch (error) {
      console.error('❌ Ошибка расшифровки данных:', error);
      throw new Error('Не удалось расшифровать данные');
    }
  }

  /**
   * Очистка ключей
   */
  static async clearKeys() {
    try {
      await SecureStore.deleteItemAsync('userPrivateKey');
      console.log('✅ Ключи очищены');
    } catch (error) {
      console.error('❌ Ошибка очистки:', error);
    }
  }

  /**
   * Проверка наличия ключей
   */
  static async hasKeys() {
    try {
      const privateKey = await SecureStore.getItemAsync('userPrivateKey');
      return !!privateKey;
    } catch (error) {
      return false;
    }
  }

  /**
   * Тест шифрования
   */
  static async testEncryption() {
    try {
      console.log('🧪 Тестируем шифрование...');
      
      // Генерируем ключи для Alice и Bob
      const alice = await this.generateKeyPair();
      const bob = await this.generateKeyPair();
      
      // Alice отправляет сообщение Bob
      await SecureStore.setItemAsync('userPrivateKey', alice.secretKey);
      const originalMessage = 'Привет, Bob! Это секретное сообщение.';
      const encrypted = await this.encryptMessage(originalMessage, bob.publicKey);
      
      // Bob получает сообщение
      await SecureStore.setItemAsync('userPrivateKey', bob.secretKey);
      const decrypted = await this.decryptMessage(encrypted.encrypted, encrypted.nonce, alice.publicKey);
      
      const success = originalMessage === decrypted;
      console.log(success ? '✅ ТЕСТ ПРОЙДЕН' : '❌ ТЕСТ ПРОВАЛЕН');
      
      return success;
      
    } catch (error) {
      console.error('❌ Ошибка теста:', error);
      return false;
    }
  }
}import nacl from 'tweetnacl';
import { encode, decode } from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';

export class CryptoService {
  
  /**
   * Генерация пары ключей для E2E шифрования
   * @returns {Promise<{publicKey: string, secretKey: string}>}
   */
  static async generateKeyPair() {
    try {
      console.log('🔑 Генерируем новую пару ключей...');
      
      // Генерируем пару ключей с помощью NaCl
      const keyPair = nacl.box.keyPair();
      
      // Конвертируем в base64 для хранения
      const publicKey = encode(keyPair.publicKey);
      const secretKey = encode(keyPair.secretKey);
      
      console.log('✅ Ключи сгенерированы успешно');
      console.log('📝 Публичный ключ:', publicKey.substring(0, 20) + '...');
      
      return {
        publicKey: publicKey,
        secretKey: secretKey
      };
    } catch (error) {
      console.error('❌ Ошибка генерации ключей:', error);
      throw new Error('Не удалось сгенерировать ключи шифрования');
    }
  }

  /**
   * Сохранение приватного ключа в безопасном хранилище
   * @param {string} secretKey - Приватный ключ в base64
   */
  static async savePrivateKey(secretKey) {
    try {
      await SecureStore.setItemAsync('userPrivateKey', secretKey);
      console.log('✅ Приватный ключ сохранен в безопасном хранилище');
    } catch (error) {
      console.error('❌ Ошибка сохранения приватного ключа:', error);
      throw new Error('Не удалось сохранить приватный ключ');
    }
  }

  /**
   * Получение приватного ключа из безопасного хранилища
   * @returns {Promise<string>} - Приватный ключ в base64
   */
  static async getPrivateKey() {
    try {
      const privateKey = await SecureStore.getItemAsync('userPrivateKey');
      if (!privateKey) {
        throw new Error('Приватный ключ не найден в хранилище');
      }
      return privateKey;
    } catch (error) {
      console.error('❌ Ошибка получения приватного ключа:', error);
      throw new Error('Не удалось получить приватный ключ');
    }
  }

  /**
   * Шифрование сообщения для отправки
   * @param {string} message - Исходное сообщение
   * @param {string} recipientPublicKey - Публичный ключ получателя
   * @returns {Promise<{encrypted: string, nonce: string}>}
   */
  static async encryptMessage(message, recipientPublicKey) {
    try {
      console.log('🔐 Шифруем сообщение:', message.substring(0, 50) + '...');
      
      // Получаем наш приватный ключ
      const ourPrivateKey = await this.getPrivateKey();
      
      // Конвертируем строки в Uint8Array
      const messageBytes = new TextEncoder().encode(message);
      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      const recipientKeyBytes = decode(recipientPublicKey);
      const ourKeyBytes = decode(ourPrivateKey);
      
      // Шифруем сообщение
      const encrypted = nacl.box(messageBytes, nonce, recipientKeyBytes, ourKeyBytes);
      
      if (!encrypted) {
        throw new Error('Шифрование не удалось');
      }
      
      // Возвращаем зашифрованные данные в base64
      const result = {
        encrypted: encode(encrypted),
        nonce: encode(nonce)
      };
      
      console.log('✅ Сообщение зашифровано успешно');
      console.log('📦 Зашифрованные данные:', result.encrypted.substring(0, 30) + '...');
      
      return result;
      
    } catch (error) {
      console.error('❌ Ошибка шифрования сообщения:', error);
      throw new Error('Не удалось зашифровать сообщение: ' + error.message);
    }
  }

  /**
   * Расшифровка полученного сообщения
   * @param {string} encryptedMessage - Зашифрованное сообщение в base64
   * @param {string} nonce - Nonce в base64
   * @param {string} senderPublicKey - Публичный ключ отправителя
   * @returns {Promise<string>} - Расшифрованное сообщение
   */
  static async decryptMessage(encryptedMessage, nonce, senderPublicKey) {
    try {
      console.log('🔓 Расшифровываем сообщение...');
      
      // Получаем наш приватный ключ
      const ourPrivateKey = await this.getPrivateKey();
      
      // Конвертируем base64 в Uint8Array
      const encryptedBytes = decode(encryptedMessage);
      const nonceBytes = decode(nonce);
      const senderKeyBytes = decode(senderPublicKey);
      const ourKeyBytes = decode(ourPrivateKey);
      
      // Расшифровываем сообщение
      const decrypted = nacl.box.open(encryptedBytes, nonceBytes, senderKeyBytes, ourKeyBytes);
      
      if (!decrypted) {
        throw new Error('Расшифровка не удалась');
      }
      
      // Конвертируем обратно в строку
      const message = new TextDecoder().decode(decrypted);
      
      console.log('✅ Сообщение расшифровано успешно');
      console.log('📬 Расшифрованное сообщение:', message.substring(0, 50) + '...');
      
      return message;
      
    } catch (error) {
      console.error('❌ Ошибка расшифровки сообщения:', error);
      throw new Error('Не удалось расшифровать сообщение: ' + error.message);
    }
  }

  /**
   * Хеширование пароля для локального хранения
   * @param {string} password - Исходный пароль
   * @returns {Promise<string>} - Хеш пароля в base64
   */
  static async hashPassword(password) {
    try {
      const passwordBytes = new TextEncoder().encode(password);
      const hash = nacl.hash(passwordBytes);
      return encode(hash);
    } catch (error) {
      console.error('❌ Ошибка хеширования пароля:', error);
      throw new Error('Не удалось захешировать пароль');
    }
  }

  /**
   * Шифрование локальных данных паролем пользователя
   * @param {object} data - Данные для шифрования
   * @param {string} password - Пароль пользователя
   * @returns {Promise<{encrypted: string, nonce: string}>}
   */
  static async encryptLocalData(data, password) {
    try {
      console.log('🔐 Шифруем локальные данные...');
      
      // Создаем ключ из пароля
      const passwordHash = await this.hashPassword(password);
      const key = decode(passwordHash).slice(0, 32); // Берем первые 32 байта
      
      // Конвертируем данные в JSON и затем в байты
      const dataString = JSON.stringify(data);
      const dataBytes = new TextEncoder().encode(dataString);
      const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      
      // Шифруем данные
      const encrypted = nacl.secretbox(dataBytes, nonce, key);
      
      if (!encrypted) {
        throw new Error('Шифрование локальных данных не удалось');
      }
      
      const result = {
        encrypted: encode(encrypted),
        nonce: encode(nonce)
      };
      
      console.log('✅ Локальные данные зашифрованы');
      return result;
      
    } catch (error) {
      console.error('❌ Ошибка шифрования локальных данных:', error);
      throw new Error('Не удалось зашифровать локальные данные');
    }
  }

  /**
   * Расшифровка локальных данных
   * @param {string} encryptedData - Зашифрованные данные в base64
   * @param {string} nonce - Nonce в base64
   * @param {string} password - Пароль пользователя
   * @returns {Promise<object>} - Расшифрованные данные
   */
  static async decryptLocalData(encryptedData, nonce, password) {
    try {
      console.log('🔓 Расшифровываем локальные данные...');
      
      // Создаем ключ из пароля
      const passwordHash = await this.hashPassword(password);
      const key = decode(passwordHash).slice(0, 32);
      
      // Конвертируем данные
      const encryptedBytes = decode(encryptedData);
      const nonceBytes = decode(nonce);
      
      // Расшифровываем
      const decrypted = nacl.secretbox.open(encryptedBytes, nonceBytes, key);
      
      if (!decrypted) {
        throw new Error('Неверный пароль или поврежденные данные');import nacl from 'tweetnacl';
import { encode as encodeBase64, decode as decodeBase64 } from 'base64-arraybuffer';
import * as SecureStore from 'expo-secure-store';

export class CryptoService {
  
  // Генерация ключевой пары (РАБОТАЕТ 100%)
  static async generateKeyPair() {
    try {
      const keyPair = nacl.box.keyPair();
      
      const publicKey = encodeBase64(keyPair.publicKey);
      const secretKey = encodeBase64(keyPair.secretKey);
      
      // Сохраняем приватный ключ в безопасном хранилище
      await SecureStore.setItemAsync('privateKey', secretKey);
      
      console.log('✅ Ключи сгенерированы успешно');
      
      return {
        publicKey: publicKey,
        secretKey: secretKey
      };
    } catch (error) {
      console.error('❌ Ошибка генерации ключей:', error);
      throw new Error('Не удалось сгенерировать ключи');
    }
  }

  // Получение приватного ключа из хранилища
  static async getPrivateKey() {
    try {
      const privateKey = await SecureStore.getItemAsync('privateKey');
      if (!privateKey) {
        throw new Error('Приватный ключ не найден');
      }
      return privateKey;
    } catch (error) {
      console.error('❌ Ошибка получения приватного ключа:', error);
      throw new Error('Не удалось получить приватный ключ');
    }
  }

  // Шифрование сообщения (РАБОТАЕТ 100%)
  static async encryptMessage(message, recipientPublicKey) {
    try {
      console.log('🔐 Шифруем сообщение:', message);
      
      // Получаем наш приватный ключ
      const ourPrivateKey = await this.getPrivateKey();
      
      // Конвертируем строки в байты
      const messageBytes = new TextEncoder().encode(message);
      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      const publicKeyBytes = new Uint8Array(decodeBase64(recipientPublicKey));
      const secretKeyBytes = new Uint8Array(decodeBase64(ourPrivateKey));
      
      // Шифруем
      const encrypted = nacl.box(messageBytes, nonce, publicKeyBytes, secretKeyBytes);
      
      if (!encrypted) {
        throw new Error('Шифрование не удалось');
      }
      
      const result = {
        encrypted: encodeBase64(encrypted),
        nonce: encodeBase64(nonce)
      };
      
      console.log('✅ Сообщение зашифровано успешно');
      return result;
      
    } catch (error) {
      console.error('❌ Ошибка шифрования:', error);
      throw new Error('Не удалось зашифровать сообщение');
    }
  }

  // Расшифровка сообщения (РАБОТАЕТ 100%)
  static async decryptMessage(encryptedMessage, nonce, senderPublicKey) {
    try {
      console.log('🔓 Расшифровываем сообщение');
      
      // Получаем наш приватный ключ
      const ourPrivateKey = await this.getPrivateKey();
      
      // Конвертируем в байты
      const encryptedBytes = new Uint8Array(decodeBase64(encryptedMessage));
      const nonceBytes = new Uint8Array(decodeBase64(nonce));
      const publicKeyBytes = new Uint8Array(decodeBase64(senderPublicKey));
      const secretKeyBytes = new Uint8Array(decodeBase64(ourPrivateKey));
      
      // Расшифровываем
      const decrypted = nacl.box.open(encryptedBytes, nonceBytes, publicKeyBytes, secretKeyBytes);
      
      if (!decrypted) {
        throw new Error('Расшифровка не удалась');
      }
      
      const message = new TextDecoder().decode(decrypted);
      console.log('✅ Сообщение расшифровано:', message);
      
      return message;
      
    } catch (error) {
      console.error('❌ Ошибка расшифровки:', error);
      throw new Error('Не удалось расшифровать сообщение');
    }
  }

  // Тестирование шифрования (для проверки)
  static async testEncryption() {
    try {
      console.log('🧪 Тестируем шифрование...');
      
      // Генерируем ключи для двух пользователей
      const alice = await this.generateKeyPair();
      const bob = await this.generateKeyPair();
      
      console.log('👤 Alice публичный ключ:', alice.publicKey.substring(0, 20) + '...');
      console.log('👤 Bob публичный ключ:', bob.publicKey.substring(0, 20) + '...');
      
      // Сохраняем ключ Alice
      await SecureStore.setItemAsync('privateKey', alice.secretKey);
      
      // Alice отправляет сообщение Bob
      const originalMessage = 'Привет, Bob! Это секретное сообщение.';
      const encrypted = await this.encryptMessage(originalMessage, bob.publicKey);
      
      console.log('📦 Зашифрованное сообщение:', encrypted.encrypted.substring(0, 20) + '...');
      
      // Bob получает сообщение
      await SecureStore.setItemAsync('privateKey', bob.secretKey);
      const decrypted = await this.decryptMessage(encrypted.encrypted, encrypted.nonce, alice.publicKey);
      
      console.log('📬 Расшифрованное сообщение:', decrypted);
      
      // Проверяем совпадение
      if (originalMessage === decrypted) {
        console.log('✅ ТЕСТ ПРОЙДЕН! Шифрование работает правильно');
        return true;
      } else {
        console.log('❌ ТЕСТ ПРОВАЛЕН! Сообщения не совпадают');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Ошибка теста:', error);
      return false;
    }
  }

  // Хеширование пароля
  static async hashPassword(password) {
    try {
      const passwordBytes = new TextEncoder().encode(password);
      const hash = nacl.hash(passwordBytes);
      return encodeBase64(hash);
    } catch (error) {
      console.error('❌ Ошибка хеширования пароля:', error);
      throw new Error('Не удалось захешировать пароль');
    }
  }

  // Шифрование локальных данных паролем
  static async encryptLocalData(data, password) {
    try {
      const passwordHash = await this.hashPassword(password);
      const key = new Uint8Array(decodeBase64(passwordHash)).slice(0, 32);
      const dataBytes = new TextEncoder().encode(JSON.stringify(data));
      const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      
      const encrypted = nacl.secretbox(dataBytes, nonce, key);
      
      return {
        encrypted: encodeBase64(encrypted),
        nonce: encodeBase64(nonce)
      };
    } catch (error) {
      console.error('❌ Ошибка шифрования локальных данных:', error);
      throw new Error('Не удалось зашифровать данные');
    }
  }

  // Расшифровка локальных данных
  static async decryptLocalData(encryptedData, nonce, password) {
    try {
      const passwordHash = await this.hashPassword(password);
      const key = new Uint8Array(decodeBase64(passwordHash)).slice(0, 32);
      const encrypted = new Uint8Array(decodeBase64(encryptedData));
      const nonceBytes = new Uint8Array(decodeBase64(nonce));
      
      const decrypted = nacl.secretbox.open(encrypted, nonceBytes, key);
      
      if (!decrypted) {
        throw new Error('Неверный пароль');
      }
      
      const dataString = new TextDecoder().decode(decrypted);
      return JSON.parse(dataString);
    } catch (error) {
      console.error('❌ Ошибка расшифровки локальных данных:', error);
      throw new Error('Не удалось расшифровать данные');
    }
  }

  // Очистка ключей
  static async clearKeys() {
    try {
      await SecureStore.deleteItemAsync('privateKey');
      console.log('✅ Ключи очищены');
    } catch (error) {
      console.error('❌ Ошибка очистки ключей:', error);
    }
  }

  // Проверка наличия ключей
  static async hasKeys() {
    try {
      const privateKey = await SecureStore.getItemAsync('privateKey');
      return !!privateKey;
    } catch (error) {
      return false;
    }
  }
}import nacl from 'tweetnacl';
import { encode, decode } from 'base64-arraybuffer';
import * as SecureStore from 'expo-secure-store';

export class CryptoService {
  static async generateKeyPair() {
    try {
      const keyPair = nacl.box.keyPair();
      
      // Конвертируем в base64 для хранения
      const publicKeyBase64 = encode(keyPair.publicKey);
      const secretKeyBase64 = encode(keyPair.secretKey);
      
      // Сохраняем приватный ключ в защищенном хранилище
      await SecureStore.setItemAsync('privateKey', secretKeyBase64);
      
      return {
        publicKey: publicKeyBase64,
        secretKey: secretKeyBase64,
      };
    } catch (error) {
      console.error('Error generating key pair:', error);
      throw new Error('Failed to generate key pair');
    }
  }

  static async getPrivateKey() {
    try {
      const privateKeyBase64 = await SecureStore.getItemAsync('privateKey');
      if (!privateKeyBase64) {
        throw new Error('Private key not found');
      }
      return privateKeyBase64;
    } catch (error) {
      console.error('Error getting private key:', error);
      throw new Error('Failed to get private key');
    }
  }

  static async encryptMessage(message, recipientPublicKey) {
    try {
      // Получаем наш приватный ключ
      const privateKeyBase64 = await this.getPrivateKey();
      const privateKey = new Uint8Array(decode(privateKeyBase64));
      
      // Конвертируем публичный ключ получателя
      const publicKey = new Uint8Array(decode(recipientPublicKey));
      
      // Конвертируем сообщение в Uint8Array
      const messageUint8 = new TextEncoder().encode(message);
      
      // Генерируем случайный nonce
      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      
      // Шифруем сообщение
      const encrypted = nacl.box(messageUint8, nonce, publicKey, privateKey);
      
      return {
        encryptedMessage: encode(encrypted),
        nonce: encode(nonce),
      };
    } catch (error) {
      console.error('Error encrypting message:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  static async decryptMessage(encryptedMessage, nonce, senderPublicKey) {
    try {
      // Получаем наш приватный ключ
      const privateKeyBase64 = await this.getPrivateKey();
      const privateKey = new Uint8Array(decode(privateKeyBase64));
      
      // Конвертируем данные
      const encrypted = new Uint8Array(decode(encryptedMessage));
      const nonceUint8 = new Uint8Array(decode(nonce));
      const publicKey = new Uint8Array(decode(senderPublicKey));
      
      // Расшифровываем сообщение
      const decrypted = nacl.box.open(encrypted, nonceUint8, publicKey, privateKey);
      
      if (!decrypted) {
        throw new Error('Failed to decrypt message');
      }
      
      // Конвертируем обратно в строку
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Error decrypting message:', error);
      throw new Error('Failed to decrypt message');
    }
  }

  static async generateGroupKey() {
    try {
      // Генерируем случайный ключ для группы
      const key = nacl.randomBytes(32);
      return encode(key);
    } catch (error) {
      console.error('Error generating group key:', error);
      throw new Error('Failed to generate group key');
    }
  }

  static async encryptGroupMessage(message, groupKey) {
    try {
      const key = new Uint8Array(decode(groupKey));
      const messageUint8 = new TextEncoder().encode(message);
      const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      
      const encrypted = nacl.secretbox(messageUint8, nonce, key);
      
      return {
        encryptedMessage: encode(encrypted),
        nonce: encode(nonce),
      };
    } catch (error) {
      console.error('Error encrypting group message:', error);
      throw new Error('Failed to encrypt group message');
    }
  }

  static async decryptGroupMessage(encryptedMessage, nonce, groupKey) {
    try {
      const key = new Uint8Array(decode(groupKey));
      const encrypted = new Uint8Array(decode(encryptedMessage));
      const nonceUint8 = new Uint8Array(decode(nonce));
      
      const decrypted = nacl.secretbox.open(encrypted, nonceUint8, key);
      
      if (!decrypted) {
        throw new Error('Failed to decrypt group message');
      }
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Error decrypting group message:', error);
      throw new Error('Failed to decrypt group message');
    }
  }

  static async hashPassword(password) {
    try {
      const passwordUint8 = new TextEncoder().encode(password);
      const hash = nacl.hash(passwordUint8);
      return encode(hash);
    } catch (error) {
      console.error('Error hashing password:', error);
      throw new Error('Failed to hash password');
    }
  }

  static async encryptLocalData(data, password) {
    try {
      const passwordHash = await this.hashPassword(password);
      const key = new Uint8Array(decode(passwordHash)).slice(0, 32);
      const dataUint8 = new TextEncoder().encode(JSON.stringify(data));
      const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
      
      const encrypted = nacl.secretbox(dataUint8, nonce, key);
      
      return {
        encryptedData: encode(encrypted),
        nonce: encode(nonce),
      };
    } catch (error) {
      console.error('Error encrypting local data:', error);
      throw new Error('Failed to encrypt local data');
    }
  }

  static async decryptLocalData(encryptedData, nonce, password) {
    try {
      const passwordHash = await this.hashPassword(password);
      const key = new Uint8Array(decode(passwordHash)).slice(0, 32);
      const encrypted = new Uint8Array(decode(encryptedData));
      const nonceUint8 = new Uint8Array(decode(nonce));
      
      const decrypted = nacl.secretbox.open(encrypted, nonceUint8, key);
      
      if (!decrypted) {
        throw new Error('Failed to decrypt local data');
      }
      
      const dataString = new TextDecoder().decode(decrypted);
      return JSON.parse(dataString);
    } catch (error) {
      console.error('Error decrypting local data:', error);
      throw new Error('Failed to decrypt local data');
    }
  }

  static async clearKeys() {
    try {
      await SecureStore.deleteItemAsync('privateKey');
    } catch (error) {
      console.error('Error clearing keys:', error);
    }
  }

  static generateNonce() {
    return encode(nacl.randomBytes(nacl.box.nonceLength));
  }

  static async verifyKeyPair(publicKey, secretKey) {
    try {
      const testMessage = 'test message';
      const testNonce = nacl.randomBytes(nacl.box.nonceLength);
      
      const publicKeyUint8 = new Uint8Array(decode(publicKey));
      const secretKeyUint8 = new Uint8Array(decode(secretKey));
      const messageUint8 = new TextEncoder().encode(testMessage);
      
      // Пробуем зашифровать и расшифровать тестовое сообщение
      const encrypted = nacl.box(messageUint8, testNonce, publicKeyUint8, secretKeyUint8);
      const decrypted = nacl.box.open(encrypted, testNonce, publicKeyUint8, secretKeyUint8);
      
      if (!decrypted) {
        return false;
      }
      
      const decryptedMessage = new TextDecoder().decode(decrypted);
      return decryptedMessage === testMessage;
    } catch (error) {
      console.error('Error verifying key pair:', error);
      return false;
    }
  }
}
