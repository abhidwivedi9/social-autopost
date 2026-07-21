// postToLinkedIn.js
// Uses LinkedIn's UGC Posts API (requires "Share on LinkedIn" product + w_member_social scope).
// Needs LINKEDIN_ACCESS_TOKEN (OAuth token you generate once, see README) and LINKEDIN_PERSON_URN
// (your profile URN, e.g. "urn:li:person:xxxxxxx").

const fetch = require("node-fetch");

async function postToLinkedIn(text) {
  const body = {
    author: process.env.LINKEDIN_PERSON_URN,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: "NONE"
      }
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
    }
  };

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LINKEDIN_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0"
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LinkedIn post failed: ${res.status} ${errText}`);
  }

  return res.json();
}

module.exports = { postToLinkedIn };
