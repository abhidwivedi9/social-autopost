// server.js
// CLOUD RUN entrypoint — webhook mode instead of polling, so this can scale to
// zero and cost ~$0 at personal-scale usage, and keeps working even if your
// laptop is off.
//
// Two ways this gets invoked:
//   1. Telegram calls POST /telegram-webhook whenever you tap a button or
//      message the bot.
//   2. Cloud Scheduler calls POST /trigger/:slotKey at each scheduled time,
//      authenticated with a shared secret header.

require("dotenv").config();
const express = require("express");
const { bot, askTopic, SLOTS } = require("./telegramBot");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const WEBHOOK_PATH = "/telegram-webhook";
const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET; // shared secret, set in Cloud Run env + Scheduler header

app.use(WEBHOOK_PATH, bot.webhookCallback());

// Cloud Scheduler hits this at each scheduled time instead of an in-process cron,
// since Cloud Run instances don't stay alive to run their own cron scheduler.
app.post("/trigger/:slotKey", async (req, res) => {
  if (req.header("X-Scheduler-Secret") !== SCHEDULER_SECRET) {
    return res.status(401).send("unauthorized");
  }
  const slotKey = req.params.slotKey;
  if (!SLOTS[slotKey]) {
    return res.status(404).send(`unknown slot: ${slotKey}`);
  }
  try {
    await askTopic(slotKey);
    res.status(200).send("ok");
  } catch (err) {
    console.error("Trigger failed:", err.message);
    res.status(500).send(err.message);
  }
});

app.get("/", (req, res) => res.send("social-autopost bot is running"));

app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  const url = process.env.PUBLIC_URL; // e.g. https://social-autopost-bot-xxxxx.run.app
  if (url) {
    try {
      await bot.telegram.setWebhook(`${url}${WEBHOOK_PATH}`);
      console.log(`Telegram webhook set to ${url}${WEBHOOK_PATH}`);
    } catch (err) {
      console.error("Failed to set webhook:", err.message);
    }
  } else {
    console.warn("PUBLIC_URL not set — webhook not registered. Set it after first deploy, then redeploy.");
  }
});
