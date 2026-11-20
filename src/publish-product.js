import { compressPhoto } from './product-photo';
import { CHANNEL_PHOTO_LIMIT } from './channel-post';

const endpoint = '/api/publish-product';

export async function checkAdminAccess(initData) {
  if (!initData) return false;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check-access', initData }),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok && (await response.json()).allowed === true;
  } catch {
    return false;
  }
}

export async function publishProduct({ title, price, sizes, images }, initData) {
  let submitted = false;
  try {
    const config = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (import.meta.env.DEV && (!config.ok || !config.headers.get('content-type')?.includes('application/json'))) return 'disabled';
    if (!config.ok) return 'failed';
    if (!(await config.json()).enabled) return 'disabled';
    if (!initData) return 'forbidden';
    const photos = [];
    for (const image of images.slice(0, CHANNEL_PHOTO_LIMIT)) {
      // New uploads have already been compressed and padded for Telegram.
      photos.push(image.startsWith('data:image/jpeg;base64,') && image.length <= 400_000
        ? image
        : await compressPhoto(image));
    }
    submitted = true;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, product: { title, price, sizes }, photos }),
      signal: AbortSignal.timeout(20000),
    });
    const { status } = await response.json();
    return ['published', 'disabled', 'forbidden', 'failed', 'unknown'].includes(status) ? status : 'unknown';
  } catch {
    return submitted ? 'unknown' : 'failed';
  }
}
