import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service'; // Ensure this service exists in `shop-components`

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.getCurrentUser() && authService.getCurrentUser().role === 'admin') {
    return true; // Allow access if the user is an admin
  } else {
    router.navigate(['/login']); // Redirect unauthorized users to login
    return false;
  }
};
