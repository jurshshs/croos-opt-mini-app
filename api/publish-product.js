import { createHmac, timingSafeEqual } from 'node:crypto';
import { formatChannelPost } from '../src/channel-post.js';

function verifiedUser(initData, token) {
  if (typeof initData !== 'string' || initData.length > 8192) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[a-f0-9]{64}$/.test(hash) || new Set(params.keys()).size !== [...params.keys()].length) return null;
  params.delete('hash');
  params.sort();
  const data = [...params].map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const expected = createHmac('sha256', secret).update(data).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) return null;
  const age = Date.now() / 1000 - Number(params.get('auth_date'));
  if (!Number.isFinite(age) || age < -60 || age > 3600) return null;
  try {
    const id = JSON.parse(params.get('user')).id;
    return Number.isSafeInteger(id) && id > 0 ? String(id) : null;
  } catch {
    return null;
  }
}

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
  if (!enabled) return res.status(200).json({ status: 'disabled' });
  const { initData, product, photo } = req.body || {};
  const userId = verifiedUser(initData, TELEGRAM_BOT_TOKEN);
  if (!userId) return res.status(403).json({ status: 'forbidden' });
  if (!product || typeof product.title !== 'string' || !product.title.trim()
    || (product.price !== null && (!Number.isFinite(product.price) || product.price < 0))
    || (photo && (typeof photo !== 'string' || photo.length > 1_400_000 || !/^data:image\/jpeg;base64,[a-zA-Z0-9+/]+={0,2}$/.test(photo)))) {
    return res.status(400).json({ status: 'failed' });
  }

  const botApi = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;
  try {
    const response = await fetch(`${botApi}/getChatMember`, {
      method: 'POST',
      signal: AbortSignal.timeout(3500),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, user_id: Number(userId) }),
    });
    const { result: member } = await response.json();
    if (!response.ok || !member) return res.status(502).json({ status: 'failed' });
    if (member.status !== 'creator' && !(member.status === 'administrator' && member.can_post_messages)) {
      return res.status(403).json({ status: 'forbidden' });
    }
  } catch {
    return res.status(502).json({ status: 'failed' });
  }

  const text = formatChannelPost(product);
  const markup = { inline_keyboard: [[{ text: 'Открыть магазин', url: 'https://t.me/croosopt_bot?startapp' }]] };
  const method = photo ? 'sendPhoto' : 'sendMessage';
  let options;
  if (photo) {
    const body = new FormData();
    body.set('chat_id', TELEGRAM_CHANNEL_ID);
    body.set('caption', text);
    body.set('reply_markup', JSON.stringify(markup));
    body.set('photo', new Blob([Buffer.from(photo.split(',')[1], 'base64')], { type: 'image/jpeg' }), 'product.jpg');
    options = { body };
  } else {
    options = {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, text, reply_markup: markup }),
    };
  }
  try {
    const response = await fetch(`${botApi}/${method}`, {
      method: 'POST', signal: AbortSignal.timeout(8000), ...options,
    });
    const result = await response.json();
    if (result.ok === false && response.status < 500) return res.status(502).json({ status: 'failed' });
    if (response.ok && Number.isSafeInteger(result.result?.message_id)) {
      return res.status(200).json({ status: 'published', messageId: result.result.message_id });
    }
  } catch {
    // A timeout can happen after Telegram accepted the post. Do not resend automatically.
  }
  return res.status(502).json({ status: 'unknown' });
}
