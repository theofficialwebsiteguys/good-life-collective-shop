import { Component } from '@angular/core';
import { NavigationService } from '../../services/navigation.service';
import { Product } from '../../models/product.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ProductsService } from '../../services/products.service';
import { Subscription } from 'rxjs';
import { CartItem, CartService } from '../../services/cart.service';

@Component({
  selector: 'lib-single-product',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './single-product.component.html',
  styleUrls: ['./single-product.component.css']
})
export class SingleProductComponent {
  product: Product | null = null;
  quantity: number = 1;
  selectedWeight: string = '';
  availableWeights: string[] = [];
  showFullDescription = false;
  isAddingToCart: boolean = false;

  private productSubscription: Subscription | null = null;
  private routeSubscription: Subscription | null = null;

  constructor(
    private route: ActivatedRoute,
    private navigationService: NavigationService,
    private productService: ProductsService,
    private cartService: CartService
  ) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const productId = params.get('id');
      if (productId) {
        this.loadProduct(productId);
      }
    });
  }

  loadProduct(productId: string): void {
    // First, check NavigationService
    const selectedProduct = this.navigationService.getSelectedProduct();
    if (selectedProduct && selectedProduct.posProductId.toString() === productId) {
      this.product = selectedProduct;
      this.setWeightOptions(selectedProduct.weight);
    }
  }

  goBack(): void {
    this.navigationService.clearSelectedProduct();
  }

  increaseQuantity() {
    this.quantity++;
  }

  decreaseQuantity() {
    if (this.quantity > 1) this.quantity--;
  }

  async addToCart() {
    if (this.isAddingToCart) return;
    this.isAddingToCart = true;

    const cartItem = {
      ...this.product,
      quantity: this.quantity,
    };
  
    this.cartService.addToCart(cartItem); 
    setTimeout(() => {
      this.isAddingToCart = false; // Enable button after 3 seconds
    }, 2000);
    //this.accessibilityService.announce(`${this.product?.title} added to cart. Quantity: ${this.quantity}.`, 'assertive');
    // alert('Item added to cart!');
  }

  toggleDescription() {
    this.showFullDescription = !this.showFullDescription;
  }

  get truncatedDescription(): string {
    if (!this.product?.desc) return '';
    return this.showFullDescription
      ? this.product.desc
      : this.product.desc.slice(0, 300) + (this.product.desc.length > 300 ? '...' : '');
  }

  private setWeightOptions(weight: string | string[]): void {
    if (Array.isArray(weight)) {
      this.availableWeights = weight;
    } else if (typeof weight === 'string') {
      this.availableWeights = [weight];
    } else {
      this.availableWeights = [];
    }

    this.selectedWeight = this.availableWeights.length > 0 ? this.availableWeights[0] : '';
  }

  ngOnDestroy(): void {
    this.productSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
  }

  
}
