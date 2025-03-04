import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'lib-account',
  standalone: true,
  imports: [],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css'
})
export class AccountComponent {
  // user: User | null = null;

  constructor(private authService: AuthService) {
    // this.authService.user$.subscribe(user => {
    //   this.user = user;
    // });
  }

  logout() {
    this.authService.logout();
  }
}
