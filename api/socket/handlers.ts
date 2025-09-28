import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { createClient } from '@supabase/supabase-js';
import { query } from '../config/database';
import { Message, User } from '../../shared/types';
import { Headers } from 'node-fetch';

// Polyfill Headers for Node.js environment
if (!globalThis.Headers) {
  globalThis.Headers = Headers as any;
}

interface AuthenticatedSocket extends Socket {
  user?: User;
}

interface SocketData {
  userId: string;
  email: string;
  role: string;
}

// Store active users
const activeUsers = new Map<string, string>(); // userId -> socketId
const userSockets = new Map<string, string>(); // socketId -> userId

// Supabase client will be initialized in setupSocketHandlers
let supabase: any;

// Authenticate socket connection
const authenticateSocket = async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify Supabase JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return next(new Error('Invalid authentication token'));
    }

    // Fetch user details from database
    const result = await query(
      `SELECT id, username, email, full_name, avatar_url, role, subscription_type, 
              created_at, updated_at
       FROM users WHERE id = $1 AND is_active = true`,
      [user.id]
    );

    if (result.rows.length === 0) {
      return next(new Error('User not found or inactive'));
    }

    socket.user = result.rows[0] as User;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication failed'));
  }
};

// Setup Socket.IO event handlers
export const setupSocketHandlers = (io: Server) => {
  // Initialize Supabase client for JWT verification
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('🔍 Environment check:');
  console.log('SUPABASE_URL:', supabaseUrl ? 'Set' : 'Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? 'Set' : 'Missing');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase configuration missing. Available env vars:', Object.keys(process.env).filter(key => key.includes('SUPABASE')));
    throw new Error('Supabase configuration missing');
  }

  supabase = createClient(supabaseUrl, supabaseServiceKey);
  console.log('✅ Supabase client initialized successfully');

  // Authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`🔌 User connected: ${socket.user?.username} (${socket.id})`);

    if (socket.user) {
      // Store user connection
      activeUsers.set(socket.user.id, socket.id);
      userSockets.set(socket.id, socket.user.id);

      // Join user to their personal room
      socket.join(`user:${socket.user.id}`);

      // Notify others that user is online
      socket.broadcast.emit('user:online', {
        userId: socket.user.id,
        username: socket.user.username,
        avatar_url: socket.user.avatar_url
      });

      // Send list of online users to the newly connected user
      const onlineUsers = Array.from(activeUsers.keys());
      socket.emit('users:online', onlineUsers);
    }

    // Handle private messages
    socket.on('message:send', async (data: {
      receiverId: string;
      content: string;
      messageType?: 'text' | 'image' | 'file';
      fileUrl?: string;
    }) => {
      try {
        if (!socket.user) {
          socket.emit('error', 'Authentication required');
          return;
        }

        const { receiverId, content, messageType = 'text', fileUrl } = data;

        // Validate receiver exists
        const receiverResult = await query(
          'SELECT id, username FROM users WHERE id = $1 AND is_active = true',
          [receiverId]
        );

        if (receiverResult.rows.length === 0) {
          socket.emit('error', 'Receiver not found');
          return;
        }

        // Save message to database
        const messageResult = await query(
          `INSERT INTO messages (sender_id, receiver_id, content, message_type, file_url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, sender_id, receiver_id, content, message_type, file_url, is_read, created_at`,
          [socket.user.id, receiverId, content, messageType, fileUrl]
        );

        const message = messageResult.rows[0] as Message;
        message.sender = socket.user;
        message.receiver = receiverResult.rows[0];

        // Send message to receiver if online
        const receiverSocketId = activeUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit('message:receive', message);
        }

        // Confirm message sent to sender
        socket.emit('message:sent', message);

        console.log(`💬 Message sent from ${socket.user.username} to ${receiverResult.rows[0].username}`);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', 'Failed to send message');
      }
    });

    // Handle message read status
    socket.on('message:read', async (messageId: string) => {
      try {
        if (!socket.user) {
          socket.emit('error', 'Authentication required');
          return;
        }

        // Update message read status
        const result = await query(
          `UPDATE messages SET is_read = true 
           WHERE id = $1 AND receiver_id = $2
           RETURNING sender_id`,
          [messageId, socket.user.id]
        );

        if (result.rows.length > 0) {
          const senderId = result.rows[0].sender_id;
          const senderSocketId = activeUsers.get(senderId);
          
          if (senderSocketId) {
            io.to(senderSocketId).emit('message:read', {
              messageId,
              readBy: socket.user.id
            });
          }
        }
      } catch (error) {
        console.error('Error marking message as read:', error);
        socket.emit('error', 'Failed to mark message as read');
      }
    });

    // Handle typing indicators
    socket.on('typing:start', (data: { receiverId: string }) => {
      if (!socket.user) return;
      
      const receiverSocketId = activeUsers.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing:start', {
          userId: socket.user.id,
          username: socket.user.username
        });
      }
    });

    socket.on('typing:stop', (data: { receiverId: string }) => {
      if (!socket.user) return;
      
      const receiverSocketId = activeUsers.get(data.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('typing:stop', {
          userId: socket.user.id
        });
      }
    });

    // Handle post interactions
    socket.on('post:like', async (data: { postId: string }) => {
      try {
        if (!socket.user) {
          socket.emit('error', 'Authentication required');
          return;
        }

        const { postId } = data;

        // Check if already liked
        const existingLike = await query(
          'SELECT id FROM likes WHERE user_id = $1 AND post_id = $2',
          [socket.user.id, postId]
        );

        if (existingLike.rows.length > 0) {
          socket.emit('error', 'Post already liked');
          return;
        }

        // Add like
        await query(
          'INSERT INTO likes (user_id, post_id) VALUES ($1, $2)',
          [socket.user.id, postId]
        );

        // Update likes count
        await query(
          'UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1',
          [postId]
        );

        // Broadcast like event
        io.emit('post:liked', {
          postId,
          userId: socket.user.id,
          username: socket.user.username
        });

        console.log(`👍 ${socket.user.username} liked post ${postId}`);
      } catch (error) {
        console.error('Error liking post:', error);
        socket.emit('error', 'Failed to like post');
      }
    });

    socket.on('post:unlike', async (data: { postId: string }) => {
      try {
        if (!socket.user) {
          socket.emit('error', 'Authentication required');
          return;
        }

        const { postId } = data;

        // Remove like
        const result = await query(
          'DELETE FROM likes WHERE user_id = $1 AND post_id = $2',
          [socket.user.id, postId]
        );

        if (result.rowCount === 0) {
          socket.emit('error', 'Like not found');
          return;
        }

        // Update likes count
        await query(
          'UPDATE posts SET likes_count = likes_count - 1 WHERE id = $1',
          [postId]
        );

        // Broadcast unlike event
        io.emit('post:unliked', {
          postId,
          userId: socket.user.id
        });

        console.log(`👎 ${socket.user.username} unliked post ${postId}`);
      } catch (error) {
        console.error('Error unliking post:', error);
        socket.emit('error', 'Failed to unlike post');
      }
    });

    // Handle new post notifications
    socket.on('post:new', async (data: { postId: string }) => {
      try {
        if (!socket.user) return;

        // Get post details
        const result = await query(
          `SELECT p.*, u.username, u.avatar_url
           FROM posts p
           JOIN users u ON p.author_id = u.id
           WHERE p.id = $1`,
          [data.postId]
        );

        if (result.rows.length > 0) {
          const post = result.rows[0];
          
          // Broadcast new post to all connected users except the author
          socket.broadcast.emit('post:new', {
            ...post,
            author: {
              id: post.author_id,
              username: post.username,
              avatar_url: post.avatar_url
            }
          });
        }
      } catch (error) {
        console.error('Error broadcasting new post:', error);
      }
    });

    // Handle user joining/leaving rooms (for group features)
    socket.on('room:join', (roomId: string) => {
      socket.join(roomId);
      socket.to(roomId).emit('user:joined', {
        userId: socket.user?.id,
        username: socket.user?.username
      });
      console.log(`🏠 ${socket.user?.username} joined room ${roomId}`);
    });

    socket.on('room:leave', (roomId: string) => {
      socket.leave(roomId);
      socket.to(roomId).emit('user:left', {
        userId: socket.user?.id,
        username: socket.user?.username
      });
      console.log(`🚪 ${socket.user?.username} left room ${roomId}`);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`🔌 User disconnected: ${socket.user?.username} (${reason})`);
      
      if (socket.user) {
        // Remove user from active users
        activeUsers.delete(socket.user.id);
        userSockets.delete(socket.id);

        // Notify others that user is offline
        socket.broadcast.emit('user:offline', {
          userId: socket.user.id,
          username: socket.user.username
        });
      }
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error(`Socket error for user ${socket.user?.username}:`, error);
    });
  });

  // Handle server errors
  io.engine.on('connection_error', (err) => {
    console.error('Socket.IO connection error:', err);
  });

  console.log('🚀 Socket.IO handlers initialized');
};

// Helper function to get online users count
export const getOnlineUsersCount = (): number => {
  return activeUsers.size;
};

// Helper function to check if user is online
export const isUserOnline = (userId: string): boolean => {
  return activeUsers.has(userId);
};

// Helper function to send notification to user if online
export const sendNotificationToUser = (io: Server, userId: string, notification: any) => {
  const socketId = activeUsers.get(userId);
  if (socketId) {
    io.to(socketId).emit('notification', notification);
    return true;
  }
  return false;
};