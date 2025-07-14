import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';

const FeedScreen = ({ navigation }) => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostImage, setNewPostImage] = useState(null);

  // Демо данные постов
  const demoPosts = [
    {
      id: '1',
      authorId: 'user1',
      authorName: 'Анна Петрова',
      authorAvatar: null,
      text: 'Прекрасный день для прогулки! Солнце светит, птички поют ☀️',
      imageUrl: null,
      timestamp: new Date(Date.now() - 60000 * 30), // 30 минут назад
      likes: 12,
      comments: 3,
      isLiked: false,
    },
    {
      id: '2',
      authorId: 'user2',
      authorName: 'Михаил Сидоров',
      authorAvatar: null,
      text: 'Только что закончил работу над новым проектом. Очень доволен результатом! 🚀',
      imageUrl: null,
      timestamp: new Date(Date.now() - 60000 * 60 * 2), // 2 часа назад
      likes: 24,
      comments: 7,
      isLiked: true,
    },
    {
      id: '3',
      authorId: 'user3',
      authorName: 'Елена Иванова',
      authorAvatar: null,
      text: 'Вчера была на концерте. Незабываемые впечатления!',
      imageUrl: null,
      timestamp: new Date(Date.now() - 60000 * 60 * 12), // 12 часов назад
      likes: 45,
      comments: 15,
      isLiked: false,
    },
  ];

  useEffect(() => {
    loadPosts();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadPosts();
    }, [])
  );

  const loadPosts = async () => {
    try {
      // В реальном приложении здесь будет загрузка из Firebase
      setPosts(demoPosts);
    } catch (error) {
      console.error('Error loading posts:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить посты');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadPosts();
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setNewPostImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось выбрать изображение');
    }
  };

  const createPost = async () => {
    if (!newPostText.trim() && !newPostImage) {
      Alert.alert('Ошибка', 'Добавьте текст или изображение');
      return;
    }

    try {
      const newPost = {
        id: Date.now().toString(),
        authorId: 'me',
        authorName: 'Я',
        authorAvatar: null,
        text: newPostText.trim(),
        imageUrl: newPostImage,
        timestamp: new Date(),
        likes: 0,
        comments: 0,
        isLiked: false,
      };

      setPosts(prevPosts => [newPost, ...prevPosts]);
      setNewPostText('');
      setNewPostImage(null);
      setShowCreatePost(false);
      
      Alert.alert('Успешно', 'Пост опубликован');
    } catch (error) {
      Alert.alert('Ошибка', 'Не удалось создать пост');
    }
  };

  const toggleLike = (postId) => {
    setPosts(prevPosts =>
      prevPosts.map(post =>
        post.id === postId
          ? {
              ...post,
              isLiked: !post.isLiked,
              likes: post.isLiked ? post.likes - 1 : post.likes + 1,
            }
          : post
      )
    );
  };

  const openUserProfile = (userId, userName) => {
    if (userId === 'me') return;
    
    // В реальном приложении здесь будет переход к профилю пользователя
    Alert.alert('Профиль', `Открыть чат с ${userName}?`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Открыть чат', onPress: () => {
        // Создаем новый чат или открываем существующий
        navigation.navigate('Chat', { 
          chatId: `chat_${userId}`, 
          chatName: userName 
        });
      }},
    ]);
  };

  const formatTimestamp = (timestamp) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now - timestamp) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'только что';
    if (diffInMinutes < 60) return `${diffInMinutes} мин назад`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} ч назад`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} д назад`;
    
    return timestamp.toLocaleDateString('ru-RU');
  };

  const renderPost = ({ item }) => (
    <View style={styles.postContainer}>
      <View style={styles.postHeader}>
        <TouchableOpacity 
          style={styles.authorInfo}
          onPress={() => openUserProfile(item.authorId, item.authorName)}
        >
          <View style={styles.authorAvatar}>
            {item.authorAvatar ? (
              <Image source={{ uri: item.authorAvatar }} style={styles.avatar} />
            ) : (
              <Text style={styles.avatarText}>
                {item.authorName.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>
          <View style={styles.authorDetails}>
            <Text style={styles.authorName}>{item.authorName}</Text>
            <Text style={styles.postTime}>{formatTimestamp(item.timestamp)}</Text>
          </View>
        </TouchableOpacity>
      </View>

      {item.text && (
        <Text style={styles.postText}>{item.text}</Text>
      )}

      {item.imageUrl && (
        <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
      )}

      <View style={styles.postActions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => toggleLike(item.id)}
        >
          <Text style={[styles.actionIcon, item.isLiked && styles.likedIcon]}>
            {item.isLiked ? '❤️' : '🤍'}
          </Text>
          <Text style={styles.actionText}>{item.likes}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>💬</Text>
          <Text style={styles.actionText}>{item.comments}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton}>
          <Text style={styles.actionIcon}>📤</Text>
          <Text style={styles.actionText}>Поделиться</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCreatePostModal = () => (
    <Modal
      visible={showCreatePost}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={() => setShowCreatePost(false)}>
            <Text style={styles.modalCancelText}>Отмена</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Новый пост</Text>
          <TouchableOpacity onPress={createPost}>
            <Text style={styles.modalCreateText}>Опубликовать</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <TextInput
            style={styles.postInput}
            placeholder="Что нового?"
            value={newPostText}
            onChangeText={setNewPostText}
            multiline
            textAlignVertical="top"
            placeholderTextColor="#94a3b8"
          />

          {newPostImage && (
            <View style={styles.imagePreview}>
              <Image source={{ uri: newPostImage }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setNewPostImage(null)}
              >
                <Text style={styles.removeImageText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
            <Text style={styles.addImageText}>📷 Добавить фото</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Загрузка ленты...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Лента</Text>
        <TouchableOpacity
          style={styles.createPostButton}
          onPress={() => setShowCreatePost(true)}
        >
          <Text style={styles.createPostButtonText}>✏️</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={item => item.id}
        style={styles.feedList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Нет постов</Text>
            <Text style={styles.emptySubtext}>
              Станьте первым, кто поделится чем-то интересным!
            </Text>
          </View>
        }
      />

      {renderCreatePostModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    fontSize: 16,
    color: '#64748b',
    fontFamily: 'System',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'System',
  },
  createPostButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  createPostButtonText: {
    fontSize: 18,
    color: '#ffffff',
  },
  feedList: {
    flex: 1,
  },
  postContainer: {
    backgroundColor: '#ffffff',
    marginBottom: 8,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  postHeader: {
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
    fontFamily: 'System',
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'System',
  },
  postTime: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
    fontFamily: 'System',
  },
  postText: {
    fontSize: 16,
    color: '#1e293b',
    lineHeight: 22,
    paddingHorizontal: 24,
    marginBottom: 12,
    fontFamily: 'System',
  },
  postImage: {
    width: '100%',
    height: 300,
    marginBottom: 12,
  },
  postActions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  actionIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  likedIcon: {
    color: '#dc2626',
  },
  actionText: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'System',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#64748b',
    marginBottom: 8,
    fontFamily: 'System',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    paddingHorizontal: 24,
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
  modalCreateText: {
    fontSize: 16,
    color: '#2563eb',
    fontWeight: '600',
    fontFamily: 'System',
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  postInput: {
    fontSize: 16,
    color: '#1e293b',
    textAlignVertical: 'top',
    minHeight: 150,
    fontFamily: 'System',
  },
  imagePreview: {
    position: 'relative',
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeImageText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addImageButton: {
    marginTop: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    borderStyle: 'dashed',
    alignItems: 'center',
  },
  addImageText: {
    fontSize: 16,
    color: '#64748b',
    fontFamily: 'System',
  },
});

export default FeedScreen;
