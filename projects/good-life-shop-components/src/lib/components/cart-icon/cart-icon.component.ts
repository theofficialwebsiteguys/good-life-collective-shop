import { Component, Input } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CartService } from '../../services/cart.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'lib-cart-icon',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './cart-icon.component.html',
  styleUrl: './cart-icon.component.css'
})
export class CartIconComponent {
  cartItemCount$: Observable<number> = new Observable();
  @Input() iconColor: string = '#ffffff'; 
  constructor(private cartService: CartService) {}

  ngOnInit(): void {
    this.cartItemCount$ = this.cartService.cart$.pipe(
      map(cart => cart.reduce((sum, item) => sum + item.quantity, 0))
    );
  }
}
