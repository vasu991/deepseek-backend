const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    sessionName: { type: String, required: false },
    sessionId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Session', sessionSchema);
