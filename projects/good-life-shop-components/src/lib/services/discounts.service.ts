import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment.prod';
import { AppliedDiscount, ProductFilter } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class DiscountsService {
  private readonly discounts$ = new BehaviorSubject<any[]>([]);

  constructor(private readonly http: HttpClient) {}

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

  // ── Helpers ──────────────────────────────────────────────────────────────

  /**
   * ProductFilter matching — exact logic from API contract.
   * excludedProductIds checked first, then includedProductIds takes priority
   * over category/brand/weight. Empty arrays mean "any".
   */
  private matchesFilter(product: any, filter: ProductFilter): boolean {
    const { categories, brands, weight, excludedProductIds, includedProductIds } = filter ?? {};
    if (excludedProductIds?.includes(String(product.id))) return false;
    if (includedProductIds?.length) return includedProductIds.includes(String(product.id));
    if (categories?.length && !categories.includes(product.category)) return false;
    if (brands?.length && !brands.includes(product.brand)) return false;
    if (weight && String(product.weight ?? '').toLowerCase() !== weight.toLowerCase()) return false;
    return true;
  }

  /**
   * Compute post-effect price. Handles all 5 effect types from the contract.
   */
  private computeDiscountedPrice(basePrice: number, effect: any): number {
    if (!effect) return basePrice;
    switch (effect.type) {
      case 'percent_off': return basePrice * (1 - effect.value / 100);
      case 'dollar_off':  return Math.max(0, basePrice - effect.value);
      case 'new_price':   return effect.value;
      case 'penny':       return 0.01;
      case 'free':        return 0;
      default:            return basePrice;
    }
  }

  /**
   * Map an API effect to an AppliedDiscount kind + value.
   * 'flat' is used for dollar_off (preserves existing cart/UI handling).
   * 'free' maps to percent 100.
   */
  private effectToKind(
    effect: any
  ): { kind: 'percent' | 'flat' | 'new_price' | 'penny'; value: number } {
    switch (effect?.type) {
      case 'percent_off': return { kind: 'percent', value: effect.value };
      case 'dollar_off':  return { kind: 'flat',    value: effect.value };
      case 'new_price':   return { kind: 'new_price', value: effect.value };
      case 'penny':       return { kind: 'penny',   value: 0.01 };
      case 'free':        return { kind: 'percent', value: 100 };
      default:            return { kind: 'percent', value: 0 };
    }
  }

  /**
   * Returns true if the discount is currently active based on schedule/recurring rules.
   */
  private isScheduleActive(d: any, now: Date): boolean {
    if (d.is_scheduled) {
      if (d.schedule_start && now < new Date(d.schedule_start)) return false;
      if (d.schedule_end   && now > new Date(d.schedule_end))   return false;
    }

    if (d.is_recurring) {
      const tz = d.timezone || 'UTC';
      const recurringDays: string[] = d.recurring_days || [];

      // Current day-of-week name in the discount's timezone — compare lowercase
      // because recurring_days from the API may be "thursday" not "Thursday"
      const dayName = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz }).toLowerCase();
      if (recurringDays.length && !recurringDays.some((d: string) => d.toLowerCase() === dayName)) return false;

      if (d.recurring_start_time || d.recurring_end_time) {
        const timeStr = now.toLocaleTimeString('en-US', {
          hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz
        });
        if (d.recurring_start_time && timeStr < d.recurring_start_time) return false;
        if (d.recurring_end_time   && timeStr > d.recurring_end_time)   return false;
      }
    }

    return true;
  }

  // ── Per-discount handlers (each keeps complexity low) ────────────────────

  private handleCartSubtotal(d: any, rules: any): AppliedDiscount | null {
    if (!rules.effect) return null;
    return {
      kind: 'cart_subtotal',
      discount_id: d.id,
      name: d.name || 'Discount',
      description: d.description,
      effect: rules.effect,
      is_exclusive: !!d.is_exclusive,
      requires_min_subtotal: !!d.requires_min_subtotal,
      min_subtotal_amount: d.min_subtotal_amount ?? null,
      banner_image_url: d.banner_image_url || '',
    } as AppliedDiscount;
  }

  private handleProductDiscount(d: any, rules: any, product: any): AppliedDiscount | null {
    if (!Array.isArray(rules.ruleSets) || !rules.effect) return null;
    const matchedRuleSet = rules.ruleSets.find((rs: any) => this.matchesFilter(product, rs.filter ?? {}));
    if (!matchedRuleSet) return null;

    const applyMode: 'per_item' | 'threshold' = rules.applyMode ?? 'per_item';
    const qty = matchedRuleSet.qty ?? 1;
    const basePrice = Number(product.price) || 0;
    const { kind, value } = this.effectToKind(rules.effect);
    const discountedPrice = this.computeDiscountedPrice(basePrice, rules.effect);

    const entry: any = {
      kind, value,
      name: d.name || 'Discount',
      description: d.description,
      discountedPrice: Math.max(discountedPrice, 0),
      minQty: qty, applyMode,
      is_exclusive: !!d.is_exclusive,
      requires_min_subtotal: !!d.requires_min_subtotal,
      min_subtotal_amount: d.min_subtotal_amount ?? null,
      rule: { qty, filter: matchedRuleSet.filter ?? {}, applyMode },
      banner_image_url: d.banner_image_url || '',
    };
    if (kind === 'flat' && applyMode === 'threshold') {
      entry.totalOff = value;
      entry.perItemOff = value / qty;
    }
    return entry as AppliedDiscount;
  }

  private effectToBogo(getEffect: any, price: number): { discountType: 'percent' | 'flat'; discountValue: number } {
    switch (getEffect?.type) {
      case 'percent_off': return { discountType: 'percent', discountValue: getEffect.value };
      case 'dollar_off':  return { discountType: 'flat',    discountValue: getEffect.value };
      case 'penny':       return { discountType: 'flat',    discountValue: Math.max(0, price - 0.01) };
      case 'new_price':   return { discountType: 'flat',    discountValue: Math.max(0, price - getEffect.value) };
      default:            return { discountType: 'percent', discountValue: 100 }; // 'free'
    }
  }

  private handleBuyGet(d: any, rules: any, product: any): AppliedDiscount | null {
    const buyRuleSets: any[] = rules.buyRuleSets ?? [];
    const getRuleSets: any[] = rules.getRuleSets ?? [];
    if (!buyRuleSets.length || !getRuleSets.length) return null;

    const matchedBuy = buyRuleSets.find((rs: any) => this.matchesFilter(product, rs.filter ?? {}));
    const isBuy = !!matchedBuy;
    const matchedGet = getRuleSets.find((rs: any) =>
      rs.sameAsBuys === true ? isBuy : this.matchesFilter(product, rs.filter ?? {})
    );
    const isGet = !!matchedGet;
    if (!isBuy && !isGet) return null;

    const buyRuleSet = matchedBuy ?? buyRuleSets[0];
    const getRuleSet = matchedGet ?? getRuleSets[0];
    const getEffect = getRuleSet?.effect ?? { type: 'free', value: 0 };
    const { discountType, discountValue } = this.effectToBogo(getEffect, Number(product.price));
    const getProductId: string | null = (!getRuleSet?.sameAsBuys && getRuleSet?.filter?.includedProductIds?.length)
      ? getRuleSet.filter.includedProductIds[0] : null;

    return {
      kind: 'bogo',
      name: d.name || 'Buy & Get',
      description: d.description,
      buyQty: Math.max(1, Number(buyRuleSet?.qty ?? 1)),
      getQty: Math.max(1, Number(getRuleSet?.qty ?? 1)),
      discountType, discountValue, getProductId,
      // isBuy takes precedence — sameAsBuys products are both buy and get, treat as 'buy'
      // so they count as qualifiers; applyBogoPricing handles the formula adjustment
      role: isBuy ? 'buy' : 'get',
      is_exclusive: !!d.is_exclusive,
      requires_min_subtotal: !!d.requires_min_subtotal,
      min_subtotal_amount: d.min_subtotal_amount != null ? Number(d.min_subtotal_amount) : null,
      banner_image_url: d.banner_image_url || '',
    } as AppliedDiscount;
  }

  private handleBundle(d: any, rules: any, product: any): AppliedDiscount | null {
    const bundleProducts: any[] = d.bundle_products?.length ? d.bundle_products : (rules.products ?? []);
    const productIds = bundleProducts.map((p: any) => String(p.product_id));
    if (!productIds.includes(String(product.id))) return null;

    const effect = rules.effect ?? { type: 'new_price', value: 0 };
    const bundlePrice = effect.type === 'new_price' ? effect.value : Number(d.value ?? 0);

    return {
      kind: 'bundle',
      name: d.name || 'Bundle Deal',
      description: d.description,
      bundleSize: productIds.length,
      bundlePrice, products: bundleProducts,
      is_exclusive: !!d.is_exclusive,
      banner_image_url: d.banner_image_url || '',
    } as AppliedDiscount;
  }

  /** Old format: rules.purchaseRules + rules.reward */
  private handleLegacyPercent(d: any, rules: any, product: any): AppliedDiscount | null {
    if (!Array.isArray(rules.purchaseRules) || !rules.reward) return null;
    const reward = rules.reward;
    const discountType: string = reward.discountType ?? 'percent';
    const discountValue: number = Number(reward.discountValue ?? d.value ?? 0);

    const matchedRule = rules.purchaseRules.find((r: any) => {
      const ids  = (r.productIds ?? []).map(String);
      const brands: string[] = r.brands ?? [];
      const cats: string[]   = r.categories ?? [];
      if (ids.length && !ids.includes(String(product.id))) return false;
      if (brands.length && !brands.includes(product.brand)) return false;
      if (cats.length && !cats.includes(product.category)) return false;
      return true;
    });
    if (!matchedRule) return null;

    const qty = Number(matchedRule.minQty ?? reward.minQty ?? 1);
    const basePrice = Number(product.price) || 0;
    const kind: 'percent' | 'flat' = discountType === 'percent' ? 'percent' : 'flat';
    const discountedPrice = kind === 'percent'
      ? basePrice * (1 - discountValue / 100)
      : Math.max(0, basePrice - discountValue);

    const entry: any = {
      kind, value: discountValue,
      name: d.name || 'Discount',
      description: d.description,
      discountedPrice: Math.max(discountedPrice, 0),
      minQty: qty, applyMode: 'per_item',
      is_exclusive: !!d.is_exclusive,
      requires_min_subtotal: !!d.requires_min_subtotal,
      min_subtotal_amount: d.min_subtotal_amount ?? null,
      rule: {
        qty,
        filter: {
          includedProductIds: (matchedRule.productIds ?? []).map(String),
          brands: matchedRule.brands ?? [],
          categories: matchedRule.categories ?? [],
        },
        applyMode: 'per_item',
      },
      banner_image_url: d.banner_image_url || '',
    };
    if (kind === 'flat' && qty > 1) { entry.totalOff = discountValue; entry.perItemOff = discountValue / qty; }
    return entry as AppliedDiscount;
  }

  /** Old format: rules.buy + rules.gets */
  private handleLegacyBogo(d: any, rules: any, product: any): AppliedDiscount[] {
    if (!rules.buy || !Array.isArray(rules.gets)) return [];
    const buy = rules.buy;
    const isBuy =
      (buy.type === 'product'  && (buy.product_ids ?? []).map(String).includes(String(product.id))) ||
      (buy.type === 'brand'    && buy.brand    && buy.brand    === product.brand)   ||
      (buy.type === 'category' && buy.category && buy.category === product.category);

    return rules.gets
      .filter((g: any) => {
        const isGet =
          (g.type === 'product'  && g.product_id && String(g.product_id) === String(product.id)) ||
          (g.type === 'brand'    && g.brand      && g.brand    === product.brand)   ||
          (g.type === 'category' && g.category   && g.category === product.category);
        return isBuy || isGet;
      })
      .map((g: any) => ({
        kind: 'bogo' as const,
        name: d.name || 'BOGO',
        description: d.description,
        buyQty: Math.max(1, Number(buy.quantity ?? 1)),
        getQty: Math.max(1, Number(g.quantity ?? 1)),
        discountType: g.discount_type === 'percent' ? 'percent' : 'flat',
        discountValue: Number(g.discount ?? 0),
        getProductId: g.product_id ? String(g.product_id) : null,
        role: 'buy' as const,   // refined per-item in applyBogoPricing
        is_exclusive: !!d.is_exclusive,
        banner_image_url: d.banner_image_url || '',
      } as AppliedDiscount));
  }

  // ── Routing helpers ───────────────────────────────────────────────────────

  private routeNewFormat(d: any, rules: any, product: any): AppliedDiscount | null {
    switch (rules.discount_type) {
      case 'cart_subtotal': return this.handleCartSubtotal(d, rules);
      case 'product':       return this.handleProductDiscount(d, rules, product);
      case 'buy_get':       return this.handleBuyGet(d, rules, product);
      case 'bundle':        return this.handleBundle(d, rules, product);
      default:              return null;
    }
  }

  private routeLegacyFormat(d: any, rules: any, product: any): AppliedDiscount[] {
    const pct = this.handleLegacyPercent(d, rules, product);
    if (pct) return [pct];
    return this.handleLegacyBogo(d, rules, product);
  }

  private applyOneDiscount(d: any, product: any): AppliedDiscount[] {
    let rules: any;
    try {
      rules = typeof d.rules === 'string' ? JSON.parse(d.rules) : d.rules;
    } catch { return []; }

    if (rules?.discount_type) {
      const result = this.routeNewFormat(d, rules, product);
      return result ? [result] : [];
    }
    return this.routeLegacyFormat(d, rules, product);
  }

  // ── Main Method ───────────────────────────────────────────────────────────

  applyDiscountsToProducts(products: any[], discounts: any[]): any[] {
    if (!Array.isArray(products) || !products.length) return products;
    if (!Array.isArray(discounts) || !discounts.length) return products;

    const now = new Date();
    const activeDiscounts = discounts.filter(d => d.active && this.isScheduleActive(d, now));

    return products.map(product => {
      const applied = activeDiscounts.flatMap(d => this.applyOneDiscount(d, product));
      const exclusives = applied.filter(a => (a as any).is_exclusive);
      return { ...product, discounts: exclusives.length > 0 ? exclusives : applied };
    });
  }
}
