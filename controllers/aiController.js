/**
 * AI Controller — UNIQUE FEATURE
 * Uses Anthropic's Claude to generate smart reply suggestions
 * based on chat context
 */

const Anthropic = require("@anthropic-ai/sdk").default;
const Message = require("../models/Message");
const Chat = require("../models/Chat");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── POST /api/ai/smart-replies ────────────────────────────
// Generate 3 contextual reply suggestions for the last message
exports.getSmartReplies = async (req, res, next) => {
  try {
    const { chatId, lastMessageId } = req.body;

    // Verify membership
    const chat = await Chat.findOne({
      _id: chatId,
      "members.user": req.user._id,
    });
    if (!chat) return res.status(403).json({ error: "Access denied." });

    // Fetch last 5 messages for context
    const recentMessages = await Message.find({
      chatId,
      isDeleted: false,
      threadId: null,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("sender", "username displayName")
      .lean();

    recentMessages.reverse();

    // Build context string
    const contextLines = recentMessages
      .map((m) => {
        const name = m.sender?.displayName || m.sender?.username || "Unknown";
        return `${name}: ${m.content || "[media]"}`;
      })
      .join("\n");

    const prompt = `You are a friendly chat assistant. Based on this conversation context, suggest exactly 3 short, natural reply options the user could send. Keep each reply under 15 words. Make them varied in tone (casual, enthusiastic, thoughtful).

Conversation:
${contextLines}

Respond ONLY with a JSON array of 3 strings. No explanation, no markdown, just the JSON array.
Example: ["That's awesome!", "I totally agree with you on that.", "Hmm, tell me more?"]`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const rawText = response.content[0]?.text?.trim() || "[]";

    let suggestions;
    try {
      // Strip any accidental markdown fences
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      suggestions = JSON.parse(cleaned);
      if (!Array.isArray(suggestions)) throw new Error("Not an array");
    } catch {
      // Fallback suggestions if parse fails
      suggestions = ["Got it!", "Sounds good to me.", "Tell me more!"];
    }

    res.json({ success: true, suggestions: suggestions.slice(0, 3) });
  } catch (error) {
    // Don't crash the app if AI fails — just return fallbacks
    console.error("AI smart reply error:", error.message);
    res.json({
      success: true,
      suggestions: ["Sounds good!", "Interesting...", "I agree!"],
      fallback: true,
    });
  }
};
