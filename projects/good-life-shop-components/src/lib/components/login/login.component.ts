import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'lib-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email: string = '';
  password: string = '';
  newPassword: string = '';
  errorMessage: string = '';
  successMessage: string = '';
  requiresPasswordSetup: boolean = false;
  pendingUser: any = null;

  constructor(private authService: AuthService, private router: Router) {}

  login() {
    const credentials = {
      email: this.email,
      password: this.password
    };
  
    this.authService.login(credentials).subscribe({
      next: (response) => {
        // 👇 Check if the backend says they need to set a new password
        if (response.requiresPasswordSetup) {
          this.requiresPasswordSetup = true;
          this.pendingUser = response.user;
          return;
        }

        // Normal login flow
        if (response.sessionId) {
          this.router.navigate(['/shop']);
        } else {
          this.errorMessage = 'Invalid credentials. Please try again.';
        }
      },
      error: (err) => {
        console.error('Login error:', err);
        this.errorMessage = 'Invalid email or password. Please try again.';
      }
    });
  }
  
  setNewPassword() {
    if (!this.newPassword) {
      this.errorMessage = 'Please enter a new password.';
      return;
    }

    const { email, business_id } = this.pendingUser;
    this.authService.setPasswordForExistingUser(email, business_id, this.newPassword).subscribe({
      next: () => {
        this.successMessage = 'Password set successfully! You can now log in.';
        this.requiresPasswordSetup = false;
        this.password = this.newPassword;
        this.newPassword = '';
      },
      error: (err) => {
        console.error('Password setup error:', err);
        this.errorMessage = 'Failed to set password. Please try again.';
      }
    });
  }
}
