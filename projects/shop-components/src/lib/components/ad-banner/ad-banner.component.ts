import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'lib-ad-banner',
  imports: [CommonModule],
  templateUrl: './ad-banner.component.html',
  styleUrl: './ad-banner.component.css'
})
export class AdBannerComponent {
  ads = [
    {
      image: 'https://storage.googleapis.com/the-website-guys/Flower-Power/carousel3.jpg',
      link: '/shop',  
      brand: 'Dank',  
      ctaText: 'Shop Dank'
    },
    {
      image: 'https://storage.googleapis.com/the-website-guys/Flower-Power/carousel4.jpg',
      link: '/shop',     
      brand: 'Bodega Boyz',         
      ctaText: 'Shop Dank'
    },
    {
      image: 'https://storage.googleapis.com/the-website-guys/Flower-Power/carousel5.jpg',
      link: '/shop',        
      brand: 'Toke Folks',        
      ctaText: 'Shop Dank'
    }
  ];

  currentAdIndex = 0;
  private intervalId!: ReturnType<typeof setInterval>;

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Rotate ads every 5 seconds (adjust as needed)
    this.intervalId = setInterval(() => {
      this.currentAdIndex = (this.currentAdIndex + 1) % this.ads.length;
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  onBannerClick(ad: any): void {
    // If the ad.link is an internal route (e.g. starts with '/shop'),
    // use the Angular Router to navigate with query params:
    if (ad.link.startsWith('/shop')) {
      // Pass brand as a query param if defined
      const queryParams = ad.brand ? { brand: ad.brand } : {};
      this.router.navigate([ad.link], { queryParams });
    } else {
      // Otherwise open in new tab
      window.open(ad.link, '_blank');
    }
  }
}
