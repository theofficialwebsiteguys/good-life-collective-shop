import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { from, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment.prod';
import { v4 as uuidv4 } from 'uuid';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root'
})
export class AeropayService {
  private merchantToken: string | null = null;
  private usedForMerchantToken: string | null = null;

  constructor(private settingsService: SettingsService) {}

  private async httpPost(url: string, data: any, token?: string): Promise<any> {
    const headers: any = {
      'Content-Type': 'application/json',
      'accept': 'application/json',
      ...(token ? { 'authorizationToken': `Bearer ${token}` } : {})
    };
  
    // Add 'X-API-Version': '1.1' if the request is for creating a user
    if (url.includes('/user')) {
      headers['X-API-Version'] = '1.1';
    }
  
    const options: any = {
      url: url,
      headers: headers,
      data: data,
    };
  
    return CapacitorHttp.post(options);
  }

  private async httpGet(url: string, token?: string): Promise<any> {
    const options: any = {
      url: url,
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        ...(token ? { 'authorizationToken': `Bearer ${token}` } : {})
      }
    };
    return CapacitorHttp.get(options);
  }

  fetchMerchantToken(): Observable<any> {
    const payload = {
      scope: 'merchant',
      api_key: environment.aeropay_api_key,
      api_secret: environment.aeropay_api_secret,
      id: environment.aeropay_merchant_id
    };
    return from(this.httpPost(`${environment.aeropay_url}/token`, payload)).pipe(
      tap(response => {
        if (response.data?.token) {
          this.setMerchantToken(response.data.token, response.data.TTL);
        }
      })
    );
  }

  fetchUsedForMerchantToken(userId: any): Observable<any> {
    const payload = {
      scope: 'userForMerchant',
      api_key: environment.aeropay_api_key,
      api_secret: environment.aeropay_api_secret,
      id: environment.aeropay_merchant_id,
      userId: userId
    };
    return from(this.httpPost(`${environment.aeropay_url}/token`, payload)).pipe(
      tap(response => {
        if (response.data?.token) {
          this.setUsedForMerchantToken(response.data.token, response.data.TTL);
        }
      })
    );
  }

  createUser(userData: any): Observable<any> {
    return from(this.httpPost(`${environment.aeropay_url}/user`, userData, this.getMerchantToken() || '')).pipe(
      tap(response => console.log(response))
    );
  }

  verifyUser(userId: string, code: string): Observable<any> {
    return from(this.httpPost(`${environment.aeropay_url}/confirmUser`, { userId, code }, this.getMerchantToken() || '')).pipe(
      tap(response => console.log(response))
    );
  }

  getAerosyncCredentials(): Observable<any> {
    return from(this.httpGet(`${environment.aeropay_url}/aggregatorCredentials?aggregator=aerosync`, this.getUsedForMerchantToken() || '')).pipe(
      tap(response => console.log(response))
    );
  }

  linkBankAccount(userId: string, userPassword: string): Observable<any> {
    const payload = {
      user_id: userId,
      user_password: userPassword,
      aggregator: 'aerosync'
    };
    return from(this.httpPost(`${environment.aeropay_url}/linkAccountFromAggregator`, payload, this.getUsedForMerchantToken() || '')).pipe(
      tap(response => console.log(response))
    );
  }

  createTransaction(amount: string, bankAccountId: string | null): Observable<any> {
    const transactionUUID = uuidv4();

    const locationKey = this.settingsService.getSelectedLocationKey();

    let merchantId = environment.aeropay_merchant_id; // Default
    if (locationKey?.toLowerCase() === 'canandaigua') {
      merchantId = environment.aeropay_merchant_id_canandaigua;
    }
    
    const payload = {
      amount: amount,
      merchantId: merchantId,
      uuid: transactionUUID,
      bankAccountId: bankAccountId
    };
    return from(this.httpPost(`${environment.aeropay_url}/transaction`, payload, this.getUsedForMerchantToken() || '')).pipe(
      tap(response => console.log(response))
    );
  }

  setMerchantToken(token: string, ttl: number): void {
    this.merchantToken = token;
  }

  getMerchantToken(): string | null {
    return this.merchantToken;
  }

  isMerchantTokenValid(): boolean {
    return this.getMerchantToken() !== null;
  }

  setUsedForMerchantToken(token: string, ttl: number): void {
    this.usedForMerchantToken = token;
  }

  getUsedForMerchantToken(): string | null {
    return this.usedForMerchantToken;
  }

  isUsedForMerchantTokenValid(): boolean {
    return this.getUsedForMerchantToken() !== null;
  }
  
}
