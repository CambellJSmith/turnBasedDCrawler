import { DungeonGrid } from "./dungeon_grid.js";
import { terrain_database } from "../data/terrain.js";
import { room_type_database, get_available_room_types } from "../data/room_types.js";
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
    Array.from({ length: width }, () => ({
      terrain_id: "wall",
      ground_item_ids: [],
      explored: true,
      room_index: null,
      room_type_id: null
    }))
  );

  const floor = Math.max(1, Math.floor(Number(options.floor) || 1));
  const target_room_count = Math.max(2, Math.floor(options.room_count ?? 8));
  const minimum_room_size = Math.max(3, Math.floor(options.minimum_room_size ?? 4));
  const requested_maximum = Math.max(minimum_room_size, Math.floor(options.maximum_room_size ?? 7));
  const maximum_room_size = Math.min(requested_maximum, Math.max(minimum_room_size, Math.min(width, height) - 4));
  const rooms = [];
  const used_room_type_ids = new Set();
  const placement_attempts = Math.max(target_room_count * 40, 80);

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
    const room_type = choose_room_type(random, floor, room_width, room_height, rooms.length, used_room_type_ids);
    const room = {
      index: rooms.length,
      x,
      y,
      width: room_width,
      height: room_height,
      center_x: x + Math.floor(room_width / 2),
      center_y: y + Math.floor(room_height / 2),
      type_id: room_type.id,
      type_name: room_type.name,
      description: room_type.description,
      feature_seed: random.integer(1, 1_000_000)
    };

    if (rooms.some((existing) => rooms_overlap(existing, room, 1))) {
      continue;
    }

    carve_room(tiles, room, room_type, random);
    if (rooms.length > 0) {
      carve_corridor(tiles, rooms.at(-1), room, random);
    }
    rooms.push(room);
    used_room_type_ids.add(room.type_id);
  }

  if (rooms.length === 0) {
    const room_type = room_type_database.entry_hall;
    const fallback = {
      index: 0,
      x: 2,
      y: 2,
      width: Math.max(3, width - 4),
      height: Math.max(3, height - 4),
      center_x: Math.floor(width / 2),
      center_y: Math.floor(height / 2),
      type_id: room_type.id,
      type_name: room_type.name,
      description: room_type.description,
      feature_seed: random.integer(1, 1_000_000)
    };
    carve_room(tiles, fallback, room_type, random);
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

function choose_room_type(random, floor, width, height, room_index, used_room_type_ids) {
  if (room_index === 0) {
    return room_type_database.entry_hall;
  }

  const available = get_available_room_types(floor, width, height);
  const unused = available.filter((room_type) => !used_room_type_ids.has(room_type.id));
  return pick_weighted(random, unused.length > 0 ? unused : available) ?? room_type_database.guard_room;
}

function pick_weighted(random, values) {
  if (values.length === 0) {
    return null;
  }
  const total_weight = values.reduce((sum, value) => sum + Math.max(0, value.spawn_weight), 0);
  if (total_weight <= 0) {
    return random.pick(values);
  }
  let roll = random.next() * total_weight;
  for (const value of values) {
    roll -= Math.max(0, value.spawn_weight);
    if (roll <= 0) {
      return value;
    }
  }
  return values.at(-1);
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
        return Boolean(terrain_database[terrain_id]?.walkable);
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

function carve_room(tiles, room, room_type, random) {
  for (let local_y = 0; local_y < room.height; local_y += 1) {
    for (let local_x = 0; local_x < room.width; local_x += 1) {
      if (!is_room_floor(room_type.shape, room, local_x, local_y)) {
        continue;
      }
      const x = room.x + local_x;
      const y = room.y + local_y;
      const tile = tiles[y][x];
      tile.terrain_id = choose_room_terrain(room_type, room, local_x, local_y, random);
      tile.room_index = room.index;
      tile.room_type_id = room.type_id;
    }
  }

  force_room_center(tiles, room, room_type.primary_terrain_id);
}

function force_room_center(tiles, room, terrain_id) {
  for (const direction of [{ x: 0, y: 0 }, ...cardinal_directions]) {
    const x = room.center_x + direction.x;
    const y = room.center_y + direction.y;
    if (x < room.x || x >= room.x + room.width || y < room.y || y >= room.y + room.height) {
      continue;
    }
    const tile = tiles[y][x];
    tile.terrain_id = terrain_id;
    tile.room_index = room.index;
    tile.room_type_id = room.type_id;
  }
}

function is_room_floor(shape, room, local_x, local_y) {
  const width = room.width;
  const height = room.height;
  const center_x = Math.floor(width / 2);
  const center_y = Math.floor(height / 2);
  const dx = local_x - center_x;
  const dy = local_y - center_y;
  const normalized_x = dx / Math.max(1, (width - 1) / 2);
  const normalized_y = dy / Math.max(1, (height - 1) / 2);
  const radius = normalized_x ** 2 + normalized_y ** 2;
  const near_center = Math.abs(dx) <= 1 && Math.abs(dy) <= 1;

  switch (shape) {
    case "cross":
      return Math.abs(dx) <= 1 || Math.abs(dy) <= 1;
    case "gallery":
      return width >= height
        ? Math.abs(dy) <= 1 || local_x <= 1 || local_x >= width - 2
        : Math.abs(dx) <= 1 || local_y <= 1 || local_y >= height - 2;
    case "alcoves": {
      const central = local_x >= 1 && local_x < width - 1 && local_y >= 1 && local_y < height - 1;
      const side_alcove = (local_x === 0 || local_x === width - 1) && local_y > 0 && local_y < height - 1 && local_y % 2 === 1;
      const end_alcove = (local_y === 0 || local_y === height - 1) && local_x > 0 && local_x < width - 1 && local_x % 2 === 1;
      return central || side_alcove || end_alcove;
    }
    case "pillars": {
      const pillar = local_x > 0 && local_x < width - 1 && local_y > 0 && local_y < height - 1 &&
        local_x % 2 === 0 && local_y % 2 === 0 && !near_center;
      return !pillar;
    }
    case "round":
      return radius <= 1.08;
    case "ring":
      return radius <= 1.08 && (radius >= 0.38 || Math.abs(dx) <= 1 || Math.abs(dy) <= 1);
    case "split": {
      if (width >= height) {
        const partition = local_x === center_x && local_y > 0 && local_y < height - 1;
        return !partition || local_y === center_y || local_y === 1 || local_y === height - 2;
      }
      const partition = local_y === center_y && local_x > 0 && local_x < width - 1;
      return !partition || local_x === center_x || local_x === 1 || local_x === width - 2;
    }
    case "hourglass": {
      if (width >= height) {
        const allowed = 0.28 + 0.72 * Math.abs(normalized_y);
        return Math.abs(normalized_x) <= allowed || near_center;
      }
      const allowed = 0.28 + 0.72 * Math.abs(normalized_x);
      return Math.abs(normalized_y) <= allowed || near_center;
    }
    case "cells":
      return width >= height
        ? Math.abs(dx) <= 1 || local_y % 2 === 1 || local_y === 0 || local_y === height - 1
        : Math.abs(dy) <= 1 || local_x % 2 === 1 || local_x === 0 || local_x === width - 1;
    case "aisles": {
      const blocked = width >= height
        ? local_x > 0 && local_x < width - 1 && local_x % 3 === 0 && local_y > 1 && local_y < height - 2 && local_y !== center_y
        : local_y > 0 && local_y < height - 1 && local_y % 3 === 0 && local_x > 1 && local_x < width - 2 && local_x !== center_x;
      return !blocked;
    }
    case "arena": {
      const obstacle_ring = radius > 0.42 && radius < 0.7;
      const gate = Math.abs(dx) <= 1 || Math.abs(dy) <= 1;
      return radius <= 1.08 && (!obstacle_ring || gate);
    }
    case "bridge":
      return width >= height
        ? Math.abs(dy) <= 1 || local_x <= 1 || local_x >= width - 2
        : Math.abs(dx) <= 1 || local_y <= 1 || local_y >= height - 2;
    case "maze": {
      const protected_lane = local_x === 0 || local_x === width - 1 || local_y === 0 || local_y === height - 1 ||
        Math.abs(dx) <= 1 || Math.abs(dy) <= 1;
      const short_bar = width >= height
        ? local_x % 3 === 0 && local_y % 4 !== 0
        : local_y % 3 === 0 && local_x % 4 !== 0;
      return protected_lane || !short_bar;
    }
    case "cathedral": {
      if (height >= width) {
        const nave = Math.abs(dx) <= 1;
        const transept = Math.abs(dy) <= 1;
        const apse = local_y <= 2 && normalized_x ** 2 + ((local_y - 1) / 2) ** 2 <= 1.2;
        return nave || transept || apse;
      }
      const nave = Math.abs(dy) <= 1;
      const transept = Math.abs(dx) <= 1;
      const apse = local_x >= width - 3 && normalized_y ** 2 + ((local_x - (width - 2)) / 2) ** 2 <= 1.2;
      return nave || transept || apse;
    }
    case "vault": {
      const inner = local_x >= 1 && local_x < width - 1 && local_y >= 1 && local_y < height - 1;
      return inner || Math.abs(dx) <= 1 || Math.abs(dy) <= 1;
    }
    case "machinery": {
      const machine = local_x > 0 && local_x < width - 2 && local_y > 0 && local_y < height - 2 &&
        local_x % 4 <= 1 && local_y % 4 <= 1 && !near_center;
      return !machine;
    }
    case "rubble": {
      const rubble = local_x > 0 && local_x < width - 1 && local_y > 0 && local_y < height - 1 &&
        ((local_x * 7 + local_y * 11 + room.feature_seed) % 13 === 0) && !near_center;
      return !rubble;
    }
    case "solid":
    default:
      return true;
  }
}

function choose_room_terrain(room_type, room, local_x, local_y, random) {
  const primary = room_type.primary_terrain_id;
  const secondary = room_type.secondary_terrain_id ?? primary;
  const center_x = Math.floor(room.width / 2);
  const center_y = Math.floor(room.height / 2);
  const dx = local_x - center_x;
  const dy = local_y - center_y;
  const normalized_x = dx / Math.max(1, (room.width - 1) / 2);
  const normalized_y = dy / Math.max(1, (room.height - 1) / 2);
  const radius = Math.sqrt(normalized_x ** 2 + normalized_y ** 2);
  let use_secondary = false;

  switch (room_type.pattern) {
    case "border":
      use_secondary = local_x === 0 || local_y === 0 || local_x === room.width - 1 || local_y === room.height - 1;
      break;
    case "cross":
      use_secondary = Math.abs(dx) <= 0 || Math.abs(dy) <= 0;
      break;
    case "noise":
      use_secondary = random.chance(0.34);
      break;
    case "stripes":
      use_secondary = room.width >= room.height ? local_x % 2 === 0 : local_y % 2 === 0;
      break;
    case "checker":
      use_secondary = (local_x + local_y) % 2 === 0;
      break;
    case "basin":
      use_secondary = Math.abs(normalized_x) < 0.55 && Math.abs(normalized_y) < 0.55;
      break;
    case "rings":
      use_secondary = Math.floor(radius * 4) % 2 === 0;
      break;
    case "halves":
      use_secondary = room.width >= room.height ? local_x > center_x : local_y > center_y;
      break;
    case "corners":
      use_secondary = Math.abs(normalized_x) > 0.55 && Math.abs(normalized_y) > 0.55;
      break;
    case "rays":
      use_secondary = Math.abs(dx) === Math.abs(dy) || dx === 0 || dy === 0;
      break;
    case "spiral": {
      const angle = Math.atan2(normalized_y, normalized_x) + Math.PI;
      const spiral_band = (angle / (Math.PI * 2) + radius * 1.5) % 1;
      use_secondary = spiral_band < 0.28;
      break;
    }
    case "mirror":
      use_secondary = Math.abs(dx) % 2 === 0;
      break;
    default:
      use_secondary = random.chance(0.15);
  }

  return use_secondary ? secondary : primary;
}

function carve_corridor(tiles, first_room, second_room, random) {
  let x = first_room.center_x;
  let y = first_room.center_y;
  const horizontal_first = random.chance(0.5);

  if (horizontal_first) {
    while (x !== second_room.center_x) {
      carve_corridor_tile(tiles[y][x]);
      x += Math.sign(second_room.center_x - x);
    }
  }

  while (y !== second_room.center_y) {
    carve_corridor_tile(tiles[y][x]);
    y += Math.sign(second_room.center_y - y);
  }

  while (x !== second_room.center_x) {
    carve_corridor_tile(tiles[y][x]);
    x += Math.sign(second_room.center_x - x);
  }

  carve_corridor_tile(tiles[y][x]);
}

function carve_corridor_tile(tile) {
  if (tile.terrain_id === "wall") {
    tile.terrain_id = "stone_floor";
    tile.room_index = null;
    tile.room_type_id = null;
  }
}
