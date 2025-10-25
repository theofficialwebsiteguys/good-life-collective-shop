import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShopComponentsComponent } from './good-life-shop-components.component';

describe('ShopComponentsComponent', () => {
  let component: ShopComponentsComponent;
  let fixture: ComponentFixture<ShopComponentsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShopComponentsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShopComponentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
