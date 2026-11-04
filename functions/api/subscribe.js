// Cloudflare Pages Function: POST /api/subscribe
// Adds a quiz taker to MailerLite without exposing the API key in the browser.
//
// Environment variables (Cloudflare Pages > Settings > Variables and Secrets):
//   MAILERLITE_API_KEY           secret, from MailerLite > Integrations > API
//   MAILERLITE_QUIZ_GROUP_ID     group that starts the 3-email automation
//   MAILERLITE_WAITLIST_GROUP_ID group for the Lift the Rope in 7 Days waitlist

const RESULTS = {
  1: { name: "The Guarded Heart", meaning: "I'm fine on my own." },
  2: { name: "The Shrinker", meaning: "I'm too much." },
  3: { name: "The Spiraler", meaning: "Here we go again." },
  4: { name: "The Chemistry Chaser", meaning: "There's no spark." },
  5: { name: "The Burned-Out Dater", meaning: "There's no one good left." },
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function onRequest({ request, env }) {
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, 405);

  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  // Honeypot: real people never fill this hidden field.
  if (data.website) return json({ ok: true });

  const email = String(data.email || "").trim().slice(0, 254);
  const name = String(data.name || "").trim().slice(0, 80);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ ok: false, error: "invalid_email" }, 422);
  }

  const list = data.list === "waitlist" ? "waitlist" : "quiz";
  const groupId =
    list === "waitlist" ? env.MAILERLITE_WAITLIST_GROUP_ID : env.MAILERLITE_QUIZ_GROUP_ID;
  if (!env.MAILERLITE_API_KEY || !groupId) {
    return json({ ok: false, error: "not_configured" }, 503);
  }

  const fields = {};
  if (name) fields.name = name;
  const result = RESULTS[Number(data.result)];
  if (list === "quiz" && result) {
    fields.quiz_result = result.name;
    fields.quiz_meaning = result.meaning;
  }

  const res = await fetch("https://connect.mailerlite.com/api/subscribers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${env.MAILERLITE_API_KEY}`,
    },
    body: JSON.stringify({ email, fields, groups: [String(groupId)] }),
  });

  if (res.ok) return json({ ok: true });
  const detail = await res.text().catch(() => "");
  console.log("MailerLite error", res.status, detail.slice(0, 500));
  return json({ ok: false, error: "mailerlite_" + res.status }, 502);
}
