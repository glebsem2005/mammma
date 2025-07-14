import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Импорт экранов
import AuthScreen from './screens/AuthScreen';
import ProfileSetupScreen from './screens/ProfileSetupScreen';
import ChatListScreen from './screens/ChatListScreen';
import ChatScreen from './screens/ChatScreen';
import FeedScreen from './screens/FeedScreen';
import MatchingScreen from './screens/MatchingScreen';
import ProfileScreen from './screens/ProfileScreen';

// Навигация
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Стек чатов
const ChatStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ChatList" component={ChatListScreen} />
    <Stack.Screen name="Chat" component={ChatScreen} />
  </Stack.Navigator>
);

// Главная навигация
const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color }) => {
        let iconName;
        switch (route.name) {
          case 'Chats': iconName = '💬'; break;
          case 'Feed': iconName = '📰'; break;
          case 'Match': iconName = '💝'; break;
          case 'Profile': iconName = '👤'; break;
          default: iconName = '❓';
        }
        return (
          <View style={[styles.tabIcon, { borderBottomColor: focused ? color : 'transparent' }]}>
            <Text style={[styles.tabIconText, { color }]}>{iconName}</Text>
          </View>
        );
      },
      tabBarActiveTintColor: '#2563eb',
      tabBarInactiveTintColor: '#64748b',
      tabBarStyle: styles.tabBar,
      tabBarShowLabel: false,
      headerShown: false,
    })}
  >
    <Tab.Screen name="Chats" component={ChatStack} />
    <Tab.Screen name="Feed" component={FeedScreen} />
    <Tab.Screen name="Match" component={MatchingScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

// Главный компонент
export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(false);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const userToken = await AsyncStorage.getItem('userToken');
      const profileComplete = await AsyncStorage.getItem('profileComplete');
      
      setIsAuthenticated(!!userToken);
      setIsProfileComplete(profileComplete === 'true');
    } catch (error) {
      console.error('Ошибка проверки авторизации:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Экран загрузки
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Загрузка...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : !isProfileComplete ? (
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        ) : (
          <Stack.Screen name="Main" component={MainTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
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
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    height: 60,
    paddingBottom: 5,
    paddingTop: 5,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
    borderBottomWidth: 2,
    width: 40,
  },
  tabIconText: {
    fontSize: 20,
  },
});import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Screens
import AuthScreen from './screens/AuthScreen';
import ProfileSetupScreen from './screens/ProfileSetupScreen';
import ChatListScreen from './screens/ChatListScreen';
import ChatScreen from './screens/ChatScreen';
import CallScreen from './screens/CallScreen';
import FeedScreen from './screens/FeedScreen';
import MatchingScreen from './screens/MatchingScreen';
import ProfileScreen from './screens/ProfileScreen';

// Firebase config
const firebaseConfig = {
  // Ваша конфигурация Firebase
  apiKey: "your-api-key",
  authDomain: "your-auth-domain",
  projectId: "your-project-id",
  storageBucket: "your-storage-bucket",
  messagingSenderId: "your-messaging-sender-id",
  appId: "your-app-id"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Icons component
const TabIcon = ({ name, color, focused }) => (
  <View style={[styles.tabIcon, { borderBottomColor: focused ? color : 'transparent' }]}>
    <Text style={[styles.tabIconText, { color }]}>{name}</Text>
  </View>
);

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const ChatStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ChatList" component={ChatListScreen} />
    <Stack.Screen name="Chat" component={ChatScreen} />
    <Stack.Screen name="Call" component={CallScreen} />
  </Stack.Navigator>
);

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      tabBarIcon: ({ focused, color }) => {
        let iconName;
        switch (route.name) {
          case 'Chats':
            iconName = '💬';
            break;
          case 'Feed':
            iconName = '📰';
            break;
          case 'Match':
            iconName = '💝';
            break;
          case 'Profile':
            iconName = '👤';
            break;
        }
        return <TabIcon name={iconName} color={color} focused={focused} />;
      },
      tabBarActiveTintColor: '#2563eb',
      tabBarInactiveTintColor: '#64748b',
      tabBarStyle: styles.tabBar,
      tabBarShowLabel: false,
      headerShown: false,
    })}
  >
    <Tab.Screen name="Chats" component={ChatStack} />
    <Tab.Screen name="Feed" component={FeedScreen} />
    <Tab.Screen name="Match" component={MatchingScreen} />
    <Tab.Screen name="Profile" component={ProfileScreen} />
  </Tab.Navigator>
);

export default function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileSetup, setIsProfileSetup] = useState(false);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const userToken = await AsyncStorage.getItem('userToken');
        const profileComplete = await AsyncStorage.getItem('profileComplete');
        
        if (userToken) {
          setUser({ token: userToken });
          setIsProfileSetup(profileComplete === 'true');
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Загрузка...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      {!user ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthScreen} />
        </Stack.Navigator>
      ) : !isProfileSetup ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        </Stack.Navigator>
      ) : (
        <MainTabs />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
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
  tabBar: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    height: 60,
    paddingBottom: 5,
    paddingTop: 5,
  },
  tabIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 2,
    borderBottomWidth: 2,
    width: 40,
  },
  tabIconText: {
    fontSize: 20,
  },
});
