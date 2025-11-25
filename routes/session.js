const express = require("express");
const router = express.Router();
const Session = require("../models/Session");
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require("../middlewares/auth");
const User = require('../models/User');

router.get('/sessions/:username', authenticate, async (req, res) => {
    try {
        const { username } = req.params;

        const user = await User.findOne({ username });

        if (!user) {
            console.log("User not found:", username);
            return res.status(404).json({ error: 'User not found' });
        }

        const sessions = await Session.find({ user: user._id });
        // console.log("Sessions:", sessions);

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
        const session = new Session({ sessionId, user: userId, messages: [] });

        await session.save();

        res.status(201).json(session);
    } catch (error) {
        console.error('Error creating new session:', error);
        res.status(500).json({ error: 'Failed to create a new session.' });
    }
});

// Update session name
router.post("/:sessionId/update-name", authenticate, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { sessionName } = req.body;

        if (!sessionName) {
            return res.status(400).json({ error: "Session name is required" });
        }

        const session = await Session.findOne({ sessionId });

        if (!session) {
            return res.status(404).json({ error: "Session not found" });
        }

        session.sessionName = sessionName;
        await session.save();

        res.json({ message: "Session name updated successfully", session });
    } catch (error) {
        console.error("Error updating session name:", error);
        res.status(500).json({ error: "Failed to update session name" });
    }
});

module.exports = router;

