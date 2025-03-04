import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
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

  constructor(private productService: ProductsService, private navigationService: NavigationService) {}

  ngOnInit(): void {
    this.products$ = this.productService.fetchProducts().pipe(
      map(products => 
        products.sort((a: any, b: any) => b.posProductId - a.posProductId).slice(0, 8)
      )
    );
  }

  scrollProducts(direction: number): void {
    this.productCarousel.nativeElement.scrollBy({ left: direction * 300, behavior: 'smooth' });
  }

  navigateToProduct(product: Product): void {
    this.navigationService.navigateToProduct(product);
  }
}
