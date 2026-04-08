import express from "express";
import multer from "multer";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { join, dirname, extname } from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

const PHOTOS_DIR = join(ROOT, "src", "content", "photos_page");
const PHOTOS_MANIFEST = join(PHOTOS_DIR, "index.json");
const MEDIA_DIR = join(ROOT, "src", "content", "media_diet_page");
const CURRENT_MEDIA = join(MEDIA_DIR, "current.json");
const FAVORITES = {
  movies: join(MEDIA_DIR, "fav_movies.json"),
  tvshows: join(MEDIA_DIR, "fav_tv_shows.json"),
  games: join(MEDIA_DIR, "fav_video_games.json"),
  books: join(MEDIA_DIR, "fav_books.json"),
};

const app = express();
app.use(express.json());

// Serve photo files for preview thumbnails in admin UI
app.use("/photos-preview", express.static(PHOTOS_DIR));

// Multer: save uploads directly into photos_page dir
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PHOTOS_DIR),
  filename: (_req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// ── Photos API ──────────────────────────────────────────────────────────────

app.get("/api/photos", (_req, res) => {
  res.json(JSON.parse(readFileSync(PHOTOS_MANIFEST, "utf-8")));
});

app.post("/api/photos/upload", upload.single("file"), (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: "No file provided" });
  const ext = extname(file.originalname).toLowerCase();
  const type = [".mp4", ".webm", ".mov"].includes(ext) ? "video" : "image";
  const caption = req.body.caption || file.originalname;
  const manifest = JSON.parse(readFileSync(PHOTOS_MANIFEST, "utf-8"));
  manifest.push({ file: file.originalname, caption, type });
  writeFileSync(PHOTOS_MANIFEST, JSON.stringify(manifest, null, 2));
  res.json({ success: true });
});

app.put("/api/photos/manifest", (req, res) => {
  writeFileSync(PHOTOS_MANIFEST, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

app.delete("/api/photos/:filename", (req, res) => {
  const filePath = join(PHOTOS_DIR, req.params.filename);
  if (existsSync(filePath)) unlinkSync(filePath);
  const manifest = JSON.parse(readFileSync(PHOTOS_MANIFEST, "utf-8"));
  writeFileSync(
    PHOTOS_MANIFEST,
    JSON.stringify(
      manifest.filter((i) => i.file !== req.params.filename),
      null,
      2,
    ),
  );
  res.json({ success: true });
});

// ── Media Diet API ───────────────────────────────────────────────────────────

app.get("/api/media/current", (_req, res) => {
  res.json(JSON.parse(readFileSync(CURRENT_MEDIA, "utf-8")));
});

app.put("/api/media/current", (req, res) => {
  writeFileSync(CURRENT_MEDIA, JSON.stringify(req.body, null, 2));
  res.json({ success: true });
});

app.get("/api/media/favorites/:type", (req, res) => {
  const f = FAVORITES[req.params.type];
  if (!f) return res.status(400).json({ error: "Invalid type" });
  res.json(JSON.parse(readFileSync(f, "utf-8")));
});

app.post("/api/media/favorites/:type", (req, res) => {
  const f = FAVORITES[req.params.type];
  if (!f) return res.status(400).json({ error: "Invalid type" });
  const list = JSON.parse(readFileSync(f, "utf-8"));
  list.push(req.body);
  writeFileSync(f, JSON.stringify(list, null, 2));
  res.json({ success: true });
});

app.delete("/api/media/favorites/:type/:index", (req, res) => {
  const f = FAVORITES[req.params.type];
  if (!f) return res.status(400).json({ error: "Invalid type" });
  const list = JSON.parse(readFileSync(f, "utf-8"));
  list.splice(parseInt(req.params.index), 1);
  writeFileSync(f, JSON.stringify(list, null, 2));
  res.json({ success: true });
});

// ── Git API ──────────────────────────────────────────────────────────────────

app.get("/api/git/status", async (_req, res) => {
  try {
    const { stdout } = await execAsync("git status --short", { cwd: ROOT });
    res.json({ status: stdout.trim() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/git/publish", async (req, res) => {
  const msg = req.body.message || "content: update photos and media diet";
  try {
    await execAsync(
      "git add src/content/photos_page/ src/content/media_diet_page/",
      { cwd: ROOT },
    );
    const { stdout: diffStat } = await execAsync("git diff --cached --stat", {
      cwd: ROOT,
    });
    if (!diffStat.trim()) {
      return res.json({ success: true, message: "Nothing new to publish." });
    }
    await execAsync(`git commit -m "${msg.replace(/"/g, "'")}"`, { cwd: ROOT });
    await execAsync("git push", { cwd: ROOT });
    res.json({ success: true, message: "Published! GitHub will rebuild the site shortly." });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin UI ─────────────────────────────────────────────────────────────────

app.get("/", (_req, res) => res.send(HTML));

app.listen(3001, () => {
  console.log("\n  Admin panel → http://localhost:3001\n");
});

// ── HTML ─────────────────────────────────────────────────────────────────────

const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Content Admin</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #141414;
    --bg2: #1c1c1c;
    --card: rgba(53,53,53,0.15);
    --border: #353535;
    --red: #803329;
    --red-hover: #9a3e33;
    --text: #D4D4CA;
    --muted: #a8a8a8;
    --mono: 'IBM Plex Mono', monospace;
  }
  body { background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; font-size: 14px; min-height: 100vh; }
  h2 { font-size: 1.3rem; color: var(--red); font-weight: 600; }
  h3 { font-size: 1rem; color: var(--red); font-weight: 500; margin-bottom: .75rem; }
  label { color: var(--muted); font-size: 12px; font-family: var(--mono); display: block; margin-bottom: 4px; }
  input, textarea, select {
    width: 100%; background: var(--bg2); border: 1px solid var(--border);
    color: var(--text); padding: 8px 10px; border-radius: 6px; font-size: 13px;
    font-family: inherit; outline: none; transition: border-color .2s;
  }
  input:focus, textarea:focus, select:focus { border-color: var(--red); }
  textarea { resize: vertical; min-height: 70px; }
  button {
    cursor: pointer; border: none; border-radius: 6px; font-size: 13px;
    padding: 8px 14px; font-family: inherit; transition: background .2s, opacity .2s;
  }
  .btn-red { background: var(--red); color: #fff; }
  .btn-red:hover { background: var(--red-hover); }
  .btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border); }
  .btn-ghost:hover { border-color: var(--red); color: var(--text); }
  .btn-danger { background: transparent; color: #c0392b; border: 1px solid #c0392b; }
  .btn-danger:hover { background: #c0392b; color: #fff; }
  .btn-sm { padding: 5px 10px; font-size: 12px; }

  /* Layout */
  .topbar {
    position: sticky; top: 0; z-index: 100;
    background: var(--bg2); border-bottom: 1px solid var(--border);
    padding: 12px 24px; display: flex; align-items: center; gap: 16px;
  }
  .topbar-title { font-size: 15px; font-weight: 600; color: var(--text); flex: 1; }
  .topbar-title span { color: var(--red); }
  .publish-msg { color: var(--muted); font-size: 12px; font-family: var(--mono); }
  .tabs { display: flex; gap: 4px; padding: 16px 24px 0; border-bottom: 1px solid var(--border); }
  .tab { padding: 8px 18px; border-radius: 6px 6px 0 0; cursor: pointer; color: var(--muted); border: 1px solid transparent; border-bottom: none; font-size: 13px; background: transparent; }
  .tab.active { color: var(--text); border-color: var(--border); background: var(--bg2); }
  .tab-panel { display: none; padding: 24px; }
  .tab-panel.active { display: block; }

  /* Cards */
  .card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 18px; margin-bottom: 16px; }
  .section-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }

  /* Photo list */
  .photo-row {
    display: grid; grid-template-columns: 24px 64px 1fr auto; gap: 10px;
    align-items: center; padding: 8px; border-radius: 6px; border: 1px solid var(--border);
    background: var(--bg2); margin-bottom: 8px;
  }
  .drag-handle { cursor: grab; color: var(--muted); user-select: none; text-align: center; font-size: 16px; }
  .drag-handle:active { cursor: grabbing; }
  .photo-thumb { width: 64px; height: 48px; object-fit: cover; border-radius: 4px; background: #222; }
  .photo-thumb-video { width: 64px; height: 48px; border-radius: 4px; background: #222; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 20px; }
  .photo-caption-input { width: 100%; }

  /* Drop zone */
  .drop-zone {
    border: 2px dashed var(--border); border-radius: 10px; padding: 32px;
    text-align: center; color: var(--muted); cursor: pointer; transition: border-color .2s, background .2s;
    margin-bottom: 20px;
  }
  .drop-zone:hover, .drop-zone.drag-over { border-color: var(--red); background: rgba(128,51,41,0.06); color: var(--text); }
  .drop-zone input[type=file] { display: none; }
  .drop-icon { font-size: 32px; margin-bottom: 8px; }

  /* Media diet items */
  .media-item {
    border: 1px solid var(--border); border-radius: 8px; padding: 14px;
    margin-bottom: 10px; background: var(--bg2); position: relative;
  }
  .media-item-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .media-item-title { font-weight: 500; margin-bottom: 4px; }
  .media-item-status { color: var(--muted); font-size: 12px; font-family: var(--mono); }
  .media-item-thoughts { color: #a0a0a0; font-size: 12px; margin-top: 6px; line-height: 1.5; }
  .media-item-actions { display: flex; gap: 6px; flex-shrink: 0; }

  /* Favorites grid */
  .fav-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
  .fav-tab { padding: 6px 14px; border-radius: 20px; font-size: 12px; font-family: var(--mono); cursor: pointer; background: var(--bg2); border: 1px solid var(--border); color: var(--muted); }
  .fav-tab.active { background: var(--red); border-color: var(--red); color: #fff; }
  .fav-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(90px, 1fr)); gap: 12px; }
  .fav-item { position: relative; }
  .fav-poster { width: 100%; aspect-ratio: 3/4; object-fit: cover; border-radius: 6px; background: #222; border: 1px solid var(--border); display: block; }
  .fav-title { font-size: 11px; color: var(--muted); margin-top: 4px; line-height: 1.3; }
  .fav-delete { position: absolute; top: 4px; right: 4px; width: 22px; height: 22px; border-radius: 50%; background: rgba(0,0,0,0.7); border: 1px solid #c0392b; color: #c0392b; font-size: 14px; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: opacity .2s; padding: 0; line-height: 1; }
  .fav-item:hover .fav-delete { opacity: 1; }

  /* Modal */
  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 200; align-items: center; justify-content: center; }
  .modal-overlay.open { display: flex; }
  .modal { background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 24px; width: 480px; max-width: 95vw; max-height: 90vh; overflow-y: auto; }
  .modal h3 { margin-bottom: 16px; }
  .form-row { margin-bottom: 12px; }
  .form-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .modal-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 20px; }

  /* Toast */
  .toast { position: fixed; bottom: 24px; right: 24px; background: #222; border: 1px solid var(--border); border-radius: 8px; padding: 12px 16px; font-size: 13px; z-index: 300; opacity: 0; transform: translateY(8px); transition: opacity .3s, transform .3s; pointer-events: none; max-width: 320px; }
  .toast.show { opacity: 1; transform: translateY(0); }
  .toast.success { border-color: #27ae60; color: #27ae60; }
  .toast.error { border-color: #c0392b; color: #c0392b; }

  .spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; vertical-align: middle; margin-right: 6px; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>

<div class="topbar">
  <div class="topbar-title">Content <span>Admin</span></div>
  <input id="commit-msg" placeholder="Commit message (optional)" style="width:260px; margin:0;" />
  <button class="btn-red" id="publish-btn" onclick="publish()">Publish to GitHub</button>
  <span class="publish-msg" id="publish-status"></span>
</div>

<div class="tabs">
  <button class="tab active" onclick="switchTab('photos', this)">Photos</button>
  <button class="tab" onclick="switchTab('media', this)">Media Diet</button>
  <button class="tab" onclick="switchTab('favorites', this)">Favorites</button>
</div>

<!-- PHOTOS TAB -->
<div id="tab-photos" class="tab-panel active">
  <div class="drop-zone" id="drop-zone" onclick="document.getElementById('file-input').click()" ondragover="onDragOver(event)" ondragleave="onDragLeave(event)" ondrop="onDrop(event)">
    <input type="file" id="file-input" accept="image/*,video/*" multiple onchange="handleFiles(this.files)" />
    <div class="drop-icon">📷</div>
    <div>Drop photos/videos here or click to browse</div>
    <div style="font-size:12px; margin-top:6px; color: var(--muted);">JPG, PNG, GIF, MP4, MOV — filename becomes the URL</div>
  </div>

  <div class="section-title">
    <h3 style="margin:0;">Current Photos <span id="photo-count" style="color:var(--muted); font-size:12px; font-family:var(--mono);"></span></h3>
    <button class="btn-red btn-sm" onclick="savePhotoOrder()">Save Changes</button>
  </div>
  <div id="photo-list"></div>
</div>

<!-- MEDIA DIET TAB -->
<div id="tab-media" class="tab-panel">
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
    <div>
      <div class="section-title">
        <h3 style="margin:0;">Watching</h3>
        <button class="btn-ghost btn-sm" onclick="openAddMedia('watching')">+ Add</button>
      </div>
      <div id="watching-list"></div>
    </div>
    <div>
      <div class="section-title">
        <h3 style="margin:0;">Playing</h3>
        <button class="btn-ghost btn-sm" onclick="openAddMedia('playing')">+ Add</button>
      </div>
      <div id="playing-list"></div>
    </div>
  </div>
  <div style="margin-top:24px;">
    <div class="section-title">
      <h3 style="margin:0;">Reading</h3>
      <button class="btn-ghost btn-sm" onclick="openAddMedia('reading')">+ Add</button>
    </div>
    <div id="reading-list"></div>
  </div>
</div>

<!-- FAVORITES TAB -->
<div id="tab-favorites" class="tab-panel">
  <div class="fav-tabs">
    <button class="fav-tab active" onclick="switchFavTab('movies', this)">Movies</button>
    <button class="fav-tab" onclick="switchFavTab('tvshows', this)">TV Shows</button>
    <button class="fav-tab" onclick="switchFavTab('games', this)">Games</button>
    <button class="fav-tab" onclick="switchFavTab('books', this)">Books</button>
  </div>
  <div style="margin-bottom:16px;">
    <button class="btn-ghost btn-sm" onclick="openAddFav()">+ Add Favorite</button>
  </div>
  <div id="fav-grid" class="fav-grid"></div>
</div>

<!-- ADD MEDIA MODAL -->
<div class="modal-overlay" id="media-modal">
  <div class="modal">
    <h3 id="media-modal-title">Add Item</h3>
    <input type="hidden" id="media-modal-category" />
    <input type="hidden" id="media-modal-index" value="-1" />
    <div class="form-row"><label>Title</label><input id="m-title" placeholder="Movie / Show / Game title" /></div>
    <div class="form-row"><label>Status</label><input id="m-status" placeholder="e.g. Currently watching, First playthrough" /></div>
    <div class="form-row"><label>Thoughts (optional)</label><textarea id="m-thoughts" placeholder="What do you think about it?"></textarea></div>
    <div class="form-row"><label>Reason / genre (optional)</label><input id="m-reason" placeholder="e.g. Sci-Fi, Action" /></div>
    <div class="form-2col">
      <div class="form-row"><label>Poster URL (optional)</label><input id="m-poster" placeholder="/assets/..." /></div>
      <div class="form-row"><label>Accent color (optional)</label><input id="m-color" placeholder="#2D2D2D" /></div>
    </div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal('media-modal')">Cancel</button>
      <button class="btn-red" onclick="saveMedia()">Save</button>
    </div>
  </div>
</div>

<!-- ADD FAVORITE MODAL -->
<div class="modal-overlay" id="fav-modal">
  <div class="modal">
    <h3>Add Favorite</h3>
    <div class="form-row"><label>Title</label><input id="f-title" /></div>
    <div class="form-2col">
      <div class="form-row"><label>Year</label><input id="f-year" placeholder="2023" /></div>
      <div class="form-row"><label>IMDb ID (optional)</label><input id="f-imdb" placeholder="tt1234567" /></div>
    </div>
    <div class="form-row"><label>Poster URL</label><input id="f-poster" placeholder="/assets/posters/..." /></div>
    <div class="form-row"><label>Genre / Reason</label><input id="f-reason" placeholder="Action, Sci-Fi" /></div>
    <div class="form-2col">
      <div class="form-row"><label>IMDb Rating</label><input id="f-imdb-rating" placeholder="8.5" /></div>
      <div class="form-row"><label>Your Rating</label><input id="f-your-rating" placeholder="10" /></div>
    </div>
    <div class="form-row"><label>IMDb URL</label><input id="f-url" placeholder="https://imdb.com/title/..." /></div>
    <div class="modal-actions">
      <button class="btn-ghost" onclick="closeModal('fav-modal')">Cancel</button>
      <button class="btn-red" onclick="saveFav()">Save</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
// ─── State ───────────────────────────────────────────────────────────────────
let photos = [];
let currentMedia = { watching: [], playing: [], reading: [] };
let favorites = { movies: [], tvshows: [], games: [], books: [] };
let activeFavTab = 'movies';

// ─── Init ────────────────────────────────────────────────────────────────────
async function init() {
  await Promise.all([loadPhotos(), loadCurrentMedia(), loadFavorites('movies')]);
}
init();

// ─── Photos ──────────────────────────────────────────────────────────────────
async function loadPhotos() {
  photos = await api('/api/photos');
  renderPhotos();
}

function renderPhotos() {
  document.getElementById('photo-count').textContent = '(' + photos.length + ')';
  const list = document.getElementById('photo-list');
  list.innerHTML = photos.map((p, i) => \`
    <div class="photo-row" data-index="\${i}" data-file="\${esc(p.file)}">
      <div class="drag-handle" title="Drag to reorder">⠿</div>
      \${p.type === 'video'
        ? \`<div class="photo-thumb-video">▶</div>\`
        : \`<img class="photo-thumb" src="/photos-preview/\${encodeURIComponent(p.file)}" alt="" onerror="this.style.background='#333'" />\`
      }
      <input class="photo-caption-input" value="\${esc(p.caption)}" placeholder="Caption..." onchange="updateCaption(\${i}, this.value)" />
      <button class="btn-danger btn-sm" onclick="deletePhoto('\${esc(p.file)}')">✕</button>
    </div>
  \`).join('');
  Sortable.create(list, { handle: '.drag-handle', animation: 150, onEnd: onPhotoDrop });
}

function updateCaption(i, val) { photos[i].caption = val; }

function onPhotoDrop(evt) {
  const moved = photos.splice(evt.oldIndex, 1)[0];
  photos.splice(evt.newIndex, 0, moved);
}

async function savePhotoOrder() {
  await api('/api/photos/manifest', 'PUT', photos);
  toast('Photo order & captions saved', 'success');
}

async function deletePhoto(file) {
  if (!confirm('Delete ' + file + '?')) return;
  await api('/api/photos/' + encodeURIComponent(file), 'DELETE');
  await loadPhotos();
  toast('Deleted ' + file, 'success');
}

// Upload
function onDragOver(e) { e.preventDefault(); document.getElementById('drop-zone').classList.add('drag-over'); }
function onDragLeave() { document.getElementById('drop-zone').classList.remove('drag-over'); }
function onDrop(e) { e.preventDefault(); onDragLeave(); handleFiles(e.dataTransfer.files); }

async function handleFiles(files) {
  for (const file of files) {
    const caption = prompt('Caption for ' + file.name + ':', file.name) ?? file.name;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('caption', caption);
    const r = await fetch('/api/photos/upload', { method: 'POST', body: fd });
    if (!r.ok) { toast('Upload failed: ' + file.name, 'error'); return; }
  }
  await loadPhotos();
  toast('Upload complete', 'success');
}

// ─── Media Diet ──────────────────────────────────────────────────────────────
async function loadCurrentMedia() {
  currentMedia = await api('/api/media/current');
  renderCurrentMedia();
}

function renderCurrentMedia() {
  ['watching', 'playing', 'reading'].forEach(cat => {
    const el = document.getElementById(cat + '-list');
    const items = currentMedia[cat] || [];
    if (!items.length) {
      el.innerHTML = '<div style="color:var(--muted);font-size:12px;padding:8px 0;">Nothing here yet.</div>';
      return;
    }
    el.innerHTML = items.map((item, i) => \`
      <div class="media-item">
        <div class="media-item-header">
          <div>
            <div class="media-item-title">\${esc(item.title)}</div>
            <div class="media-item-status">\${esc(item.status || '')}</div>
            \${item.thoughts ? \`<div class="media-item-thoughts">\${esc(item.thoughts)}</div>\` : ''}
          </div>
          <div class="media-item-actions">
            <button class="btn-ghost btn-sm" onclick="openEditMedia('\${cat}', \${i})">Edit</button>
            <button class="btn-danger btn-sm" onclick="deleteMediaItem('\${cat}', \${i})">✕</button>
          </div>
        </div>
      </div>
    \`).join('');
  });
}

async function deleteMediaItem(cat, i) {
  if (!confirm('Remove this item?')) return;
  currentMedia[cat].splice(i, 1);
  await api('/api/media/current', 'PUT', currentMedia);
  renderCurrentMedia();
  toast('Removed', 'success');
}

function openAddMedia(cat) {
  document.getElementById('media-modal-title').textContent = 'Add to ' + cat;
  document.getElementById('media-modal-category').value = cat;
  document.getElementById('media-modal-index').value = '-1';
  ['title','status','thoughts','reason','poster','color'].forEach(f => document.getElementById('m-'+f).value = '');
  document.getElementById('media-modal').classList.add('open');
}

function openEditMedia(cat, i) {
  const item = currentMedia[cat][i];
  document.getElementById('media-modal-title').textContent = 'Edit item';
  document.getElementById('media-modal-category').value = cat;
  document.getElementById('media-modal-index').value = i;
  document.getElementById('m-title').value = item.title || '';
  document.getElementById('m-status').value = item.status || '';
  document.getElementById('m-thoughts').value = item.thoughts || '';
  document.getElementById('m-reason').value = item.reason || '';
  document.getElementById('m-poster').value = item.posterUrl || '';
  document.getElementById('m-color').value = item.color || '';
  document.getElementById('media-modal').classList.add('open');
}

async function saveMedia() {
  const cat = document.getElementById('media-modal-category').value;
  const idx = parseInt(document.getElementById('media-modal-index').value);
  const item = {
    title: document.getElementById('m-title').value,
    status: document.getElementById('m-status').value,
    thoughts: document.getElementById('m-thoughts').value,
    reason: document.getElementById('m-reason').value,
    posterUrl: document.getElementById('m-poster').value,
    color: document.getElementById('m-color').value,
  };
  if (!item.title) { toast('Title is required', 'error'); return; }
  if (idx >= 0) currentMedia[cat][idx] = item;
  else currentMedia[cat].push(item);
  await api('/api/media/current', 'PUT', currentMedia);
  closeModal('media-modal');
  renderCurrentMedia();
  toast('Saved', 'success');
}

// ─── Favorites ───────────────────────────────────────────────────────────────
async function loadFavorites(type) {
  favorites[type] = await api('/api/media/favorites/' + type);
  if (activeFavTab === type) renderFavorites();
}

async function switchFavTab(type, btn) {
  activeFavTab = type;
  document.querySelectorAll('.fav-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (!favorites[type].length) await loadFavorites(type);
  else renderFavorites();
}

function renderFavorites() {
  const items = favorites[activeFavTab];
  const grid = document.getElementById('fav-grid');
  if (!items.length) {
    grid.innerHTML = '<div style="color:var(--muted);font-size:13px;">No favorites yet.</div>';
    return;
  }
  grid.innerHTML = items.map((item, i) => \`
    <div class="fav-item">
      <img class="fav-poster" src="\${esc(item.posterUrl || '/assets/poster-placeholder.svg')}" alt="\${esc(item.title)}" onerror="this.src='/assets/poster-placeholder.svg'" />
      <button class="fav-delete" onclick="deleteFav(\${i})" title="Remove">✕</button>
      <div class="fav-title">\${esc(item.title)}</div>
    </div>
  \`).join('');
}

async function deleteFav(i) {
  if (!confirm('Remove from favorites?')) return;
  await api('/api/media/favorites/' + activeFavTab + '/' + i, 'DELETE');
  favorites[activeFavTab].splice(i, 1);
  renderFavorites();
  toast('Removed', 'success');
}

function openAddFav() { document.getElementById('fav-modal').classList.add('open'); }

async function saveFav() {
  const item = {
    title: document.getElementById('f-title').value,
    year: document.getElementById('f-year').value,
    imdbId: document.getElementById('f-imdb').value,
    posterUrl: document.getElementById('f-poster').value,
    reason: document.getElementById('f-reason').value,
    imdbRating: document.getElementById('f-imdb-rating').value,
    yourRating: document.getElementById('f-your-rating').value,
    url: document.getElementById('f-url').value,
    color: '',
  };
  if (!item.title) { toast('Title is required', 'error'); return; }
  await api('/api/media/favorites/' + activeFavTab, 'POST', item);
  favorites[activeFavTab].push(item);
  closeModal('fav-modal');
  renderFavorites();
  toast('Added to favorites', 'success');
}

// ─── Publish ─────────────────────────────────────────────────────────────────
async function publish() {
  const btn = document.getElementById('publish-btn');
  const status = document.getElementById('publish-status');
  const msg = document.getElementById('commit-msg').value;
  btn.innerHTML = '<span class="spinner"></span>Publishing...';
  btn.disabled = true;
  status.textContent = '';
  try {
    const r = await api('/api/git/publish', 'POST', { message: msg });
    status.textContent = r.message;
    toast(r.message, 'success');
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
    toast('Publish failed: ' + e.message, 'error');
  }
  btn.innerHTML = 'Publish to GitHub';
  btn.disabled = false;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function switchTab(id, btn) {
  document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('tab-' + id).classList.add('active');
}

function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function api(url, method = 'GET', body) {
  const r = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({ error: r.statusText }));
    throw new Error(err.error || r.statusText);
  }
  return r.json();
}

function toast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.className = 'toast', 3500);
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('open'); });
});
</script>
</body>
</html>`;
