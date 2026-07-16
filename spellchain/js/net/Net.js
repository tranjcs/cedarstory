import { ENEMY_TYPES } from '../enemies/EnemyRegistry.js';
import { StatusEffects } from '../entities/StatusEffects.js';

const SEND_INTERVAL = 1 / 12; // state/position ticks per second

/**
 * Experimental two-player co-op over a WebRTC data channel.
 *
 * No server: the offer/answer codes are exchanged by hand (paste them over
 * any chat), which keeps the game fully static-hostable. A public STUN
 * server is used for address discovery only.
 *
 * The HOST is authoritative: it simulates enemies and travel, and streams
 * compact world snapshots. The GUEST simulates only its own wizard, sends
 * its position, and reports damage it deals as deltas the host applies.
 * Spell visuals stay local to each screen — what syncs is where everyone
 * is, what's alive, and how hurt it is.
 */
export class Net {
  role = null; // 'host' | 'guest' | null
  onStatus = (text) => {};

  #pc = null;
  #chan = null;
  #sendT = 0;
  #remote = null;          // the other player's avatar in world.players
  #mirrors = new Map();    // guest: enemy id -> local shell

  get connected() {
    return this.#chan?.readyState === 'open';
  }

  get isHost() {
    return this.role === 'host' && this.connected;
  }

  get isGuest() {
    return this.role === 'guest' && this.connected;
  }

  /** Start hosting. Resolves to the offer code to send to the guest. */
  async host(ctx) {
    this.role = 'host';
    this.#pc = this.#makePeer(ctx);
    this.#bindChannel(this.#pc.createDataChannel('game'), ctx);
    await this.#pc.setLocalDescription(await this.#pc.createOffer());
    await this.#waitIce();
    this.onStatus('Code ready — send it to your co-op partner, then paste their reply and Accept.');
    return this.#encode();
  }

  /** Join with a host's offer code. Resolves to the answer code to send back. */
  async join(code, ctx) {
    this.role = 'guest';
    this.#pc = this.#makePeer(ctx);
    this.#pc.ondatachannel = (e) => this.#bindChannel(e.channel, ctx);
    await this.#pc.setRemoteDescription(this.#decode(code));
    await this.#pc.setLocalDescription(await this.#pc.createAnswer());
    await this.#waitIce();
    this.onStatus('Reply code ready — send it back to the host. Connecting…');
    return this.#encode();
  }

  /** Host accepts the guest's answer code. */
  async acceptAnswer(code) {
    await this.#pc.setRemoteDescription(this.#decode(code));
    this.onStatus('Connecting…');
  }

  /** Called every frame from the main loop. */
  update(dt, ctx) {
    if (!this.connected) return;

    // guest: report damage dealt to mirrored enemies since last tick
    if (this.isGuest) {
      for (const e of ctx.world.enemies) {
        if (!e.mirror) continue;
        if (e.hp < e.netHp - 0.5) {
          this.#send({ t: 'd', id: e.id, dmg: e.netHp - e.hp });
          e.netHp = e.hp;
        }
      }
    }

    this.#sendT -= dt;
    if (this.#sendT > 0) return;
    this.#sendT = SEND_INTERVAL;

    const me = ctx.world.player;
    if (this.isHost) {
      this.#send({
        t: 's',
        map: ctx.maps.currentId,
        px: Math.round(me.x), py: Math.round(me.y),
        hp: Math.round(me.hp), name: me.name ?? '', cls: ctx.activeClass?.id ?? 'mage',
        e: ctx.world.enemies
          .filter((e) => e.kind === 'enemy' && !e.dead)
          .map((e) => [e.id, e.type, Math.round(e.x), Math.round(e.y), Math.round(e.hp)]),
      });
    } else {
      this.#send({
        t: 'g',
        x: Math.round(me.x), y: Math.round(me.y),
        name: me.name ?? '', cls: ctx.activeClass?.id ?? 'mage',
      });
    }
  }

  // ------------------------------------------------------------- plumbing

  #makePeer(ctx) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        this.#teardown(ctx);
      }
    };
    return pc;
  }

  #bindChannel(chan, ctx) {
    this.#chan = chan;
    chan.onopen = () => {
      this.onStatus('Connected! Adventure together.');
      ctx.bus.emit('announce', { text: 'A companion joins your story' });
    };
    chan.onclose = () => this.#teardown(ctx);
    chan.onmessage = (e) => {
      try {
        this.#receive(JSON.parse(e.data), ctx);
      } catch { /* malformed packet — drop it */ }
    };
  }

  #send(msg) {
    if (this.connected) this.#chan.send(JSON.stringify(msg));
  }

  #receive(msg, ctx) {
    if (msg.t === 'g' && this.isHost) {
      const r = this.#ensureRemote(ctx);
      r.x = msg.x; r.y = msg.y; r.name = msg.name; r.cls = msg.cls;
    } else if (msg.t === 'd' && this.isHost) {
      const e = ctx.world.enemies.find((en) => en.id === msg.id && !en.dead);
      if (e) {
        e.hp -= msg.dmg;
        e.flash = 0.12;
        if (e.hp <= 0) ctx.combat.killTarget(e);
      }
    } else if (msg.t === 's' && this.isGuest) {
      this.#applyState(msg, ctx);
    }
  }

  /** Guest: mirror the host's snapshot into the local world. */
  #applyState(msg, ctx) {
    // travel with the host
    if (msg.map !== ctx.maps.currentId) {
      this.#mirrors.clear();
      ctx.maps.netTravel(msg.map, msg.px + 40, msg.py + 24, ctx);
    }

    const r = this.#ensureRemote(ctx);
    r.x = msg.px; r.y = msg.py; r.hp = msg.hp; r.name = msg.name; r.cls = msg.cls;

    const world = ctx.world;
    const seen = new Set();
    for (const [id, type, x, y, hp] of msg.e) {
      seen.add(id);
      let e = this.#mirrors.get(id);
      if (!e) {
        e = this.#makeShell(id, type, x, y);
        this.#mirrors.set(id, e);
        world.enemies.push(e);
      }
      e.x = x; e.y = y;
      e.hp = hp; e.netHp = hp;
      e.maxHp = Math.max(e.maxHp, hp);
    }
    world.enemies = world.enemies.filter((e) => !e.mirror || seen.has(e.id));
    for (const id of this.#mirrors.keys()) {
      if (!seen.has(id)) this.#mirrors.delete(id);
    }
  }

  /** A drawable, hittable stand-in for an enemy the host simulates. */
  #makeShell(id, type, x, y) {
    const spec = ENEMY_TYPES[type];
    return {
      kind: 'enemy', mirror: true, id, type, spec,
      x, y, hp: spec.hp, maxHp: spec.hp, netHp: spec.hp,
      status: new StatusEffects(), wobble: 0, flash: 0, facing: 0,
      kx: 0, ky: 0, windingUp: false, dead: false,
      weaponHeld: !!spec.weapon,
      poisonImmune: !!spec.poisonImmune, undead: !!spec.undead,
      update(dt) {
        this.flash = Math.max(0, this.flash - dt);
        this.status.update(dt);
      },
    };
  }

  /** The other player's wizard, drawn and targetable but net-driven. */
  #ensureRemote(ctx) {
    if (!this.#remote) {
      this.#remote = {
        kind: 'player', remote: true, name: '', cls: 'mage',
        x: ctx.world.player.x + 40, y: ctx.world.player.y,
        vx: 0, vy: 0, hp: 100, maxHp: 100, ward: 0,
        facing: 0, walk: 0, portalCd: 0, status: new StatusEffects(),
        update() {}, dash() {},
      };
      ctx.world.players.push(this.#remote);
    }
    return this.#remote;
  }

  #teardown(ctx) {
    if (this.#remote) {
      const i = ctx.world.players.indexOf(this.#remote);
      if (i > 0) ctx.world.players.splice(i, 1);
      this.#remote = null;
    }
    if (this.isGuest) {
      ctx.world.enemies = ctx.world.enemies.filter((e) => !e.mirror);
    }
    this.#mirrors.clear();
    this.role = null;
    this.#chan = null;
    this.#pc?.close();
    this.#pc = null;
    this.onStatus('Disconnected.');
    ctx.bus.emit('announce', { text: 'Your companion departed' });
  }

  #waitIce() {
    return new Promise((resolve) => {
      if (this.#pc.iceGatheringState === 'complete') return resolve();
      this.#pc.onicegatheringstatechange = () => {
        if (this.#pc.iceGatheringState === 'complete') resolve();
      };
      setTimeout(resolve, 3000); // good enough — trickle the rest
    });
  }

  #encode() {
    return btoa(JSON.stringify(this.#pc.localDescription));
  }

  #decode(code) {
    return new RTCSessionDescription(JSON.parse(atob(code.trim())));
  }
}
