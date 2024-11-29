import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import User from '../models/User.js';
import SystemLog from '../models/SystemLog.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

// Validation schemas
const storeDetailsSchema = z.object({
  storeName: z.string().min(1, "Store name is required"),
  description: z.string().min(1, "Store description is required"),
  address: z.string().min(1, "Store address is required"),
  phone: z.string().min(1, "Store phone is required"),
  logo: z.string().optional()
});

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(['user', 'vendor']),
  storeDetails: z.union([
    storeDetailsSchema,
    z.undefined()
  ])
}).refine(
  (data) => {
    if (data.role === 'vendor') {
      return data.storeDetails !== undefined;
    }
    return true;
  },
  {
    message: "Store details are required for vendor registration",
    path: ["storeDetails"]
  }
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  role: z.enum(['user', 'vendor', 'admin', 'superadmin']).optional()
});

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  statusReason: z.string().optional()
});

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY || 'admin_secret_2024';

// Generate tokens function
const generateTokens = (userId, email, role) => {
  const accessToken = jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { userId, tokenVersion: Date.now() },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Register route
router.post('/register', async (req, res) => {
  try {
    console.log('Registration request received:', {
      ...req.body,
      password: '[REDACTED]'
    });
    
    // Validate request body
    const validatedData = registerSchema.parse(req.body);
    console.log('Validation passed:', {
      ...validatedData,
      password: '[REDACTED]'
    });

    // Check if user already exists
    const existingUser = await User.findOne({ 
      email: validatedData.email.toLowerCase() 
    });
    
    if (existingUser) {
      console.log('User already exists:', existingUser.email);
      return res.status(409).json({ 
        message: 'Email already exists' 
      });
    }

    // Hash password securely using bcrypt
    const saltRounds = 10; // Use a higher number for more secure hashes, but slower performance
    const salt = await bcrypt.genSalt(saltRounds);
    console.log('Generated salt for password hashing:', {
      saltLength: salt.length,
      saltStart: salt.substring(0, 10)
    });
    
    const hashedPassword = await bcrypt.hash(validatedData.password, salt);
    console.log('Password hashed successfully:', {
      originalLength: validatedData.password.length,
      hashedLength: hashedPassword.length,
      hashedStart: hashedPassword.substring(0, 10),
      hashedEnd: hashedPassword.substring(hashedPassword.length - 10)
    });

    // Prepare user data
    const userData = {
      name: validatedData.name,
      email: validatedData.email.toLowerCase(),
      password: hashedPassword,
      role: validatedData.role,
      status: validatedData.role === 'vendor' ? 'pending' : 'active',
      lastLogin: new Date()
    };

    // Add store details for vendor
    if (validatedData.role === 'vendor' && validatedData.storeDetails) {
      userData.storeDetails = {
        storeName: validatedData.storeDetails.storeName.trim(),
        description: validatedData.storeDetails.description.trim(),
        address: validatedData.storeDetails.address.trim(),
        phone: validatedData.storeDetails.phone.trim(),
        logo: validatedData.storeDetails.logo || '',
        active: false
      };
    }

    console.log('Creating new user with data:', { 
      ...userData, 
      password: '[REDACTED]',
      hashedLength: hashedPassword.length,
      hashedStart: hashedPassword.substring(0, 10)
    });

    // Create and save user
    const user = new User(userData);
    // Skip password hashing middleware since we already hashed it
    user.$skipMiddleware = true;
    
    try {
      await user.save();
      
      // Verify the saved password
      const savedUser = await User.findById(user._id);
      console.log('User saved successfully:', {
        id: savedUser._id,
        email: savedUser.email,
        role: savedUser.role,
        hasPassword: !!savedUser.password,
        passwordLength: savedUser.password?.length,
        passwordStart: savedUser.password?.substring(0, 10),
        passwordEnd: savedUser.password?.substring(savedUser.password.length - 10),
        passwordMatches: savedUser.password === hashedPassword
      });

      // Test password verification
      const testVerification = await bcrypt.compare(validatedData.password, savedUser.password);
      console.log('Test password verification:', {
        success: testVerification,
        email: savedUser.email
      });

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user._id, user.email, user.role);
      console.log('Tokens generated successfully');

      try {
        // Try to create system log, but don't fail registration if it fails
        await SystemLog.create({
          level: 'info',
          message: `New ${user.role} registered: ${user.email}`,
          user: user._id,
          action: 'register'
        });
        console.log('System log created successfully');
      } catch (logError) {
        console.error('Failed to create system log:', logError);
        // Continue with registration even if logging fails
      }

      // Return success response
      const response = {
        message: 'Registration successful',
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          storeDetails: user.storeDetails
        },
        tokens: {
          accessToken,
          refreshToken
        }
      };

      console.log('Sending success response:', { 
        ...response, 
        tokens: '[REDACTED]' 
      });
      res.status(201).json(response);

    } catch (saveError) {
      console.error('Error saving user:', {
        name: saveError.name,
        message: saveError.message,
        code: saveError.code,
        errors: saveError.errors
      });
      throw saveError;
    }

  } catch (error) {
    console.error('Registration error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      errors: error.errors
    });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: error.errors.map(e => ({
          field: e.path.join('.'),
          message: e.message
        }))
      });
    }

    if (error.code === 11000) {
      return res.status(409).json({ 
        message: 'Email already exists'
      });
    }

    // Send appropriate error response
    res.status(500).json({ 
      message: 'Registration failed. Please try again.',
      error: process.env.NODE_ENV === 'development' ? {
        message: error.message,
        code: error.code,
        name: error.name
      } : undefined
    });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    console.log('Login attempt:', { ...req.body, password: '[REDACTED]' });
    const validatedData = loginSchema.parse(req.body);
    const { email, password, role } = validatedData;

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ message: 'Account not found with this email' });
    }

    console.log('Found user:', {
      id: user._id,
      email: user.email,
      role: user.role,
      status: user.status,
      hasPassword: !!user.password,
      passwordLength: user.password?.length
    });

    // Verify role if specified
    if (role) {
      // For admin login, allow both admin and superadmin roles
      if (role === 'admin' && !['admin', 'superadmin'].includes(user.role)) {
        console.log('Admin access denied:', { requested: role, actual: user.role });
        return res.status(403).json({ message: 'Access denied. Admin credentials required.' });
      }
      // For other roles, require exact match
      else if (role !== 'admin' && user.role !== role) {
        console.log('Role mismatch:', { requested: role, actual: user.role });
        return res.status(403).json({ message: `Invalid credentials for ${role} login` });
      }
    }

    // Check password directly with bcrypt
    console.log('Attempting password verification:', {
      hasStoredPassword: !!user.password,
      storedPasswordLength: user.password?.length,
      inputPasswordLength: password?.length
    });

    let isMatch = false;
    try {
      isMatch = await bcrypt.compare(password, user.password);
      console.log('Password verification result:', {
        isMatch,
        email: user.email,
        role: user.role,
        status: user.status
      });
    } catch (error) {
      console.error('Error during password verification:', error);
      return res.status(500).json({ message: 'Error verifying password' });
    }

    if (!isMatch) {
      console.log('Password mismatch for user:', {
        email,
        role,
        hashedPasswordLength: user.password?.length,
        inputPasswordLength: password?.length
      });

      // Log failed login attempt
      await SystemLog.create({
        level: 'warning',
        message: 'Failed login attempt',
        action: 'LOGIN_FAILED',
        details: { 
          email,
          role,
          reason: 'password_mismatch'
        },
        timestamp: new Date()
      });
      return res.status(400).json({ message: 'Invalid password' });
    }

    // For vendors, check approval status
    if (user.role === 'vendor') {
      console.log('Vendor login attempt:', { status: user.status, storeActive: user.storeDetails?.active });
      
      if (user.status !== 'active') {
        return res.status(403).json({ 
          message: 'Your vendor account is pending approval',
          status: user.status 
        });
      }
      
      if (!user.storeDetails?.active) {
        return res.status(403).json({ 
          message: 'Your store is not yet activated',
          status: 'store_inactive'
        });
      }
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user._id, user.email, user.role);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Log successful login
    await SystemLog.create({
      level: 'info',
      message: 'User logged in successfully',
      action: 'LOGIN_SUCCESS',
      user: user._id,
      timestamp: new Date()
    });

    // Send response
    const response = {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        storeDetails: user.storeDetails
      },
      tokens: {
        accessToken,
        refreshToken
      }
    };
    
    console.log('Login successful:', { 
      userId: user._id, 
      role: user.role, 
      status: user.status 
    });
    
    res.json(response);
  } catch (error) {
    console.error('Login error:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ 
        message: 'Validation failed',
        errors: error.errors 
      });
    }
    
    res.status(500).json({ message: 'Error logging in user' });
  }
});

// Refresh token route
router.post('/refresh-token', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token required' });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.userId).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Generate new tokens
    const tokens = generateTokens(user._id, user.email, user.role);

    res.json({ tokens });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ message: 'Invalid refresh token' });
  }
});

// Get profile route
router.get('/profile', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      ...(user.role === 'vendor' && { storeDetails: user.storeDetails })
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ message: 'Server error while fetching profile' });
  }
});

// Update profile route
router.put('/profile', auth, async (req, res) => {
  try {
    const validatedData = updateProfileSchema.parse(req.body);
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Handle status change (admin only)
    if (validatedData.status && req.user.role === 'admin' && userId !== req.user.id) {
      user.status = validatedData.status;
      if (validatedData.statusReason) {
        user.statusHistory = user.statusHistory || [];
        user.statusHistory.unshift({
          status: validatedData.status,
          reason: validatedData.statusReason,
          timestamp: new Date()
        });
      }
    }

    // Update basic info
    if (validatedData.name) user.name = validatedData.name;
    if (validatedData.email) user.email = validatedData.email.toLowerCase();

    // Handle password change
    if (validatedData.currentPassword && validatedData.newPassword) {
      const isMatch = await user.comparePassword(validatedData.currentPassword);
      if (!isMatch) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(validatedData.newPassword, salt);
    }

    await user.save();

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      statusHistory: user.statusHistory,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      storeDetails: user.storeDetails
    });
  } catch (error) {
    console.error('Profile update error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: error.errors[0].message });
    }
    res.status(500).json({ message: 'Server error during profile update' });
  }
});

// Delete user route (superuser only)
router.delete('/users/:userId', auth, async (req, res) => {
  try {
    // Check if the requester is a superuser
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ message: 'Only superadmins can delete users' });
    }

    const userToDelete = await User.findById(req.params.userId);
    
    if (!userToDelete) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Prevent superadmin from being deleted
    if (userToDelete.role === 'superadmin') {
      return res.status(403).json({ message: 'Superadmin users cannot be deleted' });
    }

    // Log the deletion
    await SystemLog.create({
      level: 'warning',
      message: `User deleted by superadmin`,
      action: 'USER_DELETED',
      user: req.user.id,
      details: {
        deletedUserId: userToDelete._id,
        deletedUserEmail: userToDelete.email
      },
      timestamp: new Date()
    });

    // Delete the user
    await User.findByIdAndDelete(req.params.userId);

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ message: 'Error deleting user' });
  }
});

// Reset vendor password route
router.post('/reset-vendor-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Find vendor user
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      role: 'vendor'
    });

    if (!user) {
      return res.status(404).json({ message: 'Vendor account not found' });
    }

    // Generate new password
    const newPassword = 'Vendor@123';
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    // Log password reset
    await SystemLog.create({
      level: 'info',
      message: 'Vendor password reset',
      action: 'PASSWORD_RESET',
      user: user._id,
      timestamp: new Date()
    });

    res.json({ 
      message: 'Password has been reset successfully',
      email: user.email,
      newPassword: newPassword // Only for development/testing
    });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'Error resetting password' });
  }
});

export default router;