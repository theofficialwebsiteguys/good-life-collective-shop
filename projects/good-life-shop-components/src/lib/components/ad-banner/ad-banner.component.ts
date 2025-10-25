import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { map, catchError, of, tap } from 'rxjs';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'lib-ad-banner',
  imports: [CommonModule],
  templateUrl: './ad-banner.component.html',
  styleUrl: './ad-banner.component.css'
})
export class AdBannerComponent implements OnInit, OnDestroy {
 ads: any[] = [];
  currentAdIndex = 0;
  private intervalId: any;
  private readonly intervalMs = 5000;

  constructor(private router: Router, private settings: SettingsService) {}

  ngOnInit(): void {
    this.settings.getCarouselImages()
      .pipe(
        map((res: any) => Array.isArray(res) ? res : res?.images ?? []),
        tap(banners => {
          this.ads = banners;
          if (this.ads.length > 1) this.start();
        }),
        catchError(err => { console.error('Failed to load banners', err); this.ads = []; return of([]); })
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

  onBannerClick(ad: any): void {
    if (!ad) return;
    if (ad.link?.startsWith('/')) this.router.navigate([ad.link]);
    else if (ad.link) window.open(ad.link, '_blank');
  }
}
