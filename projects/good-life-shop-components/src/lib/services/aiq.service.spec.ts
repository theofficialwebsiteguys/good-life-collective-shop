import { TestBed } from '@angular/core/testing';

import { AiqService } from './aiq.service';

describe('AiqService', () => {
  let service: AiqService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AiqService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
