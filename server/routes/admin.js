import express from 'express';
import SystemLog from '../models/SystemLog.js';
import { auth, requireAdmin } from '../middleware/auth.js';
import User from '../models/User.js';
import SystemSettings from '../models/SystemSettings.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';

const router = express.Router();

// Middleware to ensure admin access
router.use(auth);
router.use(requireAdmin);

// Get admin dashboard analytics
router.get('/analytics', async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'superadmin';

    // Fetch all required data in parallel
    const [users, orders, products, logs, settings] = await Promise.all([
      User.find(),
      Order.find(),
      Product.find(),
      SystemLog.find().sort({ timestamp: -1 }).limit(10),
      SystemSettings.findOne()
    ]);

    // Calculate active users
    const activeUsers = users.filter(user => user.status === 'active').length;

    // Calculate orders stats
    const pendingOrders = orders.filter(order => order.status === 'pending').length;
    const totalRevenue = orders
      .filter(order => order.status === 'completed')
      .reduce((sum, order) => sum + (order.total || 0), 0);

    // Get system health
    const lastLog = logs[0];
    const systemHealth = {
      status: lastLog?.level === 'error' ? 'Warning' : 'Healthy',
      lastBackup: settings?.lastBackup || new Date().toISOString(),
      serverLoad: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      lastError: lastLog?.level === 'error' ? lastLog.message : null,
      recentLogs: isSuperAdmin ? logs.map(log => ({
        level: log.level,
        message: log.message,
        timestamp: log.timestamp
      })) : undefined
    };

    const stats = {
      totalUsers: users.length,
      totalOrders: orders.length,
      totalRevenue,
      activeUsers,
      totalProducts: products.length,
      pendingOrders,
      systemHealth,
      recentActivity: {
        newUsers: users.filter(u => {
          const daysSinceCreation = (Date.now() - new Date(u.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceCreation <= 1;
        }).length,
        recentOrders: orders.filter(o => {
          const daysSinceOrder = (Date.now() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceOrder <= 1;
        }).length
      },
      userStats: {
        customers: users.filter(u => u.role === 'user').length,
        vendors: users.filter(u => u.role === 'vendor').length,
        admins: users.filter(u => u.role === 'admin').length,
        superadmins: users.filter(u => u.role === 'superadmin').length,
        inactiveUsers: users.filter(u => u.status !== 'active').length,
        pendingVendors: users.filter(u => u.role === 'vendor' && u.status === 'pending').length
      }
    };

    // Add superadmin-specific data
    if (isSuperAdmin) {
      stats.superadminStats = {
        systemSettings: settings,
        adminActivity: logs.filter(log => 
          log.user && ['admin', 'superadmin'].includes(log.user.role)
        ).map(log => ({
          action: log.action,
          timestamp: log.timestamp,
          adminId: log.user?._id
        })),
        roleDistribution: {
          byStatus: users.reduce((acc, user) => {
            acc[user.status] = (acc[user.status] || 0) + 1;
            return acc;
          }, {}),
          byRole: users.reduce((acc, user) => {
            acc[user.role] = (acc[user.role] || 0) + 1;
            return acc;
          }, {})
        }
      };
    }

    res.json(stats);
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    res.status(500).json({ message: 'Error fetching analytics' });
  }
});

// Get all users with pagination and filtering
router.get('/users', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      role,
      search 
    } = req.query;

    const query = {};
    
    // Apply filters
    if (status) query.status = status;
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Error fetching users' });
  }
});

// Update user status and role
router.put('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, role, reason } = req.body;

    // Validate user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if trying to modify a superadmin
    if (user.role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Cannot modify superadmin users' });
    }

    // Check if admin is trying to set role to superadmin
    if (role === 'superadmin' && req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmins can promote to superadmin' });
    }

    const userToUpdate = await User.findById(userId);
    if (!userToUpdate) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Updating user:', {
      userId,
      currentStatus: userToUpdate.status,
      newStatus: status,
      currentRole: userToUpdate.role,
      newRole: role
    });

    // Update fields
    if (status) {
      userToUpdate.status = status;
      
      // If activating a vendor, ensure store is activated
      if (status === 'active' && userToUpdate.role === 'vendor') {
        if (!userToUpdate.storeDetails) {
          userToUpdate.storeDetails = {};
        }
        userToUpdate.storeDetails.active = true;
      }

      // Add to status history
      if (!userToUpdate.statusHistory) {
        userToUpdate.statusHistory = [];
      }
      userToUpdate.statusHistory.unshift({
        status,
        reason,
        timestamp: new Date(),
        updatedBy: req.user._id
      });
    }

    if (role) {
      userToUpdate.role = role;
    }

    // Save user to trigger middleware
    console.log('Saving user with updates:', {
      status: userToUpdate.status,
      role: userToUpdate.role,
      storeActive: userToUpdate.storeDetails?.active
    });

    try {
      const updatedUser = await userToUpdate.save();
      console.log('User saved successfully:', {
        id: updatedUser._id,
        email: updatedUser.email,
        status: updatedUser.status,
        role: updatedUser.role
      });

      const userResponse = updatedUser.toObject();
      delete userResponse.password;

      // Log the change
      await SystemLog.create({
        level: 'info',
        message: `User ${updatedUser.email} updated by admin`,
        action: 'USER_UPDATE',
        user: req.user._id,
        timestamp: new Date(),
        details: {
          updatedUser: updatedUser._id,
          changes: {
            status: status || undefined,
            role: role || undefined,
            reason
          }
        }
      });

      res.json(userResponse);
    } catch (error) {
      console.error('Error saving user:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ message: 'Error updating user' });
  }
});

// Get user details including status history
router.get('/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId)
      .select('-password')
      .populate('statusHistory.updatedBy', 'name email');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({ message: 'Error fetching user details' });
  }
});

// Promote user
router.put('/promote/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { role } = req.body;
    if (!['admin', 'superadmin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role specified' });
    }

    user.role = role;
    await user.save();

    await User.findByIdAndUpdate(user._id, {
      $push: {
        statusHistory: {
          status: `Role changed to ${role}`,
          timestamp: new Date(),
          reason: req.body.reason || `Promoted to ${role}`,
          updatedBy: req.user._id
        }
      }
    });

    res.json({ 
      message: `User successfully promoted to ${role}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error promoting user' });
  }
});

// Update user permissions
router.put('/users/:userId/permissions', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update permissions
    user.permissions = {
      ...user.permissions,
      ...req.body.permissions
    };

    await user.save();

    res.json({
      message: 'User permissions updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        permissions: user.permissions
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error updating user permissions' });
  }
});

// System backup
router.post('/backup', async (req, res) => {
  try {
    // Add your backup logic here
    res.json({ message: 'Backup initiated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error initiating backup' });
  }
});

// Get system logs with filtering
router.get('/logs', async (req, res) => {
  try {
    console.log('Received logs request with query:', req.query);
    const { filter = 'all', startDate, endDate, limit = 100 } = req.query;
    
    let query = {};
    
    // Apply level filter
    if (filter !== 'all') {
      query.level = filter;
    }
    
    // Apply date range filter
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    console.log('Constructed MongoDB query:', JSON.stringify(query));
    
    const logs = await SystemLog.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('user', 'email');
    
    console.log(`Found ${logs.length} logs. Sample log:`, logs[0]);
    
    // Create test logs if none exist
    if (logs.length === 0) {
      console.log('No logs found, creating test logs...');
      const testLogs = [
        {
          level: 'info',
          message: 'User logged in successfully',
          action: 'USER_LOGIN',
          timestamp: new Date(),
          details: { userId: 'admin', ip: '127.0.0.1' }
        },
        {
          level: 'warning',
          message: 'Failed login attempt',
          action: 'LOGIN_FAILED',
          timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
          details: { attempt: 1, ip: '127.0.0.1' }
        },
        {
          level: 'error',
          message: 'Database connection error',
          action: 'DB_ERROR',
          timestamp: new Date(Date.now() - 1000 * 60 * 10), // 10 minutes ago
          details: { error: 'Connection timeout' }
        }
      ];
      
      console.log('Inserting test logs:', testLogs);
      const createdLogs = await SystemLog.insertMany(testLogs);
      console.log('Created test logs:', createdLogs);
      
      return res.json(createdLogs);
    }
    
    // Transform logs to ensure all required fields are present
    const transformedLogs = logs.map(log => ({
      _id: log._id,
      level: log.level,
      message: log.message,
      timestamp: log.timestamp,
      user: log.user ? log.user.email : null,
      action: log.action || null,
      details: log.details || null
    }));
    
    console.log('Sending transformed logs:', transformedLogs);
    res.json(transformedLogs);
  } catch (error) {
    console.error('Error in /logs endpoint:', error);
    res.status(500).json({ 
      message: 'Error fetching logs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add new log entry
router.post('/logs', async (req, res) => {
  try {
    const { level, message, action } = req.body;
    
    const log = new SystemLog({
      level,
      message,
      action,
      user: req.user._id,
      timestamp: new Date()
    });
    
    await log.save();
    res.status(201).json(log);
  } catch (error) {
    console.error('Error creating log:', error);
    res.status(500).json({ message: 'Error creating log entry' });
  }
});

// Get system settings
router.get('/settings', async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    
    if (!settings) {
      settings = new SystemSettings({
        siteName: 'PharmaLink',
        maintenanceMode: false,
        emailNotifications: true,
        backupFrequency: 'daily',
        analyticsEnabled: true,
        theme: 'light'
      });
      await settings.save();
    }
    
    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ message: 'Error fetching system settings' });
  }
});

// Update system settings
router.put('/settings', async (req, res) => {
  try {
    const updates = req.body;
    let settings = await SystemSettings.findOne();
    
    if (!settings) {
      settings = new SystemSettings(updates);
    } else {
      Object.assign(settings, updates);
    }
    
    await settings.save();
    
    // Log the settings update
    const log = new SystemLog({
      level: 'info',
      message: 'System settings updated',
      action: 'settings_update',
      user: req.user._id,
      timestamp: new Date()
    });
    await log.save();
    
    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ message: 'Error updating system settings' });
  }
});

// Generate system report
router.get('/report', async (req, res) => {
  try {
    // Add your report generation logic here
    const report = {
      timestamp: new Date(),
      data: 'Sample report data'
    };
    res.json(report);
  } catch (error) {
    res.status(500).json({ message: 'Error generating report' });
  }
});

export default router;
