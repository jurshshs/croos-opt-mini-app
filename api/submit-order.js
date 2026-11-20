import { verifiedUser } from '../server/telegram-auth.js';

const isText = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const isMeasure = value => value === undefined || (Number.isFinite(value) && value >= 1 && value <= 500);
const clean = value => value.trim().replace(/[\r\n\t]+/g, ' ');
const money = value => new Intl.NumberFormat('ru-BY', { maximumFractionDigits: 2 }).format(value) + ' BYN';

function orderMessage(order, user) {
  const { id, customer, items } = order || {};
  if (typeof id !== 'string' || !/^CR-[A-Z0-9-]{6,36}$/.test(id) || !customer
    || !isText(customer.fullName, 120) || !isText(customer.phone, 32)
    || !/^\+?\d[\d\s()-]{7,30}$/.test(customer.phone) || customer.phone.replace(/\D/g, '').length < 9
    || !isText(customer.city, 100) || !isText(customer.branch, 240)
    || !isMeasure(customer.height) || !isMeasure(customer.weight)
    || !Array.isArray(items) || !items.length || items.length > 30
    || items.some(item => !item || !isText(item.title, 150) || !isText(item.size, 50)
      || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99
      || !Number.isFinite(item.price) || item.price < 0 || item.price > 100_000)) return null;

  const telegram = /^[a-zA-Z0-9_]{1,32}$/.test(user.username ?? '')
    ? `@${user.username}`
    : `ник не указан (ID ${user.id})`;
  const itemsText = items.map(({ title, size, quantity, price }, i) =>
    `${i + 1}. ${clean(title)} · ${clean(size)} × ${quantity} — ${money(price * quantity)}`);
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const body = [
    `🛍 Новый заказ ${id}`, '',
    `Telegram: ${telegram}`,
    `Получатель: ${clean(customer.fullName)}`,
    `Телефон: ${clean(customer.phone)}`,
    `Европочта: ${clean(customer.city)}, ${clean(customer.branch)}`,
    ...(customer.height ? [`Рост: ${customer.height} см`] : []),
    ...(customer.weight ? [`Вес: ${customer.weight} кг`] : []),
    '', ...itemsText, '',
    `Сумма товаров: ${money(total)}`,
    'Оплата: наложенный платёж через Европочту',
  ].join('\n');
  return body.length <= 4096 ? body : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ status: 'failed' });
  }

  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_ORDERS_CHAT_ID: chatId } = process.env;
  if (!chatId) return res.status(200).json({ status: 'disabled' });
  if (!token || !/^-\d+$/.test(chatId)) return res.status(503).json({ status: 'failed' });
  const { order, initData } = req.body || {};
  const user = verifiedUser(initData, token);
  if (!user) return res.status(403).json({ status: 'forbidden' });
  const message = orderMessage(order, user);
  if (!message) return res.status(400).json({ status: 'invalid' });

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, protect_content: true, link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(8500),
    });
    const result = await response.json();
    if (response.ok && result.ok === true && Number.isSafeInteger(result.result?.message_id)) {
      return res.status(200).json({ status: 'sent' });
    }
    if (result.ok === false && response.status < 500) return res.status(502).json({ status: 'failed' });
  } catch {
    // A timeout may occur after Telegram has accepted the message.
  }
  return res.status(502).json({ status: 'unknown' });
}
