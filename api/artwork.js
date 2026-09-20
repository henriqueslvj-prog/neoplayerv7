// GET /api/artwork?title=...&type=movie|tv
//
// Looks up cover art for a movie/series title that came from the playlist
// without one. Uses Apple's iTunes Search API, which is free and needs no
// API key — it's a metadata catalog, not a store integration.
//
// Response is small and cached hard (7 days, browser + Vercel edge), since
// the same title is looked up over and over across different playlists and
// different episodes of the same series.

function upsize(url) {
  if (!url) return '';
  // iTunes URLs look like .../100x100bb.jpg — bump to a real poster size.
  return url.replace(/\/\d+x\d+bb(\.(jpg|png))/i, '/600x600bb$1');
}

async function lookup(term, entity, country) {
  const q = new URLSearchParams({ term, media: entity === 'tvShow' ? 'tvShow' : 'movie', entity, limit: '1', country });
  const r = await fetch(`https://itunes.apple.com/search?${q.toString()}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 NeoPlayer artwork lookup' },
  });
  if (!r.ok) return null;
  const data = await r.json().catch(() => null);
  const hit = data?.results?.[0];
  if (!hit) return null;
  const poster = upsize(hit.artworkUrl100 || hit.artworkUrl60 || '');
  if (!poster) return null;
  return { poster, name: hit.trackName || hit.collectionName || term, year: (hit.releaseDate || '').slice(0, 4) || null };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const title = (req.query?.title || '').toString().trim().slice(0, 200);
  const type = req.query?.type === 'tv' ? 'tv' : 'movie';
  if (!title) return res.status(400).json({ error: 'Informe o título.' });

  const entity = type === 'tv' ? 'tvShow' : 'movie';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    let hit = await lookup(title, entity, 'BR').catch(() => null);
    if (!hit) hit = await lookup(title, entity, 'US').catch(() => null);
    // A series episode sometimes only matches as a movie in the catalog and
    // vice-versa; try the other entity once before giving up.
    if (!hit) hit = await lookup(title, entity === 'tvShow' ? 'movie' : 'tvShow', 'US').catch(() => null);

    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
    if (!hit) return res.status(200).json({ poster: null });
    return res.status(200).json({ poster: hit.poster, name: hit.name, year: hit.year });
  } catch {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({ poster: null });
  } finally {
    clearTimeout(timer);
  }
}
