export type CategoryId =
  | 't-shirts'
  | 'hoodies'
  | 'jeans-pants'
  | 'jackets'
  | 'sweatshirts'
  | 'shoes'
  | 'accessories'
  | 'other';

export interface ProductPrice {
  amount: number | null;
  currency: 'BYN' | null;
  raw: string | null;
}

export interface ProductImage {
  sourceUrl: string;
  localPath: string;
  contentType: string;
  bytes: number;
}

export interface ProductCategory {
  id: CategoryId;
  label: string;
  source: 'inferred-from-listing-text' | 'fallback';
}

export interface CatalogProduct {
  id: `product-${string}`;
  sourceId: string;
  slug: string;
  sourceUrl: string;
  title: string;
  price: ProductPrice;
  size: string[];
  colors: string[];
  description: string | null;
  category: ProductCategory;
  sourceCategory: string | null;
  images: ProductImage[];
  sourceImageUrls: string[];
  collectedAt: string;
  collectionMode: 'automatic' | 'manual';
}

export interface CatalogData {
  schemaVersion: 1;
  generatedAt: string;
  sellerUrl: string;
  categories: Array<{ id: CategoryId; label: string; count: number }>;
  hotPicks: Array<{ productId: CatalogProduct['id']; score: number; reason: string }>;
  products: CatalogProduct[];
}
