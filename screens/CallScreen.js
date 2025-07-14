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
  const { callType, isIncoming, callData } = route.params;
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
      // Инициализируем WebRTC сервис
      const userId = await AsyncStorage.getItem('userId');
      const token = await AsyncStorage.getItem('userToken');
      
      await WebRTCService.initialize('ws://localhost:3001', userId, token);
      
      // Настраиваем коллбэки
      WebRTCService.onLocalStream = (stream) => {
        setLocalStream(stream);
      };
      
      WebRTCService.onRemoteStream = (stream) => {
        setRemoteStream(stream);
        setCallStatus('connected');
        startCallTimer();
      };
      
      WebRTCService.onCallEnded = () => {
        endCall();
      };
      
      WebRTCService.onIncomingCall = (data) => {
        setCallStatus('incoming');
      };
      
      WebRTCService.onCallAccepted = () => {
        setCallStatus('connected');
        startCallTimer();
      };
      
      WebRTCService.onCallDeclined = () => {
        Alert.alert('Звонок отклонен', 'Пользователь отклонил звонок');
        navigation.goBack();
      };
      
      WebRTCService.onError = (error) => {
        Alert.alert('Ошибка звонка', error.error);
        navigation.goBack();
      };
      
      WebRTCService.onMediaStateChange = (data) => {
        // Обрабатываем изменения медиа состояния собеседника
        console.log('Media state changed:', data);
      };
      
      if (isIncoming) {
        // Входящий звонок - ждем решения пользователя
        setCallStatus('incoming');
      } else {
        // Исходящий звонок - инициируем
        await WebRTCService.initiateCall(callData.targetUserId, callType);
      }
      
    } catch (error) {
      console.error('Error initializing call:', error);
      Alert.alert('Ошибка', 'Не удалось инициализировать звонок');
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
      await WebRTCService.acceptCall(callData.roomId);
      setCallStatus('connecting');
    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert('Ошибка', 'Не удалось принять звонок');
      navigation.goBack();
    }
  };

  const declineCall = () => {
    WebRTCService.declineCall(callData.roomId);
    navigation.goBack();
  };

  const endCall = () => {
    WebRTCService.endCall();
    cleanup();
    navigation.goBack();
  };

  const cleanup = () => {
    if (callTimer.current) {
      clearInterval(callTimer.current);
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
    // Здесь нужно добавить логику переключения динамика
  };

  const formatCallDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const renderIncomingCall = () => (
    <View style={styles.incomingCallContainer}>
      <View style={styles.callerInfo}>
        <View style={styles.callerAvatar}>
          <Text style={styles.callerAvatarText}>
            {callData.callerName?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <Text style={styles.callerName}>{callData.callerName || 'Неизвестный'}</Text>
        <Text style={styles.callTypeText}>
          {callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок'}
        </Text>
      </View>
      
      <View style={styles.incomingCallActions}>
        <TouchableOpacity style={styles.declineButton} onPress={declineCall}>
          <Text style={styles.callButtonText}>📞</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.acceptButton} onPress={acceptCall}>
          <Text style={styles.callButtonText}>📞</Text>
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
        </View>
      ) : (
        <View style={styles.audioCallContainer}>
          <View style={styles.callerInfo}>
            <View style={styles.callerAvatar}>
              <Text style={styles.callerAvatarText}>
                {callData.callerName?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={styles.callerName}>{callData.callerName || 'Неизвестный'}</Text>
            <Text style={styles.callStatus}>
              {callStatus === 'connected' ? formatCallDuration(callDuration) : 'Подключение...'}
            </Text>
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
  },
  callButtonText: {
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
