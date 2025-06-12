import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

import { AuthService } from '../../services/auth.service';
import { CommonModule, Location } from '@angular/common';
import { AccessibilityService } from '../../services/accessibility.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule],
  templateUrl: './forgot-password.component.html',
  styleUrls: ['./forgot-password.component.scss'],
})
export class ForgotPasswordComponent {
  forgotPasswordForm: FormGroup;
  emailSent = false; // Flag to toggle between form and success message
  errorMessage = ''; // Store error message to display
  darkModeEnabled: boolean = false;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private location: Location,
    private readonly accessibilityService: AccessibilityService
  ) {
    this.forgotPasswordForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  ngOnInit() {

  }

  onSubmit() {
    if (this.forgotPasswordForm.invalid) {
      this.errorMessage = 'Please enter a valid email address.';
      this.accessibilityService.announce(this.errorMessage, 'assertive');
      return;
    }

    const email = this.forgotPasswordForm.value.email;
    this.errorMessage = ''; 

    this.authService.sendPasswordReset(email).subscribe({
      next: () => {
        this.emailSent = true;
        this.errorMessage = '';
        this.accessibilityService.announce('Password reset email sent. Please check your inbox.', 'polite');
      },
      error: (err) => {
        this.errorMessage = this.getErrorMessage(err);
        this.accessibilityService.announce(this.errorMessage, 'assertive');
      },
    });
  }

  goBack() {
    this.location.back();
    this.accessibilityService.announce('Returned to the previous page.', 'polite');
  }

  private getErrorMessage(err: any): string {
    if (err.status === 404) {
      return 'The email is not associated with a registered account.';
    } else if (err.status === 400) {
      return 'The email address provided is invalid.';
    } else if (err.status === 500) {
      return 'An error occurred on the server. Please try again later.';
    }
    return 'An unexpected error occurred. Please try again.';
  }
}
