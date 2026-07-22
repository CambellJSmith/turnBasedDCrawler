import assert from "node:assert/strict";
import { ExplorationSystem } from "../src/systems/exploration_system.js";
import { DungeonGrid } from "../src/world/dungeon_grid.js";

const dungeon = create_dungeon();
const player = {
  entity_id: "player_test",
  type: "player",
  alive: true,
  grid_x: 2,
  grid_y: 3
};
const chest = {
  entity_id: "chest_test",
  type: "chest",
  alive: true,
  carried_by_entity_id: null,
  grid_x: 10,
  grid_y: 3
};
const secret_wall = {
  entity_id: "secret_test",
  type: "dungeon_object",
  object_type: "secret_wall",
  alive: true,
  revealed: false,
  blocks_vision: true,
  grid_x: 6,
  grid_y: 3
};
const game = { dungeon, player, entities: [player, chest, secret_wall] };
const exploration = new ExplorationSystem(game, 4);
game.exploration_system = exploration;
exploration.initialize_floor();

assert.equal(dungeon.grid.get_tile(2, 3).visible, true);
assert.equal(dungeon.grid.get_tile(3, 2).explored, true, "the current room should reveal as a chamber");
assert.equal(dungeon.grid.get_tile(10, 3).explored, false, "distant rooms must remain hidden");
assert.equal(dungeon.grid.get_tile(dungeon.exit.x, dungeon.exit.y).explored, false, "the exit remains hidden until discovered");
assert.equal(exploration.known_chest_positions.size, 0);

player.grid_x = 9;
player.grid_y = 3;
secret_wall.blocks_vision = false;
exploration.update_visibility();
assert.equal(dungeon.grid.get_tile(10, 3).visible, true);
assert.equal(exploration.known_chest_positions.size, 1, "a seen chest should be remembered");
assert.equal(dungeon.grid.get_tile(dungeon.exit.x, dungeon.exit.y).explored, true);

chest.alive = false;
chest.carried_by_entity_id = "monster_hidden";
player.grid_x = 2;
player.grid_y = 3;
exploration.update_visibility();
assert.equal(exploration.known_chest_positions.size, 1, "a hidden theft must leave the last-known marker unchanged");

player.grid_x = 9;
player.grid_y = 3;
exploration.update_visibility();
assert.equal(exploration.known_chest_positions.size, 0, "revisiting an empty location should clear the stale marker");

secret_wall.blocks_vision = true;
secret_wall.grid_x = 6;
secret_wall.grid_y = 3;
player.grid_x = 4;
player.grid_y = 3;
assert.equal(exploration.has_line_of_sight(4, 3, 8, 3), false, "closed secret walls should block vision");
secret_wall.blocks_vision = false;
assert.equal(exploration.has_line_of_sight(4, 3, 8, 3), true, "opened secret walls should restore vision");

console.log("fog of war, discovery, and last-known landmark tests passed");

function create_dungeon() {
  const width = 13;
  const height = 7;
  const tiles = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({
      terrain_id: "wall",
      ground_item_ids: [],
      explored: true,
      visible: false,
      room_index: null,
      room_type_id: null
    }))
  );

  for (let y = 1; y <= 5; y += 1) {
    for (let x = 1; x <= 4; x += 1) {
      tiles[y][x].terrain_id = "stone_floor";
      tiles[y][x].room_index = 0;
      tiles[y][x].room_type_id = "entry_hall";
    }
    for (let x = 8; x <= 11; x += 1) {
      tiles[y][x].terrain_id = "stone_floor";
      tiles[y][x].room_index = 1;
      tiles[y][x].room_type_id = "guard_room";
    }
  }
  for (let x = 5; x <= 7; x += 1) {
    tiles[3][x].terrain_id = "stone_floor";
  }
  tiles[3][12].terrain_id = "exit";

  return {
    grid: new DungeonGrid(width, height, tiles),
    rooms: [
      { center_x: 2, center_y: 3 },
      { center_x: 9, center_y: 3 }
    ],
    start: { x: 2, y: 3 },
    exit: { x: 12, y: 3 }
  };
}
