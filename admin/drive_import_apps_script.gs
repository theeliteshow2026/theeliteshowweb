/**
 * Drive import for the admin panel.
 *
 * Lets the panel see the posters in the "Mentor Sessions" Google Drive folder, so new
 * ones show up as drafts ready to read. It only lists and reads image files inside that
 * folder (and its sub-folders), and only for requests that carry the secret token below.
 *
 * Set up (about 3 minutes):
 *   1. Go to script.google.com while signed in to the Google account that can open the
 *      "Mentor Sessions" folder, and start a New project.
 *   2. Paste this whole file in, replacing what is there.
 *   3. Change TOKEN below to a long random phrase (letters and numbers, 20+ characters).
 *   4. Deploy > New deployment > type "Web app". Execute as: Me. Who has access: Anyone.
 *      Approve the Drive permission it asks for.
 *   5. Copy the Web app URL. In the admin panel, open Settings and paste the URL and the
 *      same token, then press "Check connection".
 */
const TOKEN = 'CHANGE-ME-to-a-long-random-phrase';
const FOLDER_ID = '1hquwjiuIl_QhAAsQc7GuyZBOOkXeAoY5'; // "Mentor Sessions"
const MAX_FILES = 40;

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (TOKEN.indexOf('CHANGE-ME') === 0 || p.token !== TOKEN) return json_({ error: 'unauthorized' });
  try {
    if (p.action === 'list') return json_({ files: listPosters_() });
    if (p.action === 'file' && p.id) return json_(readPoster_(p.id));
    return json_({ error: 'unknown action' });
  } catch (err) {
    return json_({ error: String(err && err.message || err) });
  }
}

function listPosters_() {
  const found = [];
  const walk = (folder, depth) => {
    const files = folder.getFiles();
    while (files.hasNext()) {
      const f = files.next();
      if (f.getMimeType().indexOf('image/') !== 0) continue;
      found.push(f);
    }
    if (depth < 2) {
      const subs = folder.getFolders();
      while (subs.hasNext()) walk(subs.next(), depth + 1);
    }
  };
  walk(DriveApp.getFolderById(FOLDER_ID), 0);
  found.sort((a, b) => b.getDateCreated() - a.getDateCreated());
  return found.slice(0, MAX_FILES).map(f => {
    let thumb = null;
    try {
      const t = f.getThumbnail();
      if (t) thumb = 'data:' + t.getContentType() + ';base64,' + Utilities.base64Encode(t.getBytes());
    } catch (err) { /* no thumbnail yet */ }
    return { id: f.getId(), name: f.getName(), created: f.getDateCreated().toISOString(), size: f.getSize(), thumb: thumb };
  });
}

function readPoster_(id) {
  const file = DriveApp.getFileById(id);
  if (!insideFolder_(file)) return { error: 'not in the Mentor Sessions folder' };
  if (file.getMimeType().indexOf('image/') !== 0) return { error: 'not an image' };
  if (file.getSize() > 15 * 1024 * 1024) return { error: 'image is larger than 15 MB' };
  const blob = file.getBlob();
  return { id: id, name: file.getName(), mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}

// True when the file sits in the folder or one of its sub-folders (two levels down)
function insideFolder_(file) {
  const queue = [];
  const parents = file.getParents();
  while (parents.hasNext()) queue.push({ folder: parents.next(), depth: 0 });
  while (queue.length) {
    const item = queue.shift();
    if (item.folder.getId() === FOLDER_ID) return true;
    if (item.depth >= 2) continue;
    const up = item.folder.getParents();
    while (up.hasNext()) queue.push({ folder: up.next(), depth: item.depth + 1 });
  }
  return false;
}

function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
