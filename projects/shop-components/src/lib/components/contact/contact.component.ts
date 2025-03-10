import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'lib-contact',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './contact.component.html',
  styleUrl: './contact.component.css'
})
export class ContactComponent {
  contactForm: FormGroup;
  isSubmitted = false;

  constructor(private fb: FormBuilder, private authService: AuthService) {
    this.contactForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      message: ['', Validators.required]
    });
  }

  async submitForm() {
    this.isSubmitted = true;
    if (this.contactForm.valid) {
      try {
        await this.authService.sendMessage(
          this.contactForm.value.name,
          this.contactForm.value.email,
          this.contactForm.value.message
        );
        this.contactForm.reset();
        this.isSubmitted = false;
        console.log('Message sent successfully!');
      } catch (error) {
        console.error('Failed to send message:', error);
      }

    }
  }

  get formControls() {
    return this.contactForm.controls;
  }

}
