import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'lib-auth-nav',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './auth-nav.component.html',
  styleUrl: './auth-nav.component.css'
})
export class AuthNavComponent {
  @ViewChild('authTooltip') authTooltip!: ElementRef;
  @ViewChild('authIcon') authIcon!: ElementRef;

  authTooltipOpen = false;
  isLoggedIn = false; // Set to `true` if user is logged in
  userData: any = null;

  constructor(private authService: AuthService){}
  ngOnInit() {
    this.checkLoginStatus();
  }

  checkLoginStatus() {
    this.authService.isLoggedIn().subscribe(success => {
      if(success){
        this.isLoggedIn = true;
        this.userData = this.authService.getCurrentUser();
      }
    });
  }

  toggleAuthTooltip() {
    this.authTooltipOpen = !this.authTooltipOpen;
  }

  logout() {
    localStorage.removeItem('userData');
    this.isLoggedIn = false;
    this.authTooltipOpen = false;
  }

  navigateToLogin() {
    window.location.href = '/login';
  }

  navigateToSignup() {
    window.location.href = '/signup';
  }

  @HostListener('document:click', ['$event'])
  handleClickOutside(event: Event) {
    if (
      this.authTooltip &&
      this.authIcon &&
      !this.authTooltip.nativeElement.contains(event.target) &&
      !this.authIcon.nativeElement.contains(event.target)
    ) {
      this.authTooltipOpen = false;
    }
  }
}
