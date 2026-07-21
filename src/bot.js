// bot.js
// LOCAL DEV entrypoint — long polling. Run with: npm run bot
// For always-on, laptop-independent hosting, use src/server.js on Cloud Run instead
// (see README's "Cloud Run deployment" section).

require("dns").setDefaultResultOrder("ipv4first"); // avoids WSL2 IPv6 hang/timeout issues
require("dotenv").config();
const cron = require("node-cron");
const { bot, askTopic } = require("./telegramBot");

const TZ = "Asia/Kolkata";
cron.schedule("0 6 * * *", () => askTopic("6am"), { timezone: TZ });
cron.schedule("0 7 * * *", () => askTopic("7am"), { timezone: TZ });
cron.schedule("0 8 * * *", () => askTopic("india_news_hi"), { timezone: TZ });
cron.schedule("0 9 * * *", () => askTopic("9am"), { timezone: TZ });
cron.schedule("0 11 * * *", () => askTopic("11am"), { timezone: TZ });
cron.schedule("0 13 * * *", () => askTopic("1pm"), { timezone: TZ });
cron.schedule("0 17 * * *", () => askTopic("5pm"), { timezone: TZ });
cron.schedule("0 21 * * *", () => askTopic("9pm"), { timezone: TZ });

bot.launch();
console.log("Bot running (local polling) — listening for Telegram messages and scheduled triggers.");

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
