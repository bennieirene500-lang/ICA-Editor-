import fsp from 'node:fs/promises';
import path from 'node:path';

const VIDEO_SEARCH_URL = 'https://api.pexels.com/videos/search';
const PHOTO_SEARCH_URL = 'https://api.pexels.com/v1/search';

export async function fetchStockMedia({ apiKey, moments, tempDir, jobId, photoOnly = false }) {
  const results = [];

  for (const [index, moment] of moments.entries()) {
    if (!photoOnly) {
      const video = await searchVideo({ apiKey, query: moment.stockQuery });

      if (video) {
        const mediaPath = path.join(tempDir, `${jobId}-stock-${index}.mp4`);
        await downloadTo(video.link, mediaPath, apiKey);
        results.push({ ...moment, mediaPath, mediaType: 'video' });
        continue;
      }
    }

    const photo = await searchPhoto({ apiKey, query: moment.stockQuery });

    if (photo) {
      const mediaPath = path.join(tempDir, `${jobId}-stock-${index}.jpg`);
      await downloadTo(photo.src.large2x || photo.src.large || photo.src.original, mediaPath, apiKey);
      results.push({ ...moment, mediaPath, mediaType: 'photo' });
    }
  }

  return results;
}

async function searchVideo({ apiKey, query }) {
  const url = `${VIDEO_SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=3&orientation=portrait`;
  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) return null;

  const data = await response.json();
  const candidate = (data.videos || [])[0];
  if (!candidate) return null;

  const files = (candidate.video_files || [])
    .filter(file => file.file_type === 'video/mp4' && file.width && file.height)
    .sort((a, b) => Math.abs(a.height - 1920) - Math.abs(b.height - 1920));

  const best = files[0];
  if (!best) return null;

  return { link: best.link, durationSeconds: candidate.duration };
}

async function searchPhoto({ apiKey, query }) {
  const url = `${PHOTO_SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=1&orientation=portrait`;
  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) return null;

  const data = await response.json();
  const candidate = (data.photos || [])[0];
  return candidate || null;
}

async function downloadTo(url, destinationPath, apiKey) {
  const response = await fetch(url, { headers: { Authorization: apiKey } });
  if (!response.ok) throw new Error(`ICA could not download stock media (status ${response.status}).`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await fsp.writeFile(destinationPath, buffer);
}
