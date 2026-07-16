import { buildWilds, buildCamp } from './stages/wilds.js';
import { buildTown, buildFarm, buildStore, buildTavern } from './stages/willowbrook.js';
import { buildCastle, buildKeep, buildDungeon } from './stages/hyrmoor.js';
import { buildOcean, buildShip, buildIsland, buildSpa } from './stages/sea.js';
import { buildKorea, buildJapan, buildSg } from './stages/ports.js';

/**
 * Map schema — pure data, assembled from the stage modules in stages/.
 * Every place in the game is a finite stage with its own coordinate space
 * starting at (0,0); 'wilds' is the starting one.
 *
 *   w, h       bounds in px — entities are clamped inside
 *   outside    color painted beyond the bounds (void for towns, sea for isles)
 *   floor      ground color, checkered with floorAlt in 120px tiles
 *   start      where the party begins the game (starting map only)
 *   walled     draw a stone wall + corner towers around the perimeter
 *   fog        soft fog bands along the stage edges instead of a wall
 *   boat       players ride a boat here (ocean crossing)
 *   fixedCamera camera locks to the map center (shops, small buildings)
 *   alwaysLit  lamps and windows stay lit around the clock (the tavern)
 *   regions    [rect|circle] color patches drawn over the floor (biome
 *              zones, roads, plazas, water, dock planks) in order
 *   decos      static decorations; destructible buildings carry hp/burning
 *   buildings  the destructible subset of decos (see builders.building)
 *   colliders  axis-aligned rects entities cannot walk through; a collider
 *              with `b` stops blocking once that building is destroyed
 *   restricted rects that tint the screen red and, if you linger ~4s,
 *              summon the watch (MapManager + Reputation)
 *   gates      circular triggers that travel to another map:
 *              { x, y, r, style, label, target, tx, ty } — tx/ty is the
 *              arrival position in the target map. `locked` gates only
 *              announce their `message`.
 *   spawns     enemies spawned fresh on every visit
 *   respawn    { interval, cap, minDist } — refill waves (2× rate at night)
 *   dummies    training dummies placed on every visit
 *   npcs       townsfolk (see entities/Npc.js) — killable, chatty, with
 *              homes, pets, royals, and opinions about your reputation
 */
export const MAPS = {
  wilds: buildWilds(),
  town: buildTown(),
  castle: buildCastle(),
  ocean: buildOcean(),
  island: buildIsland(),
  farm: buildFarm(),
  keep: buildKeep(),
  dungeon: buildDungeon(),
  ship: buildShip(),
  camp: buildCamp(),
  korea: buildKorea(),
  japan: buildJapan(),
  sg: buildSg(),
  spa: buildSpa(),
  store: buildStore(),
  tavern: buildTavern(),
};

/** Where a fresh game begins. */
export const START_MAP = 'wilds';
