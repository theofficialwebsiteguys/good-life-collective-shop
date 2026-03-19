import { AppliedDiscount } from './models/product.model';

export type OfferBanner = {
  id: string;
  kind: AppliedDiscount['kind'];
  banner_image_url: string;
  label: string;
  description?: string;
  predicate: (product: any) => boolean;
};
