const express = require('express');
const axios = require('axios');
const cors = require('cors');

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
        const response = await axios.post('http://localhost:11434/api/generate', {
            model: 'deepseek-r1:7b',
            prompt: prompt,
            stream: true
        }, { responseType: 'stream' });

        res.setHeader('Content-Type', 'text/plain');

        let buffer = '';
        response.data.on('data', (chunk) => {
            buffer += chunk.toString();
            try {
                const data = JSON.parse(buffer);
                if (data.response) {
                    res.write(data.response);
                }
                buffer = '';
            } catch (e) {
                // Buffer incomplete JSON; continue collecting
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

    // Add the user prompt to chat history
    chatHistory.push({ role: 'user', content: prompt });

    try {
        const payload = {
            model: 'deepseek-r1:7b', // Replace with your specific model
            messages: chatHistory,
            stream: false,
        };

        const response = await axios.post('http://localhost:11434/api/chat', payload);
        console.log('DeepSeek Response:', JSON.stringify(response.data, null, 2));


        const assistantResponse = response?.data?.['message']['content'].split('</think>')[1]?.trim() || 'No meaningful response.';
        console.log('Assistant Response:', assistantResponse);

        // Append assistant response to chat history
        chatHistory.push({ role: 'assistant', content: assistantResponse });

        res.json({ response: assistantResponse });

    } catch (error) {
        console.error('Error communicating with the model:', error?.response?.data || error.message);
        res.status(500).json({ error: 'Failed to get response from the model' });
    }
});


app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});