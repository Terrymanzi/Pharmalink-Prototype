import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

// Define admin roles - must match backend enum
const adminRoles = ['admin', 'superadmin', 'superuser'];

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requireAdmin = false }) => {
  const { user, isAuthenticated } = useAuth();

  // Debug log
  console.log('ProtectedRoute - User:', user);
  console.log('ProtectedRoute - isAuthenticated:', isAuthenticated);
  console.log('ProtectedRoute - requireAdmin:', requireAdmin);
  console.log('ProtectedRoute - User role:', user?.role);

  if (!isAuthenticated) {
    console.log('Not authenticated, redirecting to login');
    return <Navigate to="/login" />;
  }

  if (requireAdmin && !adminRoles.includes(user?.role || '')) {
    console.log('Access denied: User role:', user?.role);
    console.log('Allowed roles:', adminRoles);
    return <Navigate to="/" />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;