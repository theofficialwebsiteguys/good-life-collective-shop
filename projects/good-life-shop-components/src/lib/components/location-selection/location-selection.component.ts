import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccessibilityService } from '../../services/accessibility.service';
import { ProductsService } from '../../services/products.service';
import { SettingsService } from '../../services/settings.service';
import { NavigationService } from '../../services/navigation.service';
import { FormsModule } from '@angular/forms';

type ServiceType = 'pickup' | 'delivery';
export interface DailyHours { open: string; close: string } // 'HH:mm' 24h
export type HoursMap = Record<number, DailyHours>;          // 0=Sun..6=Sat

export interface LocationItem {
  location_id: string;
  name: string;
  address: string;
  logo?: string;
  services?: ServiceType[];
  hours?: HoursMap;
  deliveryHours?: HoursMap;
  happyHour?: Record<number, DailyHours[]>;
  timezone?: string;
  distanceKm?: number | null;
  etaMinutes?: number | null;
  bannerImage?: string;
}

@Component({
  selector: 'lib-location-selection',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './location-selection.component.html',
  styleUrl: './location-selection.component.css',
})
export class LocationSelectionComponent {
  @Output() locationChosen = new EventEmitter<LocationItem>();
  locations: LocationItem[] = [];
  isLoading = true;

  logoSrc = 'assets/good-life-logo.png';

  constructor(
    private a11y: AccessibilityService,
    private settings: SettingsService,
    private products: ProductsService,
    private nav: NavigationService
  ) {}

  ngOnInit() {
    this.loadLocations();
  }

  async loadLocations() {
    this.isLoading = true;
    try {
      const data = await this.settings.getFlowhubLocations();

      this.locations = (data || []).map((d: any) => {
        const loc: LocationItem = {
          location_id: d.location_id,
          name: d.name,
          address: d.address,
          logo: d.logo,
          services: d.services ?? ['pickup'],
          hours: d.hours,
          timezone: d.timezone ?? 'America/New_York',
          etaMinutes: d.etaMinutes ?? null,
          distanceKm: d.distanceKm ?? null,
          bannerImage: this.bannerFor(d.name),
        };

        const name = (d.name || '').toLowerCase();

        // --- Hardcoded Hours for Rochester ---
        if (name.includes('rochester')) {
          loc.hours = {
            0: { open: '09:00', close: '21:00' },
            1: { open: '09:00', close: '21:00' },
            2: { open: '09:00', close: '21:00' },
            3: { open: '09:00', close: '21:00' },
            4: { open: '09:00', close: '22:00' },
            5: { open: '09:00', close: '22:00' },
            6: { open: '09:00', close: '22:00' },
          };

          loc.deliveryHours = {
            0: { open: '09:00', close: '19:00' },
            1: { open: '09:00', close: '19:00' },
            2: { open: '09:00', close: '19:00' },
            3: { open: '09:00', close: '19:00' },
            4: { open: '09:00', close: '19:00' },
            5: { open: '09:00', close: '20:00' },
            6: { open: '09:00', close: '20:00' },
          };

          loc.timezone = 'America/New_York';
        }

        if (name.includes('canandaigua')) {
          loc.hours = {
            0: { open: '11:00', close: '18:00' },
            1: { open: '09:00', close: '21:00' },
            2: { open: '09:00', close: '21:00' },
            3: { open: '09:00', close: '21:00' },
            4: { open: '09:00', close: '21:00' },
            5: { open: '09:00', close: '22:00' },
            6: { open: '09:00', close: '22:00' },
          };

          loc.timezone = 'America/New_York';
        }

        // --- Hardcoded Hours for Astoria ---
        if (name.includes('astoria')) {
          loc.hours = {
            0: { open: '09:00', close: '21:00' },
            1: { open: '09:00', close: '21:00' },
            2: { open: '09:00', close: '21:00' },
            3: { open: '09:00', close: '21:00' },
            4: { open: '09:00', close: '21:00' },
            5: { open: '09:00', close: '21:00' },
            6: { open: '09:00', close: '21:00' },
          };

          loc.happyHour = {
            0: [{ open: '16:20', close: '00:00' }],
            1: [{ open: '16:20', close: '18:20' }],
            2: [{ open: '16:20', close: '18:20' }],
            3: [{ open: '16:20', close: '18:20' }],
            4: [{ open: '16:20', close: '18:20' }],
            5: [{ open: '16:20', close: '18:20' }],
            6: [{ open: '16:20', close: '18:20' }],
          };

          loc.timezone = 'America/Los_Angeles';
        }

        return loc;
      });

      this.a11y.announce(
        `Loaded ${this.locations.length} store${this.locations.length === 1 ? '' : 's'}.`,
        'polite'
      );
    } catch (err) {
      console.error('Failed to load locations', err);
      this.a11y.announce('Sorry, locations failed to load.', 'assertive');
    } finally {
      this.isLoading = false;
    }
  }

  selectLocation(loc: LocationItem) {
    this.settings.setSelectedLocationId(loc.location_id);

    this.a11y.announce(`Selected ${loc.name}. Loading products.`, 'polite');
  }

  navigateToCategory() {
    this.nav.navigateToCategory('Flower');
  }

  /* ----------------- Hours / status helpers ----------------- */

  private getTodayKey(tz?: string): number {
    const timeZone = tz || 'America/New_York';
    const parts = new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      timeZone
    }).formatToParts(new Date());

    const weekday = parts.find(p => p.type === 'weekday')?.value?.toLowerCase();
    const map: Record<string, number> = {
      sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6
    };
    return map[weekday?.slice(0,3) || 'sun'];
  }

  /** ----- DISPLAY HELPERS (no timezone shifting) ----- */
  private formatStoreTime(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date(2000, 0, 1, h, m || 0, 0);
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }).format(d);
  }

  private todayHoursFromMap(map?: HoursMap): string {
    if (!map) return 'Hours unavailable';
    const day = map[this.getTodayKey()];
    if (!day) return 'Hours unavailable';
    return `${this.formatStoreTime(day.open)}–${this.formatStoreTime(day.close)}`;
  }

  todayPickupHours(loc: LocationItem): string {
    return this.todayHoursFromMap(loc.hours);
  }

  todayDeliveryHours(loc: LocationItem): string {
    return this.todayHoursFromMap(loc.deliveryHours);
  }

  happyHourLabelToday(loc: LocationItem): string {
    const key = this.getTodayKey(loc.timezone);
    const ranges = loc.happyHour?.[key] || [];
    if (!ranges.length) return '';
    return ranges
      .map(r => `${this.formatStoreTime(r.open)}–${this.formatStoreTime(r.close)}`)
      .join(', ');
  }

  /** ----- LOGIC HELPERS (timezone aware) ----- */
  private parseMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  private nowMinutesTZ(tz?: string): number {
    const timeZone = tz || 'America/New_York';
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone
    }).formatToParts(new Date());

    const h = Number(parts.find(p => p.type === 'hour')?.value || 0);
    const m = Number(parts.find(p => p.type === 'minute')?.value || 0);
    return h * 60 + m;
  }

  private inNowRangeTZ(start: string, end: string, tz?: string, treatMidnightAsEndOfDay = false): boolean {
    const now = this.nowMinutesTZ(tz);
    const s = this.parseMinutes(start);
    let e = this.parseMinutes(end);

    if (treatMidnightAsEndOfDay && e === 0 && s < 24 * 60) e = 24 * 60;

    if (e > s) return now >= s && now < e;
    if (e < s) return now >= s || now < e;
    return false;
  }

  isOpenPickup(loc: LocationItem): boolean {
    return this.isOpenWithMapTZ(loc.hours, loc.timezone);
  }

  private isOpenWithMapTZ(map?: HoursMap, tz?: string): boolean {
    if (!map) return false;
    const d = map[this.getTodayKey(tz)];
    if (!d) return false;
    return this.inNowRangeTZ(d.open, d.close, tz);
  }

  hasHappyHourToday(loc: LocationItem): boolean {
    const key = this.getTodayKey(loc.timezone);
    return !!loc.happyHour?.[key]?.length;
  }

  isHappyHourNow(loc: LocationItem): boolean {
    const key = this.getTodayKey(loc.timezone);
    const ranges = loc.happyHour?.[key] || [];
    return ranges.some(r => this.inNowRangeTZ(r.open, r.close, loc.timezone, true));
  }

  hasDeliveryToday(loc: LocationItem): boolean {
    const key = this.getTodayKey(loc.timezone);
    return !!loc.deliveryHours?.[key];
  }

  isDeliveryNow(loc: LocationItem): boolean {
    const key = this.getTodayKey(loc.timezone);
    const d = loc.deliveryHours?.[key];
    if (!d) return false;
    return this.inNowRangeTZ(d.open, d.close, loc.timezone, true);
  }

  deliveryHoursLabelToday(loc: LocationItem): string {
    const key = this.getTodayKey(loc.timezone);
    const d = loc.deliveryHours?.[key];
    if (!d) return '';
    return `${this.formatStoreTime(d.open)}–${this.formatStoreTime(d.close)}`;
  }

  deliveryAriaLabel(loc: LocationItem): string {
    const status = this.isDeliveryNow(loc) ? 'available now' : 'not available now';
    const label = this.deliveryHoursLabelToday(loc);
    return label ? `Delivery ${status}. Today: ${label}` : `Delivery ${status}.`;
  }

  /* ----------------- Banner helpers ----------------- */
  private bannerFor(name: string) {
    const slug = (name || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(' ')[0];
    return `assets/${slug}.jpg`;
  }

  onBannerError(loc: LocationItem, ev: Event) {
    const img = ev.target as HTMLImageElement;
    if (img.src.endsWith('.webp') && loc.bannerImage) {
      loc.bannerImage = loc.bannerImage.replace('.webp', '.jpg');
      return;
    }
    loc.bannerImage = 'assets/location-banners/default.jpg';
  }

  selectedLocation: LocationItem | null = null;

  continue() {
    if (!this.selectedLocation) return;

    const loc = this.selectedLocation;
    this.settings.setSelectedLocationId(loc.location_id);
    this.products.fetchProducts(loc.location_id).subscribe({
      error: (e) => console.error('Error fetching products:', e),
    });

    this.a11y.announce(`Selected ${loc.name}. Loading products.`, 'polite');

    this.locationChosen.emit(loc); // ✅ tell parent we’re done
  }
}
