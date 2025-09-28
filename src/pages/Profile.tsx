import { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Camera, Save, Edit3, Shield, Bell, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  avatar_url: string;
  bio: string;
  created_at: string;
  subscription_status: 'free' | 'premium' | 'pro';
  total_courses: number;
  completed_courses: number;
}

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    bio: ''
  });
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Mock data for now
        const mockProfile: UserProfile = {
          id: user?.id || '1',
          name: user?.name || 'Usuario Demo',
          email: user?.email || 'usuario@demo.com',
          phone: '+34 123 456 789',
          address: 'Madrid, España',
          avatar_url: 'https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20user%20avatar%20portrait%20friendly%20person&image_size=square',
          bio: 'Apasionado del diseño digital y la creatividad. Siempre buscando aprender nuevas técnicas y herramientas.',
          created_at: '2023-01-15',
          subscription_status: 'premium',
          total_courses: 12,
          completed_courses: 8
        };
        
        setTimeout(() => {
          setProfile(mockProfile);
          setFormData({
            name: mockProfile.name,
            phone: mockProfile.phone,
            address: mockProfile.address,
            bio: mockProfile.bio
          });
          setIsLoading(false);
        }, 1000);
      } catch (error) {
        toast.error('Error al cargar el perfil');
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (profile) {
        setProfile({
          ...profile,
          ...formData
        });
      }
      
      setIsEditing(false);
      toast.success('Perfil actualizado correctamente');
    } catch (error) {
      toast.error('Error al actualizar el perfil');
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        name: profile.name,
        phone: profile.phone,
        address: profile.address,
        bio: profile.bio
      });
    }
    setIsEditing(false);
  };

  const getSubscriptionBadge = (status: string) => {
    const badges = {
      free: 'bg-gray-100 text-gray-800',
      premium: 'bg-indigo-100 text-indigo-800',
      pro: 'bg-purple-100 text-purple-800'
    };
    return badges[status as keyof typeof badges] || badges.free;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error al cargar el perfil</h2>
          <p className="text-gray-600">Por favor, intenta de nuevo más tarde.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
        <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600"></div>
        <div className="px-6 pb-6">
          <div className="flex items-center -mt-16">
            <div className="relative">
              <img
                src={profile.avatar_url}
                alt={profile.name}
                className="h-32 w-32 rounded-full border-4 border-white object-cover"
              />
              <button className="absolute bottom-2 right-2 bg-indigo-600 text-white p-2 rounded-full hover:bg-indigo-700 transition-colors">
                <Camera className="h-4 w-4" />
              </button>
            </div>
            <div className="ml-6 flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
                  <p className="text-gray-600">{profile.email}</p>
                  <div className="flex items-center mt-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSubscriptionBadge(profile.subscription_status)}`}>
                      {profile.subscription_status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  {isEditing ? 'Cancelar' : 'Editar perfil'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <div className="text-3xl font-bold text-indigo-600 mb-2">{profile.total_courses}</div>
          <div className="text-gray-600">Cursos inscritos</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <div className="text-3xl font-bold text-green-600 mb-2">{profile.completed_courses}</div>
          <div className="text-gray-600">Cursos completados</div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-6 text-center">
          <div className="text-3xl font-bold text-purple-600 mb-2">
            {Math.round((profile.completed_courses / profile.total_courses) * 100)}%
          </div>
          <div className="text-gray-600">Progreso total</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'profile', label: 'Información personal', icon: User },
              { id: 'security', label: 'Seguridad', icon: Shield },
              { id: 'notifications', label: 'Notificaciones', icon: Bell },
              { id: 'billing', label: 'Facturación', icon: CreditCard }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nombre completo
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  ) : (
                    <div className="flex items-center px-3 py-2 bg-gray-50 rounded-md">
                      <User className="h-4 w-4 text-gray-400 mr-2" />
                      {profile.name}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email
                  </label>
                  <div className="flex items-center px-3 py-2 bg-gray-50 rounded-md">
                    <Mail className="h-4 w-4 text-gray-400 mr-2" />
                    {profile.email}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">El email no se puede modificar</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Teléfono
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  ) : (
                    <div className="flex items-center px-3 py-2 bg-gray-50 rounded-md">
                      <Phone className="h-4 w-4 text-gray-400 mr-2" />
                      {profile.phone}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Dirección
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  ) : (
                    <div className="flex items-center px-3 py-2 bg-gray-50 rounded-md">
                      <MapPin className="h-4 w-4 text-gray-400 mr-2" />
                      {profile.address}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Biografía
                </label>
                {isEditing ? (
                  <textarea
                    value={formData.bio}
                    onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Cuéntanos sobre ti..."
                  />
                ) : (
                  <div className="px-3 py-2 bg-gray-50 rounded-md min-h-[100px]">
                    {profile.bio || 'No hay biografía disponible'}
                  </div>
                )}
              </div>

              {isEditing && (
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Guardar cambios
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Cambiar contraseña</h3>
                <div className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contraseña actual
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nueva contraseña
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Confirmar nueva contraseña
                    </label>
                    <input
                      type="password"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                  <button className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors">
                    Actualizar contraseña
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-gray-900">Preferencias de notificación</h3>
              <div className="space-y-4">
                {[
                  { id: 'email_courses', label: 'Nuevos cursos disponibles', description: 'Recibe notificaciones sobre nuevos cursos' },
                  { id: 'email_progress', label: 'Progreso de cursos', description: 'Actualizaciones sobre tu progreso de aprendizaje' },
                  { id: 'email_social', label: 'Actividad social', description: 'Notificaciones de la red social' },
                  { id: 'email_marketing', label: 'Ofertas y promociones', description: 'Información sobre descuentos y ofertas especiales' }
                ].map(notification => (
                  <div key={notification.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="font-medium text-gray-900">{notification.label}</div>
                      <div className="text-sm text-gray-500">{notification.description}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Suscripción actual</h3>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSubscriptionBadge(profile.subscription_status)}`}>
                  {profile.subscription_status.toUpperCase()}
                </span>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 mb-2">Plan Premium</div>
                  <div className="text-gray-600 mb-4">Acceso completo a todos los cursos y funciones</div>
                  <div className="text-3xl font-bold text-indigo-600 mb-4">€29.99/mes</div>
                  <button className="bg-indigo-600 text-white px-6 py-2 rounded-md hover:bg-indigo-700 transition-colors">
                    Gestionar suscripción
                  </button>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-3">Historial de pagos</h4>
                <div className="space-y-3">
                  {[
                    { date: '2024-01-01', amount: '€29.99', status: 'Pagado' },
                    { date: '2023-12-01', amount: '€29.99', status: 'Pagado' },
                    { date: '2023-11-01', amount: '€29.99', status: 'Pagado' }
                  ].map((payment, index) => (
                    <div key={index} className="flex items-center justify-between py-3 border-b border-gray-200">
                      <div>
                        <div className="font-medium text-gray-900">{payment.date}</div>
                        <div className="text-sm text-gray-500">Suscripción mensual</div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-gray-900">{payment.amount}</div>
                        <div className="text-sm text-green-600">{payment.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;