const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Session = require('../models/Session');

// Register a new user
const register = async (req, res, next) => {
  const { username, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        return res.status(400).json({ error: 'User already exists' });
    }
    const user = new User({ username, email, password});
    // Create a new session for the user
    const session = new Session({ sessionId: generateSessionId(), user: user._id });
    await session.save();

    // Associate the session with the user
    user.sessions.push(session._id);
    await user.save();
    // console.log('Stored Hashed Password:', user.password);
    res.status(201).json({ message: 'Registration successful' });
  } catch (error) {
    next(error);
  }
};

// Login with an existing user
const login = async (req, res, next) => {
  const { username, password } = req.body;
  // console.log('Login Request Body:', req.body); // Debugging

  try {
      const user = await User.findOne({ username });
      // console.log('User Found:', user); // Debugging

      if (!user) {
          return res.status(404).json({ message: 'User not found' });
      }

      const passwordMatch = await user.comparePassword(password);
      // console.log('Password Match:', passwordMatch); // Debugging

      if (!passwordMatch) {
          return res.status(401).json({ message: 'Incorrect password' });
      }

      const token = jwt.sign({ userId: user._id }, process.env.SECRET_KEY, {
          expiresIn: '1h'
      });
      res.json({ token, user: user });
  } catch (error) {
      console.error('Login Error:', error); // Debugging
      next(error);
  }
};

// Helper function to generate a unique session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 11);
}

module.exports = { register, login };