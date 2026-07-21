// index.js
// Entry point. Run with SLOT env var set to one of: 6am, 9am, 1pm, 5pm, 9pm
// Example: SLOT=6am node src/index.js

require("dns").setDefaultResultOrder("ipv4first"); // avoids WSL2 IPv6 hang/timeout issues

require("dotenv").config();
const { SLOTS } = require("./config");
const { generateContent } = require("./generateContent");
const { postToX } = require("./postToX");
const { postToLinkedIn } = require("./postToLinkedIn");

async function main() {
  const slotKey = process.env.SLOT;
  const slot = SLOTS[slotKey];

  if (!slot) {
    console.error(`Unknown or missing SLOT env var. Got: "${slotKey}". Valid: ${Object.keys(SLOTS).join(", ")}`);
    process.exit(1);
  }

  console.log(`[${new Date().toISOString()}] Running slot "${slotKey}" — ${slot.name}`);

  const { text, topic } = await generateContent(slot);
  console.log(`Topic: ${topic}`);
  console.log(`Generated post:\n${text}\n`);

  if (slot.requiresReview) {
    // Gaming-policy slot: don't auto-publish, surface for a human check instead.
    // Simplest version: log it clearly + exit non-zero so the CI/CronJob log flags it.
    // Swap this block for a Telegram/Slack webhook call if you want a push notification.
    console.log("⚠️  This slot is flagged for human review before publishing.");
    console.log("Post NOT sent automatically. Copy/paste manually if approved, or wire up a notification here.");
    return;
  }

  const results = { x: null, linkedin: null };

  try {
    results.x = await postToX(text);
    console.log("✅ Posted to X:", results.x?.data?.id);
  } catch (err) {
    console.error("❌ X post failed:", err.message);
  }

  try {
    results.linkedin = await postToLinkedIn(text);
    console.log("✅ Posted to LinkedIn");
  } catch (err) {
    console.error("❌ LinkedIn post failed:", err.message);
  }

  if (!results.x && !results.linkedin) {
    process.exit(1); // both failed — let the CronJob show a failed run
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
