// The TEST key pair from mac-cleaner docs/reference/license-key-format.md. Test only: the app never
// trusts it in a release, and the production private key lives only in Supabase secrets.
export const TEST_SEED = '8ad278073221015096d53c67edfe8c6adf17680b519f6d7e1febd21f875ae5ae';
export const TEST_PUBLIC = '281edbf56bcb31e08ce7365ddfc3c2b7e48543b62e182a97f68c5dbd359100ea';

/** The format doc's test vector: license ID, standard, 3 Macs, issued 2026-11-01 (day 20758). */
export const VECTOR = {
  id: '5f0c2a8e-3b1d-4c6f-9a7e-2d4b8c1e6f30',
  payload: '015f0c2a8e3b1d4c6f9a7e2d4b8c1e6f3001035116',
  key: 'CD1-AFPQYKUOHMOUY342PYWUXDA6N4YACA2RCZNANLQOLOVBPE7YY2TQLLQHQYCN2NRSAPS25JC6ZXJASXVXWQY6FRAPPNOSR6XEHBQHV2WWO7ZYV6VXQL3AAIERS5UY3GQNOF2UIWIJ',
};
