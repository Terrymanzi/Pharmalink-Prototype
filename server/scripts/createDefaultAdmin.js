import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const updateAdminToSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/pharmalink');
    
    // Find existing admin
    const admin = await User.findOne({ email: 'admin@pharmalink.com' });
    
    if (admin) {
      // Update existing admin to superadmin
      admin.role = 'superadmin';
      admin.name = 'Super Admin';
      admin.statusHistory.push({
        status: 'active',
        timestamp: new Date(),
        reason: 'Upgraded to superadmin role'
      });

      await admin.save();
      console.log('Existing admin account upgraded to superadmin successfully');
      console.log('Email: admin@pharmalink.com');
      console.log('\nThis account now has full system access with the following permissions:');
      console.log('- Manage all users');
      console.log('- Promote users to admin/superadmin');
      console.log('- Manage system settings');
      console.log('- View analytics');
      console.log('- Manage permissions');
      console.log('- Full access to all features');
      return;
    }

    // If no admin exists, create one with superadmin role
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Admin@2024', salt);

    const newAdmin = new User({
      name: 'Super Admin',
      email: 'admin@pharmalink.com',
      password: hashedPassword,
      role: 'superadmin',
      status: 'active',
      statusHistory: [{
        status: 'active',
        timestamp: new Date(),
        reason: 'Initial superadmin account creation'
      }]
    });

    await newAdmin.save();
    console.log('New superadmin account created successfully');
    console.log('Email: admin@pharmalink.com');
    console.log('Password: Admin@2024');
    console.log('\nThis account has full system access with the following permissions:');
    console.log('- Manage all users');
    console.log('- Promote users to admin/superadmin');
    console.log('- Manage system settings');
    console.log('- View analytics');
    console.log('- Manage permissions');
    console.log('- Full access to all features');
  } catch (error) {
    console.error('Error updating/creating admin:', error);
  } finally {
    await mongoose.disconnect();
  }
};

updateAdminToSuperAdmin();
