import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, Input, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { Product } from '../../models/product.model';
import { ProductsService } from '../../services/products.service';
import { CommonModule } from '@angular/common';
import { ProductCardComponent } from '../product-card/product-card.component';
import { NavigationService } from '../../services/navigation.service';

@Component({
  selector: 'lib-product-list',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css'
})
export class ProductListComponent implements OnInit {
  @Input() category: string | null = null;
  @Input() selectedBrands: string[] = []; // 🏷️ Brand filter
  @Input() selectedWeights: string[] = [];
  @Input() selectedTypes: string[] = []; // 🌿 Type filters
  @Input() searchQuery: string = ''; // 🔎 Search input
  @Input() sortOption: string = 'RECENT'; // 🔽 Sorting option

  products$: Observable<Product[]> = new Observable();

  constructor(private productService: ProductsService, private navigationService: NavigationService) {}

  ngOnInit(): void {
    this.fetchFilteredProducts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['category'] || changes['selectedBrands'] || changes['selectedWeights'] || changes['selectedTypes'] || changes['searchQuery'] || changes['sortOption']) {
      this.fetchFilteredProducts();
    }
  }

  fetchFilteredProducts(): void {
    this.products$ = this.productService.getFilteredProducts(
      this.searchQuery,
      this.category,
      this.selectedBrands,
      this.selectedWeights,
      this.selectedTypes,
      this.sortOption
    );
  }

  navigateToProduct(product: Product) {
    this.navigationService.navigateToProduct(product);
  }

  handleCardKey(event: KeyboardEvent, product: Product) {
  if (event.key === 'Enter' || event.key === ' ') {
    this.navigateToProduct(product);
    event.preventDefault();
  }
}

}
