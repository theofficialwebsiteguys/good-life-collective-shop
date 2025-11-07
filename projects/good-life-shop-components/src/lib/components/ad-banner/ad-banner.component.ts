import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { map, catchError, of, tap } from 'rxjs';
import { SettingsService } from '../../services/settings.service';
import { ProductsService } from '../../services/products.service';

@Component({
  selector: 'lib-ad-banner',
  imports: [CommonModule],
  templateUrl: './ad-banner.component.html',
  styleUrl: './ad-banner.component.css'
})
export class AdBannerComponent implements OnInit, OnDestroy {
  ads: any[] = [];
  bannerLinks: any[] = [];
  currentAdIndex = 0;
  private intervalId: any;
  private readonly intervalMs = 5000;

  bannerLinkMap = new Map<string, any>();

  constructor(private router: Router, private settings: SettingsService, private productsService: ProductsService) {}

  ngOnInit(): void {
    this.settings.getCarouselImages()
      .pipe(
        map((res: any) => {
          // old format: plain array
          if (Array.isArray(res)) {
            return { images: res, links: [] };
          }

          // new format: images + links
          return {
            images: res?.images ?? [],
            links: res?.links ?? []
          };
        }),
        tap(result => {
          console.log(result); // you'll now see { images: [...], links: [...] }
          this.ads = result.images;
          this.bannerLinks = result.links;

          // optional: store links if you want clickable banners later
          this.bannerLinks = result.links;

          if (this.ads.length > 1) this.start();
        }),
        catchError(err => {
          console.error('Failed to load banners', err);
          this.ads = [];
          return of({ images: [], links: [] });
        })
      ).subscribe();

    // Pause when tab not visible
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  ngOnDestroy(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }

  private tick = () =>
    this.currentAdIndex = (this.currentAdIndex + 1) % this.ads.length;

  private start() {
    this.stop();
    this.intervalId = setInterval(this.tick, this.intervalMs);
  }
  private stop() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }
  pause() { this.stop(); }
  resume() { if (this.ads.length > 1) this.start(); }

  private handleVisibility = () => {
    if (document.hidden) this.stop(); else this.resume();
  };

onBannerClick(ad: string): void {
  const index = this.ads.indexOf(ad);
  const link = this.bannerLinks[index];

  console.log('[Banner Clicked]', { index, ad, link });
  if (!link) return;

  const { link_category, link_brand } = link;

  // ✅ Update category in service (so filters match right away)
  if (link_category) {
    this.productsService.updateCategory(link_category.toUpperCase() as any);
  }

  // ✅ Navigate to /shop with both category and brand query params
  // ShopComponent already handles this logic to filter
  const queryParams: any = {};
  if (link_category) queryParams.category = link_category;
  if (link_brand) queryParams.brand = link_brand;

  console.log('[Banner Navigation]', queryParams);

  this.router.navigate(['/shop'], {
    queryParams,
    queryParamsHandling: 'merge'
  });
}




}
