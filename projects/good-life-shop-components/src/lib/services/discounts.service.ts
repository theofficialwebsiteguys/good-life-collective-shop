import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment.prod';
import { AppliedDiscount } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class DiscountsService {
  private discounts$ = new BehaviorSubject<any[]>([]);

  constructor(private http: HttpClient) {}

  loadDiscounts(location_id: string): Observable<any> {
    return this.http.get<{ discounts: any[] }>(
      `${environment.apiUrl}/discount`,
      {
        params: { location_id },
        headers: {
          'x-auth-api-key': environment.db_api_key
        }
      }
    ).pipe(
      tap(res => this.discounts$.next(res.discounts || []))
    );
  }

  setDiscounts(discounts: any[]) {
    this.discounts$.next(discounts);
  }

  getDiscounts(): Observable<any[]> {
    return this.discounts$.asObservable();
  }

 applyDiscountsToProducts(products: any[], discounts: any[]): any[] {
  if (!Array.isArray(products) || !products.length) return products;
  if (!Array.isArray(discounts) || !discounts.length) return products;

  const now = new Date();

  return products.map(product => {
    const applied: AppliedDiscount[] = [];

    discounts.forEach(d => {
      if (!d.active) return;

      /* ===========================
        ⏱ Scheduling
      =========================== */
      if (d.is_scheduled) {
        if (d.schedule_start && now < new Date(d.schedule_start)) return;
        if (d.schedule_end && now > new Date(d.schedule_end)) return;
      }
      /* ===========================
        🎯 BOGO (needs rules)
      =========================== */
     if (d.type === 'bogo') {
        const rules = d.rules;
        if (!rules?.buy || !Array.isArray(rules.gets)) return;

        const buy = rules.buy;

        const isBuy =
          (buy.type === 'product' &&
            Array.isArray(buy.product_ids) &&
            buy.product_ids.includes(product.id)) ||
          (buy.type === 'brand' && buy.brand === product.brand) ||
          (buy.type === 'category' && buy.category === product.category);

        const isGet = rules.gets.some((g: any) =>
          g.type === 'product' && g.product_id === product.id
        );

        if (!isBuy && !isGet) return;

        for (const g of rules.gets) {
          applied.push({
            name: d.name || 'BOGO',
            description: d.description,
            kind: 'bogo',
            buyQty: Math.max(1, Number(buy.quantity || 1)),
            getQty: Math.max(1, Number(g.quantity || 1)),
            discountType: g.discount_type || 'percent',
            discountValue: Number(g.discount ?? 0),
            getProductId: g.product_id ?? null,
            banner_image_url: d.banner_image_url || '',

            /** 👇 THIS IS WHAT UNLOCKS EVERYTHING */
            role: isGet ? 'get' : 'buy',
          });
        }
        return;
      }


      /* ===========================
        📦 BUNDLE PRICE
      =========================== */
     if (d.type === 'bundle') {
      const rules = d.rules;
      if (!Array.isArray(rules?.products)) return;

      const productIds = rules.products.map((p: any) => String(p.product_id));
      if (!productIds.includes(String(product.id))) return;

      console.log(productIds)

      applied.push({
        name: d.name || 'Bundle Deal',
        kind: 'bundle',
        bundleSize: productIds.length,
        description: d.description,
        bundlePrice: Number(d.value ?? rules.price ?? 0),

        // ✅ THIS IS THE KEY
        products: rules.products,

        banner_image_url: d.banner_image_url || '',
      });

      return;
    }

    /* ===========================
      💲 PERCENT / FLAT (RULE-BASED)
    =========================== */
    if (d.type === 'percent' || d.type === 'flat') {
      const rules = d.rules;
      if (!Array.isArray(rules?.purchaseRules)) return;

      const matchedRule = rules.purchaseRules.find((r: any) => {
        if (r.productIds?.length) {
          return r.productIds.map(String).includes(String(product.id));
        }

        if (r.brands?.length) {
          return r.brands.includes(product.brand);
        }

        if (r.categories?.length) {
          return r.categories.includes(product.category);
        }

        return true;
      });

      if (!matchedRule) return;

      const minQty = Math.max(1, Number(matchedRule.minQty ?? 1));
      const basePrice = Number(product.price);
      const value = Number(d.value ?? 0);

      if (!basePrice || value <= 0) return;

      let discountedPrice = basePrice;

      if (d.type === 'percent') {
        discountedPrice = basePrice - basePrice * (value / 100);
      } else {
        // ✅ flat discount is TOTAL across minQty, so spread it
        const perItemOff = value / minQty;
        discountedPrice = basePrice - perItemOff;
      }

     applied.push({
      name: d.name || 'Discount',
      kind: d.type,
      value,
      discountedPrice: Math.max(discountedPrice, 0),
      description: d.description,
      banner_image_url: d.banner_image_url || '',
      minQty,
      rule: matchedRule,

      ...(d.type === 'flat'
        ? { totalOff: value, perItemOff: value / minQty }
        : {}),
    });

      return;
    }

    });

    return { ...product, discounts: applied };
  });
}


}
