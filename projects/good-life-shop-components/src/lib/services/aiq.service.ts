import { Injectable } from '@angular/core';
import { CapacitorHttp } from '@capacitor/core';
import { BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AppliedDiscount {
  id: string;
  name: string;

  dollarValue?: number;
  percentageValue?: number;

  pointsDeduction?: number;
  tierDiscount?: boolean;
  reusable?: boolean;

  posDiscountID?: string;
  internalName?: string;
}

@Injectable({ providedIn: 'root' })
export class AiqService {
  private discountKey = 'applied_discount';

  private appliedDiscountSubject =
    new BehaviorSubject<AppliedDiscount | null>(this.load());

  appliedDiscount$ = this.appliedDiscountSubject.asObservable();

  /** 🔹 Public API */

  setDiscount(discount: AppliedDiscount | null) {
    this.appliedDiscountSubject.next(discount);

    if (discount) {
      sessionStorage.setItem(this.discountKey, JSON.stringify(discount));
    } else {
      sessionStorage.removeItem(this.discountKey);
    }
  }

  clearDiscount() {
    this.setDiscount(null);
  }

  getAppliedDiscount(): AppliedDiscount | null {
    return this.appliedDiscountSubject.value;
  }

  hasDiscount(): boolean {
    return !!this.appliedDiscountSubject.value;
  }

  /** 🔹 Checkout helpers */

  buildRedemptionsPayload() {
    const d = this.getAppliedDiscount();
    if (!d) return undefined;

    return [
      {
        redemptionType: 'Alpine IQ',
        redemptionId: d.id,
        redemptionDescription: d.internalName || d.name,
      }
    ];
  }

  getPointsDeduction(): number {
    return this.getAppliedDiscount()?.pointsDeduction ?? 0;
  }

  /** 🔹 Private */

  private load(): AppliedDiscount | null {
    const saved = sessionStorage.getItem(this.discountKey);
    return saved ? JSON.parse(saved) : null;
  }

  async getDiscounts(): Promise<any[]> {
    const options = {
      url: `${environment.apiUrl}/alpine/discounts`,
      method: 'GET',
      headers: { 'x-auth-api-key': environment.db_api_key },
    };

    try {
      const response = await CapacitorHttp.request(options);
      return response.data;
    } catch (error) {
      console.error('Error fetching discounts:', error);
      return [];
    }
  }
}
