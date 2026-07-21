// generateImage.js
// Free, keyless AI image generation via Pollinations.ai.
// Images are generated fresh from a text prompt — original AI art, not scraped
// photos or stock images, so no copyright/licensing concerns.

function buildImagePrompt(topic) {
  // Keep it generic/visual — no real people, no logos/brands, no text-in-image
  // requests (models render text poorly and it can look unprofessional).
  return `Clean modern digital illustration representing: ${topic}. Flat design style, ` +
    `tech-editorial look, no text, no logos, no watermarks, no real people's faces.`;
}

async function generateImage(topic) {
  const prompt = buildImagePrompt(topic);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Image generation failed: ${res.status}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = { generateImage, buildImagePrompt };
