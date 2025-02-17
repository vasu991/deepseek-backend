// routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const Session = require("../models/Session");
const Message = require("../models/Message");
const User = require("../models/User");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const tokenizer = require("../utils/tokenizer");
const { authenticate } = require("../middlewares/auth");

// GET /chat/:sessionId
router.get("/:sessionId", authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sId = await Session.findOne({ sessionId });

    if (!sId) {
      return res.status(404).json({ error: "Chat history not found." });
    }

    const messagesIds = sId.messages;
    const chatMessages = await Message.find({ _id: { $in: messagesIds } });
    res.json(chatMessages);
  } catch (error) {
    res.status(500).json({ error: `${error}` });
  }
});

// POST /chat
router.post("/", authenticate, async (req, res) => {
  const { sessionId, prompt } = req.body;

  if (!sessionId || !prompt) {
    return res.status(400).json({ error: "sessionId and prompt are required" });
  }

  try {
    let session = await Session.findOne({ sessionId }).populate("messages");

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Create and save user message
    const tokenizedPrompt = tokenizer.tokenize(prompt);
    const userMessage = new Message({
      role: "user",
      content: tokenizer.detokenize(tokenizedPrompt),
    });
    await userMessage.save();
    session.messages.push(userMessage);

    const payload = {
      model: "deepseek-r1:7b",
      messages: session.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      stream: false,
    };

    const response = await axios.post(
      `${process.env.DEEPSEEK_BASE_URL}/chat`,
      payload
    );
    const assistantResponse =
      response?.data?.["message"]["content"].split("</think>")[1]?.trim() ||
      "No meaningful response.";
    console.log("Assistant Response:", assistantResponse);

    const tokenizedResponse = tokenizer.processApiResponse(assistantResponse);
    const assistantMessage = new Message({
      role: "assistant",
      content: tokenizer.detokenize(tokenizedResponse),
    });
    await assistantMessage.save();
    session.messages.push(assistantMessage);

    // Save the updated session
    await session.save();

    res.json({ response: tokenizer.detokenize(tokenizedResponse) });
  } catch (error) {
    console.error(
      "Error communicating with the model:",
      error?.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to get response from the model" });
  }
});

// POST /chat/stream
router.post("/stream", authenticate, async (req, res) => {
  const { sessionId, prompt } = req.body;

  if (!sessionId || !prompt) {
    return res.status(400).json({ error: "sessionId and prompt are required" });
  }

  try {
    let session = await Session.findOne({ sessionId }).populate("messages");

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Create and save user message
    const tokenizedPrompt = tokenizer.tokenize(prompt);
    const userMessage = new Message({
      role: "user",
      content: tokenizer.detokenize(tokenizedPrompt),
    });
    console.log("User Message:", userMessage.content);
    await userMessage.save();
    session.messages.push(userMessage);

    const payload = {
      model: "deepseek-r1:7b",
      messages: session.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      stream: true, // Enable streaming
    };

    // Set headers for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Make the request to DeepSeek API with streaming
    const response = await axios.post(
      `${process.env.DEEPSEEK_BASE_URL}/chat`,
      payload,
      {
        responseType: "stream", // Enable streaming response
      }
    );

    let assistantResponse = "";

    // Stream the response from DeepSeek API to the client
    response.data.on("data", (chunk) => {
      const chunkString = chunk.toString();
      console.log("🔹 Raw Chunk Received:", chunkString); // Debugging: Log full chunk data

      try {
        // Parse the chunk as JSON
        const chunkData = JSON.parse(chunkString);

        // Extract content from the parsed JSON
        const content = chunkData.message?.content?.trim();

        if (content) {
          console.log("🔹 Extracted Content:", content);

          // Remove unnecessary newlines but preserve spaces
          const finalContent = content.replace(/\n+/g, " ").trim();

          console.log("🔹 Cleaned Content:", finalContent); // Log cleaned content

          // Ignore empty or unnecessary content
          if (!finalContent) {
            console.warn("⚠️ Ignoring empty or unnecessary content.");
            return;
          }

          // Accumulate response
          assistantResponse += finalContent + " "; // Ensure space is added
          // console.log("📝 Accumulated Assistant Response:", assistantResponse);

          // Send as JSON to preserve spaces
          res.write(`data: ${finalContent}\n\n`);
        }
      } catch (error) {
        console.error("❌ Error parsing chunk as JSON:", error);
      }
    });

    // Handle streaming end event
    response.data.on("end", async () => {
      console.log(
        "🔹 Streaming Ended. Final Assistant Response:",
        assistantResponse
      );

      if (!assistantResponse.trim()) {
        console.error("❌ Error: Assistant response is empty");
        res.write(
          `data: ${JSON.stringify({
            content: "Assistant response is empty",
          })}\n\n`
        );
        return res.end();
      }

      try {
        // Save the final assistant message
        const assistantMessage = new Message({
          role: "assistant",
          content: assistantResponse.trim(),
        });

        await assistantMessage.save();
        session.messages.push(assistantMessage);
        await session.save();

        console.log("✅ Assistant response successfully saved.");
      } catch (error) {
        console.error("❌ Error saving assistant message:", error);
      }

      res.end();
    });

    // Handle errors
    response.data.on("error", (err) => {
      console.error("❌ Error in response stream:", err);
      res.write(
        `data: ${JSON.stringify({ content: "Stream error occurred" })}\n\n`
      );
      res.end();
    });
  } catch (error) {
    console.error(
      "❌ Error communicating with the model:",
      error?.response?.data || error.message
    );
    res.status(500).json({ error: "Failed to get response from the model" });
  }
});

module.exports = router;
