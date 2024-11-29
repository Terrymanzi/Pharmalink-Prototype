import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const statusHistorySchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    required: true
  },
  reason: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { _id: false });

const storeDetailsSchema = new mongoose.Schema({
  storeName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  logo: {
    type: String,
    trim: true,
    default: ''
  },
  active: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters']
  },
  role: {
    type: String,
    enum: ['user', 'vendor', 'admin', 'superadmin'],
    default: 'user'
  },
  storeDetails: {
    type: storeDetailsSchema,
    required: function() {
      return this.role === 'vendor';
    }
  },
  permissions: {
    manageUsers: { type: Boolean, default: false },
    manageProducts: { type: Boolean, default: false },
    manageOrders: { type: Boolean, default: false },
    manageSettings: { type: Boolean, default: false },
    promoteUsers: { type: Boolean, default: false },
    viewAnalytics: { type: Boolean, default: false },
    managePermissions: { type: Boolean, default: false }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'pending'],
    default: function() {
      return this.role === 'vendor' ? 'pending' : 'active';
    }
  },
  statusHistory: [statusHistorySchema],
  lastLogin: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Remove sensitive data when converting to JSON
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  console.log('Password comparison method called:', {
    hasPassword: !!this.password,
    passwordLength: this.password?.length,
    candidateLength: candidatePassword?.length
  });
  
  if (!this.password || !candidatePassword) {
    console.log('Missing password data:', {
      hasStoredPassword: !!this.password,
      hasInputPassword: !!candidatePassword
    });
    return false;
  }

  try {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    console.log('Password comparison result:', {
      isMatch,
      passwordLength: this.password?.length,
      inputLength: candidatePassword?.length,
      storedPasswordStart: this.password?.substring(0, 10),
      storedPasswordEnd: this.password?.substring(this.password.length - 10)
    });
    return isMatch;
  } catch (error) {
    console.error('Error comparing passwords:', {
      error,
      hashedLength: this.password?.length,
      inputLength: candidatePassword?.length
    });
    return false;
  }
};

// Pre-save middleware to handle validation
userSchema.pre('save', async function(next) {
  try {
    console.log('Pre-save middleware running:', {
      isNew: this.isNew,
      modifiedPaths: this.modifiedPaths(),
      isPasswordModified: this.isModified('password'),
      role: this.role,
      status: this.status,
      skipMiddleware: !!this.$skipMiddleware,
      hasPassword: !!this.password,
      passwordLength: this.password?.length
    });

    // Skip password hashing if middleware is disabled for this save
    if (this.$skipMiddleware) {
      console.log('Password hashing middleware skipped due to $skipMiddleware flag');
      return next();
    }

    // Hash password if it's new or modified
    if (this.isModified('password')) {
      console.log('Password is being modified:', {
        hasPassword: !!this.password,
        passwordLength: this.password?.length
      });

      if (!this.password) {
        console.log('No password provided, skipping hash');
        return next();
      }

      // Check if password is already hashed
      if (this.password.startsWith('$2')) {
        console.log('Password appears to be already hashed, skipping hash');
        return next();
      }

      try {
        const salt = await bcrypt.genSalt(10);
        console.log('Generated salt for password hashing in middleware:', {
          saltLength: salt.length,
          saltStart: salt.substring(0, 10)
        });
        
        const hashedPassword = await bcrypt.hash(this.password, salt);
        console.log('Password hashed in middleware:', {
          originalLength: this.password.length,
          hashedLength: hashedPassword.length,
          hashedStart: hashedPassword.substring(0, 10),
          hashedEnd: hashedPassword.substring(hashedPassword.length - 10)
        });
        
        this.password = hashedPassword;
      } catch (error) {
        console.error('Error hashing password in middleware:', {
          error,
          passwordLength: this.password?.length
        });
        throw error;
      }
    }

    // Handle role-based validation
    if (this.isModified('role') || (this.role === 'vendor' && this.isNew)) {
      switch (this.role) {
        case 'vendor':
          if (!this.storeDetails || !this.storeDetails.storeName) {
            throw new Error('Store details are required for vendor accounts');
          }
          this.permissions = {
            manageUsers: false,
            manageProducts: true,
            manageOrders: true,
            manageSettings: false,
            promoteUsers: false,
            viewAnalytics: true,
            managePermissions: false
          };
          break;
        case 'admin':
          this.permissions = {
            manageUsers: true,
            manageProducts: true,
            manageOrders: true,
            manageSettings: true,
            promoteUsers: false,
            viewAnalytics: true,
            managePermissions: false
          };
          break;
        case 'superadmin':
          this.permissions = {
            manageUsers: true,
            manageProducts: true,
            manageOrders: true,
            manageSettings: true,
            promoteUsers: true,
            viewAnalytics: true,
            managePermissions: true
          };
          break;
        default:
          this.permissions = {
            manageUsers: false,
            manageProducts: false,
            manageOrders: false,
            manageSettings: false,
            promoteUsers: false,
            viewAnalytics: false,
            managePermissions: false
          };
      }
    }

    // Track status changes
    if (this.isModified('status')) {
      this.statusHistory = this.statusHistory || [];
      this.statusHistory.unshift({
        status: this.status,
        timestamp: new Date()
      });
    }

    next();
  } catch (error) {
    next(error);
  }
});

// Method to validate store details
userSchema.methods.validateStoreDetails = function() {
  if (this.role === 'vendor') {
    if (!this.storeDetails) {
      throw new Error('Store details are required for vendor accounts');
    }
    
    const requiredFields = ['storeName', 'description', 'address', 'phone'];
    for (const field of requiredFields) {
      if (!this.storeDetails[field]?.trim()) {
        throw new Error(`${field} is required for store details`);
      }
    }
  }
};

// Add validation hook
userSchema.pre('validate', function(next) {
  try {
    if (this.role === 'vendor' && (this.isNew || this.isModified('role') || this.isModified('storeDetails'))) {
      this.validateStoreDetails();
    }
    next();
  } catch (error) {
    next(error);
  }
});

const User = mongoose.model('User', userSchema);

export default User;