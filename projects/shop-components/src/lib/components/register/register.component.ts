import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'lib-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ReactiveFormsModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  registerForm: FormGroup;
  firstName: string = '';
  lastName: string = '';
  email: string = '';
  password: string = '';
  errorMessage: string = '';

  currentYear = new Date().getFullYear();

  countries = [
    { name: 'United States', dialCode: '+1', code: 'US' },
    { name: 'United Kingdom', dialCode: '+44', code: 'GB' },
    { name: 'France', dialCode: '+33', code: 'FR' },
    { name: 'Germany', dialCode: '+49', code: 'DE' },
    { name: 'Croatia', dialCode: '+385', code: 'HR' },
    { name: 'Canada', dialCode: '+1', code: 'CA' },
    { name: 'Australia', dialCode: '+61', code: 'AU' },
    { name: 'India', dialCode: '+91', code: 'IN' },
    { name: 'Japan', dialCode: '+81', code: 'JP' },
    { name: 'China', dialCode: '+86', code: 'CN' },
    { name: 'Italy', dialCode: '+39', code: 'IT' },
    { name: 'Spain', dialCode: '+34', code: 'ES' },
    { name: 'Mexico', dialCode: '+52', code: 'MX' },
    { name: 'Brazil', dialCode: '+55', code: 'BR' },
    { name: 'South Africa', dialCode: '+27', code: 'ZA' },
    { name: 'New Zealand', dialCode: '+64', code: 'NZ' },
    { name: 'Russia', dialCode: '+7', code: 'RU' },
    { name: 'South Korea', dialCode: '+82', code: 'KR' },
  ];

  constructor(private authService: AuthService, private router: Router, private fb: FormBuilder) {
    this.registerForm = this.fb.group(
      {
        firstName: ['', [Validators.required, Validators.minLength(2)]],
        lastName: ['', [Validators.required, Validators.minLength(2)]],
        email: ['', [Validators.required, Validators.email]],
        countryCode: [this.countries[0].code, Validators.required], 
        phone: ['', [Validators.required, Validators.pattern(/^\d{7,15}$/)]], 
        month: [
          '',
          [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])$/)],
        ], 
        day: [
          '',
          [
            Validators.required,
            Validators.pattern(/^(0[1-9]|[12][0-9]|3[01])$/),
          ],
        ],
        year: [
          '',
          [
            Validators.required,
            Validators.pattern(
              new RegExp(
                `^(19[0-9][0-9]|20[0-9][0-9]|20${Math.floor(this.currentYear / 10)}[0-${this.currentYear % 10}])$`
              )
            )
            
          ],
        ],
        password: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', [Validators.required]],
        termsAccepted: [false, Validators.requiredTrue],
      },
      {
        validator: this.passwordMatchValidator, 
      }
    );
  }

  onSubmit() {
    this.authService.register(this.firstName).subscribe(user => {
      if (user) {
        this.router.navigate(['/account']);
      } else {
        this.errorMessage = 'Signup failed. Please try again.';
      }
    });
  }

  passwordMatchValidator(group: FormGroup) {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmPassword')?.value;
    return password === confirmPassword ? null : { notMatching: true };
  }
}
