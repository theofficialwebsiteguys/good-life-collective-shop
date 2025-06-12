import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationService } from '../../services/navigation.service';

interface Category {
  name: string;
  iconPath: string;
}

@Component({
  selector: 'lib-categories',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.css'
})
export class CategoriesComponent {
  @Input() iconSet: string = 'playful';
  categories: Category[] = [];

  constructor(private navigationService: NavigationService) {}

  ngOnInit(): void {
    this.categories = [
      { name: 'Flower', iconPath: `assets/icons/${this.iconSet}/flower.png` },
      { name: 'PreRoll', iconPath: `assets/icons/${this.iconSet}/prerolls.png` },
      { name: 'Edible', iconPath: `assets/icons/${this.iconSet}/edibles.png` },
      { name: 'Concentrates', iconPath: `assets/icons/${this.iconSet}/concentrates.png` },
      { name: 'Vape', iconPath: `assets/icons/${this.iconSet}/vaporizers.png` },
      { name: 'Beverage', iconPath: `assets/icons/${this.iconSet}/beverages.png` },
      { name: 'Tinctures', iconPath: `assets/icons/${this.iconSet}/tinctures.png` },
      { name: 'Topical', iconPath: `assets/icons/${this.iconSet}/topicals.png` },
      { name: 'Accessories', iconPath: `assets/icons/${this.iconSet}/accessories.png` }
    ];
  }

  navigateToCategory(category: string): void {
    this.navigationService.navigateToCategory(category);
  }
}
