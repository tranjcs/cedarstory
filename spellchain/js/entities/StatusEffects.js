/**
 * Timed elemental statuses, composed into anything that can be affected by
 * spells (Component pattern). Each field is seconds remaining.
 */
export class StatusEffects {
  wet = 0;
  burn = 0;
  chill = 0;
  frozen = 0;
  shock = 0;

  update(dt) {
    this.wet = Math.max(0, this.wet - dt);
    this.burn = Math.max(0, this.burn - dt);
    this.chill = Math.max(0, this.chill - dt);
    this.frozen = Math.max(0, this.frozen - dt);
    this.shock = Math.max(0, this.shock - dt);
  }
}
