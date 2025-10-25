import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, firstValueFrom, forkJoin, from, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../environments/environment.prod';
import { AuthService } from './auth.service';
import { CapacitorHttp } from '@capacitor/core';
import { ConfigService } from './config.service';
import { SettingsService } from './settings.service';

declare global {
  interface Window {
    dataLayer: any[];
  }
}


export interface CartItem {
  id: string;
  posProductId: string;
  id_batch: string;
  image: string;
  brand: string;
  desc: string;
  price: string;
  quantity: number;
  title: string;
  strainType: string;
  thc: string;
  weight: string;
  category: string;
  id_item?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private cartKey = 'cart'; 
  private cartSubject = new BehaviorSubject<CartItem[]>(this.getCart());
  cart$ = this.cartSubject.asObservable(); 
  private inactivityTime = 0;
  private inactivityLimit = 24 * 24 * 60; // 24 hours
  private userId: number | null = null; // Store user ID
  private lastNotificationKey = 'lastCartAbandonmentNotification';

  private inactivityTimer: any;

  constructor(private http: HttpClient, private authService: AuthService, private configService: ConfigService, private settingsService: SettingsService) {
    if (!sessionStorage.getItem(this.cartKey)) {
      sessionStorage.setItem(this.cartKey, JSON.stringify([]));
    }

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
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
    }
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

  getCart(): CartItem[] {
    const cart = sessionStorage.getItem(this.cartKey);
    return cart ? JSON.parse(cart) : [];
  }

  addToCart(item: any) {
    const cart = this.getCart();
    const existingItemIndex = cart.findIndex(
      (cartItem: CartItem) => cartItem.id === item.id
    );

    if (existingItemIndex !== -1) {
      cart[existingItemIndex].quantity += item.quantity;
    } else {
      cart.push(item);
    }

    this.saveCart(cart);

    if (typeof window !== 'undefined') {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'add_to_cart',
        ecommerce: {
          currency: 'USD',
          value: Number(item.price),
          items: [{
            item_id: item.id,
            item_name: item.title,
            item_category: item.category,
            item_variant: item.weight,
            item_brand: item.brand,
            quantity: item.quantity,
            price: Number(item.price)
          }]
        }
      });
    }
  }

  updateQuantity(itemId: string, quantity: number) {
    const cart = this.getCart();
    const itemIndex = cart.findIndex((cartItem: CartItem) => cartItem.id === itemId);

    if (itemIndex !== -1) {
      cart[itemIndex].quantity = quantity;
      if (cart[itemIndex].quantity <= 0) {
        cart.splice(itemIndex, 1);
      }
      this.saveCart(cart);
    }
  }

  removeFromCart(itemId: string) {
    const cart = this.getCart();
    const updatedCart = cart.filter((cartItem: CartItem) => cartItem.id !== itemId);
    this.saveCart(updatedCart);
  }

  clearCart() {
    this.saveCart([]);
  }

  async checkout(
    points_redeem: number,
    orderType: string,
    deliveryAddress: any,
    userInfo?: any
  ): Promise<{ orderId: number; status: number }> {
    const cartItems = this.getCart();

    // 1) Get user info as a Promise
    let user_info: any;

    // 2) Build payload
    const orderItems: any = {
      items: cartItems.map(item => ({
        productId: item.id,
        quantityPurchased: item.quantity,
      })),
      orderType,
      discountNote: '',
      ...(orderType === 'delivery' && deliveryAddress ? {
        address: {
          street:  deliveryAddress.street,
          street2: deliveryAddress.street2 || '',
          city:    deliveryAddress.city,
          state:   deliveryAddress.state,
          zip:     deliveryAddress.zip,
        }
      } : {})
    };

    const customer = {
      firstName: userInfo.fname,
      lastName:  userInfo.lname,
      email:     userInfo.email,
      phone:     userInfo.phone,
      birthDate: userInfo.dob,
    };

    const payload = { orderItems, customer, pointsRedeem: points_redeem };

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

  async placeOrder(user_id: number = 19139, pos_order_id: number, points_add: number, points_redeem: number, amount: number, cart: any, email?: string, customer_name?: string) {
    const payload = { user_id, pos_order_id, points_add, points_redeem, amount, cart, customer_name };
  
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



  async updateOrder(id_order: number, pickup_date: any, pickup_time: any, subtotal: number, id_customer: number) {
    const payload = { id_order, pickup_date, pickup_time, id_customer, id_location: 1000 };
  
    const headers = {
      Authorization: `Bearer ${JSON.parse(sessionStorage.getItem('authTokensAlleaves') || '{}')}`,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json; charset=utf-8',
    };
  
    const options = {
      url: `https://app.alleaves.com/api/order/${id_order}`,
      method: 'PUT',
      headers: headers,
      data: payload,
    };
  
    return CapacitorHttp.request(options)
      .then((response) => {
        return response.data;
      })
      .catch((error) => {
        console.error('Error in updateOrder:', error);
        throw error;
      });
  }  

  checkDeliveryEligibility(): Observable<{ deliveryAvailable: boolean }> {
    const options = {
      url: `${environment.apiUrl}/businesses/delivery-eligibility`,
      method: 'GET',
      headers: this.getHeaders()
    };

    // Convert CapacitorHttp request to Observable
    return from(CapacitorHttp.request(options).then(response => response.data));
  }

  async getDeliveryZone(): Promise<any> {
    const options = {
      url: `${environment.apiUrl}/businesses/zone`,
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
    const options = {
      url: `${environment.apiUrl}/businesses/zone/check`,
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

  async createAlleavesCustomer(userData: {
    fname: string;
    lname: string;
    phone: string;
    email: string;
    dob: string;
  }): Promise<any> {
    try {
      const request = {
        method: 'POST',
        url: 'https://app.alleaves.com/api/customer',
        headers: {
          Authorization: `Bearer ${JSON.parse(sessionStorage.getItem('authTokensAlleaves') || '{}')}`,
          'Content-Type': 'application/json; charset=utf-8',
          Accept: 'application/json; charset=utf-8'
        },
        data: {
          name_first: userData.fname,
          name_last: userData.lname,
          phone: userData.phone,
          email: userData.email,
          date_of_birth: userData.dob
        }
      };

      const response = await CapacitorHttp.request(request);

      return response.data; // Return response for further processing

    } catch (error) {
      console.error('Error calling Alleaves API:', error);
      throw new Error('Failed to create Alleaves customer');
    }
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
  

}
