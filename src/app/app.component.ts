import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProductListComponent } from '../../projects/good-life-shop-components/src/lib/components/product-list/product-list.component';
import { NavigationService } from '../../projects/good-life-shop-components/src/lib/services/navigation.service';
import { SingleProductComponent } from '../../projects/good-life-shop-components/src/lib/components/single-product/single-product.component';
import { CommonModule } from '@angular/common';
import { ProductsCarouselComponent } from '../../projects/good-life-shop-components/src/lib/components/products-carousel/products-carousel.component';
import { CategoriesComponent } from '../../projects/good-life-shop-components/src/lib/components/categories/categories.component';
import { ShopComponent } from '../../projects/good-life-shop-components/src/lib/components/shop/shop.component';
import { ContactComponent } from '../../projects/good-life-shop-components/src/lib/components/contact/contact.component';
import { DashboardComponent, ConfigService } from 'good-life-admin-dashboard'
import { AdBannerComponent } from '../../projects/good-life-shop-components/src/lib/components/ad-banner/ad-banner.component';
import { ConfigService as ShopConfig } from '../../projects/good-life-shop-components/src/lib/services/config.service'
import { LocationSelectionComponent } from '../../projects/good-life-shop-components/src/lib/components/location-selection/location-selection.component';
import { LocationDropdownComponent } from '../../projects/good-life-shop-components/src/public-api';
import { MerchShopComponent } from '../../projects/good-life-shop-components/src/lib/components/merch-shop/merch-shop.component';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, ProductsCarouselComponent, CategoriesComponent,  ContactComponent, AdBannerComponent, LocationSelectionComponent, LocationDropdownComponent, MerchShopComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  constructor(private navigationService: NavigationService, private configService: ConfigService, private shopConfig: ShopConfig) {
    this.configService.setApiKey('caf0c918d083b815a16fe0546e3802de4423e9b33c26aba8e1fa2a614966978d');
    this.shopConfig.setApiKey('caf0c918d083b815a16fe0546e3802de4423e9b33c26aba8e1fa2a614966978d');
  }

  isViewingProduct(): boolean {
    let product = false;
    this.navigationService.selectedProduct$.subscribe(selected => {
      product = selected !== null;
    });
    return product;
  }
}
