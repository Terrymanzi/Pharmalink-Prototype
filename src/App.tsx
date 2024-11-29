import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import Footer from './components/Footer';
import Header from './components/Header';
import ProtectedRoute from './components/ProtectedRoute';
import RoleBasedRoute from './components/RoleBasedRoute';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { OrderProvider } from './context/OrderContext';
import About from './pages/About';
import AdminConsole from './pages/AdminConsole';
import AdminRegister from './pages/AdminRegister';
import AdminLogin from './pages/AdminLogin';
import Cart from './pages/Cart';
import Category from './pages/Category';
import Checkout from './pages/Checkout';
import Contact from './pages/Contact';
import Dashboard from './pages/Dashboard';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/auth/Register';
import VendorRegister from './pages/vendor/Register';
import ProductDetail from './pages/ProductDetail';
import Profile from './pages/Profile';
import DashboardProfile from './pages/DashboardProfile';
import DashboardPayments from './pages/DashboardPayments';
import DashboardSettings from './pages/DashboardSettings';
import UserManagement from './pages/admin/UserManagement';
import Settings from './pages/admin/Settings';
import SystemLogs from './pages/admin/SystemLogs';
import ErrorBoundary from './components/ErrorBoundary';

const theme = createTheme({
  palette: {
    primary: {
      main: '#004d00',
    },
    secondary: {
      main: '#19857b',
    },
  },
});

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <AuthProvider>
          <Router>
            <CartProvider>
              <OrderProvider>
                <div className="flex flex-col min-h-screen">
                  <Header />
                  <main className="flex-grow">
                    <Routes>
                      {/* Public Routes */}
                      <Route path="/" element={<Home />} />
                      <Route path="/about" element={<About />} />
                      <Route path="/contact" element={<Contact />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/admin/login" element={<AdminLogin />} />
                      <Route path="/register" element={<Register />} />
                      <Route path="/vendor/register" element={<VendorRegister />} />
                      <Route path="/category/:category" element={<Category />} />
                      <Route path="/product/:id" element={<ProductDetail />} />
                      
                      {/* Protected Routes */}
                      <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
                      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                      <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                      
                      {/* Customer Routes */}
                      <Route path="/dashboard" element={
                        <ProtectedRoute>
                          <Dashboard />
                        </ProtectedRoute>
                      }>
                        <Route path="profile" element={<DashboardProfile />} />
                        <Route path="payments" element={<DashboardPayments />} />
                        <Route path="settings" element={<DashboardSettings />} />
                        
                        {/* Vendor Routes */}
                        <Route path="orders" element={
                          <RoleBasedRoute allowedRoles={['vendor', 'admin']}>
                            <div>Vendor Orders</div>
                          </RoleBasedRoute>
                        } />
                        <Route path="inventory" element={
                          <RoleBasedRoute allowedRoles={['vendor', 'admin']}>
                            <div>Inventory Management</div>
                          </RoleBasedRoute>
                        } />
                      </Route>

                      {/* Admin Routes */}
                      <Route path="/admin" element={
                        <RoleBasedRoute allowedRoles={['admin', 'superadmin']} redirectTo="/dashboard">
                          <AdminConsole />
                        </RoleBasedRoute>
                      }>
                        <Route path="users" element={<UserManagement />} />
                        <Route path="settings" element={<Settings />} />
                        <Route path="logs" element={<SystemLogs />} />
                      </Route>
                    </Routes>
                  </main>
                  <Footer />
                </div>
              </OrderProvider>
            </CartProvider>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}