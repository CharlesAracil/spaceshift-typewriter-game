export const HEAL_AMOUNT = 25;
export const HEAL_COOLDOWN_MS = 60000;
export const FREEZE_DURATION_MS = 5000;
export const FREEZE_COOLDOWN_MS = 90000;

export const SPELL_WORDS: string[] = ['heal', 'freeze'];

export class SpellManager {
  private _healCooldown = 0;
  private _freezeCooldown = 0;
  private _freezeRemaining = 0;

  get healReady(): boolean {
    return this._healCooldown <= 0;
  }

  get freezeReady(): boolean {
    return this._freezeCooldown <= 0;
  }

  get healCooldownRatio(): number {
    if (this._healCooldown <= 0) return 1;
    return 1 - this._healCooldown / HEAL_COOLDOWN_MS;
  }

  get freezeCooldownRatio(): number {
    if (this._freezeCooldown <= 0) return 1;
    return 1 - this._freezeCooldown / FREEZE_COOLDOWN_MS;
  }

  get isFreezing(): boolean {
    return this._freezeRemaining > 0;
  }

  triggerHeal(): boolean {
    if (this._healCooldown > 0) return false;
    this._healCooldown = HEAL_COOLDOWN_MS;
    return true;
  }

  triggerFreeze(): boolean {
    if (this._freezeCooldown > 0) return false;
    this._freezeCooldown = FREEZE_COOLDOWN_MS;
    this._freezeRemaining = FREEZE_DURATION_MS;
    return true;
  }

  update(delta: number): void {
    if (this._healCooldown > 0) {
      this._healCooldown = Math.max(0, this._healCooldown - delta);
    }
    if (this._freezeCooldown > 0) {
      this._freezeCooldown = Math.max(0, this._freezeCooldown - delta);
    }
    if (this._freezeRemaining > 0) {
      this._freezeRemaining = Math.max(0, this._freezeRemaining - delta);
    }
  }

  reset(): void {
    this._healCooldown = 0;
    this._freezeCooldown = 0;
    this._freezeRemaining = 0;
  }
}
