# sumansmith.com

Static site for Suman Smith's author brand, deployed by Cloudflare Pages from `main`.

- `index.html` – homepage
- `quiz/` – The Velvet Rope Quiz (vanilla HTML/JS, no build step)
- `worksheet.pdf` – the one-page Lift the Velvet Rope worksheet
- `functions/api/subscribe.js` – Cloudflare Pages Function that adds quiz takers to MailerLite

## Quiz setup (MailerLite + Cloudflare)

In MailerLite:
1. Subscribers > Fields: add two Text fields, `quiz_result` and `quiz_meaning`.
2. Subscribers > Groups: create "Velvet Rope Quiz" and "Lift the Rope in 7 Days waitlist". Note each group's ID.
3. Integrations > API: generate a token.
4. Automations: trigger "When subscriber joins a group" (Velvet Rope Quiz), then Email 1, wait 2 days, Email 2, wait 2 days, Email 3.

In Cloudflare Pages > my-awesome-website > Settings > Variables and Secrets (Production):
- `MAILERLITE_API_KEY` (as a secret)
- `MAILERLITE_QUIZ_GROUP_ID`
- `MAILERLITE_WAITLIST_GROUP_ID`

Then redeploy. Until these are set, the quiz still shows results and offers the worksheet download.
