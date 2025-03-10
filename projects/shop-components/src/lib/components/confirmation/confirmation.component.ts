import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'lib-confirmation',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './confirmation.component.html',
  styleUrl: './confirmation.component.css'
})
export class ConfirmationComponent {
  @ViewChild('confirmationHeading') confirmationHeading!: ElementRef;

  ngAfterViewInit(): void {
    if (this.confirmationHeading) {
      this.confirmationHeading.nativeElement.focus();
    }
  }
}
