/**
 * The world clock. One in-game day (1440 minutes) passes in 20 real-world
 * minutes (1200s), so game time runs at 1.2 minutes per second.
 *
 * Schedule: night 19:00–05:00, sunrise 05:00–06:00, day 06:00–18:00,
 * sunset 18:00–19:00. `darkness` is the 0..1-ish night overlay strength
 * the renderer applies; it lerps smoothly through sunrise and sunset, so
 * lights turn on as the world darkens and off as it brightens.
 */
export class DayCycle {
  minutes = 9 * 60; // a fresh game starts at 09:00

  update(dt) {
    this.minutes = (this.minutes + dt * (1440 / 1200)) % 1440;
  }

  get hour() {
    return this.minutes / 60;
  }

  get phase() {
    const h = this.hour;
    if (h < 5) return 'night';
    if (h < 6) return 'sunrise';
    if (h < 18) return 'day';
    if (h < 19) return 'sunset';
    return 'night';
  }

  get isNight() {
    return this.phase === 'night';
  }

  /**
   * Continuous lighting curve: brightest at noon, deepest just after
   * midnight. Daylight drifts gently (0.14 at the day's edges → 0 at noon),
   * dawn and dusk lerp through, and the night deepens toward 0.64.
   */
  get darkness() {
    const h = this.hour;
    if (h >= 6 && h < 18) {
      return 0.14 * (1 - Math.sin(((h - 6) / 12) * Math.PI));
    }
    if (h >= 5 && h < 6) return 0.58 + (0.14 - 0.58) * (h - 5);
    if (h >= 18 && h < 19) return 0.14 + (0.58 - 0.14) * (h - 18);
    // night 19:00 → 05:00, bottoming out around 00:00
    const n = (h >= 19 ? h - 19 : h + 5) / 10; // 0..1 through the night
    return 0.58 + 0.06 * Math.sin(n * Math.PI);
  }

  /** Lights (lamps, windows, lanterns) are on whenever it's dim enough. */
  get lightsOn() {
    return this.darkness > 0.12;
  }

  get clock() {
    const h = Math.floor(this.hour);
    const m = Math.floor(this.minutes % 60);
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
}
