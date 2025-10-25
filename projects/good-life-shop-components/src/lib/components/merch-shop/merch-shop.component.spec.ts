import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MerchShopComponent } from './merch-shop.component';

describe('MerchShopComponent', () => {
  let component: MerchShopComponent;
  let fixture: ComponentFixture<MerchShopComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MerchShopComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MerchShopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
