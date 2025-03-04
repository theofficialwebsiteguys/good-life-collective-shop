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

  constructor(private router: Router) {}

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
    this.router.navigate(['/shop'], { queryParams: { category: category.toUpperCase() } });
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
