import assert from "node:assert/strict";
import { get_floor_progression } from "../src/config/floor_progression.js";
import { terrain_database } from "../src/data/terrain.js";
import { DungeonGrid } from "../src/world/dungeon_grid.js";
import { generate_dungeon } from "../src/world/dungeon_generator.js";
import { apply_lava_patches, is_dungeon_fully_connected } from "../src/world/lava_generation.js";
import { SeededRandom } from "../src/utils/random.js";

assert.equal(terrain_database.lava_floor.walkable, false, "lava must be impassable");
assert.equal(get_floor_progression(1).lava_patch_count, 0, "floor one should remain free of lava");
assert.equal(get_floor_progression(2).lava_patch_count, 1, "lava should begin on floor two");
assert.ok(get_floor_progression(30).lava_patch_count > get_floor_progression(2).lava_patch_count);
assert.ok(get_floor_progression(30).lava_patch_maximum_size > get_floor_progression(2).lava_patch_maximum_size);

const open_dungeon = create_open_test_dungeon();
const protected_position = { x: 8, y: 3 };
const open_patches = apply_lava_patches(
  open_dungeon,
  { lava_patch_count: 3, lava_patch_minimum_size: 2, lava_patch_maximum_size: 5 },
  [protected_position]
);
assert.ok(open_patches.length >= 2, "an open dungeon should receive multiple lava patches");
assert.ok(open_patches.every((patch) => patch.length >= 2), "lava must form patches rather than isolated tiles");
assert.ok(open_patches.every((patch) => patch_is_connected(patch)), "every recorded lava patch must be contiguous");
assert.equal(open_dungeon.grid.get_tile(protected_position.x, protected_position.y).terrain_id, "stone_floor");
assert.equal(open_dungeon.grid.get_tile(open_dungeon.start.x, open_dungeon.start.y).terrain_id, "stone_floor");
assert.equal(open_dungeon.grid.get_tile(open_dungeon.exit.x, open_dungeon.exit.y).terrain_id, "exit");
assert.ok(is_dungeon_fully_connected(open_dungeon));

let generated_lava_maps = 0;
let generated_map_count = 0;
for (const floor of [2, 4, 8, 16, 32]) {
  for (let seed = 1; seed <= 30; seed += 1) {
    const progression = get_floor_progression(floor);
    const dungeon = generate_dungeon(
      progression.map_width,
      progression.map_height,
      seed * 1543 + floor,
      progression
    );
    const patches = apply_lava_patches(dungeon, progression);
    generated_map_count += 1;
    if (patches.length > 0) {
      generated_lava_maps += 1;
    }

    assert.ok(is_dungeon_fully_connected(dungeon), `lava disconnected floor ${floor}, seed ${seed}`);
    assert.ok(dungeon.grid.is_walkable(dungeon.start.x, dungeon.start.y));
    assert.ok(dungeon.grid.is_walkable(dungeon.exit.x, dungeon.exit.y));
    for (const room of dungeon.rooms) {
      assert.ok(dungeon.grid.is_walkable(room.center_x, room.center_y), `${room.type_id} center was blocked by lava`);
    }
    for (const patch of patches) {
      assert.ok(patch.length >= progression.lava_patch_minimum_size);
      assert.ok(patch_is_connected(patch));
      for (const position of patch) {
        assert.equal(dungeon.grid.get_tile(position.x, position.y).terrain_id, "lava_floor");
        assert.equal(dungeon.grid.is_walkable(position.x, position.y), false);
      }
    }
  }
}

assert.ok(
  generated_lava_maps >= Math.floor(generated_map_count * 0.7),
  `expected lava on most generated maps, saw ${generated_lava_maps} of ${generated_map_count}`
);

console.log(`lava generation tests passed on ${generated_map_count} generated dungeons`);

function create_open_test_dungeon() {
  const width = 16;
  const height = 11;
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
      { center_x: 11, center_y: 5, type_id: "guard_room" }
    ],
    start: { x: 3, y: 5 },
    exit: { x: width - 1, y: 5 },
    random: new SeededRandom(24681357)
  };
}

function patch_is_connected(patch) {
  if (patch.length === 0) {
    return false;
  }
  const patch_keys = new Set(patch.map((position) => `${position.x},${position.y}`));
  const queue = [patch[0]];
  const visited = new Set([`${patch[0].x},${patch[0].y}`]);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const [dx, dy] of directions) {
      const next = { x: current.x + dx, y: current.y + dy };
      const key = `${next.x},${next.y}`;
      if (!patch_keys.has(key) || visited.has(key)) {
        continue;
      }
      visited.add(key);
      queue.push(next);
    }
  }

  return visited.size === patch.length;
}
