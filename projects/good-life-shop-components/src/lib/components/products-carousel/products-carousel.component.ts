import { Component, OnInit, ElementRef, ViewChild, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BehaviorSubject, combineLatest, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { Product } from '../../models/product.model';
import { ProductsService } from '../../services/products.service';
import { NavigationService } from '../../services/navigation.service';
import { ProductCardComponent } from '../product-card/product-card.component';

@Component({
  selector: 'lib-products-carousel',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './products-carousel.component.html',
  styleUrl: './products-carousel.component.css'
})
export class ProductsCarouselComponent implements OnInit {
  @ViewChild('productCarousel', { static: false }) productCarousel!: ElementRef<HTMLDivElement>;

  /** NEW: pass a single category to show products from that category only. */
  @Input() set category(v: string | null | undefined) { this.category$.next(v?.trim() || ''); }
  /** Optional: limit number of tiles */
  @Input() set limit(v: number | null | undefined) { this.limit$.next((v ?? 12) | 0); }
  /** Optional: filter by brands as before */
  @Input() set brands(v: string[] | null | undefined) { this.brands$.next(v ?? []); }
  /** Optional: custom heading (defaults to category or “Recent Products”) */
  @Input() set title(v: string | null | undefined) { this.title$.next(v?.trim() || ''); }

  private category$ = new BehaviorSubject<string>('');
  private limit$ = new BehaviorSubject<number>(12);
  private brands$ = new BehaviorSubject<string[]>([]);
  private title$ = new BehaviorSubject<string>('');

  heading$: Observable<string> = combineLatest([this.title$, this.category$]).pipe(
    map(([t, c]) => t || (c ? c : 'Recent Products'))
  );

  products$: Observable<Product[]> = of([]);

  constructor(
    private productService: ProductsService,
    private navigationService: NavigationService
  ) {}

  ngOnInit(): void {
    const allProducts$ = this.productService.getProducts(); // unchanged service call

    this.products$ = combineLatest([allProducts$, this.category$, this.brands$, this.limit$]).pipe(
      map(([products, category, brands, limit]) => {
        let res = products ?? [];

        // If a category is provided, filter by it (adjust field name to your model)
        if (category) {
          // If your model uses `product.categoryName` or `categories: string[]`, tweak this predicate:
          res = res.filter(p =>
            (p as any)?.category?.toLowerCase?.() === category.toLowerCase()
            || (Array.isArray((p as any)?.categories) && (p as any).categories.some((c: string) => c.toLowerCase() === category.toLowerCase()))
          );
        } else {
          // "Recent" fallback — same as your old logic
          res = res.sort((a: any, b: any) => (b.posProductId ?? 0) - (a.posProductId ?? 0));
        }

        // Optional brand filter (unchanged)
        if (brands.length) {
          res = res.filter(p => brands.includes((p as any)?.brand));
        }

        // Sort by recent within the filtered set (keeps old behavior)
        res = res.sort((a: any, b: any) => (b.posProductId ?? 0) - (a.posProductId ?? 0));

        return res.slice(0, Math.max(1, limit));
      })
    );
  }

  scrollProducts(direction: number): void {
    const el = this.productCarousel?.nativeElement;
    if (!el) return;

    const first = el.querySelector('lib-product-card') as HTMLElement | null;
    const cardWidth = first?.getBoundingClientRect().width ?? 260;
    const styles = getComputedStyle(el);
    const gap = parseInt(styles.columnGap || styles.gap || '16', 10) || 16;

    el.scrollBy({ left: direction * (cardWidth + gap) * 2, behavior: 'smooth' });
  }

  navigateToProduct(product: Product): void {
    this.navigationService.navigateToProduct(product);
  }

  navigateToCategory(category: any): void {
    this.navigationService.navigateToCategory(category);
  }

  trackById = (_: number, p: Product) => p?.id ?? p?.posProductId ?? _;
}
