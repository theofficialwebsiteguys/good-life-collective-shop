import { Component } from '@angular/core';
import { CartItem, CartService } from '../../services/cart.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'lib-cart',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css'
})
export class CartComponent {
  cartItems: CartItem[] = [];
  subtotal: number = 0;
  
  constructor(private cartService: CartService) {}

  ngOnInit(): void {
    this.cartService.cart$.subscribe((cart) => {
      this.cartItems = cart;
      this.subtotal = this.cartItems.reduce((total, item) => total + (parseFloat(item.price) * item.quantity), 0);
    });
  }

  updateQuantity(item: CartItem, quantity: number) {
    this.cartService.updateQuantity(item.id, quantity);
  }

  removeItem(item: CartItem) {
    this.cartService.removeFromCart(item.id);
  }

  clearCart() {
    this.cartService.clearCart();
  }
}
