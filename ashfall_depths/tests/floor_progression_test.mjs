import assert from "node:assert/strict";
import { get_floor_progression } from "../src/config/floor_progression.js";
import { generate_dungeon } from "../src/world/dungeon_generator.js";

const floor_one = get_floor_progression(1);
assert.equal(floor_one.map_width, 12);
assert.equal(floor_one.map_height, 12);
assert.equal(floor_one.monster_count, 1);
assert.equal(floor_one.room_count, 2);

let previous = floor_one;
for (let floor = 2; floor <= 500; floor += 1) {
  const current = get_floor_progression(floor);
  assert.ok(current.map_width > previous.map_width, `map width must grow on floor ${floor}`);
  assert.ok(current.map_height > previous.map_height, `map height must grow on floor ${floor}`);
  assert.ok(current.monster_count > previous.monster_count, `monster count must grow on floor ${floor}`);
  assert.ok(current.health_multiplier > previous.health_multiplier, `health scaling must grow on floor ${floor}`);
  assert.ok(current.attack_multiplier > previous.attack_multiplier, `attack scaling must grow on floor ${floor}`);
  previous = current;
}

const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
for (let seed = 1; seed <= 100; seed += 1) {
  const progression = get_floor_progression(1);
  const dungeon = generate_dungeon(progression.map_width, progression.map_height, seed, progression);
  assert.equal(dungeon.grid.get_tile(dungeon.exit.x, dungeon.exit.y).terrain_id, "exit");
  assert.ok(directions.some(([dx, dy]) => {
    const terrain = dungeon.grid.get_tile(dungeon.exit.x + dx, dungeon.exit.y + dy)?.terrain_id;
    return terrain === "stone_floor" || terrain === "cracked_floor";
  }), `door must touch a floor tile for seed ${seed}`);
  assert.ok(dungeon.grid.is_walkable(dungeon.exit.x, dungeon.exit.y));
  assert.ok(dungeon.grid.get_floor_positions().length > 1);
}

console.log("floor progression tests passed");
