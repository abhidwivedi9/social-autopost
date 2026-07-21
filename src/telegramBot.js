// telegramBot.js
// Core Telegram bot logic, shared between:
//   - src/bot.js    (local dev: long polling, run with `npm run bot`)
//   - src/server.js (Cloud Run: webhook mode, always-on & free at low volume)

const https = require("https");
const { Telegraf, Markup } = require("telegraf");
const { SLOTS } = require("./config");
const { generateForTopic, fetchHeadlines } = require("./generateContent");
const { postToX, postToXWithMedia } = require("./postToX");
const { postToLinkedIn } = require("./postToLinkedIn");
const { buildXPostPlan, splitHashtags } = require("./utils");
const { generateImage } = require("./generateImage");

const headlineCache = new Map(); // slotKey -> array of currently fetched headlines
const pending = new Map(); // id -> { slotKey, topic, text, primary, reply }
let counter = 0;
const nextId = () => String(++counter);
const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

// Force IPv4 — avoids WSL2 IPv6 hang/timeout issues when run locally.
// Harmless on Cloud Run too.
const ipv4Agent = new https.Agent({ family: 4 });
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {
  telegram: { agent: ipv4Agent }
});
const OWNER_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function pickTopicForAutoPost(slot) {
  if (slot.dynamicTopics) {
    const headlines = await fetchHeadlines(slot);
    if (!headlines.length) throw new Error("No headlines found");
    return headlines[Math.floor(Math.random() * headlines.length)];
  }
  return slot.topics[Math.floor(Math.random() * slot.topics.length)];
}

async function autoPostSlot(slotKey) {
  const slot = SLOTS[slotKey];
  if (!slot) return;

  let topic, text, primary, reply;
  try {
    topic = await pickTopicForAutoPost(slot);
    text = await generateForTopic(slot, topic);
    ({ primary, reply } = buildXPostPlan(text));
  } catch (err) {
    await bot.telegram.sendMessage(OWNER_CHAT_ID, `❌ *${slot.name}* auto-post: generation failed — ${err.message}`, { parse_mode: "Markdown" });
    return;
  }

  let xResult, liResult;
  let image = null;
  try {
    image = await generateImage(topic);
  } catch (err) {
    console.error("Auto-post image generation failed:", err.message);
  }

  try {
    const r = image ? await postToXWithMedia(primary, image) : await postToX(primary);
    let replyNote = "";
    if (reply) {
      try {
        await postToX(reply, r.data.id);
        replyNote = " (+ tags in reply)";
      } catch (err) {
        replyNote = ` (reply with tags failed: ${err.message})`;
      }
    }
    xResult = `✅ X posted (id ${r.data.id})${image ? " (+ image)" : ""}${replyNote}`;
  } catch (err) {
    xResult = `❌ X failed: ${err.message}`;
  }

  if (process.env.LINKEDIN_ACCESS_TOKEN) {
    try {
      const { mainText, hashtags } = splitHashtags(text);
      await postToLinkedIn(hashtags ? `${mainText}\n\n${hashtags}` : mainText);
      liResult = "✅ LinkedIn posted";
    } catch (err) {
      liResult = `❌ LinkedIn failed: ${err.message}`;
    }
  } else {
    liResult = "⏭️ LinkedIn not configured yet";
  }

  const summary = `🤖 *${slot.name}* auto-posted\nTopic: ${topic}\n\n${primary}\n\n${xResult}\n${liResult}`;
  if (image) {
    await bot.telegram.sendPhoto(OWNER_CHAT_ID, { source: image }, { caption: summary, parse_mode: "Markdown" });
  } else {
    await bot.telegram.sendMessage(OWNER_CHAT_ID, summary, { parse_mode: "Markdown" });
  }
}

async function askTopic(slotKey) {
  const slot = SLOTS[slotKey];
  if (!slot) return;

  if (slot.autoPost) {
    return autoPostSlot(slotKey);
  }

  if (slot.dynamicTopics) {
    await bot.telegram.sendMessage(
      OWNER_CHAT_ID,
      `🔎 *${slot.name}* — searching for today's trending stories…`,
      { parse_mode: "Markdown" }
    );
    let headlines;
    try {
      headlines = await fetchHeadlines(slot);
    } catch (err) {
      await bot.telegram.sendMessage(OWNER_CHAT_ID, `❌ Couldn't fetch headlines: ${err.message}`);
      return;
    }
    if (!headlines.length) {
      await bot.telegram.sendMessage(OWNER_CHAT_ID, "❌ No headlines found, try again in a bit.");
      return;
    }
    headlineCache.set(slotKey, headlines);
    const rows = headlines.map((h, i) => [
      Markup.button.callback(truncate(h, 50), `dtopic|${slotKey}|${i}`)
    ]);
    await bot.telegram.sendMessage(
      OWNER_CHAT_ID,
      `📰 *${slot.name}* — pick a story:`,
      { parse_mode: "Markdown", ...Markup.inlineKeyboard(rows) }
    );
    return;
  }

  const rows = slot.topics.map((t, i) => [
    Markup.button.callback(truncate(t, 40), `topic|${slotKey}|${i}`)
  ]);
  rows.push([Markup.button.callback("🎲 Surprise me", `topic|${slotKey}|random`)]);
  await bot.telegram.sendMessage(
    OWNER_CHAT_ID,
    `🕐 *${slot.name}* — pick today's topic:`,
    { parse_mode: "Markdown", ...Markup.inlineKeyboard(rows) }
  );
}

function previewButtons(id, hasImage) {
  const rows = [
    [Markup.button.callback("✅ Post now", `approve|${id}`)],
    [Markup.button.callback(hasImage ? "🖼️ Regenerate image" : "🖼️ Add image", `image|${id}`)],
    [Markup.button.callback("🔄 Regenerate text", `regen|${id}`)],
    [Markup.button.callback("❌ Skip", `skip|${id}`)]
  ];
  return Markup.inlineKeyboard(rows);
}

async function showPreview(slotKey, topic) {
  const slot = SLOTS[slotKey];
  const text = await generateForTopic(slot, topic);
  const { primary, reply } = buildXPostPlan(text);
  const id = nextId();

  let image = null;
  try {
    image = await generateImage(topic);
  } catch (err) {
    console.error("Image generation failed:", err.message);
  }

  pending.set(id, { slotKey, topic, text, primary, reply, image });

  const caption = reply
    ? `📝 *${slot.name}*\nTopic: ${topic}\n\n*Post 1:*\n${primary}\n\n*Reply (extra tags):*\n${reply}`
    : `📝 *${slot.name}*\nTopic: ${topic}\n\n${primary}`;

  if (image) {
    await bot.telegram.sendPhoto(OWNER_CHAT_ID, { source: image }, {
      caption,
      parse_mode: "Markdown",
      ...previewButtons(id, true)
    });
  } else {
    await bot.telegram.sendMessage(
      OWNER_CHAT_ID,
      `${caption}\n\n⚠️ Image generation failed — will post text-only unless you tap "Add image" to retry.`,
      { parse_mode: "Markdown", ...previewButtons(id, false) }
    );
  }
}

bot.action(/^topic\|(.+)\|(.+)$/, async (ctx) => {
  const [, slotKey, sel] = ctx.match;
  const slot = SLOTS[slotKey];
  const topic =
    sel === "random"
      ? slot.topics[Math.floor(Math.random() * slot.topics.length)]
      : slot.topics[Number(sel)];
  await ctx.answerCbQuery("Generating…");
  await ctx.editMessageReplyMarkup().catch(() => {});
  await showPreview(slotKey, topic);
});

bot.action(/^dtopic\|(.+)\|(.+)$/, async (ctx) => {
  const [, slotKey, idxStr] = ctx.match;
  const headlines = headlineCache.get(slotKey) || [];
  const topic = headlines[Number(idxStr)];
  if (!topic) return ctx.answerCbQuery("Expired — send 'post' again");
  await ctx.answerCbQuery("Generating…");
  await ctx.editMessageReplyMarkup().catch(() => {});
  await showPreview(slotKey, topic);
});

bot.action(/^image\|(.+)$/, async (ctx) => {
  const id = ctx.match[1];
  const item = pending.get(id);
  if (!item) return ctx.answerCbQuery("Expired, pick a topic again");
  await ctx.answerCbQuery("Generating image…");

  try {
    const imageBuffer = await generateImage(item.topic);
    item.image = imageBuffer;
    pending.set(id, item);

    await bot.telegram.sendPhoto(
      OWNER_CHAT_ID,
      { source: imageBuffer },
      {
        caption: `🖼️ Image for: ${item.topic}`,
        ...previewButtons(id, true)
      }
    );
  } catch (err) {
    await bot.telegram.sendMessage(OWNER_CHAT_ID, `❌ Image generation failed: ${err.message}`);
  }
});

bot.action(/^approve\|(.+)$/, async (ctx) => {
  const id = ctx.match[1];
  const item = pending.get(id);
  if (!item) return ctx.answerCbQuery("Expired, pick a topic again");
  await ctx.answerCbQuery("Posting…");
  await ctx.editMessageReplyMarkup().catch(() => {});

  let xResult, liResult;
  try {
    const r = item.image
      ? await postToXWithMedia(item.primary, item.image)
      : await postToX(item.primary);
    let replyNote = "";
    if (item.reply) {
      try {
        await postToX(item.reply, r.data.id);
        replyNote = " (+ tags in reply)";
      } catch (err) {
        replyNote = ` (reply with tags failed: ${err.message})`;
      }
    }
    xResult = `✅ X posted (id ${r.data.id})${item.image ? " (+ image)" : ""}${replyNote}`;
  } catch (err) {
    xResult = `❌ X failed: ${err.message}`;
  }

  if (process.env.LINKEDIN_ACCESS_TOKEN) {
    try {
      const { mainText, hashtags } = splitHashtags(item.text);
      await postToLinkedIn(hashtags ? `${mainText}\n\n${hashtags}` : mainText);
      liResult = "✅ LinkedIn posted";
    } catch (err) {
      liResult = `❌ LinkedIn failed: ${err.message}`;
    }
  } else {
    liResult = "⏭️ LinkedIn not configured yet";
  }

  pending.delete(id);
  await bot.telegram.sendMessage(OWNER_CHAT_ID, `${xResult}\n${liResult}`);
});

bot.action(/^regen\|(.+)$/, async (ctx) => {
  const id = ctx.match[1];
  const item = pending.get(id);
  if (!item) return ctx.answerCbQuery("Expired, pick a topic again");
  await ctx.answerCbQuery("Regenerating…");
  await ctx.editMessageReplyMarkup().catch(() => {});
  pending.delete(id);
  await showPreview(item.slotKey, item.topic);
});

bot.action(/^skip\|(.+)$/, async (ctx) => {
  pending.delete(ctx.match[1]);
  await ctx.answerCbQuery("Skipped");
  await ctx.editMessageReplyMarkup().catch(() => {});
});

bot.hears(/^post$/i, async (ctx) => {
  const rows = Object.keys(SLOTS).map((k) => [
    Markup.button.callback(SLOTS[k].name, `pickslot|${k}`)
  ]);
  await ctx.reply("Which slot do you want to post for?", Markup.inlineKeyboard(rows));
});

bot.action(/^pickslot\|(.+)$/, async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.editMessageReplyMarkup().catch(() => {});
  await askTopic(ctx.match[1]);
});

bot.catch((err, ctx) => {
  console.error(`Bot error on update ${ctx?.update?.update_id}:`, err.message);
});

module.exports = { bot, askTopic, SLOTS };
