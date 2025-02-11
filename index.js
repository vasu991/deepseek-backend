const express = require('express');
const cors = require('cors');
require('dotenv').config()
const connectDB = require('./utils/db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const chatRoutes = require('./routes/chat');

const app = express();
const port = process.env.PORT;

// Connect to MongoDB
connectDB();

// Middleware
app.use(express.json());
app.use(cors());
app.use('/auth', authRoutes);
app.use('/user', userRoutes);
app.use('/', chatRoutes);



app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
