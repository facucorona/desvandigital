import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import {
  BarChart3,
  Users,
  ShoppingBag,
  BookOpen,
  MessageSquare,
  Heart,
  TrendingUp,
  Calendar,
  Plus,
  Eye,
  Edit,
  Trash2,
  Filter,
  Search,
  Download,
  Upload
} from 'lucide-react';

interface DashboardStats {
  totalPosts: number;
  totalLikes: number;
  totalComments: number;
  totalFollowers: number;
  totalPurchases: number;
  totalCourses: number;
}

interface UserContent {
  id: string;
  title: string;
  type: 'post' | 'course' | 'design' | 'memory';
  created_at: string;
  views: number;
  likes: number;
  status: 'published' | 'draft' | 'archived';
}

const DashboardBoard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalFollowers: 0,
    totalPurchases: 0,
    totalCourses: 0
  });
  const [content, setContent] = useState<UserContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'content' | 'analytics'>('overview');
  const [contentFilter, setContentFilter] = useState<'all' | 'post' | 'course' | 'design' | 'memory'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user) {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch user stats
      const [postsResult, likesResult, commentsResult, purchasesResult, coursesResult] = await Promise.all([
        supabase
          .from('social_posts')
          .select('id')
          .eq('user_id', user?.id),
        supabase
          .from('post_likes')
          .select('id')
          .eq('user_id', user?.id),
        supabase
          .from('post_comments')
          .select('id')
          .eq('user_id', user?.id),
        supabase
          .from('orders')
          .select('id')
          .eq('user_id', user?.id),
        supabase
          .from('route_subscriptions')
          .select('id')
          .eq('user_id', user?.id)
      ]);

      setStats({
        totalPosts: postsResult.data?.length || 0,
        totalLikes: likesResult.data?.length || 0,
        totalComments: commentsResult.data?.length || 0,
        totalFollowers: 0, // This would need a followers table
        totalPurchases: purchasesResult.data?.length || 0,
        totalCourses: coursesResult.data?.length || 0
      });

      // Fetch user content
      const contentResult = await supabase
        .from('social_posts')
        .select('id, title, content, created_at, likes_count')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (contentResult.data) {
        const formattedContent: UserContent[] = contentResult.data.map(post => ({
          id: post.id,
          title: post.title || 'Untitled Post',
          type: 'post' as const,
          created_at: post.created_at,
          views: Math.floor(Math.random() * 1000), // Mock data
          likes: post.likes_count || 0,
          status: 'published' as const
        }));
        setContent(formattedContent);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContent = async (contentId: string) => {
    try {
      const { error } = await supabase
        .from('social_posts')
        .delete()
        .eq('id', contentId)
        .eq('user_id', user?.id);

      if (error) throw error;

      setContent(content.filter(item => item.id !== contentId));
      toast.success('Content deleted successfully');
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete content');
    }
  };

  const filteredContent = content.filter(item => {
    const matchesFilter = contentFilter === 'all' || item.type === contentFilter;
    const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const StatCard: React.FC<{ icon: React.ReactNode; title: string; value: number; change?: string }> = ({ icon, title, value, change }) => (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg text-white">
            {icon}
          </div>
          <div>
            <p className="text-sm text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          </div>
        </div>
        {change && (
          <div className="flex items-center text-green-600">
            <TrendingUp className="h-4 w-4 mr-1" />
            <span className="text-sm font-medium">{change}</span>
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Manage your content and track your progress</p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-8">
          <nav className="flex space-x-8">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'content', label: 'Content' },
              { id: 'analytics', label: 'Analytics' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <StatCard
                icon={<MessageSquare className="h-5 w-5" />}
                title="Total Posts"
                value={stats.totalPosts}
                change="+12%"
              />
              <StatCard
                icon={<Heart className="h-5 w-5" />}
                title="Total Likes"
                value={stats.totalLikes}
                change="+8%"
              />
              <StatCard
                icon={<Users className="h-5 w-5" />}
                title="Comments"
                value={stats.totalComments}
                change="+15%"
              />
              <StatCard
                icon={<ShoppingBag className="h-5 w-5" />}
                title="Purchases"
                value={stats.totalPurchases}
              />
              <StatCard
                icon={<BookOpen className="h-5 w-5" />}
                title="Courses"
                value={stats.totalCourses}
              />
              <StatCard
                icon={<BarChart3 className="h-5 w-5" />}
                title="Followers"
                value={stats.totalFollowers}
              />
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button className="flex flex-col items-center p-4 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all">
                  <Plus className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">New Post</span>
                </button>
                <button className="flex flex-col items-center p-4 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:to-teal-600 transition-all">
                  <Upload className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">Upload</span>
                </button>
                <button className="flex flex-col items-center p-4 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all">
                  <Calendar className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">Schedule</span>
                </button>
                <button className="flex flex-col items-center p-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all">
                  <Download className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">Export</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Tab */}
        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Content Filters */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search content..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>
                  <select
                    value={contentFilter}
                    onChange={(e) => setContentFilter(e.target.value as any)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="all">All Content</option>
                    <option value="post">Posts</option>
                    <option value="course">Courses</option>
                    <option value="design">Designs</option>
                    <option value="memory">Memory Palace</option>
                  </select>
                </div>
                <button className="flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-500 text-white rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New
                </button>
              </div>
            </div>

            {/* Content List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Views
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Likes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredContent.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{item.title}</div>
                          <div className="text-sm text-gray-500">
                            {new Date(item.created_at).toLocaleDateString()}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 capitalize">
                            {item.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.views.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.likes.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.status === 'published' ? 'bg-green-100 text-green-800' :
                            item.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex items-center space-x-2">
                            <button className="text-indigo-600 hover:text-indigo-900">
                              <Eye className="h-4 w-4" />
                            </button>
                            <button className="text-green-600 hover:text-green-900">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteContent(item.id)}
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

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Analytics Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Engagement Rate</h4>
                  <div className="text-2xl font-bold text-blue-600">8.5%</div>
                  <p className="text-sm text-gray-600">+2.1% from last month</p>
                </div>
                <div className="p-4 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">Growth Rate</h4>
                  <div className="text-2xl font-bold text-green-600">12.3%</div>
                  <p className="text-sm text-gray-600">+5.7% from last month</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardBoard;