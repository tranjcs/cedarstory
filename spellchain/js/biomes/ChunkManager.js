import { BIOMES, BIOME_IDS, TOTAL_BIOME_WEIGHT, BIOME_CELL, CHUNK_SIZE } from './BiomeRegistry.js';
import { hash2, seededRng } from '../core/math.js';
import { WORLD } from '../config.js';

/**
 * Infinite, deterministic terrain. Biomes come from a weighted Voronoi
 * over BIOME_CELL-sized cells; chunks (CHUNK_SIZE px) are generated lazily
 * with seeded decorations as players roam, and each freshly visited chunk
 * rolls its biome's enemy table once. Revisiting an area always shows the
 * same terrain (same seed -> same hash -> same chunk).
 */
export class ChunkManager {
  #chunks = new Map();        // "cx,cy" -> chunk
  #cellSeeds = new Map();     // "gx,gy" -> {sx, sy, biome}
  #spawnedChunks = new Set(); // chunk keys that already rolled enemies
  currentBiome = null;

  constructor(seed = 20260714) {
    this.seed = seed;
  }

  // ---------------------------------------------------------- biome voronoi

  #cellSeed(gx, gy) {
    const key = gx + ',' + gy;
    let cell = this.#cellSeeds.get(key);
    if (!cell) {
      const jx = hash2(gx, gy, this.seed + 11);
      const jy = hash2(gx, gy, this.seed + 23);
      let roll = hash2(gx, gy, this.seed + 37) * TOTAL_BIOME_WEIGHT;
      let biome = BIOMES[BIOME_IDS[0]];
      for (const id of BIOME_IDS) {
        roll -= BIOMES[id].weight;
        if (roll <= 0) { biome = BIOMES[id]; break; }
      }
      cell = {
        sx: (gx + 0.15 + jx * 0.7) * BIOME_CELL,
        sy: (gy + 0.15 + jy * 0.7) * BIOME_CELL,
        biome,
      };
      this.#cellSeeds.set(key, cell);
    }
    return cell;
  }

  /** Biome at a world position — nearest seed, weighted by biome size. */
  biomeAt(x, y) {
    const gx = Math.floor(x / BIOME_CELL), gy = Math.floor(y / BIOME_CELL);
    let best = null, bestDist = Infinity;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const cell = this.#cellSeed(gx + dx, gy + dy);
        const d = Math.hypot(x - cell.sx, y - cell.sy) / cell.biome.size;
        if (d < bestDist) { bestDist = d; best = cell.biome; }
      }
    }
    return best;
  }

  // ---------------------------------------------------------- chunks

  getChunk(cx, cy) {
    const key = cx + ',' + cy;
    let chunk = this.#chunks.get(key);
    if (!chunk) {
      const x = cx * CHUNK_SIZE, y = cy * CHUNK_SIZE;
      const biome = this.biomeAt(x + CHUNK_SIZE / 2, y + CHUNK_SIZE / 2);
      const rng = seededRng(Math.floor(hash2(cx, cy, this.seed + 51) * 2 ** 31));
      const decos = [];
      for (const [type, density] of biome.decorations) {
        const count = Math.floor(density * (0.5 + rng()));
        for (let i = 0; i < count; i++) {
          decos.push({
            type,
            x: x + rng() * CHUNK_SIZE,
            y: y + rng() * CHUNK_SIZE,
            s: 0.75 + rng() * 0.6,
            v: rng(),
          });
        }
      }
      chunk = { cx, cy, x, y, biome, decos };
      this.#chunks.set(key, chunk);
    }
    return chunk;
  }

  /** Ensure chunks near the player exist, roll spawns, track biome. */
  update(ctx) {
    const player = ctx.world.player;
    const pcx = Math.floor(player.x / CHUNK_SIZE);
    const pcy = Math.floor(player.y / CHUNK_SIZE);
    const R = 4; // keep a 9x9 chunk neighborhood alive

    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const chunk = this.getChunk(pcx + dx, pcy + dy);
        this.#maybeSpawn(chunk, ctx);
      }
    }

    // announce biome transitions
    const biome = this.biomeAt(player.x, player.y);
    if (biome !== this.currentBiome) {
      this.currentBiome = biome;
      ctx.bus.emit('announce', { text: 'Entering ' + biome.name });
    }

    // prune far chunks (they regenerate identically when revisited)
    if (this.#chunks.size > 500) {
      for (const [key, chunk] of this.#chunks) {
        if (Math.abs(chunk.cx - pcx) > 12 || Math.abs(chunk.cy - pcy) > 12) {
          this.#chunks.delete(key);
        }
      }
    }
  }

  #maybeSpawn(chunk, ctx) {
    const key = chunk.cx + ',' + chunk.cy;
    if (this.#spawnedChunks.has(key)) return;
    this.#spawnedChunks.add(key);

    const world = ctx.world;
    const liveEnemies = world.enemies.filter((e) => e.kind === 'enemy').length;
    if (liveEnemies >= WORLD.enemyCap) return;

    const rng = seededRng(Math.floor(hash2(chunk.cx, chunk.cy, this.seed + 77) * 2 ** 31));
    if (rng() > WORLD.spawnChance) return;

    const table = chunk.biome.enemies;
    const total = table.reduce((sum, [, w]) => sum + w, 0);
    const count = 1 + (rng() < 0.35 ? 1 : 0);
    for (let i = 0; i < count; i++) {
      let roll = rng() * total;
      let type = table[0][0];
      for (const [id, w] of table) {
        roll -= w;
        if (roll <= 0) { type = id; break; }
      }
      const x = chunk.x + rng() * CHUNK_SIZE;
      const y = chunk.y + rng() * CHUNK_SIZE;
      const player = world.player;
      if (Math.hypot(x - player.x, y - player.y) < WORLD.spawnMinDistance) continue;
      world.spawnEnemy(type, x, y);
    }
  }
}
