import { TestBed } from '@angular/core/testing';

import { AeropayService } from './aeropay.service';

describe('AeropayService', () => {
  let service: AeropayService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AeropayService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
