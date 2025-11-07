export type ProductCategory =
  | 'OFFERS'
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