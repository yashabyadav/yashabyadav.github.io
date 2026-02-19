import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

const workspace = process.cwd();
const contentDir = path.join(workspace, 'src', 'content', 'media_diet_page');
const outDir = path.join(workspace, 'public', 'assets', 'posters');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const files = ['fav_movies.json', 'fav_tv_shows.json', 'fav_video_games.json'];

function sanitizeName(name) {
  return name.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toLowerCase();
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error('empty url'));
    try {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`status ${res.statusCode}`));
        }
        const fileStream = fs.createWriteStream(dest);
        res.pipe(fileStream);
        fileStream.on('finish', () => fileStream.close(() => resolve()));
        fileStream.on('error', (err) => reject(err));
      });
      req.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

async function processFile(fileName) {
  const filePath = path.join(contentDir, fileName);
  if (!fs.existsSync(filePath)) return [];
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const report = [];

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const url = item.posterUrl && item.posterUrl.trim();
    if (!url) {
      report.push({ title: item.title || `item_${i}`, status: 'no-url' });
      continue;
    }

    // determine extension
    let ext = path.extname(new URL(url).pathname) || '.jpg';
    if (ext.length > 6) ext = '.jpg';

    const base = sanitizeName((item.title || `item_${i}`) + (item.imdbId ? `_${item.imdbId}` : ''));
    const filename = `${base}${ext}`;
    const dest = path.join(outDir, filename);

    try {
      await download(url, dest);
      // update posterUrl to local path
      item.posterUrl = `/assets/posters/${filename}`;
      report.push({ title: item.title || filename, status: 'downloaded', file: `/assets/posters/${filename}` });
    } catch (err) {
      report.push({ title: item.title || filename, status: 'failed', error: err.message });
    }
  }

  // write updated json back
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return report;
}

(async () => {
  const all = {};
  for (const f of files) {
    try {
      const r = await processFile(f);
      all[f] = r;
    } catch (err) {
      all[f] = { error: err.message };
    }
  }
  console.log(JSON.stringify(all, null, 2));
})();
