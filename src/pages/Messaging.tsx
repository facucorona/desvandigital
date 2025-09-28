import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { supabase } from '../supabase/config';
import { toast } from 'sonner';
import {
  Send,
  Search,
  Plus,
  MoreVertical,
  Phone,
  Video,
  Info,
  Paperclip,
  Smile,
  Image,
  File,
  Mic,
  Settings,
  Users,
  Hash,
  Lock,
  Globe,
  Star,
  Archive,
  Trash2,
  Edit,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  X,
  ArrowLeft,
  UserPlus,
  Crown,
  Shield
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  bio?: string;
  last_seen?: string;
  is_online?: boolean;
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id?: string;
  channel_id?: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  file_url?: string;
  file_name?: string;
  created_at: string;
  updated_at?: string;
  is_edited?: boolean;
  reply_to?: string;
  reactions?: { [emoji: string]: string[] };
  sender?: User;
}

interface Channel {
  id: string;
  name: string;
  description?: string;
  type: 'direct' | 'group' | 'public';
  created_by: string;
  created_at: string;
  members?: string[];
  last_message?: Message;
  unread_count?: number;
}

interface Conversation {
  id: string;
  type: 'direct' | 'channel';
  name: string;
  avatar?: string;
  last_message?: Message;
  unread_count: number;
  is_online?: boolean;
  last_seen?: string;
  participants?: User[];
}

const Messaging: React.FC = () => {
  const { user } = useAuth();
  const { socket, isConnected, onlineUsers } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserList, setShowUserList] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [channelType, setChannelType] = useState<'group' | 'public'>('group');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showSidebar, setShowSidebar] = useState(!isMobile);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const emojis = ['😀', '😂', '😍', '🥰', '😊', '😎', '🤔', '😢', '😡', '👍', '👎', '❤️', '🔥', '💯', '🎉', '👏'];

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setShowSidebar(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (user) {
      loadInitialData();
      setupRealtimeSubscriptions();
    }
  }, [user]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Listen for new messages
    socket.on('message:receive', (message: Message) => {
      setMessages(prev => [...prev, message]);
      
      // Update conversation list
      setConversations(prev => 
        prev.map(conv => {
          if (conv.type === 'direct' && conv.id === message.sender_id) {
            return {
              ...conv,
              last_message: message,
              unread_count: conv.unread_count + 1
            };
          }
          return conv;
        })
      );
    });

    // Listen for message sent confirmation
    socket.on('message:sent', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for typing indicators
    socket.on('typing:start', ({ userId, username }: { userId: string; username: string }) => {
      if (activeConversation?.id === userId) {
        setTypingUsers(prev => [...prev.filter(id => id !== userId), userId]);
      }
    });

    socket.on('typing:stop', ({ userId }: { userId: string }) => {
      setTypingUsers(prev => prev.filter(id => id !== userId));
    });

    // Listen for read receipts
    socket.on('message:read', ({ messageId }: { messageId: string }) => {
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, is_read: true } : msg
        )
      );
    });

    return () => {
      socket.off('message:receive');
      socket.off('message:sent');
      socket.off('typing:start');
      socket.off('typing:stop');
      socket.off('message:read');
    };
  }, [socket, activeConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadConversations(),
        loadUsers()
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast.error('Error al cargar los datos de mensajería');
    } finally {
      setLoading(false);
    }
  };

  const loadConversations = async () => {
    try {
      // Load direct conversations from messages
      const { data: directMessages, error: dmError } = await supabase
        .from('messages')
        .select(`
          *,
          sender:user_profiles!messages_sender_id_fkey(id, email, full_name, avatar_url),
          receiver:user_profiles!messages_receiver_id_fkey(id, email, full_name, avatar_url)
        `)
        .or(`sender_id.eq.${user?.id},receiver_id.eq.${user?.id}`)
        .order('created_at', { ascending: false });

      if (dmError) throw dmError;

      // Group messages by conversation partner
      const conversationMap = new Map<string, Conversation>();
      
      directMessages?.forEach(message => {
        const partnerId = message.sender_id === user?.id ? message.receiver_id : message.sender_id;
        const partner = message.sender_id === user?.id ? message.receiver : message.sender;
        
        if (!partnerId || !partner) return;
        
        if (!conversationMap.has(partnerId)) {
          conversationMap.set(partnerId, {
            id: partnerId,
            type: 'direct',
            name: partner.full_name || partner.email,
            avatar: partner.avatar_url,
            last_message: message,
            unread_count: 0,
            is_online: Math.random() > 0.5, // Mock online status
            participants: [partner]
          });
        }
      });

      // Load channels (mock data for now)
      const mockChannels: Conversation[] = [
        {
          id: 'general',
          type: 'channel',
          name: '# General',
          unread_count: 3,
          last_message: {
            id: 'mock1',
            content: 'Bienvenidos al canal general',
            sender_id: 'system',
            message_type: 'text',
            created_at: new Date().toISOString()
          }
        },
        {
          id: 'random',
          type: 'channel',
          name: '# Random',
          unread_count: 0,
          last_message: {
            id: 'mock2',
            content: '¿Alguien quiere charlar?',
            sender_id: 'user1',
            message_type: 'text',
            created_at: new Date(Date.now() - 3600000).toISOString()
          }
        }
      ];

      const allConversations = [...Array.from(conversationMap.values()), ...mockChannels];
      setConversations(allConversations);
      
      // Set first conversation as active if none selected
      if (!activeConversation && allConversations.length > 0) {
        setActiveConversation(allConversations[0]);
        loadMessages(allConversations[0]);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, email, full_name, avatar_url, bio')
        .neq('id', user?.id)
        .limit(50);

      if (error) throw error;
      
      const usersWithStatus = data?.map(u => ({
        ...u,
        is_online: Math.random() > 0.5,
        last_seen: new Date(Date.now() - Math.random() * 86400000).toISOString()
      })) || [];
      
      setUsers(usersWithStatus);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadMessages = async (conversation: Conversation) => {
    try {
      if (conversation.type === 'direct') {
        const { data, error } = await supabase
          .from('messages')
          .select(`
            *,
            sender:user_profiles!messages_sender_id_fkey(id, email, full_name, avatar_url)
          `)
          .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${conversation.id}),and(sender_id.eq.${conversation.id},receiver_id.eq.${user?.id})`)
          .order('created_at', { ascending: true })
          .limit(100);

        if (error) throw error;
        setMessages(data || []);
      } else {
        // Mock channel messages
        const mockMessages: Message[] = [
          {
            id: '1',
            content: 'Bienvenidos al canal ' + conversation.name,
            sender_id: 'system',
            channel_id: conversation.id,
            message_type: 'system',
            created_at: new Date(Date.now() - 86400000).toISOString(),
            sender: {
              id: 'system',
              email: 'system@desvan.com',
              full_name: 'Sistema'
            }
          },
          {
            id: '2',
            content: '¡Hola a todos! 👋',
            sender_id: user?.id || '',
            channel_id: conversation.id,
            message_type: 'text',
            created_at: new Date(Date.now() - 3600000).toISOString(),
            sender: {
              id: user?.id || '',
              email: user?.email || '',
              full_name: 'Tú'
            }
          }
        ];
        setMessages(mockMessages);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      toast.error('Error al cargar los mensajes');
    }
  };

  const setupRealtimeSubscriptions = () => {
    // Subscribe to new messages
    const messagesSubscription = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(sender_id.eq.${user?.id},receiver_id.eq.${user?.id})`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => [...prev, newMessage]);
          
          // Update conversation list
          setConversations(prev => 
            prev.map(conv => {
              if ((conv.type === 'direct' && conv.id === newMessage.sender_id) ||
                  (conv.type === 'channel' && conv.id === newMessage.channel_id)) {
                return {
                  ...conv,
                  last_message: newMessage,
                  unread_count: conv.unread_count + 1
                };
              }
              return conv;
            })
          );
        }
      )
      .subscribe();

    return () => {
      messagesSubscription.unsubscribe();
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeConversation || !user || !socket) return;

    try {
      if (activeConversation.type === 'direct') {
        // Send message via socket for real-time delivery
        socket.emit('message:send', {
          receiverId: activeConversation.id,
          content: newMessage.trim(),
          messageType: 'text'
        });
      } else {
        // Mock channel message sending
        const mockMessage: Message = {
          id: Date.now().toString(),
          content: newMessage.trim(),
          sender_id: user.id,
          channel_id: activeConversation.id,
          message_type: 'text',
          created_at: new Date().toISOString(),
          sender: {
            id: user.id,
            email: user.email || '',
            full_name: 'Tú'
          }
        };
        setMessages(prev => [...prev, mockMessage]);
      }

      setNewMessage('');
      setReplyTo(null);
      setShowEmojiPicker(false);
      
      // Stop typing indicator
      if (isTyping) {
        socket.emit('typing:stop', { receiverId: activeConversation.id });
        setIsTyping(false);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Error al enviar el mensaje');
    }
  };

  const startDirectConversation = async (targetUser: User) => {
    try {
      // Check if conversation already exists
      const existingConv = conversations.find(
        conv => conv.type === 'direct' && conv.id === targetUser.id
      );

      if (existingConv) {
        setActiveConversation(existingConv);
        loadMessages(existingConv);
      } else {
        // Create new conversation
        const newConversation: Conversation = {
          id: targetUser.id,
          type: 'direct',
          name: targetUser.full_name || targetUser.email,
          avatar: targetUser.avatar_url,
          unread_count: 0,
          is_online: targetUser.is_online,
          participants: [targetUser]
        };
        
        setConversations(prev => [newConversation, ...prev]);
        setActiveConversation(newConversation);
        setMessages([]);
      }
      
      setShowUserList(false);
      if (isMobile) {
        setShowSidebar(false);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast.error('Error al iniciar la conversación');
    }
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error('El nombre del canal es requerido');
      return;
    }

    try {
      // Mock channel creation
      const newChannel: Conversation = {
        id: newChannelName.toLowerCase().replace(/\s+/g, '-'),
        type: 'channel',
        name: '# ' + newChannelName,
        unread_count: 0
      };
      
      setConversations(prev => [...prev, newChannel]);
      setActiveConversation(newChannel);
      setMessages([]);
      
      setShowChannelModal(false);
      setNewChannelName('');
      setNewChannelDescription('');
      setSelectedUsers([]);
      
      toast.success('Canal creado exitosamente');
    } catch (error) {
      console.error('Error creating channel:', error);
      toast.error('Error al crear el canal');
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    try {
      // Mock reaction functionality
      setMessages(prev => 
        prev.map(msg => {
          if (msg.id === messageId) {
            const reactions = { ...msg.reactions };
            if (!reactions[emoji]) {
              reactions[emoji] = [];
            }
            
            const userIndex = reactions[emoji].indexOf(user?.id || '');
            if (userIndex > -1) {
              reactions[emoji].splice(userIndex, 1);
              if (reactions[emoji].length === 0) {
                delete reactions[emoji];
              }
            } else {
              reactions[emoji].push(user?.id || '');
            }
            
            return { ...msg, reactions };
          }
          return msg;
        })
      );
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
  };

  const markAsRead = async (messageId: string) => {
    if (!socket) return;
    
    try {
      // Emit read receipt via socket
      socket.emit('message:read', { messageId });
      
      // Update local state
      setMessages(prev => 
        prev.map(msg => 
          msg.id === messageId ? { ...msg, is_read: true } : msg
        )
      );
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleTyping = () => {
    if (!socket || !activeConversation) return;
    
    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing:start', { receiverId: activeConversation.id });
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing:stop', { receiverId: activeConversation.id });
    }, 2000);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Hoy';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-ES');
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="text-lg">Cargando mensajes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900">
      <div className="h-screen flex">
        {/* Sidebar */}
        <div className={`${showSidebar ? 'w-80' : 'w-0'} ${isMobile ? 'absolute inset-y-0 left-0 z-50' : 'relative'} bg-white shadow-lg transition-all duration-300 overflow-hidden`}>
          <div className="h-full flex flex-col">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-bold text-gray-900">Mensajes</h1>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setShowUserList(!showUserList)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <UserPlus className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => setShowChannelModal(true)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                  {isMobile && (
                    <button
                      onClick={() => setShowSidebar(false)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar conversaciones..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* User List */}
            {showUserList && (
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Iniciar conversación</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => startDirectConversation(user)}
                      className="w-full flex items-center space-x-3 p-2 hover:bg-white rounded-lg transition-colors"
                    >
                      <div className="relative">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            user.full_name?.charAt(0) || user.email.charAt(0)
                          )}
                        </div>
                        {user.is_online && (
                          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-gray-900">{user.full_name || user.email}</p>
                        <p className="text-xs text-gray-500">{user.is_online ? 'En línea' : 'Desconectado'}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Conversations List */}
            <div className="flex-1 overflow-y-auto">
              {filteredConversations.map((conversation) => (
                <button
                  key={conversation.id}
                  onClick={() => {
                    setActiveConversation(conversation);
                    loadMessages(conversation);
                    if (isMobile) {
                      setShowSidebar(false);
                    }
                  }}
                  className={`w-full p-4 flex items-center space-x-3 hover:bg-gray-50 transition-colors ${
                    activeConversation?.id === conversation.id ? 'bg-purple-50 border-r-2 border-purple-500' : ''
                  }`}
                >
                  <div className="relative">
                    {conversation.type === 'direct' ? (
                      <>
                        <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                          {conversation.avatar ? (
                            <img src={conversation.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            conversation.name.charAt(0)
                          )}
                        </div>
                        {conversation.is_online && (
                          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
                        )}
                      </>
                    ) : (
                      <div className="w-12 h-12 bg-gray-500 rounded-lg flex items-center justify-center text-white">
                        <Hash className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 text-left">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900 truncate">{conversation.name}</p>
                      {conversation.last_message && (
                        <span className="text-xs text-gray-500">
                          {formatTime(conversation.last_message.created_at)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-500 truncate">
                        {conversation.last_message?.content || 'Sin mensajes'}
                      </p>
                      {conversation.unread_count > 0 && (
                        <span className="bg-purple-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                          {conversation.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col">
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border-b border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {isMobile && (
                      <button
                        onClick={() => setShowSidebar(true)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </button>
                    )}
                    
                    <div className="relative">
                      {activeConversation.type === 'direct' ? (
                        <>
                          <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                            {activeConversation.avatar ? (
                              <img src={activeConversation.avatar} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              activeConversation.name.charAt(0)
                            )}
                          </div>
                          {activeConversation.is_online && (
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                          )}
                        </>
                      ) : (
                        <div className="w-10 h-10 bg-gray-500 rounded-lg flex items-center justify-center text-white">
                          <Hash className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <h2 className="font-semibold text-gray-900">{activeConversation.name}</h2>
                      <p className="text-sm text-gray-500">
                        {activeConversation.type === 'direct' 
                          ? (activeConversation.is_online ? 'En línea' : `Visto ${activeConversation.last_seen ? formatTime(activeConversation.last_seen) : 'hace tiempo'}`)
                          : `${activeConversation.participants?.length || 0} miembros`
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {activeConversation.type === 'direct' && (
                      <>
                        <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                          <Phone className="h-5 w-5" />
                        </button>
                        <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                          <Video className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                      <Info className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message, index) => {
                  const showDate = index === 0 || formatDate(message.created_at) !== formatDate(messages[index - 1].created_at);
                  const isOwn = message.sender_id === user?.id;
                  const showAvatar = !isOwn && (index === messages.length - 1 || messages[index + 1]?.sender_id !== message.sender_id);
                  
                  return (
                    <div key={message.id}>
                      {showDate && (
                        <div className="flex justify-center my-4">
                          <span className="bg-gray-200 text-gray-600 text-xs px-3 py-1 rounded-full">
                            {formatDate(message.created_at)}
                          </span>
                        </div>
                      )}
                      
                      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mb-4' : 'mb-1'}`}>
                        {!isOwn && showAvatar && (
                          <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold mr-2">
                            {message.sender?.avatar_url ? (
                              <img src={message.sender.avatar_url} alt="Avatar" className="w-full h-full rounded-full object-cover" />
                            ) : (
                              message.sender?.full_name?.charAt(0) || message.sender?.email?.charAt(0) || '?'
                            )}
                          </div>
                        )}
                        
                        {!isOwn && !showAvatar && <div className="w-8 mr-2" />}
                        
                        <div className={`max-w-xs lg:max-w-md ${isOwn ? 'ml-auto' : ''}`}>
                          {!isOwn && showAvatar && (
                            <p className="text-xs text-gray-500 mb-1 ml-1">
                              {message.sender?.full_name || message.sender?.email || 'Usuario'}
                            </p>
                          )}
                          
                          <div className={`relative group ${isOwn ? 'ml-auto' : ''}`}>
                            <div className={`px-4 py-2 rounded-2xl ${isOwn 
                              ? 'bg-purple-500 text-white' 
                              : message.message_type === 'system' 
                                ? 'bg-gray-100 text-gray-600 text-center'
                                : 'bg-gray-100 text-gray-900'
                            }`}>
                              {replyTo?.id === message.id && (
                                <div className="bg-black/10 rounded-lg p-2 mb-2 text-sm">
                                  <p className="font-medium">Respondiendo a {replyTo.sender?.full_name}</p>
                                  <p className="truncate">{replyTo.content}</p>
                                </div>
                              )}
                              
                              <p className="text-sm">{message.content}</p>
                              
                              {message.reactions && Object.keys(message.reactions).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {Object.entries(message.reactions).map(([emoji, users]) => (
                                    <button
                                      key={emoji}
                                      onClick={() => addReaction(message.id, emoji)}
                                      className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs ${
                                        users.includes(user?.id || '') 
                                          ? 'bg-purple-100 text-purple-700' 
                                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                      }`}
                                    >
                                      <span>{emoji}</span>
                                      <span>{users.length}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            
                            <div className="flex items-center justify-between mt-1">
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex items-center space-x-1">
                                  <button
                                    onClick={() => setReplyTo(message)}
                                    className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                  >
                                    <span className="text-xs">Responder</span>
                                  </button>
                                  <div className="relative">
                                    <button
                                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                                    >
                                      <Smile className="h-3 w-3" />
                                    </button>
                                    {showEmojiPicker && (
                                      <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10">
                                        <div className="grid grid-cols-4 gap-1">
                                          {emojis.map((emoji) => (
                                            <button
                                              key={emoji}
                                              onClick={() => {
                                                addReaction(message.id, emoji);
                                                setShowEmojiPicker(false);
                                              }}
                                              className="p-1 hover:bg-gray-100 rounded text-lg"
                                            >
                                              {emoji}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              <div className={`flex items-center space-x-1 text-xs ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>
                                <span>{formatTime(message.created_at)}</span>
                                {isOwn && (
                                  <CheckCheck className="h-3 w-3" />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {typingUsers.length > 0 && (
                  <div className="flex items-center space-x-2 text-gray-500">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm">{typingUsers.join(', ')} está escribiendo...</span>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              {/* Reply Preview */}
              {replyTo && (
                <div className="bg-gray-50 border-t border-gray-200 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-1 h-8 bg-purple-500 rounded"></div>
                      <div>
                        <p className="text-xs font-medium text-gray-600">
                          Respondiendo a {replyTo.sender?.full_name || 'Usuario'}
                        </p>
                        <p className="text-sm text-gray-800 truncate max-w-md">{replyTo.content}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setReplyTo(null)}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Message Input */}
              <div className="bg-white border-t border-gray-200 p-4">
                <div className="flex items-center space-x-3">
                  <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <Paperclip className="h-5 w-5" />
                  </button>
                  
                  <div className="flex-1 relative">
                    <input
                      ref={messageInputRef}
                      type="text"
                      value={newMessage}
                      onChange={(e) => {
                        setNewMessage(e.target.value);
                        handleTyping();
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Escribe un mensaje..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-full focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  
                  <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <Smile className="h-5 w-5" />
                  </button>
                  
                  <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                    <Mic className="h-5 w-5" />
                  </button>
                  
                  <button
                    onClick={sendMessage}
                    disabled={!newMessage.trim()}
                    className="p-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white rounded-lg transition-colors"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Selecciona una conversación</h3>
                <p className="text-gray-500">Elige una conversación de la lista para comenzar a chatear</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Channel Modal */}
      {showChannelModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Crear Canal</h3>
              <button
                onClick={() => setShowChannelModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nombre del Canal
                </label>
                <input
                  type="text"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value)}
                  placeholder="mi-canal-genial"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Descripción (opcional)
                </label>
                <textarea
                  value={newChannelDescription}
                  onChange={(e) => setNewChannelDescription(e.target.value)}
                  placeholder="¿De qué trata este canal?"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tipo de Canal
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="group"
                      checked={channelType === 'group'}
                      onChange={(e) => setChannelType(e.target.value as 'group' | 'public')}
                      className="mr-2"
                    />
                    <Lock className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-sm">Privado - Solo miembros invitados</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="public"
                      checked={channelType === 'public'}
                      onChange={(e) => setChannelType(e.target.value as 'group' | 'public')}
                      className="mr-2"
                    />
                    <Globe className="h-4 w-4 mr-2 text-gray-500" />
                    <span className="text-sm">Público - Cualquiera puede unirse</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowChannelModal(false)}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={createChannel}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              >
                Crear Canal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Messaging;