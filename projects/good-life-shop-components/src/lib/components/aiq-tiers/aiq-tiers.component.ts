import { Component, Input, OnChanges } from '@angular/core';
import { AppliedDiscount, AiqService } from '../../services/aiq.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';


export interface Discount {
  id: string;
  name: string;
  internalName: string;
  dollarValue: number;
  percentageValue: number;
  pointsDeduction: number;
  reusable: boolean;
  tierDiscount: boolean;
  available: boolean;
  posDiscountID: string;
}

interface DisplayDiscount {
  id: string;
  label: string;
  rewardText: string;
  unlockText: string;
  unlocked: boolean;
  redeemable: boolean;
  applied?: boolean;
}

@Component({
  selector: 'app-aiq-tiers',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './aiq-tiers.component.html',
  styleUrls: ['./aiq-tiers.component.scss'],
})
export class AiqTiersComponent implements OnChanges {
  @Input() userPoints = 0;
  @Input() discounts: Discount[] = [];

  displayDiscounts: DisplayDiscount[] = [];

  private appliedDiscount: AppliedDiscount | null = null;

  constructor(private aiqService: AiqService) {
    this.aiqService.appliedDiscount$.subscribe(discount => {
      this.appliedDiscount = discount;
      this.buildDiscounts();
    });
  }

  ngOnChanges(): void {
    if (!this.discounts?.length) return;
    this.buildDiscounts();
  }

  private buildDiscounts(): void {
    this.displayDiscounts = this.discounts
      .map(d => this.toDisplayDiscount(d))
      .sort((a, b) => {
        // Tier discounts first (those with points)
        const aPoints = this.extractPoints(a.unlockText);
        const bPoints = this.extractPoints(b.unlockText);

        if (aPoints !== null && bPoints !== null) {
          return aPoints - bPoints; // ascending points
        }
        if (aPoints !== null) return -1;
        if (bPoints !== null) return 1;

        // Both are promos → stable order
        return a.label.localeCompare(b.label);
      });
  }

  private extractPoints(text: string): number | null {
    const match = text.match(/(\d+)\s?pts/i);
    return match ? Number(match[1]) : null;
  }


  private toDisplayDiscount(d: Discount): DisplayDiscount {
    const isTier = d.tierDiscount && d.pointsDeduction > 0;

    const unlocked = isTier
      ? this.userPoints >= d.pointsDeduction
      : d.available === true;

    const applied = this.appliedDiscount?.id === d.id;

    return {
      id: d.id,
      label: d.name || d.internalName,
      rewardText: this.getRewardText(d),
      unlockText: isTier
        ? `${d.pointsDeduction} pts`
        : d.available ? 'Available' : 'Locked',
      unlocked,
      redeemable: unlocked && !applied,
      applied
    };
  }


  private getRewardText(d: Discount): string {
      if (d.dollarValue > 0) return `$${d.dollarValue} off your order`;
      if (d.percentageValue > 0) return `${d.percentageValue}% off your order`;
      return 'Special reward';
    }

    toggleDiscount(discount: DisplayDiscount): void {
    // 🔁 Remove if already applied
    if (discount.applied) {
      this.aiqService.setDiscount(null);
      return;
    }

    // ❌ Locked
    if (!discount.redeemable) return;

    const original = this.discounts.find(d => d.id === discount.id);
    if (!original) return;

    this.aiqService.setDiscount({
      id: original.id,
      posDiscountID: original.posDiscountID,
      dollarValue: original.dollarValue || undefined,
      percentageValue: original.percentageValue || undefined,
      name: original.name,
      tierDiscount: original.tierDiscount,
      pointsDeduction: original.pointsDeduction,
      reusable: original.reusable
    });
  }



  clearDiscount(): void {
    this.aiqService.setDiscount(null);
  }

  showAllRewards = false;

get unlockedRewards(): DisplayDiscount[] {
  return this.displayDiscounts.filter(d => d.unlocked);
}

get lockedRewards(): DisplayDiscount[] {
  return this.displayDiscounts.filter(d => !d.unlocked);
}

get nextReward(): DisplayDiscount | null {
  return this.lockedRewards.length ? this.lockedRewards[0] : null;
}

get bestUnlocked(): DisplayDiscount | null {
  return this.unlockedRewards.length
    ? this.unlockedRewards[this.unlockedRewards.length - 1]
    : null;
}

get visibleRewards(): DisplayDiscount[] {
  if (this.showAllRewards) return this.displayDiscounts;

  if (this.unlockedRewards.length) {
    return this.unlockedRewards.slice(0, 3);
  }

  return this.nextReward ? [this.nextReward] : [];
}

get pointsToNext(): number | null {
  if (!this.nextReward) return null;
  const match = this.nextReward.unlockText.match(/\d+/);
  return match ? Number(match[0]) - this.userPoints : null;
}

onRewardClick(reward: DisplayDiscount): void {
  if (!reward.unlocked) return;

  this.toggleDiscount(reward);
}


}
