import { Routes } from '@angular/router';
import { ShopComponent } from '../../projects/shop-components/src/lib/components/shop/shop.component';
import { SingleProductComponent } from '../../projects/shop-components/src/lib/components/single-product/single-product.component';
import { CartComponent } from '../../projects/shop-components/src/lib/components/cart/cart.component';
import { CheckoutComponent } from '../../projects/shop-components/src/lib/components/checkout/checkout.component';
import { LoginComponent } from '../../projects/shop-components/src/lib/components/login/login.component';
import { RegisterComponent } from '../../projects/shop-components/src/lib/components/register/register.component';
import { ConfirmationComponent } from '../../projects/shop-components/src/lib/components/confirmation/confirmation.component';
import { BudtenderSalesComponent, DashboardComponent, OrdersComponent, UsersComponent } from 'admin-dashboard';

export const routes: Routes = [
    { path: '', redirectTo: '', pathMatch: 'full' },
    { path: 'shop', component: ShopComponent },
    { path: 'shop/:id', component: SingleProductComponent }, // For viewing individual products
    { path: 'cart', component: CartComponent },
    { path: 'checkout', component: CheckoutComponent },
    { path: 'login', component: LoginComponent },
    { path: 'register', component: RegisterComponent },
    { path: 'confirmation', component: ConfirmationComponent },
    {
        path: 'dashboard',
        component: DashboardComponent,
        children: [
          { path: 'orders', component: OrdersComponent },
          { path: 'users', component: UsersComponent },
          { path: 'budtender-sales', component: BudtenderSalesComponent },
          // add more child routes here as needed
          { path: '', redirectTo: 'orders', pathMatch: 'full' }
        ]
      },
];
