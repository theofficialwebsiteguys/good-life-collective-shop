import { Component, OnInit } from '@angular/core';
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
export class CartComponent implements OnInit {
  cartItems: CartItem[] = [];
  subtotal: number = 0;

  constructor(private cartService: CartService) {}

  ngOnInit(): void {
    this.cartService.cart$.subscribe((cart) => {
      this.cartItems = cart;

      this.subtotal = this.cartItems.reduce(
        (total, item) => total + this.getEffectiveItemTotal(item),
        0
      );
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

  /** 🟢 Helpers for template */
  isDiscounted(item: CartItem): boolean {
    return !!item.discountedPrice && Number(item.discountedPrice) < Number(item.price);
  }

  isBogo(item: CartItem): boolean {
    return Array.isArray(item['bogoRules']) && item['bogoRules'].length > 0;
  }

  getBogoText(item: CartItem): string {
    const rule = item['bogoRules']?.[0];
    if (!rule) return '';
       return `Buy ${rule.buy_quantity} Get ${rule.get_quantity} ${
    rule.discount_type === 'percent'
        ? `${rule.discount_value}% Off`
        : `$${Number(rule.discount_value).toFixed(2)} Off`
    }`;

  }

  toNumber(value: string | number): number {
    return typeof value === 'number' ? value : parseFloat(value) || 0;
  }

  getEffectiveItemTotal(item: CartItem): number {
    const price = this.toNumber(item.discountedPrice || item.price);

    // 🟢 Handle BOGO
    if (Array.isArray(item.bogoRules) && item.bogoRules.length > 0) {
      const rule = item.bogoRules[0];
      const buyQty = rule.buy_quantity || 1;
      const getQty = rule.get_quantity || 0;
      const discountValue = rule.discount_value || rule.discount_percent || 0;

      if (item.quantity >= buyQty + getQty && discountValue > 0) {
        const setCount = Math.floor(item.quantity / (buyQty + getQty));
        const discountedItems = setCount * getQty;
        const discountPerItem =
          rule.discount_type === 'flat'
            ? discountValue
            : price * (discountValue / 100);
        const discountedTotal = discountedItems * (price - discountPerItem);
        const regularTotal = (item.quantity - discountedItems) * price;
        return discountedTotal + regularTotal;
      }
    }

    // Default: standard or discounted price × quantity
    return price * item.quantity;
  }


}
