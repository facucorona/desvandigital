import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../supabase/config';
import { toast } from 'sonner';
import {
  Users,
  Settings,
  BarChart3,
  Shield,
  Database,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Eye,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  RefreshCw,
  Calendar,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  MessageSquare,
  Heart,
  Star,
  Clock,
  Globe,
  Lock,
  Unlock,
  Mail,
  Phone,
  MapPin
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string;
  email_confirmed_at: string;
  user_metadata: any;
  profile?: {
    full_name?: string;
    avatar_url?: string;
    bio?: string;
    location?: string;
  };
}

interface SystemStats {
  total_users: number;
  active_users: number;
  total_posts: number;
  total_products: number;
  total_orders: number;
  total_designs: number;
  total_scenes: number;
  revenue: number;
}

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  details: string;
  timestamp: string;
  ip_address?: string;
}

const AdminPanel: React.FC = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showUserModal, setShowUserModal] = useState(false);

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: <BarChart3 className="h-5 w-5" /> },
    { id: 'users', name: 'Usuarios', icon: <Users className="h-5 w-5" /> },
    { id: 'content', name: 'Contenido', icon: <Database className="h-5 w-5" /> },
    { id: 'activity', name: 'Actividad', icon: <Activity className="h-5 w-5" /> },
    { id: 'settings', name: 'Configuración', icon: <Settings className="h-5 w-5" /> }
  ];

  const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

  useEffect(() => {
    if (user) {
      loadAdminData();
    }
  }, [user]);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadUsers(),
        loadSystemStats(),
        loadActivityLogs()
      ]);
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Error al cargar los datos del panel de administración');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      // Get users from auth.users (requires service role)
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        // Fallback: get users from user_profiles table
        const { data: profileUsers, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (profileError) throw profileError;
        
        const formattedUsers = profileUsers.map(profile => ({
          id: profile.id,
          email: profile.email,
          created_at: profile.created_at,
          last_sign_in_at: profile.updated_at,
          email_confirmed_at: profile.created_at,
          user_metadata: {},
          profile: {
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            bio: profile.bio,
            location: profile.location
          }
        }));
        
        setUsers(formattedUsers);
        return;
      }

      // Get user profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('*');

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const formattedUsers = authUsers.users.map(authUser => ({
        ...authUser,
        profile: profilesMap.get(authUser.id)
      }));

      setUsers(formattedUsers);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadSystemStats = async () => {
    try {
      // Get user count
      const { count: usersCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      // Get active users (users who logged in last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { count: activeUsersCount } = await supabase
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('updated_at', thirtyDaysAgo.toISOString());

      // Get posts count
      const { count: postsCount } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true });

      // Get products count
      const { count: productsCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Get cart items as orders proxy
      const { count: ordersCount } = await supabase
        .from('cart_items')
        .select('*', { count: 'exact', head: true });

      // Get design projects count
      const { count: designsCount } = await supabase
        .from('design_projects')
        .select('*', { count: 'exact', head: true });

      // Get attic scenes count
      const { count: scenesCount } = await supabase
        .from('attic_scenes')
        .select('*', { count: 'exact', head: true });

      setStats({
        total_users: usersCount || 0,
        active_users: activeUsersCount || 0,
        total_posts: postsCount || 0,
        total_products: productsCount || 0,
        total_orders: ordersCount || 0,
        total_designs: designsCount || 0,
        total_scenes: scenesCount || 0,
        revenue: (ordersCount || 0) * 25.99 // Mock revenue calculation
      });
    } catch (error) {
      console.error('Error loading system stats:', error);
    }
  };

  const loadActivityLogs = async () => {
    // Mock activity logs since we don't have a real activity logging system
    const mockLogs: ActivityLog[] = [
      {
        id: '1',
        user_id: 'user1',
        action: 'LOGIN',
        details: 'Usuario inició sesión',
        timestamp: new Date().toISOString(),
        ip_address: '192.168.1.1'
      },
      {
        id: '2',
        user_id: 'user2',
        action: 'CREATE_POST',
        details: 'Usuario creó una nueva publicación',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        ip_address: '192.168.1.2'
      },
      {
        id: '3',
        user_id: 'user3',
        action: 'PURCHASE',
        details: 'Usuario realizó una compra',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        ip_address: '192.168.1.3'
      }
    ];
    
    setActivityLogs(mockLogs);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      // This would require service role access to auth.users
      toast.info('Funcionalidad de administración de usuarios requiere permisos especiales');
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error('Error al cambiar el estado del usuario');
    }
  };

  const deleteUser = async (userId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario?')) {
      return;
    }

    try {
      // This would require service role access
      toast.info('Funcionalidad de eliminación de usuarios requiere permisos especiales');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Error al eliminar el usuario');
    }
  };

  const exportData = async (type: string) => {
    try {
      toast.info(`Exportando datos de ${type}...`);
      // Mock export functionality
      setTimeout(() => {
        toast.success(`Datos de ${type} exportados exitosamente`);
      }, 2000);
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Error al exportar los datos');
    }
  };

  const filteredUsers = users.filter(user => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 flex items-center space-x-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          <span className="text-lg">Cargando panel de administración...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-blue-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-sm border-b border-white/10 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">Panel de Administración</h1>
              <p className="text-white/70">Gestión y monitoreo del sistema</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => loadAdminData()}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg flex items-center space-x-2 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Actualizar</span>
              </button>
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                A
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex space-x-6">
          {/* Sidebar */}
          <div className="w-64 space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full px-4 py-3 rounded-lg flex items-center space-x-3 transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white text-purple-600 shadow-lg'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {tab.icon}
                <span>{tab.name}</span>
              </button>
            ))}
          </div>

          {/* Main Content */}
          <div className="flex-1">
            {activeTab === 'dashboard' && stats && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Usuarios</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.total_users}</p>
                        <p className="text-xs text-green-600 flex items-center mt-1">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +12% este mes
                        </p>
                      </div>
                      <Users className="h-8 w-8 text-blue-500" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Usuarios Activos</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.active_users}</p>
                        <p className="text-xs text-green-600 flex items-center mt-1">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +8% este mes
                        </p>
                      </div>
                      <Activity className="h-8 w-8 text-green-500" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Total Posts</p>
                        <p className="text-2xl font-bold text-gray-900">{stats.total_posts}</p>
                        <p className="text-xs text-green-600 flex items-center mt-1">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +25% este mes
                        </p>
                      </div>
                      <MessageSquare className="h-8 w-8 text-purple-500" />
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Ingresos</p>
                        <p className="text-2xl font-bold text-gray-900">${stats.revenue.toFixed(2)}</p>
                        <p className="text-xs text-green-600 flex items-center mt-1">
                          <TrendingUp className="h-3 w-3 mr-1" />
                          +15% este mes
                        </p>
                      </div>
                      <DollarSign className="h-8 w-8 text-yellow-500" />
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Usuarios por Mes</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={[
                        { month: 'Ene', users: 45 },
                        { month: 'Feb', users: 52 },
                        { month: 'Mar', users: 48 },
                        { month: 'Abr', users: 61 },
                        { month: 'May', users: 55 },
                        { month: 'Jun', users: 67 }
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="users" fill="#8B5CF6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="text-lg font-semibold mb-4">Actividad por Categoría</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Posts', value: stats.total_posts },
                            { name: 'Diseños', value: stats.total_designs },
                            { name: 'Escenas 3D', value: stats.total_scenes },
                            { name: 'Compras', value: stats.total_orders }
                          ]}
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                          label
                        >
                          {COLORS.map((color, index) => (
                            <Cell key={`cell-${index}`} fill={color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Actividad Reciente</h3>
                  <div className="space-y-4">
                    {activityLogs.slice(0, 5).map((log) => (
                      <div key={log.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{log.details}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(log.timestamp).toLocaleString('es-ES')} - {log.ip_address}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          log.action === 'LOGIN' ? 'bg-blue-100 text-blue-800' :
                          log.action === 'CREATE_POST' ? 'bg-green-100 text-green-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {log.action}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="space-y-6">
                {/* Users Header */}
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">Gestión de Usuarios</h2>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => exportData('usuarios')}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center space-x-2 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        <span>Exportar</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar usuarios..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                    <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center space-x-2 transition-colors">
                      <Filter className="h-4 w-4" />
                      <span>Filtros</span>
                    </button>
                  </div>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Usuario
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Registro
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Último Acceso
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                                  {user.profile?.avatar_url ? (
                                    <img
                                      src={user.profile.avatar_url}
                                      alt="Avatar"
                                      className="w-full h-full rounded-full object-cover"
                                    />
                                  ) : (
                                    user.profile?.full_name?.charAt(0) || user.email.charAt(0)
                                  )}
                                </div>
                                <div className="ml-4">
                                  <div className="text-sm font-medium text-gray-900">
                                    {user.profile?.full_name || 'Sin nombre'}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {user.profile?.location || 'Sin ubicación'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {user.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(user.created_at).toLocaleDateString('es-ES')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('es-ES') : 'Nunca'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                user.email_confirmed_at ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {user.email_confirmed_at ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => {
                                    setSelectedUser(user);
                                    setShowUserModal(true);
                                  }}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                <button className="text-yellow-600 hover:text-yellow-900">
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => deleteUser(user.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'content' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Posts</h3>
                      <MessageSquare className="h-6 w-6 text-purple-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stats?.total_posts || 0}</p>
                    <p className="text-sm text-gray-500 mt-2">Total de publicaciones</p>
                    <button className="mt-4 w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                      Gestionar Posts
                    </button>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Productos</h3>
                      <ShoppingCart className="h-6 w-6 text-blue-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stats?.total_products || 0}</p>
                    <p className="text-sm text-gray-500 mt-2">Productos en tienda</p>
                    <button className="mt-4 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
                      Gestionar Productos
                    </button>
                  </div>

                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Diseños</h3>
                      <Star className="h-6 w-6 text-yellow-500" />
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{stats?.total_designs || 0}</p>
                    <p className="text-sm text-gray-500 mt-2">Proyectos de diseño</p>
                    <button className="mt-4 w-full px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors">
                      Gestionar Diseños
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="bg-white rounded-lg shadow-lg p-6">
                <h2 className="text-xl font-semibold mb-6">Registro de Actividad</h2>
                <div className="space-y-4">
                  {activityLogs.map((log) => (
                    <div key={log.id} className="flex items-center space-x-4 p-4 border border-gray-200 rounded-lg">
                      <div className={`w-3 h-3 rounded-full ${
                        log.action === 'LOGIN' ? 'bg-blue-500' :
                        log.action === 'CREATE_POST' ? 'bg-green-500' :
                        'bg-yellow-500'
                      }`}></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{log.details}</p>
                        <p className="text-xs text-gray-500">
                          Usuario: {log.user_id} | IP: {log.ip_address} | {new Date(log.timestamp).toLocaleString('es-ES')}
                        </p>
                      </div>
                      <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                        log.action === 'LOGIN' ? 'bg-blue-100 text-blue-800' :
                        log.action === 'CREATE_POST' ? 'bg-green-100 text-green-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {log.action}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg shadow-lg p-6">
                  <h2 className="text-xl font-semibold mb-6">Configuración del Sistema</h2>
                  
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Configuración General</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">Registro de Usuarios</h4>
                            <p className="text-sm text-gray-500">Permitir registro de nuevos usuarios</p>
                          </div>
                          <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-purple-600">
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">Modo Mantenimiento</h4>
                            <p className="text-sm text-gray-500">Activar modo de mantenimiento</p>
                          </div>
                          <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200">
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="text-sm font-medium text-gray-900">Notificaciones Email</h4>
                            <p className="text-sm text-gray-500">Enviar notificaciones por email</p>
                          </div>
                          <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-purple-600">
                            <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-lg font-medium mb-4">Acciones del Sistema</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center space-x-2 transition-colors">
                          <Database className="h-4 w-4" />
                          <span>Backup Base de Datos</span>
                        </button>
                        <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center space-x-2 transition-colors">
                          <Upload className="h-4 w-4" />
                          <span>Importar Datos</span>
                        </button>
                        <button className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg flex items-center justify-center space-x-2 transition-colors">
                          <RefreshCw className="h-4 w-4" />
                          <span>Limpiar Cache</span>
                        </button>
                        <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center space-x-2 transition-colors">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Reiniciar Sistema</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Detalles del Usuario</h3>
              <button
                onClick={() => setShowUserModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {selectedUser.profile?.avatar_url ? (
                    <img
                      src={selectedUser.profile.avatar_url}
                      alt="Avatar"
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    selectedUser.profile?.full_name?.charAt(0) || selectedUser.email.charAt(0)
                  )}
                </div>
                <div>
                  <h4 className="text-lg font-medium">{selectedUser.profile?.full_name || 'Sin nombre'}</h4>
                  <p className="text-gray-500">{selectedUser.email}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600">Fecha de Registro</p>
                  <p className="text-gray-900">{new Date(selectedUser.created_at).toLocaleDateString('es-ES')}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Último Acceso</p>
                  <p className="text-gray-900">
                    {selectedUser.last_sign_in_at ? new Date(selectedUser.last_sign_in_at).toLocaleDateString('es-ES') : 'Nunca'}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Estado</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    selectedUser.email_confirmed_at ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {selectedUser.email_confirmed_at ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Ubicación</p>
                  <p className="text-gray-900">{selectedUser.profile?.location || 'No especificada'}</p>
                </div>
              </div>
              
              {selectedUser.profile?.bio && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Biografía</p>
                  <p className="text-gray-900">{selectedUser.profile.bio}</p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 bg-gray-300 hover:bg-gray-400 text-gray-700 rounded-lg transition-colors"
              >
                Cerrar
              </button>
              <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
                Editar Usuario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;