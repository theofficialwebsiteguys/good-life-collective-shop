import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, combineLatest, distinctUntilChanged, firstValueFrom, forkJoin, from, map, Observable, of, Subscription, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment.prod';
import { AuthService } from './auth.service';
import { CapacitorHttp } from '@capacitor/core';
import { ConfigService } from './config.service';
import { SettingsService } from './settings.service';
import { AppliedDiscount, Product } from '../models/product.model';
import { DiscountsService } from './discounts.service';
import { ProductsService } from './products.service';

declare global {
  interface Window {
    dataLayer: any[];
  }
}

type CartKey = {
  gramAmount?: number;
  weight?: number;
  unit?: string;
};

export interface CartItem {
  id: string;
  posProductId: string;
  id_batch: string;

  title: string;
  brand: string;
  desc: string;
  image: string;
  category: string;

  quantity: number;

  price: number;                 // base price (from product)
  unitPrice: number;             // price after normal discounts
  discountedQty: number;         // qty affected by BOGO reward
  discountedUnitPrice: number;   // price for those units
  lineTotal: number;             // FINAL total for row

  discounts?: AppliedDiscount[];
  discountNote?: string | null;

  selectedTier?: {
    gramAmount: number;
    name: string;
    preTaxPrice: number;    // dollars
    postTaxPrice?: number;  // dollars (optional)
    unit: string;           // "grams"
  };

  weight?: number;
  unit?: string;
}


type RawCartItem = Pick<
  CartItem,
  'id' | 'posProductId' | 'id_batch' | 'quantity' | 'discountNote'
> & {
  id_item?: string;

  // ✅ NEW
  weight?: number;
  unit?: string;

  // deli only
  selectedTier?: {
    gramAmount: number;
    priceOverride?: number;
  };
};

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private cartKey = 'cart'; 
  
  /** raw cart = source of truth persisted */
  private rawCartSubject = new BehaviorSubject<RawCartItem[]>(this.getRawCart());
  rawCart$ = this.rawCartSubject.asObservable();

  private cartSubject = new BehaviorSubject<CartItem[]>([]);
  cart$ = this.cartSubject.asObservable();

  private cartItemsSubject = new BehaviorSubject<CartItem[]>([]);
  cartItems$ = this.cartItemsSubject.asObservable();

  private inactivityTime = 0;
  private inactivityLimit = 24 * 24 * 60; // 24 hours
  private userId: number | null = null; // Store user ID
  private lastNotificationKey = 'lastCartAbandonmentNotification';

  private subs = new Subscription();

  private inactivityTimer: any;

  // constructor(private http: HttpClient, private authService: AuthService, private configService: ConfigService, private settingsService: SettingsService,  private discountsService: DiscountsService, private productsService: ProductsService) {
  //   if (!sessionStorage.getItem(this.cartKey)) {
  //     sessionStorage.setItem(this.cartKey, JSON.stringify([]));
  //   }

  //   this.authService.isLoggedIn().subscribe((status) => {
  //     if (status) {
  //       this.authService.getUserInfo().subscribe((user: any) => {
  //         if (user) {
  //           this.userId = user.id;
  //           sessionStorage.removeItem(this.lastNotificationKey);
  //           this.setupTracking();
  //         }
  //       });
  //     }
  //   });

  //   this.subs.add(
  //     combineLatest([
  //         this.rawCart$,
  //         this.productsService.products$
  //       ])
  //       .pipe(
  //         map(([raw, products]) => this.buildCart(raw, products))
  //       )
  //       .subscribe(cart => this.cartSubject.next(cart))
  //   );

    
  // }

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private configService: ConfigService,
    private settingsService: SettingsService,
    private discountsService: DiscountsService,
    private productsService: ProductsService
  ) {
    // ✅ ensure session key exists
    if (!localStorage.getItem(this.cartKey)) {
      localStorage.setItem(this.cartKey, JSON.stringify([]));
    }

    // ✅ load initial raw cart from session into the subject
    const initialRaw = this.getRawCart();   // returns RawCartItem[]
    this.rawCartSubject.next(initialRaw);   // keeps everything consistent


    // ✅ keep your auth tracking logic untouched
    this.authService.isLoggedIn().subscribe((status) => {
      if (status) {
        this.authService.getUserInfo().subscribe((user: any) => {
          if (user) {
            this.userId = user.id;
            sessionStorage.removeItem(this.lastNotificationKey);
            this.setupTracking();
          }
        });
      }
    });

    // ✅ keep your derived cart build unchanged
    this.subs.add(
      combineLatest([
        this.rawCart$,
        this.productsService.products$
      ])
        .pipe(map(([raw, products]) => this.buildCart(raw, products)))
        .subscribe(cart => this.cartSubject.next(cart))
    );
  }

  private safeReadRawCart(): CartItem[] {
    try {
      const raw = sessionStorage.getItem(this.cartKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  

  private setupTracking() {
    document.addEventListener('mousemove', () => this.resetInactivity());
    document.addEventListener('keypress', () => this.resetInactivity());
  
    const trackInactivity = () => {
      this.inactivityTime += 1; // Increase by half-second steps
  
      if (this.inactivityTime > this.inactivityLimit && this.getCart().length > 0) {
        this.handleAbandonedCart();
      }
  
      this.inactivityTimer = setTimeout(trackInactivity, 1000); // Schedule next check
    };
  
    trackInactivity();
  }
  
  ngOnDestroy() {
    this.subs.unsubscribe();
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
  }
  
  /** ✅ persisted read */
  private getRawCart(): RawCartItem[] {
    const raw = localStorage.getItem(this.cartKey);
    try {
      return raw ? (JSON.parse(raw) as RawCartItem[]) : [];
    } catch {
      return [];
    }
  }

  /** keep your existing getCart() signature if needed */
  getCart(): CartItem[] {
    return this.cartSubject.value;
  }


  private resetInactivity() {
    if (this.getCart().length === 0) {
      sessionStorage.removeItem(this.lastNotificationKey);
    }
    if (this.inactivityTime > 0) {
      this.inactivityTime = 0; // Reset inactivity timer
    }
  }

  private handleAbandonedCart() {
    const cartItems = this.getCart();
    const lastNotification = sessionStorage.getItem(this.lastNotificationKey);

    if (cartItems.length > 0 && this.userId && !lastNotification) {
      this.sendCartAbandonmentNotification(this.userId);
      sessionStorage.setItem(this.lastNotificationKey, 'sent'); // Mark as sent
    }
  }
  

  private async sendCartAbandonmentNotification(userId: number) {
    const payload = { userId, title: 'Forget To Checkout?', body: 'Come back to checkout and feel the power of the flower!' };
  
    const sessionData = localStorage.getItem('sessionData');
    const token = sessionData ? JSON.parse(sessionData).token : null;
  
    const headers = {
      Authorization: token,
      'Content-Type': 'application/json'
    };
  
    try {
      const response = await CapacitorHttp.post({
        url: `${environment.apiUrl}/notifications/send-push`,
        headers,
        data: payload
      });
    } catch (error) {
      console.error('Error sending notification', error);
    }
  }

  // getCart(): CartItem[] {
  //   const cart = sessionStorage.getItem(this.cartKey);
  //   return cart ? JSON.parse(cart) : [];
  // }
  /** ✅ cart mutations update RAW cart only */
  // addToCart(item: CartItem) {
  //   const cart = this.getRawCart();
  //   const idx = cart.findIndex((i) => i.id === item.id);

  //   if (idx !== -1) {
  //     cart[idx].quantity += item.quantity;
  //   } else {
  //     cart.push({
  //       id: item.id,
  //       posProductId: item.posProductId,
  //       id_batch: item.id_batch,
  //       quantity: item.quantity,
  //       discountNote: item.discountNote ?? null,
  //       id_item: item.id_item,
  //     });
  //   }

  //   this.saveRawCart(cart);
  // }

  // updateQuantity(itemId: string, quantity: number) {
  //   const cart = this.getRawCart();
  //   const idx = cart.findIndex((i) => i.id === itemId);
  //   if (idx === -1) return;

  //   cart[idx].quantity = quantity;
  //   if (cart[idx].quantity <= 0) cart.splice(idx, 1);

  //   this.saveRawCart(cart);
  // }

  // removeFromCart(itemId: string) {
  //   const cart = this.getRawCart().filter((i) => i.id !== itemId);
  //   this.saveRawCart(cart);
  // }

  /* ===============================
     RAW CART (SOURCE OF TRUTH)
  =============================== */

  private readRaw(): RawCartItem[] {
    try {
      return JSON.parse(localStorage.getItem(this.cartKey) || '[]');
    } catch {
      return [];
    }
  }

  private writeRaw(cart: RawCartItem[]) {
    localStorage.setItem(this.cartKey, JSON.stringify(cart));
    this.rawCartSubject.next(cart);
  }

  // addToCart(item: RawCartItem) {
  //   const cart = this.readRaw();
  //   const idx = cart.findIndex(i => i.id === item.id);

  //   if (idx !== -1) cart[idx].quantity += item.quantity;
  //   else cart.push(item);

  //   this.writeRaw(cart);
  // }

 addToCart(item: RawCartItem) {
  const cart = this.readRaw();

  const idx = cart.findIndex(i =>
    i.id === item.id &&

    // ✅ weight/unit must match (covers mg/g/pack)
    (i.weight ?? null) === (item.weight ?? null) &&
    (i.unit ?? null) === (item.unit ?? null) &&

    // ✅ deli tier must match (or both absent)
    (
      (!i.selectedTier && !item.selectedTier) ||
      (
        i.selectedTier &&
        item.selectedTier &&
        i.selectedTier.gramAmount === item.selectedTier.gramAmount
      )
    )
  );

  if (idx !== -1) cart[idx].quantity += item.quantity;
  else cart.push(item);

  this.writeRaw(cart);
}


  

  // updateQuantity(id: string, qty: number) {
  //   const cart = this.readRaw();
  //   const i = cart.find(c => c.id === id);
  //   if (!i) return;

  //   i.quantity = qty;
  //   if (i.quantity <= 0) this.writeRaw(cart.filter(x => x.id !== id));
  //   else this.writeRaw(cart);
  // }

  updateQuantity(id: string, qty: number, key?: CartKey) {
    const cart = this.readRaw();

    const i = cart.find(c =>
      c.id === id &&
      (key?.gramAmount == null || c.selectedTier?.gramAmount === key.gramAmount) &&
      ((c.weight ?? null) === (key?.weight ?? null)) &&
      ((c.unit ?? null) === (key?.unit ?? null))
    );

    if (!i) return;

    i.quantity = qty;

    if (i.quantity <= 0) {
      this.writeRaw(
        cart.filter(c => !(
          c.id === id &&
          (key?.gramAmount == null || c.selectedTier?.gramAmount === key.gramAmount) &&
          ((c.weight ?? null) === (key?.weight ?? null)) &&
          ((c.unit ?? null) === (key?.unit ?? null))
        ))
      );
    } else {
      this.writeRaw(cart);
    }
  }



  // removeFromCart(id: string) {
  //   this.writeRaw(this.readRaw().filter(i => i.id !== id));
  // }

  removeFromCart(id: string, key?: CartKey) {
    this.writeRaw(
      this.readRaw().filter(c => !(
        c.id === id &&
        (key?.gramAmount == null || c.selectedTier?.gramAmount === key.gramAmount) &&
        ((c.weight ?? null) === (key?.weight ?? null)) &&
        ((c.unit ?? null) === (key?.unit ?? null))
      ))
    );
  }


  clearCart() {
    this.writeRaw([]);
  }

    /** ✅ persist + emit raw cart */
  private saveRawCart(cart: RawCartItem[]) {
    localStorage.setItem(this.cartKey, JSON.stringify(cart));
    this.rawCartSubject.next(cart);
  }


  async checkout(
    points_redeem: number,
    orderType: string,
    deliveryAddress: any,
    userInfo?: any,
    cartDiscountNote?: string,
    overrideCartItems?: CartItem[],
    deliveryFee?: number
  ): Promise<{ orderId: number; status: number }> {
    const cartItems = overrideCartItems && overrideCartItems.length > 0
      ? overrideCartItems
      : this.getCart();

    // 2) Build payload
    const orderItems: any = {
      // items: cartItems.map(item => ({
      //   productId: item.id,
      //   quantityPurchased: item.quantity,
      //   discountNote: item.discountNote || null,
      // })),
      items: cartItems.map(item => {
        const isDeliFlower = item.selectedTier;

        return {
          productId: item.id,

          // ✅ Oregon deli = grams, otherwise normal quantity
          quantityPurchased: isDeliFlower
            ? (item.selectedTier!.gramAmount * item.quantity)
            : item.quantity,

          discountNote: item.discountNote || null,
        };
      }),
      orderType,
      cartDiscountNote: cartDiscountNote || '',
      customerId: userInfo?.pos_customer_id
    };

    // If delivery, attach address and delivery times
    if (orderType === 'delivery' && deliveryAddress) {
      orderItems.address = {
        street1:  deliveryAddress.address1,
        street2: deliveryAddress.address2 || '',
        city:    deliveryAddress.city,
        state:   deliveryAddress.state,
        zip:     deliveryAddress.zip,
      };

      if (deliveryAddress.delivery_date && deliveryAddress.delivery_time) {
        // Parse as local time
        const localDateTime = new Date(`${deliveryAddress.delivery_date}T${deliveryAddress.delivery_time}`);

        // Convert once to UTC ISO (toISOString already does the offset)
        const startIso = localDateTime.toISOString();

        const endIso = new Date(localDateTime.getTime() + 30 * 60 * 1000).toISOString();

        orderItems.requestedFulfillmentTimeStart = startIso;
        orderItems.requestedFulfillmentTimeEnd = endIso;
      }

      if(deliveryFee){
        orderItems.fees = {
          fees: [{ name: 'Delivery Fee', amount: Math.round(deliveryFee * 100) }]
        }
      }

    }

    const customer = {
      firstName: userInfo.fname,
      lastName:  userInfo.lname,
      email:     userInfo.email,
      phone:     userInfo.phone,
      birthDate: userInfo.dob,
    };

    const payload = { orderItems, customer, points_redeem };

    // 3) Make request (params must be strings)
    const location_id = this.settingsService.getSelectedLocationId() ?? '';

    const res = await CapacitorHttp.post({
      url: `${environment.apiUrl}/flowhub/submitOrder`,
      params: { location_id: String(location_id) },
      headers: {
        'x-auth-api-key': environment.db_api_key,
        'Content-Type': 'application/json'
      },
      data: payload,
    });

    // 4) Extract and return the shape your caller expects
    const { orderId, status } = res.data.order ?? {};
    if (orderId == null || status == null) {
      throw new Error('submitOrder response missing orderId/status');
    }

    this.clearCart();
    return { orderId, status }; // ✅ now the function returns a value
  }
  

  // Save the cart back to sessionStorage and notify subscribers
  private saveCart(cart: CartItem[]) {
    sessionStorage.setItem(this.cartKey, JSON.stringify(cart));
    this.cartSubject.next(cart); // Emit the updated cart
  }



  async fetchInventory(skip: number, take: number) {
    const headers = {
      Authorization: `Bearer ${JSON.parse(sessionStorage.getItem('authTokensAlleaves') || '{}')}`,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json; charset=utf-8',
    };
  
    const body = { skip, take };
    const apiUrl = 'https://app.alleaves.com/api/inventory/search';
  
    const options = {
      url: apiUrl,
      method: 'POST',
      headers: headers,
      data: body,
    };
  
    return CapacitorHttp.request(options)
      .then((response) => {
        return response.data;
      })
      .catch((error) => {
        console.error('Error fetching inventory:', error);
        throw error;
      });
  }

  async createCustomer(userDetails: any) {
      const headers = {
        Authorization: `Bearer ${JSON.parse(sessionStorage.getItem('authTokensAlleaves') || '{}')}`,
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json; charset=utf-8',
      };
    
      // API URL for creating a customer
      const apiUrl = 'https://app.alleaves.com/api/customer';
    
      const options = {
        url: apiUrl,
        method: 'POST',
        headers: headers,
        data: userDetails,
      };
    
      return CapacitorHttp.request(options)
        .then((response) => {
          return response.data;
        })
        .catch((error) => {
          console.error('Error creating User:', error);
          throw error;
        });
    }

    // Function to create an order
    async createOrder(orderDetails: any) {
      const headers = {
        Authorization: `Bearer ${JSON.parse(sessionStorage.getItem('authTokensAlleaves') || '{}')}`,
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json; charset=utf-8',
      };
    
      // API URL for creating an order
      const apiUrl = 'https://app.alleaves.com/api/order';
    
      const options = {
        url: apiUrl,
        method: 'POST',
        headers: headers,
        data: orderDetails,
      };
    
      return CapacitorHttp.request(options)
        .then((response) => {
          return response.data;
        })
        .catch((error) => {
          console.error('Error creating order:', error);
          throw error;
        });
    }

    async addCheckoutItemsToOrder(idOrder: number, checkoutItems: any[]) {
      const headers = {
        Authorization: `Bearer ${JSON.parse(sessionStorage.getItem('authTokensAlleaves') || '{}')}`,
        'Content-Type': 'application/json; charset=utf-8',
        Accept: 'application/json; charset=utf-8',
      };
    
      const apiUrl = `https://app.alleaves.com/api/order/${idOrder}/item`;
      const addedItems: any[] = [];
    
      for (const item of checkoutItems) {
        const body = {
          id_batch: item.id_batch,
          id_area: 1000,
          qty: item.quantity,
        };
    
        const options = {
          url: apiUrl,
          method: 'POST',
          headers: headers,
          data: body,
        };
    
        try {
          const response = await CapacitorHttp.request(options);
    
          if (response?.data?.items?.length > 0) {
            // Only push unique items based on `id_item`
            response.data.items.forEach((resItem: any) => {
              const exists = addedItems.some((added) => added.id_item === resItem.id_item);
              if (!exists) {
                addedItems.push({
                  ...item,
                  id_item: resItem.id_item,
                });
              }
            });
          } else {
            console.warn(`Unexpected response format for item ${item.id_batch}:`, response);
          }
        } catch (error) {
          console.error(`Error adding item (id_batch: ${item.id_batch}):`, error);
          continue;
        }
      }
    
      return addedItems;
    }

  async placeOrder(user_id: number = 19139, pos_order_id: number, points_add: number, points_redeem: number, amount: number, cart: any, email?: string, customer_name?: string, customer_email?: string, customer_phone?: string, customer_dob?: string, order_type?: string) {
    const payload = { user_id, pos_order_id, points_add, points_redeem, amount, cart, customer_name, customer_email, customer_phone, customer_dob, order_type };

    const location_id = this.settingsService.getSelectedLocationId() ?? '';

    const headers = this.getHeaders();
    
    const options = {
      url: `${environment.apiUrl}/orders/create${location_id ? `?location_id=${location_id}` : ''}`,
      method: 'POST',
      headers: headers,
      data: payload,
    };
  
    return CapacitorHttp.request(options)
      .then((response) => {
        this.sendOrderConfirmation(email, pos_order_id);
        return response.data;
      })
      .catch((error) => {
        console.error('Error in placeOrder:', error);
        throw error;
      });
  }

  checkDeliveryEligibility(): Observable<{ deliveryAvailable: boolean }> {
    const location_id = this.settingsService.getSelectedLocationId() ?? '';
    const options = {
      url: `${environment.apiUrl}/businesses/delivery-eligibility${location_id ? `?location_id=${location_id}` : ''}`,
      method: 'GET',
      headers: this.getHeaders()
    };

    // Convert CapacitorHttp request to Observable
    return from(CapacitorHttp.request(options).then(response => response.data));
  }

  async getDeliveryZone(): Promise<any> {
    const location_id = this.settingsService.getSelectedLocationId() ?? '';

    const options = {
      url: `${environment.apiUrl}/businesses/zone${location_id ? `?location_id=${location_id}` : ''}`,
      method: 'GET',
      headers: this.getHeaders()
    };
  
    try {
      const response = await CapacitorHttp.request(options);
      return response.data;
    } catch (error) {
      console.error('Error fetching delivery zone:', error);
      throw error;
    }
  }
  
  async checkAddressInZone(address: string): Promise<{ inZone: boolean, lat: number, lng: number }> {
    const location_id = this.settingsService.getSelectedLocationId() ?? '';
    const options = {
      url: `${environment.apiUrl}/businesses/zone/check${location_id ? `?location_id=${location_id}` : ''}`,
      method: 'POST',
      headers: this.getHeaders(),
      data: { address }
    };
  
    try {
      const response = await CapacitorHttp.request(options);
      return response.data;
    } catch (error) {
      console.error('Error checking address in zone:', error);
      throw error;
    }
  }

  private getHeaders(): { [key: string]: string } {
    const sessionData = localStorage.getItem('sessionData');
    const token = sessionData ? JSON.parse(sessionData).token : null;
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json', // Ensure JSON data format
    };

    const apiKey = this.configService.getApiKey() || '';
  
    headers['x-auth-api-key'] = apiKey; // Set API key header for guests
  
    return headers;
  }
  
  async sendOrderConfirmation(email: string | undefined, order_id: number) {
    const payload: any = { email, order_id };
  
    const headers = this.getHeaders();
    
    const options = {
      url: `${environment.apiUrl}/resend/sendOrderConfirmation`,
      method: 'POST',
      headers,
      data: payload,
    };
  
    return CapacitorHttp.request(options)
      .then((response) => {
        return response.data;
      })
      .catch((error) => {
        console.error('Error in placeOrder:', error);
        throw error;
      });
  }

  private applyBogoPricing(cart: CartItem[]): CartItem[] {
    // Always reset BOGO-calculated fields first (prevents stale values)
    for (const item of cart) {
      // ✅ Only reset BOGO-specific fields
      const hasBogo = item.discounts?.some(d => d.kind === 'bogo');

      if (hasBogo) {
        item.discountedQty = 0;
        item.discountedUnitPrice = item.unitPrice;
        item.discountNote = null;
      }
    }

    // Collect bogo discounts safely + narrow the type
    const bogos = cart
      .flatMap((i: CartItem) => i.discounts ?? [])
      .filter(
        (d): d is Extract<AppliedDiscount, { kind: 'bogo' }> => d.kind === 'bogo'
      );

    for (const bogo of bogos) {
      // Which product receives the reward?
      // If getProductId exists, use it; otherwise, fallback to "same product" model.
      const targetId: string | null =
        (bogo.getProductId ?? null) ? String(bogo.getProductId) : null;

      // Qualifying qty:
      // - If your BOGO is encoded per-product using role 'buy', count only those.
      // - If role isn't present, treat any item carrying this bogo as qualifying.
      const qualifyingQty = cart
        .filter((item: CartItem) => {
          const ds = item.discounts ?? [];
          return ds.some(d =>
            d.kind === 'bogo' &&
            // if roles exist, exclude 'get' lines from qualifying
            (d.role ? d.role !== 'get' : true) &&
            // if bogo targets a specific getProductId, still qualify based on bogo presence
            true
          );
        })
        .reduce((sum: number, item: CartItem) => sum + item.quantity, 0);

      const rewardQty =
        Math.floor(qualifyingQty / bogo.buyQty) * bogo.getQty;

      let remaining = rewardQty;

      for (const item of cart) {
        if (remaining <= 0) break;

        // If getProductId is provided, only apply reward to that product id.
        // If not provided, apply to items that contain this bogo discount (same-product fallback).
        const appliesToThisItem =
          targetId
            ? String(item.id) === targetId
            : (item.discounts ?? []).some(d => d.kind === 'bogo');

        if (!appliesToThisItem) continue;

        const applied = Math.min(item.quantity, remaining);
        remaining -= applied;

        item.discountedQty = applied;

        // reward price for those discounted units
        if (bogo.discountType === 'percent') {
          item.discountedUnitPrice =
            item.unitPrice * (1 - bogo.discountValue / 100);
        } else {
          // flat
          item.discountedUnitPrice =
            Math.max(item.unitPrice - bogo.discountValue, 0);
        }

        item.discountNote =
          `${bogo.name ?? 'BOGO'}: ${applied} @ ${bogo.discountType}`;
      }
    }

    // Final totals for every row
    for (const item of cart) {
      const paidQty = Math.max(item.quantity - item.discountedQty, 0);
      item.lineTotal =
        (item.discountedQty * item.discountedUnitPrice) +
        (paidQty * item.unitPrice);
    }

    return cart;
  }


 private applyStandardDiscounts(cart: CartItem[]): CartItem[] {
  // Reset prices
  cart.forEach(i => {
    i.unitPrice = i.price;          // base price
    i.discountedQty = 0;            // reset
    i.discountedUnitPrice = i.price;
  });

  const discounts = cart
    .flatMap(i => i.discounts ?? [])
    .filter(
      (d): d is Extract<AppliedDiscount, { kind: 'percent' | 'flat' }> =>
        d.kind === 'percent' || d.kind === 'flat'
    );

  for (const d of discounts) {
    if (!d.rule) continue;

    // 🔍 Qualifying items
    const qualifyingItems = cart.filter(i => {
      if (d.rule?.productIds?.length) {
        return d.rule.productIds.includes(String(i.id));
      }
      if (d.rule?.brands?.length) {
        return d.rule.brands.includes(i.brand);
      }
      if (d.rule?.categories?.length) {
        return d.rule.categories.includes(i.category);
      }
      return false;
    });

    const totalQty = qualifyingItems.reduce((s, i) => s + i.quantity, 0);
    const minQty = d.minQty ?? d.rule.minQty ?? 1;

    if (totalQty < minQty) continue;

    /* ===========================
       ✅ PERCENT → per-item OK
    =========================== */
    if (d.kind === 'percent') {
      qualifyingItems.forEach(item => {
        item.unitPrice = item.price * (1 - d.value / 100);
      });
      continue;
    }

    // ✅ FLAT is cart-level. Do NOT modify item pricing here.
    if (d.kind === 'flat') {
      continue;
    }

    // /* ===========================
    //   ✅ FLAT → PER-GROUP, NOT BLENDED
    // =========================== */

    // const groups = Math.floor(totalQty / minQty);
    // if (groups <= 0) continue;

    // const discountedQtyTotal = groups * minQty;
    // const perUnitDiscount = d.value / minQty;

    // let remainingDiscounted = discountedQtyTotal;

    // for (const item of qualifyingItems) {
    //   if (remainingDiscounted <= 0) break;

    //   const applyQty = Math.min(item.quantity, remainingDiscounted);
    //   remainingDiscounted -= applyQty;

    //   // ✅ DO NOT change unitPrice
    //   item.discountedQty += applyQty;

    //   item.discountedUnitPrice = Math.max(
    //     item.price - perUnitDiscount,
    //     0
    //   );
    // }


  }

  return cart;
}



private buildCart(
  raw: RawCartItem[],
  products: Product[]
): CartItem[] {
  const byId = new Map<string, Product>(
    products.map((p: Product) => [String(p.id), p])
  );

  let cart: CartItem[] = raw.map((r: RawCartItem) => {
    const p = byId.get(String(r.id));

    const basePrice = Number(p?.price ?? 0) || 0;
    const hydratedDiscounts: AppliedDiscount[] = (p?.discounts ?? []) as AppliedDiscount[];

    const categoryKey =
      typeof p?.category === 'string'
        ? p.category
        : '';

    return {
      id: r.id,
      posProductId: r.posProductId,
      id_batch: r.id_batch,
      quantity: r.quantity,

      title: p?.title ?? '',
      brand: p?.brand ?? '',
      desc: p?.desc ?? '',
      image: p?.image ?? '',
      category: categoryKey,

      // 🔑 PRICE SOURCE
      price: r.selectedTier?.priceOverride != null
        ? r.selectedTier.priceOverride
        : r.selectedTier
          ? Number(
              p?.weightTierInformation?.find(
                (t: any) => t.gramAmount === r.selectedTier?.gramAmount
              )?.preTaxPriceInPennies ?? 0
            ) / 100
          : basePrice,


      unitPrice: 0,                 // calculated next
      discountedQty: 0,
      discountedUnitPrice: 0,
      lineTotal: 0,

      weight: r.weight,
      unit: r.unit,

      discounts: hydratedDiscounts,
      discountNote: r.discountNote ?? null,

      // ✅ FULL tier hydration
      selectedTier: r.selectedTier
        ? (() => {
            const tier = p?.weightTierInformation?.find(
              (t: any) => t.gramAmount === r.selectedTier?.gramAmount
            );

            return tier
              ? {
                  gramAmount: tier.gramAmount,
                  name: tier.name,
                  preTaxPrice: tier.preTaxPriceInPennies / 100,
                  postTaxPrice: tier.postTaxPriceInPennies
                    ? tier.postTaxPriceInPennies / 100
                    : undefined,
                  unit: p?.unit || 'grams',
                }
              : undefined;
          })()
        : undefined,
    };
  });

  cart = this.applyStandardDiscounts(cart);
  cart = this.applyBogoPricing(cart);

  return cart;
}


getCartSubtotal(cart?: CartItem[]): number {
  const items = cart ?? this.cartSubject.value;

  // base: item-level discounts already baked into lineTotal
  let subtotal = items.reduce((sum, i) => sum + (Number(i.lineTotal) || 0), 0);

  // find a CART-LEVEL flat discount (minQty > 1)
  const flat: any = items
    .flatMap(i => i.discounts ?? [])
    .find(d => d.kind === 'flat' && !!d.rule && ((d.minQty ?? d.rule.minQty) > 1));

  if (!flat?.rule) return Math.max(subtotal, 0);

  const minQty = flat.minQty ?? flat.rule.minQty ?? 1;

  // qualifying qty (SAFE string comparisons)
  const qualifyingQty = items
    .filter(i => {
      if (flat.rule?.productIds?.length) {
        return flat.rule.productIds.includes(String(i.id));
      }
      if (flat.rule?.brands?.length) {
        return flat.rule.brands.includes(String(i.brand));
      }
      if (flat.rule?.categories?.length) {
        return flat.rule.categories.includes(String(i.category)); // category is normalized now
      }
      return false;
    })
    .reduce((s, i) => s + (Number(i.quantity) || 0), 0);

  const groups = Math.floor(qualifyingQty / minQty);
  const totalOff = groups * (Number(flat.value) || 0);

  return Math.max(subtotal - totalOff, 0);
}


}
