const amount = new Intl.NumberFormat('ru-BY', { maximumFractionDigits: 2 });
const clip = (value, limit) => Array.from(String(value ?? '').trim()).slice(0, limit).join('');

export const CHANNEL_PHOTO_LIMIT = 10;

export function formatChannelPost(product) {
  const sizes = Array.isArray(product.sizes) ? product.sizes.join('/') : String(product.sizes ?? '').replace(/\s*,\s*/g, '/');
  return [
    `‼️ ${clip(product.title, 120) || 'Название товара'} ‼️`,
    clip(sizes, 120) ? `Размеры: ${clip(sizes, 120)}` : 'Размеры уточняйте',
    'Отправка по Беларуси Европочтой',
    '↙️ Заказать: @vlagm @miltorzz ↙️',
    '',
    product.price == null || product.price === ''
      ? '🔥 Цена уточняется 🔥'
      : `🔥 Price: ${amount.format(product.price)} р 🇧🇾 🔥`,
    '',
    'Успей заказать ↙️↙️↙️',
  ].join('\n');
}
