// Head props shared by the form at /download/ and the token page that /download/<token>/ is
// rewritten to (vercel.json). Both are the handoff's download page head (noindex, canonical /download/).
export const downloadHead = {
  title: 'Download CacheDrop for Mac',
  description: 'Download the free CacheDrop beta for Mac: a universal app for Apple Silicon and Intel Macs on macOS 14 or later.',
  path: '/download/',
  robots: 'noindex, follow',
};
