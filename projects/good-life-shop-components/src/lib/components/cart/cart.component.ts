import { Component, OnDestroy, OnInit } from '@angular/core';
import { CartItem, CartService } from '../../services/cart.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { Product } from '../../models/product.model';
import { ProductsService } from '../../services/products.service';
import { AppliedDiscount } from '../../models/product.model';

@Component({
  selector: 'lib-cart',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.css'
})
export class CartComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  cartItems: CartItem[] = [];
  products: Product[] = [];
  subtotal = 0;

  constructor(
    private cartService: CartService,
    private productsService: ProductsService
  ) {}

  ngOnInit(): void {
    // Cart
    this.cartService.cart$
      .pipe(takeUntil(this.destroy$))
      .subscribe(cart => {
        this.cartItems = cart;
        // this.subtotal = this.calculateSubtotal(cart);
        this.subtotal = this.cartService.getCartSubtotal(cart);
      });

    // Products (for BOGO suggestions)
    this.productsService.products$
      .pipe(takeUntil(this.destroy$))
      .subscribe(products => {
        this.products = products;
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /* =========================
     CART ACTIONS
  ========================== */

 increment(item: CartItem) {
    this.cartService.updateQuantity(
      item.id,
      item.quantity + 1,
      {
        gramAmount: item.selectedTier?.gramAmount,
        weight: item.weight,
        unit: item.unit,
      }
    );
  }

  decrement(item: CartItem) {
    this.cartService.updateQuantity(
      item.id,
      item.quantity - 1,
      {
        gramAmount: item.selectedTier?.gramAmount,
        weight: item.weight,
        unit: item.unit,
      }
    );
  }

  remove(item: CartItem) {
    this.cartService.removeFromCart(
      item.id,
      {
        gramAmount: item.selectedTier?.gramAmount,
        weight: item.weight,
        unit: item.unit,
      }
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
      default: 'assets/default.png'
    };

    return map[key] || map['default'];
  }


  /* =========================
     DISPLAY HELPERS
  ========================== */

  hasReward(item: CartItem): boolean {
    return item.discountedQty > 0;
  }

  hasMixedPricing(item: CartItem): boolean {
    return item.discountedQty > 0 && item.discountedQty < item.quantity;
  }

  /* =========================
     BOGO SUGGESTIONS
  ========================== */

  getActiveBogo(): AppliedDiscount | null {
    return (
      this.cartItems
        .flatMap(i => i.discounts ?? [])
        .find(d => d.kind === 'bogo') ?? null
    );
  }

  getRewardTargetId(): string | null {
    const bogo = this.getActiveBogo();
    return bogo?.kind === 'bogo' ? bogo.getProductId ?? null : null;
  }

  getRewardedQty(): number {
    const targetId = this.getRewardTargetId();
    if (!targetId) return 0;

    const item = this.cartItems.find(i => i.id === targetId);
    return item?.discountedQty ?? 0;
  }

  getMaxRewardQty(): number {
    const bogo = this.getActiveBogo();
    if (!bogo || bogo.kind !== 'bogo') return 0;

    const qualifyingQty = this.cartItems
      .filter(i =>
        i.discounts?.some(
          d =>
            d.kind === 'bogo' &&
            d.role !== 'get' && // ✅ ONLY BUY items
            d.getProductId === bogo.getProductId
        )
      )
      .reduce((sum, i) => sum + i.quantity, 0);

    return Math.floor(qualifyingQty / bogo.buyQty) * bogo.getQty;
  }


  canAddReward(): boolean {
    return this.getRewardedQty() < this.getMaxRewardQty();
  }

  getRewardProduct(): Product | null {
    const targetId = this.getRewardTargetId();
    if (!targetId) return null;

    return (
      this.products.find(
        (p: Product) => String(p.id) === String(targetId)
      ) ?? null
    );
  }

  getBogoLabel(): string {
    const bogo = this.getActiveBogo();
    if (!bogo || bogo.kind !== 'bogo') return '';

    if (bogo.discountType === 'percent') {
      return `${bogo.getQty} @ ${bogo.discountValue}% off`;
    }

    if (bogo.discountType === 'flat') {
      return `${bogo.getQty} @ $${bogo.discountValue} off`;
    }

    return `${bogo.getQty} free`;
  }

  addRewardItem() {
    const reward = this.getRewardProduct();
    if (!reward) return;

    this.cartService.addToCart({
      id: reward.id,
      posProductId: reward.posProductId,
      id_batch: reward.id_batch,
      quantity: 1,
      discountNote: null,
    });
  }

  shouldShowBogoSuggestion(): boolean {
    const bogo = this.getActiveBogo();
    if (!bogo || bogo.kind !== 'bogo') return false;

    const maxReward = this.getMaxRewardQty();
    const rewarded = this.getRewardedQty();

    // ✅ ONLY show if a new reward slot exists
    return maxReward > rewarded;
  }

  hasDiscount(item: CartItem): boolean {
    return !!this.getDiscountTag(item);
  }

  getDiscountTag(item: { discounts?: AppliedDiscount[] }): string | null {
    if (!item.discounts?.length) return null;

    // 1️⃣ BOGO
    const bogo = item.discounts.find(
      (d): d is Extract<AppliedDiscount, { kind: 'bogo' }> =>
        d.kind === 'bogo'
    );
    if (bogo) return 'BOGO';

    // 2️⃣ PRICE DISCOUNT (percent / flat)
    const price = item.discounts.find(
      (d): d is Extract<AppliedDiscount, { kind: 'percent' | 'flat' }> =>
        d.kind === 'percent' || d.kind === 'flat'
    );

    if (price) {
      return price.kind === 'percent'
        ? `${price.value}% OFF`
        : `$${price.value} OFF`;
    }

    // 3️⃣ BUNDLE
    const bundle = item.discounts.find(
      (d): d is Extract<AppliedDiscount, { kind: 'bundle' }> =>
        d.kind === 'bundle'
    );
    if (bundle) return 'BUNDLE';

    return null;
  }

  getActiveBundle() {
    return (
      this.cartItems
        .flatMap(i => i.discounts ?? [])
        .find(d => d.kind === 'bundle') ?? null
    );
  }

  // private calculateSubtotal(cart: CartItem[]): number {
  //   const bundle = this.getActiveBundle();

  //   console.log(bundle)
  //   if (
  //     bundle &&
  //     bundle.kind === 'bundle' &&
  //     typeof bundle.bundlePrice === 'number'
  //   ) {
  //     const bundleCount = this.getBundleCount(bundle);

  //     if (bundleCount > 0) {
  //       const bundleIds =
  //         (bundle as any).products.map((p: any) => String(p.product_id));

  //       // Bundle total
  //       const bundleTotal = bundleCount * bundle.bundlePrice;

  //       // Leftover items (extras beyond bundle count)
  //       const extrasTotal = cart.reduce((sum, item) => {
  //         if (!bundleIds.includes(String(item.id))) {
  //           return sum + item.lineTotal;
  //         }

  //         // Bundle product with extra quantity beyond bundle usage
  //         const leftoverQty = item.quantity - bundleCount;
  //         if (leftoverQty > 0) {
  //           return sum + leftoverQty * item.unitPrice;
  //         }

  //         return sum;
  //       }, 0);

  //       return bundleTotal + extrasTotal;
  //     }
  //   }
  //   // No active bundle
  //   return cart.reduce((sum, item) => sum + item.lineTotal, 0);
  // }

//   private calculateSubtotal(cart: CartItem[]): number {
//   // 1) Start with base subtotal (bundle-aware)
//   let subtotal = 0;

//   const bundle = this.getActiveBundle();

//   if (
//     bundle &&
//     bundle.kind === 'bundle' &&
//     typeof bundle.bundlePrice === 'number'
//   ) {
//     const bundleCount = this.getBundleCount(bundle);

//     if (bundleCount > 0) {
//       const bundleIds =
//         (bundle as any).products.map((p: any) => String(p.product_id));

//       const bundleTotal = bundleCount * bundle.bundlePrice;

//       const extrasTotal = cart.reduce((sum, item) => {
//         if (!bundleIds.includes(String(item.id))) {
//           return sum + item.lineTotal;
//         }

//         const leftoverQty = item.quantity - bundleCount;
//         if (leftoverQty > 0) {
//           return sum + leftoverQty * item.unitPrice;
//         }

//         return sum;
//       }, 0);

//       subtotal = bundleTotal + extrasTotal;
//     } else {
//       subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
//     }
//   } else {
//     subtotal = cart.reduce((sum, item) => sum + item.lineTotal, 0);
//   }

//   // 2) Apply CART-LEVEL FLAT discount (like “3 for $18” i.e. $6 off total)
//   const discount = this.getActiveCartDiscount();

//   if (discount && discount.kind === 'flat' && discount.rule) {
//     const minQty = discount.minQty ?? discount.rule.minQty ?? 1;
//     const qualifyingQty = this.getQualifyingQty(discount);

//     const groups = Math.floor(qualifyingQty / minQty);
//     const totalOff = groups * discount.value; // ✅ value is total $ off per group

//     subtotal = Math.max(subtotal - totalOff, 0);
//   }

//   return subtotal;
// }


  private getBundleCount(bundle: AppliedDiscount): number {
    if (bundle.kind !== 'bundle') return 0;

    const productIds =
      (bundle as any).products?.map((p: any) => String(p.product_id)) ?? [];

    if (!productIds.length) return 0;

    // For each bundle product, find its quantity in cart
    const quantities = productIds.map((id:any) => {
      const item = this.cartItems.find(i => String(i.id) === id);
      return item?.quantity ?? 0;
    });

    // Number of full bundles = smallest quantity
    return Math.min(...quantities);
  }


  // private isBundleComplete(bundle: AppliedDiscount): boolean {
  //   if (bundle.kind !== 'bundle') return false;

  //   const requiredIds =
  //     (bundle as any).products?.map((p: any) => String(p.product_id)) ?? [];

  //   if (!requiredIds.length) return false;

  //   return requiredIds.every((reqId: any) =>
  //     this.cartItems.some(item => String(item.id) === reqId && item.quantity > 0)
  //   );
  // }



  //Discount add
  getActiveCartDiscount(): AppliedDiscount | null {
    return (
      this.cartItems
        .flatMap(i => i.discounts ?? [])
        .find(
          (d): d is Extract<AppliedDiscount, { kind: 'flat' | 'percent' }> =>
            (d.kind === 'flat' || d.kind === 'percent') &&
            !!d.rule &&
            (d.minQty ?? d.rule.qty) > 1
        ) ?? null
    );
  }

  getQualifyingQty(discount: AppliedDiscount): number {
    if (
      discount.kind !== 'flat' &&
      discount.kind !== 'percent'
    ) {
      return 0;
    }

    if (!discount.rule) return 0;

    const filter = discount.rule.filter ?? {};
    return this.cartItems
      .filter(i => {
        if (filter.excludedProductIds?.includes(String(i.id))) return false;
        if (filter.includedProductIds?.length) return filter.includedProductIds.includes(String(i.id));
        if (filter.categories?.length && !filter.categories.includes(i.category)) return false;
        if (filter.brands?.length && !filter.brands.includes(i.brand)) return false;
        return true;
      })
      .reduce((sum, i) => sum + i.quantity, 0);
  }

  getRemainingQtyForNextDiscount(): number | null {
    const discount = this.getActiveCartDiscount();

    if (
      !discount ||
      (discount.kind !== 'percent' && discount.kind !== 'flat') ||
      !discount.rule
    ) {
      return null;
    }

    const minQty = discount.minQty ?? discount.rule.qty ?? 1;
    const qualifyingQty = this.getQualifyingQty(discount);

    // How many full sets have been earned
    const remainder = qualifyingQty % minQty;

    // ✅ EXACTLY on a fulfilled set → hide message
    if (remainder === 0) {
      return null;
    }

    // Otherwise show how many needed for next set
    return minQty - remainder;
  }


  getCartDiscountMessage(): string | null {
    const discount = this.getActiveCartDiscount();

    if (
      !discount ||
      (discount.kind !== 'percent' && discount.kind !== 'flat')
    ) {
      return null;
    }

    const remaining = this.getRemainingQtyForNextDiscount();
    if (!remaining || remaining <= 0) return null;

    if (discount.kind === 'percent') {
      return `Add ${remaining} more to get ${discount.value}% off`;
    }

    return `Add ${remaining} more to get $${discount.value} off`;
  }


  isDiscountApplied(item: CartItem): boolean {
    // Percent / flat discounts
    if (item.unitPrice < item.price) {
      return true;
    }

    // BOGO rewards
    if (item.discountedQty && item.discountedQty > 0) {
      return true;
    }

    return false;
  }

  isFullyDiscounted(item: CartItem): boolean {
    return item.discountedQty > 0 && item.discountedQty === item.quantity;
  }

  isMixedPricing(item: CartItem): boolean {
    return item.discountedQty > 0 && item.discountedQty < item.quantity;
  }

  getDisplayedDiscountPrice(item: CartItem): number {
    return item.discountedUnitPrice;
  }


}
