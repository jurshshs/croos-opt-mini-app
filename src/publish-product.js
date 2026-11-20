const endpoint = '/api/publish-product';

async function preparePhoto(source) {
  if (!source) return undefined;
  const photo = new Image();
  photo.src = source;
  await photo.decode();
  const longest = Math.max(photo.naturalWidth, photo.naturalHeight);
  const scale = Math.min(1, 1280 / longest);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(Math.ceil(longest * scale / 18), Math.round(photo.naturalWidth * scale));
  canvas.height = Math.max(Math.ceil(longest * scale / 18), Math.round(photo.naturalHeight * scale));
  const context = canvas.getContext('2d', { alpha: false });
  const width = Math.max(1, Math.round(photo.naturalWidth * scale));
  const height = Math.max(1, Math.round(photo.naturalHeight * scale));
  context.fillStyle = '#171717';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(photo, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  return canvas.toDataURL('image/jpeg', 0.8);
}

export async function publishProduct({ title, category, price, sizes, description, images }, initData) {
  let submitted = false;
  try {
    const config = await fetch(endpoint, { signal: AbortSignal.timeout(5000) });
    if (import.meta.env.DEV && (!config.ok || !config.headers.get('content-type')?.includes('application/json'))) return 'disabled';
    if (!config.ok) return 'failed';
    if (!(await config.json()).enabled) return 'disabled';
    if (!initData) return 'forbidden';
    const photo = await preparePhoto(images[0]);
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
