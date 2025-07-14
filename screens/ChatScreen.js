import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Modal,
} from 'react-native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CryptoService } from '../services/CryptoService';

const ChatScreen = ({ route, navigation }) => {
  const { chatId, chatName } = route.params;
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recording, setRecording] = useState(null);
  const [showMediaOptions, setShowMediaOptions] = useState(false);
  const [showCallOptionsModal, setShowCallOptionsModal] = useState(false);
  const flatListRef = useRef(null);
  const recordingAnimation = useRef(new Animated.Value(0)).current;

  const showCallOptions = () => {
    setShowCallOptionsModal(true);
  };

  const initiateCall = async (callType) => {
    try {
      setShowCallOptionsModal(false);
      
      // Получаем ID собеседника из chatId
      const targetUserId = chatId.replace('chat_', '');
      
      // Переходим к экрану звонка
      navigation.navigate('Call', {
        callType: callType,
        isIncoming: false,
        callData: {
          targetUserId: targetUserId,
          callerName: chatName,
        }
      });
    } catch (error) {
      console.error('Error initiating call:', error);
      Alert.alert('Ошибка', 'Не удалось инициировать звонок');
    }
  };

  // Демо сообщения
  const demoMessages = [
    {
      id: '1',
      senderId: 'user1',
      text: 'Привет! Как дела?',
      timestamp: new Date(Date.now() - 60000 * 60),
      type: 'text',
      isOwn: false,
    },
    {
      id: '2',
      senderId: 'me',
      text: 'Привет! Все отлично, спасибо! А у тебя как?',
      timestamp: new Date(Date.now() - 60000 * 50),
      type: 'text',
      isOwn: true,
    },
    {
      id: '3',
      senderId: 'user1',
      text: 'Тоже все хорошо! Сегодня отличная погода',
      timestamp: new Date(Date.now() - 60000 * 30),
      type: 'text',
      isOwn: false,
    },
  ];

  useEffect(() => {
    loadMessages();
    setupMessageListener();
  }, []);

  const loadMessages = async () => {
    try {
      const { collection, query, orderBy, onSnapshot } = await import('firebase/firestore');
      const { db } = await import('../firebase.config');
      
      const messagesRef = collection(db, 'messages', chatId, 'messages');
      const q = query(messagesRef, orderBy('timestamp', 'asc'));
      
      const unsubscribe = onSnapshot(q, async (snapshot) => {
        const loadedMessages = [];
        const currentUserId = await AsyncStorage.getItem('userId');
        
        for (const doc of snapshot.docs) {
          const messageData = doc.data();
          try {
            // Расшифровываем сообщение
            let decryptedContent;
            if (messageData.messageType === 'text') {
              decryptedContent = await CryptoService.decryptMessage(
                messageData.encryptedMessage,
                messageData.nonce,
                messageData.senderId === currentUserId ? 
                  await getRecipientPublicKey(chatId) : 
                  await getSenderPublicKey(messageData.senderId)
              );
            } else {
              // Для медиа сообщений расшифровываем метаданные
              const metadata = await CryptoService.decryptMessage(
                messageData.encryptedMessage,
                messageData.nonce,
                messageData.senderId === currentUserId ? 
                  await getRecipientPublicKey(chatId) : 
                  await getSenderPublicKey(messageData.senderId)
              );
              decryptedContent = JSON.parse(metadata);
            }
            
            const message = {
              id: doc.id,
              senderId: messageData.senderId,
              text: messageData.messageType === 'text' ? decryptedContent : null,
              timestamp: messageData.timestamp.toDate(),
              type: messageData.messageType,
              isOwn: messageData.senderId === currentUserId,
              audioUri: messageData.messageType === 'voice' ? messageData.mediaUrl : null,
              imageUri: messageData.messageType === 'image' ? messageData.mediaUrl : null,
              metadata: messageData.messageType !== 'text' ? decryptedContent : null,
            };
            
            loadedMessages.push(message);
          } catch (error) {
            console.error('Error decrypting message:', error);
            // Добавляем сообщение об ошибке расшифровки
            loadedMessages.push({
              id: doc.id,
              senderId: messageData.senderId,
              text: '🔒 Не удалось расшифровать сообщение',
              timestamp: messageData.timestamp.toDate(),
              type: 'error',
              isOwn: messageData.senderId === currentUserId,
            });
          }
        }
        
        setMessages(loadedMessages);
      });
      
      // Сохраняем функцию отписки
      return unsubscribe;
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить сообщения');
    }
  };

  const setupMessageListener = () => {
    // Настраиваем слушатель для новых сообщений
    const unsubscribe = loadMessages();
    
    // Очищаем слушатель при размонтировании
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  };

  const getSenderPublicKey = async (senderId) => {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase.config');
      
      const userDoc = await getDoc(doc(db, 'users', senderId));
      if (!userDoc.exists()) {
        throw new Error('Sender not found');
      }
      
      return userDoc.data().publicKey;
    } catch (error) {
      console.error('Error getting sender public key:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingAnimation, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(recordingAnimation, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      recordingAnimation.setValue(0);
    }
  }, [isRecording]);

  const setupAudioPermissions = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert('Ошибка', 'Разрешение на запись аудио не предоставлено');
      }
    } catch (error) {
      console.error('Audio permissions error:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const messageText = inputText.trim();
    setInputText('');
    
    try {
      // Получаем информацию о текущем пользователе
      const userId = await AsyncStorage.getItem('userId');
      const recipientPublicKey = await getRecipientPublicKey(chatId);
      
      // Шифруем сообщение
      const encrypted = await CryptoService.encryptMessage(messageText, recipientPublicKey);
      
      // Создаем объект сообщения
      const messageData = {
        senderId: userId,
        encryptedMessage: encrypted.encryptedMessage,
        nonce: encrypted.nonce,
        timestamp: new Date(),
        messageType: 'text',
        chatId: chatId,
      };
      
      // Сохраняем в Firebase
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase.config');
      
      await addDoc(collection(db, 'messages', chatId, 'messages'), messageData);
      
      // Добавляем в локальный стэйт расшифрованное сообщение
      const newMessage = {
        id: Date.now().toString(),
        senderId: userId,
        text: messageText,
        timestamp: new Date(),
        type: 'text',
        isOwn: true,
      };

      setMessages(prev => [...prev, newMessage]);
      
      // Прокрутка к последнему сообщению
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
      
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
      setInputText(messageText); // Возвращаем текст обратно
    }
  };

  const getRecipientPublicKey = async (chatId) => {
    try {
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase.config');
      
      // Получаем информацию о чате
      const chatDoc = await getDoc(doc(db, 'chats', chatId));
      if (!chatDoc.exists()) {
        throw new Error('Chat not found');
      }
      
      const chatData = chatDoc.data();
      const currentUserId = await AsyncStorage.getItem('userId');
      
      // Находим ID собеседника
      const recipientId = chatData.members.find(memberId => memberId !== currentUserId);
      
      // Получаем публичный ключ собеседника
      const userDoc = await getDoc(doc(db, 'users', recipientId));
      if (!userDoc.exists()) {
        throw new Error('Recipient not found');
      }
      
      return userDoc.data().publicKey;
    } catch (error) {
      console.error('Error getting recipient public key:', error);
      throw error;
    }
  };

  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      const recording = new Audio.Recording();
      await recording.prepareAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      
      setRecording(recording);
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Ошибка', 'Не удалось начать запись');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      // Загружаем файл в Firebase Storage
      const audioUrl = await uploadVoiceMessage(uri);
      
      // Получаем информацию о пользователе
      const userId = await AsyncStorage.getItem('userId');
      const recipientPublicKey = await getRecipientPublicKey(chatId);
      
      // Шифруем метаданные голосового сообщения
      const metadata = JSON.stringify({
        type: 'voice',
        duration: await getAudioDuration(uri),
        size: await getFileSize(uri)
      });
      
      const encrypted = await CryptoService.encryptMessage(metadata, recipientPublicKey);
      
      // Создаем объект сообщения
      const messageData = {
        senderId: userId,
        encryptedMessage: encrypted.encryptedMessage,
        nonce: encrypted.nonce,
        timestamp: new Date(),
        messageType: 'voice',
        mediaUrl: audioUrl,
        chatId: chatId,
      };
      
      // Сохраняем в Firebase
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase.config');
      
      await addDoc(collection(db, 'messages', chatId, 'messages'), messageData);
      
      // Добавляем в локальный стэйт
      const voiceMessage = {
        id: Date.now().toString(),
        senderId: userId,
        audioUri: uri,
        timestamp: new Date(),
        type: 'voice',
        isOwn: true,
      };

      setMessages(prev => [...prev, voiceMessage]);
      setRecording(null);
      setIsRecording(false);
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Ошибка', 'Не удалось сохранить запись');
    }
  };

  const uploadVoiceMessage = async (uri) => {
    try {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../firebase.config');
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const fileName = `voice_messages/${Date.now()}.m4a`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading voice message:', error);
      throw error;
    }
  };

  const getAudioDuration = async (uri) => {
    try {
      const { Audio } = await import('expo-av');
      const { sound } = await Audio.Sound.createAsync({ uri });
      const status = await sound.getStatusAsync();
      await sound.unloadAsync();
      return status.durationMillis || 0;
    } catch (error) {
      console.error('Error getting audio duration:', error);
      return 0;
    }
  };

  const getFileSize = async (uri) => {
    try {
      const { getInfoAsync } = await import('expo-file-system');
      const info = await getInfoAsync(uri);
      return info.size || 0;
    } catch (error) {
      console.error('Error getting file size:', error);
      return 0;
    }
  };

  const playVoiceMessage = async (audioUri) => {
    try {
      const { Audio } = await import('expo-av');
      const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
      await sound.playAsync();
      
      // Автоматически выгружаем звук после воспроизведения
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Error playing voice message:', error);
      Alert.alert('Ошибка', 'Не удалось воспроизвести голосовое сообщение');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        await sendImageMessage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Ошибка', 'Не удалось выбрать изображение');
    }
    setShowMediaOptions(false);
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        await sendImageMessage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Ошибка', 'Не удалось сделать фото');
    }
    setShowMediaOptions(false);
  };

  const sendImageMessage = async (imageUri) => {
    try {
      // Загружаем изображение в Firebase Storage
      const imageUrl = await uploadImage(imageUri);
      
      // Получаем информацию о пользователе
      const userId = await AsyncStorage.getItem('userId');
      const recipientPublicKey = await getRecipientPublicKey(chatId);
      
      // Шифруем метаданные изображения
      const metadata = JSON.stringify({
        type: 'image',
        size: await getFileSize(imageUri),
        dimensions: await getImageDimensions(imageUri)
      });
      
      const encrypted = await CryptoService.encryptMessage(metadata, recipientPublicKey);
      
      // Создаем объект сообщения
      const messageData = {
        senderId: userId,
        encryptedMessage: encrypted.encryptedMessage,
        nonce: encrypted.nonce,
        timestamp: new Date(),
        messageType: 'image',
        mediaUrl: imageUrl,
        chatId: chatId,
      };
      
      // Сохраняем в Firebase
      const { collection, addDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase.config');
      
      await addDoc(collection(db, 'messages', chatId, 'messages'), messageData);
      
      // Добавляем в локальный стэйт
      const imageMessage = {
        id: Date.now().toString(),
        senderId: userId,
        imageUri: imageUri,
        timestamp: new Date(),
        type: 'image',
        isOwn: true,
      };

      setMessages(prev => [...prev, imageMessage]);
    } catch (error) {
      console.error('Error sending image message:', error);
      Alert.alert('Ошибка', 'Не удалось отправить изображение');
    }
  };

  const uploadImage = async (uri) => {
    try {
      const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
      const { storage } = await import('../firebase.config');
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const fileName = `images/${Date.now()}.jpg`;
      const storageRef = ref(storage, fileName);
      
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);
      
      return downloadURL;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const getImageDimensions = async (uri) => {
    try {
      const { Image } = await import('react-native');
      return new Promise((resolve) => {
        Image.getSize(uri, (width, height) => {
          resolve({ width, height });
        }, () => {
          resolve({ width: 0, height: 0 });
        });
      });
    } catch (error) {
      console.error('Error getting image dimensions:', error);
      return { width: 0, height: 0 };
    }
  };]);
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выбрать изображение');
    }
    setShowMediaOptions(false);
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        const imageMessage = {
          id: Date.now().toString(),
          senderId: 'me',
          imageUri: result.assets[0].uri,
          timestamp: new Date(),
          type: 'image',
          isOwn: true,
        };

        setMessages(prev => [...prev, imageMessage]);
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось сделать фото');
    }
    setShowMediaOptions(false);
  };

  const formatMessageTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMessage = ({ item }) => (
    <View style={[
      styles.messageContainer,
      item.isOwn ? styles.ownMessage : styles.otherMessage
    ]}>
      <View style={[
        styles.messageBubble,
        item.isOwn ? styles.ownBubble : styles.otherBubble
      ]}>
        {item.type === 'text' && (
          <Text style={[
            styles.messageText,
            item.isOwn ? styles.ownMessageText : styles.otherMessageText
          ]}>
            {item.text}
          </Text>
        )}
        
        {item.type === 'image' && (
          <Image source={{ uri: item.imageUri }} style={styles.messageImage} />
        )}
        
        {item.type === 'voice' && (
          <View style={styles.voiceMessage}>
            <TouchableOpacity 
              style={styles.playButton}
              onPress={() => playVoiceMessage(item.audioUri)}
            >
              <Text style={styles.playButtonText}>▶️</Text>
            </TouchableOpacity>
            <Text style={styles.voiceText}>Голосовое сообщение</Text>
          </View>
        )}
        
        <Text style={[
          styles.messageTime,
          item.isOwn ? styles.ownMessageTime : styles.otherMessageTime
        ]}>
          {formatMessageTime(item.timestamp)}
        </Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{chatName}</Text>
        <TouchableOpacity 
          style={styles.callButton}
          onPress={() => showCallOptions()}
        >
          <Text style={styles.callButtonText}>📞</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={item => item.id}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {showCallOptionsModal && (
        <Modal
          visible={showCallOptionsModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCallOptionsModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.callOptionsModal}>
              <TouchableOpacity
                style={styles.callOptionButton}
                onPress={() => initiateCall('audio')}
              >
                <Text style={styles.callOptionIcon}>📞</Text>
                <Text style={styles.callOptionText}>Аудиозвонок</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.callOptionButton}
                onPress={() => initiateCall('video')}
              >
                <Text style={styles.callOptionIcon}>📹</Text>
                <Text style={styles.callOptionText}>Видеозвонок</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowCallOptionsModal(false)}
              >
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {showMediaOptions && (
        <View style={styles.mediaOptions}>
          <TouchableOpacity style={styles.mediaOption} onPress={pickImage}>
            <Text style={styles.mediaOptionText}>📷 Галерея</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaOption} onPress={takePhoto}>
            <Text style={styles.mediaOptionText}>📸 Камера</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.attachButton}
          onPress={() => setShowMediaOptions(!showMediaOptions)}
        >
          <Text style={styles.attachButtonText}>📎</Text>
        </TouchableOpacity>

        <TextInput
          style={styles.textInput}
          placeholder="Сообщение..."
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={1000}
          placeholderTextColor="#94a3b8"
        />

        {inputText.trim() ? (
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendButtonText}>➤</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.voiceButton, isRecording && styles.voiceButtonActive]}
            onPressIn={startRecording}
            onPressOut={stopRecording}
          >
            <Animated.View style={[
              styles.voiceButtonInner,
              {
                opacity: recordingAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.3],
                }),
              }
            ]}>
              <Text style={styles.voiceButtonText}>🎤</Text>
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: '#2563eb',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
    textAlign: 'center',
    fontFamily: 'System',
  },
  callButton: {
    padding: 8,
  },
  callButtonText: {
    fontSize: 20,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    paddingVertical: 16,
  },
  messageContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  ownMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
  },
  ownBubble: {
    backgroundColor: '#2563eb',
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: '#f1f5f9',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'System',
  },
  ownMessageText: {
    color: '#ffffff',
  },
  otherMessageText: {
    color: '#1e293b',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 150,
  },
  playButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  playButtonText: {
    fontSize: 12,
  },
  voiceText: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'System',
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'System',
  },
  ownMessageTime: {
    color: '#bfdbfe',
  },
  otherMessageTime: {
    color: '#94a3b8',
  },
  mediaOptions: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  mediaOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  mediaOptionText: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'System',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  attachButton: {
    padding: 8,
    marginRight: 8,
  },
  attachButtonText: {
    fontSize: 20,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    minHeight: 36,
    maxHeight: 100,
    fontSize: 16,
    fontFamily: 'System',
    color: '#1e293b',
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#ffffff',
    fontSize: 16,
  },
  voiceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonActive: {
    backgroundColor: '#dc2626',
  },
  voiceButtonInner: {
    width: '100%',
    height: '100%',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceButtonText: {
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callOptionsModal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
  },
  callOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  callOptionIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  callOptionText: {
    fontSize: 16,
    color: '#1e293b',
    fontFamily: 'System',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#64748b',
    fontFamily: 'System',
  },
});

export default ChatScreen;
