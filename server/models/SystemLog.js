import mongoose from 'mongoose';

const systemLogSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: ['info', 'warning', 'error'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  action: {
    type: String
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  }
});

// Index for faster queries
systemLogSchema.index({ timestamp: -1 });
systemLogSchema.index({ level: 1 });
systemLogSchema.index({ user: 1 });

const SystemLog = mongoose.model('SystemLog', systemLogSchema);

export default SystemLog;
