import { ProductCategory } from "./product-category.model";

export type Strain = '50/50' | 'INDICA' | 'SATIVA' | 'INDICA-DOM' | 'SATIVA-DOM';

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
  weightTierInformation?: WeightTier[] | null; // ✅ add this
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
        minQty?: number;
        rule?: {
          minQty: number;
          productIds?: string[];
          brands?: string[];
          categories?: string[];
        };
        banner_image_url?: string;
      } | {
      kind: 'flat';
      name?: string;
      description?: string;
      value: number;               // total $ off per group
      discountedPrice: number;
      minQty?: number;
      rule?: {
        minQty: number;
        productIds?: string[];
        brands?: string[];
        categories?: string[];
      };
      totalOff?: number;
      perItemOff?: number;
      banner_image_url?: string;
    } 
  //  | {
  //     kind: 'percent' | 'flat';
  //     value: number;
  //     name?: string;
  //     description?: string;

  //     /** Preview price shown on product card */
  //     discountedPrice: number;

  //     /** Discount applies when minQty is met */
  //     minQty?: number;

  //     /** Qualifying rule */
  //     rule?: {
  //       minQty: number;
  //       productIds?: string[];
  //       brands?: string[];
  //       categories?: string[];
  //     };

  //     /** 🆕 FLAT-DISCOUNT DISPLAY HELPERS */
  //     totalOff?: number;     // total $ off across minQty
  //     perItemOff?: number;   // derived per-item share

  //     role?: 'buy' | 'get';
  //     banner_image_url?: string;
  //   }
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
      banner_image_url?: string;
    }
  | {
      kind: 'bundle';
      bundleSize: number;
      bundlePrice: number;   // ✅ ADD THIS
      name?: string;
      description?: string;
      banner_image_url?: string;
      products: { product_id: string }[];
    };
