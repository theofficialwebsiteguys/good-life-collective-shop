import { ChangeDetectorRef, Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CartItem, CartService } from '../../services/cart.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AeropayService } from '../../services/aeropay.service';
import { openWidget } from 'aerosync-web-sdk';
import { LoadingController, ToastController } from '@ionic/angular';
import { CapacitorHttp } from '@capacitor/core';
import { SettingsService } from '../../services/settings.service';
import { AiqTiersComponent, Discount } from '../aiq-tiers/aiq-tiers.component';
import { AiqService, AppliedDiscount } from '../../services/aiq.service';

@Component({
  selector: 'lib-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, AiqTiersComponent],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent {
  userInfo: any;
  orderType = 'pickup';
  paymentMethod = 'cash';
  cartItems: CartItem[] = [];
  deliveryAddress = {
    street: '',
    apt: '',
    city: '',
    zip: '',
    state: 'NY', // Default to New York and cannot be changed
  };

  minDate: string = '';

  originalSubtotal: number = 0;
  finalSubtotal = 0;
  finalTax = 0;
  finalTotal = 0;
  finalTotalWithoutTip = 0;
  selectedPaymentMethod: string = 'cash';

  selectedOrderType: string = 'pickup';
  pointValue: number = 0.025;

  enableDelivery: boolean = false;

  deliveryHoursByDay: { [key: number]: { start: number; end: number } } = {
    0: { start: 11, end: 21 }, // Sunday
    1: { start: 8, end: 22 }, // Monday
    2: { start: 8, end: 22 }, // Tuesday
    3: { start: 8, end: 22 }, // Wednesday
    4: { start: 8, end: 22 }, // Thursday
    5: { start: 8, end: 23 }, // Friday
    6: { start: 10, end: 23 }, // Saturday
  };

  selectedDeliveryDate: string | null = null;
  selectedDeliveryTime: string = '';

  deliverySchedule: { day: string; startTime: string; endTime: string }[] = [];
  validDeliveryDates: string[] = [];

  deliveryAddressValid: boolean = false;

  isGuest: boolean = true;

  timeOptions: { value: string; display: string }[] = [];

  currentLocationKey: string | null = null;

  pointsToRedeem: number = 0;
  redemptionOptions: { points: number; value: number; display: string }[] = [];

  isLoading: boolean = false;

  deliveryMin: number = 0;
  deliveryFee: number = 0;

  pointsEarnRate = 1; // points per $1 spent
  pointsRedeemValue = 0.025; // $/point (default fallback)
  maxPercentOff = 50; // % cap on discount from points

  appliedPointsDollar = 0; // how much of the points value we actually used (after cap)

  taxRate = 0.13;
  locationState = 'NY';

  lowestDeliveryMin: number | null = null;
  zonesPreviewLoaded = false;

  tipPercentOptions = [
    { label: '10%', value: 0.1 },
    { label: '15%', value: 0.15 },
    { label: '20%', value: 0.2 },
  ];

  // --- TIP ---
  selectedTipPercent: number | null = null;

  // custom dollar tip
  isCustomTip = false;
  customTipAmountInput = ''; // string for typing
  customTipAmount = 0; // number used for math

  discounts: Discount[] = [];

  appliedAiqReward: AppliedDiscount | null = null;

  isCartLoading = true;

  constructor(
    private loadingController: LoadingController,
    private toastController: ToastController,
    private aeropayService: AeropayService,
    private authService: AuthService,
    private cartService: CartService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private settingsService: SettingsService,
    private aiqService: AiqService
  ) {}

  ngAfterViewInit(): void {
    // Wait a little to allow browser autofill to apply
    setTimeout(() => {
      this.cdr.detectChanges(); // force Angular to re-evaluate bindings
    }, 500);
  }

  async ngOnInit() {
    const saved = localStorage.getItem('checkoutState');

    if (saved) {
      const state = JSON.parse(saved);

      this.userInfo = state.userInfo || this.userInfo;
      this.selectedOrderType = state.selectedOrderType || 'pickup';
      this.selectedPaymentMethod = state.selectedPaymentMethod || 'cash';
      this.deliveryAddress = state.deliveryAddress || this.deliveryAddress;
      this.selectedDeliveryDate = state.selectedDeliveryDate;
      this.selectedDeliveryTime = state.selectedDeliveryTime;
      this.selectedTipPercent = state.selectedTipPercent;
      this.customTipAmount = state.customTipAmount;
      this.isCustomTip = state.isCustomTip;
    }

    this.isCartLoading = true;

    let firstEmission = true;

    this.cartService.cart$.subscribe(cart => {
      this.cartItems = cart;
      this.updateTotals();

      if (firstEmission) {
        firstEmission = false;
        this.isCartLoading = false;
      }
    });
    this.userInfo = this.authService.getCurrentUser();
    this.currentLocationKey =
      this.settingsService.getSelectedLocationKey()?.toLowerCase() || null;
    this.locationState = this.settingsService.getSelectedLocationState();
    this.taxRate = this.settingsService.getSelectedTaxRate();
    this.discounts = await this.settingsService.getDiscounts();

    this.aiqService.appliedDiscount$.subscribe(reward => {
      this.appliedAiqReward = reward;
      this.updateTotals();
    });

    if (!this.userInfo) {
      this.isGuest = true;
      this.userInfo = {
        fname: '',
        lname: '',
        email: '',
        phone: '',
        dob: '',
      };
    } else {
      this.isGuest = false;
    }
    this.authService.validateSession();

    await this.loadLoyaltyAndInitTotals();
    // this.calculateDefaultTotals();
    this.checkDeliveryEligibility();
    try {
      const zonePreview = await this.cartService.getDeliveryZone();

      console.log('Delivery Zone Preview:', zonePreview);

      // 1️⃣ Prefer zones array if present
      if (Array.isArray(zonePreview.zones) && zonePreview.zones.length) {
        this.lowestDeliveryMin = Math.min(
          ...zonePreview.zones
            .map((z: any) => Number(z.deliveryMin))
            .filter((v: any) => !isNaN(v)),
        );
      }
      // 2️⃣ Fallback to legacy single-zone structure
      else if (typeof zonePreview.deliveryMin === 'number') {
        this.lowestDeliveryMin = zonePreview.deliveryMin;
      } else {
        this.lowestDeliveryMin = null;
      }

      this.zonesPreviewLoaded = true;
    } catch (err) {
      console.error('Failed to load delivery preview', err);
    }

    // try {
    //   const res: any = await this.cartService.getDeliveryZone();

    //   this.deliveryMin = res.deliveryMin;
    //   this.deliveryFee = res.deliveryFee;

    //   if (res.schedule) {
    //     this.deliverySchedule = res.schedule;

    //     const availableDates = this.getAvailableDeliveryDates(res.schedule);
    //     this.validDeliveryDates = availableDates;

    //     if (availableDates.length === 0) {
    //       this.presentToast('No available delivery days found.', 'danger');
    //       return;
    //     }

    //     // Set first available date
    //     this.selectedDeliveryDate = availableDates[0];

    //     const [year, month, day] = this.selectedDeliveryDate.split('-').map(Number);
    //     const selectedDate = new Date(year, month - 1, day); // Local midnight
    //     const dayOfWeek = selectedDate.getDay(); // 0 = Sunday
    //     this.generateTimeOptionsFromSchedule(dayOfWeek);
    //     // setTimeout(() => {
    //     //   this.selectNearestFutureTime(selectedDate, dayOfWeek);
    //     // }, 50);
    //   }
    // } catch (err) {
    //   console.error('Failed to load delivery zone', err);
    //   this.presentToast('Unable to load delivery schedule.', 'danger');
    // }

    // Set min selectable date
    const now = new Date();
    this.minDate = now.toISOString().split('T')[0];
  }

  get isTaxIncludedLocation(): boolean {
    // Oregon (and any other future tax-included states)
    return (this.locationState || '').toUpperCase() === 'OR';
  }

  getDealText(item: CartItem): string {
    const d = item.discounts?.[0];
    if (!d) return '';

    switch (d.kind) {
      case 'percent':
        return `${d.name} - ${d.value}% off`;
      case 'flat':
        return `${d.name} - $${d.value} off`;
      case 'bogo':
        return `${d.name} - Buy ${d.buyQty} Get ${d.getQty}`;
      case 'bundle':
        return d.description ?? 'Bundle Deal';
      default:
        return '';
    }
  }

  getDiscounts(item: CartItem) {
    return item.discounts ?? [];
  }

  // getUnitPrice(item: CartItem): number {
  //   const base = this.toNumber(item.price);
  //   const discount = this.getDiscounts(item).find(
  //     d => d.kind === 'percent' || d.kind === 'flat'
  //   );

  //   if (!discount) return base;

  //   if (discount.kind === 'percent') {
  //     return base - base * (discount.value / 100);
  //   }

  //   if (discount.kind === 'flat') {
  //     return Math.max(base - discount.value, 0);
  //   }

  //   return base;
  // }

  // getItemTotal(item: CartItem): number {
  //   const qty = item.quantity;
  //   const unit = this.getUnitPrice(item);

  //   const bogo = this.getDiscounts(item).find(d => d.kind === 'bogo');
  //   if (!bogo) return unit * qty;

  //   const setSize = bogo.buyQty + bogo.getQty;
  //   const fullSets = Math.floor(qty / setSize);
  //   const remainder = qty % setSize;

  //   const paidUnits =
  //     fullSets * bogo.buyQty + Math.min(remainder, bogo.buyQty);

  //   return paidUnits * unit;
  // }

  private async loadLoyaltyAndInitTotals(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.settingsService.fetchLoyaltyConfig().subscribe({
        next: (response) => {
          this.pointsEarnRate = response.pointsEarnRate;
          this.pointsRedeemValue = response.pointsRedeemValue;
          this.maxPercentOff = response.maxPercentOff;
          this.pointValue = this.pointsRedeemValue;

          // 🟢 Now that loyalty data is ready, calculate totals + redemption options
          this.generateRedemptionOptions();
          this.updateTotals();

          resolve();
        },
        error: (error) => {
          console.error('Error loading loyalty config:', error);

          // fallback defaults
          this.pointsEarnRate = 0;
          this.pointsRedeemValue = 0.025;
          this.maxPercentOff = 0;
          this.updateTotals();
          this.generateRedemptionOptions();
          resolve();
        },
      });
    });
  }

  //   generateRedemptionOptions(): void {
  //   this.redemptionOptions = [];
  //   const availablePoints = this.userInfo.points || 0;
  //   const increment = 200; // adjust for your store

  //   const maxPointsToRedeem = this.finalSubtotal / this.pointValue;
  //   const effectiveMaxPoints = Math.min(availablePoints, maxPointsToRedeem);

  //   this.redemptionOptions.push({ points: 0, value: 0, display: 'None' });

  //   for (let i = increment; i <= effectiveMaxPoints; i += increment) {
  //     const value = i * this.pointValue;
  //     this.redemptionOptions.push({ points: i, value, display: `${i} points` });
  //   }

  //   if (effectiveMaxPoints % increment !== 0 && effectiveMaxPoints > 0) {
  //     const remainingValue = effectiveMaxPoints * this.pointValue;
  //     const roundedPoints = Math.floor(effectiveMaxPoints);
  //     this.redemptionOptions.push({
  //       points: roundedPoints,
  //       value: remainingValue,
  //       display: `${roundedPoints} points`
  //     });
  //   }
  // }
  // generateRedemptionOptions(): void {
  //   this.redemptionOptions = [];

  //   const availablePoints = Number(this.userInfo.points || 0);
  //   const increment = 100;
  //   const minRequired = 100;

  //   if (availablePoints < minRequired) {
  //     this.redemptionOptions.push({ points: 0, value: 0, display: 'None' });
  //     return;
  //   }

  //   const subtotal = this.getDiscountedSubtotal();

  //   // 🔹 Step 1: Calculate max $ off based on maxPercentOff cap
  //   console.log(this.maxPercentOff)
  //   const dollarCap =
  //     this.maxPercentOff > 0 ? subtotal * (this.maxPercentOff / 100) : subtotal;

  //   // 🔹 Step 2: Convert that to points
  //   const pointsCap =
  //     this.pointsRedeemValue > 0 ? Math.floor(dollarCap / this.pointsRedeemValue) : 0;

  //   // 🔹 Step 3: Final usable max = whichever is smaller: balance or cap
  //   const effectiveMaxPoints = Math.min(availablePoints, pointsCap);

  //   console.log('Subtotal:', subtotal);
  //   console.log('Dollar cap (max % off):', dollarCap);
  //   console.log('Points cap:', pointsCap);
  //   console.log('Effective max points user can use:', effectiveMaxPoints);

  //   // Always include “None”
  //   this.redemptionOptions.push({ points: 0, value: 0, display: 'None' });

  //   // 🔹 Step 4: Add options up to that cap
  //   for (let i = increment; i <= effectiveMaxPoints; i += increment) {
  //     const value = i * this.pointsRedeemValue;
  //     this.redemptionOptions.push({
  //       points: i,
  //       value,
  //       display: `${i} points ($${value.toFixed(2)} off)`
  //     });
  //   }

  //   // 🔹 Step 5: Add exact max option if not a clean increment
  //   if (effectiveMaxPoints % increment !== 0 && effectiveMaxPoints > 0) {
  //     const roundedPoints = effectiveMaxPoints;
  //     const value = roundedPoints * this.pointsRedeemValue;
  //     this.redemptionOptions.push({
  //       points: roundedPoints,
  //       value,
  //       display: `${roundedPoints} points ($${value.toFixed(2)} off)`
  //     });
  //   }
  // }

  generateRedemptionOptions(): void {
    this.redemptionOptions = [];

    const availablePoints = Number(this.userInfo.points || 0);
    const increment = 100;
    const minRequired = 100;

    // If user does NOT meet minimum → Only show "None"
    if (availablePoints < minRequired) {
      this.redemptionOptions.push({
        points: 0,
        value: 0,
        display: 'None',
      });
      return;
    }

    // const subtotal = this.getDiscountedSubtotal();
    const subtotal = this.getCartSubtotal();

    // Max $ discount allowed by % cap
    const dollarCap =
      this.maxPercentOff > 0 ? subtotal * (this.maxPercentOff / 100) : subtotal;

    // Convert dollar cap → points
    const pointsCap =
      this.pointsRedeemValue > 0
        ? Math.floor(dollarCap / this.pointsRedeemValue)
        : 0;

    // Actual max points user can apply
    const effectiveMaxPoints = Math.min(availablePoints, pointsCap);

    // Always add "None" first
    this.redemptionOptions.push({
      points: 0,
      value: 0,
      display: 'None',
    });

    // Add ONLY clean 100-point increments
    for (let p = increment; p <= effectiveMaxPoints; p += increment) {
      this.redemptionOptions.push({
        points: p,
        value: p * this.pointsRedeemValue,
        display: `${p} points`,
      });
    }
  }

  selectPoints(points: number): void {
    this.pointsToRedeem = points;
    this.updateTotals();
  }

  get maxRedeemablePoints(): number {
    const maxPoints = Math.min(
      this.userInfo.points,
      this.originalSubtotal * 20,
    );
    return Math.ceil(maxPoints);
  }

  // updateTotals() {
  //   const pointsValue = this.pointsToRedeem * this.pointValue;
  //   this.originalSubtotal = this.cartItems.reduce(
  //     (total: number, item: any) => total + (item.price * item.quantity),
  //     0
  //   );
  //    this.finalSubtotal = this.cartItems.reduce((total, item) => {
  //       // base price (use discounted price if available)
  //       let price = parseFloat(item.discountedPrice as any) || parseFloat(item.price as any) || 0;

  //       // 🟢 Handle BOGO (Buy X Get Y % off)
  //       if (Array.isArray(item.bogoRules) && item.bogoRules.length > 0) {
  //         const rule = item.bogoRules[0];

  //         const buyQty = rule.buy_quantity || 1;
  //         const getQty = rule.get_quantity || 0;
  //         const discountValue = rule.discount_value || rule.discount_percent || 0;

  //         if (item.quantity >= buyQty + getQty && discountValue > 0) {
  //           // full sets of "buy + get"
  //           const setCount = Math.floor(item.quantity / (buyQty + getQty));

  //           // discounted items
  //           const discountedItems = setCount * getQty;

  //           // discount can be flat ($) or percent
  //           const discountPerItem = rule.discount_type === 'flat'
  //             ? discountValue
  //             : (price * (discountValue / 100));

  //           const discountedTotal = discountedItems * (price - discountPerItem);
  //           const regularTotal = (item.quantity - discountedItems) * price;
  //           return total + discountedTotal + regularTotal;
  //         }
  //       }

  //       // fallback: standard discount or no discount
  //       return total + price * item.quantity;
  //     }, 0) - pointsValue;

  //   // this.finalSubtotal = this.originalSubtotal - pointsValue;
  //   if (this.finalSubtotal < 0) this.finalSubtotal = 0;
  //   this.finalTax = this.finalSubtotal * 0.13;
  //   if (this.selectedOrderType === 'delivery') {
  //     this.finalTotal =
  //       Number(this.finalSubtotal) + Number(this.finalTax) + Number(this.deliveryFee || 0);
  //   } else {
  //     this.finalTotal = this.finalSubtotal + this.finalTax;
  //   }
  //   // if(this.finalTotal >= 90 ){
  //   //   this.enableDelivery = true;
  //   // }

  // }

  updateTotals() {
    // const discountedSubtotal = this.getDiscountedSubtotal();
    const discountedSubtotal = this.getCartSubtotal();


    const aiqDiscount = this.getAiqRewardDiscount(discountedSubtotal);

    // Points → dollars
    const pointsDollarValue =
      this.pointsToRedeem * (this.pointsRedeemValue ?? this.pointValue);

    // Cap based on max % off
    const maxDollarOff =
      this.maxPercentOff > 0
        ? discountedSubtotal * (this.maxPercentOff / 100)
        : discountedSubtotal;

    const appliedPoints = Math.min(
      pointsDollarValue,
      maxDollarOff,
      discountedSubtotal,
    );

    this.appliedPointsDollar = appliedPoints;

    // Original subtotal (pre-discount, for reference only)
    this.originalSubtotal = this.cartItems.reduce(
      (sum, item) => sum + this.toNumber(item.price) * item.quantity,
      0,
    );

    // this.finalSubtotal = Math.max(0, discountedSubtotal - appliedPoints);
    this.finalSubtotal = Math.max(
      0,
      discountedSubtotal - aiqDiscount - appliedPoints
    );

    const shouldChargeTax = !this.isTaxIncludedLocation;

    this.finalTax = shouldChargeTax ? this.finalSubtotal * this.taxRate : 0;

    this.finalTotalWithoutTip =
      this.selectedOrderType === 'delivery'
        ? +(
            this.finalSubtotal +
            this.finalTax +
            Number(this.deliveryFee || 0)
          ).toFixed(2)
        : +(this.finalSubtotal + this.finalTax).toFixed(2);

    const tip = this.tipAmount || 0;

    this.finalTotal = +(this.finalTotalWithoutTip + tip).toFixed(2);
    this.saveCheckoutState();

    // this.finalTotal =
    //   this.selectedOrderType === 'delivery'
    //     ? this.finalSubtotal + this.finalTax + Number(this.deliveryFee || 0)
    //     : this.finalSubtotal + this.finalTax;
  }

  // ✅ BOGO-aware subtotal BEFORE applying any points
  // private getDiscountedSubtotal(): number {
  //   return this.cartItems.reduce((total, item) => {
  //     let price = parseFloat(item.discountedPrice as any) || parseFloat(item.price as any) || 0;

  //     if (Array.isArray(item.bogoRules) && item.bogoRules.length > 0) {
  //       const rule = item.bogoRules[0];
  //       const buyQty = rule.buy_quantity || 1;
  //       const getQty = rule.get_quantity || 0;
  //       const discountValue = rule.discount_value || rule.discount_percent || 0;

  //       if (item.quantity >= buyQty + getQty && discountValue > 0) {
  //         const setCount = Math.floor(item.quantity / (buyQty + getQty));
  //         const discountedItems = setCount * getQty;

  //         const discountPerItem =
  //           rule.discount_type === 'flat'
  //             ? discountValue
  //             : (price * (discountValue / 100));

  //         const discountedTotal = discountedItems * (price - discountPerItem);
  //         const regularTotal = (item.quantity - discountedItems) * price;
  //         return total + discountedTotal + regularTotal;
  //       }
  //     }

  //     return total + price * item.quantity;
  //   }, 0);
  // }

  // private getDiscountedSubtotal(): number {
  //   return this.cartItems.reduce((sum, item) => sum + item.lineTotal, 0);
  // }
  private getCartSubtotal(): number {
    return this.cartService.getCartSubtotal(this.cartItems);
  }

  checkDeliveryEligibility() {
    this.cartService.checkDeliveryEligibility().subscribe({
      next: (response) => {
        //remove false indicator
        this.enableDelivery = response.deliveryAvailable;
        // console.log('Delivery availability:', this.enableDelivery);
      },
      error: (error) => {
        console.error('Error fetching delivery eligibility:', error);
        this.enableDelivery = false; // Fallback if the request fails
      },
    });
  }

  getLoyalty() {
    this.settingsService.fetchLoyaltyConfig().subscribe({
      next: (response) => {
        this.pointsEarnRate = response.pointsEarnRate;
        this.pointsRedeemValue = response.pointsRedeemValue;
        this.maxPercentOff = response.maxPercentOff;
        this.pointValue = this.pointsRedeemValue;
      },
      error: (error) => {
        console.error('Error:', error);
      },
    });
  }

  //   calculateDefaultTotals() {
  //   this.originalSubtotal = this.cartItems.reduce(
  //     (total: number, item: any) => total + (this.toNumber(item.price) * item.quantity),
  //     0
  //   );

  //   /* ---------------------------------------------------------
  //      🔥 BUNDLE LOGIC (same as getDiscountedSubtotal)
  //   --------------------------------------------------------- */
  //   let bundleCount = 0;
  //   let bundleIds: string[] = [];

  //   const bundleItems = this.cartItems.filter(i => i.discountType === "bundle");

  //   if (bundleItems.length > 0 && bundleItems[0].bundleProducts) {
  //     bundleIds = bundleItems[0].bundleProducts.map(id => String(id));

  //     const quantities = bundleIds.map(id => {
  //       const match = this.cartItems.find(i => String(i.id) === id);
  //       return match?.quantity ?? 0;
  //     });

  //     bundleCount = Math.min(...quantities);
  //   }

  //   let subtotalBeforeBundle = 0;

  //   this.cartItems.forEach(item => {
  //     const price =
  //       parseFloat(item.discountedPrice as any) ||
  //       parseFloat(item.price as any) || 0;

  //     const isBundleItem =
  //       item.discountType === "bundle" &&
  //       bundleIds.includes(String(item.id));

  //     if (isBundleItem) {
  //       const leftoverQty = item.quantity - bundleCount;
  //       if (leftoverQty > 0) subtotalBeforeBundle += leftoverQty * price;
  //       return;
  //     }

  //     // BOGO logic still here
  //     if (Array.isArray(item.bogoRules) && item.bogoRules.length > 0) {
  //       const rule = item.bogoRules[0];
  //       const buyQty = rule.buy_quantity || 1;
  //       const getQty = rule.get_quantity || 0;
  //       const discountValue = rule.discount_value || rule.discount_percent || 0;

  //       if (item.quantity >= buyQty + getQty && discountValue > 0) {
  //         const setCount = Math.floor(item.quantity / (buyQty + getQty));
  //         const discountedItems = setCount * getQty;
  //         const discountPerItem =
  //           rule.discount_type === 'flat'
  //             ? discountValue
  //             : price * (discountValue / 100);

  //         const discountedTotal = discountedItems * (price - discountPerItem);
  //         const regularTotal = (item.quantity - discountedItems) * price;

  //         subtotalBeforeBundle += discountedTotal + regularTotal;
  //         return;
  //       }
  //     }

  //     subtotalBeforeBundle += price * item.quantity;
  //   });

  //   const bundleDiscount =
  //     bundleCount > 0
  //       ? bundleCount * Number(bundleItems[0]?.discountValue || 0)
  //       : 0;

  //   this.finalSubtotal = subtotalBeforeBundle + bundleDiscount;
  //   /* --------------------------------------------------------- */

  //   this.finalTax = this.finalSubtotal * 0.13;
  //   this.finalTotal = this.finalSubtotal + this.finalTax;
  // }

  // calculateDefaultTotals() {
  //   this.originalSubtotal = this.cartItems.reduce(
  //     (total: number, item: any) => total + (this.toNumber(item.price) * item.quantity),
  //     0
  //   );

  //       this.finalSubtotal = this.cartItems.reduce((total, item) => {
  //         // base price (use discounted price if available)
  //         let price = parseFloat(item.discountedPrice as any) || parseFloat(item.price as any) || 0;

  //         // 🟢 Handle BOGO (Buy X Get Y % off)
  //         if (Array.isArray(item.bogoRules) && item.bogoRules.length > 0) {
  //           const rule = item.bogoRules[0];

  //           const buyQty = rule.buy_quantity || 1;
  //           const getQty = rule.get_quantity || 0;
  //           const discountValue = rule.discount_value || rule.discount_percent || 0;

  //           if (item.quantity >= buyQty + getQty && discountValue > 0) {
  //             // full sets of "buy + get"
  //             const setCount = Math.floor(item.quantity / (buyQty + getQty));

  //             // discounted items
  //             const discountedItems = setCount * getQty;

  //             // discount can be flat ($) or percent
  //             const discountPerItem = rule.discount_type === 'flat'
  //               ? discountValue
  //               : (price * (discountValue / 100));

  //             const discountedTotal = discountedItems * (price - discountPerItem);
  //             const regularTotal = (item.quantity - discountedItems) * price;
  //             return total + discountedTotal + regularTotal;
  //           }
  //         }

  //         // fallback: standard discount or no discount
  //         return total + price * item.quantity;
  //       }, 0);

  //   // this.finalSubtotal = this.originalSubtotal;
  //   this.finalTax = this.finalSubtotal * 0.13;
  //   this.finalTotal = this.finalSubtotal + this.finalTax;
  // }

  toNumber(value: string | number): number {
    return typeof value === 'number' ? value : parseFloat(value) || 0;
  }

  async placeOrder() {
    if (this.selectedOrderType === 'delivery') {
      // Prevent missing time selection
      if (!this.selectedDeliveryDate || !this.selectedDeliveryTime) {
        this.showError('Please select a delivery date and time.');
        this.isLoading = false;
        return;
      }
    }
    this.isLoading = true;
    // const loading = await this.loadingController.create({
    //   spinner: 'crescent',
    //   message: 'Please wait while we process your order...',
    //   cssClass: 'custom-loading',
    // });
    // await loading.present();

    try {
      // const newUserData = {
      //   fname: this.userInfo.fname,
      //   lname: this.userInfo.lname,
      //   phone: this.userInfo.phone,
      //   email: this.userInfo.email,
      //   dob: '1990-01-01'
      // };

      // const alleavesResponse = await this.cartService.createAlleavesCustomer(newUserData);
      // let newAllLeavesId = '';
      // if (alleavesResponse?.id_customer) {
      //   // console.log('Alleaves Customer Created:', alleavesResponse.id_customer);
      //   newAllLeavesId = alleavesResponse.id_customer; // Save the ID
      // } else {
      //   console.warn('Failed to create Alleaves Customer');
      // }
      const user_id = this.userInfo.id;
      const points_redeem = this.appliedAiqReward?.pointsDeduction || 0;
      let pos_order_id = 0;
      let points_add = 0;

      const deliveryAddress =
        this.selectedOrderType === 'delivery'
          ? {
              address1: this.deliveryAddress.street.trim(),
              address2: this.deliveryAddress.apt
                ? this.deliveryAddress.apt.trim()
                : null,
              city: this.deliveryAddress.city.trim(),
              state: this.deliveryAddress.state.trim(),
              zip: this.deliveryAddress.zip.trim(),
              delivery_date: this.selectedDeliveryDate,
              delivery_time: this.selectedDeliveryTime,
            }
          : null;
      // if (this.selectedPaymentMethod === 'aeropay' && this.selectedBankId) {
      //   this.aeropayService.fetchUsedForMerchantToken(this.aeropayUserId).subscribe({
      //     next: async (response: any) => {
      //       const transactionResponse = await this.aeropayService.createTransaction(
      //         this.finalTotal.toFixed(2), // Convert total to string
      //         this.selectedBankId
      //       ).toPromise();

      //       if (!transactionResponse.data || !transactionResponse.data.success) {
      //         console.error('AeroPay Transaction Failed:', transactionResponse.data);
      //         this.showError('Payment failed. Please try again.');
      //         //this.isLoading = false;
      //         // await loading.dismiss();
      //         this.isLoading = false;
      //         return;
      //       }

      //       this.presentToast('Payment successful!', 'success');
      //     },
      //     error: (error: any) => {
      //       console.log('Error:', error);
      //       this.showError('Error');
      //     }
      //   });

      // }

      if (this.selectedPaymentMethod === 'aeropay' && this.selectedBankId) {
        try {
          await this.aeropayService
            .fetchUsedForMerchantToken(this.aeropayUserId)
            .toPromise();
          const tip = this.tipAmount;

          const transactionResponse = await this.aeropayService
            .createTransaction(
              this.finalTotalWithoutTip.toFixed(2),
              //this.finalTotal.toFixed(2),
              this.selectedBankId,
              tip,
            )
            .toPromise();

          if (!transactionResponse?.data?.success) {
            console.error(
              'AeroPay Transaction Failed:',
              transactionResponse?.data,
            );
            await this.showError('Payment failed. Please try again.');
            this.isLoading = false;
            return; // 🚫 STOP further execution
          }

          this.presentToast('Payment successful!', 'success');
        } catch (error) {
          console.error('AeroPay Error:', error);
          await this.showError('Payment error. Please try again.');
          this.isLoading = false;
          return;
        }
      }

      this.cartItems = this.cartItems.map((item) => ({
        ...item,
        discountNote: this.getItemDiscountNote(item),
      }));

      // Build a summary for the entire cart
      const cartDiscountNote = this.getCartDiscountSummary(this.cartItems);

      // Capture totals BEFORE checkout() clears the cart, which triggers
      // cart$ to emit [] and resets finalTotal to 0 synchronously.
      const orderTotal = this.finalTotal;
      const cartSnapshot = [...this.cartItems];

      const response = await this.cartService.checkout(
        this.getPointsRedeemInPennies(),
        this.selectedOrderType,
        deliveryAddress,
        this.userInfo,
        cartDiscountNote,
        cartSnapshot,
        this.deliveryFee,
      );
      pos_order_id = response.orderId;
      points_add = orderTotal * this.pointsEarnRate;

      const customer_name = this.userInfo.fname + ' ' + this.userInfo.lname;
      const customer_email = this.userInfo.email;
      const customer_phone = this.userInfo.phone;
      const customer_dob = this.userInfo.dob;

      await this.cartService.placeOrder(
        user_id,
        pos_order_id,
        points_redeem ? 0 : points_add,
        points_redeem,
        orderTotal,
        cartSnapshot,
        this.userInfo.email,
        customer_name,
        customer_email,
        customer_phone,
        customer_dob,
        this.selectedOrderType,
      );

      if (points_redeem > 0) {
        this.authService.deductPoints(points_redeem);
      }

      ////this.orderPlaced.emit();
      this.cartService.clearCart();
      this.router.navigate(['/confirmation']);

      // const userOrders = await this.authService.getUserOrders(); // ✅ Ensure this is awaited

      //this.accessibilityService.announce('Your order has been placed successfully.', 'polite');
    } catch (error: any) {
      console.error('Error placing order:', error);
      await this.showError(
        'Error placing order: ' + JSON.stringify(error.message),
      );
      //this.accessibilityService.announce('There was an error placing your order. Please try again.', 'polite');
    } finally {
      //this.isLoading = false;
      // console.log('Cleanup complete: Destroying subscription');
      localStorage.removeItem('checkoutState');
      this.isLoading = false;
    }
  }

  private getPointsRedeemInPennies(): number {
    if (!this.pointsToRedeem || !this.pointsRedeemValue) return 0;

    return Math.round(this.pointsToRedeem * this.pointsRedeemValue * 100);
  }

  goBack() {
    this.router.navigate(['/cart']);
  }

  get tipAmount(): number {
    if (this.isCustomTip) {
      return this.customTipAmount;
    }

    const percent = this.selectedTipPercent ?? 0;
    return +(this.finalSubtotal + this.finalTax) * percent;
  }

  selectTipPercent(percent: number) {
    if (this.selectedTipPercent === percent) {
      this.selectedTipPercent = null;
      this.updateTotals();
      return;
    }
    this.isCustomTip = false;
    this.selectedTipPercent = percent;
    this.customTipAmountInput = '';
    this.customTipAmount = 0;
    this.updateTotals();
    this.saveCheckoutState();
  }

  enableCustomTipPercent() {
    this.isCustomTip = true;
    this.selectedTipPercent = null;
    this.customTipAmountInput = '';
    this.customTipAmount = 0;
    this.updateTotals();
  }

  onCustomTipAmountChange(value: string) {
    // allow empty while typing
    if (value === '') {
      this.customTipAmount = 0;
      this.updateTotals();
      return;
    }

    const numeric = Number(value);

    if (isNaN(numeric) || numeric < 0) return;

    // optional hard cap (example $100)
    this.customTipAmount = Math.min(numeric, 100);
    this.updateTotals();
    this.saveCheckoutState();
  }

  async onAddressInputChange() {
    const { street, city, zip } = this.deliveryAddress;

    this.deliveryAddressValid = false;

    if (!street?.trim() || !city?.trim() || zip?.trim().length < 3) {
      return;
    }

    const fullAddress = `${street.trim()}, ${city.trim()}, NY ${zip.trim()}`;

    try {
      const result: any =
        await this.cartService.checkAddressInZone(fullAddress);

      if (!result?.inZone) {
        this.showError('This address is outside the delivery zone.');
        this.deliveryAddressValid = false;
        this.enableDelivery = false;
        return;
      }

      // 🟢 Normalize zone (NEW + LEGACY)
      const zone = result.zone ?? {
        deliveryMin: result.deliveryMin ?? 0,
        deliveryFee: result.deliveryFee ?? 0,
        schedule: result.schedule ?? [],
      };

      this.deliveryAddressValid = true;
      this.enableDelivery = true;

      this.deliveryMin = Number(zone.deliveryMin || 0);
      this.deliveryFee = Number(zone.deliveryFee || 0);

      // ✅ normalize schedule defensively
      this.deliverySchedule = Array.isArray(zone.schedule) ? zone.schedule : [];

      // 🔥 RESET dependent state
      this.validDeliveryDates = [];
      this.selectedDeliveryDate = null;
      this.selectedDeliveryTime = '';
      this.timeOptions = [];

      // 🔁 regenerate dates
      this.validDeliveryDates = this.getAvailableDeliveryDates(
        this.deliverySchedule,
      );

      if (!this.validDeliveryDates.length) {
        this.showError('No delivery times available for this address.');
        return;
      }

      // auto-select first valid date
      this.selectedDeliveryDate = this.validDeliveryDates[0];

      // generate times
      const dayOfWeek = new Date(this.selectedDeliveryDate).getDay();
      this.generateTimeOptionsFromSchedule(dayOfWeek);

      // force UI refresh
      this.cdr.detectChanges();

      this.updateTotals();
      this.saveCheckoutState();
    } catch (err) {
      console.error('Address check error:', err);
      this.showError('Failed to verify delivery address.');
    }
  }

  isFetchingAeroPay: boolean = false;

  verificationRequired: boolean = false;
  verificationCode: string = '';
  existingUserId: string = '';

  aerosyncURL: string | null = null;
  aerosyncToken: string | null = null;
  aerosyncUsername: string | null = null;
  showAerosyncWidget: boolean = false;

  userBankAccounts: any[] = []; // Store user bank accounts
  showBankSelection: boolean = false; // Control UI visibility
  selectedBankId: string | null = null; // Track selected bank
  aeropayAuthToken: string | null = null;
  bankLinked: boolean = false;
  aeropayUserId: any;
  loadingAerosync = false;
  isLinkingBank: boolean = false;

  errorMessage: string = '';

  //Aeropay
  async startAeroPayProcess() {
    if (
      !this.userInfo.fname ||
      !this.userInfo.lname ||
      !this.userInfo.phone ||
      !this.userInfo.email
    ) {
      this.selectedPaymentMethod = 'cash';
      this.showError(
        'Please fill out all contact fields before selecting AeroPay.',
      );
      this.cdr.detectChanges();
      return;
    }

    this.isFetchingAeroPay = true;

    this.aeropayService.fetchMerchantToken().subscribe({
      next: (response: any) => {
        // **Check for API errors inside the response**
        if (response.data.success === false || !response.data.token) {
          console.error('AeroPay Authentication Failed:', response.error);
          this.showError(`Authentication Error: ${response.error.message}`);
          this.isFetchingAeroPay = false;
          return; // **Exit function to prevent further execution**
        }

        this.createAeroPayUser();
      },
      error: (error: any) => {
        console.error('AeroPay Authentication Request Failed:', error);
        this.showError('Authentication request failed. Please try again.');
        this.isFetchingAeroPay = false;
      },
    });
  }

  async createAeroPayUser() {
    if (
      this.isGuest &&
      this.aeropayUserId &&
      this.userBankAccounts.length > 0
    ) {
      this.showBankSelection = true;
      return;
    }
    const userData = {
      first_name: this.userInfo.fname,
      last_name: this.userInfo.lname,
      phone_number: this.userInfo.phone,
      email: this.userInfo.email,
    };

    this.aeropayService.createUser(userData).subscribe({
      next: (response: any) => {
        this.isFetchingAeroPay = false;

        if (response.data.displayMessage) {
          this.verificationRequired = true;
          this.existingUserId = response.data.existingUser.userId; // Store userId for verification
          this.presentToast(response.data.displayMessage, 'warning');
        } else {
          if (response.data.success && response.data.user) {
            this.aeropayUserId = response.data.user.userId;

            if (this.isGuest) {
              // Skip saved banks for guests — always require fresh connection
              this.retrieveAerosyncCredentials();
            } else {
              this.userBankAccounts = response.data.user.bankAccounts || [];

              if (this.userBankAccounts.length > 0) {
                this.showBankSelection = true;
                this.selectedBankId = this.userBankAccounts[0].bankAccountId;
              } else {
                this.retrieveAerosyncCredentials();
              }
            }
          }
        }
      },
      error: (error: any) => {
        console.error('Error Creating AeroPay User:', error);
        this.showError('Error creating user. Please try again.');
        this.isFetchingAeroPay = false;
      },
    });
  }

  async verifyAeroPayUser() {
    if (!this.verificationCode.trim()) {
      this.showError('Please enter the verification code.');
      return;
    }

    this.aeropayService
      .verifyUser(this.existingUserId, this.verificationCode)
      .subscribe({
        next: (response: any) => {
          this.verificationRequired = false; // Hide verification input
          this.presentToast('Verification successful!', 'success');
          this.createAeroPayUser();
        },
        error: (error: any) => {
          console.error('Verification Failed:', error);
          this.showError('Invalid verification code. Please try again.');
        },
      });
  }

  async retrieveAerosyncCredentials() {
    this.loadingAerosync = true;
    this.aeropayService
      .fetchUsedForMerchantToken(this.aeropayUserId)
      .subscribe({
        next: (response: any) => {
          // **Check for API errors inside the response**
          if (response.data.success === false || !response.data.token) {
            console.error(
              'AeroPay Authentication Failed:',
              response.data.error,
            );
            this.showError(
              `Authentication Error: ${response.data.error.message}`,
            );
            this.loadingAerosync = false;
            return; // **Exit function to prevent further execution**
          }

          this.aeropayService.getAerosyncCredentials().subscribe({
            next: (response: any) => {
              if (response.data.success) {
                this.aerosyncURL = response.data.fastlinkURL;
                this.aerosyncToken = response.data.token;
                this.aerosyncUsername = response.data.username;

                // Open the Aerosync Widget in an in-app browser
                this.openAerosyncWidget();
              } else {
                console.error('Failed to retrieve Aerosync widget.');
              }
              this.loadingAerosync = false;
            },
            error: (error: any) => {
              console.error('Error Retrieving Aerosync Widget:', error);
              this.loadingAerosync = false;
            },
          });
        },
        error: (error: any) => {
          console.error('AeroPay Authentication Request Failed:', error);
          this.showError('Authentication request failed. Please try again.');
          this.loadingAerosync = false;
        },
      });
  }

  openAerosyncWidget() {
    if (!this.aerosyncToken) {
      console.error('Missing AeroSync Token');
      return;
    }

    let widgetRef = openWidget({
      id: 'widget',
      iframeTitle: 'Connect',
      environment: 'production', // 'production' for live
      token: this.aerosyncToken,
      style: {
        width: '375px',
        height: '688px',
        bgColor: '#000000',
        opacity: 0.7,
      },
      deeplink: '', // Leave empty if not needed
      consumerId: '', // Optional: Merchant customization

      onLoad: function () {
        console.log('AeroSync Widget Loaded');
      },
      onSuccess: (event: any) => {
        if (event.user_id && event.user_password) {
          this.linkBankToAeropay(event.user_id, event.user_password);
        } else {
          console.error('Missing user credentials in event:', event);
        }
      },
      onError: function (event) {
        console.error('AeroSync Error:', event);
      },
      onClose: function () {
        console.log('AeroSync Widget Closed');
      },
      onEvent: function (event: object, type: string): void {
        console.log(event, type);
      },
    });

    widgetRef.launch();
  }

  linkBankToAeropay(userId: string, userPassword: string) {
    this.isLinkingBank = true;
    this.aeropayService.linkBankAccount(userId, userPassword).subscribe({
      next: (response: any) => {
        this.isLinkingBank = false;
        if (response.data.success) {
          this.presentToast('Bank account linked successfully!', 'success');

          const linkedBank = response.data.userBankInfo;
          if (this.isGuest && linkedBank) {
            this.aeropayUserId = response.data.userId || this.aeropayUserId;
            this.userBankAccounts = [linkedBank];
            this.selectedBankId = linkedBank.bankAccountId;
            this.showBankSelection = true;
          } else {
            // For logged-in users, re-fetch and display all
            this.createAeroPayUser();
          }
        } else {
          this.showError('Failed to link your bank. Please try again.');
        }
      },
      error: (error: any) => {
        this.isLinkingBank = false;
        console.error('Error linking bank account:', error);
        this.showError('An error occurred while linking your bank.');
      },
    });
  }

  selectBank(bankId: string) {
    this.selectedBankId = bankId;
  }

  onOrderTypeChange(event: any) {
    const selectedValue = event.target.value;
    this.selectedOrderType = selectedValue;

    if (this.selectedOrderType === 'delivery') {
      this.selectedPaymentMethod = 'aeropay';
      if (!this.isGuest) {
        this.startAeroPayProcess();
      }
    }
    this.updateTotals();
    this.saveCheckoutState();
  }

  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({
      message: message,
      duration: 7000,
      color: color,
      position: 'bottom',
    });
    await toast.present();
  }

  onPaymentMethodChange(
    selectedMethod: string,
    aeropayInput?: HTMLInputElement,
    cashInput?: HTMLInputElement,
  ) {
    if (selectedMethod === 'aeropay') {
      if (
        !this.userInfo.fname ||
        !this.userInfo.lname ||
        !this.userInfo.phone ||
        !this.userInfo.email
      ) {
        // Revert to cash and manually uncheck AeroPay input
        this.selectedPaymentMethod = 'cash';
        if (aeropayInput) {
          aeropayInput.checked = false;
          cashInput!.checked = true;
        }
        // this.cdr.detectChanges();
        this.showError(
          'Please fill out all contact fields before selecting AeroPay.',
        );
        return;
      }

      if (
        this.isGuest &&
        this.aeropayUserId &&
        this.userBankAccounts.length > 0
      ) {
        this.showBankSelection = true;
        return;
      }

      if (!this.isGuest) {
        this.startAeroPayProcess();
      }
    } else {
      this.showBankSelection = false;
    }
    this.saveCheckoutState();
  }

  showError(message: string) {
    this.errorMessage = message;

    // Auto-clear after 7 seconds if you want
    setTimeout(() => {
      this.errorMessage = '';
    }, 7000);
  }

  isFormValid(): boolean {
    const user = this.userInfo;

    // Validate contact fields
    const hasContactInfo =
      user.fname?.trim() &&
      user.lname?.trim() &&
      user.email?.trim() &&
      user.phone?.trim() &&
      user.dob?.trim();

    if (!hasContactInfo) return false;

    if (!this.is21OrOlder(user.dob)) return false;
    // If delivery, validate delivery address
    if (this.selectedOrderType === 'delivery') {
      const addr = this.deliveryAddress;

      if (!addr.street?.trim() || !addr.city?.trim() || !addr.zip?.trim()) {
        return false;
      }

      if (!this.deliveryAddressValid) {
        return false;
      }

      // ✅ 🔥 THIS IS THE FIX
      if (this.deliveryMin > 0 && this.finalSubtotal < this.deliveryMin) {
        return false;
      }

      if (this.selectedPaymentMethod !== 'aeropay') {
        return false;
      }

      if (!this.selectedBankId) {
        return false;
      }
    }
    return true;
  }

  getAvailableDeliveryDates(schedule: any[]): string[] {
    const validDates: string[] = [];
    const today = new Date();

    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });

      const match = schedule.find((d) => d.day === dayName);
      if (match) {
        validDates.push(date.toISOString().split('T')[0]);
      }
    }
    return validDates;
  }

  onDateSelected(event: any) {
    const date = new Date(event.target.value);
    const dayOfWeek = date.getDay();
    this.generateTimeOptionsFromSchedule(dayOfWeek);
    this.selectedDeliveryTime = ''; // reset previous time
  }

  generateTimeOptionsFromSchedule(dayOfWeek: number) {
    const dayName = [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
    ][dayOfWeek];
    const scheduleForDay = this.deliverySchedule.find((d) => d.day === dayName);

    if (!scheduleForDay) {
      this.timeOptions = [];
      this.selectedDeliveryTime = '';
      return;
    }

    const [startHour, startMinute] = scheduleForDay.startTime
      .split(':')
      .map(Number);
    const [endHour, endMinute] = scheduleForDay.endTime.split(':').map(Number);

    const now = new Date();
    const selectedDate = this.selectedDeliveryDate
      ? new Date(this.selectedDeliveryDate + 'T00:00:00')
      : null;
    const isToday = selectedDate
      ? now.toDateString() === selectedDate.toDateString()
      : false;
    const leadMinutes = this.getDeliveryLeadMinutes();
    const cutoffMinutes = now.getHours() * 60 + now.getMinutes() + leadMinutes;

    const options: { value: string; display: string }[] = [];

    // 🟢 Add "Now" option if we're within delivery hours
    const nowHour = now.getHours();
    const nowMinute = now.getMinutes();
    const nowInRange =
      (nowHour > startHour ||
        (nowHour === startHour && nowMinute >= startMinute)) &&
      (nowHour < endHour || (nowHour === endHour && nowMinute <= endMinute));

    // if (isToday && nowInRange) {
    //   const formattedHour = nowHour % 12 === 0 ? 12 : nowHour % 12;
    //   const amPm = nowHour < 12 ? 'AM' : 'PM';
    //   const formattedMinute = nowMinute.toString().padStart(2, '0');

    //   options.push({
    //     value: `${nowHour.toString().padStart(2, '0')}:${formattedMinute}`,
    //     display: `Now (${formattedHour}:${formattedMinute} ${amPm})`
    //   });
    // }
    if (isToday && leadMinutes === 0) {
      const nowHour = now.getHours();
      const nowMinute = now.getMinutes();

      const nowInRange =
        (nowHour > startHour ||
          (nowHour === startHour && nowMinute >= startMinute)) &&
        (nowHour < endHour || (nowHour === endHour && nowMinute <= endMinute));

      if (nowInRange) {
        const formattedHour = nowHour % 12 === 0 ? 12 : nowHour % 12;
        const amPm = nowHour < 12 ? 'AM' : 'PM';
        const formattedMinute = nowMinute.toString().padStart(2, '0');

        options.push({
          value: `${nowHour.toString().padStart(2, '0')}:${formattedMinute}`,
          display: `Now (${formattedHour}:${formattedMinute} ${amPm})`,
        });
      }
    }

    // 🕒 Add all upcoming 30-min intervals
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let min of [0, 30]) {
        // const totalMinutes = hour * 60 + min;
        if (hour > endHour || (hour === endHour && min > endMinute)) break;

        const totalMinutes = hour * 60 + min;
        if (isToday && totalMinutes < cutoffMinutes) continue;

        // if (isToday && totalMinutes < currentMinutes) continue;

        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        const amPm = hour < 12 ? 'AM' : 'PM';
        const formattedHour = hour.toString().padStart(2, '0');
        const formattedMinute = min === 0 ? '00' : '30';

        options.push({
          value: `${formattedHour}:${formattedMinute}`,
          display: `${displayHour}:${formattedMinute} ${amPm}`,
        });
      }
    }

    // 🟠 If no slots left today, go to tomorrow
    if (isToday && options.length === 0) {
      const nextDay = (dayOfWeek + 1) % 7;
      const tomorrow = new Date(now.getTime() + 86400000);
      this.selectedDeliveryDate = tomorrow.toISOString().split('T')[0];
      this.generateTimeOptionsFromSchedule(nextDay);
      return;
    }

    this.timeOptions = options;

    // ✅ Auto-select “Now” if present, otherwise first available
    setTimeout(() => {
      if (this.timeOptions.length > 0) {
        const nowOption = this.timeOptions.find((t) =>
          t.display.startsWith('Now'),
        );
        this.selectedDeliveryTime = nowOption
          ? nowOption.value
          : this.timeOptions[0].value;
        this.cdr.detectChanges();
      }
    }, 0);
  }

  selectNearestFutureTime(current: Date, dayOfWeek: number) {
    const currentMinutes = current.getHours() * 60 + current.getMinutes() + 30; // add 30-minute buffer
    const hours = this.deliveryHoursByDay[dayOfWeek];

    for (let hour = hours.start; hour <= hours.end; hour++) {
      for (let minute of [0, 30]) {
        const timeMinutes = hour * 60 + minute;
        if (timeMinutes >= currentMinutes) {
          const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
          const formattedMinute = minute === 0 ? '00' : '30';
          this.selectedDeliveryTime = `${formattedHour}:${formattedMinute}`;
          return;
        }
      }
    }

    // If no valid slot today, go to next day
    const nextDay = (dayOfWeek + 1) % 7;
    const tomorrow = new Date(current.getTime() + 86400000); // +1 day
    this.selectedDeliveryDate = tomorrow.toISOString().split('T')[0];
    this.generateTimeOptionsForDay(nextDay);

    const nextDayHours = this.deliveryHoursByDay[nextDay];
    const fallbackHour = nextDayHours.start;
    this.selectedDeliveryTime = `${fallbackHour < 10 ? '0' + fallbackHour : fallbackHour}:00`;
  }

  generateTimeOptionsForDay(dayOfWeek: number) {
    this.timeOptions = [];

    const hours = this.deliveryHoursByDay[dayOfWeek];
    const startHour = hours.start;
    const endHour = hours.end;

    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute of [0, 30]) {
        // Don't exceed endHour if it's the last half-hour
        if (hour === endHour && minute === 30) break;

        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        const amPm = hour < 12 ? 'AM' : 'PM';
        const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
        const formattedMinute = minute === 0 ? '00' : '30';

        this.timeOptions.push({
          value: `${formattedHour}:${formattedMinute}`,
          display: `${displayHour}:${formattedMinute} ${amPm}`,
        });
      }
    }
  }

  formValid: boolean = false;

  validateForm() {
    const user = this.userInfo;

    let isValid =
      user.fname?.trim() &&
      user.lname?.trim() &&
      user.email?.trim() &&
      user.phone?.trim() &&
      user.dob?.trim();

    if (this.selectedOrderType === 'delivery') {
      const addr = this.deliveryAddress;
      isValid =
        isValid && addr.street?.trim() && addr.city?.trim() && addr.zip?.trim();

      if (this.selectedPaymentMethod !== 'aeropay' || !this.selectedBankId) {
        isValid = false;
      }

      if (!this.deliveryAddressValid) {
        isValid = false;
      }
    }

    this.formValid = !!isValid;
  }

  /** 🧾 Build a readable discount note for an item (NEW SYSTEM) */
  getItemDiscountNote(item: any): string | null {
    if (!Array.isArray(item.discounts) || item.discounts.length === 0) {
      return null;
    }

    const notes: string[] = [];

    for (const d of item.discounts) {
      switch (d.kind) {
        case 'percent':
          notes.push(`${d.value}% off`);
          break;

        case 'flat':
          notes.push(`$${d.value} off`);
          break;

        case 'bogo':
          notes.push(
            `Buy ${d.buyQty} Get ${d.getQty} ${
              d.discountType === 'percent'
                ? `${d.discountValue}% off`
                : `$${Number(d.discountValue).toFixed(2)} off`
            }`,
          );
          break;

        case 'bundle':
          notes.push(d.description ?? 'Bundle deal');
          break;
      }
    }

    return notes.join(', ');
  }

  /** 🧾 Build a cart-level summary note (backend-safe, NEW SYSTEM) */
  getCartDiscountSummary(cartItems: any[]): string {
    const summaries: string[] = [];

    // Existing item-level discounts
    for (const item of cartItems) {
      const note = this.getItemDiscountNote(item);
      if (note) {
        summaries.push(`${item.title}: ${note}`);
      }
    }

    // 🔹 AIQ Reward (NEW)
    if (this.appliedAiqReward) {
      summaries.push(
        `AIQ Reward Applied: ${this.appliedAiqReward.name}`
      );
    }

    // 🔹 Points (existing)
    if (this.pointsToRedeem > 0) {
      const dollarValue = (this.pointsToRedeem * this.pointValue).toFixed(2);
      summaries.push(
        `Rewards Points: ${this.pointsToRedeem} pts ($${dollarValue} off)`
      );
    }

    return summaries.length
      ? `Discounts applied — ${summaries.join('; ')}`
      : '';
  }


  is21OrOlder(dob: string): boolean {
    if (!dob) return false;

    const birthDate = new Date(dob);
    const today = new Date();

    const age = today.getFullYear() - birthDate.getFullYear();

    const monthDiff = today.getMonth() - birthDate.getMonth();
    const dayDiff = today.getDate() - birthDate.getDate();

    // Adjust if birthday hasn't happened yet this year
    const adjustedAge =
      monthDiff > 0 || (monthDiff === 0 && dayDiff >= 0) ? age : age - 1;

    return adjustedAge >= 21;
  }

  // private getEffectiveItemTotal(item: CartItem, qtyOverride?: number): number {
  //   const qty = qtyOverride ?? item.quantity;
  //   if (qty <= 0) return 0;

  //   const basePrice = this.toNumber(item.price);
  //   const salePrice = this.toNumber(item.discountedPrice || item.price);

  //   // --- BOGO LOGIC ---
  //   if (Array.isArray(item.bogoRules) && item.bogoRules.length > 0) {
  //     const rule = item.bogoRules[0];
  //     const buyQty = rule.buy_quantity || 1;
  //     const getQty = rule.get_quantity || 0;
  //     const discountValue = rule.discount_value ?? rule.discount_percent ?? 0;

  //     const setSize = buyQty + getQty;

  //     // ❗ Only apply BOGO to full sets
  //     if (qty < setSize || discountValue <= 0) {
  //       return basePrice * qty;
  //     }

  //     const fullSets = Math.floor(qty / setSize);
  //     const discountedItems = fullSets * getQty;
  //     const fullPriceItems = fullSets * buyQty;
  //     const leftover = qty - fullSets * setSize;

  //     const discountPerItem =
  //       rule.discount_type === 'flat'
  //         ? discountValue
  //         : basePrice * (discountValue / 100);

  //     const discountedUnit = Math.max(basePrice - discountPerItem, 0);

  //     return (
  //       discountedItems * discountedUnit +
  //       fullPriceItems * basePrice +
  //       leftover * basePrice
  //     );
  //   }

  //   // No BOGO → use sale/discounted price
  //   return salePrice * qty;
  // }

  isDealApplied(item: CartItem): boolean {
    const baseLine = this.toNumber(item.price) * (item.quantity ?? 0);
    const discountedLine = this.toNumber(item.lineTotal);

    // If lineTotal is lower than base (by at least 1 cent), a deal is applied
    return discountedLine <= baseLine - 0.01;
  }

  get discountedSubtotal(): number {
    return this.cartItems.reduce(
      (sum, item) => sum + this.toNumber(item.lineTotal),
      0,
    );
  }

  get dealSavings(): number {
    const base = this.cartItems.reduce(
      (sum, item) => sum + this.toNumber(item.price) * (item.quantity ?? 0),
      0,
    );

    const savings = base - this.discountedSubtotal;
    return savings > 0 ? savings : 0;
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

  getItemWeightLabel(item: CartItem): string | null {
    if (typeof item.weight === 'number' && item.weight > 0 && item.unit) {
      return `${item.weight} ${item.unit}`;
    }

    return null;
  }

  private getDeliveryLeadMinutes(): number {
    // Use the key you already compute in ngOnInit
    const key = (this.currentLocationKey || '').toLowerCase();

    // Canandaigua: require 60 min buffer
    if (key.includes('canandaigua')) return 60;

    return 0;
  }

  get isCanandaigua(): boolean {
    return (this.currentLocationKey || '')
      .toLowerCase()
      .includes('canandaigua');
  }

  private getAiqRewardDiscount(subtotal: number): number {
    if (!this.appliedAiqReward) return 0;

    if (this.appliedAiqReward.dollarValue) {
      return Math.min(this.appliedAiqReward.dollarValue, subtotal);
    }

    if (this.appliedAiqReward.percentageValue) {
      return subtotal * (this.appliedAiqReward.percentageValue / 100);
    }

    return 0;
  }

  private saveCheckoutState() {
    const state = {
      userInfo: this.userInfo,
      selectedOrderType: this.selectedOrderType,
      selectedPaymentMethod: this.selectedPaymentMethod,
      deliveryAddress: this.deliveryAddress,
      selectedDeliveryDate: this.selectedDeliveryDate,
      selectedDeliveryTime: this.selectedDeliveryTime,
      selectedTipPercent: this.selectedTipPercent,
      customTipAmount: this.customTipAmount,
      isCustomTip: this.isCustomTip
    };

    localStorage.setItem('checkoutState', JSON.stringify(state));
  }
}
