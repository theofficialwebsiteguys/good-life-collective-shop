import { Inject, Injectable } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { BehaviorSubject, catchError, from, map, Observable } from 'rxjs';

import { AuthService } from './auth.service';
import { environment } from '../../environments/environment.prod';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { CapacitorHttp, HttpResponse } from '@capacitor/core';
import { ProductsService } from './products.service';
import { NavigationService } from './navigation.service';

export interface Banner {
  image: string;
  link?: string;
  brand?: string;
  ctaText?: string;
  shop?: boolean;
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

  constructor(
    @Inject(DOCUMENT) private document: Document,
    private authService: AuthService,
    private http: HttpClient,
    private productsService: ProductsService,
    private navService: NavigationService
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
      const locations = response.data.locations
       .map((location: any) => {
        let key = 'UNKNOWN';

        if (location.name.includes('Rochester')) key = 'ROCHESTER';
        else if (location.name.includes('CANANDAIGUA')) key = 'CANANDAIGUA';

        return {
          ...location,
          key,
        };
      });

      this.locationsSubject.next(locations);
      return locations;
    } catch (error) {
      console.error('Error fetching venues from backend:', error);
      throw error;
    }
  }

  setSelectedLocationId(id: string): void {
    this.selectedLocationIdSubject.next(id);
    localStorage.setItem('selectedLocationId', id);
    this.productsService.fetchProducts(id).subscribe({
      error: (e) => console.error('Error fetching products:', e),
    });
  }

  getSelectedLocationKey(): string | null {
    const venueId = this.getSelectedLocationId();
    const venues = this.locationsSubject.value;

    console.log(venueId)
    console.log(venues)
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
  
  private getHeaders(): { [key: string]: string } {
    const sessionData = localStorage.getItem('sessionData');
    const token = sessionData ? JSON.parse(sessionData).token : null;
  
    if (!token) {
      console.error('No API key found, user needs to log in.');
      throw new Error('Unauthorized: No API key found');
    }
  
    return {
      Authorization: token,
      'Content-Type': 'application/json',
    };
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

  getCarouselImages(): Observable<{ images: Banner[] }> {
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
  
    try {
      const response = await CapacitorHttp.request(options);
      return response.data;
    } catch (error) {
      console.error('Error fetching delivery zone:', error);
      throw error;
    }
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
  
  

  
}
