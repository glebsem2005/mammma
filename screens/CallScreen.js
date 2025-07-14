import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
  StatusBar,
  BackHandler,
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import WebRTCService from '../services/WebRTCService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const CallScreen = ({ route, navigation }) => {
  const { callType, isIncoming = false, callData = {} } = route.params || {};
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus] = useState(isIncoming ? 'incoming' : 'connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(callType === 'video');
  const [isSpeaker, setIsSpeaker] = useState(callType === 'video');
  
  const callTimer = useRef(null);
  const callStartTime = useRef(null);

  useEffect(() => {
    initializeCall();
    setupBackHandler();
    
    return () => {
      cleanup();
    };
  }, []);

  const setupBackHandler = () => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      endCall();
      return true;
    });
    
    return () => backHandler.remove();
  };

  const initializeCall = async () => {
    try {
      console.log('🚀 Инициализируем звонок...');
      
      // Получаем ID пользователя
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        throw new Error('Пользователь не авторизован');
      }
      
      // Инициализируем WebRTC сервис
      await WebRTCService.initialize('ws://localhost:3001', userId);
      
      // Настраиваем коллбэки
      WebRTCService.onLocalStream = (stream) => {
        console.log('📹 Получен локальный поток');
        setLocalStream(stream);
      };
      
      WebRTCService.onRemoteStream = (stream) => {
        console.log('📺 Получен удаленный поток');
        setRemoteStream(stream);
        setCallStatus('connected');
        startCallTimer();
      };
      
      WebRTCService.onCallEnded = (data) => {
        console.log('📴 Звонок завершен:', data);
        endCall();
      };
      
      WebRTCService.onCallAccepted = (data) => {
        console.log('✅ Звонок принят:', data);
        setCallStatus('connected');
        startCallTimer();
      };
      
      WebRTCService.onCallDeclined = (data) => {
        console.log('❌ Звонок отклонен:', data);
        Alert.alert('Звонок отклонен', 'Пользователь отклонил звонок');
        navigation.goBack();
      };
      
      WebRTCService.onError = (error) => {
        console.error('❌ Ошибка звонка:', error);
        Alert.alert('Ошибка звонка', error.error || 'Произошла ошибка');
        navigation.goBack();
      };
      
      WebRTCService.onCallInitiated = (data) => {
        console.log('📞 Звонок инициирован:', data);
        setCallStatus('calling');
      };
      
      if (isIncoming) {
        // Входящий звонок - ждем решения пользователя
        setCallStatus('incoming');
      } else {
        // Исходящий звонок - инициируем
        if (callData.targetUserId) {
          await WebRTCService.initiateCall(callData.targetUserId, callType);
        } else {
          throw new Error('Не указан ID получателя');
        }
      }
      
    } catch (error) {
      console.error('❌ Ошибка инициализации звонка:', error);
      Alert.alert('Ошибка', 'Не удалось инициализировать звонок: ' + error.message);
      navigation.goBack();
    }
  };

  const startCallTimer = () => {
    callStartTime.current = Date.now();
    callTimer.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime.current) / 1000);
      setCallDuration(elapsed);
    }, 1000);
  };

  const acceptCall = async () => {
    try {
      console.log('✅ Принимаем звонок...');
      
      if (callData.roomId) {
        await WebRTCService.acceptCall(callData.roomId);
        setCallStatus('connecting');
      } else {
        throw new Error('Не указан ID комнаты');
      }
    } catch (error) {
      console.error('❌ Ошибка принятия звонка:', error);
      Alert.alert('Ошибка', 'Не удалось принять звонок');
      navigation.goBack();
    }
  };

  const declineCall = () => {
    console.log('❌ Отклоняем звонок');
    
    if (callData.roomId) {
      WebRTCService.declineCall(callData.roomId);
    }
    navigation.goBack();
  };

  const endCall = () => {
    console.log('📴 Завершаем звонок');
    
    WebRTCService.endCall();
    cleanup();
    navigation.goBack();
  };

  const cleanup = () => {
    if (callTimer.current) {
      clearInterval(callTimer.current);
      callTimer.current = null;
    }
    WebRTCService.cleanup();
  };

  const toggleMute = () => {
    const newMuteState = WebRTCService.toggleMicrophone();
    setIsMuted(!newMuteState);
  };

  const toggleVideo = () => {
    const newVideoState = WebRTCService.toggleCamera();
    setIsVideoEnabled(newVideoState);
  };

  const switchCamera = () => {
    WebRTCService.switchCamera();
  };

  const toggleSpeaker = () => {
    setIsSpeaker(!isSpeaker);
    // TODO: Реализовать переключение динамика
  };

  const formatCallDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (callStatus) {
      case 'incoming': return 'Входящий звонок';
      case 'calling': return 'Вызов...';
      case 'connecting': return 'Подключение...';
      case 'connected': return formatCallDuration(callDuration);
      default: return 'Звонок';
    }
  };

  const renderIncomingCall = () => (
    <View style={styles.incomingCallContainer}>
      <View style={styles.callerInfo}>
        <View style={styles.callerAvatar}>
          <Text style={styles.callerAvatarText}>
            {callData.callerName?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.callerName}>
          {callData.callerName || 'Неизвестный контакт'}
        </Text>
        <Text style={styles.callTypeText}>
          {callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}
        </Text>
      </View>
      
      <View style={styles.incomingCallActions}>
        <TouchableOpacity style={styles.declineButton} onPress={declineCall}>
          <Text style={styles.callButtonIcon}>📞</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptButton} onPress={acceptCall}>
          <Text style={styles.callButtonIcon}>📞</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderActiveCall = () => (
    <View style={styles.activeCallContainer}>
      {callType === 'video' ? (
        <View style={styles.videoContainer}>
          {remoteStream && (
            <RTCView
              style={styles.remoteVideo}
              stream={remoteStream}
              objectFit="cover"
            />
          )}
          
          {localStream && (
            <RTCView
              style={styles.localVideo}
              stream={localStream}
              objectFit="cover"
              mirror={true}
            />
          )}
          
          <View style={styles.videoCallInfo}>
            <Text style={styles.videoCallName}>
              {callData.callerName || callData.targetName || 'Контакт'}
            </Text>
            <Text style={styles.videoCallStatus}>{getStatusText()}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.audioCallContainer}>
          <View style={styles.callerInfo}>
            <View style={styles.callerAvatar}>
              <Text style={styles.callerAvatarText}>
                {(callData.callerName || callData.targetName || '?').charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.callerName}>
              {callData.callerName || callData.targetName || 'Контакт'}
            </Text>
            <Text style={styles.callStatus}>{getStatusText()}</Text>
          </View>
        </View>
      )}
      
      <View style={styles.callControls}>
        <TouchableOpacity
          style={[styles.controlButton, isMuted && styles.controlButtonActive]}
          onPress={toggleMute}
        >
          <Text style={styles.controlButtonText}>{isMuted ? '🔇' : '🎤'}</Text>
        </TouchableOpacity>
        
        {callType === 'video' && (
          <>
            <TouchableOpacity
              style={[styles.controlButton, !isVideoEnabled && styles.controlButtonActive]}
              onPress={toggleVideo}
            >
              <Text style={styles.controlButtonText}>{isVideoEnabled ? '📹' : '📹'}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.controlButton} onPress={switchCamera}>
              <Text style={styles.controlButtonText}>🔄</Text>
            </TouchableOpacity>
          </>
        )}
        
        <TouchableOpacity
          style={[styles.controlButton, isSpeaker && styles.controlButtonActive]}
          onPress={toggleSpeaker}
        >
          <Text style={styles.controlButtonText}>{isSpeaker ? '🔊' : '🔉'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.endCallButton} onPress={endCall}>
          <Text style={styles.endCallButtonText}>📞</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {callStatus === 'incoming' ? renderIncomingCall() : renderActiveCall()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  incomingCallContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  callerInfo: {
    alignItems: 'center',
    marginBottom: 80,
  },
  callerAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  callerAvatarText: {
    fontSize: 48,
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: 'System',
  },
  callerName: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: 8,
    fontFamily: 'System',
    textAlign: 'center',
  },
  callTypeText: {
    fontSize: 16,
    color: '#cccccc',
    fontFamily: 'System',
  },
  incomingCallActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 200,
  },
  acceptButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '135deg' }],
  },
  callButtonIcon: {
    fontSize: 28,
    color: '#ffffff',
  },
  activeCallContainer: {
    flex: 1,
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
  },
  remoteVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000000',
  },
  localVideo: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 120,
    height: 160,
    backgroundColor: '#333333',
    borderRadius: 8,
    zIndex: 1,
  },
  videoCallInfo: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 1,
  },
  videoCallName: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: 'System',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  videoCallStatus: {
    fontSize: 14,
    color: '#cccccc',
    fontFamily: 'System',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  audioCallContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callStatus: {
    fontSize: 18,
    color: '#cccccc',
    fontFamily: 'System',
  },
  callControls: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 20,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#dc2626',
  },
  controlButtonText: {
    fontSize: 20,
    color: '#ffffff',
  },
  endCallButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallButtonText: {
    fontSize: 24,
    color: '#ffffff',
    transform: [{ rotate: '135deg' }],
  },
});

export default CallScreen;
