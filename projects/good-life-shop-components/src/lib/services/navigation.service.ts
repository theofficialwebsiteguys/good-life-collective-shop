import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Product } from '../models/product.model';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private selectedProduct = new BehaviorSubject<Product | null>(this.getStoredProduct());
  selectedProduct$ = this.selectedProduct.asObservable();

  private selectedCategory = new BehaviorSubject<string | null>(this.getStoredCategory());
  selectedCategory$ = this.selectedCategory.asObservable();

  private selectedOffer = new BehaviorSubject<string | null>(this.getStoredOffer());
  selectedOffer$ = this.selectedOffer.asObservable();


  constructor(private router: Router) {
     this.hydrateFromUrl();
  }

  private hydrateFromUrl() {
    const tree = this.router.parseUrl(this.router.url);
    const q = tree.queryParams;

    if (q['category']) {
      this.setSelectedCategory(q['category']);
    }

    if (q['offer']) {
      this.setSelectedOffer(q['offer']);
    }
  }

  setSelectedOffer(offerSlug: string | null) {
    this.selectedOffer.next(offerSlug);

    if (offerSlug) {
      sessionStorage.setItem('selectedOffer', offerSlug);
    } else {
      sessionStorage.removeItem('selectedOffer');
    }
  }

  getSelectedOffer(): string | null {
    return this.selectedOffer.value;
  }

  private getStoredOffer(): string | null {
    return sessionStorage.getItem('selectedOffer');
  }


  navigateToOffer(offerSlug: string) {
    this.setSelectedOffer(offerSlug);

    this.router.navigate(['/shop'], {
      queryParams: {
        category: 'OFFERS',
        offer: offerSlug,
      },
      queryParamsHandling: 'merge',
    });
  }

  clearOffer() {
    this.setSelectedOffer(null);

    this.router.navigate(['/shop'], {
      queryParams: { offer: null },
      queryParamsHandling: 'merge',
    });
  }


  // Set the selected product and store in sessionStorage
  setSelectedProduct(product: Product | null) {
    this.selectedProduct.next(product);
    if (product) {
      sessionStorage.setItem('selectedProduct', JSON.stringify(product)); // Store in sessionStorage
      this.router.navigate([`/shop/${product.id}`]); // Navigate to product page
    } else {
      sessionStorage.removeItem('selectedProduct'); // Remove if null
    }
  }

  getSelectedProduct(): Product | null {
    return this.selectedProduct.value;
  }

  clearSelectedProduct() {
    this.selectedProduct.next(null);
    sessionStorage.removeItem('selectedProduct'); // Clear storage
    this.router.navigate(['/shop'], { queryParams: { category: this.getSelectedCategory()?.toUpperCase() } });
  }

  // Store category in sessionStorage
  setSelectedCategory(category: string | null) {
    this.selectedCategory.next(category);
    if (category) {
      sessionStorage.setItem('selectedCategory', category);
    } else {
      sessionStorage.removeItem('selectedCategory');
    }
  }

  getSelectedCategory(): string | null {
    return this.selectedCategory.value;
  }

  navigateToProduct(product: Product): void {
    this.setSelectedProduct(product);
    this.router.navigate([`/shop/${product.id}`]);
  }

  navigateToCategory(category: string): void {
    this.setSelectedCategory(category);
    this.setSelectedOffer(null); // 👈 reset offer if switching category

    this.router.navigate(['/shop'], {
      queryParams: { category: category.toUpperCase() },
      queryParamsHandling: 'merge',
    });
  }


  // Retrieve stored product from sessionStorage
  private getStoredProduct(): Product | null {
    const storedProduct = sessionStorage.getItem('selectedProduct');
    return storedProduct ? JSON.parse(storedProduct) : null;
  }

  // Retrieve stored category from sessionStorage
  private getStoredCategory(): string | null {
    return sessionStorage.getItem('selectedCategory') || 'Flower';
  }
}
