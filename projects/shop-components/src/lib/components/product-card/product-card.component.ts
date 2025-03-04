import { Component, Input } from '@angular/core';
import { Product } from '../../models/product.model';
import { CommonModule } from '@angular/common';
import { CartService } from '../../services/cart.service';

@Component({
  selector: 'lib-product-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css'
})
export class ProductCardComponent {
  @Input() product!: Product;

  constructor(private cartService: CartService){}

  async addToCart(event: Event) {
    event.stopPropagation();
    const cartItem = {
      ...this.product,
      quantity: 1,
    };
  
    this.cartService.addToCart(cartItem); 
    //this.accessibilityService.announce(`${this.product?.title} added to cart. Quantity: ${this.quantity}.`, 'assertive');
    alert('Item added to cart!');
  }
}
