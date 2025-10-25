import { CommonModule } from '@angular/common';
import { Component, ElementRef, HostListener, Input, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { AccessibilityService } from '../../services/accessibility.service';

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
  @Input() iconColor: string = '#ffffff'; 
  authTooltipOpen = false;
  isLoggedIn = false; // Set to `true` if user is logged in
  userData: any = null;
  private authSubscription!: Subscription;

  constructor(private authService: AuthService, private accessibilityService: AccessibilityService){}
  ngOnInit() {
    this.checkLoginStatus();
  }

  checkLoginStatus() {
    this.authSubscription = this.authService.isLoggedIn().subscribe(status => {
      this.isLoggedIn = status;
      if (status) {
        this.authService.getUserInfo().subscribe((user:any) => {
          this.userData = user;
        });
      } else {
        this.userData = null;
      }
    });
  }
  

  toggleAuthTooltip() {
    this.authTooltipOpen = !this.authTooltipOpen;
    const message = this.authTooltipOpen ? 'User menu opened' : 'User menu closed';
    this.accessibilityService.announce(message, 'polite');
  }

  logout() {
    this.authService.logout();
    this.authTooltipOpen = false;
  }

  isAdmin(): boolean {
    return this.userData?.role === 'admin';
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
