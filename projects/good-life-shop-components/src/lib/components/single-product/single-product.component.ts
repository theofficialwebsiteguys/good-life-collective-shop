import { Component } from '@angular/core';
import { NavigationService } from '../../services/navigation.service';
import { AppliedDiscount, Product } from '../../models/product.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProductsService } from '../../services/products.service';
import { combineLatest, filter, map, Subject, Subscription, take, takeUntil } from 'rxjs';
import { CartItem, CartService } from '../../services/cart.service';
import { ChangeDetectionStrategy } from '@angular/core';


type PriceDiscount = Extract<AppliedDiscount, { kind: 'percent' | 'flat' }>;
type BogoDiscount = Extract<AppliedDiscount, { kind: 'bogo' }>;
type BundleDiscount = Extract<AppliedDiscount, { kind: 'bundle' }>;

type TerpeneChartItem = {
  name: string;
  value: number;
  unit: string;
  percent: number;
  offset: number;
};

function isPriceDiscount(d: AppliedDiscount): d is PriceDiscount {
  return (d.kind === 'percent' || d.kind === 'flat') && typeof (d as any).discountedPrice === 'number';
}

function isBogoDiscount(d: AppliedDiscount): d is BogoDiscount {
  return d.kind === 'bogo';
}

function isBundleDiscount(d: AppliedDiscount): d is BundleDiscount {
  return d.kind === 'bundle';
}

type WeightOption = {
  value: number;
  unit: string;
};

@Component({
  selector: 'lib-single-product',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './single-product.component.html',
  styleUrls: ['./single-product.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SingleProductComponent {
  product: Product | null = null;
  quantity: number = 1;
  selectedWeight: WeightOption | null = null;
  availableWeights: WeightOption[] = [];

  selectedWeightKey: string | null = null;

  showFullDescription = false;
  isAddingToCart: boolean = false;

  bundleItems: Product[] = [];
  isAddingBundle = false;

  selectedTier: any | null = null;

  bogoRelatedProducts: Product[] = [];
  addedDealProductIds = new Set<string>();
  dealRelatedProducts: Product[] = [];

  hoveredTerpene: TerpeneChartItem | null = null;

  terpeneColor(index: number): string {
    const palette = [
      '#60A5FA',
      '#34D399',
      '#FBBF24',
      '#A78BFA',
      '#F472B6',
      '#38BDF8',
      '#F87171',
      '#4ADE80'
    ];
    return palette[index % palette.length];
  }


  private destroy$ = new Subject<void>();

  private productSubscription: Subscription | null = null;
  private routeSubscription: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private navigationService: NavigationService,
    private productService: ProductsService,
    private cartService: CartService
  ) {}

  private _terpeneChartData: TerpeneChartItem[] = [];

  ngOnInit(): void {
    // whenever route id changes OR products list updates, re-resolve product
    combineLatest([
      this.route.paramMap.pipe(map(pm => pm.get('id'))),
      this.productService.products$
    ])
      .pipe(
        takeUntil(this.destroy$),
        filter(([id, products]) => !!id && products.length > 0),
        map(([id, products]) =>
          products.find(p => String(p.id) === String(id)) ?? null
        )
      )
      .subscribe(found => {
        // ✅ fall back to nav selected product only if we couldn't find it
        this.product =
          found ??
          (() => {
            const sel = this.navigationService.getSelectedProduct();
            return sel ? (String(sel.id) === String(this.route.snapshot.paramMap.get('id')) ? sel : null) : null;
          })();

        this.loadBogoRelatedProducts();
        this.loadDealRelatedProducts();

        if (!this.product) return;

        const tiers = (this.product as any).weightTierInformation ?? [];
        if (tiers.length) {
          this.selectedTier = tiers[0];
          this.quantity = 1;
        } else {
          this.setWeightOptions(this.product.weight as any);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
        this.loadBundleItems();
        this._terpeneChartData = this.buildTerpeneChart();

      });
  }


  get isDeli(): boolean {
    return !!this.product?.weightTierInformation?.length;
  }

  get maxTierQty(): number {
    if (!this.product || !this.selectedTier) return 0;

    const gramsAvailable = Number(this.product.quantity || 0); // deli inventory
    const perUnit = Number(this.selectedTier.gramAmount || 0);

    if (perUnit <= 0) return 0;
    return Math.floor(gramsAvailable / perUnit);
  }

  get displayUnitLabel(): string {
    return this.isDeli ? (this.selectedTier?.name ?? 'Select amount') : 'Quantity';
  }

  selectTier(t: any) {
    this.selectedTier = t;
    this.quantity = 1;
  }


  trackByVal = (_: number, w: WeightOption) => this.weightKey(w);


  onWeightChange(w: WeightOption) {
    this.selectedWeight = w;                 // ✅ add this
    this.selectedWeightKey = this.weightKey(w);
  }

  setHovered(t: TerpeneChartItem) {
    this.hoveredTerpene = t;
  }

  clearHovered() {
    this.hoveredTerpene = null;
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

  loadProduct(productId: string): void {
    const selectedProduct = this.navigationService.getSelectedProduct();
    if (selectedProduct && selectedProduct.id.toString() === productId) {
      this.product = selectedProduct;
      const tiers = (selectedProduct as any).weightTierInformation ?? [];
      if (tiers.length) {
        this.selectedTier = tiers[0];
        this.quantity = 1;
      } else {
        this.setWeightOptions(selectedProduct.weight as any);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });

      this.loadBundleItems();   // 👈 NEW
    }
  }

  private loadBundleItems(): void {
    this.bundleItems = [];

    const bundle = this.bundleDeal;
    if (!bundle) return;

    console.log(bundle);
    // ⬇️ Bundle product IDs come from the discount rules
    const rawProducts =
      (bundle as any)?.products ||
      (bundle as any)?.rules?.products ||
      [];

    const ids = rawProducts
      .map((p: any) => p.product_id)
      .filter(Boolean)
      .map(String);

      console.log(ids)
    if (!ids.length) return;

    this.productService
      .getProductsByIds(ids)
      .pipe(take(1))
      .subscribe(items => {
        this.bundleItems = items;
      });
  }

  addBundleToCart(): void {
    if (!this.product || !this.bundleItems.length || this.isAddingBundle) return;

    this.isAddingBundle = true;

    this.bundleItems.forEach(p => {
      this.cartService.addToCart({
        id: p.id,
        posProductId: p.posProductId,
        id_batch: p.id_batch,
        quantity: 1,
        discountNote: null
      });
    });

    setTimeout(() => {
      this.isAddingBundle = false;
    }, 1500);
  }


  goBack(): void {
    this.navigationService.clearSelectedProduct();
  }

  increaseQuantity() {
    if (this.isDeli) {
      if (this.quantity < this.maxTierQty) this.quantity++;
      return;
    }
    this.quantity++;
  }

  decreaseQuantity() {
    if (this.quantity > 1) this.quantity--;
  }

  get displayPrice(): number {
    if (!this.product) return 0;

    // DELI: use postTax when the product is tax-included (Oregon)
    if (this.isDeli && this.selectedTier) {
      const pennies = this.product.isTaxIncluded
        ? this.selectedTier.postTaxPriceInPennies
        : this.selectedTier.preTaxPriceInPennies;

      return Number(pennies ?? 0) / 100;
    }

    // NON-DELI: uses normalized product.price (already taxed for OR)
    return Number(this.product.price || 0);
  }


  get displayPostTaxPrice(): number | null {
    if (!this.isDeli || !this.selectedTier) return null;
    if (this.product?.isTaxIncluded) return null; // already showing post-tax as main
    return Number(this.selectedTier.postTaxPriceInPennies ?? 0) / 100;
  }



  // async addToCart() {
  //   if (this.isAddingToCart) return;
  //   this.isAddingToCart = true;

  //   const cartItem = {
  //     ...this.product,
  //     quantity: this.quantity,
  //   };
  
  //   this.cartService.addToCart(cartItem); 
  //   setTimeout(() => {
  //     this.isAddingToCart = false; // Enable button after 3 seconds
  //   }, 2000);
  //   //this.accessibilityService.announce(`${this.product?.title} added to cart. Quantity: ${this.quantity}.`, 'assertive');
  //   // alert('Item added to cart!');
  // }

  addToCart() {
    if (this.isAddingToCart || !this.product) return;

    // 🧀 DELI validation
    if (this.isDeli) {
      if (!this.selectedTier) return;
      if (this.quantity > this.maxTierQty) return;
    }

    // 📦 NON-DELI validation
    if (!this.isDeli) {
      if (!this.selectedWeight) return; // MUST select a weight/dose
    }

    this.isAddingToCart = true;

    const priceOverride =
      this.isDeli && this.selectedTier
        ? (
            this.product.isTaxIncluded
              ? this.selectedTier.postTaxPriceInPennies
              : this.selectedTier.preTaxPriceInPennies
          ) / 100
        : undefined;

    this.cartService.addToCart({
      id: this.product.id,
      posProductId: this.product.posProductId,
      id_batch: this.product.id_batch,
      quantity: this.quantity,
      discountNote: null,

      // ✅ DELI identity
      selectedTier: this.isDeli
        ? {
            gramAmount: this.selectedTier.gramAmount,
            priceOverride,
          }
        : undefined,

      // ✅ NON-DELI identity (THIS WAS MISSING)
      weight: !this.isDeli ? this.selectedWeight!.value : undefined,
      unit: !this.isDeli ? this.selectedWeight!.unit : undefined,
    });

    setTimeout(() => {
      this.isAddingToCart = false;
    }, 2000);
  }



  toggleDescription() {
    this.showFullDescription = !this.showFullDescription;
  }

  get truncatedDescription(): string {
    if (!this.product?.desc) return '';
    return this.showFullDescription
      ? this.product.desc
      : this.product.desc.slice(0, 300) + (this.product.desc.length > 300 ? '...' : '');
  }

  private setWeightOptions(weight: number): void {
    if (!this.product) {
      this.availableWeights = [];
      this.selectedWeight = null;
      return;
    }

    const rawUnit = this.product.unit ?? ''; // 👈 guarantees string

    this.availableWeights = [
      {
        value: weight,
        unit: rawUnit === 'grams' ? 'g' : rawUnit
      }
    ];

    this.selectedWeight = this.availableWeights[0];
    this.selectedWeightKey = this.weightKey(this.availableWeights[0]);

  }


  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }


  get discounts(): AppliedDiscount[] {
    return (this.product?.discounts ?? []) as AppliedDiscount[];
  }


  get hasDiscount(): boolean {
    return (
      !!this.priceDiscount ||
      !!this.freeBogo ||
      !!this.buyBogo ||
      !!this.bundleDeal
    );
  }


  get percentOrFlat() {
    return this.discounts.find(
      d => d.kind === 'percent' || d.kind === 'flat'
    );
  }

  get bogo() {
    return this.discounts.find(d => d.kind === 'bogo');
  }

  get bundle() {
    return this.discounts.find(d => d.kind === 'bundle');
  }

  get discountedPrice(): number | null {
    if (this.freeBogo) return 0;
    if (this.priceDiscount) return this.priceDiscount.discountedPrice;
    return null;
  }


  get isPriceDiscounted(): boolean {
    const base = Number(this.product?.price);
    return (
      this.discountedPrice !== null &&
      this.discountedPrice < base
    );
  }

  isPriceDiscount(
    d: any
  ): d is {
    name?: string;
    kind: 'percent' | 'flat';
    discountedPrice: number;
    value: number;
    description?: string;
  } {
    return (
      (d?.kind === 'percent' || d?.kind === 'flat') &&
      typeof d.discountedPrice === 'number'
    );
  }



  get discountLabel(): string {
    const d = this.priceDiscount;
    if (!d) return '';

    if (d.description) return d.description;

    return d.kind === 'percent'
      ? `${d.value}% Off`
      : `$${d.value} Off`;
  }

  get priceDiscount(): PriceDiscount | null {
    return this.discounts.find(isPriceDiscount) ?? null;
  }


  get freeBogo(): BogoDiscount | null {
    return (
      this.discounts.find(
        (d): d is BogoDiscount =>
          isBogoDiscount(d) &&
          d.role === 'get' &&
          d.discountType === 'percent' &&
          d.discountValue === 100
      ) ?? null
    );
  }

  get bundleDeal(): BundleDiscount | null {
    return this.discounts.find(isBundleDiscount) ?? null;
  }

  get buyBogo(): BogoDiscount | null {
    return (
      this.discounts.find(
        (d): d is BogoDiscount => isBogoDiscount(d) && d.role === 'buy'
      ) ?? null
    );
  }


  getDealExplanation(d: AppliedDiscount) {
    if (d.kind === 'flat') {
      const minQty = d.minQty ?? d.rule?.qty ?? 1;

      return {
        title: d.name || `Buy ${minQty}, Save $${d.value}`,
        description: `Buy ${minQty} ${minQty > 1 ? 'items' : 'item'} and get $${d.value} off total.`,
        actionLabel: `Add ${minQty} to unlock deal`,
        requiredQty: minQty
      };
    }

    if (d.kind === 'percent') {
      const minQty = d.minQty ?? d.rule?.qty ?? 1;

      return {
        title: d.name || `${d.value}% Off`,
        description: `Buy ${minQty}+ and receive ${d.value}% off each.`,
        actionLabel: `Add ${minQty} to unlock deal`,
        requiredQty: minQty
      };
    }

    if (d.kind === 'bogo') {
      const buy = d.buyQty;
      const get = d.getQty;

      return {
        title: d.name || `Buy ${buy}, Get ${get}`,
        description: d.getProductId
          ? `Buy ${buy} qualifying item${buy > 1 ? 's' : ''} and get ${get} specific item${get > 1 ? 's' : ''}.`
          : `Buy ${buy}, get ${get} of the same item.`,
        actionLabel: d.role === 'buy'
          ? `Add ${buy} to qualify`
          : `Add free item`,
        isReward: d.role === 'get',
        targetProductId: d.getProductId ?? null
      };
    }

    if (d.kind === 'bundle') {
      return {
        title: d.name || 'Bundle Deal',
        description: d.description || 'Buy this bundle to save.',
        actionLabel: 'Add Bundle to Cart'
      };
    }

    return null;
  }

  getOfferIcon(kind: string): string {
    switch (kind) {
      case 'bogo':          return 'fa-solid fa-arrow-right-arrow-left';
      case 'bundle':        return 'fa-solid fa-boxes-stacked';
      case 'cart_subtotal': return 'fa-solid fa-cart-shopping';
      case 'penny':         return 'fa-solid fa-cent-sign';
      case 'new_price':     return 'fa-solid fa-dollar-sign';
      default:              return 'fa-solid fa-tag';
    }
  }

  getDealSummary(d: AppliedDiscount): string {
    switch (d.kind) {
      case 'percent':      return `${d.value}% off`;
      case 'flat':         return `$${d.value} off`;
      case 'new_price':    return `$${d.value} each`;
      case 'penny':        return 'Penny deal — $0.01';
      case 'bogo':         return `Buy ${d.buyQty}, get ${d.getQty}`;
      case 'bundle':       return `${d.bundleSize}-item bundle`;
      case 'cart_subtotal':return 'Cart-wide discount';
      default:             return 'Limited time offer';
    }
  }

  get activeBogo(): BogoDiscount | null {
    return this.discounts.find(
      (d): d is BogoDiscount => d.kind === 'bogo'
    ) ?? null;
  }

  get isBuyProduct(): boolean {
    return this.activeBogo?.role === 'buy';
  }

  get isRewardProduct(): boolean {
    return this.activeBogo?.role === 'get';
  }

  private loadBogoRelatedProducts(): void {
    this.bogoRelatedProducts = [];

    const bogo = this.activeBogo;
    if (!bogo || !this.product) return;

    // BUY PRODUCT → load reward
    if (bogo.role === 'buy' && bogo.getProductId) {
      this.productService
        .getProductsByIds([String(bogo.getProductId)])
        .pipe(take(1))
        .subscribe(p => {
          this.bogoRelatedProducts = p;
        });
    }

    // FREE PRODUCT → load qualifying buy items
    if (bogo.role === 'get') {
      this.productService.products$
        .pipe(take(1))
        .subscribe(allProducts => {
          this.bogoRelatedProducts = allProducts.filter(p =>
            p.discounts?.some(d =>
              d.kind === 'bogo' &&
              d.role === 'buy' &&
              d.getProductId === this.product!.id
            )
          );
        });
    }
  }


  addSingleToCart(p: Product, qty = 1) {
    this.cartService.addToCart({
      id: p.id,
      posProductId: p.posProductId,
      id_batch: p.id_batch,
      quantity: qty,
      discountNote: null
    });
  }

  isDealItemAdded(productId: string | number): boolean {
    return this.addedDealProductIds.has(String(productId));
  }

  addDealItemToCart(p: Product, qty = 1) {
    const id = String(p.id);

    if (this.addedDealProductIds.has(id)) return;

    this.cartService.addToCart({
      id: p.id,
      posProductId: p.posProductId,
      id_batch: p.id_batch,
      quantity: qty,
      discountNote: null
    });

    // ✅ Mark as added immediately
    this.addedDealProductIds.add(id);
  }

  get activePriceDeal(): PriceDiscount | null {
    // Only treat percent/flat as “cart deal” when it has a minQty requirement
    const d = this.priceDiscount;
    const minQty = d?.minQty ?? (d as any)?.rule?.minQty;
    if (!d) return null;
    if (!minQty || minQty <= 1) return null; // if it’s just a straight markdown, don’t show “buy X” UI
    return d;
  }

  get isCartDeal(): boolean {
    return !!this.activePriceDeal;
  }

  get cartDealMinQty(): number {
    const d = this.activePriceDeal;
    return (d?.minQty ?? (d as any)?.rule?.minQty ?? 1) as number;
  }

  private loadDealRelatedProducts(): void {
    this.dealRelatedProducts = [];

    const deal = this.activePriceDeal;
    if (!deal) return;

    const minQty = deal.minQty ?? (deal as any)?.rule?.minQty ?? 1;

    const signature = (d: any) =>
      [
        d?.kind,
        d?.value,
        d?.minQty ?? d?.rule?.minQty ?? 1,
        (d?.name || '').toLowerCase().trim(),
      ].join('|');

    const targetSig = signature(deal);

    this.productService.products$
      .pipe(take(1))
      .subscribe(all => {
        const currentId = String(this.product!.id);

        this.dealRelatedProducts = all.filter(p =>
          String(p.id) !== currentId &&   // ✅ EXCLUDE current product
          (p.discounts || []).some((dd: any) => signature(dd) === targetSig)
        );
      });
  }


  get isDoseBased(): boolean {
    return this.availableWeights.some(w => w.unit === 'mg');
  }

  weightKey(w: WeightOption): string {
    return `${w.value}-${w.unit}`;
  }

  get potencyEntries() {
    if (!this.product?.['potency']) return [];

    const p = this.product['potency'];

    return [
      { label: 'Total THC', value: p.totalThc },
      { label: 'THC', value: p.thc },
      { label: 'THCa', value: p.thca },
      { label: 'CBD', value: p.cbd },
      { label: 'CBDa', value: p.cbda },
    ].filter(x => x.value && x.value > 0);
  }

  get sortedTerpenes() {
    if (!this.product?.['terpenes']?.length) return [];
    return [...this.product['terpenes']].sort((a, b) => b.value - a.value);
  }

  get dominantTerpene() {
    return this.sortedTerpenes[0] || null;
  }

  get totalTerpenesDisplay() {
    return this.product?.['totalTerpenes']
      ? `${this.product['totalTerpenes']}%`
      : null;
  }

  get terpeneChartData() {
    return this._terpeneChartData;
  }

  private buildTerpeneChart(): TerpeneChartItem[] {
    const terpenes = this.sortedTerpenes;
    if (!terpenes.length) return [];

    const total = terpenes.reduce((sum, t) => sum + t.value, 0);

    let cumulative = 0;

    return terpenes.map(t => {
      const percent = total > 0 ? (t.value / total) * 100 : 0;
      const offset = cumulative;
      cumulative += percent;

      return {
        ...t,
        percent,
        offset
      };
    });
  }


}
