import { DungeonGrid } from "./dungeon_grid.js";
import { SeededRandom } from "../utils/random.js";

const cardinal_directions = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];

export function generate_dungeon(width, height, seed, options = {}) {
  const random = new SeededRandom(seed);
  const tiles = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ terrain_id: "wall", ground_item_ids: [], explored: true }))
  );

  const target_room_count = Math.max(2, Math.floor(options.room_count ?? 8));
  const minimum_room_size = Math.max(3, Math.floor(options.minimum_room_size ?? 4));
  const requested_maximum = Math.max(minimum_room_size, Math.floor(options.maximum_room_size ?? 7));
  const maximum_room_size = Math.min(requested_maximum, Math.max(minimum_room_size, Math.min(width, height) - 4));
  const rooms = [];
  const placement_attempts = Math.max(target_room_count * 30, 60);

  for (let attempt = 0; attempt < placement_attempts && rooms.length < target_room_count; attempt += 1) {
    const room_width = random.integer(minimum_room_size, maximum_room_size);
    const room_height = random.integer(minimum_room_size, maximum_room_size);
    const maximum_x = width - room_width - 2;
    const maximum_y = height - room_height - 2;
    if (maximum_x < 1 || maximum_y < 1) {
      break;
    }

    const x = random.integer(1, maximum_x);
    const y = random.integer(1, maximum_y);
    const room = {
      x,
      y,
      width: room_width,
      height: room_height,
      center_x: x + Math.floor(room_width / 2),
      center_y: y + Math.floor(room_height / 2)
    };

    if (rooms.some((existing) => rooms_overlap(existing, room, 1))) {
      continue;
    }

    carve_room(tiles, room, random);
    if (rooms.length > 0) {
      carve_corridor(tiles, rooms.at(-1), room, random);
    }
    rooms.push(room);
  }

  if (rooms.length === 0) {
    const fallback = {
      x: 2,
      y: 2,
      width: Math.max(3, width - 4),
      height: Math.max(3, height - 4),
      center_x: Math.floor(width / 2),
      center_y: Math.floor(height / 2)
    };
    carve_room(tiles, fallback, random);
    rooms.push(fallback);
  }

  const extra_connection_count = Math.max(0, Math.floor(options.extra_connection_count ?? 0));
  for (let index = 0; index < extra_connection_count && rooms.length > 2; index += 1) {
    const first_room = random.pick(rooms);
    const second_room = random.pick(rooms.filter((room) => room !== first_room));
    carve_corridor(tiles, first_room, second_room, random);
  }

  const start = { x: rooms[0].center_x, y: rooms[0].center_y };
  const exit = place_wall_door(tiles, start, random);

  return {
    grid: new DungeonGrid(width, height, tiles),
    rooms,
    start,
    exit,
    seed,
    random
  };
}

function rooms_overlap(first, second, padding) {
  return first.x - padding < second.x + second.width &&
    first.x + first.width + padding > second.x &&
    first.y - padding < second.y + second.height &&
    first.y + first.height + padding > second.y;
}

function place_wall_door(tiles, start, random) {
  const candidates = [];
  for (let y = 1; y < tiles.length - 1; y += 1) {
    for (let x = 1; x < tiles[y].length - 1; x += 1) {
      if (tiles[y][x].terrain_id !== "wall") {
        continue;
      }
      const next_to_floor = cardinal_directions.some((direction) => {
        const terrain_id = tiles[y + direction.y][x + direction.x].terrain_id;
        return terrain_id === "stone_floor" || terrain_id === "cracked_floor";
      });
      if (next_to_floor) {
        candidates.push({ x, y, distance: Math.hypot(x - start.x, y - start.y) });
      }
    }
  }

  if (candidates.length === 0) {
    const fallback = { x: start.x, y: start.y };
    tiles[fallback.y][fallback.x].terrain_id = "exit";
    return fallback;
  }

  candidates.sort((a, b) => b.distance - a.distance);
  const distant_pool_size = Math.max(1, Math.ceil(candidates.length * 0.35));
  const exit = random.pick(candidates.slice(0, distant_pool_size));
  tiles[exit.y][exit.x].terrain_id = "exit";
  return { x: exit.x, y: exit.y };
}

function carve_room(tiles, room, random) {
  for (let y = room.y; y < room.y + room.height; y += 1) {
    for (let x = room.x; x < room.x + room.width; x += 1) {
      tiles[y][x].terrain_id = random.chance(0.15) ? "cracked_floor" : "stone_floor";
    }
  }
}

function carve_corridor(tiles, first_room, second_room, random) {
  let x = first_room.center_x;
  let y = first_room.center_y;
  const horizontal_first = random.chance(0.5);

  if (horizontal_first) {
    while (x !== second_room.center_x) {
      tiles[y][x].terrain_id = "stone_floor";
      x += Math.sign(second_room.center_x - x);
    }
  }

  while (y !== second_room.center_y) {
    tiles[y][x].terrain_id = "stone_floor";
    y += Math.sign(second_room.center_y - y);
  }

  while (x !== second_room.center_x) {
    tiles[y][x].terrain_id = "stone_floor";
    x += Math.sign(second_room.center_x - x);
  }

  tiles[y][x].terrain_id = "stone_floor";
}
