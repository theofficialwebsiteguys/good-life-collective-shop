import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationService } from '../../services/navigation.service';
import { ProductsService } from '../../services/products.service';
import { Router } from '@angular/router';

interface Category {
  name: string;
  iconPath: string;
}

@Component({
  selector: 'lib-categories',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.css'],
})
export class CategoriesComponent implements OnInit, AfterViewInit, OnDestroy {
  /** Icon set folder inside /assets/icons/ */
  @Input() iconSet: string = 'gl-icons';

  /** Highlights the active chip; pass from parent (e.g., query param). */
  @Input() activeCategory: string | null | undefined = null;

  @ViewChild('row', { static: true }) rowRef!: ElementRef<HTMLDivElement>;

  categories: Category[] = [];

  // Edge gradients visibility
  showLeftEdge = false;
  showRightEdge = false;

  private onScrollBound?: () => void;
  private onResizeBound?: () => void;

  constructor(private navigationService: NavigationService, private productService: ProductsService, private router: Router) {}

  ngOnInit(): void {
    this.categories = [
      { name: 'Offers',        iconPath: `assets/icons/${this.iconSet}/offers.png` },
      { name: 'Flower',        iconPath: `assets/icons/${this.iconSet}/flower.png` },
      { name: 'Pre-Roll',      iconPath: `assets/icons/${this.iconSet}/prerolls.png` },
      { name: 'Edibles',       iconPath: `assets/icons/${this.iconSet}/edibles.png` },
      { name: 'Concentrates',  iconPath: `assets/icons/${this.iconSet}/concentrates.png` },
      { name: 'Vapes',         iconPath: `assets/icons/${this.iconSet}/vaporizers.png` },
      { name: 'Beverage',      iconPath: `assets/icons/${this.iconSet}/beverages.png` },
      { name: 'Tinctures',     iconPath: `assets/icons/${this.iconSet}/tinctures.png` },
      { name: 'Topicals',      iconPath: `assets/icons/${this.iconSet}/topicals.png` },
      { name: 'Accessories',   iconPath: `assets/icons/${this.iconSet}/accessories.png` },
    ];
  }

  ngAfterViewInit(): void {
    // Initial edge state (wait a tick so layout is settled)
    setTimeout(() => this.updateEdges(), 0);

    // Bind once, so we can cleanly remove listeners
    this.onScrollBound = () => this.updateEdges();
    this.onResizeBound = () => this.updateEdges();

    this.rowRef.nativeElement.addEventListener('scroll', this.onScrollBound, { passive: true });
    window.addEventListener('resize', this.onResizeBound, { passive: true });
  }

  ngOnDestroy(): void {
    if (this.onScrollBound) {
      this.rowRef.nativeElement.removeEventListener('scroll', this.onScrollBound);
    }
    if (this.onResizeBound) {
      window.removeEventListener('resize', this.onResizeBound);
    }
  }

  /** Click/keyboard activation */
  navigateToCategory(category: string): void {
    this.activeCategory = category;
    this.productService.updateCategory(category.toUpperCase() as any);

    this.router.navigate(['/shop'], {
      queryParams: { category: category, brand: null },
      queryParamsHandling: 'merge'
    });
  }

  /** Called by (scroll) in the template or via listeners */
  onScroll(_: HTMLElement): void {
    this.updateEdges();
  }

  /** Keep gradient edges accurate */
  private updateEdges(): void {
    const el = this.rowRef.nativeElement;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    this.showLeftEdge = scrollLeft > 6;
    this.showRightEdge = scrollLeft + clientWidth < scrollWidth - 6;
  }

  /** After selecting a category, ensure it’s visible. */
  private scrollActiveIntoView(): void {
    if (!this.activeCategory) return;
    const el = this.rowRef.nativeElement;
    const chip = Array.from(el.querySelectorAll<HTMLButtonElement>('.cat'))
      .find(btn => btn.textContent?.trim() === this.activeCategory);
    chip?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  /** For *ngFor performance */
  trackByName = (_: number, c: Category) => c.name;
}
