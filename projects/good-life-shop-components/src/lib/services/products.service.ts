import { Injectable } from '@angular/core';
import { Product } from '../models/product.model';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, filter, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { CapacitorHttp } from '@capacitor/core';

import { ProductCategory, CategoryWithImage } from '../models/product-category.model';
import {
  DEFAULT_PRODUCT_FILTERS,
  PotencyRange,
  ProductFilterOptions,
  ProductFilters,
} from '../models/product-filters.model';

import { environment } from '../../environments/environment.prod';
import { NavigationService } from './navigation.service';
import { OfferBanner } from '../offer-banner.model';


@Injectable({
  providedIn: 'root',
})
export class ProductsService {
  private products = new BehaviorSubject<Product[]>([]);
  products$ = this.products.asObservable();

  private currentCategory = new BehaviorSubject<ProductCategory>('FLOWER');
  currentCategory$ = this.currentCategory.asObservable();

  private currentProduct = new BehaviorSubject<Product | null>(null); // Start with null or a default Product
  currentProduct$ = this.currentProduct.asObservable();

  private currentProductFilters = new BehaviorSubject<ProductFilters>(
    DEFAULT_PRODUCT_FILTERS
  );
  currentProductFilters$ = this.currentProductFilters.asObservable();

  private lastFetchedLocationId: string | null = null;

  constructor(private navigationService: NavigationService,  private http: HttpClient, private route: Router) {
    // this.loadProductsFromSessionStorage();
     this.syncFromUrl();
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  private syncFromUrl() {
    const tree = this.route.parseUrl(this.route.url);
    const q = tree.queryParams;

    // CATEGORY
    if (q['category']) {
      this.currentCategory.next(q['category'].toUpperCase() as ProductCategory);
    }

    // OFFER SLUG
    if (q['offer']) {
      // just store slug — filtering already happens downstream
      this.currentProductFilters.next({
        ...this.currentProductFilters.value,
        offerSlug: q['offer'],
      } as any);
    }
  }

  private storageKey(locationId: string) {
    return `products_${locationId}`;
  }

  private saveProductsToSessionStorage(locationId: string, products: Product[]) {
    sessionStorage.setItem(this.storageKey(locationId), JSON.stringify(products));
  }

  private loadProductsFromSessionStorage(locationId: string): Product[] | null {
    const stored = sessionStorage.getItem(this.storageKey(locationId));
    return stored ? JSON.parse(stored) : null;
  }

  // private loadProductsFromSessionStorage(): void {
  //   const storedProducts = sessionStorage.getItem('products');
  //   if (storedProducts) {
  //     const parsedProducts: Product[] = JSON.parse(storedProducts);
  //     const sortedProducts = this.sortProducts(parsedProducts);
  //     sortedProducts.forEach((p: any) => {
  //       if (Array.isArray(p.bundleProducts)) {
  //         p.bundleProducts = p.bundleProducts
  //           .map((bp: any) => sortedProducts.find(sp => sp.id === bp.id))
  //           .filter(Boolean);
  //       }
  //     });
  //     this.products.next(sortedProducts);
  //   }
  //   // } else{
  //   //   this.fetchProducts().subscribe();
  //   // }
  // }

  // private saveProductsToSessionStorage(products: Product[]): void {
  //   sessionStorage.setItem('products', JSON.stringify(products));
  // }

  // fetchProducts(location_id: string): Observable<Product[]> {
  //   if (this.lastFetchedLocationId && this.lastFetchedLocationId !== location_id) {
  //     this.products.next([]);
  //     this.saveProductsToSessionStorage([]); // optional, if you’re syncing to session storage
  //   }

  //   // Return cached products if already loaded for the same location
  //   if (this.products.value.length > 0 && this.lastFetchedLocationId === location_id) {
  //     return of(this.products.value);
  //   }

  //   this.lastFetchedLocationId = location_id;

  //   const options = {
  //     url: `${environment.apiUrl}/flowhub/inventoryByLocation`,
  //     params: { location_id, toggleVape: String(false) },
  //     headers: {
  //       'Content-Type': 'application/json',
  //       'x-auth-api-key': environment.db_api_key,
  //     },
  //   };

  //   return new Observable<Product[]>((observer) => {
  //     CapacitorHttp.get(options)
  //       .then((response) => {
  //         if (response.status === 200) {
  //           const raw = response.data.products.map((p: any) => ({
  //             ...p,
  //             rawPrice: Number(p.price),     // ✅ permanent source of truth
  //           }));
  //           const sortedProducts = this.sortProducts(raw);
  //           // const sortedProducts = this.sortProducts(response.data.products);
  //           this.lastFetchedLocationId = location_id; // ✅ Set current location
  //           this.products.next(sortedProducts);
  //           this.saveProductsToSessionStorage(sortedProducts);
  //           observer.next(sortedProducts);
  //           observer.complete();
  //         } else {
  //           console.error('API request failed:', response);
  //           observer.error(response);
  //         }
  //       })
  //       .catch((error) => {
  //         console.error('Error fetching products:', error);
  //         observer.error(error);
  //       });
  //   });
  // }

  fetchProducts(location_id: string): Observable<Product[]> {
  const storageKey = `products_${location_id}`;

  // 1️⃣ Try sessionStorage FIRST (per location)
  const cached = sessionStorage.getItem(storageKey);
  if (cached) {
    const parsed: Product[] = JSON.parse(cached);
    this.products.next(parsed);
    this.lastFetchedLocationId = location_id;
    return of(parsed);
  }

  // 2️⃣ Clear in-memory products if switching locations
  if (this.lastFetchedLocationId && this.lastFetchedLocationId !== location_id) {
    this.products.next([]);
  }

  this.lastFetchedLocationId = location_id;

  const options = {
    url: `${environment.apiUrl}/flowhub/inventoryByLocation`,
    params: { location_id, toggleVape: String(false) },
    headers: {
      'Content-Type': 'application/json',
      'x-auth-api-key': environment.db_api_key,
    },
  };

  return new Observable<Product[]>((observer) => {
    CapacitorHttp.get(options)
      .then((response) => {
        if (response.status !== 200) {
          observer.error(response);
          return;
        }

        // 3️⃣ Normalize RAW server price ONCE
        const rawProducts = response.data.products.map((p: any) => ({
          ...p,
          rawPrice: Number(p.price), // 🔒 immutable source of truth
        }));

        const sorted = this.sortProducts(rawProducts);

        // 4️⃣ Cache per location
        sessionStorage.setItem(storageKey, JSON.stringify(sorted));

        // 5️⃣ Emit
        this.products.next(sorted);
        observer.next(sorted);
        observer.complete();
      })
      .catch((err) => observer.error(err));
  });
}

  
  getProducts(): Observable<Product[]> {
    return this.products$.pipe(
      filter(products => products.length > 0) // Only emit if products exist
    );
  }

  private sortProducts(products: Product[]): Product[] {
    return products.sort((a, b) => a.title.localeCompare(b.title));
  }  

  // getFilteredProducts(): Observable<Product[]> {
  //   return this.products$.pipe(
  //     filter((productArray) => productArray.length > 0),
  //     map((productArray) => {
  //       const {
  //         sortMethod: { criterion, direction },
  //       } = this.currentProductFilters.getValue();

  
  //       return productArray
  //         .filter(({ category, brand, strainType, weight, thc }) => {
  //           const {
  //             brands,
  //             strains,
  //             weights,
  //             potency: { thc: thcRange },
  //           } = this.currentProductFilters.getValue();
  
  //           const isEmpty = (arr: any) => {
  //             return arr.length < 1;
  //           };
  
  //           const isInRange = (value: number, range: PotencyRange): boolean => {
  //             const { lower, upper } = range;
  //             return value >= lower && value <= upper;
  //           };
  
  //           // Default THC to 100 if null or undefined
  //           const defaultThc = thc ?? '100% THC';
  
  //           return (
  //             category === this.currentCategory.value &&
  //             (isEmpty(brands) || brands.includes(brand)) &&
  //             (!strainType ||
  //               isEmpty(strains) ||
  //               strains.some((s) =>
  //                 strainType.toUpperCase().split(' ').includes(s)
  //               )) &&
  //             (!weight || isEmpty(weights) || weights.includes(weight)) &&
  //             (!defaultThc || isInRange(Number(defaultThc.split('%')[0]), thcRange))
  //           );
  //         })
  //         .sort(
  //           (
  //             { price: priceA, thc: thcA, title: titleA },
  //             { price: priceB, thc: thcB, title: titleB }
  //           ) => {
  //             let result = 0;
  
  //             // Default THC to 100 if null or undefined for sorting
  //             const defaultThcA = thcA ?? '100';
  //             const defaultThcB = thcB ?? '100';
  
  //             switch (criterion) {
  //               case 'POPULAR': {
  //                 break;
  //               }
  //               case 'PRICE': {
  //                 if (direction === 'ASC')
  //                   result = Number(priceA) - Number(priceB);
  //                 else if (direction === 'DESC')
  //                   result = Number(priceB) - Number(priceA);
  //                 break;
  //               }
  //               case 'THC': {
  //                 if (direction === 'ASC')
  //                   result = Number(defaultThcA) - Number(defaultThcB);
  //                 else if (direction === 'DESC')
  //                   result = Number(defaultThcB) - Number(defaultThcA);
  //                 break;
  //               }
  //               case 'ALPHABETICAL': {
  //                 if (direction === 'ASC')
  //                   result = titleA.localeCompare(titleB);
  //                 else if (direction === 'DESC')
  //                   result = titleB.localeCompare(titleA);
  //                 break;
  //               }
  //               default: {
  //                 break;
  //               }
  //             }
  
  //             return result;
  //           }
  //         );
  //     }),
  //     filter((filteredProducts) => filteredProducts.length > 0) // ✅ Ensure it only emits if there are filtered products
  //   );
  // }
  

  setProducts(products: Product[]) {
    this.products.next(products);
    // this.saveProductsToSessionStorage(products);
  }


  getFilteredProducts(
    searchQuery: string = '',
    category: string | null = null,
    selectedBrands: string[] = [],
    selectedWeights: string[] = [],
    selectedTypes: string[] = [],
    sortOption: string = 'RECENT',
    onSaleOnly: boolean = false,
    thcMin: number = 0,
    thcMax: number = 100,
    selectedVapeTypes: string[] = []
  ): Observable<Product[]> {
    return this.products$.pipe(
      filter(productArray => productArray.length > 0),
      map(productArray => {
        let filteredProducts = productArray;
    

      if (category) {
        const normalizedCategory = category.toLowerCase();

        if (normalizedCategory === 'offers') {
          filteredProducts = productArray.filter(p => this.isOfferProduct(p));
        }
        else {
          filteredProducts =
            productArray.filter(
              p => p.category?.toLowerCase() === normalizedCategory
            );
        }
      }

        // ✅ Filter by search query
        if (searchQuery.trim() !== '') {
          filteredProducts = filteredProducts.filter(p =>
            p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.strainType.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
  
        // ✅ Filter by brand
        if (selectedBrands && selectedBrands.length > 0) {
          filteredProducts = filteredProducts.filter(p => selectedBrands.includes(p.brand));
        }

        // inside getFilteredProducts(), replace only the weights block:
        if (selectedWeights && selectedWeights.length > 0) {
          filteredProducts = filteredProducts.filter((p: any) => {
            const amount = p?.weight;
            const rawUnit = p?.weightUnit ?? p?.unit;
            const unit = String(rawUnit ?? '').trim().toLowerCase();
            const key = `${String(amount ?? '').trim()}|${unit}`;
            if (key !== '|' && selectedWeights.includes(key)) return true;

            // optional backward compat: if old selections were just "3.5"
            const amountOnly = String(amount ?? '').trim();
            return amountOnly && selectedWeights.includes(amountOnly);
          });
        }

        if (selectedTypes && selectedTypes.length > 0) {
          filteredProducts = filteredProducts.filter(p => {
            if (!p.strainType) return false;
            const st = p.strainType.toUpperCase();
            return selectedTypes.some(t => st === t.toUpperCase());
          });
        }

        if (selectedVapeTypes && selectedVapeTypes.length > 0) {
          filteredProducts = filteredProducts.filter(p => {
            const t = (p.title || '').toLowerCase();
            const isAio = t.includes('aio') || t.includes('all in one') || t.includes('all-in-one') || t.includes('disposable');
            const is510 = t.includes('510') || t.includes('cart') || t.includes('cartridge');
            const isVape = t.includes('vape');
            const bucket = isAio || (isVape && !is510) ? 'aio' : is510 ? '510' : null;
            return bucket !== null && selectedVapeTypes.includes(bucket);
          });
        }

        if (onSaleOnly) {
          filteredProducts = filteredProducts.filter(p => this.isOfferProduct(p));
        }

        if (thcMin > 0 || thcMax < 100) {
          const min = Math.min(thcMin, thcMax);
          const max = Math.max(thcMin, thcMax);
          filteredProducts = filteredProducts.filter(p => {
            const potency = (p as any)['potency'];
            const rawThc = potency?.totalThc ?? potency?.thc ?? p.thc;
            const val = this.extractThcValue(rawThc);
            return val >= min && val <= max;
          });
        }

        // ✅ Sorting logic
        switch (sortOption) {
          case 'PRICE_ASC':
            filteredProducts.sort((a: any, b: any) => a.price - b.price);
            break;
          case 'PRICE_DESC':
            filteredProducts.sort((a: any, b: any) => b.price - a.price);
            break;
            case 'THC_ASC':
              filteredProducts.sort((a, b) => this.extractThcValue(a.thc) - this.extractThcValue(b.thc));
              break;
            case 'THC_DESC':
              filteredProducts.sort((a, b) => this.extractThcValue(b.thc) - this.extractThcValue(a.thc));
              break;
          case 'NAME':
            filteredProducts.sort((a: any, b: any) => a.title.localeCompare(b.title));
            break;
          case 'RECENT':
          default:
            filteredProducts.sort((a: any, b: any) => b.posProductId - a.posProductId);
            break;
        }

  
        return filteredProducts;
      })
    );
  }
  
  extractThcValue(thc: string | null | undefined): number {
    if (!thc) return 0; // Default to 0 if THC is missing
    const match = thc.match(/(\d+(\.\d+)?)/); // Extract numeric value
    return match ? parseFloat(match[0]) : 0;
  }

  // getProductFilterOptions(): Observable<ProductFilterOptions> {
  //   return this.products$.pipe(
  //     map((productArray) => {
  //       const brands = new Set<string>();
  //       const weightMap = new Map<string, { label: string; value: string; sort: number }>();

  //       const selectedCat = this.navigationService.getSelectedCategory()?.toUpperCase();

  //       productArray.forEach((p: any) => {
  //         if (p?.category?.toUpperCase() !== selectedCat) return;

  //         // brands
  //         if (p?.brand) brands.add(p.brand);

  //         // weights (amount + unit)
  //         const amount = p?.weight;                 // "3.5", 3.5, etc.
  //         const rawUnit = p?.weightUnit ?? p?.unit; // "g", "mg", "oz", "ml", etc.
  //         if (amount == null) return;

  //         const unit = String(rawUnit ?? '').trim().toLowerCase();
  //         const amountStr = String(amount).trim();
  //         const key = `${amountStr}|${unit}`;       // e.g. "3.5|g"
  //         const label = unit ? `${amountStr} ${unit}` : amountStr;

  //         // sort to grams (mg→g, oz→g). ml goes after solids; unknown units last.
  //         const n = parseFloat(amountStr);
  //         let sort = Number.POSITIVE_INFINITY;
  //         if (!Number.isNaN(n)) {
  //           if (unit === 'mg') sort = n / 1000;
  //           else if (unit === 'g') sort = n;
  //           else if (unit === 'oz') sort = n * 28.3495;
  //           else if (unit === 'ml') sort = 1_000_000 + n; // keep liquids after solids
  //           else sort = 2_000_000 + n;                    // unknown units last
  //         }

  //         if (!weightMap.has(key)) {
  //           weightMap.set(key, { label, value: key, sort });
  //         }
  //       });

  //       return {
  //         brands: Array.from(brands).map(b => ({ label: b, value: b })),
  //         weights: Array.from(weightMap.values())
  //           .sort((a, b) => a.sort - b.sort)
  //           .map(({ label, value }) => ({ label, value })),
  //       };
  //     })
  //   );
  // }

getProductFilterOptions(): Observable<ProductFilterOptions> {
  return combineLatest([this.products$, this.currentCategory$]).pipe(
    map(([productArray, selectedCat]) => {
      const brands = new Set<string>();
      const weightMap = new Map<string, { label: string; value: string; sort: number }>();

      if (!selectedCat) return { brands: [], weights: [] };

      const normalizedCat = selectedCat.toUpperCase();

      // 🟢 Filter base set depending on category
      let relevantProducts = productArray;

      if (normalizedCat === 'OFFERS') {
        // 🔥 Special logic: include only discounted / promo items
       relevantProducts = productArray.filter(p => this.isOfferProduct(p));
      } else {
        // 🧭 Normal category filtering
        relevantProducts = productArray.filter(
          (p: any) => p?.category?.toUpperCase() === normalizedCat
        );
      }

      // 🧩 Collect filters from the relevant set
      relevantProducts.forEach((p: any) => {
        if (p?.brand) brands.add(p.brand);

        const amount = p?.weight;
        const rawUnit = p?.weightUnit ?? p?.unit;
        if (amount == null) return;

        const unit = String(rawUnit ?? '').trim().toLowerCase();
        const amountStr = String(amount).trim();
        const key = `${amountStr}|${unit}`;
        const label = unit ? `${amountStr} ${unit}` : amountStr;

        const n = parseFloat(amountStr);
        let sort = Number.POSITIVE_INFINITY;
        if (!Number.isNaN(n)) {
          if (unit === 'mg') sort = n / 1000;
          else if (unit === 'g') sort = n;
          else if (unit === 'oz') sort = n * 28.3495;
          else if (unit === 'ml') sort = 1_000_000 + n;
          else sort = 2_000_000 + n;
        }

        if (!weightMap.has(key)) {
          weightMap.set(key, { label, value: key, sort });
        }
      });

      return {
        brands: Array.from(brands).map((b) => ({ label: b, value: b })),
        weights: Array.from(weightMap.values())
          .sort((a, b) => a.sort - b.sort)
          .map(({ label, value }) => ({ label, value })),
      };
    })
  );
}


  updateCategory(category: ProductCategory) {
    this.currentCategory.next(category);

    this.route.navigate([], {
      queryParams: { category: category.toLowerCase() },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }


  getCurrentCategory(): ProductCategory {
    return this.currentCategory.value;
  }

  getCategories(): CategoryWithImage[] {
    return [
      { category: 'OFFERS', imageUrl: 'assets/icons/discount.png' },
      { category: 'FLOWER', imageUrl: 'assets/icons/flower.png' },
      { category: 'PRE-ROLL', imageUrl: 'assets/icons/prerolls.png' },
      { category: 'EDIBLES', imageUrl: 'assets/icons/edibles.png' },
      { category: 'CONCENTRATES', imageUrl: 'assets/icons/concentrates.png' },
      { category: 'VAPES', imageUrl: 'assets/icons/vaporizers.png' },
      { category: 'BEVERAGE', imageUrl: 'assets/icons/beverages.png' },
      { category: 'TINCTURES', imageUrl: 'assets/icons/tinctures.png' },
      { category: 'TOPICALS', imageUrl: 'assets/icons/topicals.png' },
      { category: 'ACCESSORIES', imageUrl: 'assets/icons/accessories.png' },
    ];
  }

  getSimilarItems(): Observable<Product[]> {
    return combineLatest([this.currentProduct$, this.products$]).pipe(
      map(([currentProduct, productArray]) => {
  
        if (!currentProduct || !currentProduct.category || !currentProduct.brand) {
          return []; 
        }
  
        const { category, brand } = currentProduct;

        const filteredProducts = productArray.filter((product) => 
          product.category === category && product.brand === brand && product.id != currentProduct.id
        );
  
        return filteredProducts.slice(0, 5);
      })
    );
  }


  updateCurrentProduct(product: Product) {
    this.currentProduct.next(product);
    this.updateCategory(product.category)
    this.route.navigateByUrl('/product-display');
  }

  getCurrentProduct(): Product | null {
    return this.currentProduct.value;
  }


  updateProductFilters(filters: ProductFilters) {
    this.currentProductFilters.next({ ...filters }); 
  }

  getProductsByIds(ids: string[]): Observable<Product[]> {
    return this.products$.pipe(
      map((productArray) =>
        productArray.filter((product) => ids.includes(product.id))
      )
    );
  }

private isOfferProduct(p: any): boolean {
  if (!Array.isArray(p.discounts) || p.discounts.length === 0) {
    return false;
  }

  const price = Number(p.price);

  return p.discounts.some((d: any) => {
    switch (d.kind) {
      case 'percent':
      case 'flat':
        return (
          typeof d.discountedPrice === 'number' &&
          d.discountedPrice > 0 &&
          d.discountedPrice < price
        );
      case 'new_price':
        return typeof d.discountedPrice === 'number' && d.discountedPrice < price;
      case 'penny':
        return price > 0.01;
      case 'bogo':
        return d.buyQty > 0 && d.getQty > 0;
      case 'bundle':
        return d.bundleSize > 1;
      case 'cart_subtotal':
        return true;
      default:
        return false;
    }
  });
}

  getOfferBanners(products: any[]): OfferBanner[] {
    const map = new Map<string, OfferBanner>();

    products.forEach(p => {
      (p.discounts ?? []).forEach((d: any) => {
        const key = this.slugify(
          d.name || `${d.kind}-${d.value}-${d.description || ''}`
        );

        map.set(key, {
          id: key,
          kind: d.kind,
          label: d.name,
          banner_image_url: d.banner_image_url || '',
          description: d.description,
          // Match by discount name — ensures clicking "Munchie Monday" only shows
          // Edibles with that specific deal, not all bogo products.
          predicate: (product: any) =>
            (product.discounts ?? []).some((pd: any) => pd.name === d.name),
        });
      });
    });

    return Array.from(map.values());
  }


  applyOfferFromSlug(slug: string | null, products: Product[]): OfferBanner | null {
    if (!slug) return null;

    const offers = this.getOfferBanners(products);
    return offers.find(o => o.id === slug) ?? null;
  }

  
}
