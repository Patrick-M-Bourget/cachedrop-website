# License keys: deploying the `license` function

How the owner puts the `license` Supabase Edge Function (Decision 40, #64) live. Every step here is an owner action: nothing in this repository deploys, sets secrets or touches Stripe. Do it on `dev` with Stripe test mode first, then on `prod`.

## 1. The production key pair

Once, on your Mac. It prints the private seed and the public key; the seed goes only into Supabase secrets and your password manager, never into a file in a repository.

```sh
node -e 'const {subtle}=crypto;(async()=>{const k=await subtle.generateKey({name:"Ed25519"},true,["sign","verify"]);const h=b=>Buffer.from(b).toString("hex");console.log("LICENSE_PRIVATE_KEY="+h(new Uint8Array(await subtle.exportKey("pkcs8",k.privateKey)).slice(16)));console.log("public key: "+h(new Uint8Array(await subtle.exportKey("raw",k.publicKey))))})()'
```

The public key (64 hex characters) goes into the app's `LicensePublicKey` (mac-cleaner #593, its `docs/RELEASING.md`).

## 2. The database

Apply `supabase/migrations/*_licenses.sql` with `npm run db:push -- dev`, then `prod` once you're happy.

## 3. Deploy

```sh
npx supabase login
npx supabase functions deploy license --project-ref <project-ref> --no-verify-jwt
```

JWT verification must be off: Stripe can't send a Supabase token, and the function checks Stripe's signature itself.

## 4. Secrets

```sh
npx supabase secrets set --project-ref <project-ref> \
  LICENSE_PRIVATE_KEY=<64 hex> \
  STRIPE_WEBHOOK_SECRET=<whsec_… from step 5> \
  RESEND_API_KEY=<re_…> \
  TURNSTILE_SECRET_KEY=<the site's Turnstile secret> \
  LICENSE_ADMIN_SECRET=<a new random secret, see "Free licenses">
```

- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to every Edge Function by Supabase.
- `LICENSE_DB_SECRET_KEY` (#76) is needed only when the project's **legacy API keys are disabled**: the injected `SUPABASE_SERVICE_ROLE_KEY` is then rejected and every purchase answers `503`. Create a secret key in Settings → API Keys (`sb_secret_…`, e.g. named `license-function`) and set it here. When set, the function uses it instead of the legacy key. Database errors are logged by name and status (`issue_license failed: issue_license answered 401`) in the function's logs, never with a secret.
- `SITE_ORIGINS` (optional) lists the origins allowed to call `/resend` from a browser, comma-separated; it defaults to `https://cachedrop.io`. Add a preview origin to test the form there.
- `STRIPE_SECRET_KEY` isn't needed: the function never calls Stripe's API, it only reads the signed event.
- Keep copies in `.env.local` only if you need them locally; never commit them.

## 5. The Stripe webhook

In Stripe (test mode first): Developers → Webhooks → Add endpoint.

- URL: `https://<project-ref>.supabase.co/functions/v1/license/stripe-webhook`
- Events: `checkout.session.completed` and `checkout.session.async_payment_succeeded`
- Copy its signing secret into `STRIPE_WEBHOOK_SECRET` (step 4).
- Turn on email alerts for failed webhook deliveries (the ticket's "failed-delivery alerts").

## 6. Check it

1. A request without a signature is refused:
   `curl -i -X POST https://<project-ref>.supabase.co/functions/v1/license/stripe-webhook -d '{}'` answers `400`.
2. A test-mode purchase through the Payment Link emails a `CD1-` key that the app's check accepts (with the matching public key), and adds one row to `public.licenses`.
3. "Resend" on that event in Stripe's dashboard answers `200 {"ok":true,"repeat":true}` and sends no second email.

## Resend my key

`POST https://<project-ref>.supabase.co/functions/v1/license/resend` with JSON `{ "email", "lang": "en" | "fr", "turnstile" }` emails the keys bought with that address again. It needs a Turnstile token, so it is meant for a form on cachedrop.io; that form is a follow-up. Until it ships, a key can go out again by hand: clear `emailed_at` on the buyer's row in `public.licenses`, then resend the purchase's event from Stripe's dashboard; the function emails the same key. This works only more than 24 hours after the first email, since Resend drops a repeat of the same send within 24 hours, and only as far back as Stripe lets you resend an event.

## Free licenses

Decision 45. To give someone a license without Stripe, run on your Mac:

```sh
scripts/comp-license.sh prod friend@example.com --note "beta tester"            # English email
scripts/comp-license.sh prod ami@example.com --lang fr --note "beta tester"     # French email
```

It asks the function's `/comp` route to save a license (`source = 'comp'`, no Stripe IDs, your note) and emails the key in the gift wording ("A CacheDrop license, on us", no refund line). It prints the license ID. The recipient can use "Resend my key" like a buyer, and a free license is revoked like any other. The note is up to 200 characters and only you see it; keep it to why you gave it, not personal details.

Setup, once per project (`dev` first):

1. Apply the migration (`npm run db:push -- dev`, then `prod`) and redeploy the function (step 3).
2. Make a secret: `node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'`. Set it on the function (`npx supabase secrets set --project-ref <project-ref> LICENSE_ADMIN_SECRET=<it>`) and keep it in your password manager. Each project gets its own. The route answers `503` while it is unset or shorter than 32 characters.
3. For `dev`, put `LICENSE_ADMIN_SECRET=<dev secret>` in `.env.local`. For `prod`, the script reads it only from your shell and asks you to type `prod`: ` LICENSE_ADMIN_SECRET=<prod secret> scripts/comp-license.sh prod …` (the leading space keeps it out of zsh history when `HIST_IGNORE_SPACE` is on).

If the email fails, the script says so and prints the command to run again with `--id <license ID>`: that sends the same license instead of making a second one. Running a successful command again with its `--id` sends nothing. To see who got free licenses, run `select email, note, created_at from public.licenses where source = 'comp' order by created_at;` in the SQL editor.
