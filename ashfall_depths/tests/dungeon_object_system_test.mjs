import assert from "node:assert/strict";
import { dungeon_object_definitions, dungeon_object_list } from "../src/data/dungeon_objects.js";
import {
  DungeonObjectSystem,
  create_dungeon_object,
  dungeon_remains_connected_with_objects
} from "../src/systems/dungeon_object_system.js";
import { DungeonGrid } from "../src/world/dungeon_grid.js";
import { SeededRandom } from "../src/utils/random.js";

assert.deepEqual(
  new Set(dungeon_object_list.map((definition) => definition.id)),
  new Set([
    "pressure_plate",
    "spike_trap",
    "explosive_barrel",
    "breakable_urn",
    "healing_fountain",
    "lever",
    "locked_door",
    "secret_wall"
  ])
);

const dungeon = create_open_dungeon();
const logs = [];
const inventory = [];
const player = create_actor("player", "hero", 3, 4, 50, 20);
const game = {
  state: {
    floor: 12,
    gold: 0,
    inventory: { add_item: (item_id) => inventory.push(item_id) }
  },
  dungeon,
  player,
  entities: [player],
  add_log: (message) => logs.push(message),
  add_effect: () => {},
  spawn_combat_text: () => {},
  handle_player_defeat: () => {},
  combat_system: {
    apply_damage(target, amount) {
      target.health = Math.max(0, target.health - amount);
      if (target.health <= 0) {
        target.alive = false;
      }
    }
  },
  is_tile_blocked(x, y, ignored_entity_id = "") {
    return this.entities.some((entity) =>
      entity.alive && entity.entity_id !== ignored_entity_id && entity.blocks_movement !== false &&
      entity.type !== "ground_item" && entity.grid_x === x && entity.grid_y === y
    );
  }
};
const system = new DungeonObjectSystem(game);
game.dungeon_object_system = system;
const spawned = system.spawn_floor_objects();
assert.ok(spawned.length >= 4, "deep floors should receive several dungeon objects");
assert.ok(spawned.every((object) => dungeon.grid.is_walkable(object.grid_x, object.grid_y)));
assert.ok(spawned.every((object) => !(object.grid_x === dungeon.start.x && object.grid_y === dungeon.start.y)));
assert.ok(spawned.every((object) => !(object.grid_x === dungeon.exit.x && object.grid_y === dungeon.exit.y)));
assert.ok(dungeon_remains_connected_with_objects(dungeon, system.get_static_blockers()));

const secret = create_dungeon_object(dungeon_object_definitions.secret_wall, 5, 4, 12);
game.entities.push(secret);
assert.equal(system.reveal_secret_wall(secret), true);
assert.equal(secret.revealed, true);
assert.equal(system.interact(secret), true);
assert.equal(secret.open, true);
assert.equal(secret.blocks_movement, false);

const door = create_dungeon_object(dungeon_object_definitions.locked_door, 6, 4, 12);
game.entities.push(door);
assert.equal(system.interact(door), true);
assert.equal(door.open, true);

player.health = 20;
player.magic = 4;
const fountain = create_dungeon_object(dungeon_object_definitions.healing_fountain, 4, 4, 12);
game.entities.push(fountain);
assert.equal(system.interact(fountain), true);
assert.ok(player.health > 20);
assert.ok(player.magic > 4);
assert.equal(fountain.used, true);

const urn = create_dungeon_object(dungeon_object_definitions.breakable_urn, 4, 5, 12);
game.entities.push(urn);
const gold_before = game.state.gold;
assert.equal(system.interact(urn), true);
assert.equal(urn.alive, false);
assert.ok(game.state.gold > gold_before);

const trap_target = create_actor("monster", "test monster", 7, 4, 30, 0);
const spike = create_dungeon_object(dungeon_object_definitions.spike_trap, 7, 4, 12);
game.entities.push(trap_target, spike);
const health_before_trap = trap_target.health;
system.handle_actor_enter(trap_target, 7, 4);
assert.ok(trap_target.health < health_before_trap);
assert.equal(spike.revealed, true);

const barrel = create_dungeon_object(dungeon_object_definitions.explosive_barrel, 8, 4, 12);
const blast_target = create_actor("monster", "blast target", 8, 5, 40, 0);
game.entities.push(barrel, blast_target);
const health_before_blast = blast_target.health;
assert.equal(system.interact(barrel), true);
assert.equal(barrel.alive, false);
assert.ok(blast_target.health < health_before_blast);

const choke_dungeon = create_chokepoint_dungeon();
assert.equal(dungeon_remains_connected_with_objects(choke_dungeon, [{ x: 4, y: 3 }]), false);
assert.equal(dungeon_remains_connected_with_objects(choke_dungeon, [{ x: 2, y: 2 }]), true);
assert.ok(logs.some((message) => message.includes("secret passage")));
assert.ok(logs.some((message) => message.includes("fountain restores")));

console.log("dungeon traps, interactions, and solvability tests passed");

function create_actor(type, name, grid_x, grid_y, health, magic) {
  return {
    entity_id: `${type}_${name.replaceAll(" ", "_")}`,
    type,
    name,
    grid_x,
    grid_y,
    display_x: grid_x,
    display_y: grid_y,
    health,
    maximum_health: health,
    magic,
    maximum_magic: Math.max(magic, 20),
    alive: true,
    moving: false,
    blocks_movement: true
  };
}

function create_open_dungeon() {
  const width = 18;
  const height = 11;
  const tiles = Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => ({
      terrain_id: x === 0 || y === 0 || x === width - 1 || y === height - 1 ? "wall" : "stone_floor",
      ground_item_ids: [],
      explored: true,
      visible: true,
      room_index: x <= 8 ? 0 : 1,
      room_type_id: x <= 8 ? "entry_hall" : "guard_room"
    }))
  );
  tiles[5][width - 1].terrain_id = "exit";
  tiles[5][width - 1].room_index = null;
  return {
    grid: new DungeonGrid(width, height, tiles),
    rooms: [
      { center_x: 3, center_y: 5 },
      { center_x: 13, center_y: 5 }
    ],
    start: { x: 3, y: 5 },
    exit: { x: width - 1, y: 5 },
    random: new SeededRandom(987654)
  };
}

function create_chokepoint_dungeon() {
  const width = 9;
  const height = 7;
  const tiles = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ terrain_id: "wall", ground_item_ids: [], explored: true }))
  );
  for (let y = 1; y <= 5; y += 1) {
    for (let x = 1; x <= 3; x += 1) {
      tiles[y][x].terrain_id = "stone_floor";
    }
    for (let x = 5; x <= 7; x += 1) {
      tiles[y][x].terrain_id = "stone_floor";
    }
  }
  tiles[3][4].terrain_id = "stone_floor";
  tiles[3][8].terrain_id = "exit";
  return {
    grid: new DungeonGrid(width, height, tiles),
    start: { x: 2, y: 3 },
    exit: { x: 8, y: 3 }
  };
}
