import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CartItem, CartService } from '../../services/cart.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AeropayService } from '../../services/aeropay.service';
import { openWidget } from 'aerosync-web-sdk';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'lib-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css'
})
export class CheckoutComponent {
  userInfo: any;
  orderType = 'pickup';
  paymentMethod = 'cash';
  cartItems: CartItem[] = [];
  deliveryAddress = { street: '', apt: '', city: '', zip: '' };
  finalSubtotal = 0;
  finalTax = 0;
  finalTotal = 0;
  selectedPaymentMethod: string = 'cash';

  selectedOrderType: string = 'pickup';


  enableDelivery: boolean = false;

  constructor(private toastController: ToastController,private aeropayService: AeropayService,private authService: AuthService, private cartService: CartService, private router: Router) {}

  ngOnInit() {
    this.cartItems = this.cartService.getCart();
    this.userInfo = this.authService.getCurrentUser();
    this.calculateDefaultTotals();
  }

  checkDeliveryEligibility() {
    this.cartService.checkDeliveryEligibility().subscribe({
      next: (response) => {
        this.enableDelivery = response.deliveryAvailable;
        console.log('Delivery availability:', this.enableDelivery);
      },
      error: (error) => {
        console.error('Error fetching delivery eligibility:', error);
        this.enableDelivery = false; // Fallback if the request fails
      }
    });
  }

  calculateDefaultTotals() {
    this.finalSubtotal = this.cartItems.reduce((total, item) => total + (parseFloat(item.price) * item.quantity), 0);
    this.finalTax = this.finalSubtotal * 0.13;
    this.finalTotal = this.finalSubtotal + this.finalTax;
  }

  placeOrder() {
    alert('Order placed successfully!');
    this.cartService.clearCart();
    this.router.navigate(['/shop']);
  }

  goBack() {
    this.router.navigate(['/cart']);
  }





  isFetchingAeroPay: boolean = false; 

  verificationRequired: boolean = false;
  verificationCode: string = '';
  existingUserId: string = '';

  aerosyncURL: string | null = null;
  aerosyncToken: string | null = null;
  aerosyncUsername: string | null = null;
  showAerosyncWidget: boolean = false;

  userBankAccounts: any[] = []; // Store user bank accounts
  showBankSelection: boolean = false; // Control UI visibility
  selectedBankId: string | null = null; // Track selected bank
  aeropayAuthToken: string | null = null;
  bankLinked: boolean = false;
  aeropayUserId: any;
  loadingAerosync = false;

  //Aeropay
  async startAeroPayProcess() {
    this.isFetchingAeroPay = true;
  
      this.aeropayService.fetchMerchantToken().subscribe({
        next: (response: any) => {
          // **Check for API errors inside the response**
          if (response.data.success === false || !response.data.token) {
            console.error('AeroPay Authentication Failed:', response.error);
            this.presentToast(`Authentication Error: ${response.error.message}`, 'danger');
            this.isFetchingAeroPay = false;
            return; // **Exit function to prevent further execution**
          }
  
          this.createAeroPayUser();
        },
        error: (error: any) => {
          console.error('AeroPay Authentication Request Failed:', error);
          this.presentToast('Authentication request failed. Please try again.', 'danger');
          this.isFetchingAeroPay = false;
        }
      });
  }
  

  async createAeroPayUser() {  
    const userData = {
      first_name: this.userInfo.fname,
      last_name: this.userInfo.lname,
      phone_number: this.userInfo.phone,
      email: this.userInfo.email
    };
  
    this.aeropayService.createUser(userData).subscribe({
      next: (response: any) => {
        this.isFetchingAeroPay = false;

        if (response.data.displayMessage) {
          this.verificationRequired = true;
          this.existingUserId = response.data.existingUser.userId; // Store userId for verification
          this.presentToast(response.data.displayMessage, 'warning');
        } else  {
          if (response.data.success && response.data.user) {
            this.userBankAccounts = response.data.user.bankAccounts || []; // Store bank accounts
            this.aeropayUserId = response.data.user.userId;
    
            if (this.userBankAccounts.length > 0) {
              console.log('User has linked bank accounts:', this.userBankAccounts);
              this.showBankSelection = true; // Show bank selection UI
              this.selectedBankId = this.userBankAccounts[0].bankAccountId;
            } else {
              console.log('No linked bank accounts. Opening AeroSync widget...');
              this.retrieveAerosyncCredentials();
            }
          }

        }
      },
      error: (error: any) => {
        console.error('Error Creating AeroPay User:', error);
        this.presentToast('Error creating user. Please try again.', 'danger');
        this.isFetchingAeroPay = false;
      }
    });
  }

  async verifyAeroPayUser() {
    if (!this.verificationCode.trim()) {
      this.presentToast('Please enter the verification code.', 'danger');
      return;
    }
  
    this.aeropayService.verifyUser(this.existingUserId, this.verificationCode).subscribe({
      next: (response: any) => {
        this.verificationRequired = false; // Hide verification input
        this.presentToast('Verification successful!', 'success');
        this.createAeroPayUser();
      },
      error: (error: any) => {
        console.error('Verification Failed:', error);
        this.presentToast('Invalid verification code. Please try again.', 'danger');
      }
    });
  }

  async retrieveAerosyncCredentials() {
    this.loadingAerosync = true;
    this.aeropayService.fetchUsedForMerchantToken(this.aeropayUserId).subscribe({
      next: (response: any) => {

        // **Check for API errors inside the response**
        if (response.data.success === false || !response.data.token) {
          console.error('AeroPay Authentication Failed:', response.data.error);
          this.presentToast(`Authentication Error: ${response.data.error.message}`, 'danger');
          this.loadingAerosync = false;
          return; // **Exit function to prevent further execution**
        }

        this.aeropayService.getAerosyncCredentials().subscribe({
          next: (response: any) => {
            if (response.data.success) {
              this.aerosyncURL = response.data.fastlinkURL;
              this.aerosyncToken = response.data.token;
              this.aerosyncUsername = response.data.username;
    
              // Open the Aerosync Widget in an in-app browser
              this.openAerosyncWidget();
            } else {
              console.error('Failed to retrieve Aerosync widget.');
            }
            this.loadingAerosync = false;
          },
          error: (error: any) => {
            console.error('Error Retrieving Aerosync Widget:', error);
            this.loadingAerosync = false;
          }
        });
      },
      error: (error: any) => {
        console.error('AeroPay Authentication Request Failed:', error);
        this.presentToast('Authentication request failed. Please try again.', 'danger');
        this.loadingAerosync = false;
      }
    });
   
  }

  openAerosyncWidget() {
    if (!this.aerosyncToken) {
      console.error('Missing AeroSync Token');
      return;
    }

    let widgetRef = openWidget({
      id: "widget",
      iframeTitle: 'Connect',
      environment: 'production', // 'production' for live
      token: this.aerosyncToken,
      style: {
        width: '375px',
        height: '688px',
        bgColor: '#000000',
        opacity: 0.7
      },
      deeplink: "", // Leave empty if not needed
      consumerId: "", // Optional: Merchant customization

      onLoad: function () {
        console.log("AeroSync Widget Loaded");
      },
      onSuccess: (event: any) => {
        if (event.user_id && event.user_password) {
          this.linkBankToAeropay(event.user_id, event.user_password);
        } else {
          console.error("Missing user credentials in event:", event);
        }
      },
      onError: function (event) {
        console.error("AeroSync Error:", event);
      },
      onClose: function () {
        console.log("AeroSync Widget Closed");
      },
      onEvent: function (event: object, type: string): void {
        console.log(event, type)
      }
    });

    widgetRef.launch();
  }

  linkBankToAeropay(userId: string, userPassword: string) {  
    this.aeropayService.linkBankAccount(userId, userPassword).subscribe({
      next: (response: any) => {
        if (response.data.success) {
          this.presentToast('Bank account linked successfully!', 'success');
  
          this.createAeroPayUser();
        } else {
          console.error('Failed to link bank:', response.data);
          this.presentToast('Failed to link your bank. Please try again.', 'danger');
        }
      },
      error: (error: any) => {
        console.error('Error linking bank account:', error);
        this.presentToast('An error occurred while linking your bank.', 'danger');
      }
    });
  }
  
  
  selectBank(bankId: string) {
    this.selectedBankId = bankId;
  }

  onOrderTypeChange(event: any) {
    this.selectedOrderType = event.detail.value;
    if(this.selectedOrderType === 'delivery'){
      this.selectedPaymentMethod = 'aeropay'
      this.startAeroPayProcess();
    }
  }

  async presentToast(message: string, color: string = 'danger') {
    const toast = await this.toastController.create({
      message: message,
      duration: 7000,
      color: color,
      position: 'bottom',
    });
    await toast.present();
  }

    onPaymentMethodChange(selectedMethod: string) {
    if (selectedMethod === 'aeropay') {
      this.startAeroPayProcess();
    }else{
      this.showBankSelection = false;
    }
  }

}
