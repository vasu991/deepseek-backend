const express = require('express');
const axios = require('axios');
const cors = require('cors');
const tokenizer = require('./tokenizer');

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

const sessions = {};

// Endpoint to send a prompt to the DeepSeek model
app.post('/ask', async (req, res) => {
    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
    }

    try {
        // Tokenize prompt before sending
        const tokens = tokenizer.tokenize(prompt);
        console.log('Tokenized Prompt:', tokens);

        const response = await axios.post('http://localhost:11434/api/generate', {
            model: 'deepseek-r1:7b',
            prompt: tokenizer.detokenize(tokens),
            stream: true
        }, { responseType: 'stream' });

        res.setHeader('Content-Type', 'text/plain');

        let buffer = '';
        response.data.on('data', (chunk) => {
            buffer += chunk.toString();
            try {
                const data = JSON.parse(buffer);
                if (data.response) {
                    const tokenizedResponse = tokenizer.processApiResponse(data.response);
                    console.log('Tokenized Response:', tokenizedResponse);
                    res.write(data.response);
                }
                buffer = '';
            } catch (e) {
                // Continue accumulating incomplete JSON
            }
        });

        response.data.on('end', () => res.end());

    } catch (error) {
        console.error('Error communicating with DeepSeek:', error.message);
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

    // Tokenize and add user prompt to chat history
    const tokenizedPrompt = tokenizer.tokenize(prompt);
    chatHistory.push({ role: 'user', content: tokenizer.detokenize(tokenizedPrompt) });

    try {
        const payload = {
            model: 'deepseek-r1:7b',
            messages: chatHistory,
            stream: false,
        };

        const response = await axios.post('http://localhost:11434/api/chat', payload);

        const assistantResponse = response?.data?.['message']['content'].split('</think>')[1]?.trim() || 'No meaningful response.';
        console.log('Assistant Response:', assistantResponse);

        // Tokenize and append assistant response to chat history
        const tokenizedResponse = tokenizer.processApiResponse(assistantResponse);
        chatHistory.push({ role: 'assistant', content: tokenizer.detokenize(tokenizedResponse) });
        console.log(chatHistory);

        res.json({ response: tokenizer.detokenize(tokenizedResponse) });

    } catch (error) {
        console.error('Error communicating with the model:', error?.response?.data || error.message);
        res.status(500).json({ error: 'Failed to get response from the model' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
