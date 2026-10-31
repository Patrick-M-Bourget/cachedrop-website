# Staging and promoting a signed release

The app repository builds, notarizes and EdDSA-signs the final DMG. These website commands neither rebuild nor re-sign it. Keep the resulting `CacheDrop-x.y.z.dmg`, `release-identity.json`, `appcast.xml`, and matching `CacheDrop-x.y.z.html` reviewed notes together. The app's `scripts/release.sh` needs this immutable URL prefix when generating the artifact set:

- Dev: `https://nyefnnwhnlyovpdmzxiw.supabase.co/storage/v1/object/public/updates/x.y.z/`
- Production: `https://dqpvfcthotskzfvdpjdm.supabase.co/storage/v1/object/public/updates/x.y.z/`

The public updates bucket serves updater DMGs independently of the private source repository. The existing private `releases` bucket and emailed/tokenized website download remain intact and deliver identical bytes.

## Owner workflow

Review release notes before building. Apply pending Supabase migrations to the selected environment and deploy the website's `/updates/appcast.xml` route before promotion. Production migration, deployment and publication are separate launch actions; automated tests and acceptance use dev only.

```sh
# Stage without changing website latest or the public feed.
scripts/stage-release.sh dev /path/to/CacheDrop-x.y.z.dmg /path/to/release-identity.json

# Promote only the already staged, verified artifact set.
scripts/promote-release.sh dev /path/to/artifact-directory \
  https://YOUR-ISOLATED-PREVIEW.vercel.app/updates/appcast.xml
```

Dev credentials come only from `.env.local`, and must identify the known dev Supabase project. Production credentials come only from the shell and must identify the separate production project. Both production commands require a typed `prod` confirmation. A dev promotion cannot use the canonical production feed. The production promotion command is:

```sh
scripts/promote-release.sh prod /path/to/artifact-directory https://cachedrop.io/updates/appcast.xml
```

Nothing runs implicitly after `release.sh`; the owner chooses when to stage and promote. The former single-step `publish-dmg.sh` refuses further releases once Sparkle publication starts, preventing it from bypassing version/build and artifact verification.

## Verification, order and retry

Staging validates the stable filename/version, build, size cap, exact SHA-256, bundle/team, source commit and EdDSA signature using the approved app public key. It writes each missing public/private object without overwriting; existing objects must match exactly. It verifies public retrieval, private short-lived signed retrieval, and denial of anonymous access to the private bucket. Upload or verification failure leaves latest and feed unchanged. Earlier immutable artifacts stay available.

Promotion revalidates the local signed artifact, reviewed notes and generated appcast metadata, then re-verifies both remote download destinations. It advances the website's existing latest-release record in a transaction enforcing increasing stable versions and builds. Retrying the exact current identity succeeds without creating another release. It then promotes the appcast last, in a separate guarded transaction; the website's canonical route serves it directly, so each release needs no additional website deployment. The response uses an ETag and `max-age=0, must-revalidate`, with CDN storage disabled. Finally, the command retrieves the served feed and enclosure and checks their exact bytes.

A failure reports completed and remaining state. Retry the same command with the same artifact set. Do not rebuild, re-sign, alter notes, replace bytes, or generate a new version just to recover. If website latest already advanced but feed publication failed, the latest step is an idempotent identity check and the retry resumes feed promotion. If the feed was published but response verification failed, retry verifies the same feed. A retry for an older release cannot regress a newer website latest or feed. Different bytes/identity/notes for a published version are refused.

For a temporary network error after promotion, first retrieve the same immutable artifact and canonical feed again. The state message may say an operation is unconfirmed if its response was lost; the database's identity checks make retry safe.

## Checks

Use Node from `.node-version`, then run the same entry point as CI. It invokes npm pinned by `packageManager` without changing global npm, checks the lockfile with a clean install, and stops on the first failure. The default `site` profile includes typechecking, unit tests, build, HTML/link/JSON-LD checks and the existing non-reference browser suite; `reference` builds and runs the existing reference-render suite on macOS.

```sh
scripts/check.sh site
scripts/check.sh reference
# Optional real RPC checks: strict dev guard and transaction rollback, never prod.
DB_TESTS=dev npx vitest run scripts/release-promotion.db.test.ts
```

Publisher tests inject storage, verification, database and feed failures. They prove appcast-last order and safe retries. Real acceptance must also demonstrate the served isolated feed and both download paths. A protected Vercel preview that redirects to login cannot serve as a Sparkle acceptance feed; use a dedicated public test deployment, never embed protection-bypass credentials in the app. Production publication and signed app A → B installation acceptance remain separate from this tooling verification.
