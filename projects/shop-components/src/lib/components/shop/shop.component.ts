import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
  selectedBrands: string[] = []; // ✅ Support multiple brands
  selectedWeights: string[] = []; // ✅ Support multiple brands
  selectedTypes: string[] = []; // ✅ Support multiple types
  searchQuery: string = ''; // ✅ Search input
  sortOption: string = 'RECENT'; // ✅ Sorting option

  // 🏷️ Dummy filter options
  types = [
    { name: 'Hybrid', count: 32 },
    { name: 'Indica', count: 11 },
    { name: 'Sativa', count: 13 }
  ];

  brands: { name: string; count: number }[] = [
    { name: '7SEAZ', count: 1 },
    { name: 'Aeterna', count: 6 },
    { name: 'Alchemy Pure', count: 1 },
    { name: 'Banzzy 1305', count: 2 }
  ];

  isExpanded: { [key: string]: boolean } = {
    categories: true,
    types: true,
    brands: true
  };

  isSidebarOpen = false;

  dynamicFilterOptions$: Observable<ProductFilterOptions> = of({
    brands: [],
    weights: [],
  });

  constructor(private route: ActivatedRoute, private productService: ProductsService) {}

  ngOnInit(): void {
    // Listen for category changes
    this.route.queryParams.subscribe(params => {
      this.category = params['category'] || null;

      if (params['brand']) {
        this.selectedBrands = [params['brand']];
      }
      this.fetchDynamicFilters(); // Refresh filters when category changes
    });
  
    // Listen for product changes and update filters
    this.productService.products$.subscribe(() => {
      this.fetchDynamicFilters(); // Re-fetch filters when products update
    });

    this.sortOption = localStorage.getItem('sortOption') || 'RECENT';
  }

  updateSortOption() {
    localStorage.setItem('sortOption', this.sortOption);
  }
  

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  
  // Function to re-fetch dynamic filter options
  fetchDynamicFilters(): void {
    this.dynamicFilterOptions$ = this.productService.getProductFilterOptions().pipe(
      map((options) => {
        return {
          brands: options.brands.sort((a, b) => a.label.localeCompare(b.label)), // Sort alphabetically
          weights: options.weights.sort((a, b) => parseFloat(a.label) - parseFloat(b.label)), // Sort numerically
        };
      })
    );
  
    this.dynamicFilterOptions$.subscribe(response => {
      console.log('Updated Filter Options:', response);
    });
  }
  

  toggleSection(section: keyof typeof this.isExpanded): void {
    this.isExpanded[section] = !this.isExpanded[section];
  }

  toggleTypeFilter(type: string): void {
    if (this.selectedTypes.includes(type)) {
      this.selectedTypes = this.selectedTypes.filter(t => t !== type);
    } else {
      this.selectedTypes = [...this.selectedTypes, type];
    }
  }
  

  toggleBrandFilter(brand: string) {
    if (this.selectedBrands.includes(brand)) {
      this.selectedBrands = this.selectedBrands.filter(b => b !== brand); // New array assignment
    } else {
      this.selectedBrands = [...this.selectedBrands, brand]; // Spread to create a new array
    }
  }

  toggleWeightsFilter(weight: string) {
    if (this.selectedWeights.includes(weight)) {
      this.selectedWeights = this.selectedWeights.filter(b => b !== weight); // New array assignment
    } else {
      this.selectedWeights = [...this.selectedWeights, weight]; // Spread to create a new array
    }
  }
  

  clearFilters() {
    this.selectedBrands = [];
    this.selectedTypes = [];
    this.selectedWeights = []
    this.searchQuery = '';
    this.sortOption = 'RECENT';
  }
}