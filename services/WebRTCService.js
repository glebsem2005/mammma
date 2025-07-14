import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, mediaDevices } from 'react-native-webrtc';
import io from 'socket.io-client';

class WebRTCService {
  constructor() {
    this.socket = null;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.isInitiator = false;
    this.currentRoomId = null;
    this.callType = null;
    this.userId = null;
    
    // Callbacks
    this.onRemoteStream = null;
    this.onLocalStream = null;
    this.onCallEnded = null;
    this.onIncomingCall = null;
    this.onCallAccepted = null;
    this.onCallDeclined = null;
    this.onError = null;
    this.onCallInitiated = null;
    
    // ICE серверы
    this.iceServers = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];
  }

  /**
   * Инициализация соединения с сигналинговым сервером
   */
  async initialize(serverUrl, userId) {
    try {
      console.log('🔗 Подключаемся к серверу WebRTC...');
      
      this.userId = userId;
      this.socket = io(serverUrl, {
        transports: ['websocket']
      });

      this.setupSocketListeners();
      
      return new Promise((resolve, reject) => {
        this.socket.on('connect', () => {
          console.log('✅ Подключились к серверу WebRTC');
          
          // Регистрируем пользователя
          this.socket.emit('register', { userId: this.userId });
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          console.error('❌ Ошибка подключения:', error);
          reject(error);
        });
      });
      
    } catch (error) {
      console.error('❌ Ошибка инициализации WebRTC:', error);
      throw error;
    }
  }

  /**
   * Настройка обработчиков событий сокета
   */
  setupSocketListeners() {
    // Входящий звонок
    this.socket.on('incoming_call', (data) => {
      console.log('📞 Входящий звонок:', data);
      this.currentRoomId = data.roomId;
      this.callType = data.callType;
      this.isInitiator = false;
      
      if (this.onIncomingCall) {
        this.onIncomingCall(data);
      }
    });

    // Звонок принят
    this.socket.on('call_accepted', async (data) => {
      console.log('✅ Звонок принят:', data);
      try {
        if (data.answer) {
          const answer = new RTCSessionDescription(data.answer);
          await this.peerConnection.setRemoteDescription(answer);
        }
        
        if (this.onCallAccepted) {
          this.onCallAccepted(data);
        }
      } catch (error) {
        console.error('❌ Ошибка обработки принятого звонка:', error);
      }
    });

    // Звонок отклонен
    this.socket.on('call_declined', (data) => {
      console.log('❌ Звонок отклонен:', data);
      this.cleanup();
      
      if (this.onCallDeclined) {
        this.onCallDeclined(data);
      }
    });

    // Звонок завершен
    this.socket.on('call_ended', (data) => {
      console.log('📴 Звонок завершен:', data);
      this.cleanup();
      
      if (this.onCallEnded) {
        this.onCallEnded(data);
      }
    });

    // Звонок инициирован
    this.socket.on('call_initiated', (data) => {
      console.log('📞 Звонок инициирован:', data);
      if (this.onCallInitiated) {
        this.onCallInitiated(data);
      }
    });

    // ICE кандидат
    this.socket.on('ice_candidate', async (data) => {
      console.log('🧊 Получен ICE кандидат:', data);
      try {
        if (this.peerConnection) {
          const candidate = new RTCIceCandidate(data.candidate);
          await this.peerConnection.addIceCandidate(candidate);
        }
      } catch (error) {
        console.error('❌ Ошибка добавления ICE кандидата:', error);
      }
    });

    // Обмен SDP
    this.socket.on('sdp_exchange', async (data) => {
      console.log('📡 Получен SDP:', data);
      try {
        if (this.peerConnection) {
          const sessionDescription = new RTCSessionDescription({
            sdp: data.sdp,
            type: data.type
          });
          await this.peerConnection.setRemoteDescription(sessionDescription);
        }
      } catch (error) {
        console.error('❌ Ошибка обработки SDP:', error);
      }
    });

    // Ошибки звонка
    this.socket.on('call_error', (data) => {
      console.error('❌ Ошибка звонка:', data);
      this.cleanup();
      
      if (this.onError) {
        this.onError(data);
      }
    });
  }

  /**
   * Создание peer connection
   */
  createPeerConnection() {
    try {
      console.log('🔗 Создаем peer connection...');
      
      this.peerConnection = new RTCPeerConnection({
        iceServers: this.iceServers,
        iceCandidatePoolSize: 10,
      });

      // Обработка ICE кандидатов
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate && this.currentRoomId) {
          console.log('🧊 Отправляем ICE кандидат');
          this.socket.emit('ice_candidate', {
            roomId: this.currentRoomId,
            candidate: event.candidate
          });
        }
      };

      // Обработка удаленного потока
      this.peerConnection.onaddstream = (event) => {
        console.log('📺 Получен удаленный поток');
        this.remoteStream = event.stream;
        
        if (this.onRemoteStream) {
          this.onRemoteStream(event.stream);
        }
      };

      // Обработка состояния соединения
      this.peerConnection.oniceconnectionstatechange = () => {
        console.log('🔄 Состояние ICE:', this.peerConnection.iceConnectionState);
        
        if (this.peerConnection.iceConnectionState === 'disconnected' ||
            this.peerConnection.iceConnectionState === 'failed') {
          this.endCall();
        }
      };
      
      console.log('✅ Peer connection создан');
    } catch (error) {
      console.error('❌ Ошибка создания peer connection:', error);
      throw error;
    }
  }

  /**
   * Получение локального медиа потока
   */
  async getLocalStream(isVideoCall = false) {
    try {
      console.log(`📹 Получаем локальный поток (видео: ${isVideoCall})`);
      
      const constraints = {
        audio: true,
        video: isVideoCall ? {
          mandatory: {
            minWidth: 320,
            minHeight: 240,
            minFrameRate: 30,
          },
          facingMode: 'user',
        } : false,
      };

      const stream = await mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      
      console.log('✅ Локальный поток получен');
      
      if (this.onLocalStream) {
        this.onLocalStream(stream);
      }
      
      return stream;
    } catch (error) {
      console.error('❌ Ошибка получения медиа потока:', error);
      throw error;
    }
  }

  /**
   * Инициация звонка
   */
  async initiateCall(targetUserId, callType = 'audio') {
    try {
      console.log(`📞 Инициируем ${callType} звонок к ${targetUserId}`);
      
      this.isInitiator = true;
      this.callType = callType;
      
      // Получаем локальный поток
      await this.getLocalStream(callType === 'video');
      
      // Создаем peer connection
      this.createPeerConnection();
      
      // Добавляем локальный поток
      if (this.localStream) {
        this.peerConnection.addStream(this.localStream);
      }
      
      // Создаем offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      // Отправляем предложение звонка
      this.socket.emit('call_user', {
        targetUserId: targetUserId,
        callType: callType,
        offer: offer,
        callerId: this.userId
      });
      
      console.log('✅ Звонок инициирован');
      
    } catch (error) {
      console.error('❌ Ошибка инициации звонка:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Принятие звонка
   */
  async acceptCall(roomId) {
    try {
      console.log(`✅ Принимаем звонок в комнате ${roomId}`);
      
      this.currentRoomId = roomId;
      
      // Получаем локальный поток
      await this.getLocalStream(this.callType === 'video');
      
      // Создаем peer connection
      this.createPeerConnection();
      
      // Добавляем локальный поток
      if (this.localStream) {
        this.peerConnection.addStream(this.localStream);
      }
      
      // Создаем answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      // Отправляем ответ
      this.socket.emit('accept_call', {
        roomId: roomId,
        answer: answer
      });
      
      console.log('✅ Звонок принят');
      
    } catch (error) {
      console.error('❌ Ошибка принятия звонка:', error);
      this.cleanup();
      throw error;
    }
  }

  /**
   * Отклонение звонка
   */
  declineCall(roomId, reason = 'declined') {
    console.log(`❌ Отклоняем звонок в комнате ${roomId}`);
    
    this.socket.emit('decline_call', {
      roomId: roomId,
      reason: reason
    });
    this.cleanup();
  }

  /**
   * Завершение звонка
   */
  endCall() {
    console.log('📴 Завершаем звонок');
    
    if (this.currentRoomId) {
      this.socket.emit('end_call', {
        roomId: this.currentRoomId
      });
    }
    this.cleanup();
  }

  /**
   * Переключение микрофона
   */
  toggleMicrophone() {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      if (audioTracks.length > 0) {
        const enabled = !audioTracks[0].enabled;
        audioTracks[0].enabled = enabled;
        console.log(`🎤 Микрофон ${enabled ? 'включен' : 'выключен'}`);
        return enabled;
      }
    }
    return false;
  }

  /**
   * Переключение камеры
   */
  toggleCamera() {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        const enabled = !videoTracks[0].enabled;
        videoTracks[0].enabled = enabled;
        console.log(`📹 Камера ${enabled ? 'включена' : 'выключена'}`);
        return enabled;
      }
    }
    return false;
  }

  /**
   * Переключение камеры (передняя/задняя)
   */
  switchCamera() {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      if (videoTracks.length > 0) {
        videoTracks[0]._switchCamera();
        console.log('🔄 Камера переключена');
      }
    }
  }

  /**
   * Очистка ресурсов
   */
  cleanup() {
    console.log('🧹 Очищаем ресурсы WebRTC');
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    this.remoteStream = null;
    this.currentRoomId = null;
    this.callType = null;
    this.isInitiator = false;
  }

  /**
   * Отключение от сигналингового сервера
   */
  disconnect() {
    console.log('🔌 Отключаемся от сервера WebRTC');
    
    this.cleanup();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new WebRTCService();
