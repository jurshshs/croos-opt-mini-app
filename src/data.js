import source from './catalog-source.json';
import { LEGACY_STORAGE_PREFIXES, STORAGE_PREFIX } from './config';

export const categories = source.categories.filter(x => x.count > 0);
export const seedProducts = source.products.map(p => ({
  id: p.id, sourceId: p.sourceId, sourceUrl: p.sourceUrl, slug: p.slug,
  title: p.title, description: p.description || '', category: p.category.id,
  price: p.price.amount, sizes: p.size || [], stock: null,
  images: p.images.map(i => '/' + i.localPath.replaceAll('\\', '/')),
}));
export const categoryName = id => categories.find(x => x.id === id)?.label || 'Другое';
export const money = amount => amount == null ? 'Цена уточняется' : new Intl.NumberFormat('ru-BY', { maximumFractionDigits: 2 }).format(amount) + ' BYN';

const keys = { products: `${STORAGE_PREFIX}:products`, orders: `${STORAGE_PREFIX}:orders`, cart: `${STORAGE_PREFIX}:cart`, favorites: `${STORAGE_PREFIX}:favorites`, role: `${STORAGE_PREFIX}:role` };
for (const prefix of LEGACY_STORAGE_PREFIXES) {
  for (const key of ['products', 'orders', 'cart', 'favorites', 'role']) localStorage.removeItem(`${prefix}:${key}`);
}
export function read(key, fallback) {
  try { const value = localStorage.getItem(keys[key]); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}
export function write(key, value) { localStorage.setItem(keys[key], JSON.stringify(value)); }
export const demoOrders = [];
