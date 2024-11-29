import React, { useEffect, useState } from 'react';
import { BarChart2, Users, ShoppingBag, DollarSign, Activity } from 'lucide-react';
import { fetchAdminStats } from '../services/api';

interface AdminStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  activeUsers: number;
  totalProducts: number;
  pendingOrders: number;
  systemHealth: {
    status: string;
    lastBackup: string;
    serverLoad: number;
    lastError: string | null;
  };
  recentActivity: {
    newUsers: number;
    recentOrders: number;
  };
  userStats: {
    customers: number;
    admins: number;
    inactiveUsers: number;
  };
}

const DashboardAnalytics: React.FC = () => {
  const [data, setData] = useState<AdminStats>({
    totalUsers: 0,
    totalOrders: 0,
    totalRevenue: 0,
    activeUsers: 0,
    totalProducts: 0,
    pendingOrders: 0,
    systemHealth: {
      status: 'Healthy',
      lastBackup: new Date().toISOString(),
      serverLoad: 0,
      lastError: null
    },
    recentActivity: {
      newUsers: 0,
      recentOrders: 0
    },
    userStats: {
      customers: 0,
      admins: 0,
      inactiveUsers: 0
    }
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
    // Refresh data every 5 minutes
    const interval = setInterval(fetchAnalytics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetchAdminStats();
      setData(response);
      setError(null);
    } catch (err) {
      setError('Failed to fetch analytics data');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004d00]"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 text-red-600 p-4 rounded-lg">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Active Users */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="text-2xl font-semibold text-gray-900">{data.activeUsers}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-full">
              <Users className="w-6 h-6 text-blue-500" />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {data.recentActivity.newUsers} new in last 24h
          </p>
        </div>

        {/* Total Orders */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Orders</p>
              <p className="text-2xl font-semibold text-gray-900">{data.totalOrders}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-full">
              <ShoppingBag className="w-6 h-6 text-green-500" />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {data.pendingOrders} pending orders
          </p>
        </div>

        {/* Revenue */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">${data.totalRevenue.toFixed(2)}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-full">
              <DollarSign className="w-6 h-6 text-yellow-500" />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {data.recentActivity.recentOrders} orders in last 24h
          </p>
        </div>

        {/* System Health */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">System Health</p>
              <p className="text-2xl font-semibold text-gray-900">{data.systemHealth.status}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-full">
              <Activity className="w-6 h-6 text-purple-500" />
            </div>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Server Load: {data.systemHealth.serverLoad.toFixed(1)}MB
          </p>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* User Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 mb-4">User Distribution</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Customers</span>
              <span className="font-medium">{data.userStats.customers}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Admins</span>
              <span className="font-medium">{data.userStats.admins}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Inactive Users</span>
              <span className="font-medium">{data.userStats.inactiveUsers}</span>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Last Backup</span>
              <span className="font-medium">
                {new Date(data.systemHealth.lastBackup).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Products</span>
              <span className="font-medium">{data.totalProducts}</span>
            </div>
            {data.systemHealth.lastError && (
              <div className="flex justify-between items-center text-red-600">
                <span className="text-sm">Last Error</span>
                <span className="font-medium">{data.systemHealth.lastError}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardAnalytics;