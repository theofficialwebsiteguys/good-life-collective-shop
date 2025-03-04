import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecentProductsCarouselComponent } from './recent-products-carousel.component';

describe('RecentProductsCarouselComponent', () => {
  let component: RecentProductsCarouselComponent;
  let fixture: ComponentFixture<RecentProductsCarouselComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecentProductsCarouselComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RecentProductsCarouselComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
