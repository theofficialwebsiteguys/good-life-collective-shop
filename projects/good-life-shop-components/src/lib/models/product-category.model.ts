export type ProductCategory =
  | 'FLOWER'
  | 'PRE-ROLL'
  | 'VAPORIZERS'
  | 'CONCENTRATES'
  | 'VAPES'
  | 'BEVERAGE'
  | 'TINCTURES'
  | 'EDIBLES'
  | 'TOPICALS'
  | 'ACCESSORIES';

  export interface CategoryWithImage {
    category: ProductCategory;
    imageUrl: string;
  }