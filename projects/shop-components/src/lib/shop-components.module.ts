import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuthNavComponent } from './components/auth-nav/auth-nav.component';
import { ConfirmationComponent } from './components/confirmation/confirmation.component';

// Grouped components under their respective files
import { CartComponent } from './components/cart/cart.component';
import { CartIconComponent } from './components/cart-icon/cart-icon.component';
import { CategoriesComponent } from './components/categories/categories.component';
import { CheckoutComponent } from './components/checkout/checkout.component';
import { LoginComponent } from './components/login/login.component';
import { ProductCardComponent } from './components/product-card/product-card.component';
import { ProductListComponent } from './components/product-list/product-list.component';
import { RecentProductsCarouselComponent } from './components/recent-products-carousel/recent-products-carousel.component';
import { RegisterComponent } from './components/register/register.component';
import { ShopComponent } from './components/shop/shop.component';
import { SingleProductComponent } from './components/single-product/single-product.component';
import { ConfigService } from './services/config.service';
import { AdBannerComponent } from './components/ad-banner/ad-banner.component';
import { ForgotPasswordComponent } from './components/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/reset-password/reset-password.component';

@NgModule({
  providers: [ConfigService],
  declarations: [

  ],
  imports: [CommonModule,
    AuthNavComponent,
    ConfirmationComponent,
    CartComponent,
    CartIconComponent,
    CategoriesComponent,
    CheckoutComponent,
    LoginComponent,
    ProductCardComponent,
    ProductListComponent,
    RecentProductsCarouselComponent,
    RegisterComponent,
    ShopComponent,
    SingleProductComponent,
    AdBannerComponent,
    ForgotPasswordComponent,
    ResetPasswordComponent
  ],
  exports: [
    AuthNavComponent,
    ConfirmationComponent,
    CartComponent,
    CartIconComponent,
    CategoriesComponent,
    CheckoutComponent,
    LoginComponent,
    ProductCardComponent,
    ProductListComponent,
    RecentProductsCarouselComponent,
    RegisterComponent,
    ShopComponent,
    SingleProductComponent,
    AdBannerComponent,
    ForgotPasswordComponent,
    ResetPasswordComponent
  ]
})
export class ShopComponentsModule {}
