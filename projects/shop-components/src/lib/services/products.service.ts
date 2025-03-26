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

  constructor(private navigationService: NavigationService,  private http: HttpClient, private route: Router) {
    this.loadProductsFromSessionStorage();
  }

  private loadProductsFromSessionStorage(): void {
    const storedProducts = sessionStorage.getItem('products');
    if (storedProducts) {
      const parsedProducts: Product[] = JSON.parse(storedProducts);
      const sortedProducts = this.sortProducts(parsedProducts);
      this.products.next(sortedProducts);
    } else{
      console.log("here")
      this.fetchProducts().subscribe();
    }
  }

  private saveProductsToSessionStorage(products: Product[]): void {
    sessionStorage.setItem('products', JSON.stringify(products));
  }

  fetchProducts(): Observable<Product[]> {
    if (this.products.value.length > 0) {
      console.log('Products already loaded from session storage.');
      return of(this.products.value); // Return existing products as an Observable
    }
  
    const options = {
      url: `${environment.apiUrl}/products/all-products`,
      params: { venueId: environment.venueId, keepVapeCategory: 'true'  },
      headers: { 'Content-Type': 'application/json' },
    };
  
    return new Observable<Product[]>((observer) => {
      CapacitorHttp.get(options)
        .then((response) => {
          if (response.status === 200) {
            const sortedProducts = this.sortProducts(response.data);
            this.products.next(sortedProducts);
            this.saveProductsToSessionStorage(sortedProducts);
            observer.next(sortedProducts);
            observer.complete();
          } else {
            console.error('API request failed:', response);
            observer.error(response);
          }
        })
        .catch((error) => {
          console.error('Error fetching products:', error);
          observer.error(error);
        });
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
  

  getFilteredProducts(
    searchQuery: string = '',
    category: string | null = null,
    selectedBrands: string[] = [],
    selectedWeights: string[] = [],
    selectedTypes: string[] = [],
    sortOption: string = 'RECENT'
  ): Observable<Product[]> {
    return this.products$.pipe(
      filter(productArray => productArray.length > 0),
      map(productArray => {
        let filteredProducts = productArray;
  
        // ✅ Filter by category
        if (category) {
          filteredProducts = filteredProducts.filter(p => p.category === category);
        }
  
        // ✅ Filter by search query
        if (searchQuery.trim() !== '') {
          filteredProducts = filteredProducts.filter(p =>
            p.title.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
  
        // ✅ Filter by brand
        if (selectedBrands && selectedBrands.length > 0) {
          filteredProducts = filteredProducts.filter(p => selectedBrands.includes(p.brand));
        }

        if (selectedWeights && selectedWeights.length > 0) {
          filteredProducts = filteredProducts.filter(p => selectedWeights.includes(p.weight));
        }

        if (selectedTypes && selectedTypes.length > 0) {
          filteredProducts = filteredProducts.filter(p => selectedTypes.includes(p.strainType));
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

  getProductFilterOptions(): Observable<ProductFilterOptions> {
    return this.products$.pipe(
      map((productArray) => {
        const fields = ['brand', 'weight'];

        let options: { [key: string]: any } = {};
        options = fields.reduce((acc, field) => {
          acc[`${field}s`] = new Set();
          return acc;
        }, options);

        productArray.forEach((product) => {
          if (product.category === this.navigationService.getSelectedCategory()?.toUpperCase()) { // Filter by currentCategory
            fields.forEach((field) => {
              if (!!product[field]) {
                options[`${field}s`].add(product[field]);
              }
            });
          }
        });

        let result: ProductFilterOptions = { brands: [], weights: [] };
        result = fields.reduce((acc, field) => {
          acc[`${field}s`] = Array.from(options[`${field}s`]).map((o) => ({
            label: o,
            value: o,
          }));
          return acc;
        }, result);

        return result;
      })
    );
  }

  updateCategory(category: ProductCategory) {
    this.currentCategory.next(category); 
    this.route.navigateByUrl('/products');
  }

  getCurrentCategory(): ProductCategory {
    return this.currentCategory.value;
  }

  getCategories(): CategoryWithImage[] {
    return [
      { category: 'FLOWER', imageUrl: 'assets/icons/flower.png' },
      { category: 'PREROLL', imageUrl: 'assets/icons/prerolls.png' },
      { category: 'EDIBLE', imageUrl: 'assets/icons/edibles.png' },
      { category: 'CONCENTRATES', imageUrl: 'assets/icons/concentrates.png' },
      { category: 'VAPE', imageUrl: 'assets/icons/vaporizers.png' },
      { category: 'BEVERAGE', imageUrl: 'assets/icons/beverages.png' },
      { category: 'TINCTURES', imageUrl: 'assets/icons/tinctures.png' },
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
    console.log(product);
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
  
}
