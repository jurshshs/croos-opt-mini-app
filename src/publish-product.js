import { compressPhoto } from './product-photo';

const endpoint = '/api/publish-product';

export async function publishProduct({ title, category, price, sizes, description, images }, initData) {
  let submitted = false;
  try {
    const config = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (import.meta.env.DEV && (!config.ok || !config.headers.get('content-type')?.includes('application/json'))) return 'disabled';
    if (!config.ok) return 'failed';
    if (!(await config.json()).enabled) return 'disabled';
    if (!initData) return 'forbidden';
    const photo = images[0] ? await compressPhoto(images[0]) : undefined;
    submitted = true;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData, product: { title, category, price, sizes, description }, photo }),
      signal: AbortSignal.timeout(15000),
    });
    const { status } = await response.json();
    return ['published', 'disabled', 'forbidden', 'failed', 'unknown'].includes(status) ? status : 'unknown';
  } catch {
    return submitted ? 'unknown' : 'failed';
  }
}
