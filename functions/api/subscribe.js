// Cloudflare Pages Function: POST /api/subscribe
// Adds a quiz taker to MailerLite without exposing the API key in the browser.
//
// Environment variables (Cloudflare Pages > Settings > Variables and Secrets):
//   MAILERLITE_API_KEY           secret, from MailerLite > Integrations > API
//   MAILERLITE_QUIZ_GROUP_ID     group that starts the 3-email automation
//   MAILERLITE_WAITLIST_GROUP_ID group for the Lift the Rope in 7 Days waitlist
//   MAILERLITE_PROGRAM_GROUP_ID  group for the Lift the Velvet Rope Program waitlist
//                                (optional: until it is set, Program signups join the 7 Days group)
//   MAILERLITE_EXECUTIVE_GROUP_ID group for the Executive Blindspot Audit waitlist

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
  // Visiting /api/subscribe in a browser shows which settings this deployment can see
  // (true/false only, never the values), so a missing variable is easy to spot.
  if (request.method === "GET") {
    return json({
      api_key: Boolean(env.MAILERLITE_API_KEY),
      quiz_group: Boolean(env.MAILERLITE_QUIZ_GROUP_ID),
      waitlist_group: Boolean(env.MAILERLITE_WAITLIST_GROUP_ID),
      program_group: Boolean(env.MAILERLITE_PROGRAM_GROUP_ID),
      executive_group: Boolean(env.MAILERLITE_EXECUTIVE_GROUP_ID),
    });
  }
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

  const GROUPS = {
    quiz: env.MAILERLITE_QUIZ_GROUP_ID,
    waitlist: env.MAILERLITE_WAITLIST_GROUP_ID,
    program: env.MAILERLITE_PROGRAM_GROUP_ID || env.MAILERLITE_WAITLIST_GROUP_ID,
    executive: env.MAILERLITE_EXECUTIVE_GROUP_ID,
  };
  const list = Object.hasOwn(GROUPS, data.list) ? data.list : "quiz";
  const groupId = GROUPS[list];
  if (!env.MAILERLITE_API_KEY || !groupId) {
    return json({ ok: false, error: "not_configured" }, 503);
  }

  const fields = {};
  if (name) fields.name = name;
  // Optional phone (executive waitlist). Stored in MailerLite's built-in "phone" field.
  const phone = String(data.phone || "").trim().slice(0, 40);
  if (phone) fields.phone = phone;
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
