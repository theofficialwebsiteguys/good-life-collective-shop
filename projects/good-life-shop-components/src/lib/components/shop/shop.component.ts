import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, map, of } from 'rxjs';
import { Product } from '../../models/product.model';
import { NavigationService } from '../../services/navigation.service';
import { ProductsService } from '../../services/products.service';
import { CommonModule } from '@angular/common';
import { ProductCardComponent } from '../product-card/product-card.component';
import { CategoriesComponent } from '../categories/categories.component';
import { ProductListComponent } from '../product-list/product-list.component';
import { FormsModule } from '@angular/forms';
import { ProductFilterOptions } from '../../models/product-filters.model';
import { CartIconComponent } from '../cart-icon/cart-icon.component';
import { AuthNavComponent } from '../auth-nav/auth-nav.component';

@Component({
  selector: 'lib-shop',
  standalone: true,
  imports: [CommonModule, ProductListComponent, CartIconComponent, FormsModule, AuthNavComponent],
  templateUrl: './shop.component.html',
  styleUrl: './shop.component.css'
})
export class ShopComponent implements OnInit {
  category: string | null = 'Flower';
  selectedBrands: string[] = [];
  selectedWeights: string[] = [];
  selectedTypes: string[] = [];
  searchQuery = '';
  sortOption = 'RECENT';

  // UI state
  isExpanded: Record<string, boolean> = { categories: true, types: true, brands: true, weights: true };
  isSidebarOpen = false;

  // Category chips for header
  categories: string[] = [
    'Flower', 'Pre-Roll', 'Edibles', 'Vapes', 'Concentrates',
    'Beverage', 'Tinctures', 'Topicals', 'Accessories'
  ];

  // Static types (leave as-is)
  types = [
    { name: 'Sativa', count: 13 },
    { name: 'Sativa-dom', count: 13 },
    { name: '50/50', count: 32 },
    { name: 'Indica-dom', count: 11 },
    { name: 'Indica', count: 11 }
  ];

  dynamicFilterOptions$: Observable<ProductFilterOptions> = of({ brands: [], weights: [] });

  private _scrollY = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductsService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.category = params['category'] || this.category;
      if (params['brand']) this.selectedBrands = [params['brand']];
      this.fetchDynamicFilters();
    });

    this.productService.products$.subscribe(() => this.fetchDynamicFilters());

    this.sortOption = localStorage.getItem('sortOption') || 'RECENT';
  }

  updateSortOption(event: Event) { 
    event.stopPropagation();
    localStorage.setItem('sortOption', this.sortOption); 
  }

  /* Category chip click */
  selectCategory(c: string) {
    this.category = c;
    // Update URL (optional)
    this.router.navigate([], { queryParams: { category: c }, queryParamsHandling: 'merge' });
    // Optionally clear search when switching categories:
    // this.searchQuery = '';
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
    const body = document.body;

    if (this.isSidebarOpen) {
      this._scrollY = window.scrollY || 0;
      body.style.top = `-${this._scrollY}px`;
      body.classList.add('modal-open');
    } else {
      body.classList.remove('modal-open');
      const y = this._scrollY || 0;
      body.style.top = '';
      window.scrollTo(0, y);
    }
  }

  fetchDynamicFilters(): void {
    this.dynamicFilterOptions$ = this.productService.getProductFilterOptions().pipe(
      map((options) => ({
        brands: options.brands.sort((a, b) => a.label.localeCompare(b.label)),
        weights: options.weights,
      }))
    );
  }

  toggleSection(section: keyof typeof this.isExpanded): void {
    this.isExpanded[section] = !this.isExpanded[section];
  }

  toggleTypeFilter(type: string): void {
    this.selectedTypes = this.selectedTypes.includes(type)
      ? this.selectedTypes.filter(t => t !== type)
      : [...this.selectedTypes, type];
  }

  toggleBrandFilter(brand: string) {
    this.selectedBrands = this.selectedBrands.includes(brand)
      ? this.selectedBrands.filter(b => b !== brand)
      : [...this.selectedBrands, brand];
  }

  toggleWeightsFilter(weight: string) {
    this.selectedWeights = this.selectedWeights.includes(weight)
      ? this.selectedWeights.filter(w => w !== weight)
      : [...this.selectedWeights, weight];
  }

  clearFilters() {
    this.selectedBrands = [];
    this.selectedTypes = [];
    this.selectedWeights = [];
    this.searchQuery = '';
    this.sortOption = 'RECENT';
  }
}

