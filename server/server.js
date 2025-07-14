const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Хранение активных пользователей и комнат
const activeUsers = new Map();
const activeRooms = new Map();

console.log('🚀 Запуск WebRTC сигналингового сервера...');

// Обработка подключений
io.on('connection', (socket) => {
  console.log(`👤 Пользователь подключился: ${socket.id}`);
  
  // Регистрация пользователя
  socket.on('register', (data) => {
    const { userId } = data;
    activeUsers.set(userId, {
      socketId: socket.id,
      socket: socket,
      isInCall: false,
      currentRoom: null
    });
    
    console.log(`✅ Пользователь зарегистрирован: ${userId}`);
    
    // Уведомляем о подключении
    socket.broadcast.emit('user_online', { userId });
  });

  // Инициация звонка
  socket.on('call_user', (data) => {
    const { targetUserId, callType, offer } = data;
    console.log(`📞 Звонок от ${data.callerId || socket.id} к ${targetUserId}`);
    
    const targetUser = activeUsers.get(targetUserId);
    
    if (!targetUser) {
      socket.emit('call_error', { error: 'Пользователь не найден или офлайн' });
      return;
    }

    if (targetUser.isInCall) {
      socket.emit('call_error', { error: 'Пользователь занят' });
      return;
    }

    const roomId = `call_${socket.id}_${targetUserId}_${Date.now()}`;
    
    // Создаем комнату для звонка
    activeRooms.set(roomId, {
      participants: [socket.id, targetUserId],
      callType: callType,
      initiator: socket.id,
      startTime: new Date(),
      status: 'ringing'
    });

    // Отправляем предложение звонка
    targetUser.socket.emit('incoming_call', {
      callerId: socket.id,
      roomId: roomId,
      callType: callType,
      offer: offer
    });

    // Уведомляем инициатора
    socket.emit('call_initiated', { roomId });
    
    console.log(`🔔 Входящий звонок отправлен в комнату ${roomId}`);
  });

  // Принятие звонка
  socket.on('accept_call', (data) => {
    const { roomId, answer } = data;
    console.log(`✅ Звонок принят в комнате ${roomId}`);
    
    const room = activeRooms.get(roomId);
    if (!room) {
      socket.emit('call_error', { error: 'Комната не найдена' });
      return;
    }

    // Обновляем статус
    room.status = 'active';
    room.acceptTime = new Date();

    // Присоединяем к комнате
    socket.join(roomId);
    
    // Находим инициатора и присоединяем его тоже
    const initiatorSocketId = room.initiator;
    const initiatorSocket = io.sockets.sockets.get(initiatorSocketId);
    if (initiatorSocket) {
      initiatorSocket.join(roomId);
      initiatorSocket.emit('call_accepted', { roomId, answer });
    }

    // Обновляем статус пользователей
    room.participants.forEach(participantId => {
      const user = [...activeUsers.values()].find(u => u.socketId === participantId);
      if (user) {
        user.isInCall = true;
        user.currentRoom = roomId;
      }
    });
    
    console.log(`🎉 Звонок активен в комнате ${roomId}`);
  });

  // Отклонение звонка
  socket.on('decline_call', (data) => {
    const { roomId } = data;
    console.log(`❌ Звонок отклонен в комнате ${roomId}`);
    
    const room = activeRooms.get(roomId);
    if (room) {
      const initiatorSocketId = room.initiator;
      const initiatorSocket = io.sockets.sockets.get(initiatorSocketId);
      if (initiatorSocket) {
        initiatorSocket.emit('call_declined', { roomId });
      }
      activeRooms.delete(roomId);
    }
  });

  // Завершение звонка
  socket.on('end_call', (data) => {
    const { roomId } = data;
    console.log(`📴 Звонок завершен в комнате ${roomId}`);
    
    const room = activeRooms.get(roomId);
    if (room) {
      // Уведомляем всех участников
      io.to(roomId).emit('call_ended', { roomId });
      
      // Сбрасываем статус участников
      room.participants.forEach(participantId => {
        const user = [...activeUsers.values()].find(u => u.socketId === participantId);
        if (user) {
          user.isInCall = false;
          user.currentRoom = null;
        }
      });
      
      activeRooms.delete(roomId);
    }
  });

  // Обмен ICE кандидатами
  socket.on('ice_candidate', (data) => {
    const { roomId, candidate } = data;
    socket.to(roomId).emit('ice_candidate', {
      candidate: candidate,
      from: socket.id
    });
  });

  // Обмен SDP
  socket.on('sdp_exchange', (data) => {
    const { roomId, sdp, type } = data;
    socket.to(roomId).emit('sdp_exchange', {
      sdp: sdp,
      type: type,
      from: socket.id
    });
  });

  // Изменение состояния медиа
  socket.on('media_state_change', (data) => {
    const { roomId, mediaState } = data;
    socket.to(roomId).emit('media_state_change', {
      userId: socket.id,
      mediaState: mediaState
    });
  });

  // Отключение пользователя
  socket.on('disconnect', (reason) => {
    console.log(`👋 Пользователь отключился: ${socket.id}, причина: ${reason}`);
    
    // Находим пользователя
    let disconnectedUserId = null;
    for (const [userId, userData] of activeUsers.entries()) {
      if (userData.socketId === socket.id) {
        disconnectedUserId = userId;
        
        // Если был в звонке, завершаем его
        if (userData.currentRoom) {
          const room = activeRooms.get(userData.currentRoom);
          if (room) {
            io.to(userData.currentRoom).emit('call_ended', {
              roomId: userData.currentRoom,
              reason: 'disconnect'
            });
            activeRooms.delete(userData.currentRoom);
          }
        }
        
        activeUsers.delete(userId);
        break;
      }
    }
    
    if (disconnectedUserId) {
      socket.broadcast.emit('user_offline', { userId: disconnectedUserId });
    }
  });
});

// API для статистики
app.get('/api/stats', (req, res) => {
  res.json({
    activeUsers: activeUsers.size,
    activeRooms: activeRooms.size,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Запуск сервера
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 WebRTC сигналинговый сервер запущен на порту ${PORT}`);
  console.log(`📊 Статистика: http://localhost:${PORT}/api/stats`);
  console.log(`❤️  Здоровье: http://localhost:${PORT}/api/health`);
});

// Обработка ошибок
process.on('uncaughtException', (error) => {
  console.error('💥 Необработанная ошибка:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Необработанное отклонение промиса:', reason);
});

module.exports = app;const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Хранение активных соединений
const activeUsers = new Map();
const activeRooms = new Map();

// Middleware для аутентификации (в реальном приложении нужна полная проверка)
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  // В реальном приложении здесь будет проверка JWT токена
  socket.userId = socket.handshake.auth.userId;
  next();
};

io.use(authenticateSocket);

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.userId}`);
  
  // Регистрируем пользователя
  activeUsers.set(socket.userId, {
    socketId: socket.id,
    socket: socket,
    isInCall: false,
    currentRoom: null
  });

  // Уведомляем о подключении
  socket.broadcast.emit('user_online', {
    userId: socket.userId,
    timestamp: new Date().toISOString()
  });

  // Обработка инициации звонка
  socket.on('call_user', (data) => {
    const { targetUserId, callType, offer } = data;
    const targetUser = activeUsers.get(targetUserId);
    
    if (!targetUser) {
      socket.emit('call_error', { error: 'User not found or offline' });
      return;
    }

    if (targetUser.isInCall) {
      socket.emit('call_error', { error: 'User is busy' });
      return;
    }

    const roomId = `call_${socket.userId}_${targetUserId}`;
    
    // Создаем комнату для звонка
    activeRooms.set(roomId, {
      participants: [socket.userId, targetUserId],
      callType: callType,
      initiator: socket.userId,
      startTime: new Date().toISOString(),
      status: 'ringing'
    });

    // Отправляем предложение звонка
    targetUser.socket.emit('incoming_call', {
      callerId: socket.userId,
      roomId: roomId,
      callType: callType,
      offer: offer
    });

    // Уведомляем инициатора о том, что звонок отправлен
    socket.emit('call_initiated', {
      roomId: roomId,
      targetUserId: targetUserId
    });
  });

  // Обработка принятия звонка
  socket.on('accept_call', (data) => {
    const { roomId, answer } = data;
    const room = activeRooms.get(roomId);
    
    if (!room) {
      socket.emit('call_error', { error: 'Room not found' });
      return;
    }

    const initiatorId = room.initiator;
    const initiator = activeUsers.get(initiatorId);
    
    if (!initiator) {
      socket.emit('call_error', { error: 'Initiator not found' });
      return;
    }

    // Обновляем статус участников
    activeUsers.get(socket.userId).isInCall = true;
    activeUsers.get(socket.userId).currentRoom = roomId;
    activeUsers.get(initiatorId).isInCall = true;
    activeUsers.get(initiatorId).currentRoom = roomId;

    // Обновляем статус комнаты
    room.status = 'active';
    room.acceptTime = new Date().toISOString();

    // Присоединяем пользователей к комнате
    socket.join(roomId);
    initiator.socket.join(roomId);

    // Отправляем ответ инициатору
    initiator.socket.emit('call_accepted', {
      roomId: roomId,
      answer: answer
    });
  });

  // Обработка отклонения звонка
  socket.on('decline_call', (data) => {
    const { roomId, reason } = data;
    const room = activeRooms.get(roomId);
    
    if (!room) {
      return;
    }

    const initiatorId = room.initiator;
    const initiator = activeUsers.get(initiatorId);
    
    if (initiator) {
      initiator.socket.emit('call_declined', {
        roomId: roomId,
        reason: reason || 'declined'
      });
    }

    // Удаляем комнату
    activeRooms.delete(roomId);
  });

  // Обработка завершения звонка
  socket.on('end_call', (data) => {
    const { roomId } = data;
    const room = activeRooms.get(roomId);
    
    if (!room) {
      return;
    }

    // Уведомляем всех участников о завершении звонка
    room.participants.forEach(userId => {
      const user = activeUsers.get(userId);
      if (user) {
        user.socket.emit('call_ended', {
          roomId: roomId,
          endedBy: socket.userId
        });
        
        // Сбрасываем статус звонка
        user.isInCall = false;
        user.currentRoom = null;
        user.socket.leave(roomId);
      }
    });

    // Удаляем комнату
    activeRooms.delete(roomId);
  });

  // Обработка ICE кандидатов
  socket.on('ice_candidate', (data) => {
    const { roomId, candidate } = data;
    const room = activeRooms.get(roomId);
    
    if (!room) {
      return;
    }

    // Отправляем ICE кандидат другим участникам
    socket.to(roomId).emit('ice_candidate', {
      candidate: candidate,
      from: socket.userId
    });
  });

  // Обработка обмена SDP
  socket.on('sdp_exchange', (data) => {
    const { roomId, sdp, type } = data;
    const room = activeRooms.get(roomId);
    
    if (!room) {
      return;
    }

    // Отправляем SDP другим участникам
    socket.to(roomId).emit('sdp_exchange', {
      sdp: sdp,
      type: type,
      from: socket.userId
    });
  });

  // Обработка изменения статуса медиа (включение/выключение камеры, микрофона)
  socket.on('media_state_change', (data) => {
    const { roomId, mediaState } = data;
    const room = activeRooms.get(roomId);
    
    if (!room) {
      return;
    }

    // Уведомляем других участников об изменении
    socket.to(roomId).emit('media_state_change', {
      userId: socket.userId,
      mediaState: mediaState
    });
  });

  // Обработка отключения пользователя
  socket.on('disconnect', (reason) => {
    console.log(`User disconnected: ${socket.userId}, reason: ${reason}`);
    
    const user = activeUsers.get(socket.userId);
    if (user && user.currentRoom) {
      // Если пользователь был в звонке, завершаем его
      const room = activeRooms.get(user.currentRoom);
      if (room) {
        // Уведомляем других участников
        room.participants.forEach(userId => {
          if (userId !== socket.userId) {
            const otherUser = activeUsers.get(userId);
            if (otherUser) {
              otherUser.socket.emit('call_ended', {
                roomId: user.currentRoom,
                endedBy: socket.userId,
                reason: 'disconnect'
              });
              otherUser.isInCall = false;
              otherUser.currentRoom = null;
            }
          }
        });
        
        activeRooms.delete(user.currentRoom);
      }
    }

    // Удаляем пользователя из активных
    activeUsers.delete(socket.userId);
    
    // Уведомляем о отключении
    socket.broadcast.emit('user_offline', {
      userId: socket.userId,
      timestamp: new Date().toISOString()
    });
  });

  // Обработка получения списка онлайн пользователей
  socket.on('get_online_users', () => {
    const onlineUsers = Array.from(activeUsers.keys());
    socket.emit('online_users', onlineUsers);
  });

  // Обработка проверки статуса пользователя
  socket.on('check_user_status', (data) => {
    const { userId } = data;
    const user = activeUsers.get(userId);
    
    socket.emit('user_status', {
      userId: userId,
      isOnline: !!user,
      isInCall: user ? user.isInCall : false
    });
  });
});

// REST API эндпоинты
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    activeUsers: activeUsers.size,
    activeRooms: activeRooms.size
  });
});

app.get('/api/stats', (req, res) => {
  res.json({
    activeUsers: activeUsers.size,
    activeRooms: activeRooms.size,
    rooms: Array.from(activeRooms.entries()).map(([id, room]) => ({
      id,
      participants: room.participants.length,
      callType: room.callType,
      status: room.status,
      duration: room.acceptTime ? 
        Date.now() - new Date(room.acceptTime).getTime() : 
        Date.now() - new Date(room.startTime).getTime()
    }))
  });
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Запуск сервера
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`WebRTC Signaling Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Stats: http://localhost:${PORT}/api/stats`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
