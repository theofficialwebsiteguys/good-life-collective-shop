import { TestBed } from '@angular/core/testing';

import { ShopComponentsService } from './shop-components.service';

describe('ShopComponentsService', () => {
  let service: ShopComponentsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ShopComponentsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
