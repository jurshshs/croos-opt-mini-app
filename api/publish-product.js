import { createPublicKey, verify } from 'node:crypto';
import { CHANNEL_PHOTO_LIMIT, formatChannelPost } from '../src/channel-post.js';

const telegramKey = createPublicKey({
  key: Buffer.from('302a300506032b6570032100e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d', 'hex'),
  format: 'der', type: 'spki',
});

function verifiedUser(initData, token) {
  const botId = token?.split(':', 1)[0];
  if (!/^\d+$/.test(botId || '')) return null;
  if (typeof initData !== 'string' || initData.length > 8192) return null;
  const params = new URLSearchParams(initData);
  const signature = params.get('signature');
  if (!signature || !/^[\w-]{86}(?:==)?$/.test(signature) || new Set(params.keys()).size !== [...params.keys()].length) return null;
  params.delete('hash');
  params.delete('signature');
  params.sort();
  const data = [...params].map(([key, value]) => `${key}=${value}`).join('\n');
  const signedData = Buffer.from(`${botId}:WebAppData\n${data}`);
  if (!verify(null, signedData, telegramKey, Buffer.from(signature, 'base64url'))) return null;
  const age = Date.now() / 1000 - Number(params.get('auth_date'));
  if (!Number.isFinite(age) || age < -60 || age > 3600) return null;
  try {
    const user = JSON.parse(params.get('user'));
    return Number.isSafeInteger(user?.id) && user.id > 0 ? user : null;
  } catch {
    return null;
  }
}

const adminHandles = new Set(['ttfight27', 'miltorzz']);
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
