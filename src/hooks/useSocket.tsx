import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { Message, Chat } from '../../shared/types';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  onlineUsers: string[];
  typingUsers: Record<string, string[]>;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (message: Omit<Message, 'id' | 'timestamp' | 'status'>) => void;
  startTyping: (chatId: string) => void;
  stopTyping: (chatId: string) => void;
  markAsRead: (messageId: string) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

interface SocketProviderProps {
  children: ReactNode;
}

export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});
  const { user, session } = useAuth();

  useEffect(() => {
    if (user && session) {
      // Initialize socket connection
      const newSocket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001', {
        auth: {
          token: session.access_token,
          userId: user.id
        },
        transports: ['websocket', 'polling']
      });

      // Connection event handlers
      newSocket.on('connect', () => {
        console.log('Socket connected:', newSocket.id);
        setIsConnected(true);
      });

      newSocket.on('disconnect', () => {
        console.log('Socket disconnected');
        setIsConnected(false);
      });

      newSocket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setIsConnected(false);
      });

      // User presence handlers
      newSocket.on('users_online', (users: string[]) => {
        setOnlineUsers(users);
      });

      newSocket.on('user_joined', (userId: string) => {
        setOnlineUsers(prev => [...prev.filter(id => id !== userId), userId]);
      });

      newSocket.on('user_left', (userId: string) => {
        setOnlineUsers(prev => prev.filter(id => id !== userId));
      });

      // Typing indicators
      newSocket.on('user_typing', ({ chatId, userId }: { chatId: string; userId: string }) => {
        setTypingUsers(prev => ({
          ...prev,
          [chatId]: [...(prev[chatId] || []).filter(id => id !== userId), userId]
        }));
      });

      newSocket.on('user_stopped_typing', ({ chatId, userId }: { chatId: string; userId: string }) => {
        setTypingUsers(prev => ({
          ...prev,
          [chatId]: (prev[chatId] || []).filter(id => id !== userId)
        }));
      });

      // Message handlers
      newSocket.on('new_message', (message: Message) => {
        // This will be handled by the messaging component
        console.log('New message received:', message);
      });

      newSocket.on('message_read', ({ messageId, userId }: { messageId: string; userId: string }) => {
        // This will be handled by the messaging component
        console.log('Message read:', messageId, 'by:', userId);
      });

      setSocket(newSocket);

      return () => {
        newSocket.close();
        setSocket(null);
        setIsConnected(false);
        setOnlineUsers([]);
        setTypingUsers({});
      };
    }
  }, [user, session]);

  const joinRoom = (roomId: string) => {
    if (socket) {
      socket.emit('join_room', roomId);
    }
  };

  const leaveRoom = (roomId: string) => {
    if (socket) {
      socket.emit('leave_room', roomId);
    }
  };

  const sendMessage = (message: Omit<Message, 'id' | 'timestamp' | 'status'>) => {
    if (socket) {
      socket.emit('send_message', message);
    }
  };

  const startTyping = (chatId: string) => {
    if (socket) {
      socket.emit('start_typing', { chatId });
    }
  };

  const stopTyping = (chatId: string) => {
    if (socket) {
      socket.emit('stop_typing', { chatId });
    }
  };

  const markAsRead = (messageId: string) => {
    if (socket) {
      socket.emit('mark_as_read', { messageId });
    }
  };

  const value: SocketContextType = {
    socket,
    isConnected,
    onlineUsers,
    typingUsers,
    joinRoom,
    leaveRoom,
    sendMessage,
    startTyping,
    stopTyping,
    markAsRead
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};