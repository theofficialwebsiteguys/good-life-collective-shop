import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, Input, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { Product } from '../../models/product.model';
import { ProductsService } from '../../services/products.service';
import { CommonModule } from '@angular/common';
import { ProductCardComponent } from '../product-card/product-card.component';
import { NavigationService } from '../../services/navigation.service';
import { OfferBanner } from '../../offer-banner.model';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'lib-product-list',
  standalone: true,
  imports: [CommonModule, ProductCardComponent],
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.css'
})
export class ProductListComponent implements OnInit {
  @Input() category: string | null = null;
  @Input() selectedBrands: string[] = []; // 🏷️ Brand filter
  @Input() selectedWeights: string[] = [];
  @Input() selectedTypes: string[] = []; // 🌿 Type filters
  @Input() selectedVapeTypes: string[] = [];
  @Input() searchQuery: string = ''; // 🔎 Search input
  @Input() sortOption: string = 'RECENT'; // 🔽 Sorting option
  @Input() onSaleOnly: boolean = false;
  @Input() thcMin: number = 0;
  @Input() thcMax: number = 100;

  activeOffer: OfferBanner | null = null;
  offers$: Observable<OfferBanner[]> = of([]);

  // products$: Observable<Product[]> = new Observable();
  baseProducts$!: Observable<Product[]>;
  products$!: Observable<Product[]>;


  trackById = (_: number, item: any) => item.id ?? item.productId ?? item.sku ?? item.title;


  constructor(private productService: ProductsService, private navigationService: NavigationService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.fetchFilteredProducts();

    this.route.queryParamMap.subscribe(params => {
      const offerId = params.get('offer');

      if (!offerId) {
        this.activeOffer = null;
        this.applyOfferFilter();
        return;
      }

      // wait until offers$ emits
      this.offers$.subscribe(offers => {
        const found = offers.find(o => o.id === offerId);
        if (found) {
          this.activeOffer = found;
          this.applyOfferFilter();
        }
      });
    });
  }


  ngOnChanges(changes: SimpleChanges): void {
    if (changes['category'] || changes['selectedBrands'] || changes['selectedWeights'] || changes['selectedTypes'] || changes['selectedVapeTypes'] || changes['searchQuery'] || changes['sortOption'] || changes['onSaleOnly'] || changes['thcMin'] || changes['thcMax']) {
      this.fetchFilteredProducts();
    }
  }

  fetchFilteredProducts(): void {
    this.baseProducts$ = this.productService.getFilteredProducts(
      this.searchQuery,
      this.category,
      this.selectedBrands,
      this.selectedWeights,
      this.selectedTypes,
      this.sortOption,
      this.onSaleOnly,
      this.thcMin,
      this.thcMax,
      this.selectedVapeTypes
    );

    if (this.category?.toLowerCase() === 'offers') {
      this.offers$ = this.baseProducts$.pipe(
        map(products => this.productService.getOfferBanners(products))
      );
    } else {
      this.activeOffer = null;
      this.offers$ = of([]);
    }

    this.applyOfferFilter();
  }


  navigateToProduct(product: Product) {
    this.navigationService.navigateToProduct(product);
  }

  handleCardKey(event: KeyboardEvent, product: Product) {
    if (event.key === 'Enter' || event.key === ' ') {
      this.navigateToProduct(product);
      event.preventDefault();
    }
  }

  private applyOfferFilter() {
    this.products$ = this.baseProducts$.pipe(
      map(products => {
        if (!this.activeOffer) return products;

        return products.filter(product =>
          this.activeOffer!.predicate(product)
        );
      })
    );
  }

  selectOffer(offer: OfferBanner) {
    this.activeOffer = offer;

    // ✅ Delegate URL + state to NavigationService
    this.navigationService.navigateToOffer(offer.id);

    this.applyOfferFilter();
  }

  clearOffer() {
    this.activeOffer = null;

    // ✅ Delegate clearing logic
    this.navigationService.clearOffer();

    this.applyOfferFilter();
  }



}
