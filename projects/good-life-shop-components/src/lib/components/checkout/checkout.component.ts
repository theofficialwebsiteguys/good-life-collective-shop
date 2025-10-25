import { ChangeDetectorRef, Component } from '@angular/core';
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
  
  minDate: string = '';

  originalSubtotal: number = 0;
  finalSubtotal = 0;
  finalTax = 0;
  finalTotal = 0;
  selectedPaymentMethod: string = 'cash';

  selectedOrderType: string = 'pickup';
  pointValue: number = 0.05;

  enableDelivery: boolean = false;

  deliveryHoursByDay: { [key: number]: { start: number; end: number } } = {
    0: { start: 11, end: 21 }, // Sunday
    1: { start: 8, end: 22 },  // Monday
    2: { start: 8, end: 22 },  // Tuesday
    3: { start: 8, end: 22 },  // Wednesday
    4: { start: 8, end: 22 },  // Thursday
    5: { start: 8, end: 23 },  // Friday
    6: { start: 10, end: 23 }, // Saturday
  };

  selectedDeliveryDate: string | null = null;
  selectedDeliveryTime: string = '';

  deliverySchedule: { day: string; startTime: string; endTime: string }[] = [];
  validDeliveryDates: string[] = [];

  deliveryAddressValid: boolean = false;

  isGuest: boolean = true;

  timeOptions: { value: string; display: string }[] = [];

  constructor(private loadingController: LoadingController,private toastController: ToastController,private aeropayService: AeropayService,private authService: AuthService, private cartService: CartService, private router: Router, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    // Wait a little to allow browser autofill to apply
    setTimeout(() => {
      this.cdr.detectChanges(); // force Angular to re-evaluate bindings
    }, 500);
  }

  async ngOnInit() {
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

    try {
      const res: any = await this.cartService.getDeliveryZone();

      if (res.schedule) {
        this.deliverySchedule = res.schedule;
  
        const availableDates = this.getAvailableDeliveryDates(res.schedule);
        this.validDeliveryDates = availableDates;
  
        if (availableDates.length === 0) {
          this.presentToast('No available delivery days found.', 'danger');
          return;
        }
  
        // Set first available date
        this.selectedDeliveryDate = availableDates[0];
  
        const selectedDate = new Date(this.selectedDeliveryDate);
        const dayOfWeek = selectedDate.getDay(); // 0 = Sunday
        this.generateTimeOptionsFromSchedule(dayOfWeek);
        this.selectNearestFutureTime(selectedDate, dayOfWeek);
      }
    } catch (err) {
      console.error('Failed to load delivery zone', err);
      this.presentToast('Unable to load delivery schedule.', 'danger');
    }
  
    // Set min selectable date
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    this.minDate = tomorrow.toISOString().split('T')[0];
  }

  get maxRedeemablePoints(): number {
    const maxPoints = Math.min(this.userInfo.points, this.originalSubtotal * 20);
    return Math.ceil(maxPoints);
  }

  updateTotals() {
    const pointsValue = this.pointsToRedeem * this.pointValue;
    this.originalSubtotal = this.cartItems.reduce(
      (total: number, item: any) => total + (item.price * item.quantity),
      0
    );
    this.finalSubtotal = this.originalSubtotal - pointsValue;
    if (this.finalSubtotal < 0) this.finalSubtotal = 0;
    this.finalTax = this.finalSubtotal * 0.13;
    this.finalTotal = this.finalSubtotal + this.finalTax;
    // if(this.finalTotal >= 90 ){
    //   this.enableDelivery = true;
    // }


  }

  checkDeliveryEligibility() {
    this.cartService.checkDeliveryEligibility().subscribe({
      next: (response) => {
        this.enableDelivery = response.deliveryAvailable;
        // console.log('Delivery availability:', this.enableDelivery);
      },
      error: (error) => {
        console.error('Error fetching delivery eligibility:', error);
        this.enableDelivery = false; // Fallback if the request fails
      }
    });
  }

  calculateDefaultTotals() {
    this.originalSubtotal = this.cartItems.reduce(
      (total, item) => total + (parseFloat(item.price) * item.quantity),
      0
    );
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
      // const newUserData = {
      //   fname: this.userInfo.fname,
      //   lname: this.userInfo.lname,
      //   phone: this.userInfo.phone,
      //   email: this.userInfo.email,
      //   dob: '1990-01-01'
      // };

      // const alleavesResponse = await this.cartService.createAlleavesCustomer(newUserData);
      // let newAllLeavesId = '';
      // if (alleavesResponse?.id_customer) {
      //   // console.log('Alleaves Customer Created:', alleavesResponse.id_customer);
      //   newAllLeavesId = alleavesResponse.id_customer; // Save the ID
      // } else {
      //   console.warn('Failed to create Alleaves Customer');
      // }
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
          // if (this.selectedPaymentMethod === 'aeropay' && this.selectedBankId) {
          //   this.aeropayService.fetchUsedForMerchantToken(this.aeropayUserId).subscribe({
          //     next: async (response: any) => {
          //       const transactionResponse = await this.aeropayService.createTransaction(
          //         this.finalTotal.toFixed(2), // Convert total to string
          //         this.selectedBankId
          //       ).toPromise();
          
          //       if (!transactionResponse.data || !transactionResponse.data.success) {
          //         console.error('AeroPay Transaction Failed:', transactionResponse.data);
          //         this.showError('Payment failed. Please try again.');
          //         //this.isLoading = false;
          //         // await loading.dismiss();
          //         this.isLoading = false;
          //         return;
          //       }
          
          //       this.presentToast('Payment successful!', 'success');
          //     },
          //     error: (error: any) => {
          //       console.log('Error:', error);
          //       this.showError('Error');
          //     }
          //   });
           
          // }


          if (this.selectedPaymentMethod === 'aeropay' && this.selectedBankId) {
            try {
              const tokenResponse = await this.aeropayService.fetchUsedForMerchantToken(this.aeropayUserId).toPromise();

              const transactionResponse = await this.aeropayService.createTransaction(
                this.finalTotal.toFixed(2),
                this.selectedBankId
              ).toPromise();

              if (!transactionResponse?.data?.success) {
                console.error('AeroPay Transaction Failed:', transactionResponse?.data);
                await this.showError('Payment failed. Please try again.');
                this.isLoading = false;
                return; // 🚫 STOP further execution
              }

              this.presentToast('Payment successful!', 'success');
            } catch (error) {
              console.error('AeroPay Error:', error);
              await this.showError('Payment error. Please try again.');
              this.isLoading = false;
              return;
            }
          }

      const response = await this.cartService.checkout(points_redeem, this.selectedOrderType, deliveryAddress, this.userInfo);
      pos_order_id = response.orderId;
      points_add = this.finalTotal;

      const customer_name = this.userInfo.fname + ' ' + this.userInfo.lname;

      await this.cartService.placeOrder(user_id, pos_order_id, points_redeem ? 0 : points_add, points_redeem, this.finalTotal, this.cartItems, this.userInfo.email, customer_name);
      ////this.orderPlaced.emit();
      this.cartService.clearCart();
      this.router.navigate(['/confirmation']);



      // const userOrders = await this.authService.getUserOrders(); // ✅ Ensure this is awaited
      
      //this.accessibilityService.announce('Your order has been placed successfully.', 'polite');
    } catch (error:any) {
      console.error('Error placing order:', error);
      await this.showError('Error placing order: ' + JSON.stringify(error.message));
      //this.accessibilityService.announce('There was an error placing your order. Please try again.', 'polite');
    } finally {
      //this.isLoading = false;
      // console.log('Cleanup complete: Destroying subscription');
      this.isLoading = false;
    }
  }

  goBack() {
    this.router.navigate(['/cart']);
  }

async onAddressInputChange() {
  const { street, city, zip } = this.deliveryAddress;

  this.deliveryAddressValid = false;

  if (street?.trim() && city?.trim() && zip?.trim().length >= 3) {
    const fullAddress = `${street.trim()}, ${city.trim()}, NY ${zip.trim()}`;

    try {
      const result = await this.cartService.checkAddressInZone(fullAddress);

      if (!result.inZone) {
        this.showError('This address is outside the delivery zone.');
        this.deliveryAddressValid = false;
      } else {
        this.deliveryAddressValid = true;
      }

    } catch (err) {
      console.error('Address check error:', err);
      this.showError('Failed to verify delivery address.');
    }
  } else {
    console.log('Address check skipped due to missing/invalid input.');
  }
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
  isLinkingBank: boolean = false;

  errorMessage: string = '';

  //Aeropay
  async startAeroPayProcess() {

    if (!this.userInfo.fname || !this.userInfo.lname || !this.userInfo.phone || !this.userInfo.email) {
      this.selectedPaymentMethod = 'cash';
      this.showError('Please fill out all contact fields before selecting AeroPay.');
      this.cdr.detectChanges();
      return;
    }

    this.isFetchingAeroPay = true;
  
      this.aeropayService.fetchMerchantToken().subscribe({
        next: (response: any) => {
          // **Check for API errors inside the response**
          if (response.data.success === false || !response.data.token) {
            console.error('AeroPay Authentication Failed:', response.error);
            this.showError(`Authentication Error: ${response.error.message}`);
            this.isFetchingAeroPay = false;
            return; // **Exit function to prevent further execution**
          }
  
          this.createAeroPayUser();
        },
        error: (error: any) => {
          console.error('AeroPay Authentication Request Failed:', error);
          this.showError('Authentication request failed. Please try again.');
          this.isFetchingAeroPay = false;
        }
      });
  }
  

  async createAeroPayUser() {  
    if (this.isGuest && this.aeropayUserId && this.userBankAccounts.length > 0) {
      this.showBankSelection = true;
      return;
    }
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
            this.aeropayUserId = response.data.user.userId;

            if (this.isGuest) {
              // Skip saved banks for guests — always require fresh connection
              this.retrieveAerosyncCredentials();
            } else {
              this.userBankAccounts = response.data.user.bankAccounts || [];

              if (this.userBankAccounts.length > 0) {
                this.showBankSelection = true;
                this.selectedBankId = this.userBankAccounts[0].bankAccountId;
              } else {
                this.retrieveAerosyncCredentials();
              }
            }
          }
        }
      },
      error: (error: any) => {
        console.error('Error Creating AeroPay User:', error);
        this.showError('Error creating user. Please try again.');
        this.isFetchingAeroPay = false;
      }
    });
  }

  async verifyAeroPayUser() {
    if (!this.verificationCode.trim()) {
      this.showError('Please enter the verification code.');
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
        this.showError('Invalid verification code. Please try again.');
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
          this.showError(`Authentication Error: ${response.data.error.message}`);
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
        this.showError('Authentication request failed. Please try again.');
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
    this.isLinkingBank = true;
    this.aeropayService.linkBankAccount(userId, userPassword).subscribe({
      next: (response: any) => {
        this.isLinkingBank = false;
        if (response.data.success) {
          this.presentToast('Bank account linked successfully!', 'success');

          const linkedBank = response.data.userBankInfo;
          if (this.isGuest && linkedBank) {
            this.aeropayUserId = response.data.userId || this.aeropayUserId;
            this.userBankAccounts = [linkedBank];
            this.selectedBankId = linkedBank.bankAccountId;
            this.showBankSelection = true;
          } else {
            // For logged-in users, re-fetch and display all
            this.createAeroPayUser();
          }

        } else {
          this.showError('Failed to link your bank. Please try again.');
        }
      },
      error: (error: any) => {
        this.isLinkingBank = false;
        console.error('Error linking bank account:', error);
        this.showError('An error occurred while linking your bank.');
      }
    });
  }
  
  
  selectBank(bankId: string) {
    this.selectedBankId = bankId;
  }

  onOrderTypeChange(event: any) {
    const selectedValue = event.target.value;
    this.selectedOrderType = selectedValue;

    if (this.selectedOrderType === 'delivery') {
      this.selectedPaymentMethod = 'aeropay';
      if (!this.isGuest) {
        this.startAeroPayProcess();
      }
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

    onPaymentMethodChange(selectedMethod: string, aeropayInput?: HTMLInputElement, cashInput?: HTMLInputElement) {
    if (selectedMethod === 'aeropay') {
      if (!this.userInfo.fname || !this.userInfo.lname || !this.userInfo.phone || !this.userInfo.email) {
        // Revert to cash and manually uncheck AeroPay input
        this.selectedPaymentMethod = 'cash';
        if (aeropayInput){
          aeropayInput.checked = false;
          cashInput!.checked = true;
        } 
        // this.cdr.detectChanges();
        this.showError('Please fill out all contact fields before selecting AeroPay.');
        return;
      }

      if (this.isGuest && this.aeropayUserId && this.userBankAccounts.length > 0) {
        this.showBankSelection = true;
        return;
      }


      if (!this.isGuest) {
        this.startAeroPayProcess();
      }
    }else{
      this.showBankSelection = false;
    }
  }

  showError(message: string) {
    this.errorMessage = message;

    // Auto-clear after 7 seconds if you want
    setTimeout(() => {
      this.errorMessage = '';
    }, 7000);
  }

  isFormValid(): boolean {
    const user = this.userInfo;

    // Validate contact fields
    if (!user.fname?.trim() || !user.lname?.trim() || !user.email?.trim() || !user.phone?.trim()) {
      return false;
    }

    // If delivery, validate delivery address
    if (this.selectedOrderType === 'delivery') {
      const addr = this.deliveryAddress;
      if (!addr.street?.trim() || !addr.city?.trim() || !addr.zip?.trim()) {
        return false;
      }

      // If delivery is selected, payment method must be AeroPay
      if (this.selectedPaymentMethod !== 'aeropay') {
        return false;
      }

      // Bank must be selected if using AeroPay
      if (!this.selectedBankId) {
        return false;
      }
      
      if(!this.deliveryAddressValid) {
        return false;
      }
    }
    return true;
  }

    getAvailableDeliveryDates(schedule: any[]): string[] {
    const validDates: string[] = [];
    const today = new Date();
  
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(today.getDate() + i);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  
      const match = schedule.find(d => d.day === dayName);
      if (match) {
        validDates.push(date.toISOString().split('T')[0]);
      }
    }
    return validDates;
  }
  
  generateTimeOptionsFromSchedule(dayOfWeek: number) {
    const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek];
    const scheduleForDay = this.deliverySchedule.find(d => d.day === dayName);
  
    if (!scheduleForDay) {
      this.timeOptions = [];
      return;
    }
  
    const [startHour, startMinute] = scheduleForDay.startTime.split(':').map(Number);
    const [endHour, endMinute] = scheduleForDay.endTime.split(':').map(Number);
  
    const options = [];
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let min of [0, 30]) {
        if (hour === endHour && min >= endMinute) continue;
  
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        const amPm = hour < 12 ? 'AM' : 'PM';
        const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
        const formattedMinute = min === 0 ? '00' : '30';
  
        options.push({
          value: `${formattedHour}:${formattedMinute}`,
          display: `${displayHour}:${formattedMinute} ${amPm}`
        });
      }
    }
  
    this.timeOptions = options;
  }

   selectNearestFutureTime(current: Date, dayOfWeek: number) {
    const currentMinutes = current.getHours() * 60 + current.getMinutes() + 30; // add 30-minute buffer
    const hours = this.deliveryHoursByDay[dayOfWeek];
  
    for (let hour = hours.start; hour <= hours.end; hour++) {
      for (let minute of [0, 30]) {
        const timeMinutes = hour * 60 + minute;
        if (timeMinutes >= currentMinutes) {
          const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
          const formattedMinute = minute === 0 ? '00' : '30';
          this.selectedDeliveryTime = `${formattedHour}:${formattedMinute}`;
          return;
        }
      }
    }
  
    // If no valid slot today, go to next day
    const nextDay = (dayOfWeek + 1) % 7;
    const tomorrow = new Date(current.getTime() + 86400000); // +1 day
    this.selectedDeliveryDate = tomorrow.toISOString().split('T')[0];
    this.generateTimeOptionsForDay(nextDay);
  
    const nextDayHours = this.deliveryHoursByDay[nextDay];
    const fallbackHour = nextDayHours.start;
    this.selectedDeliveryTime = `${fallbackHour < 10 ? '0' + fallbackHour : fallbackHour}:00`;
  }

  generateTimeOptionsForDay(dayOfWeek: number) {
    this.timeOptions = [];
  
    const hours = this.deliveryHoursByDay[dayOfWeek];
    const startHour = hours.start;
    const endHour = hours.end;
  
    for (let hour = startHour; hour <= endHour; hour++) {
      for (let minute of [0, 30]) {
        // Don't exceed endHour if it's the last half-hour
        if (hour === endHour && minute === 30) break;
  
        const displayHour = hour % 12 === 0 ? 12 : hour % 12;
        const amPm = hour < 12 ? 'AM' : 'PM';
        const formattedHour = hour < 10 ? `0${hour}` : `${hour}`;
        const formattedMinute = minute === 0 ? '00' : '30';
  
        this.timeOptions.push({
          value: `${formattedHour}:${formattedMinute}`,
          display: `${displayHour}:${formattedMinute} ${amPm}`,
        });
      }
    }
  }

  formValid: boolean = false;

    validateForm() {
    const user = this.userInfo;

    let isValid = user.fname?.trim() && user.lname?.trim() && user.email?.trim() && user.phone?.trim();

    if (this.selectedOrderType === 'delivery') {
      const addr = this.deliveryAddress;
      isValid = isValid && addr.street?.trim() && addr.city?.trim() && addr.zip?.trim();

      if (this.selectedPaymentMethod !== 'aeropay' || !this.selectedBankId) {
        isValid = false;
      }

      if (!this.deliveryAddressValid) {
        isValid = false;
      }
    }

    this.formValid = !!isValid;
  }

}
