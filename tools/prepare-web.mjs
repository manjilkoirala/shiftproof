import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';

// Run after Expo's web export. Only app assets are published, never local records.
const out = new URL('../dist/', import.meta.url);
const base = (process.env.WEB_BASE_PATH || '').replace(/\/$/, '');
const htmlPath = new URL('index.html', out);
let html = await readFile(htmlPath, 'utf8');
const metadata = `
<meta name="description" content="Your hours. Your earnings. Track jobs, shifts and pay cycles with ShiftProof.">
<meta name="theme-color" content="#147D69">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="ShiftProof">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="apple-touch-icon" href="${base}/app-icon.png">
<link rel="manifest" href="${base}/manifest.webmanifest">
`;
html = html.replace('</head>', metadata + '</head>');
await writeFile(htmlPath, html);
await copyFile(new URL('../assets/icon.png', import.meta.url), new URL('app-icon.png', out));
await writeFile(new URL('manifest.webmanifest', out), JSON.stringify({
  id: base + '/', name: 'ShiftProof', short_name: 'ShiftProof', start_url: base + '/', scope: base + '/',
  display: 'standalone', background_color: '#F5F7F3', theme_color: '#147D69',
  icons: [{ src: base + '/app-icon.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' }],
}, null, 2));
// Explicit entry pages make refreshes and shared routes work on static hosts.
for (const route of ['dashboard', 'calendar', 'summary', 'jobs', 'compare', 'settings']) {
  await mkdir(new URL(route + '/', out), { recursive: true });
  await writeFile(new URL(route + '/index.html', out), html);
}
console.log('Web export prepared with Home Screen metadata and route entry pages.');
await writeFile(new URL('.nojekyll', out), '');
