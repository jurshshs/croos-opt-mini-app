import { STORAGE_PREFIX } from './config';

function openCatalog() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(STORAGE_PREFIX, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('catalog');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function accessCatalog(fallback, update) {
  const db = await openCatalog();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('catalog', update ? 'readwrite' : 'readonly');
      const store = transaction.objectStore('catalog');
      const request = store.get('products');
      let products;
      request.onsuccess = () => {
        products = request.result ?? fallback;
        if (update) {
          products = update(products);
          store.put(products, 'products');
        }
      };
      transaction.oncomplete = () => resolve(products);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export const loadProducts = fallback => accessCatalog(fallback);
export const updateProducts = (fallback, update) => accessCatalog(fallback, update);
