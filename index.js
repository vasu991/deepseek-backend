const express = require('express');
const cors = require('cors');
require('dotenv').config()
const connectDB = require('./utils/db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const chatRoutes = require('./routes/chat');
const sessionRoutes = require('./routes/session');

const app = express();
const port = process.env.PORT;

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(cors());


// API Routes
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/session', sessionRoutes);

// Global Error Handler (Prevents Server Crash)
app.use((err, req, res, next) => {
    console.error("Server Error:", err.message);
    res.status(err.status || 500).json({ error: err.message || "Internal Server Error" });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
