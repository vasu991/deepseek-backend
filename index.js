const express = require('express');
const axios = require('axios');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config()
const tokenizer = require('./tokenizer');
const Message = require('./models/Message');
const Session = require('./models/Session');
const connectDB = require('./utils/db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');

const app = express();
const port = process.env.PORT;

// Middleware
app.use(express.json());
app.use(cors());
app.use('/auth', authRoutes);
app.use('/user', userRoutes);

// Connect to MongoDB
connectDB();

app.get('/chat/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const sId = await Session.findOne({ sessionId });

        if (!sId) {
            return res.status(404).json({ error: 'Chat history not found.' });
        }

        const messagesIds = sId.messages;
        const chatMessages = await Message.find({ _id: { $in: messagesIds } });
        res.json(chatMessages);
    } catch (error) {
        res.status(500).json({ error: `${error}` });
    }
});

// Chat endpoint
app.post('/chat', async (req, res) => {
    const { sessionId, prompt } = req.body;

    if (!sessionId || !prompt) {
        return res.status(400).json({ error: 'sessionId and prompt are required' });
    }

    try {
        let session = await Session.findOne({ sessionId }).populate('messages');

        if (!session) {
            session = new Session({ sessionId, messages: [] });
        }

        // Create and save user message
        const tokenizedPrompt = tokenizer.tokenize(prompt);
        const userMessage = new Message({
            role: 'user',
            content: tokenizer.detokenize(tokenizedPrompt)
        });
        await userMessage.save();
        session.messages.push(userMessage);

        const payload = {
            model: 'deepseek-r1:7b',
            messages: session.messages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            stream: false,
        };

        const response = await axios.post(`${process.env.DEEPSEEK_BASE_URL}/chat`, payload);
        const assistantResponse = response?.data?.['message']['content'].split('</think>')[1]?.trim() || 'No meaningful response.';
        console.log('Assistant Response:', assistantResponse);

        const tokenizedResponse = tokenizer.processApiResponse(assistantResponse);
        const assistantMessage = new Message({
            role: 'assistant',
            content: tokenizer.detokenize(tokenizedResponse)
        });
        await assistantMessage.save();
        session.messages.push(assistantMessage);

        // Save the updated session
        await session.save();

        res.json({ response: tokenizer.detokenize(tokenizedResponse) });

    } catch (error) {
        console.error('Error communicating with the model:', error?.response?.data || error.message);
        res.status(500).json({ error: 'Failed to get response from the model' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
