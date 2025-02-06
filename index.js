const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors());

// In-memory session storage (replace with a proper session management system in production)
const sessions = {};

// Endpoint to send a prompt to the DeepSeek model
app.post('/ask', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        const ollamaUrl = 'http://localhost:11434/api/generate';

        const response = await axios.post(ollamaUrl, {
            model: 'deepseek-r1:7b',
            prompt: prompt,
            stream: true
        }, { responseType: 'stream' });

        res.setHeader('Content-Type', 'text/plain');

        response.data.on('data', (chunk) => {
            const data = JSON.parse(chunk.toString());
            res.write(data.response);
        });

        response.data.on('end', () => {
            res.end();
        });

    } catch (error) {
        console.error('Error communicating with Ollama:', error);
        res.status(500).json({ error: 'Failed to get response from the model' });
    }
});

// Endpoint to handle chat interactions
app.post('/chat', async (req, res) => {
    const { sessionId, prompt } = req.body;

    if (!sessionId || !prompt) {
        return res.status(400).json({ error: 'sessionId and prompt are required' });
    }

    // Initialize session if it doesn't exist
    if (!sessions[sessionId]) {
        sessions[sessionId] = { messages: [] };
    }

    const chatHistory = sessions[sessionId].messages;

    try {
        const payload = {
            model: 'deepseek-r1:7b', // Replace with your model name
            prompt: prompt,
            chat_history: chatHistory,
            stream: true // Set to true if streaming responses
        };

        console.log('Sending payload to model API:', payload);

        const response = await axios.post('http://localhost:11434/api/chat', payload);

        console.log('Received response from model API:', response.data);

        const assistantResponse = response.data.response;

        if (!assistantResponse) {
            return res.status(500).json({ error: 'Received empty response from the model' });
        }

        // Add user message and assistant response to chat history
        chatHistory.push({ role: 'user', content: prompt });
        chatHistory.push({ role: 'assistant', content: assistantResponse });
        console.log('Updated chat history:', chatHistory);

        // Return the assistant's response
        res.json({ response: assistantResponse });

    } catch (error) {
        console.error('Error communicating with the model:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to get response from the model' });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});