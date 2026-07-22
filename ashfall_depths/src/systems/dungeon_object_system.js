import { dungeon_object_definitions, dungeon_object_list } from "../data/dungeon_objects.js";
import { item_database } from "../data/items.js";

const cardinal_directions = Object.freeze([
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: -1, y: 0 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: 0, y: -1 })
]);

const urn_item_pool = Object.freeze(["healing_potion", "mana_potion"]);
const openable_object_types = new Set(["locked_door", "secret_wall"]);
let next_object_id = 1;

export class DungeonObjectSystem {
  constructor(game) {
    this.game = game;
  }

  spawn_floor_objects() {
    const floor = Math.max(1, Math.floor(Number(this.game.state.floor) || 1));
    const target_count = Math.min(14, floor === 1 ? 2 : 3 + Math.floor(floor / 2));
    const available = dungeon_object_list.filter((definition) => definition.minimum_floor <= floor);
    const used_type_ids = new Set();
    const spawned = [];

    for (let index = 0; index < target_count; index += 1) {
      const unused = available.filter((definition) => !used_type_ids.has(definition.id));
      const definition = this.pick_weighted(unused.length > 0 ? unused : available);
      if (!definition) {
        break;
      }
      const position = this.find_spawn_position(definition);
      if (!position) {
        continue;
      }
      const object = create_dungeon_object(definition, position.x, position.y, floor);
      this.game.entities.push(object);
      spawned.push(object);
      used_type_ids.add(definition.id);
    }

    this.link_mechanisms(spawned);
    this.game.dungeon.dungeon_objects = spawned;
    return spawned;
  }

  pick_weighted(definitions) {
    if (definitions.length === 0) {
      return null;
    }
    const total = definitions.reduce((sum, definition) => sum + definition.weight, 0);
    let roll = this.game.dungeon.random.next() * total;
    for (const definition of definitions) {
      roll -= definition.weight;
      if (roll <= 0) {
        return definition;
      }
    }
    return definitions.at(-1);
  }

  find_spawn_position(definition) {
    const dungeon = this.game.dungeon;
    const occupied_keys = new Set(this.game.entities
      .filter((entity) => entity.alive)
      .map((entity) => position_key(entity.grid_x, entity.grid_y)));
    occupied_keys.add(position_key(dungeon.start.x, dungeon.start.y));
    occupied_keys.add(position_key(dungeon.exit.x, dungeon.exit.y));
    for (const room of dungeon.rooms ?? []) {
      occupied_keys.add(position_key(room.center_x, room.center_y));
    }

    const candidates = [];
    for (let y = 1; y < dungeon.grid.height - 1; y += 1) {
      for (let x = 1; x < dungeon.grid.width - 1; x += 1) {
        const tile = dungeon.grid.get_tile(x, y);
        if (!tile || !dungeon.grid.is_walkable(x, y) || tile.terrain_id === "exit") {
          continue;
        }
        const key = position_key(x, y);
        if (occupied_keys.has(key) || manhattan_distance({ x, y }, dungeon.exit) <= 2) {
          continue;
        }
        if (!this.matches_placement(definition, x, y, tile)) {
          continue;
        }
        candidates.push({ x, y });
      }
    }

    while (candidates.length > 0) {
      const index = this.game.dungeon.random.integer(0, candidates.length - 1);
      const [candidate] = candidates.splice(index, 1);
      if (definition.placement === "room_static" && !dungeon_remains_connected_with_objects(
        dungeon,
        [...this.get_static_blockers(), candidate]
      )) {
        continue;
      }
      return candidate;
    }
    return null;
  }

  matches_placement(definition, x, y, tile) {
    if (definition.placement === "corridor") {
      if (tile.room_index !== null) {
        return false;
      }
      const horizontal = this.game.dungeon.grid.is_walkable(x - 1, y) && this.game.dungeon.grid.is_walkable(x + 1, y);
      const vertical = this.game.dungeon.grid.is_walkable(x, y - 1) && this.game.dungeon.grid.is_walkable(x, y + 1);
      return horizontal || vertical;
    }

    if (tile.room_index === null) {
      return false;
    }
    const open_neighbors = cardinal_directions.filter((direction) =>
      this.game.dungeon.grid.is_walkable(x + direction.x, y + direction.y)
    ).length;
    return definition.placement === "room_static" ? open_neighbors >= 3 : open_neighbors >= 2;
  }

  get_objects() {
    return this.game.entities.filter((entity) => entity.alive && entity.type === "dungeon_object");
  }

  get_static_blockers() {
    return this.get_objects()
      .filter((object) => object.blocks_movement && !object.open && !openable_object_types.has(object.object_type))
      .map((object) => ({ x: object.grid_x, y: object.grid_y }));
  }

  get_object_at(x, y, predicate = null) {
    return this.get_objects().find((object) =>
      object.grid_x === x && object.grid_y === y && (!predicate || predicate(object))
    ) ?? null;
  }

  get_adjacent_interactable(actor = this.game.player) {
    return this.get_objects()
      .filter((object) => manhattan_distance(actor, object) <= 1 && this.can_interact(object))
      .sort((a, b) => this.interaction_priority(a) - this.interaction_priority(b))[0] ?? null;
  }

  can_interact(object) {
    if (!object.alive || object.open) {
      return false;
    }
    if (object.object_type === "pressure_plate") {
      return false;
    }
    if (object.object_type === "spike_trap") {
      return object.revealed && !object.used;
    }
    if (object.object_type === "healing_fountain") {
      return !object.used;
    }
    if (object.object_type === "lever") {
      return !object.used;
    }
    return true;
  }

  interaction_priority(object) {
    return {
      locked_door: 1,
      secret_wall: 2,
      healing_fountain: 3,
      lever: 4,
      explosive_barrel: 5,
      breakable_urn: 6,
      spike_trap: 7
    }[object.object_type] ?? 20;
  }

  get_prompt(object) {
    if (!object || (object.object_type === "secret_wall" && !object.revealed)) {
      return "";
    }
    const prompts = {
      locked_door: "press e or xbox a to force open the locked door · consumes a turn",
      secret_wall: "press e or xbox a to open the revealed secret wall · consumes a turn",
      explosive_barrel: "press e or xbox a to detonate the barrel · consumes a turn",
      breakable_urn: "press e or xbox a to break the urn · consumes a turn",
      healing_fountain: "press e or xbox a to drink from the fountain · consumes a turn",
      lever: "press e or xbox a to pull the lever · consumes a turn",
      spike_trap: "press e or xbox a to disarm the revealed spike trap · consumes a turn"
    };
    return prompts[object.object_type] ?? "";
  }

  interact(object) {
    if (!this.can_interact(object)) {
      return false;
    }
    switch (object.object_type) {
      case "locked_door":
        return this.open_barrier(object, "you force the locked door open");
      case "secret_wall":
        if (!object.revealed) {
          object.revealed = true;
          this.game.add_log("you discover a hidden seam in the wall");
          this.game.exploration_system?.update_visibility();
          return true;
        }
        return this.open_barrier(object, "the secret wall grinds aside");
      case "explosive_barrel":
        return this.detonate_barrel(object);
      case "breakable_urn":
        return this.break_urn(object);
      case "healing_fountain":
        return this.use_fountain(object);
      case "lever":
        return this.pull_lever(object);
      case "spike_trap":
        object.used = true;
        object.active = false;
        this.game.add_log("you disarm the spike trap");
        return true;
      default:
        return false;
    }
  }

  reveal_secret_wall(object) {
    if (!object || object.object_type !== "secret_wall" || object.open) {
      return false;
    }
    if (!object.revealed) {
      object.revealed = true;
      this.game.add_effect("frost", object.grid_x, object.grid_y);
      this.game.add_log("the wall sounds hollow · a secret passage is concealed here");
      this.game.exploration_system?.update_visibility();
    } else {
      this.game.add_log("the revealed secret wall can be opened with interact");
    }
    return true;
  }

  open_barrier(object, message) {
    object.open = true;
    object.blocks_movement = false;
    object.blocks_vision = false;
    object.revealed = true;
    this.game.add_effect("frost", object.grid_x, object.grid_y);
    this.game.add_log(message);
    this.game.exploration_system?.update_visibility();
    return true;
  }

  pull_lever(lever) {
    lever.used = true;
    lever.active = true;
    const linked = this.get_linked_objects(lever);
    let changed = 0;
    for (const object of linked) {
      if (openable_object_types.has(object.object_type) && !object.open) {
        this.open_barrier(object, `${object.name} opens somewhere in the dungeon`);
        changed += 1;
      } else if (object.object_type === "spike_trap" && !object.used) {
        object.used = true;
        object.active = false;
        object.revealed = true;
        changed += 1;
      }
    }
    this.game.add_log(changed > 0 ? "the lever releases distant mechanisms" : "the lever moves, but nothing answers");
    return true;
  }

  use_fountain(fountain) {
    const player = this.game.player;
    const health_restored = Math.min(Math.ceil(player.maximum_health * 0.45), player.maximum_health - player.health);
    const magic_restored = Math.min(Math.ceil(player.maximum_magic * 0.45), player.maximum_magic - player.magic);
    if (health_restored <= 0 && magic_restored <= 0) {
      this.game.add_log("the fountain is potent, but your reserves are already full");
      return false;
    }
    fountain.used = true;
    player.health += health_restored;
    player.magic += magic_restored;
    this.game.add_effect("heal", fountain.grid_x, fountain.grid_y);
    this.game.add_log(`the fountain restores ${health_restored} health and ${magic_restored} magic`);
    return true;
  }

  break_urn(urn) {
    urn.alive = false;
    urn.blocks_movement = false;
    const gold = this.game.dungeon.random.integer(3, 10 + Math.floor(this.game.state.floor / 2));
    this.game.state.gold += gold;
    let item_name = "";
    if (this.game.dungeon.random.chance(0.3)) {
      const item_id = this.game.dungeon.random.pick(urn_item_pool);
      this.game.state.inventory.add_item(item_id);
      item_name = ` and ${item_database[item_id].name}`;
    }
    this.game.add_effect("chest", urn.grid_x, urn.grid_y);
    this.game.add_log(`the urn breaks · ${gold} gold${item_name}`);
    return true;
  }

  detonate_barrel(barrel) {
    barrel.alive = false;
    barrel.blocks_movement = false;
    const damage = 12 + Math.floor(this.game.state.floor * 0.8);
    const actors = this.game.entities.filter((entity) =>
      entity.alive && ["player", "monster", "companion", "recruitable"].includes(entity.type) &&
      Math.hypot(entity.grid_x - barrel.grid_x, entity.grid_y - barrel.grid_y) <= 1.6
    );
    this.game.add_effect("fire", barrel.grid_x, barrel.grid_y);
    this.game.add_log("the explosive barrel erupts");
    for (const actor of actors) {
      this.damage_actor(actor, damage, barrel);
    }
    for (const object of this.get_objects()) {
      if (object.entity_id === barrel.entity_id) {
        continue;
      }
      if (["breakable_urn", "explosive_barrel"].includes(object.object_type) &&
          Math.hypot(object.grid_x - barrel.grid_x, object.grid_y - barrel.grid_y) <= 1.5) {
        object.alive = false;
        object.blocks_movement = false;
      }
    }
    return true;
  }

  handle_actor_enter(actor, x, y) {
    const objects = this.get_objects().filter((object) => object.grid_x === x && object.grid_y === y);
    for (const object of objects) {
      if (object.object_type === "pressure_plate" && !object.triggered) {
        this.trigger_pressure_plate(object, actor);
      } else if (object.object_type === "spike_trap" && object.active && !object.used) {
        object.revealed = true;
        const damage = 7 + Math.floor(this.game.state.floor * 0.55);
        this.game.add_effect("frost", x, y);
        this.game.add_log(`${actor.name} triggers a spike trap`);
        this.damage_actor(actor, damage, object);
      }
    }
  }

  trigger_pressure_plate(plate, actor) {
    plate.triggered = true;
    plate.active = true;
    const linked = this.get_linked_objects(plate);
    let changed = 0;
    for (const object of linked) {
      if (openable_object_types.has(object.object_type) && !object.open) {
        this.open_barrier(object, `${object.name} opens as a pressure plate sinks`);
        changed += 1;
      }
    }
    if (changed === 0) {
      const damage = 5 + Math.floor(this.game.state.floor * 0.4);
      this.game.add_log("the pressure plate releases a concealed mechanism");
      this.damage_actor(actor, damage, plate);
    }
  }

  damage_actor(actor, damage, source) {
    const was_alive = actor.alive;
    this.game.combat_system.apply_damage(actor, damage, source, performance.now());
    if (actor.type === "player") {
      this.game.add_log(`${source.name} deals ${damage} damage`);
      if (was_alive && !actor.alive) {
        this.game.handle_player_defeat();
      }
    }
  }

  link_mechanisms(spawned) {
    const barriers = spawned.filter((object) => openable_object_types.has(object.object_type));
    const mechanisms = spawned.filter((object) => ["lever", "pressure_plate"].includes(object.object_type));
    for (const mechanism of mechanisms) {
      const nearest = [...barriers]
        .filter((barrier) => barrier.linked_from_entity_id === null)
        .sort((a, b) => manhattan_distance(mechanism, a) - manhattan_distance(mechanism, b))[0];
      if (nearest) {
        mechanism.linked_entity_ids.push(nearest.entity_id);
        nearest.linked_from_entity_id = mechanism.entity_id;
      } else if (mechanism.object_type === "lever") {
        const nearby_traps = spawned
          .filter((object) => object.object_type === "spike_trap")
          .sort((a, b) => manhattan_distance(mechanism, a) - manhattan_distance(mechanism, b))
          .slice(0, 2);
        mechanism.linked_entity_ids.push(...nearby_traps.map((object) => object.entity_id));
      }
    }
  }

  get_linked_objects(mechanism) {
    const ids = new Set(mechanism.linked_entity_ids ?? []);
    return this.get_objects().filter((object) => ids.has(object.entity_id));
  }
}

export function create_dungeon_object(definition, grid_x, grid_y, floor) {
  return {
    entity_id: `dungeon_object_${next_object_id++}`,
    type: "dungeon_object",
    object_type: definition.id,
    name: definition.name,
    grid_x,
    grid_y,
    display_x: grid_x,
    display_y: grid_y,
    move_from_x: grid_x,
    move_from_y: grid_y,
    move_started_at: 0,
    moving: false,
    alive: true,
    flash_until: 0,
    blocks_movement: definition.blocks_movement,
    blocks_vision: definition.blocks_vision,
    active: definition.id === "spike_trap",
    triggered: false,
    used: false,
    open: false,
    revealed: definition.id !== "secret_wall" && definition.id !== "spike_trap",
    linked_entity_ids: [],
    linked_from_entity_id: null,
    difficulty_floor: floor
  };
}

export function dungeon_remains_connected_with_objects(dungeon, blockers = []) {
  const blocked = new Set(blockers.map((position) => position_key(position.x, position.y)));
  const start_key = position_key(dungeon.start.x, dungeon.start.y);
  const exit_key = position_key(dungeon.exit.x, dungeon.exit.y);
  if (blocked.has(start_key) || blocked.has(exit_key)) {
    return false;
  }

  let traversable_count = 0;
  for (let y = 0; y < dungeon.grid.height; y += 1) {
    for (let x = 0; x < dungeon.grid.width; x += 1) {
      if (dungeon.grid.is_walkable(x, y) && !blocked.has(position_key(x, y))) {
        traversable_count += 1;
      }
    }
  }

  const queue = [{ ...dungeon.start }];
  const visited = new Set([start_key]);
  while (queue.length > 0) {
    const current = queue.shift();
    for (const direction of cardinal_directions) {
      const x = current.x + direction.x;
      const y = current.y + direction.y;
      const key = position_key(x, y);
      if (visited.has(key) || blocked.has(key) || !dungeon.grid.is_walkable(x, y)) {
        continue;
      }
      visited.add(key);
      queue.push({ x, y });
    }
  }
  return visited.size === traversable_count && visited.has(exit_key);
}

function manhattan_distance(first, second) {
  const first_x = Number.isFinite(first?.grid_x) ? first.grid_x : first.x;
  const first_y = Number.isFinite(first?.grid_y) ? first.grid_y : first.y;
  const second_x = Number.isFinite(second?.grid_x) ? second.grid_x : second.x;
  const second_y = Number.isFinite(second?.grid_y) ? second.grid_y : second.y;
  return Math.abs(first_x - second_x) + Math.abs(first_y - second_y);
}

function position_key(x, y) {
  return `${x},${y}`;
}
