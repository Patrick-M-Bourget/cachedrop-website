// /llms.txt (#94): built at build time from the pages' own copy (src/components/llms.ts).
import type { APIRoute } from 'astro';
import { llmsTxt } from '../components/llms';

export const GET: APIRoute = ({ site }) =>
  new Response(llmsTxt(site!.origin), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
