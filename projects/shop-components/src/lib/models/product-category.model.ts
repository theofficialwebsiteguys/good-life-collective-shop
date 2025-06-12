export type ProductCategory =
  | 'FLOWER'
  | 'PREROLL'
  | 'VAPORIZERS'
  | 'CONCENTRATES'
  | 'VAPE'
  | 'BEVERAGE'
  | 'TINCTURES'
  | 'EDIBLE'
  | 'TOPICAL'
  | 'ACCESSORIES';

  export interface CategoryWithImage {
    category: ProductCategory;
    imageUrl: string;
  }