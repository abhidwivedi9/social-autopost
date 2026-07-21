// postToX.js
const { TwitterApi } = require("twitter-api-v2");

async function postToX(text, replyToId) {
  const client = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET
  });

  // X hard limit is 280 chars — trim safely if the model overshoots
  const safeText = text.length > 280 ? text.slice(0, 277) + "..." : text;

  const options = replyToId ? { reply: { in_reply_to_tweet_id: replyToId } } : {};
  const result = await client.v2.tweet(safeText, options);
  return result;
}

async function postToXWithMedia(text, imageBuffer, replyToId) {
  const client = new TwitterApi({
    appKey: process.env.X_API_KEY,
    appSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessSecret: process.env.X_ACCESS_SECRET
  });

  const mediaId = await client.v1.uploadMedia(imageBuffer, { mimeType: "image/jpeg" });

  const safeText = text.length > 280 ? text.slice(0, 277) + "..." : text;
  const options = { media: { media_ids: [mediaId] } };
  if (replyToId) options.reply = { in_reply_to_tweet_id: replyToId };

  const result = await client.v2.tweet(safeText, options);
  return result;
}

module.exports = { postToX, postToXWithMedia };
