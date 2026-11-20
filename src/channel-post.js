const amount = new Intl.NumberFormat('ru-BY', { maximumFractionDigits: 2 });
const clip = (value, limit) => Array.from(String(value ?? '').trim()).slice(0, limit).join('');

export function formatChannelPost(product) {
  const sizes = Array.isArray(product.sizes) ? product.sizes.join(', ') : product.sizes;
  return [
    'НОВИНКА В CROOS_OPT',
    clip(product.title, 120) || 'Название товара',
    [
      product.category && clip(product.category, 70),
      product.price == null || product.price === '' ? 'Цена уточняется' : `${amount.format(product.price)} BYN`,
      clip(sizes, 120) && 'Размеры: ' + clip(sizes, 120),
    ].filter(Boolean).join('\n'),
    clip(product.description, 500),
  ].filter(Boolean).join('\n\n');
}
