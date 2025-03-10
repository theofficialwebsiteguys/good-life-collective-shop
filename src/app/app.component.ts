import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProductListComponent } from '../../projects/shop-components/src/lib/components/product-list/product-list.component';
import { NavigationService } from '../../projects/shop-components/src/lib/services/navigation.service';
import { SingleProductComponent } from '../../projects/shop-components/src/lib/components/single-product/single-product.component';
import { CommonModule } from '@angular/common';
import { RecentProductsCarouselComponent } from '../../projects/shop-components/src/lib/components/recent-products-carousel/recent-products-carousel.component';
import { CategoriesComponent } from '../../projects/shop-components/src/lib/components/categories/categories.component';
import { ShopComponent } from '../../projects/shop-components/src/lib/components/shop/shop.component';
import { ContactComponent } from '../../projects/shop-components/src/lib/components/contact/contact.component';
import { DashboardComponent, ConfigService } from 'admin-dashboard'
import { AdBannerComponent } from '../../projects/shop-components/src/lib/components/ad-banner/ad-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RecentProductsCarouselComponent, CategoriesComponent,  ContactComponent, AdBannerComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  constructor(private navigationService: NavigationService, private configService: ConfigService) {
    this.configService.setApiKey('c69203dbdeaf88d28f3bfa28afeaff32965744f3d3ae6321b9eff6d198b1edfb');
  }

  isViewingProduct(): boolean {
    let product = false;
    this.navigationService.selectedProduct$.subscribe(selected => {
      product = selected !== null;
    });
    return product;
  }
}
