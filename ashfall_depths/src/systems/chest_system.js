import { item_database } from "../data/items.js";
import { get_player_upgrade_rank } from "../data/player_upgrades.js";
import { find_next_step } from "../world/pathfinding.js";

const cardinal_directions = Object.freeze([
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: -1, y: 0 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: 0, y: -1 })
]);

const reward_item_pool = Object.freeze([
  "healing_potion",
  "healing_potion",
  "mana_potion",
  "mana_potion",
  "iron_sabre",
  "ashwood_staff",
  "warding_charm"
]);

let next_chest_id = 1;

export class ChestSystem {
  constructor(game) {
    this.game = game;
  }

  spawn_random_chests() {
    const floor = Math.max(1, Math.floor(Number(this.game.state.floor) || 1));
    const attempts = Math.min(4, 1 + Math.floor((floor - 1) / 8));
    const appearance_chance = Math.min(0.9, 0.5 + floor * 0.02);
    const spawned = [];

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (!this.game.dungeon.random.chance(appearance_chance)) {
        continue;
      }
      const position = this.find_spawn_position();
      if (!position) {
        continue;
      }
      const chest = create_treasure_chest(this.game.dungeon.random, floor, position.x, position.y);
      this.apply_reward_upgrades(chest);
      this.game.entities.push(chest);
      spawned.push(chest);
    }

    if (spawned.length > 0) {
      this.game.add_log(`${spawned.length} unopened ${spawned.length === 1 ? "chest waits" : "chests wait"} somewhere on this floor`);
    }
    return spawned;
  }

  apply_reward_upgrades(chest) {
    const rank = get_player_upgrade_rank(this.game.state, "chest_rewards");
    if (rank <= 0) {
      return chest;
    }

    chest.reward_gold = Math.max(1, Math.round(chest.reward_gold * (1 + rank * 0.2)));
    const guaranteed_extra_items = Math.floor(rank / 4);
    for (let index = 0; index < guaranteed_extra_items; index += 1) {
      chest.reward_item_ids.push(this.game.dungeon.random.pick(reward_item_pool));
    }
    if (this.game.dungeon.random.chance(Math.min(0.65, rank * 0.1))) {
      chest.reward_item_ids.push(this.game.dungeon.random.pick(reward_item_pool));
    }
    return chest;
  }

  find_spawn_position() {
    const dungeon = this.game.dungeon;
    const protected_keys = new Set([
      position_key(dungeon.start.x, dungeon.start.y),
      position_key(dungeon.exit.x, dungeon.exit.y),
      ...(dungeon.rooms ?? []).map((room) => position_key(room.center_x, room.center_y)),
      ...this.game.entities.filter((entity) => entity.alive).map((entity) => position_key(entity.grid_x, entity.grid_y))
    ]);
    const candidates = [];

    for (let y = 1; y < dungeon.grid.height - 1; y += 1) {
      for (let x = 1; x < dungeon.grid.width - 1; x += 1) {
        const tile = dungeon.grid.get_tile(x, y);
        if (!tile || tile.room_index === null || !dungeon.grid.is_walkable(x, y)) {
          continue;
        }
        if (protected_keys.has(position_key(x, y)) || manhattan_distance({ x, y }, dungeon.exit) <= 2) {
          continue;
        }
        const open_neighbors = cardinal_directions.filter((direction) =>
          dungeon.grid.is_walkable(x + direction.x, y + direction.y)
        ).length;
        if (open_neighbors < 3) {
          continue;
        }
        candidates.push({ x, y });
      }
    }

    while (candidates.length > 0) {
      const index = this.game.dungeon.random.integer(0, candidates.length - 1);
      const [candidate] = candidates.splice(index, 1);
      if (dungeon_remains_connected_with_chests(dungeon, [candidate], this.get_ground_chests())) {
        return candidate;
      }
    }
    return null;
  }

  get_ground_chests() {
    return this.game.entities.filter((entity) =>
      entity.alive && entity.type === "chest" && !entity.carried_by_entity_id
    );
  }

  get_adjacent_chest(actor) {
    return this.get_ground_chests()
      .filter((chest) => manhattan_distance(actor, chest) <= 1)
      .sort((a, b) => manhattan_distance(actor, a) - manhattan_distance(actor, b))[0] ?? null;
  }

  find_nearby_chest(monster, maximum_distance = 7) {
    return this.get_ground_chests()
      .filter((chest) => manhattan_distance(monster, chest) <= maximum_distance)
      .sort((a, b) => manhattan_distance(monster, a) - manhattan_distance(monster, b))[0] ?? null;
  }

  find_step_toward_chest(monster, chest) {
    const destinations = cardinal_directions
      .map((direction) => ({ x: chest.grid_x + direction.x, y: chest.grid_y + direction.y }))
      .filter((position) =>
        this.game.dungeon.grid.is_walkable(position.x, position.y) &&
        !this.game.is_tile_blocked(position.x, position.y, monster.entity_id)
      )
      .sort((a, b) => manhattan_distance(monster, a) - manhattan_distance(monster, b));

    for (const destination of destinations) {
      const step = find_next_step(
        this.game.dungeon.grid,
        { x: monster.grid_x, y: monster.grid_y },
        destination,
        (x, y) => this.game.is_tile_blocked(x, y, monster.entity_id)
      );
      if (step) {
        return step;
      }
    }
    return null;
  }

  pick_up_chest(monster, chest) {
    if (!monster?.alive || monster.carried_chest_id || !chest?.alive || chest.carried_by_entity_id) {
      return false;
    }
    if (manhattan_distance(monster, chest) > 1) {
      return false;
    }

    monster.carried_chest_id = chest.entity_id;
    chest.carried_by_entity_id = monster.entity_id;
    chest.alive = false;
    this.game.add_log(`${monster.name} picks up a treasure chest`);
    return true;
  }

  drop_carried_chest(monster) {
    if (!monster?.carried_chest_id) {
      return null;
    }
    const chest = this.game.entities.find((entity) =>
      entity.type === "chest" && entity.entity_id === monster.carried_chest_id
    );
    monster.carried_chest_id = null;
    if (!chest) {
      return null;
    }

    chest.carried_by_entity_id = null;
    chest.grid_x = monster.grid_x;
    chest.grid_y = monster.grid_y;
    chest.display_x = monster.grid_x;
    chest.display_y = monster.grid_y;
    chest.alive = true;
    this.game.add_log(`${monster.name} drops the treasure chest`);
    return chest;
  }

  open_chest(chest) {
    if (!chest?.alive || chest.type !== "chest" || chest.carried_by_entity_id) {
      return false;
    }

    chest.alive = false;
    this.game.state.gold += chest.reward_gold;
    for (const item_id of chest.reward_item_ids) {
      this.game.state.inventory.add_item(item_id);
    }
    const item_names = chest.reward_item_ids.map((item_id) => item_database[item_id].name).join(", ");
    this.game.add_effect("chest", chest.grid_x, chest.grid_y);
    this.game.add_log(`opened treasure chest · ${chest.reward_gold} gold · ${item_names}`);
    return true;
  }
}

export function create_treasure_chest(random, floor_number, grid_x, grid_y) {
  const floor = Math.max(1, Math.floor(Number(floor_number) || 1));
  const item_count = 1 + (floor >= 6 && random.chance(Math.min(0.55, 0.1 + floor * 0.02)) ? 1 : 0);
  const reward_item_ids = [];
  for (let index = 0; index < item_count; index += 1) {
    reward_item_ids.push(random.pick(reward_item_pool));
  }

  return {
    entity_id: `chest_${next_chest_id++}`,
    type: "chest",
    name: "treasure chest",
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
    carried_by_entity_id: null,
    reward_gold: random.integer(10 + floor * 2, 22 + floor * 4),
    reward_item_ids
  };
}

export function dungeon_remains_connected_with_chests(dungeon, additional_blockers = [], existing_chests = []) {
  const blocked = new Set([
    ...existing_chests.filter((chest) => chest.alive && !chest.carried_by_entity_id).map((chest) => position_key(chest.grid_x, chest.grid_y)),
    ...additional_blockers.map((position) => position_key(position.x, position.y))
  ]);
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

  const queue = [{ x: dungeon.start.x, y: dungeon.start.y }];
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
