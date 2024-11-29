import React, { useEffect, useState } from 'react';
import { Package2, ShoppingBag, Star, AlertCircle } from 'lucide-react';
import { fetchVendorDashboardStats } from '../services/api';

interface VendorStats {
  totalProducts: number;
  publishedProducts: number;
  draftProducts: number;
  outOfStockProducts: number;
  averageRating: number;
}

const VendorDashboard: React.FC = () => {
  const [data, setData] = useState<VendorStats>({
    totalProducts: 0,
    publishedProducts: 0,
    draftProducts: 0,
    outOfStockProducts: 0,
    averageRating: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    // Refresh data every 5 minutes
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetchVendorDashboardStats();
      setData(response);
      setError(null);
    } catch (err) {
      setError('Failed to fetch vendor statistics');
      console.error('Error fetching vendor stats:', err);
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
        {/* Total Products */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Products</p>
              <p className="text-2xl font-semibold text-gray-900">{data.totalProducts}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-full">
              <Package2 className="h-6 w-6 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Published Products */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Published Products</p>
              <p className="text-2xl font-semibold text-gray-900">{data.publishedProducts}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-full">
              <ShoppingBag className="h-6 w-6 text-green-500" />
            </div>
          </div>
        </div>

        {/* Average Rating */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Rating</p>
              <p className="text-2xl font-semibold text-gray-900">
                {data.averageRating.toFixed(1)} / 5.0
              </p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-full">
              <Star className="h-6 w-6 text-yellow-500" />
            </div>
          </div>
        </div>

        {/* Out of Stock */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Out of Stock</p>
              <p className="text-2xl font-semibold text-gray-900">{data.outOfStockProducts}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-full">
              <AlertCircle className="h-6 w-6 text-red-500" />
            </div>
          </div>
        </div>
      </div>

      {/* Product Status Distribution */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Product Status Distribution</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-600">Published</p>
            <p className="text-xl font-semibold text-gray-900">{data.publishedProducts}</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-600">Draft</p>
            <p className="text-xl font-semibold text-gray-900">{data.draftProducts}</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-sm font-medium text-gray-600">Out of Stock</p>
            <p className="text-xl font-semibold text-gray-900">{data.outOfStockProducts}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VendorDashboard;