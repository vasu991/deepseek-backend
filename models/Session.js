const mongoose = require('mongoose');
const Message = require('./Message');

const sessionSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }]
});

module.exports = mongoose.model('Session', sessionSchema);
