# Renzo Ramos Executive Portfolio

Static portfolio hosted at <https://jaws615.github.io/rramosbarra.github.io/>.

## Recruiter resume assistant

The portfolio remains on GitHub Pages. Its optional recruiter chat calls a separately deployed Cloudflare Worker. That Worker calls Workers AI using the reviewed facts in `worker/src/resume-facts.js` and stores contact submissions in D1 only after consent and Turnstile verification.

- Chat questions and up to six recent exchanges are sent to Workers AI. Recent exchanges exist only in page memory and are cleared when the page is refreshed or closed.
- The site does not save chat transcripts or log request bodies.
- Contact submissions are stored in D1 in the United States until manually deleted. The assistant does not send contact details to the model.
- Cloudflare rate limits chat to 10 requests/minute per client IP and contact submissions to 3/minute per client IP. Cloudflare’s rate-limit counters are approximate and local to a Cloudflare location.
- The model can make mistakes. Its answers should be grounded in the facts on the site; questions not answered by those facts should direct recruiters to Renzo’s contact information.

## Local API tests

Install a current Node.js LTS release supported by Wrangler. From the repository root:

```powershell
Set-Location .\worker
npm install
npm test
```

Tests use mocked Workers AI, Turnstile, and D1 bindings; they do not contact Cloudflare or create resources.
Wrangler's AI binding still calls Cloudflare remotely when used from `wrangler dev`, which can consume AI quota. Do not send test prompts through a locally running Worker unless you intend to use the account's Workers AI quota.

## One-time Cloudflare setup

You need a Cloudflare account. No custom domain or third-party model API key is required. The steps below create resources in the account you authenticate to; check the account with `whoami` before proceeding. Never share Cloudflare passwords, tokens, or the Turnstile secret in chat or commit them to Git.

### 1. Authenticate Wrangler

Open PowerShell at the repository root:

```powershell
Set-Location .\worker
npm install
npx wrangler login
npx wrangler whoami
```

`wrangler login` opens Cloudflare’s authorization page in your browser. Complete the login there. Confirm that `wrangler whoami` identifies the intended Cloudflare account before creating resources.

### 2. Create the production D1 database

The database contains recruiter contact requests only. Create it in the agreed U.S. jurisdiction:

```powershell
npx wrangler d1 create rramos-resume-leads --jurisdiction us --binding DB --update-config
```

Wrangler prints the database ID and may print a configuration snippet. Confirm `worker/wrangler.toml` has that exact ID under the `DB` binding; if it still has the all-zero placeholder, replace it with the ID Wrangler printed. Review the diff and confirm the database name and ID before applying the migration. Apply the schema to local D1 first, then to the remote database:

```powershell
npx wrangler d1 migrations apply rramos-resume-leads --local
npx wrangler d1 migrations apply rramos-resume-leads --remote
```

The migration creates `recruiter_contacts` with name, email, message, and a creation timestamp. It does not create chat-history storage.

### 3. Create a Turnstile widget

In the Cloudflare dashboard, open **Turnstile** and create a widget for the hostname:

```text
jaws615.github.io
```

Enter the hostname only; do not include `https://` or the `/rramosbarra.github.io/` project path. The widget's sitekey is public and goes in `index.html` in the `data-turnstile-sitekey` attribute on `#recruiter-assistant`. The secret key must stay server-side. From the `worker` folder, enter it at Wrangler's local prompt:

```powershell
npx wrangler secret put TURNSTILE_SECRET_KEY
```

The Worker validates every contact-form token with Cloudflare's Siteverify API and checks that its hostname matches `jaws615.github.io`.

### 4. Review the Worker bindings and limits

`wrangler.toml` already defines:

- Workers AI binding `AI`, using the configurable `AI_MODEL` variable (initially `@cf/meta/llama-3.1-8b-instruct`).
- D1 binding `DB`; the D1 create command fills its database ID.
- `CHAT_RATE_LIMITER` (10 requests per 60 seconds) and `CONTACT_RATE_LIMITER` (3 requests per 60 seconds).
- `SITE_ORIGIN` and `TURNSTILE_EXPECTED_HOSTNAME` for the published portfolio.

The two rate-limit `namespace_id` values in `wrangler.toml` must be unique within your Cloudflare account. If Wrangler reports a namespace conflict, choose unused integer IDs and update the matching entries before deploying. Rate limits are approximate per Cloudflare location, not a strict global spending cap.

### 5. Deploy the API

From `worker`:

```powershell
npx wrangler deploy
```

Wrangler prints a URL similar to `https://renzo-resume-chat.<your-subdomain>.workers.dev`. This is the API base URL; keep it handy. Workers AI requires no separate model API key. Check your account's current Workers and Workers AI quotas before production use.

### 6. Connect the GitHub Pages site

In the root `index.html`, on the `#recruiter-assistant` element:

- Set `data-api-base-url` to the exact `workers.dev` URL returned by Wrangler, without a trailing slash.
- Set `data-turnstile-sitekey` to the public sitekey from step 3.

Commit/publish the site through its existing GitHub Pages workflow. The chat and contact form remain unavailable until these values are configured; existing resume and contact links continue to work.

### 7. Smoke-test and review submissions

On the published site:

1. Ask a question with a known answer, such as Renzo's years of experience.
2. Ask a follow-up question and confirm it uses the recent page-session context.
3. Ask for a detail not on the site and confirm the assistant says it is not specified rather than guessing.
4. Submit a contact request with consent and complete Turnstile; confirm the success message appears.
5. In the Cloudflare dashboard, open **D1** → `rramos-resume-leads` → **Console** and review the test row:

   ```sql
   SELECT id, name, email, message, created_at
   FROM recruiter_contacts
   ORDER BY id DESC;
   ```

6. Delete the test row when finished:

   ```sql
   DELETE FROM recruiter_contacts WHERE id = <test-row-id>;
   ```

7. Check Worker logs to ensure no request or chat contents are logged. No chat transcripts should appear in D1.

## Reviewing and deleting recruiter requests

Use the D1 console in the Cloudflare dashboard to review requests with the `SELECT` above. Delete individual requests by ID or clear all records with:

```sql
DELETE FROM recruiter_contacts;
```

## Cost and limits

At low traffic, Workers, Workers AI, and D1 may fit within their current free allocations. Workers AI has a daily free Neurons allocation; on the free Workers plan, requests beyond the limit can fail. The Workers Paid plan currently starts at $5/month, and AI use above its free daily allowance is usage-based. Check current rates and quota behavior before launch:

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Turnstile plans](https://developers.cloudflare.com/turnstile/plans/)

## Regenerating the portfolio

`generate-portfolio.ps1` is an older script that writes a previous version of the portfolio files. Do not run it over this site; it would overwrite the current design and recruiter assistant.
