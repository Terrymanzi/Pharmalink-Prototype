// Middleware to check if user is an admin
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  if (req.user.role === 'admin' || req.user.role === 'superadmin') {
    next();
  } else {
    res.status(403).json({ message: 'Admin access required' });
  }
};

// Middleware to check if user is a superadmin
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role === 'superadmin') {
    next();
  } else {
    res.status(403).json({ message: 'Superadmin access required' });
  }
};

// Middleware to check specific permissions
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role === 'superadmin' || 
        (req.user.permissions && req.user.permissions[permission])) {
      next();
    } else {
      res.status(403).json({ 
        message: `Required permission: ${permission}`,
        currentRole: req.user.role,
        missingPermission: permission
      });
    }
  };
};
