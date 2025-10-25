import { Injectable, Renderer2, RendererFactory2 } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AccessibilityService {
  private liveRegion: HTMLElement | null = null;
  private renderer: Renderer2;

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    this.createLiveRegion();
  }

  // Create a global live region if it doesn't exist
  private createLiveRegion(): void {
    if (!this.liveRegion) {
      this.liveRegion = this.renderer.createElement('div');
      this.renderer.setAttribute(this.liveRegion, 'aria-live', 'polite');
      this.renderer.setAttribute(this.liveRegion, 'aria-atomic', 'true');
      this.renderer.setStyle(this.liveRegion, 'position', 'absolute');
      this.renderer.setStyle(this.liveRegion, 'width', '1px');
      this.renderer.setStyle(this.liveRegion, 'height', '1px');
      this.renderer.setStyle(this.liveRegion, 'margin', '-1px');
      this.renderer.setStyle(this.liveRegion, 'border', '0');
      this.renderer.setStyle(this.liveRegion, 'padding', '0');
      this.renderer.setStyle(this.liveRegion, 'overflow', 'hidden');
      this.renderer.setStyle(this.liveRegion, 'clip', 'rect(0, 0, 0, 0)');
      this.renderer.setStyle(this.liveRegion, 'white-space', 'nowrap');
      this.renderer.appendChild(document.body, this.liveRegion);
    }
  }

  // Announce a message to screen readers with optional politeness level
  announce(message: string, politeness: 'polite' | 'assertive' = 'polite'): void {
    if (this.liveRegion) {
      this.renderer.setAttribute(this.liveRegion, 'aria-live', politeness);
      this.liveRegion.textContent = '';
      setTimeout(() => {
        this.liveRegion!.textContent = message;
      }, 100);
    }
  }
}
