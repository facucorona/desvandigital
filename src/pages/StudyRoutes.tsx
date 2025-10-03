import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, Users, Star, Play, Lock, CheckCircle, Filter, Search, Grid, List, Calendar, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

interface StudyRoute {
  id: string;
  title: string;
  description: string;
  difficulty_level: 'beginner' | 'intermediate' | 'advanced';
  estimated_duration: number; // in hours
  price: number;
  image_url?: string;
  category: string;
  instructor_name: string;
  rating: number;
  students_count: number;
  lessons_count: number;
  created_at: string;
  is_subscribed?: boolean;
  progress?: number;
}

interface RouteSubscription {
  id: string;
  user_id: string;
  route_id: string;
  progress: number;
  completed_at?: string;
  created_at: string;
}

const StudyRoutes: React.FC = () => {
  const [routes, setRoutes] = useState<StudyRoute[]>([]);
  const [filteredRoutes, setFilteredRoutes] = useState<StudyRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'subscribed' | 'completed'>('all');
  const { user } = useAuth();

  const categories = ['all', 'programming', 'design', 'business', 'marketing', 'data-science', 'languages'];
  const difficulties = ['all', 'beginner', 'intermediate', 'advanced'];
  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'popular', label: 'Most Popular' },
    { value: 'rating', label: 'Highest Rated' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'duration', label: 'Shortest Duration' }
  ];

  useEffect(() => {
    fetchRoutes();
  }, [activeTab]);

  useEffect(() => {
    filterAndSortRoutes();
  }, [routes, searchTerm, selectedCategory, selectedDifficulty, sortBy]);

  const fetchRoutes = async () => {
    try {
      let query = supabase
        .from('study_routes')
        .select('*');

      const { data, error } = await query;
      if (error) throw error;

      let routesData = data || [];

      // If user is logged in, check subscriptions and progress
      if (user && routesData.length > 0) {
        const { data: subscriptions } = await supabase
          .from('route_subscriptions')
          .select('*')
          .eq('user_id', user.id);

        routesData = routesData.map(route => {
          const subscription = subscriptions?.find(sub => sub.route_id === route.id);
          return {
            ...route,
            is_subscribed: !!subscription,
            progress: subscription?.progress || 0
          };
        });

        // Filter based on active tab
        if (activeTab === 'subscribed') {
          routesData = routesData.filter(route => route.is_subscribed);
        } else if (activeTab === 'completed') {
          routesData = routesData.filter(route => route.progress === 100);
        }
      }

      setRoutes(routesData);
    } catch (error) {
      console.error('Error fetching routes:', error);
      toast.error('Failed to load study routes');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortRoutes = () => {
    let filtered = [...routes];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(route =>
        route.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        route.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        route.instructor_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(route => route.category === selectedCategory);
    }

    // Difficulty filter
    if (selectedDifficulty !== 'all') {
      filtered = filtered.filter(route => route.difficulty_level === selectedDifficulty);
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.students_count - a.students_count;
        case 'rating':
          return b.rating - a.rating;
        case 'price_asc':
          return a.price - b.price;
        case 'price_desc':
          return b.price - a.price;
        case 'duration':
          return a.estimated_duration - b.estimated_duration;
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    setFilteredRoutes(filtered);
  };

  const subscribeToRoute = async (routeId: string) => {
    if (!user) {
      toast.error('Please sign in to subscribe to routes');
      return;
    }

    try {
      const { error } = await supabase
        .from('route_subscriptions')
        .insert({
          user_id: user.id,
          route_id: routeId,
          progress: 0
        });

      if (error) throw error;

      // Update local state
      setRoutes(routes.map(route => 
        route.id === routeId 
          ? { ...route, is_subscribed: true, students_count: route.students_count + 1 }
          : route
      ));

      // Update students count in database
      const route = routes.find(r => r.id === routeId);
      if (route) {
        await supabase
          .from('study_routes')
          .update({ students_count: route.students_count + 1 })
          .eq('id', routeId);
      }

      toast.success('Successfully subscribed to route!');
    } catch (error) {
      console.error('Error subscribing to route:', error);
      toast.error('Failed to subscribe to route');
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800';
      case 'advanced': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading study routes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">Study Routes</h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Structured learning paths designed to take you from beginner to expert
            </p>
          </div>

          {/* Navigation Tabs */}
          {user && (
            <div className="flex justify-center mb-6">
              <div className="bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-6 py-2 rounded-md transition-colors ${
                    activeTab === 'all'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-purple-600'
                  }`}
                >
                  All Routes
                </button>
                <button
                  onClick={() => setActiveTab('subscribed')}
                  className={`px-6 py-2 rounded-md transition-colors ${
                    activeTab === 'subscribed'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-purple-600'
                  }`}
                >
                  My Routes
                </button>
                <button
                  onClick={() => setActiveTab('completed')}
                  className={`px-6 py-2 rounded-md transition-colors ${
                    activeTab === 'completed'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-purple-600'
                  }`}
                >
                  Completed
                </button>
              </div>
            </div>
          )}

          {/* Search and Filters */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search routes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Filter className="h-4 w-4" />
                Filters
              </button>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {sortOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 ${viewMode === 'grid' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <Grid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 ${viewMode === 'list' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-6 p-6 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Categories */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Category</h3>
                  <div className="space-y-2">
                    {categories.map(category => (
                      <label key={category} className="flex items-center">
                        <input
                          type="radio"
                          name="category"
                          value={category}
                          checked={selectedCategory === category}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="mr-2 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="capitalize">{category.replace('-', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Difficulty */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-3">Difficulty</h3>
                  <div className="space-y-2">
                    {difficulties.map(difficulty => (
                      <label key={difficulty} className="flex items-center">
                        <input
                          type="radio"
                          name="difficulty"
                          value={difficulty}
                          checked={selectedDifficulty === difficulty}
                          onChange={(e) => setSelectedDifficulty(e.target.value)}
                          className="mr-2 text-purple-600 focus:ring-purple-500"
                        />
                        <span className="capitalize">{difficulty}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Results Count */}
                <div className="flex items-end">
                  <div className="text-sm text-gray-600">
                    Showing {filteredRoutes.length} of {routes.length} routes
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Routes Grid/List */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredRoutes.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <BookOpen className="h-16 w-16 mx-auto" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No routes found</h3>
            <p className="text-gray-600">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
            : 'space-y-4'
          }>
            {filteredRoutes.map((route) => (
              <div
                key={route.id}
                className={`bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group ${
                  viewMode === 'list' ? 'flex' : ''
                }`}
              >
                {/* Route Image */}
                <div className={`relative overflow-hidden ${
                  viewMode === 'list' ? 'w-64 h-40' : 'h-48'
                }`}>
                  <img
                    src={route.image_url || `https://trae-api-us.mchost.guru/api/ide/v1/text_to_image?prompt=online%20course%20${route.category}&image_size=landscape_4_3`}
                    alt={route.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300"></div>
                  
                  {/* Progress Bar for subscribed routes */}
                  {route.is_subscribed && route.progress !== undefined && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 p-2">
                      <div className="flex items-center justify-between text-white text-xs mb-1">
                        <span>Progress</span>
                        <span>{route.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-300 rounded-full h-1">
                        <div 
                          className="bg-green-500 h-1 rounded-full transition-all duration-300"
                          style={{ width: `${route.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {/* Difficulty Badge */}
                  <div className="absolute top-2 left-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(route.difficulty_level)}`}>
                      {route.difficulty_level}
                    </span>
                  </div>

                  {/* Subscription Status */}
                  {route.is_subscribed && (
                    <div className="absolute top-2 right-2">
                      {route.progress === 100 ? (
                        <div className="bg-green-500 text-white p-1 rounded-full">
                          <Award className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="bg-blue-500 text-white p-1 rounded-full">
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Route Info */}
                <div className={`p-6 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-gray-900 text-lg group-hover:text-purple-600 transition-colors line-clamp-2">
                      {route.title}
                    </h3>
                  </div>

                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {route.description}
                  </p>

                  {/* Instructor */}
                  <div className="flex items-center mb-3">
                    <div className="w-6 h-6 bg-gradient-to-r from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white text-xs font-semibold mr-2">
                      {route.instructor_name.charAt(0)}
                    </div>
                    <span className="text-sm text-gray-600">{route.instructor_name}</span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mb-4 text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-400 fill-current" />
                      <span>{route.rating}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>{route.students_count}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{formatDuration(route.estimated_duration)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <BookOpen className="h-4 w-4" />
                      <span>{route.lessons_count} lessons</span>
                    </div>
                  </div>

                  {/* Price and Actions */}
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-bold text-purple-600">
                      {route.price === 0 ? 'Free' : `$${route.price}`}
                    </div>
                    <div className="flex gap-2">
                      {route.is_subscribed ? (
                        <Link
                          to={`/study-route/${route.id}`}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                        >
                          <Play className="h-4 w-4" />
                          Continue
                        </Link>
                      ) : (
                        <>
                          <Link
                            to={`/study-route/${route.id}`}
                            className="px-4 py-2 border border-purple-600 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          >
                            Preview
                          </Link>
                          <button
                            onClick={() => subscribeToRoute(route.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                          >
                            <BookOpen className="h-4 w-4" />
                            {route.price === 0 ? 'Enroll' : 'Subscribe'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudyRoutes;