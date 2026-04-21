import { ProductCategory } from "./product-category.model";

export type Strain = '50/50' | 'INDICA' | 'SATIVA' | 'INDICA-DOM' | 'SATIVA-DOM';

/** Canonical product filter shape from the API */
export interface ProductFilter {
  includedProductIds?: string[];
  excludedProductIds?: string[];
  categories?: string[];
  brands?: string[];
  weight?: string;
}

export type Product = {
  [key: string]: any;
  id: string;
  posProductId: string;
  id_batch: string;
  category: ProductCategory; // .cannabisComplianceType OR .cannabisType
  title: string; // .name
  desc: string; // .description
  brand: string;  //.brand.name
  strainType: Strain; //.cannabisStrain
  thc: string; // .description first line - may or may not be
  cbd: string; // .description first line - may or may not be
  weight: string; // .weight
  price: string; // .price
  image: string;  // either .image OR .images[0]
  quantity: number;
  discounts?: AppliedDiscount[];
  unit?: string;          // "grams"
  priceAfterTax?: number; // optional
  weightTierInformation?: WeightTier[] | null;
  basePrice?: number;     // original Flowhub price
  isTaxIncluded?: boolean;
};

export interface WeightTier {
  gramAmount: number;
  name: string;
  preTaxPriceInPennies: number;
  postTaxPriceInPennies: number;
  pricePerUnitInMinorUnits?: number;
}

export type AppliedDiscount =
  | {
      kind: 'percent';
      value: number;
      name?: string;
      description?: string;
      discountedPrice: number;
      minQty?: number;          // display helper (same as rule.qty)
      applyMode?: 'per_item' | 'threshold';
      is_exclusive?: boolean;
      requires_min_subtotal?: boolean;
      min_subtotal_amount?: number | null;
      rule?: {
        qty: number;
        filter: ProductFilter;
        applyMode: 'per_item' | 'threshold';
      };
      banner_image_url?: string;
    }
  | {
      kind: 'flat';
      value: number;               // $ off per item (per_item) or per group (threshold)
      name?: string;
      description?: string;
      discountedPrice: number;
      minQty?: number;             // display helper
      applyMode?: 'per_item' | 'threshold';
      is_exclusive?: boolean;
      requires_min_subtotal?: boolean;
      min_subtotal_amount?: number | null;
      totalOff?: number;           // display: total $ off across minQty
      perItemOff?: number;         // display: derived per-item share
      rule?: {
        qty: number;
        filter: ProductFilter;
        applyMode: 'per_item' | 'threshold';
      };
      banner_image_url?: string;
    }
  | {
      kind: 'new_price';
      value: number;               // absolute price
      name?: string;
      description?: string;
      discountedPrice: number;
      is_exclusive?: boolean;
      requires_min_subtotal?: boolean;
      min_subtotal_amount?: number | null;
      rule?: {
        qty: number;
        filter: ProductFilter;
        applyMode: 'per_item' | 'threshold';
      };
      banner_image_url?: string;
    }
  | {
      kind: 'penny';
      name?: string;
      description?: string;
      discountedPrice: number;
      is_exclusive?: boolean;
      requires_min_subtotal?: boolean;
      min_subtotal_amount?: number | null;
      rule?: {
        qty: number;
        filter: ProductFilter;
        applyMode: 'per_item' | 'threshold';
      };
      banner_image_url?: string;
    }
  | {
      kind: 'cart_subtotal';
      discount_id: string;
      name?: string;
      description?: string;
      effect: { type: string; value: number };
      is_exclusive?: boolean;
      requires_min_subtotal?: boolean;
      min_subtotal_amount?: number | null;
      banner_image_url?: string;
    }
  | {
      kind: 'bogo';
      buyQty: number;
      getQty: number;
      name?: string;
      description?: string;
      discountType: 'percent' | 'flat';
      discountValue: number;
      getProductId?: string | null;
      role?: 'buy' | 'get';
      is_exclusive?: boolean;
      requires_min_subtotal?: boolean;
      min_subtotal_amount?: number | null;
      banner_image_url?: string;
    }
  | {
      kind: 'bundle';
      bundleSize: number;
      bundlePrice: number;
      name?: string;
      description?: string;
      is_exclusive?: boolean;
      banner_image_url?: string;
      products: { product_id: string }[];
    };
