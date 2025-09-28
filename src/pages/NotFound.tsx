import React from 'react';
import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search, RefreshCw } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* 404 Illustration */}
        <div className="mb-8">
          <div className="relative">
            <div className="text-9xl font-bold text-purple-200 select-none">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 bg-purple-600 rounded-full flex items-center justify-center">
                <Search className="w-12 h-12 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Page Not Found
          </h1>
          <p className="text-lg text-gray-600 mb-2">
            Oops! The page you're looking for doesn't exist.
          </p>
          <p className="text-gray-500">
            It might have been moved, deleted, or you entered the wrong URL.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          <Link
            to="/"
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 transition-colors duration-200"
          >
            <Home className="w-5 h-5 mr-2" />
            Go to Homepage
          </Link>
          
          <div className="flex space-x-3">
            <button
              onClick={() => window.history.back()}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Go Back
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
          </div>
        </div>

        {/* Helpful Links */}
        <div className="mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-4">You might be looking for:</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Link
              to="/store"
              className="text-purple-600 hover:text-purple-700 hover:underline"
            >
              Store
            </Link>
            <Link
              to="/social"
              className="text-purple-600 hover:text-purple-700 hover:underline"
            >
              Social Network
            </Link>
            <Link
              to="/study-routes"
              className="text-purple-600 hover:text-purple-700 hover:underline"
            >
              Study Routes
            </Link>
            <Link
              to="/dashboard"
              className="text-purple-600 hover:text-purple-700 hover:underline"
            >
              Dashboard
            </Link>
            <Link
              to="/attic"
              className="text-purple-600 hover:text-purple-700 hover:underline"
            >
              3D Attic
            </Link>
            <Link
              to="/design"
              className="text-purple-600 hover:text-purple-700 hover:underline"
            >
              Design Account
            </Link>
          </div>
        </div>

        {/* Contact Support */}
        <div className="mt-8 p-4 bg-white rounded-lg border border-gray-200">
          <p className="text-sm text-gray-600 mb-2">
            Still can't find what you're looking for?
          </p>
          <Link
            to="/messaging"
            className="text-sm text-purple-600 hover:text-purple-700 font-medium"
          >
            Contact Support →
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;