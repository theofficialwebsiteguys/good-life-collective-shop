import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AccessibilityService } from '../../services/accessibility.service';
import { ProductsService } from '../../services/products.service';
import { SettingsService } from '../../services/settings.service';
import { NavigationService } from '../../services/navigation.service';

@Component({
  selector: 'lib-location-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './location-dropdown.component.html',
  styleUrls: ['./location-dropdown.component.css'],
})
export class LocationDropdownComponent {
    isLoading = true;
  locations: Array<{ location_id: string; name: string }> = [];
  selectedId = '';
  selectedName = '';
  dropdownOpen = false;

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
      this.locations = (data || []).map((d: any) => ({
        location_id: d.location_id,
        name: d.name,
      }));

      const saved = this.settings.getSelectedLocationId?.();
      if (saved) {
        const loc = this.locations.find(l => l.location_id === saved);
        if (loc) {
          this.selectedId = saved;
          this.selectedName = loc.name;
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.isLoading = false;
    }
  }

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  selectLocation(loc: { location_id: string; name: string }) {
    this.selectedId = loc.location_id;
    this.selectedName = loc.name;
    this.dropdownOpen = false;

    this.settings.setSelectedLocationId(loc.location_id);
    this.products.fetchProducts(loc.location_id).subscribe({
      next: () => this.nav.navigateToCategory('Flower'),
      error: e => console.error(e),
    });

    this.a11y.announce(`Selected ${loc.name}. Loading products…`, 'polite');
  }
}
