import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, Users, ShoppingBag, Palette, Brain, MessageCircle, BarChart3, Sparkles } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Home: React.FC = () => {
  const { user } = useAuth();

  const features = [
    {
      icon: <ShoppingBag className="h-8 w-8" />,
      title: "Digital Store",
      description: "Discover and purchase digital products, courses, and resources",
      link: "/store",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Users className="h-8 w-8" />,
      title: "Social Network",
      description: "Connect with learners, share knowledge, and build communities",
      link: "/social",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: <BookOpen className="h-8 w-8" />,
      title: "Study Routes",
      description: "Follow structured learning paths and track your progress",
      link: "/study-routes",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: <Brain className="h-8 w-8" />,
      title: "3D Memory Palace",
      description: "Create immersive 3D environments for enhanced learning",
      link: "/attic",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: <Palette className="h-8 w-8" />,
      title: "Design Studio",
      description: "Create custom designs with our powerful canvas editor",
      link: "/design",
      color: "from-indigo-500 to-purple-500"
    },
    {
      icon: <MessageCircle className="h-8 w-8" />,
      title: "Real-time Messaging",
      description: "Communicate instantly with peers and mentors",
      link: "/messages",
      color: "from-teal-500 to-blue-500"
    }
  ];

  const stats = [
    { number: "10K+", label: "Active Learners" },
    { number: "500+", label: "Courses Available" },
    { number: "50K+", label: "Resources Shared" },
    { number: "98%", label: "Satisfaction Rate" }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="p-4 bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20">
                <Sparkles className="h-12 w-12 text-yellow-400" />
              </div>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
              Desván Digital
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-gray-200 max-w-3xl mx-auto leading-relaxed">
              Transform your learning experience with our comprehensive digital platform. 
              Store knowledge, connect with peers, and unlock your potential.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {user ? (
                <Link
                  to="/dashboard"
                  className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                >
                  Go to Dashboard
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="group px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
                  >
                    Get Started Free
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                  <Link
                    to="/login"
                    className="px-8 py-4 border-2 border-white/30 hover:border-white/50 rounded-xl font-semibold text-lg transition-all duration-300 hover:bg-white/10"
                  >
                    Sign In
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
        
        {/* Animated background elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-purple-500/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-32 h-32 bg-blue-500/20 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-pink-500/20 rounded-full blur-xl animate-pulse delay-500"></div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{stat.number}</div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Learn &amp; Grow
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Discover powerful tools and features designed to enhance your learning journey
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Link
                key={index}
                to={feature.link}
                className="group p-8 bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 border border-gray-100"
              >
                <div className={`inline-flex p-4 rounded-xl bg-gradient-to-r ${feature.color} text-white mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-purple-600 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
                <div className="mt-4 flex items-center text-purple-600 font-medium group-hover:gap-2 transition-all">
                  Learn More
                  <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-purple-900 via-blue-900 to-indigo-900 text-white">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Transform Your Learning?
          </h2>
          <p className="text-xl mb-8 text-gray-200">
            Join thousands of learners who are already using Desván Digital to achieve their goals
          </p>
          {!user && (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="px-8 py-4 bg-white text-purple-900 hover:bg-gray-100 rounded-xl font-semibold text-lg transition-all duration-300 transform hover:scale-105"
              >
                Start Your Journey
              </Link>
              <Link
                to="/store"
                className="px-8 py-4 border-2 border-white/30 hover:border-white/50 rounded-xl font-semibold text-lg transition-all duration-300 hover:bg-white/10"
              >
                Explore Store
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;