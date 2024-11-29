import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ 
        message: 'No token, authorization denied',
        needsRefresh: false 
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database using userId from token
      const user = await User.findById(decoded.userId).select('-password');
      
      if (!user) {
        return res.status(401).json({ 
          message: 'Token is not valid - user not found',
          needsRefresh: false 
        });
      }

      // Add user and decoded data to request
      req.user = {
        id: user._id,
        email: user.email,
        role: user.role
      };
      req.decodedToken = decoded;
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          message: 'Token has expired',
          needsRefresh: true
        });
      }
      
      res.status(401).json({ 
        message: 'Token is not valid',
        needsRefresh: false
      });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};

export const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    if (!['admin', 'superadmin'].includes(user.role)) {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    next();
  } catch (error) {
    res.status(500).json({ message: 'Server Error' });
  }
};