import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const workspace = process.cwd();
const dataFile = path.join(workspace, 'src', 'content', 'media_diet_page', 'fav_video_games.json');
const outDir = path.join(workspace, 'public', 'assets', 'posters');
if (!fs.existsSync(dataFile)) { console.error('fav_video_games.json missing'); process.exit(1); }
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function ddgGetVqd(query) {
  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        const m = raw.match(/vqd='([0-9-]+)'/);
        if (m && m[1]) return resolve(m[1]);
        const m2 = raw.match(/vqd=\"([0-9-]+)\"/);
        if (m2 && m2[1]) return resolve(m2[1]);
        return reject(new Error('vqd not found'));
      });
    }).on('error', reject);
  });
}

function ddgSearch(query, vqd) {
  const url = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&l=us-en&vqd=${vqd}`;
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let raw = '';
      res.on('data', (c) => raw += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          resolve(json);
        } catch (err) {
          reject(err);
        }
      });
    }).on('error', reject);
  });
}

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error('empty url'));
    if (redirects > 5) return reject(new Error('too many redirects'));
    try {
      const lib = url.startsWith('https') ? https : http;
      const req = lib.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location.startsWith('http') ? res.headers.location : new URL(res.headers.location, url).toString();
          res.resume();
          return resolve(download(loc, dest, redirects + 1));
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`status ${res.statusCode}`)); }
        const ws = fs.createWriteStream(dest);
        res.pipe(ws);
        ws.on('finish', () => ws.close(resolve));
        ws.on('error', reject);
      });
      req.on('error', reject);
    } catch (err) { reject(err); }
  });
}

function sanitizeName(name) {
  return name.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

(async () => {
  const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const report = [];
  for (const item of data) {
    if (!item.title) continue;
    const current = (item.posterUrl || '').trim();
    if (current && current.startsWith('/assets/posters/')) { report.push({ title: item.title, status: 'local' }); continue; }

    const q = `${item.title} video game cover art`;
    try {
      const vqd = await ddgGetVqd(q);
      const res = await ddgSearch(q, vqd);
      const first = (res && res.results && res.results[0]) || res?.vignette || (res && res[0]) || null;
      let imageUrl = null;
      if (first && first.image) imageUrl = first.image;
      else if (first && first.thumbnail) imageUrl = first.thumbnail;
      else if (Array.isArray(res) && res[0] && res[0].image) imageUrl = res[0].image;

      if (!imageUrl) {
        report.push({ title: item.title, status: 'no-image-found' });
        continue;
      }

      // guess extension
      let ext = '.jpg';
      try { const p = new URL(imageUrl).pathname; const e = path.extname(p); if (e && e.length <= 5) ext = e; } catch(e){}
      const filename = `${sanitizeName(item.title)}${ext}`;
      const dest = path.join(outDir, filename);
      await download(imageUrl, dest);
      item.posterUrl = `/assets/posters/${filename}`;
      report.push({ title: item.title, status: 'downloaded', file: item.posterUrl });
    } catch (err) {
      report.push({ title: item.title, status: 'error', error: err.message });
    }
  }

  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
  console.log(JSON.stringify(report, null, 2));
})();
