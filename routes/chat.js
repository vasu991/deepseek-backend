// routes/chatRoutes.js
const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Message = require('../models/Message');
const User = require('../models/User');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const tokenizer = require('../utils/tokenizer');
const { authenticate } = require('../middlewares/auth');

// GET /chat/:sessionId
router.get('/chat/:sessionId', authenticate, async (req, res) => {
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

router.get('/sessions/:username', authenticate, async (req, res) => {
    try {
        const { username } = req.params;

        // ✅ Find user by username
        const user = await User.findOne({ username });

        if (!user) {
            console.log("User not found:", username);
            return res.status(404).json({ error: 'User not found' });
        }

        // ✅ Fetch sessions using user ID
        const sessions = await Session.find({ user: user._id }).select('sessionId createdAt');

        res.json(sessions);
    } catch (error) {
        console.error("Error fetching sessions:", error);
        res.status(500).json({ error: 'Failed to fetch sessions' });
    }
});




// Create a new chat session
router.get('/new-session', authenticate, async (req, res) => {
    try {
        const sessionId = uuidv4(); // Secure unique session identifier
        const userId = req.user._id;
        const session = new Session({ sessionId, user: userId, messages: [], sessionName: 'New Chat' });

        await session.save();

        res.status(201).json(session);
    } catch (error) {
        console.error('Error creating new session:', error);
        res.status(500).json({ error: 'Failed to create a new session.' });
    }
});

// POST /chat
router.post('/chat', authenticate, async (req, res) => {
    const { sessionId, prompt } = req.body;

    if (!sessionId || !prompt) {
        return res.status(400).json({ error: 'sessionId and prompt are required' });
    }

    try {
        let session = await Session.findOne({ sessionId }).populate('messages');

        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
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

module.exports = router;