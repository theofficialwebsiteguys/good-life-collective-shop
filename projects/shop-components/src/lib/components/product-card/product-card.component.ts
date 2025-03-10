import { Component, Input } from '@angular/core';
import { Product } from '../../models/product.model';
import { CommonModule } from '@angular/common';
import { CartService } from '../../services/cart.service';
import { AccessibilityService } from '../../services/accessibility.service';

@Component({
  selector: 'lib-product-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css'
})
export class ProductCardComponent {
  @Input() product!: Product;
  isAdded: boolean = false;
  isDisabled: boolean = false;

  constructor(private cartService: CartService, private accessibilityService: AccessibilityService){}

  async addToCart(event: Event) {
    event.stopPropagation();

    if (this.isDisabled) return;

    this.isDisabled = true; // Disable button
    this.isAdded = true; // Change to checkmark

    const cartItem = {
      ...this.product,
      quantity: 1,
    };
  
    this.cartService.addToCart(cartItem); 
    setTimeout(() => {
      this.isAdded = false;
      this.isDisabled = false;
    }, 2000);
    
    this.accessibilityService.announce(`${this.product?.title} added to cart. Quantity: 1.`, 'assertive');
    // alert('Item added to cart!');
  }
}
