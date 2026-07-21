// utils.js

const X_LIMIT = 280;

// Splits a generated post into { mainText, hashtags } by pulling out the
// trailing "TAGS: #a #b #c" line the prompts are instructed to produce.
function splitHashtags(rawText) {
  const match = rawText.match(/\n?TAGS:\s*(.+)\s*$/i);
  if (!match) {
    return { mainText: rawText.trim(), hashtags: "" };
  }
  const hashtags = match[1].trim();
  const mainText = rawText.slice(0, match.index).trim();
  return { mainText, hashtags };
}

// Given mainText + hashtags, decides whether they fit in one X post or need
// to become a two-post thread (main post, then a reply with the hashtags).
function buildXPostPlan(rawText) {
  const { mainText, hashtags } = splitHashtags(rawText);
  const combined = hashtags ? `${mainText} ${hashtags}` : mainText;

  if (combined.length <= X_LIMIT) {
    return { primary: combined, reply: null };
  }

  const primary = mainText.length > X_LIMIT ? mainText.slice(0, X_LIMIT - 1) + "…" : mainText;
  const reply = hashtags && hashtags.length <= X_LIMIT ? hashtags : hashtags.slice(0, X_LIMIT - 1) + "…";
  return { primary, reply: reply || null };
}

module.exports = { splitHashtags, buildXPostPlan, X_LIMIT };
