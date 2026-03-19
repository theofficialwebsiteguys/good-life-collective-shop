import { Component, Input } from '@angular/core';
import { AppliedDiscount, Product } from '../../models/product.model';
import { CommonModule } from '@angular/common';
import { CartItem, CartService } from '../../services/cart.service';
import { AccessibilityService } from '../../services/accessibility.service';
import { NavigationService } from '../../services/navigation.service';
import { Router } from '@angular/router';

type PriceDiscount = Extract<AppliedDiscount, { kind: 'percent' | 'flat' }>;
@Component({
  selector: 'lib-product-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './product-card.component.html',
  styleUrl: './product-card.component.css',
})
export class ProductCardComponent {
  @Input() product!: Product;

  isAdded = false;
  isDisabled = false;
  imageLoaded = false;

  constructor(
    private cartService: CartService,
    private a11y: AccessibilityService,
    private navigationService: NavigationService,
    private router: Router,
  ) {}

  // addToCart(event: Event) {
  //   event?.stopPropagation();
  //   if (this.isDisabled) return;

  //   this.isDisabled = true;
  //   this.isAdded = true;

  //   const cartItem = { ...this.product, quantity: 1 };
  //   this.cartService.addToCart(cartItem);
  //   this.a11y.announce(`${this.product?.title} added to cart. Quantity: 1.`, 'assertive');

  //   setTimeout(() => {
  //     this.isAdded = false;
  //     this.isDisabled = false;
  //   }, 1600);
  // }

  addToCart(event: Event) {
    event.stopPropagation();
    if (this.isDisabled) return;

    this.isDisabled = true;
    this.isAdded = true;

    this.cartService.addToCart({
      id: this.product.id,
      posProductId: this.product.posProductId,
      id_batch: this.product.id_batch,
      quantity: 1,
      discountNote: null,

      // ✅ ADD THESE TWO LINES
      weight:
        this.product.weight != null ? Number(this.product.weight) : undefined,

      unit: this.product.unit ?? undefined,
    });

    this.a11y.announce(`${this.product.title} added to cart.`, 'assertive');

    setTimeout(() => {
      this.isAdded = false;
      this.isDisabled = false;
    }, 1600);
  }

  get priceDiscount(): PriceDiscount | null {
    const d = this.discounts.find(
      (x): x is PriceDiscount => x.kind === 'percent' || x.kind === 'flat',
    );
    return d ?? null;
  }

  onImgLoad() {
    this.imageLoaded = true;
  }

  onImgError(evt: Event) {
    const img = evt.target as HTMLImageElement;
    img.src = this.placeholderFor(this.product?.category);
    this.imageLoaded = true;
  }

  get hasWeightTiers(): boolean {
    return (
      Array.isArray(this.product?.weightTierInformation) &&
      this.product.weightTierInformation.length > 0
    );
  }

  placeholderFor(category?: string | null, title?: string | null): string {
    const key = (category || 'default').toLowerCase();
    const titleKey = (title || '').toLowerCase();

    // 🔹 TITLE-BASED OVERRIDES (highest priority)
    const isAio = titleKey.includes('aio') || titleKey.includes('all in one') || titleKey.includes('all-in-one') || titleKey.includes('disposable');
    const is510 = titleKey.includes('510') || titleKey.includes('cart') || titleKey.includes('cartridge');
    const isVape = titleKey.includes('vape');

    if (isAio) {
      return 'assets/aio-general.png';
    }

    if (is510) {
      return 'assets/510-general.png';
    }

    if (isVape) {
      return 'assets/aio-general.png';
    }

    // 🔹 CATEGORY FALLBACKS
    const map: Record<string, string> = {
      flower: 'assets/flower-general.png',
      'pre-roll': 'assets/pre-roll-general.png',
      prerolls: 'assets/pre-roll-general.png',
      edibles: 'assets/edibles-general.png',
      vapes: 'assets/vapes-general.png',
      concentrates: 'assets/concentrates-general.png',
      beverage: 'assets/beverage-general.png',
      tinctures: 'assets/tinctures-general.png',
      topicals: 'assets/topicals-general.png',
      accessories: 'assets/accessories-general.png',
      default: 'assets/default.png',
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

  onCtaClick(event: Event) {
    event.stopPropagation();

    if (this.hasWeightTiers) {
      // 👉 Navigate to product detail instead of adding
      this.navigationService.navigateToProduct(this.product);
      // this.router.navigate(['/product', this.product.id]);
      return;
    }

    // Normal product → add to cart
    this.addToCart(event);
  }

  /** Ensures safe numeric comparison for discounts */
  toNumber(value: any): number {
    const n = parseFloat(value);
    return isNaN(n) ? 0 : n;
  }

  get discounts() {
    return this.product.discounts ?? [];
  }

  get hasDiscount(): boolean {
    return this.discounts.length > 0;
  }

  get percentOrFlat(): PriceDiscount | null {
    return this.priceDiscount;
  }

  get bogo() {
    return this.discounts.find((d) => d.kind === 'bogo');
  }

  get bundle() {
    return this.discounts.find((d) => d.kind === 'bundle');
  }

  get discountedPrice(): number | null {
    return this.priceDiscount?.discountedPrice ?? null;
  }

  get isPriceDiscounted(): boolean {
    return (
      this.discountedPrice !== null &&
      this.discountedPrice < Number(this.product.price)
    );
  }

  get dealBannerText(): string | null {
    const d = this.priceDiscount;
    if (!d) return null;

    // ------------------------
    // PERCENT DISCOUNT
    // ------------------------
    if (d.kind === 'percent') {
      return `${d.value}% off`;
    }

    // ------------------------
    // FLAT DISCOUNT
    // ------------------------
    const minQty = d.minQty ?? 1;

    // Buy X get $Y off (total)
    if (minQty > 1 && d.totalOff) {
      return `Buy ${minQty}, get $${d.totalOff} off`;
    }

    // Simple flat
    return `$${d.value} off`;
  }

  get showCheckoutDisclaimer(): boolean {
    const d = this.priceDiscount;
    return !!(
      d &&
      d.kind === 'flat' &&
      typeof d.minQty === 'number' &&
      d.minQty > 1
    );
  }

  private formatCannabinoid(value: any): string | null {
    const n = parseFloat(value);
    if (isNaN(n) || n <= 0) return null;
    return `${n.toFixed(1)}%`;
  }
  get thcDisplay(): string {
    const p = this.product?.['potency'];

    const total = this.formatCannabinoid(p?.totalThc);
    const thc = this.formatCannabinoid(p?.thc);

    return total || thc || '–';
  }
  get cbdDisplay(): string {
    const p = this.product?.['potency'];

    const cbd = this.formatCannabinoid(p?.cbd);
    return cbd || '–';
  }
}
