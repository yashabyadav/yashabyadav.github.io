import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';

const file = path.join(process.cwd(), 'src', 'content', 'media_diet_page', 'fav_video_games.json');
if (!fs.existsSync(file)) {
  console.error('fav_video_games.json not found');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));

function checkUrl(url) {
  return new Promise((resolve) => {
    if (!url) return resolve({ url, ok: false, status: 'empty' });
      try {
        const lib = url.startsWith('https') ? https : http;
        const options = { method: 'GET', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Node.js script)' } };
        const req = lib.request(url, options, (res) => {
          resolve({ url, ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode });
          // drain data
          res.on('data', () => {});
        });
        req.on('error', (err) => resolve({ url, ok: false, status: err.message }));
        req.setTimeout(8000, () => { req.abort(); resolve({ url, ok: false, status: 'timeout' }); });
        req.end();
      } catch (err) {
        resolve({ url, ok: false, status: err.message });
      }
  });
}

(async () => {
  for (const item of data) {
    const result = await checkUrl(item.posterUrl || '');
    console.log(item.title.padEnd(30), '|', result.ok ? 'OK' : 'FAIL', '|', result.status, '|', result.url || '(empty)');
  }
})();
