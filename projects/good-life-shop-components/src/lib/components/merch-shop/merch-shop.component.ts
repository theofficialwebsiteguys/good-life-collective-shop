import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable, of, map } from 'rxjs';

import { ProductFilterOptions } from '../../models/product-filters.model';
import { ProductsService } from '../../services/products.service';

import { ProductListComponent } from '../product-list/product-list.component';
import { CartIconComponent } from '../cart-icon/cart-icon.component';
import { AuthNavComponent } from '../auth-nav/auth-nav.component';

@Component({
  selector: 'lib-merch-shop',
  standalone: true,
  imports: [CommonModule, ProductListComponent, CartIconComponent, FormsModule, AuthNavComponent],
  templateUrl: './merch-shop.component.html',
  // Reuse the exact same stylesheet as the main shop for identical look
  styleUrls: ['../shop/shop.component.css']
})
export class MerchShopComponent implements OnInit {
  // Lock category to Apparel
  category: string | null = 'Apparel';

  // Filters
  selectedBrands: string[] = [];
  selectedTypes: string[] = [];   // unused for merch
  selectedWeights: string[] = []; // unused for merch
  searchQuery = '';
  sortOption = 'RECENT';

  // UI (only Brands open for merch)
  isExpanded: Record<string, boolean> = { categories: true, types: false, brands: true, weights: false };
  isSidebarOpen = false;

  // Category chips – if you want sub-groups later, add them here
  categories: string[] = ['Apparel'];

  // Brand/weight options (weights unused for merch but keeping shape)
  dynamicFilterOptions$: Observable<ProductFilterOptions> = of({ brands: [], weights: [] });

  // keep body scroll position when opening the sheet
  private _scrollY = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private productService: ProductsService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      // hard-force Apparel, but still allow /?brand=... preselection
      this.category = 'Apparel';
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

  // Category chip click (kept for future sub-categories; locks to Apparel now)
  selectCategory(_: string) {
    this.category = 'Apparel';
    this.router.navigate([], { queryParams: { category: 'Apparel' }, queryParamsHandling: 'merge' });
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
      map(options => ({
        // alphabetical brands for apparel row
        brands: options.brands.sort((a, b) => a.label.localeCompare(b.label)),
        weights: [] // hide/ignore weights for merch
      }))
    );
  }

  toggleSection(section: keyof typeof this.isExpanded): void {
    this.isExpanded[section] = !this.isExpanded[section];
  }

  toggleBrandFilter(brand: string) {
    this.selectedBrands = this.selectedBrands.includes(brand)
      ? this.selectedBrands.filter(b => b !== brand)
      : [...this.selectedBrands, brand];
  }

  clearFilters() {
    this.selectedBrands = [];
    this.searchQuery = '';
    this.sortOption = 'RECENT';
  }
}
