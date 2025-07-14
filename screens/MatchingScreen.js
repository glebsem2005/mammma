import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanGestureHandler,
  Animated,
  Dimensions,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = 120;

const MatchingScreen = ({ navigation }) => {
  const [users, setUsers] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const position = useRef(new Animated.ValueXY()).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const likeOpacity = useRef(new Animated.Value(0)).current;
  const nopeOpacity = useRef(new Animated.Value(0)).current;

  // Демо данные пользователей
  const demoUsers = [
    {
      id: 'user1',
      name: 'Анна Петрова',
      age: 25,
      description: 'Люблю путешествовать, фотографировать природу и читать книги',
      avatar: null,
      interests: ['Путешествия', 'Фотография', 'Книги'],
      commonContacts: 2,
      distance: '2 км',
    },
    {
      id: 'user2',
      name: 'Михаил Сидоров',
      age: 28,
      description: 'Разработчик, увлекаюсь спортом и новыми технологиями',
      avatar: null,
      interests: ['Технологии', 'Спорт', 'Кино'],
      commonContacts: 1,
      distance: '5 км',
    },
    {
      id: 'user3',
      name: 'Елена Иванова',
      age: 24,
      description: 'Музыкант, играю на гитаре и пишу песни',
      avatar: null,
      interests: ['Музыка', 'Искусство', 'Кулинария'],
      commonContacts: 0,
      distance: '3 км',
    },
    {
      id: 'user4',
      name: 'Алексей Петров',
      age: 30,
      description: 'Дизайнер, обожаю создавать красивые вещи',
      avatar: null,
      interests: ['Дизайн', 'Искусство', 'Путешествия'],
      commonContacts: 3,
      distance: '1 км',
    },
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      // В реальном приложении здесь будет загрузка пользователей из Firebase
      // с фильтрацией по интересам и общим контактам
      setUsers(demoUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Ошибка', 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: position.x, translationY: position.y } }],
    { useNativeDriver: false }
  );

  const onHandlerStateChange = (event) => {
    if (event.nativeEvent.oldState === 4) { // ACTIVE
      const { translationX, translationY } = event.nativeEvent;
      
      if (translationX > SWIPE_THRESHOLD) {
        // Swipe right - like
        swipeRight();
      } else if (translationX < -SWIPE_THRESHOLD) {
        // Swipe left - dislike
        swipeLeft();
      } else {
        // Return to center
        resetPosition();
      }
    }
  };

  const swipeRight = () => {
    const currentUser = users[currentIndex];
    if (currentUser) {
      handleLike(currentUser);
    }
    
    Animated.timing(position, {
      toValue: { x: SCREEN_WIDTH + 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      nextCard();
    });
  };

  const swipeLeft = () => {
    const currentUser = users[currentIndex];
    if (currentUser) {
      handleDislike(currentUser);
    }
    
    Animated.timing(position, {
      toValue: { x: -SCREEN_WIDTH - 100, y: 0 },
      duration: 300,
      useNativeDriver: false,
    }).start(() => {
      nextCard();
    });
  };

  const resetPosition = () => {
    Animated.parallel([
      Animated.spring(position, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: false,
      }),
      Animated.timing(likeOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(nopeOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  };

  const nextCard = () => {
    position.setValue({ x: 0, y: 0 });
    likeOpacity.setValue(0);
    nopeOpacity.setValue(0);
    setCurrentIndex(prev => prev + 1);
  };

  const handleLike = async (user) => {
    try {
      // В реальном приложении здесь будет отправка лайка на сервер
      // и проверка на взаимный матч
      
      // Симуляция случайного матча
      const isMatch = Math.random() > 0.7;
      
      if (isMatch) {
        setMatches(prev => [...prev, user]);
        Alert.alert(
          'Это матч! 🎉',
          `Вы и ${user.name} понравились друг другу!`,
          [
            { text: 'Круто!', style: 'default' },
            { 
              text: 'Написать сообщение', 
              onPress: () => {
                navigation.navigate('Chat', { 
                  chatId: `match_${user.id}`, 
                  chatName: user.name 
                });
              }
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error handling like:', error);
    }
  };

  const handleDislike = async (user) => {
    try {
      // В реальном приложении здесь будет отправка дизлайка на сервер
      console.log('Disliked user:', user.id);
    } catch (error) {
      console.error('Error handling dislike:', error);
    }
  };

  const renderCard = (user, index) => {
    const isTop = index === currentIndex;
    const isNext = index === currentIndex + 1;
    
    if (index < currentIndex) return null;
    
    const rotateStr = rotate.interpolate({
      inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      outputRange: ['-30deg', '0deg', '30deg'],
      extrapolate: 'clamp',
    });

    const likeOpacityInterpolate = position.x.interpolate({
      inputRange: [0, SCREEN_WIDTH / 4],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });

    const nopeOpacityInterpolate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH / 4, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });

    const cardStyle = isTop ? {
      transform: [
        ...position.getTranslateTransform(),
        { rotate: rotateStr },
      ],
    } : {
      transform: [
        { scale: isNext ? 0.95 : 0.9 },
      ],
    };

    const CardComponent = isTop ? (
      <PanGestureHandler
        onGestureEvent={onGestureEvent}
        onHandlerStateChange={onHandlerStateChange}
      >
        <Animated.View style={[styles.card, cardStyle]}>
          {renderCardContent(user, isTop, likeOpacityInterpolate, nopeOpacityInterpolate)}
        </Animated.View>
      </PanGestureHandler>
    ) : (
      <Animated.View style={[styles.card, cardStyle]}>
        {renderCardContent(user, false)}
      </Animated.View>
    );

    return (
      <View key={user.id} style={styles.cardContainer}>
        {CardComponent}
      </View>
    );
  };

  const renderCardContent = (user, isTop, likeOpacity, nopeOpacity) => (
    <>
      <View style={styles.cardImageContainer}>
        {user.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardImagePlaceholder}>
            <Text style={styles.cardImagePlaceholderText}>
              {user.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        
        {isTop && (
          <>
            <Animated.View 
              style={[styles.likeLabel, { opacity: likeOpacity }]}
            >
              <Text style={styles.likeLabelText}>НРАВИТСЯ</Text>
            </Animated.View>
            <Animated.View 
              style={[styles.nopeLabel, { opacity: nopeOpacity }]}
            >
              <Text style={styles.nopeLabelText}>НЕ НРАВИТСЯ</Text>
            </Animated.View>
          </>
        )}
      </View>

      <View style={styles.cardInfo}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardName}>{user.name}, {user.age}</Text>
          <Text style={styles.cardDistance}>{user.distance}</Text>
        </View>
        
        <Text style={styles.cardDescription}>{user.description}</Text>
        
        <View style={styles.cardInterests}>
          {user.interests.map((interest, index) => (
            <View key={index} style={styles.interestTag}>
              <Text style={styles.interestText}>{interest}</Text>
            </View>
          ))}
        </View>
        
        {user.commonContacts > 0 && (
          <Text style={styles.commonContacts}>
            {user.commonContacts} общих контакта
          </Text>
        )}
      </View>
    </>
  );

  const renderButtons = () => (
    <View style={styles.buttonsContainer}>
      <TouchableOpacity 
        style={styles.dislikeButton}
        onPress={swipeLeft}
      >
        <Text style={styles.buttonText}>✕</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.likeButton}
        onPress={swipeRight}
      >
        <Text style={styles.buttonText}>♡</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Поиск пользователей...</Text>
      </View>
    );
  }

  if (currentIndex >= users.length) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Больше нет пользователей</Text>
        <Text style={styles.emptySubtext}>
          Попробуйте изменить настройки поиска
        </Text>
        <TouchableOpacity 
          style={styles.refreshButton}
          onPress={loadUsers}
        >
          <Text style={styles.refreshButtonText}>Обновить</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Знакомства</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Text style={styles.settingsButtonText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.cardsContainer}>
        {users.slice(currentIndex, currentIndex + 3).map((user, index) => 
          renderCard(user, currentIndex + index)
        )}
      </View>

      {renderButtons()}
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
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
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH - 40,
    height: SCREEN_HEIGHT * 0.7,
  },
  card: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  cardImageContainer: {
    position: 'relative',
    flex: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardImagePlaceholder: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardImagePlaceholderText: {
    fontSize: 80,
    color: '#94a3b8',
    fontWeight: '600',
    fontFamily: 'System',
  },
  likeLabel: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: '#10b981',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    transform: [{ rotate: '-20deg' }],
  },
  likeLabelText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'System',
  },
  nopeLabel: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    transform: [{ rotate: '20deg' }],
  },
  nopeLabelText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'System',
  },
  cardInfo: {
    padding: 20,
    maxHeight: 200,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'System',
  },
  cardDistance: {
    fontSize: 14,
    color: '#64748b',
    fontFamily: 'System',
  },
  cardDescription: {
    fontSize: 16,
    color: '#64748b',
    lineHeight: 22,
    marginBottom: 12,
    fontFamily: 'System',
  },
  cardInterests: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  interestTag: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  interestText: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'System',
  },
  commonContacts: {
    fontSize: 14,
    color: '#2563eb',
    fontFamily: 'System',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
    gap: 40,
  },
  dislikeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  likeButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 20,
    color: '#64748b',
    marginBottom: 8,
    fontFamily: 'System',
  },
  emptySubtext: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'System',
  },
  refreshButton: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
});

export default MatchingScreen;
