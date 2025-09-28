import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './hooks/useCart';
import { SocketProvider } from './hooks/useSocket';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/auth/ProtectedRoute';

// Pages
import Home from './pages/Home';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import Store from './pages/Store';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import SocialNetwork from './pages/SocialNetwork';
import StudyRoutes from './pages/StudyRoutes';
import StudyRouteDetail from './pages/StudyRouteDetail';
import DashboardBoard from './pages/DashboardBoard';
import AtticEnvironment from './pages/AtticEnvironment';
import DesignAccount from './pages/DesignAccount';
import UserDashboard from './pages/UserDashboard';
import AdminPanel from './pages/AdminPanel';
import Messaging from './pages/Messaging';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <SocketProvider>
          <Router>
            <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
              <Navbar />
              <main className="flex-1">
                <Routes>
                  {/* Public Routes */}
                  <Route path="/" element={<Home />} />
                  <Route path="/login" element={
                    <ProtectedRoute requireAuth={false}>
                      <Login />
                    </ProtectedRoute>
                  } />
                  <Route path="/register" element={
                    <ProtectedRoute requireAuth={false}>
                      <Register />
                    </ProtectedRoute>
                  } />
                  <Route path="/store" element={<Store />} />
                  <Route path="/product/:id" element={<ProductDetail />} />
                  <Route path="/study-routes" element={<StudyRoutes />} />
                  <Route path="/study-route/:id" element={<StudyRouteDetail />} />
                  
                  {/* Protected Routes */}
                  <Route path="/cart" element={
                    <ProtectedRoute>
                      <Cart />
                    </ProtectedRoute>
                  } />
                  <Route path="/checkout" element={
                    <ProtectedRoute>
                      <Checkout />
                    </ProtectedRoute>
                  } />
                  <Route path="/social" element={
                    <ProtectedRoute>
                      <SocialNetwork />
                    </ProtectedRoute>
                  } />
                  <Route path="/dashboard" element={
                    <ProtectedRoute>
                      <DashboardBoard />
                    </ProtectedRoute>
                  } />
                  <Route path="/attic" element={
                    <ProtectedRoute>
                      <AtticEnvironment />
                    </ProtectedRoute>
                  } />
                  <Route path="/design" element={
                    <ProtectedRoute>
                      <DesignAccount />
                    </ProtectedRoute>
                  } />
                  <Route path="/user-dashboard" element={
                    <ProtectedRoute>
                      <UserDashboard />
                    </ProtectedRoute>
                  } />
                  <Route path="/messages" element={
                    <ProtectedRoute>
                      <Messaging />
                    </ProtectedRoute>
                  } />
                  <Route path="/profile" element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } />
                  
                  {/* Admin Routes */}
                  <Route path="/admin" element={
                    <ProtectedRoute requireAdmin>
                      <AdminPanel />
                    </ProtectedRoute>
                  } />
                  
                  {/* Catch all route */}
                  <Route path="/404" element={<NotFound />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Routes>
              </main>
              <Footer />
            </div>
            <Toaster 
              position="top-right" 
              richColors 
              closeButton 
              duration={4000}
            />
          </Router>
        </SocketProvider>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
