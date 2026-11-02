import { describe, expect, it } from 'vitest';
import { LOCAL_ENDPOINT, resendEndpoint } from './license-resend';

describe('resendEndpoint', () => {
  it("is the license function's resend route on the configured Supabase project", () => {
    expect(resendEndpoint('https://example-ref.supabase.co', 'production')).toBe('https://example-ref.supabase.co/functions/v1/license/resend');
    expect(resendEndpoint('https://example-ref.supabase.co/', 'preview')).toBe('https://example-ref.supabase.co/functions/v1/license/resend');
  });

  it('falls back to a same-origin path for local builds and CI, where tests answer it', () => {
    expect(resendEndpoint(undefined, undefined)).toBe(LOCAL_ENDPOINT);
    expect(resendEndpoint('', 'preview')).toBe(LOCAL_ENDPOINT);
    expect(LOCAL_ENDPOINT).toBe('/functions/v1/license/resend');
  });

  it('fails a production build without a Supabase URL instead of shipping a form that goes nowhere', () => {
    expect(() => resendEndpoint(undefined, 'production')).toThrow(/SUPABASE_URL/);
  });

  it('refuses a Supabase URL that is not https', () => {
    expect(() => resendEndpoint('http://example-ref.supabase.co', 'preview')).toThrow(/https/);
    expect(() => resendEndpoint('not a url', 'preview')).toThrow();
  });
});
