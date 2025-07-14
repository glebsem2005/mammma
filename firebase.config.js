import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Конфигурация Firebase
// ЗАМЕНИ НА СВОЮ КОНФИГУРАЦИЮ ИЗ FIREBASE CONSOLE
const firebaseConfig = {
  apiKey: "твой-api-key",
  authDomain: "твой-project.firebaseapp.com",
  projectId: "твой-project-id",
  storageBucket: "твой-project.appspot.com",
  messagingSenderId: "твой-sender-id",
  appId: "твой-app-id"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);

// Экспорт сервисов
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Конфигурация Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "messenger-app-12345.firebaseapp.com",
  projectId: "messenger-app-12345",
  storageBucket: "messenger-app-12345.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:android:abcdef123456789012345"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);

// Инициализация Auth с AsyncStorage
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Инициализация Firestore
const db = getFirestore(app);

// Инициализация Storage
const storage = getStorage(app);

// Для разработки можно подключить эмуляторы
// if (__DEV__) {
//   connectFirestoreEmulator(db, 'localhost', 8080);
//   connectStorageEmulator(storage, 'localhost', 9199);
// }

export { auth, db, storage };
export default app;import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

// Конфигурация Firebase (замените на вашу)
const firebaseConfig = {
  apiKey: "your-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id",
  measurementId: "your-measurement-id"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);

// Инициализация сервисов
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Настройка эмуляторов для разработки (закомментируйте для production)
// import { connectAuthEmulator } from 'firebase/auth';
// import { connectFirestoreEmulator } from 'firebase/firestore';
// import { connectStorageEmulator } from 'firebase/storage';
// import { connectFunctionsEmulator } from 'firebase/functions';

// if (__DEV__) {
//   connectAuthEmulator(auth, 'http://localhost:9099');
//   connectFirestoreEmulator(db, 'localhost', 8080);
//   connectStorageEmulator(storage, 'localhost', 9199);
//   connectFunctionsEmulator(functions, 'localhost', 5001);
// }

export default app;
