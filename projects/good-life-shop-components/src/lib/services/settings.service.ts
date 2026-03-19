import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { BehaviorSubject, catchError, combineLatest, filter, from, map, Observable, of, switchMap, take } from 'rxjs';

import { AuthService } from './auth.service';
import { environment } from '../../environments/environment.prod';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { ProductsService } from './products.service';
import { NavigationService } from './navigation.service';
import { ConfigService } from './config.service';
import { DiscountsService } from './discounts.service';

export interface Banner {
  image: string;
  link?: string;
  brand?: string;
  ctaText?: string;
  shop?: boolean;
}

export interface LoyaltyConfig {
  scope: 'business' | 'location';
  pointsEarnRate: number;     // points per $1 earned
  pointsRedeemValue: number;  // $ per point when redeeming (e.g., 0.01)
  maxPercentOff: number;      // % cap on discount via points
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  DARK_MODE_ENABLED = 'darkModeEnabled';

  isLoggedIn: boolean = false;

  private locationsSubject = new BehaviorSubject<any[]>([]);
  locations$ = this.locationsSubject.asObservable();

  private selectedLocationIdSubject = new BehaviorSubject<string | null>(null);
  selectedLocationId$ = this.selectedLocationIdSubject.asObservable();

  private loyaltySubject = new BehaviorSubject<LoyaltyConfig | null>(null);
  loyalty$ = this.loyaltySubject.asObservable();


  constructor(
    @Inject(DOCUMENT) private document: Document,
    private authService: AuthService,
    private http: HttpClient,
    private productsService: ProductsService,
    private navService: NavigationService,
    private configService: ConfigService,
    private discountsService: DiscountsService
  ) {
    this.authService.isLoggedIn().subscribe((isLoggedIn) => {
      this.isLoggedIn = isLoggedIn;
      this.isDarkModeEnabled.next(this.getDarkModeEnabled());
      this.updateTheme();
    });
    this.loadSelectedLocationId();
  }

  private loadSelectedLocationId(): void {
    const savedId = localStorage.getItem('selectedLocationId');
    if (savedId) {
      this.setSelectedLocationId(savedId);
    }
  }

  async getFlowhubLocations(): Promise<any[]> {
    const options = {
      url: `${environment.apiUrl}/flowhub/getLocations`,
      method: 'GET',
      headers: { 
        'x-auth-api-key': environment.db_api_key,
        'Content-Type': 'application/json'
      },
    };

    try {
      const response = await CapacitorHttp.request(options);
      const locations = response.data.locations.map((location: any) => {
      let key = 'UNKNOWN';

      if (location.name.includes('Rochester')) key = 'ROCHESTER';
      else if (location.name.includes('CANANDAIGUA')) key = 'CANANDAIGUA';
      const state = this.extractStateFromAddress(location.address);

        return {
          ...location,
          key,
          state,                // ✅ NY / OR
          taxRate: this.getTaxRateForState(state), // ✅ computed once
        };
      });

      this.locationsSubject.next(locations);
      return locations;
    } catch (error) {
      console.error('Error fetching venues from backend:', error);
      throw error;
    }
  }

  private getTaxRateForState(state: string): number {
    switch (state) {
      case 'OR':
        // ⚠️ Replace with your exact Oregon cannabis effective rate
        return 0.2;
      case 'NY':
      default:
        return 0.13;
    }
  }

  getSelectedLocation(): any | null {
    const id = this.getSelectedLocationId();
    return this.locationsSubject.value.find(l => l.location_id === id) ?? null;
  }

  getSelectedTaxRate(): number {
    return this.getSelectedLocation()?.taxRate ?? 0.13;
  }

  getSelectedLocationState(): string {
    return this.getSelectedLocation()?.state ?? 'NY';
  }



  // setSelectedLocationId(id: string): void {
  //   this.selectedLocationIdSubject.next(id);
  //   localStorage.setItem('selectedLocationId', id);
  //   this.productsService.fetchProducts(id).subscribe({
  //     error: (e) => console.error('Error fetching products:', e),
  //   });
  // }

  private extractStateFromAddress(address?: string): string {
    if (!address) return 'NY'; // safe default

    // Matches ", NY 12345" or ", OR 97103"
    const match = address.match(/,\s*([A-Z]{2})\s+\d{5}/i);
    return match ? match[1].toUpperCase() : 'NY';
  }


// setSelectedLocationId(id: string): void {
//   this.selectedLocationIdSubject.next(id);
//   localStorage.setItem('selectedLocationId', id);

//   combineLatest([
//       this.locations$,
//     this.productsService.fetchProducts(id),
//     this.discountsService.loadDiscounts(id),
//   ]).subscribe({
//     next: ([locations, products, dr]) => {
//       const discounts = dr?.discounts ?? [];

//         const location = locations.find(l => l.location_id === id);
//        console.log(location)
//       const isOregon = location?.state === 'OR';
//       console.log(isOregon)
//       const taxRate = location?.taxRate ?? 0;
//       console.log(taxRate)

//       // ✅ 1️⃣ Normalize product prices ONCE
//       const normalizedProducts = products.map((p: any) => {
//       const basePrice =
//         typeof p.basePrice === 'number'
//           ? p.basePrice
//           : Number(p.price);


//         if (!isOregon) {
//           return {
//             ...p,
//             basePrice,
//             price: basePrice,        // unchanged
//             isTaxIncluded: false,
//           };
//         }

//         const taxedPrice = Number(
//           (basePrice * (1 + taxRate)).toFixed(2)
//         );

//         return {
//           ...p,
//           basePrice,
//           price: taxedPrice,        // 🔥 baked-in tax
//           isTaxIncluded: true,
//         };
//       });

//       // Store discounts globally
//       this.discountsService.setDiscounts(discounts);

//       // Apply to product listings (visual only)
//       const enriched = this.discountsService.applyDiscountsToProducts(
//         normalizedProducts,
//         discounts
//       );

//       this.productsService.setProducts(enriched);
//     },
//   });
// }

locationsReady$ = this.locations$.pipe(
  filter(locs => locs.length > 0),
  take(1)
);

setSelectedLocationId(id: string): void {
  localStorage.setItem('selectedLocationId', id);

  this.locationsReady$
    .pipe(
      switchMap(locations => {
        this.selectedLocationIdSubject.next(id);

        return combineLatest([
          of(locations),
          this.productsService.fetchProducts(id),
          this.discountsService.loadDiscounts(id),
        ]);
      }),
      take(1)
    )
    .subscribe(([locations, products, dr]) => {
      const discounts = dr?.discounts ?? [];

      const location = locations.find(
        l => String(l.location_id) === String(id)
      );

      if (!location) {
        console.error('❌ Location missing during normalization', id);
        return;
      }

      const isOregon = location.state === 'OR';
      const taxRate = location.taxRate ?? 0;

      const normalizedProducts = products.map((p: any) => {
        const basePrice =
          typeof p.rawPrice === 'number'
            ? p.rawPrice
            : typeof p.basePrice === 'number'
              ? p.basePrice
              : Number(p.price);

        if (!isOregon) {
          return { ...p, basePrice, price: basePrice, isTaxIncluded: false };
        }

        return {
          ...p,
          basePrice,
          price: Number((basePrice * (1 + taxRate)).toFixed(2)),
          isTaxIncluded: true,
        };
      });

      this.discountsService.setDiscounts(discounts);

      this.productsService.setProducts(
        this.discountsService.applyDiscountsToProducts(
          normalizedProducts,
          discounts
        )
      );
    });
}


  getSelectedLocationKey(): string | null {
    const venueId = this.getSelectedLocationId();
    const venues = this.locationsSubject.value;

    const selectedVenue = venues.find(v => v.location_id === venueId);
    return selectedVenue?.name ?? null;
  }


  getSelectedLocationId(): string | null {
    const id = this.selectedLocationIdSubject.value;
    if (id) return id;

    const saved = localStorage.getItem('selectedLocationId');
    if (saved) {
      this.selectedLocationIdSubject.next(saved);
      return saved;
    }

    return null;
  }
  
  // private getHeaders(): { [key: string]: string } {
  //   const sessionData = localStorage.getItem('sessionData');
  //   const token = sessionData ? JSON.parse(sessionData).token : null;
  
  //   if (!token) {
  //     console.error('No API key found, user needs to log in.');
  //     throw new Error('Unauthorized: No API key found');
  //   }
  
  //   return {
  //     Authorization: token,
  //     'Content-Type': 'application/json',
  //   };
  // }

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


  getDarkModeEnabled = (): boolean =>
    localStorage.getItem(this.DARK_MODE_ENABLED) === 'true' && this.isLoggedIn;

  setDarkModeEnabled = (value: boolean): void => {
    localStorage.setItem(this.DARK_MODE_ENABLED, JSON.stringify(value));
    this.isDarkModeEnabled.next(value);
    this.updateTheme();
  };

  updateTheme(): void {
    this.getDarkModeEnabled()
      ? this.document.body.classList.add('dark-mode')
      : this.document.body.classList.remove('dark-mode');
  }

  async getUserNotifications(): Promise<any> {
    try {
      const userId = this.authService.getCurrentUser().id;
      const url = `${environment.apiUrl}/notifications/all?userId=${userId}`;

      const response = await CapacitorHttp.get({ 
        url, 
        headers: this.getHeaders()
      });
      
      return response.data;
    } catch (error) {
      console.error('Error fetching user notifications:', JSON.stringify(error));
      return null;
    }
  }
  
  async markNotificationAsRead(notificationId: number): Promise<any> {
    try {
      const url = `${environment.apiUrl}/notifications/mark-read/${notificationId}`;

      const response = await CapacitorHttp.put({
        url,
        headers: this.getHeaders(),
        data: {},
      });

      return response.data;
    } catch (error) {
      console.error('Error marking notification as read:', JSON.stringify(error));
      return null;
    }
  }
  
  async markAllNotificationsAsRead(userId: number): Promise<any> {
    try {
      const url = `${environment.apiUrl}/notifications/mark-all-read`;

      const response = await CapacitorHttp.put({
        url,
        headers: this.getHeaders(),
        data: { userId },
      });

      return response.data;
    } catch (error) {
      console.error('Error marking all notifications as read:', JSON.stringify(error));
      return null;
    }
  }
  
  async deleteNotification(notificationId: number): Promise<any> {
    try {
      const url = `${environment.apiUrl}/notifications/delete/${notificationId}`;

      const response = await CapacitorHttp.delete({ 
        url, 
        headers: this.getHeaders() 
      });

      return response.data;
    } catch (error) {
      console.error('Error deleting notification:', JSON.stringify(error));
      return null;
    }
  }
  
  async deleteAllNotifications(userId: number): Promise<any> {
    try {
      const url = `${environment.apiUrl}/notifications/delete-all`;

      const response = await CapacitorHttp.delete({
        url,
        headers: this.getHeaders(),
        data: { userId },
      });

      return response.data;
    } catch (error) {
      console.error('Error deleting all notifications:', JSON.stringify(error));
      return null;
    }
  }

  private isDarkModeEnabled = new BehaviorSubject<boolean>(
    this.getDarkModeEnabled()
  );
  isDarkModeEnabled$ = this.isDarkModeEnabled.asObservable();

  getCarouselImages(): Observable<any> {
    const url = `${environment.apiUrl}/banner/images`;

    const location_id = this.getSelectedLocationId();
  
    const params: any = {};
    if (location_id) {
      params.location_id = location_id;
    }

    const options = {
      method: 'GET',
      params,
      url,
      headers: { 'x-auth-api-key': environment.db_api_key } // Add headers
    };
  
    return from(CapacitorHttp.request(options)).pipe(
      map((response: any) => response.data) // Extract the `data` property
    );
  }

  getActiveBanners(): Observable<any[]> {
    const url = `${environment.apiUrl}/banner/active`;
    const location_id = this.getSelectedLocationId();

    const params: any = {};
    if (location_id) params.location_id = location_id;

    const options = {
      method: 'GET',
      url,
      params,
      headers: { 'x-auth-api-key': environment.db_api_key },
    };

    return from(CapacitorHttp.request(options)).pipe(
      map((res: any) => res.data),
      catchError((err) => {
        console.error('Failed to fetch active banners:', err);
        return [];
      })
    );
  }


  async sendMessage(name: string, email: string, message: string) {
    const emailData = {
      subject: `New Message from ${name}`,  // ✅ Use backticks for template literals
      message: `Name: ${name}\nEmail: ${email}\nMessage: ${message}`  // ✅ Properly format string
    };

    const options = {
      url: `${environment.apiUrl}/businesses/send-email`,  // ✅ Fix missing backticks
      method: 'POST',
      headers: { 
        'x-auth-api-key': environment.db_api_key,
        'Content-Type': 'application/json'  // ✅ Ensure correct content type
      },
      data: emailData  // ✅ Ensure proper structure
    };

    try {
      const response = await CapacitorHttp.request(options);
      return response;
    } catch (error) {
      console.error('Error sending email', error);
      throw error;
    }
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

    const response = await CapacitorHttp.request(options);
    return response.data;
  }

  async checkAddressInZone(businessId: number, address: string): Promise<{ inZone: boolean, lat: number, lng: number }> {
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
  
  fetchLoyaltyConfig(): Observable<any> {

    const location_id = this.getSelectedLocationId() ?? '';
    const options = {
      url: `${environment.apiUrl}/businesses/loyalty${location_id ? `?location_id=${location_id}` : ''}`,
      method: 'GET',
      headers: this.getHeaders()
    };

    return from(CapacitorHttp.request(options).then(response => response.data));
  }

  async getDiscounts(): Promise<any[]> {
    const location_id = this.getSelectedLocationId() ?? '';
    const options = {
      url: `${environment.apiUrl}/alpine/discounts${location_id ? `?location_id=${location_id}` : ''}`,
      method: 'GET',
      headers: { 'x-auth-api-key': environment.db_api_key },
    };

    try {
      const response = await CapacitorHttp.request(options);

      console.log('Fetched discounts:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching discounts:', error);
      return [];
    }
  }
  
}
