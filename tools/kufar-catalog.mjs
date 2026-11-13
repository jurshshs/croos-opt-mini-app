import crypto from 'node:crypto';

export const CATEGORY_RULES = [
  ['t-shirts', 'Футболки и майки', /(?:футбол|майк|t[ -]?shirt|tee\b|лонгслив)/iu],
  ['hoodies', 'Худи и толстовки', /(?:худи|толстовк|hoodie)/iu],
  ['jeans-pants', 'Джинсы и брюки', /(?:джинс|denim|брюк|штан|карго|джоггер|trouser|pants|шорт|shorts)/iu],
  ['jackets', 'Куртки и пуховики', /(?:куртк|ветровк|бомбер|пуховик|жилет|парка|анорак|jacket|coat|vest)/iu],
  ['sweatshirts', 'Свитшоты и кофты', /(?:свитшот|кофт|свитер|джемпер|кардиган|водолазк|sweatshirt|sweater|knit)/iu],
  ['shoes', 'Обувь', /(?:кроссов|кед|ботин|туфл|сапог|sneaker|shoes|boots)/iu],
  ['accessories', 'Сумки и аксессуары', /(?:ремень|сумк|рюкзак|кошел|очки|шарф|перчат|балаклав|snood|кепк|шапк|панам|бейсболк|accessor|bag\b|cap\b|beanie)/iu]
];

export function normalizeWhitespace(value) {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
}

export function parsePriceText(value) {
  const raw = normalizeWhitespace(value);
  if (!raw) return { amount: null, currency: null, raw: null };
  const match = raw.match(/(\d[\d\s.,]*)(?:\s*)(BYN|Br|бел\.?\s*руб\.?|р\.?)/iu);
  if (!match) return { amount: null, currency: null, raw };
  const normalized = match[1].replace(/\s/gu, '').replace(',', '.');
  const amount = Number.parseFloat(normalized);
  return { amount: Number.isFinite(amount) ? amount : null, currency: 'BYN', raw };
}

export function inferCategory(...parts) {
  for (const part of parts.filter(Boolean)) {
    for (const [id, label, pattern] of CATEGORY_RULES) {
      if (pattern.test(part)) return { id, label, source: 'inferred-from-listing-text' };
    }
  }
  return { id: 'other', label: 'Другое', source: 'fallback' };
}

export function slugify(value, fallback = 'item') {
  const slug = normalizeWhitespace(value)
    .toLocaleLowerCase('ru')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 70);
  return slug || fallback;
}

export function stableId(url) {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 12);
}

export function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map(normalizeWhitespace).filter(Boolean))];
}

export function computeHotPicks(products, limit = 8) {
  const ranked = [...products]
    .map((product) => ({
      product,
      score: Math.min(product.images?.length || 0, 8) * 3
        + (product.description ? Math.min(product.description.length, 600) / 100 : 0)
        + (product.size?.length ? 2 : 0)
        + (product.category?.id !== 'other' ? 1 : 0)
    }))
    .filter(({ product }) => (product.images?.length || 0) > 0)
    .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title, 'ru'));
  const selected = [];
  const categoryCounts = new Map();
  for (const candidate of ranked) {
    if (selected.length >= limit) break;
    const category = candidate.product.category?.id || 'other';
    if ((categoryCounts.get(category) || 0) > 0) continue;
    selected.push(candidate);
    categoryCounts.set(category, 1);
  }
  for (const candidate of ranked) {
    if (selected.length >= limit) break;
    if (selected.includes(candidate)) continue;
    const category = candidate.product.category?.id || 'other';
    if ((categoryCounts.get(category) || 0) >= 2) continue;
    selected.push(candidate);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  }
  return selected.map(({ product, score }) => ({
      productId: product.id,
      score: Number(score.toFixed(2)),
      reason: `Подборка по полноте карточки: ${product.images.length} фото, категория «${product.category?.label || 'Другое'}»`
    }));
}
