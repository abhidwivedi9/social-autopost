// generateContent.js
// Calls the Anthropic API to generate a post for the given slot.

const Anthropic = require("@anthropic-ai/sdk");

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function generateForTopic(slot, topic) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: slot.systemPrompt,
    tools: slot.useWebSearch ? [{ type: "web_search_20250305", name: "web_search" }] : undefined,
    messages: [
      {
        role: "user",
        content: `Write today's post about: ${topic}\n\nReturn ONLY the post text (plus the required TAGS: line), nothing else — no preamble, no quotes around it.`
      }
    ]
  });

  return msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}

async function generateContent(slot) {
  // Rotate topic by day-of-year so it doesn't repeat every day (used by CLI test scripts)
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000
  );
  const topic = slot.topics[dayOfYear % slot.topics.length];
  const text = await generateForTopic(slot, topic);
  return { text, topic };
}

async function fetchHeadlines(slot) {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: slot.headlinePrompt,
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages: [
      { role: "user", content: "Find today's trending headlines now, then return the JSON array as instructed." }
    ]
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();

  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed.slice(0, 6);
  } catch {
    // fall through to line-based fallback below
  }

  return text
    .split("\n")
    .map((l) => l.replace(/^[-*\d.\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

module.exports = { generateContent, generateForTopic, fetchHeadlines };
