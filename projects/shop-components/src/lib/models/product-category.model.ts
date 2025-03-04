export type ProductCategory =
  | 'FLOWER'
  | 'PREROLL'
  | 'VAPORIZERS'
  | 'CONCENTRATES'
  | 'VAPE'
  | 'BEVERAGE'
  | 'TINCTURES'
  | 'EDIBLE'
  | 'ACCESSORIES';

  export interface CategoryWithImage {
    category: ProductCategory;
    imageUrl: string;
  }