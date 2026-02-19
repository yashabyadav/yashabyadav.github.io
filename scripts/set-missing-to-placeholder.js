import fs from 'fs';
import path from 'path';

const workspace = process.cwd();
const file = path.join(workspace, 'src', 'content', 'media_diet_page', 'fav_video_games.json');
if (!fs.existsSync(file)) {
  console.error('fav_video_games.json not found');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(file, 'utf8'));
let changed = false;
for (const item of data) {
  const url = (item.posterUrl || '').trim();
  if (!url || !url.startsWith('/assets/')) {
    item.posterUrl = '/assets/poster-placeholder.svg';
    changed = true;
  }
}

if (changed) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log('Updated fav_video_games.json to use placeholder for missing posters');
} else {
  console.log('No changes needed');
}
