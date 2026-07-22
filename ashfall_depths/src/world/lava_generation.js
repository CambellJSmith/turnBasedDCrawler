import { terrain_database } from "../data/terrain.js";

const cardinal_directions = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];

export function apply_lava_patches(dungeon, options = {}, protected_positions = []) {
  if (!dungeon?.grid?.tiles || !dungeon.start || !dungeon.exit || !dungeon.random) {
    return [];
  }

  const patch_count = Math.max(0, Math.floor(Number(options.lava_patch_count) || 0));
  const minimum_size = Math.max(2, Math.floor(Number(options.lava_patch_minimum_size) || 2));
  const maximum_size = Math.max(minimum_size, Math.floor(Number(options.lava_patch_maximum_size) || minimum_size));
  const protected_keys = build_protected_keys(dungeon, protected_positions);
  const existing_lava_keys = new Set();
  const patches = [];

  for (let patch_index = 0; patch_index < patch_count; patch_index += 1) {
    const target_size = dungeon.random.integer(minimum_size, maximum_size);
    const patch = create_lava_patch(
      dungeon,
      protected_keys,
      existing_lava_keys,
      minimum_size,
      target_size
    );

    if (patch.length < minimum_size) {
      continue;
    }

    patches.push(patch.map(({ x, y }) => ({ x, y })));
    for (const tile of patch) {
      existing_lava_keys.add(position_key(tile.x, tile.y));
    }
  }

  dungeon.lava_patches = patches;
  dungeon.lava_tiles = patches.flat();
  return patches;
}

export function is_dungeon_fully_connected(dungeon) {
  return Boolean(dungeon?.grid?.tiles && dungeon.start && dungeon.exit) &&
    all_walkable_tiles_connected(dungeon.grid.tiles, dungeon.start, dungeon.exit);
}

function build_protected_keys(dungeon, protected_positions) {
  const protected_keys = new Set([
    position_key(dungeon.start.x, dungeon.start.y),
    position_key(dungeon.exit.x, dungeon.exit.y)
  ]);

  for (const room of dungeon.rooms ?? []) {
    protected_keys.add(position_key(room.center_x, room.center_y));
  }

  for (const position of protected_positions) {
    if (Number.isFinite(position?.x) && Number.isFinite(position?.y)) {
      protected_keys.add(position_key(position.x, position.y));
    }
  }

  return protected_keys;
}

function create_lava_patch(dungeon, protected_keys, existing_lava_keys, minimum_size, target_size) {
  const tiles = dungeon.grid.tiles;
  const seed_candidates = collect_seed_candidates(dungeon, protected_keys, existing_lava_keys, false);
  if (seed_candidates.length === 0) {
    seed_candidates.push(...collect_seed_candidates(dungeon, protected_keys, existing_lava_keys, true));
  }

  const attempts = Math.min(seed_candidates.length, Math.max(40, dungeon.grid.width * dungeon.grid.height));
  for (let attempt = 0; attempt < attempts && seed_candidates.length > 0; attempt += 1) {
    const seed_index = dungeon.random.integer(0, seed_candidates.length - 1);
    const [seed] = seed_candidates.splice(seed_index, 1);
    const patch = grow_patch_from_seed(
      dungeon,
      seed,
      protected_keys,
      existing_lava_keys,
      target_size
    );

    if (patch.length >= minimum_size) {
      return patch;
    }

    restore_patch(tiles, patch);
  }

  return [];
}

function collect_seed_candidates(dungeon, protected_keys, existing_lava_keys, allow_entry_room) {
  const candidates = [];
  const tiles = dungeon.grid.tiles;

  for (let y = 1; y < dungeon.grid.height - 1; y += 1) {
    for (let x = 1; x < dungeon.grid.width - 1; x += 1) {
      const tile = tiles[y][x];
      if (tile.room_index === null || (!allow_entry_room && tile.room_index === 0)) {
        continue;
      }
      if (allow_entry_room && tile.room_index === 0 && manhattan_distance({ x, y }, dungeon.start) < 3) {
        continue;
      }
      if (!is_candidate_tile(tiles, x, y, protected_keys, existing_lava_keys, new Set(), tile.room_index)) {
        continue;
      }
      candidates.push({ x, y, room_index: tile.room_index });
    }
  }

  return candidates;
}

function grow_patch_from_seed(dungeon, seed, protected_keys, existing_lava_keys, target_size) {
  const tiles = dungeon.grid.tiles;
  const patch = [];
  const patch_keys = new Set();
  const queued_keys = new Set();
  const frontier = [seed];
  queued_keys.add(position_key(seed.x, seed.y));

  while (frontier.length > 0 && patch.length < target_size) {
    const index = dungeon.random.integer(0, frontier.length - 1);
    const [candidate] = frontier.splice(index, 1);
    const key = position_key(candidate.x, candidate.y);
    queued_keys.delete(key);

    if (!is_candidate_tile(
      tiles,
      candidate.x,
      candidate.y,
      protected_keys,
      existing_lava_keys,
      patch_keys,
      seed.room_index
    )) {
      continue;
    }

    const original_terrain_id = tiles[candidate.y][candidate.x].terrain_id;
    tiles[candidate.y][candidate.x].terrain_id = "lava_floor";
    if (!all_walkable_tiles_connected(tiles, dungeon.start, dungeon.exit)) {
      tiles[candidate.y][candidate.x].terrain_id = original_terrain_id;
      continue;
    }

    patch.push({
      x: candidate.x,
      y: candidate.y,
      room_index: seed.room_index,
      original_terrain_id
    });
    patch_keys.add(key);

    for (const direction of cardinal_directions) {
      const x = candidate.x + direction.x;
      const y = candidate.y + direction.y;
      const neighbor_key = position_key(x, y);
      if (patch_keys.has(neighbor_key) || queued_keys.has(neighbor_key)) {
        continue;
      }
      frontier.push({ x, y, room_index: seed.room_index });
      queued_keys.add(neighbor_key);
    }
  }

  return patch;
}

function is_candidate_tile(tiles, x, y, protected_keys, existing_lava_keys, patch_keys, room_index) {
  if (y <= 0 || y >= tiles.length - 1 || x <= 0 || x >= tiles[y].length - 1) {
    return false;
  }

  const key = position_key(x, y);
  const tile = tiles[y][x];
  if (protected_keys.has(key) || patch_keys.has(key) || tile.room_index !== room_index) {
    return false;
  }
  if (tile.terrain_id === "exit" || !terrain_database[tile.terrain_id]?.walkable) {
    return false;
  }

  return cardinal_directions.every((direction) => {
    const neighbor_key = position_key(x + direction.x, y + direction.y);
    return !existing_lava_keys.has(neighbor_key);
  });
}

function restore_patch(tiles, patch) {
  for (const tile of patch) {
    tiles[tile.y][tile.x].terrain_id = tile.original_terrain_id;
  }
}

function all_walkable_tiles_connected(tiles, start, exit) {
  if (!is_walkable(tiles, start.x, start.y) || !is_walkable(tiles, exit.x, exit.y)) {
    return false;
  }

  let walkable_count = 0;
  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < tiles[y].length; x += 1) {
      if (is_walkable(tiles, x, y)) {
        walkable_count += 1;
      }
    }
  }

  const queue = [{ x: start.x, y: start.y }];
  const visited = new Set([position_key(start.x, start.y)]);
  while (queue.length > 0) {
    const current = queue.shift();
    for (const direction of cardinal_directions) {
      const x = current.x + direction.x;
      const y = current.y + direction.y;
      const key = position_key(x, y);
      if (visited.has(key) || !is_walkable(tiles, x, y)) {
        continue;
      }
      visited.add(key);
      queue.push({ x, y });
    }
  }

  return visited.size === walkable_count && visited.has(position_key(exit.x, exit.y));
}

function is_walkable(tiles, x, y) {
  const tile = tiles[y]?.[x];
  return Boolean(tile && terrain_database[tile.terrain_id]?.walkable);
}

function manhattan_distance(first, second) {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}

function position_key(x, y) {
  return `${x},${y}`;
}
