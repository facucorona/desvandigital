// Shared types for the Desván Digital platform

// User types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark';
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    marketing: boolean;
  };
}

// Authentication types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken: string;
}

// Product types
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  tags: string[];
  images: string[];
  inStock: boolean;
  stockQuantity: number;
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  sellerId: string;
  sellerName: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  productCount: number;
}

// Order types
export interface Order {
  id: string;
  userId: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shippingAddress: Address;
  billingAddress: Address;
  paymentMethod: string;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  createdAt: string;
  updatedAt: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  quantity: number;
  price: number;
  totalPrice: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

// Study Routes types
export interface StudyRoute {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: number; // in minutes
  lessons: Lesson[];
  tags: string[];
  thumbnail: string;
  rating: number;
  enrollmentCount: number;
  price: number;
  isPremium: boolean;
  instructorId: string;
  instructorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  content: string;
  type: 'video' | 'text' | 'quiz' | 'assignment';
  duration: number;
  order: number;
  isCompleted: boolean;
  resources: LessonResource[];
}

export interface LessonResource {
  id: string;
  name: string;
  type: 'pdf' | 'video' | 'link' | 'image';
  url: string;
  size?: number;
}

// Social Network types
export interface Post {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  images: string[];
  likes: number;
  comments: Comment[];
  shares: number;
  isLiked: boolean;
  isBookmarked: boolean;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  visibility: 'public' | 'friends' | 'private';
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  likes: number;
  isLiked: boolean;
  createdAt: string;
  replies: Reply[];
}

export interface Reply {
  id: string;
  commentId: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  likes: number;
  isLiked: boolean;
  createdAt: string;
}

// Messaging types
export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: 'text' | 'image' | 'file' | 'audio' | 'video';
  timestamp: string;
  status: 'sent' | 'delivered' | 'read';
  replyTo?: string;
  edited?: boolean;
  reactions?: MessageReaction[];
}

export interface MessageReaction {
  emoji: string;
  userId: string;
  timestamp: string;
}

export interface Chat {
  id: string;
  type: 'direct' | 'group';
  name: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  avatar?: string;
  isOnline?: boolean;
  lastSeen?: string;
  isTyping?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Dashboard types
export interface DashboardItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'folder';
  size: number;
  url?: string;
  thumbnail?: string;
  parentId?: string;
  tags: string[];
  isStarred: boolean;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface DashboardStats {
  totalItems: number;
  totalSize: number;
  itemsByType: Record<string, number>;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  type: 'upload' | 'download' | 'share' | 'delete' | 'rename';
  itemName: string;
  timestamp: string;
  details?: string;
}

// 3D Attic types
export interface AtticObject {
  id: string;
  name: string;
  type: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  color: string;
  texture?: string;
  model?: string;
  metadata: Record<string, any>;
  links: ObjectLink[];
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface ObjectLink {
  id: string;
  sourceObjectId: string;
  targetObjectId: string;
  linkType: 'reference' | 'dependency' | 'related';
  description?: string;
  createdAt: string;
}

// Design Account types
export interface DesignProject {
  id: string;
  name: string;
  description: string;
  canvas: CanvasData;
  thumbnail: string;
  isPublic: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  userId: string;
  collaborators: string[];
}

export interface CanvasData {
  width: number;
  height: number;
  backgroundColor: string;
  layers: CanvasLayer[];
  version: number;
}

export interface CanvasLayer {
  id: string;
  name: string;
  type: 'shape' | 'text' | 'image' | 'group';
  visible: boolean;
  locked: boolean;
  opacity: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  rotation: number;
  properties: Record<string, any>;
  children?: CanvasLayer[];
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Error types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

// Notification types
export interface Notification {
  id: string;
  userId: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  isRead: boolean;
  actionUrl?: string;
  actionText?: string;
  createdAt: string;
  expiresAt?: string;
}

// Search types
export interface SearchResult {
  id: string;
  type: 'product' | 'post' | 'user' | 'study_route' | 'design';
  title: string;
  description: string;
  thumbnail?: string;
  url: string;
  relevance: number;
  createdAt: string;
}

export interface SearchFilters {
  type?: string[];
  category?: string[];
  priceRange?: { min: number; max: number };
  dateRange?: { start: string; end: string };
  tags?: string[];
  sortBy?: 'relevance' | 'date' | 'price' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

// Analytics types
export interface AnalyticsData {
  pageViews: number;
  uniqueVisitors: number;
  bounceRate: number;
  averageSessionDuration: number;
  topPages: PageAnalytics[];
  userGrowth: GrowthData[];
  revenueData: RevenueData[];
}

export interface PageAnalytics {
  path: string;
  views: number;
  uniqueViews: number;
  averageTime: number;
}

export interface GrowthData {
  date: string;
  users: number;
  newUsers: number;
}

export interface RevenueData {
  date: string;
  revenue: number;
  orders: number;
  averageOrderValue: number;
}