import { Injectable } from '@angular/core';
import { ConfigService as AdminConfigService } from 'admin-dashboard';

@Injectable({
  providedIn: 'root'
})
export class ConfigService {
  private apiKey: string | null = null;

    constructor(private adminConfigService: AdminConfigService) {
    }

  setApiKey(key: string) {
    this.apiKey = key;
    this.adminConfigService.setApiKey(key);
  }

  getApiKey(): string {
    return this.apiKey || ''; // Fallback to empty string if not set
  }
}
