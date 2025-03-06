import { Component, OnInit, ElementRef, ViewChild, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product } from '../../models/product.model';
import { ProductsService } from '../../services/products.service';
import { NavigationService } from '../../services/navigation.service';
import { ProductCardComponent } from '../product-card/product-card.component';

@Component({
  selector: 'lib-recent-products-carousel',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './recent-products-carousel.component.html',
  styleUrl: './recent-products-carousel.component.css'
})
export class RecentProductsCarouselComponent implements OnInit {
  products$: Observable<Product[]> = of([]);
  
  @ViewChild('productCarousel', { static: false }) productCarousel!: ElementRef;

  @Input() brands: string[] = [];

  constructor(private productService: ProductsService, private navigationService: NavigationService) {}

  ngOnInit(): void {
    this.products$ = this.productService.fetchProducts().pipe(
      map(products => {
        let filteredProducts = products;

        // Apply filtering based on category and brand
        if (this.brands && this.brands.length > 0) {
          filteredProducts = filteredProducts.filter(product => 
            this.brands.includes(product.brand) // Checks if the product's brand is in the allowed brands list
          );
        }

        // Sort and limit the number of products displayed
        return filteredProducts.sort((a: any, b: any) => b.posProductId - a.posProductId).slice(0, 12);
      })
    );
  }

  scrollProducts(direction: number): void {
    if (this.productCarousel?.nativeElement) {
      this.productCarousel.nativeElement.scrollBy({ left: direction * 300, behavior: 'smooth' });
    } else {
      console.warn('productCarousel is not initialized yet.');
    }
  }
  

  navigateToProduct(product: Product): void {
    this.navigationService.navigateToProduct(product);
  }
}
