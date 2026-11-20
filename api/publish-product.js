import { CHANNEL_PHOTO_LIMIT, formatChannelPost } from '../src/channel-post.js';
import { verifiedUser } from '../server/telegram-auth.js';

const adminHandles = new Set(['ttfight27', 'miltorzz', 'vlagm']);
const isAdmin = user => typeof user?.username === 'string' && adminHandles.has(user.username.toLowerCase());
const isJpeg = photo => typeof photo === 'string' && photo.length <= 400_000
  && /^data:image\/jpeg;base64,[a-zA-Z0-9+/]+={0,2}$/.test(photo);
const jpegBlob = photo => new Blob([Buffer.from(photo.split(',')[1], 'base64')], { type: 'image/jpeg' });

export default async function handler(req, res) {
  const { TELEGRAM_PUBLISH_ENABLED, TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_ID } = process.env;
  const enabled = TELEGRAM_PUBLISH_ENABLED === 'true' && Boolean(TELEGRAM_BOT_TOKEN)
    && /^-100\d+$/.test(TELEGRAM_CHANNEL_ID || '');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ enabled });
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ status: 'failed' });
  }
  const { initData, product, photo, photos = photo ? [photo] : [], action } = req.body || {};
  if (!isAdmin(verifiedUser(initData, TELEGRAM_BOT_TOKEN))) {
    return res.status(403).json({ status: 'forbidden' });
  }
  if (action === 'check-access') return res.status(200).json({ allowed: true });
  if (!enabled) return res.status(200).json({ status: 'disabled' });
  if (!product || typeof product.title !== 'string' || !product.title.trim()
    || (product.price !== null && (!Number.isFinite(product.price) || product.price < 0))
    || !Array.isArray(photos) || photos.length > CHANNEL_PHOTO_LIMIT || !photos.every(isJpeg)) {
    return res.status(400).json({ status: 'failed' });
  }

  const botApi = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  const text = formatChannelPost(product);
  const album = photos.length > 1;
  const method = album ? 'sendMediaGroup' : photos.length ? 'sendPhoto' : 'sendMessage';
  let options;
  if (photos.length) {
    const body = new FormData();
    body.set('chat_id', TELEGRAM_CHANNEL_ID);
    if (album) {
      const media = photos.map((image, index) => {
        const name = `photo${index}`;
        body.set(name, jpegBlob(image), `${name}.jpg`);
        return { type: 'photo', media: `attach://${name}`, ...(index === 0 && { caption: text }) };
      });
      body.set('media', JSON.stringify(media));
    } else {
      body.set('caption', text);
      body.set('photo', jpegBlob(photos[0]), 'product.jpg');
    }
    options = { body };
  } else {
    options = {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, text }),
    };
  }
  try {
    const response = await fetch(`${botApi}/${method}`, {
      method: 'POST', signal: AbortSignal.timeout(12000), ...options,
    });
    const result = await response.json();
    if (result.ok === false && response.status < 500) return res.status(502).json({ status: 'failed' });
    const message = album ? result.result?.[0] : result.result;
    if (response.ok && Number.isSafeInteger(message?.message_id)) {
      return res.status(200).json({ status: 'published', messageId: message.message_id });
    }
  } catch {
    // A timeout can happen after Telegram accepted the post. Do not resend automatically.
  }
  return res.status(502).json({ status: 'unknown' });
}
