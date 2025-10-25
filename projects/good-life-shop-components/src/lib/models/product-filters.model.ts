import { Strain } from './product.model';

export type SortCriterion = 'RECENT' | 'PRICE' | 'THC' | 'ALPHABETICAL';
export type CriteriaOptions = {
  label: string;
  value: SortCriterion;
}[];

export type SortDirection = 'ASC' | 'DESC';
export type DirectionOptions = {
  label: string;
  value: SortDirection;
}[];

export type Option = { label: string; value: string };
export type Options = Option[];

export type StrainOptions = {
  label: string;
  value: Strain;
}[];

export type PotencyRange = { lower: number; upper: number };

export type ProductFilterField = 'brands' | 'strains' | 'weights';
export type ProductFilters = {
  [key: string]: any;
  sortMethod: { criterion: SortCriterion; direction: SortDirection };
  brands: string[];
  strains: Strain[];
  weights: string[];
  potency: { thc: PotencyRange };
};
export type ProductFilterOptions = {
  [key: string]: any;
  brands: Options;
  weights: Options;
};

export const DEFAULT_PRODUCT_FILTERS: ProductFilters = {
  sortMethod: { criterion: 'ALPHABETICAL', direction: 'ASC' },
  brands: [],
  strains: [],
  weights: [],
  potency: { thc: { lower: 0, upper: 100 } },
};

export const OPTIONS_CRITERIA: CriteriaOptions = [
  { label: 'Recently Added', value: 'RECENT' },
  { label: 'Price', value: 'PRICE' },
  { label: 'THC', value: 'THC' },
  { label: 'A-Z', value: 'ALPHABETICAL' },
];

export const OPTIONS_DIRECTIONS: DirectionOptions = [
  { label: 'High to Low', value: 'DESC' },
  { label: 'Low to High', value: 'ASC' },
];

export const OPTIONS_STRAINS: StrainOptions = [
  { label: 'Hybrid', value: 'HYBRID' },
  { label: 'Indica', value: 'INDICA' },
  { label: 'Sativa', value: 'SATIVA' },
];
