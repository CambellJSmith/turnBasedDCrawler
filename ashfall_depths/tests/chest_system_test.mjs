import assert from "node:assert/strict";
import { item_database } from "../src/data/items.js";
import { DungeonGrid } from "../src/world/dungeon_grid.js";
import {
  ChestSystem,
  create_treasure_chest,
  dungeon_remains_connected_with_chests
} from "../src/systems/chest_system.js";

class ForcedRandom {
  constructor() {
    this.index = 0;
  }

  chance() {
    return true;
  }

  integer(minimum, maximum) {
    const span = maximum - minimum + 1;
    return minimum + (this.index++ % span);
  }

  pick(values) {
    return values[this.index++ % values.length];
  }
}

const open_dungeon = create_open_dungeon();
const inventory_items = [];
const logs = [];
const game = {
  state: {
    floor: 12,
    gold: 0,
    inventory: { add_item: (item_id) => inventory_items.push(item_id) }
  },
  dungeon: open_dungeon,
  entities: [],
  add_log: (message) => logs.push(message),
  add_effect: () => {},
  is_tile_blocked(x, y, ignored_entity_id = "") {
    return this.entities.some((entity) =>
      entity.alive &&
      entity.entity_id !== ignored_entity_id &&
      entity.type !== "ground_item" &&
      entity.grid_x === x &&
      entity.grid_y === y
    );
  }
};

const system = new ChestSystem(game);
game.chest_system = system;
const spawned = system.spawn_random_chests();
assert.ok(spawned.length >= 1, "forced appearance rolls should spawn at least one chest");
assert.ok(spawned.every((chest) => chest.type === "chest" && chest.alive));
assert.ok(dungeon_remains_connected_with_chests(open_dungeon, [], spawned));
assert.ok(spawned.every((chest) =>
  !(chest.grid_x === open_dungeon.start.x && chest.grid_y === open_dungeon.start.y) &&
  !(chest.grid_x === open_dungeon.exit.x && chest.grid_y === open_dungeon.exit.y)
));

const lifecycle_chest = create_treasure_chest(open_dungeon.random, 12, 8, 4);
game.entities = [lifecycle_chest];
const monster = {
  entity_id: "monster_test",
  type: "monster",
  name: "crypt thief",
  alive: true,
  grid_x: 7,
  grid_y: 4
};
game.entities.push(monster);

const original_rewards = {
  gold: lifecycle_chest.reward_gold,
  items: [...lifecycle_chest.reward_item_ids]
};
assert.equal(system.pick_up_chest(monster, lifecycle_chest), true);
assert.equal(monster.carried_chest_id, lifecycle_chest.entity_id);
assert.equal(lifecycle_chest.carried_by_entity_id, monster.entity_id);
assert.equal(system.get_ground_chests().includes(lifecycle_chest), false);
assert.equal(system.pick_up_chest(monster, lifecycle_chest), false, "a monster cannot pick up a second time");

monster.grid_x = 9;
monster.grid_y = 5;
const dropped = system.drop_carried_chest(monster);
assert.equal(dropped, lifecycle_chest, "the same unopened chest should be dropped");
assert.equal(lifecycle_chest.carried_by_entity_id, null);
assert.deepEqual([lifecycle_chest.grid_x, lifecycle_chest.grid_y], [9, 5]);
assert.equal(lifecycle_chest.reward_gold, original_rewards.gold);
assert.deepEqual(lifecycle_chest.reward_item_ids, original_rewards.items);

const gold_before = game.state.gold;
const inventory_before = inventory_items.length;
assert.equal(system.open_chest(lifecycle_chest), true);
assert.equal(lifecycle_chest.alive, false);
assert.equal(game.state.gold, gold_before + original_rewards.gold);
assert.equal(inventory_items.length, inventory_before + original_rewards.items.length);
assert.ok(original_rewards.items.every((item_id) => item_database[item_id]));
assert.equal(system.open_chest(lifecycle_chest), false, "an opened chest cannot be looted twice");
assert.ok(logs.some((message) => message.includes("picks up a treasure chest")));
assert.ok(logs.some((message) => message.includes("drops the treasure chest")));
assert.ok(logs.some((message) => message.includes("opened treasure chest")));

const choke_dungeon = create_chokepoint_dungeon();
assert.equal(
  dungeon_remains_connected_with_chests(choke_dungeon, [{ x: 4, y: 3 }], []),
  false,
  "a chest must not be placed on the only route between rooms"
);
assert.equal(
  dungeon_remains_connected_with_chests(choke_dungeon, [{ x: 2, y: 2 }], []),
  true,
  "a chest may occupy a non-critical room tile"
);

console.log("chest spawning, theft, drop, reward, and solvability tests passed");

function create_open_dungeon() {
  const width = 14;
  const height = 10;
  const tiles = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      terrain_id: x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "wall" : "stone_floor",
      ground_item_ids: [],
      explored: true,
      room_index: x < 7 ? 0 : 1,
      room_type_id: x < 7 ? "entry_hall" : "guard_room"
    }))
  );
  tiles[5][width - 1].terrain_id = "exit";
  tiles[5][width - 1].room_index = null;
  tiles[5][width - 1].room_type_id = null;

  return {
    grid: new DungeonGrid(width, height, tiles),
    rooms: [
      { center_x: 3, center_y: 5, type_id: "entry_hall" },
      { center_x: 10, center_y: 5, type_id: "guard_room" }
    ],
    start: { x: 3, y: 5 },
    exit: { x: width - 1, y: 5 },
    random: new ForcedRandom()
  };
}

function create_chokepoint_dungeon() {
  const width = 9;
  const height = 7;
  const tiles = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({
      terrain_id: "wall",
      ground_item_ids: [],
      explored: true,
      room_index: null,
      room_type_id: null
    }))
  );

  for (let y = 1; y <= 5; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      tiles[y][x].terrain_id = "stone_floor";
      tiles[y][x].room_index = 0;
    }
    for (let x = 5; x <= 7; x += 1) {
      tiles[y][x].terrain_id = "stone_floor";
      tiles[y][x].room_index = 1;
    }
  }
  tiles[3][4].terrain_id = "stone_floor";
  tiles[3][8].terrain_id = "exit";

  return {
    grid: new DungeonGrid(width, height, tiles),
    rooms: [
      { center_x: 2, center_y: 3, type_id: "entry_hall" },
      { center_x: 6, center_y: 3, type_id: "guard_room" }
    ],
    start: { x: 2, y: 3 },
    exit: { x: 8, y: 3 },
    random: new ForcedRandom()
  };
}
