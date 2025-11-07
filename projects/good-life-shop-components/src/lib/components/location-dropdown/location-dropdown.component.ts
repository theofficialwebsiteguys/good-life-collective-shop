import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { AccessibilityService } from '../../services/accessibility.service';
import { SettingsService } from '../../services/settings.service';
import { LocationSelectionComponent } from '../location-selection/location-selection.component'; // adjust path

@Component({
  selector: 'lib-location-dropdown',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './location-dropdown.component.html',
  styleUrls: ['./location-dropdown.component.css'],
})
export class LocationDropdownComponent {
  isLoading = true;
  formattedLocation = '';

  constructor(
    private dialog: MatDialog,
    private a11y: AccessibilityService,
    private settings: SettingsService
  ) {}

  async ngOnInit() {
    await this.loadSelectedLocation();
  }

  async loadSelectedLocation() {
    this.isLoading = true;
    try {
      const saved = this.settings.getSelectedLocationId?.();
      if (saved) {
        const data = await this.settings.getFlowhubLocations();
        const loc = (data || []).find((l: any) => l.location_id === saved);
        if (loc && loc.address) {
          this.formattedLocation = this.extractCityState(loc.address);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      this.isLoading = false;
    }
  }

  extractCityState(address: string): string {
    const parts = address.split(',');
    if (parts.length >= 3) {
      const city = parts[1].trim();
      const state = parts[2].trim().split(' ')[0];
      return `${city}, ${state}`;
    }
    return address;
  }

  openLocationModal() {
    this.a11y.announce('Opening location selector…', 'polite');

    const dialogRef = this.dialog.open(LocationSelectionComponent, {
      width: '500px',
      panelClass: 'location-modal',
    });

    // ✅ When the user selects a location, the dialog sends back the data
    dialogRef.afterClosed().subscribe((selectedLoc) => {
      if (selectedLoc) {
        this.formattedLocation = this.extractCityState(selectedLoc.address);
        this.settings.setSelectedLocationId(selectedLoc.location_id);
      }
    });
  }
}
