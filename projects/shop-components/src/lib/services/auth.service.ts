import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import {
  BehaviorSubject,
  filter,
  Observable
} from 'rxjs';
import { environment } from '../../environments/environment';
import { ProductsService } from './products.service';
import { Product } from '../models/product.model';
import { CapacitorHttp } from '@capacitor/core';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private userSubject = new BehaviorSubject<any>(null); 

  private authStatus = new BehaviorSubject<boolean>(this.hasToken());

  private enrichedOrders = new BehaviorSubject<any[]>([]);

  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient, private router: Router, private productsService: ProductsService) {
    const user = localStorage.getItem('user_info');
    if (user) {
      this.userSubject.next(JSON.parse(user));
    }
  }


  private getHeaders(): { [key: string]: string } {
    const sessionData = localStorage.getItem('sessionData');
    const token = sessionData ? JSON.parse(sessionData).token : null;
  
    if (!token) {
      console.error('No API key found, user needs to log in.');
      throw new Error('Unauthorized: No API key found');
    }
  
    return {
      Authorization: token, // Ensure correct Bearer token format
      'Content-Type': 'application/json', // Optional, ensures JSON data format
    };
  }
  

  getUserInfo(): any {
    return this.userSubject.asObservable();
  }

  getCurrentUser() {
    return this.userSubject.value;
  }

  isLoggedIn(): Observable<boolean> {
    return this.authStatus.asObservable();
  }

  register(userData: any): Observable<any> {
    const defaultValues = { points: 0, business_id: 1 };
    const payload = { ...userData, ...defaultValues };

    return new Observable((observer) => {
      CapacitorHttp.post({
        url: `${this.apiUrl}/register`,
        headers: { 'Content-Type': 'application/json' },
        data: payload,
      })
        .then((response) => {
          this.login({
            email: userData.email,
            password: userData.password,
          }).subscribe();
          observer.next(response.data);
          observer.complete();
        })
        .catch((error) => observer.error(error));
    });
  }

  login(credentials: { email: string; password: string }): Observable<any> {
    const payload = {
      ...credentials,
      businessId: '1',
      businessName: 'Flower Power Dispensers',
    };

    return new Observable((observer) => {
      CapacitorHttp.post({
        url: `${this.apiUrl}/login`,
        headers: { 'Content-Type': 'application/json' },
        data: payload,
      })
        .then((response) => {
          if (response.status === 200) {
            const { sessionId, user, expiresAt } = response.data;
            this.storeSessionData(sessionId, expiresAt);
            this.authStatus.next(true);
            this.userSubject.next(user);
            this.storeUserInfo(user);
            this.router.navigateByUrl('/rewards');
            this.validateSession();
            observer.next(response.data);
            observer.complete();
          } else {
            observer.error(response);
          }
        })
        .catch((error) => observer.error(error));
    });
  }


  logout(): void {
    const headers = this.getHeaders();

    CapacitorHttp.post({
      url: `${this.apiUrl}/logout`,
      headers,
      data: {},
    })
      .then(() => {
        this.removeToken();
        this.authStatus.next(false);
        this.userSubject.next(null);
        this.router.navigate(['/rewards']);
        this.removeUser();
      })
      .catch((error) => console.error('Logout failed:', error));
  }

  private storeSessionData(sessionId: string, expiresAt: Date): void {
    const sessionData = {
      token: sessionId,
      expiry: expiresAt,
    };
    localStorage.setItem('sessionData', JSON.stringify(sessionData));
  }

  private storeUserInfo(user: any) {
    localStorage.setItem('user_info', JSON.stringify(user));
    this.userSubject.next(user);
  }

  private getSessionData(): { token: string; expiry: Date } | null {
    const sessionData = localStorage.getItem('sessionData');
    return sessionData ? JSON.parse(sessionData) : null;
  }

  private removeToken(): void {
    localStorage.removeItem('sessionData');
  }

  private removeUser(): void {
    localStorage.removeItem('user_info');
  }

  private hasToken(): boolean {
    return !!this.getSessionData();
  }

  isTokenExpired(expiry: Date): boolean {
    const currentTime = new Date().getTime(); 
    const expiryTime = new Date(expiry).getTime(); 
    return currentTime >= expiryTime;
  }

  sendPasswordReset(email: string): Observable<void> {
    return new Observable((observer) => {
      CapacitorHttp.post({
        url: `${this.apiUrl}/forgot-password`,
        headers: { 'Content-Type': 'application/json' },
        data: { email, business_id: 1 },
      })
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch((error) => observer.error(error));
    });
  }

  resetPassword(password: string, token: string | null): Observable<void> {
    return new Observable((observer) => {
      CapacitorHttp.post({
        url: `${this.apiUrl}/reset-password?token=${token}`,
        headers: { 'Content-Type': 'application/json' },
        data: { password },
      })
        .then(() => {
          observer.next();
          observer.complete();
        })
        .catch((error) => observer.error(error));
    });
  }

  validateSession(): void {
    const sessionData = this.getSessionData();

    if (!sessionData || this.isTokenExpired(sessionData.expiry)) {
      this.authStatus.next(false);
      this.removeToken();
      this.removeUser();
      return;
    }

    const headers = this.getHeaders();

    CapacitorHttp.get({
      url: `${this.apiUrl}/validate-session`,
      headers,
    })
      .then((response) => {
        if (response.status === 200) {
          this.authStatus.next(true);
          this.updateUserData();
          this.handleRecentOrders(response.data.orders);
          this.setAuthTokensAlleaves(response.data.authTokens?.alleaves);
        } else {
          this.authStatus.next(false);
          this.logout();
        }
      })
      .catch(() => {
        this.authStatus.next(false);
        this.logout();
      });
  }

  updateUserData(): void{
    const sessionData = localStorage.getItem('sessionData');
    const token = sessionData ? JSON.parse(sessionData).token : null;

    if (!token) {
      this.logout();
    }
    const headers = this.getHeaders();

    CapacitorHttp.get({
      url: `${this.apiUrl}/id/${this.getCurrentUser().id}`,
      headers,
    })
      .then((response) => {
        if (response.status === 200) {
          this.storeUserInfo(response.data);
        }
      })
      .catch((error) => console.error('Error updating user:', error));
  }

  // toggleUserNotifications(userId: string) {
  //   const sessionData = localStorage.getItem('sessionData');
  //   const token = sessionData ? JSON.parse(sessionData).token : null;

  //   if (!token) {
  //     this.logout();
  //   }

  //   const headers = new HttpHeaders({
  //     Authorization: token,
  //   });

  //   const payload = { userId };

  //   return this.http
  //     .put(`${this.apiUrl}/toggle-notifications`, payload, { headers })
  //     .pipe(
  //       tap((response: any) => {

  //         this.storeUserInfo(response.user);
  //       }),
  //       catchError((error) => {
  //         console.error('Error toggling notifications:', error);
  //         return throwError(() => error);
  //       })
  //     );
  // }

  validateResetToken(token: string): Observable<any> {
    return new Observable((observer) => {
      CapacitorHttp.get({
        url: `${this.apiUrl}/validate-reset-token`,
        headers: { 'Content-Type': 'application/json' },
        params: { token },
      })
        .then((response) => {
          observer.next(response.data);
          observer.complete();
        })
        .catch((error) => observer.error(error));
    });
  }

  get orders() {
    return this.enrichedOrders.asObservable(); // ✅ Always emits, even if empty
  }
  


  handleRecentOrders(orders: any[]) {
    this.productsService.getProducts().subscribe((products: Product[]) => {
      const enrichedOrders = orders.map((order) => ({
        ...order,
        items: Object.entries(order.items)
          .map(([posProductId, quantity]) => {
            const product = products.find((p) => p.posProductId == posProductId);
            return product ? { ...product, quantity } : null;
          })
          .filter((item) => item !== null),
      }));
      this.enrichedOrders.next(enrichedOrders);
    });
  }
  
  setAuthTokensAlleaves(alleaves: any): void {
    sessionStorage.removeItem('authTokensAlleaves');
    if (alleaves) {
      sessionStorage.setItem('authTokensAlleaves', JSON.stringify(alleaves));
    }
  }

  async getUserOrders(): Promise<any> {
    try {
      const response = await CapacitorHttp.get({
        url: `${environment.apiUrl}/orders/user`,
        headers: this.getHeaders(),
        params: { user_id: String(this.getCurrentUser().id) }, // Ensure it's a string
      });
  
      console.log("API Response:", response);
      console.log("Response Data Type:", typeof response.data);
  
      // Handle cases where the response is not an object
      if (typeof response.data === "number") {
        response.data = String(response.data); // Convert to string
      }
  
      // Ensure JSON parsing if needed
      try {
        if (typeof response.data === "string") {
          response.data = JSON.parse(response.data);
        }
      } catch (e) {
        console.warn("Failed to parse response:", e);
      }
  
      this.handleRecentOrders(response.data);
      this.updateUserData();
  
      return response.data;
    } catch (error) {
      console.error("Error fetching user orders:", error);
      throw error;
    }
  }
  


}
