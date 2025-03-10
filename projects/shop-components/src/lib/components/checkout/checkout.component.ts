import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CartItem, CartService } from '../../services/cart.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { AeropayService } from '../../services/aeropay.service';
import { openWidget } from 'aerosync-web-sdk';
import { LoadingController, ToastController } from '@ionic/angular';
import { CapacitorHttp } from '@capacitor/core';

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
  deliveryAddress = {
    street: '',
    apt: '',
    city: '',
    zip: '',
    state: 'NY' // Default to New York and cannot be changed
  };
  
  finalSubtotal = 0;
  finalTax = 0;
  finalTotal = 0;
  selectedPaymentMethod: string = 'cash';

  selectedOrderType: string = 'pickup';
  pointValue: number = 0.05;

  enableDelivery: boolean = false;

  isGuest: boolean = true;

  constructor(private loadingController: LoadingController,private toastController: ToastController,private aeropayService: AeropayService,private authService: AuthService, private cartService: CartService, private router: Router) {}

  ngOnInit() {
    this.cartItems = this.cartService.getCart();
    this.userInfo = this.authService.getCurrentUser();
    if(!this.userInfo){
      this.isGuest = true;
      this.userInfo = {
        fname: '',
        lname: '',
        email: '',
        phone: '',
        dob: ''
      }

    }else{
      this.isGuest = false;
    }
    this.authService.validateSession();
    this.calculateDefaultTotals();
    this.checkDeliveryEligibility();
  }

  updateTotals() {
    const pointsValue = this.pointsToRedeem * this.pointValue;
    const originalSubtotal = this.cartItems.reduce(
      (total: number, item: any) => total + (item.price * item.quantity),
      0
    );
    this.finalSubtotal = originalSubtotal - pointsValue;
    if (this.finalSubtotal < 0) this.finalSubtotal = 0;
    this.finalTax = this.finalSubtotal * 0.13;
    this.finalTotal = this.finalSubtotal + this.finalTax;
    // if(this.finalTotal >= 90 ){
    //   this.enableDelivery = true;
    // }

    // this.accessibilityService.announce(
    //   `Subtotal updated to ${this.finalSubtotal.toFixed(2)} dollars.`,
    //   'polite'
    // );
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




  isLoading: boolean = false;
  pointsToRedeem: number = 0;
  

  async placeOrder() {

    this.isLoading = true;
    // const loading = await this.loadingController.create({
    //   spinner: 'crescent',
    //   message: 'Please wait while we process your order...',
    //   cssClass: 'custom-loading',
    // });
    // await loading.present();
  
    try {
      const newUserData = {
        fname: this.userInfo.fname,
        lname: this.userInfo.lname,
        phone: this.userInfo.phone,
        email: this.userInfo.email,
        dob: '1990-01-01'
      };

      const alleavesResponse = await this.cartService.createAlleavesCustomer(newUserData);
      let newAllLeavesId = '';
      if (alleavesResponse?.id_customer) {
        console.log('Alleaves Customer Created:', alleavesResponse.id_customer);
        newAllLeavesId = alleavesResponse.id_customer; // Save the ID
      } else {
        console.warn('Failed to create Alleaves Customer');
      }

      const user_id = this.userInfo.id;
      const points_redeem = this.pointsToRedeem;
      let pos_order_id = 0;
      let points_add = 0;

      const deliveryAddress =
        this.selectedOrderType === 'delivery'
          ? {
              address1: this.deliveryAddress.street.trim(),
              address2: this.deliveryAddress.apt ? this.deliveryAddress.apt.trim() : null,
              city: this.deliveryAddress.city.trim(),
              state: this.deliveryAddress.state.trim(),
              zip: this.deliveryAddress.zip.trim(),
              delivery_date: new Date().toISOString().split('T')[0],
            }
          : null;

          if (this.selectedPaymentMethod === 'aeropay' && this.selectedBankId) {
            this.aeropayService.fetchUsedForMerchantToken(this.aeropayUserId).subscribe({
              next: async (response: any) => {
                const transactionResponse = await this.aeropayService.createTransaction(
                  this.finalTotal.toFixed(2), // Convert total to string
                  this.selectedBankId
                ).toPromise();
          
                if (!transactionResponse.data || !transactionResponse.data.success) {
                  console.error('AeroPay Transaction Failed:', transactionResponse.data);
                  this.presentToast('Payment failed. Please try again.', 'danger');
                  //this.isLoading = false;
                  // await loading.dismiss();
                  this.isLoading = false;
                  return;
                }
          
                this.presentToast('Payment successful!', 'success');
              },
              error: (error: any) => {
                console.log('Error:', error);
                this.presentToast('Error', 'danger');
              }
            });
           
          }
  
      const response = await this.cartService.checkout(points_redeem, this.selectedOrderType, deliveryAddress, this.isGuest ? newAllLeavesId : this.userInfo.alleaves_customer_id);
  
      pos_order_id = response.id_order;
      points_add = response.subtotal;

      await this.cartService.placeOrder(user_id, pos_order_id, points_redeem ? 0 : points_add, points_redeem, this.finalSubtotal, this.cartItems);
  
      //this.orderPlaced.emit();
      this.cartService.clearCart();
      this.router.navigate(['/confirmation']);

      // const userOrders = await this.authService.getUserOrders(); // ✅ Ensure this is awaited
      
      //this.accessibilityService.announce('Your order has been placed successfully.', 'polite');
    } catch (error:any) {
      console.error('Error placing order:', error);
      await this.presentToast('Error placing order: ' + JSON.stringify(error.message));
      //this.accessibilityService.announce('There was an error placing your order. Please try again.', 'polite');
    } finally {
      //this.isLoading = false;
      console.log('Cleanup complete: Destroying subscription');
      this.isLoading = false;
    }
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
