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

  isAdded = false;
  isDisabled = false;
  imageLoaded = false;

  constructor(
    private cartService: CartService,
    private a11y: AccessibilityService
  ) {}

  addToCart(event: Event) {
    event?.stopPropagation();
    if (this.isDisabled) return;

    this.isDisabled = true;
    this.isAdded = true;

    const cartItem = { ...this.product, quantity: 1 };
    this.cartService.addToCart(cartItem);

    // announce for screen readers
    this.a11y.announce(`${this.product?.title} added to cart. Quantity: 1.`, 'assertive');

    // reset visual state
    setTimeout(() => {
      this.isAdded = false;
      this.isDisabled = false;
    }, 1600);
  }

  onImgLoad() { this.imageLoaded = true; }

  onImgError(evt: Event) {
    const img = evt.target as HTMLImageElement;
    img.src = this.placeholderFor(this.product?.category);
    this.imageLoaded = true;
  }

  placeholderFor(category?: string | null): string {
    const key = (category || 'default').toLowerCase();
    // map to your assets; provide a default fallback
    const map: Record<string, string> = {
      flower: 'assets/flower-general.png',
      'pre-roll': 'assets/pre-roll-general.png',
      prerolls: 'assets/pre-roll-general.png',
      edibles: 'assets/edibles-general.png',
      vapes: 'assets/vapes-general.png',
      concentrates: 'assets/concentrates-general.png',
      beverages: 'assets/beverage-general.png',
      tinctures: 'assets/tinctures-general.png',
      topicals: 'assets/topicals-general.png',
      accessories: 'assets/accessories-general.png',
      default: 'assets/default.png'
    };
    return map[key] || map['default'];
  }

  strainClass(type?: string) {
    if (!type) return '';
    const t = type.toLowerCase();
    if (t.includes('sativa')) return 'sativa';
    if (t.includes('indica')) return 'indica';
    return 'hybrid';
  }

  
}
