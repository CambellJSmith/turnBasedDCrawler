import assert from "node:assert/strict";
import { calculate_monster_threat, get_floor_progression } from "../src/config/floor_progression.js";
import { monster_database } from "../src/data/monsters.js";
import { generate_dungeon } from "../src/world/dungeon_generator.js";

const floor_one = get_floor_progression(1);
assert.equal(floor_one.map_width, 12);
assert.equal(floor_one.map_height, 12);
assert.equal(floor_one.monster_count, 1);
assert.equal(floor_one.room_count, 2);
assert.equal(get_floor_progression(3).monster_count, 1, "floors 1 through 3 should contain one enemy");
assert.equal(get_floor_progression(4).monster_count, 2, "floor 4 should introduce the second enemy");
assert.equal(get_floor_progression(7).monster_count, 3, "enemy count should rise once every three floors");

const floor_two = get_floor_progression(2);
const floor_three = get_floor_progression(3);
assert.ok(calculate_monster_threat(monster_database.ember_slime) <= floor_two.monster_threat_limit);
assert.ok(calculate_monster_threat(monster_database.crypt_rat) > floor_two.monster_threat_limit);
assert.ok(calculate_monster_threat(monster_database.crypt_rat) <= floor_three.monster_threat_limit);
assert.ok(calculate_monster_threat(monster_database.ash_witch) > floor_three.monster_threat_limit);

let previous = floor_one;
for (let floor = 2; floor <= 500; floor += 1) {
  const current = get_floor_progression(floor);
  assert.ok(current.map_width >= previous.map_width, `map width must not shrink on floor ${floor}`);
  assert.ok(current.map_height >= previous.map_height, `map height must not shrink on floor ${floor}`);
  assert.ok(current.monster_count >= previous.monster_count, `monster count must not shrink on floor ${floor}`);
  assert.ok(current.health_multiplier > previous.health_multiplier, `health scaling must grow on floor ${floor}`);
  assert.ok(current.attack_multiplier > previous.attack_multiplier, `attack scaling must grow on floor ${floor}`);
  previous = current;
}

const floor_five_hundred = get_floor_progression(500);
assert.ok(floor_five_hundred.map_width > floor_one.map_width);
assert.ok(floor_five_hundred.monster_count > floor_one.monster_count);
assert.ok(floor_five_hundred.attack_multiplier > floor_one.attack_multiplier);

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
