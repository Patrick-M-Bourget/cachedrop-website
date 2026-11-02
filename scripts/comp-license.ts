// Owner-run: gives someone a free license (Decision 45). Asks the license Edge Function's /comp
// route to save it and email the key, since the signing key exists only as a Supabase secret.
//   scripts/comp-license.sh <dev|prod> <email> [--lang en|fr] [--note "why"] [--id <uuid>]
// dev reads LICENSE_ADMIN_SECRET from .env.local; prod reads it from the shell and asks first.
import { randomUUID } from 'node:crypto';
import { confirmProduction, localEnvironment, PROJECTS } from './stage-release.ts';

export interface CompRequest {
  target: 'dev' | 'prod';
  id: string;
  email: string;
  lang: 'en' | 'fr';
  note?: string;
}

const USAGE = 'usage: scripts/comp-license.sh <dev|prod> <email> [--lang en|fr] [--note "why"] [--id <uuid>]';

/** Reads the command line; a new license gets a fresh UUID unless --id retries an earlier one. */
export function parseArgs(argv: string[], newId: () => string = randomUUID): CompRequest {
  const [target, email, ...rest] = argv;
  if ((target !== 'dev' && target !== 'prod') || !email || email.startsWith('--')) throw new Error(USAGE);
  const request: CompRequest = { target, email, lang: 'en', id: '' };
  for (let i = 0; i < rest.length; i += 2) {
    const [flag, value] = [rest[i], rest[i + 1]];
    if (value === undefined) throw new Error(USAGE);
    if (flag === '--lang' && (value === 'en' || value === 'fr')) request.lang = value;
    else if (flag === '--note') request.note = value;
    else if (flag === '--id') request.id = value;
    else throw new Error(USAGE);
  }
  request.id ||= newId();
  return request;
}

/** The admin secret for the target: dev from .env.local, prod only from the shell (like releases). */
export function adminSecret(target: 'dev' | 'prod', shellEnv: Record<string, string | undefined>, local: Record<string, string | undefined>) {
  const secret = (target === 'dev' ? local : shellEnv).LICENSE_ADMIN_SECRET;
  if (!secret) throw new Error(`Set LICENSE_ADMIN_SECRET ${target === 'dev' ? 'in .env.local' : 'in your shell'} to the ${target} function's secret.`);
  return secret;
}

/** Calls /comp and says what happened in one line; throws with what to do next when nothing was sent. */
export async function compLicense(request: CompRequest, secret: string, fetchFn: typeof fetch = fetch): Promise<string> {
  const { target, id, email, lang, note } = request;
  const retry = `Run it again with --id ${id} to send the same license.`;
  let res: Response;
  try {
    res = await fetchFn(`${PROJECTS[target]}/functions/v1/license/comp`, {
      method: 'POST',
      headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
      body: JSON.stringify({ id, email, lang, note }),
    });
  } catch (e) {
    throw new Error(`Couldn't reach the license function (${(e as Error).message}). ${retry}`);
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; repeat?: boolean };
  if (res.ok) return body.repeat ? `Already sent: license ${id} went to ${email} earlier.` : `Sent a free license to ${email} (license ${id}).`;
  if (res.status === 401) throw new Error(`The ${target} function refused LICENSE_ADMIN_SECRET.`);
  if (res.status === 409) throw new Error(`ID ${id} is already used by another license or address. Run it without --id.`);
  if (res.status === 400) throw new Error(`The function refused the request (${body.error ?? 'bad request'}).`);
  throw new Error(`Not sent (${[res.status, body.error].filter(Boolean).join(' ')}). ${retry}`);
}

if (import.meta.main) {
  try {
    const request = parseArgs(process.argv.slice(2));
    const secret = adminSecret(request.target, process.env, localEnvironment());
    if (request.target === 'prod' && !await confirmProduction(`Give ${request.email} a free license on`)) {
      throw new Error('Not confirmed; nothing sent.');
    }
    console.log(await compLicense(request, secret));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Failed.');
    process.exitCode = 1;
  }
}
