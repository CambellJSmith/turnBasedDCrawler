import assert from "node:assert/strict";
import { terrain_database } from "../src/data/terrain.js";
import { room_type_database, room_type_list } from "../src/data/room_types.js";
import { get_floor_progression } from "../src/config/floor_progression.js";
import { generate_dungeon } from "../src/world/dungeon_generator.js";

assert.ok(room_type_list.length >= 30, "the dungeon should contain a large room catalogue");
assert.equal(new Set(room_type_list.map((room) => room.id)).size, room_type_list.length);
for (const room_type of room_type_list) {
  assert.ok(room_type.name && room_type.description);
  assert.ok(terrain_database[room_type.primary_terrain_id]?.walkable);
  assert.ok(terrain_database[room_type.secondary_terrain_id]?.walkable);
}

const seen_types = new Set();
for (const floor of [1, 4, 8, 12, 20, 40]) {
  for (let seed = 1; seed <= 30; seed += 1) {
    const progression = get_floor_progression(floor);
    const dungeon = generate_dungeon(progression.map_width, progression.map_height, seed * 997 + floor, progression);
    assert.ok(dungeon.rooms.length >= 1);
    assert.equal(dungeon.rooms[0].type_id, "entry_hall");

    for (const room of dungeon.rooms) {
      seen_types.add(room.type_id);
      assert.ok(room_type_database[room.type_id], `unknown room type ${room.type_id}`);
      assert.ok(dungeon.grid.is_walkable(room.center_x, room.center_y), `${room.type_id} center must be walkable`);
      const center_tile = dungeon.grid.get_tile(room.center_x, room.center_y);
      assert.equal(center_tile.room_type_id, room.type_id);
    }

    const reachable = flood_fill(dungeon.grid, dungeon.start);
    const floor_positions = dungeon.grid.get_floor_positions();
    assert.equal(reachable.size, floor_positions.length, `all floor tiles must connect on floor ${floor}, seed ${seed}`);
    assert.ok(dungeon.grid.is_walkable(dungeon.exit.x, dungeon.exit.y));
  }
}

assert.ok(seen_types.size >= 28, `expected broad room variety, saw ${seen_types.size}`);
console.log(`room type tests passed with ${seen_types.size} distinct archetypes`);

function flood_fill(grid, start) {
  const queue = [start];
  const visited = new Set([`${start.x},${start.y}`]);
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length > 0) {
    const current = queue.shift();
    for (const [dx, dy] of directions) {
      const x = current.x + dx;
      const y = current.y + dy;
      const key = `${x},${y}`;
      if (visited.has(key) || !grid.is_walkable(x, y)) {
        continue;
      }
      visited.add(key);
      queue.push({ x, y });
    }
  }
  return visited;
}
