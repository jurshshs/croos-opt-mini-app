import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stableId, uniqueStrings } from './kufar-catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const input = process.argv[2];
if (!input) { console.error('Использование: npm run import:kufar -- <путь-к-catalog-data/products.json>'); process.exit(1); }
const raw = JSON.parse(await fs.readFile(path.resolve(input), 'utf8'));
const products = Array.isArray(raw) ? raw : raw.products;
if (!Array.isArray(products)) throw new Error('Не найден массив products');
const output = new Map();
for (const p of products) {
  if (!p.sourceUrl) continue;
  const sourceId = p.sourceId || stableId(p.sourceUrl);
  const images = [];
  for (const image of p.images || []) {
    if (!image.localPath) continue;
    const sourceFile = path.resolve(path.dirname(path.resolve(input)), image.localPath);
    const destination = path.join(root, 'public', 'images', 'kufar-' + sourceId, path.basename(image.localPath));
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(sourceFile, destination);
    images.push({ localPath: 'images/kufar-' + sourceId + '/' + path.basename(destination), sourceUrl: image.sourceUrl || '' });
  }
  output.set(p.sourceUrl, { ...p, id: 'kufar-' + sourceId, sourceId, sourceUrl: p.sourceUrl, slug: p.slug || sourceId, title: p.title || 'Без названия', description: p.description || '', category: p.category || { id:'other',label:'Другое' }, price: p.price || { amount:null,currency:null,raw:null }, size: uniqueStrings(p.size || []), stock: null, images: [...new Map(images.map(i => [i.localPath,i])).values()] });
}
const list = [...output.values()];
const categoryMap = new Map();
for (const p of list) { const key = p.category.id; const current = categoryMap.get(key) || { id:key,label:p.category.label || key,count:0 }; current.count++; categoryMap.set(key,current); }
await fs.writeFile(path.join(root, 'src', 'catalog-source.json'), JSON.stringify({ schemaVersion:1, generatedAt:new Date().toISOString(), sellerUrl:raw.sellerUrl || null, categories:[...categoryMap.values()], products:list }, null, 2));
console.log(`Импортировано ${output.size} уникальных объявлений и их фотографии в src/catalog-source.json и public/images.`);
