import { terrain_database } from "../data/terrain.js";

const cardinal_directions = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 }
];

const minimum_room_safe_ratio = 0.65;
const minimum_room_safe_tiles = 5;

export function apply_lava_patches(dungeon, options = {}, protected_positions = []) {
  if (!dungeon?.grid?.tiles || !dungeon.start || !dungeon.exit || !dungeon.random) {
    return [];
  }

  const patch_count = Math.max(0, Math.floor(Number(options.lava_patch_count) || 0));
  const minimum_size = Math.max(2, Math.floor(Number(options.lava_patch_minimum_size) || 2));
  const maximum_size = Math.max(minimum_size, Math.floor(Number(options.lava_patch_maximum_size) || minimum_size));
  const safety_profile = build_room_safety_profile(dungeon);
  const protected_keys = build_protected_keys(dungeon, protected_positions, safety_profile.protected_keys);
  const existing_lava_keys = new Set();
  const lava_count_by_room = new Map();
  const accepted_patches = [];

  for (let patch_index = 0; patch_index < patch_count; patch_index += 1) {
    const target_size = dungeon.random.integer(minimum_size, maximum_size);
    const patch = create_lava_patch(
      dungeon,
      protected_keys,
      existing_lava_keys,
      lava_count_by_room,
      safety_profile,
      minimum_size,
      target_size
    );

    if (patch.length < minimum_size) {
      continue;
    }

    accepted_patches.push(patch);
    const room_index = patch[0].room_index;
    lava_count_by_room.set(room_index, (lava_count_by_room.get(room_index) ?? 0) + patch.length);
    for (const tile of patch) {
      existing_lava_keys.add(position_key(tile.x, tile.y));
    }
  }

  if (!are_all_rooms_accessible(dungeon)) {
    for (const patch of accepted_patches) {
      restore_patch(dungeon.grid.tiles, patch);
    }
    dungeon.lava_patches = [];
    dungeon.lava_tiles = [];
    return [];
  }

  const patches = accepted_patches.map((patch) => patch.map(({ x, y }) => ({ x, y })));
  dungeon.lava_patches = patches;
  dungeon.lava_tiles = patches.flat();
  return patches;
}

export function is_dungeon_fully_connected(dungeon) {
  return Boolean(dungeon?.grid?.tiles && dungeon.start && dungeon.exit) &&
    all_walkable_tiles_connected(dungeon.grid.tiles, dungeon.start, dungeon.exit);
}

export function are_all_rooms_accessible(dungeon) {
  if (!dungeon?.grid?.tiles || !dungeon.start || !dungeon.exit) {
    return false;
  }
  if (!all_walkable_tiles_connected(dungeon.grid.tiles, dungeon.start, dungeon.exit)) {
    return false;
  }

  const reachable = collect_reachable_keys(dungeon.grid.tiles, dungeon.start);
  for (const room of dungeon.rooms ?? []) {
    const room_tiles = collect_room_tiles(dungeon.grid.tiles, room.index);
    if (room_tiles.length === 0) {
      return false;
    }

    const safe_tiles = room_tiles.filter((position) => is_walkable(dungeon.grid.tiles, position.x, position.y));
    if (safe_tiles.length < required_safe_tile_count(room_tiles.length)) {
      return false;
    }
    if (!reachable.has(position_key(room.center_x, room.center_y))) {
      return false;
    }

    const original_access_points = collect_room_access_points(dungeon.grid.tiles, room.index, true);
    if ((dungeon.rooms?.length ?? 0) > 1 && original_access_points.length > 0) {
      const has_reachable_access = original_access_points.some((position) =>
        is_walkable(dungeon.grid.tiles, position.x, position.y) &&
        reachable.has(position_key(position.x, position.y))
      );
      if (!has_reachable_access) {
        return false;
      }
    }
  }
  return true;
}

export function required_safe_tile_count(total_room_tiles) {
  const total = Math.max(0, Math.floor(Number(total_room_tiles) || 0));
  return Math.min(total, Math.max(minimum_room_safe_tiles, Math.ceil(total * minimum_room_safe_ratio)));
}

function build_room_safety_profile(dungeon) {
  const tiles = dungeon.grid.tiles;
  const protected_keys = new Set();
  const maximum_lava_by_room = new Map();

  for (const room of dungeon.rooms ?? []) {
    const room_tiles = collect_room_tiles(tiles, room.index);
    maximum_lava_by_room.set(room.index, Math.max(0, room_tiles.length - required_safe_tile_count(room_tiles.length)));

    protect_walkable_clearance(tiles, protected_keys, room.center_x, room.center_y);
    for (const access of collect_room_access_points(tiles, room.index, false)) {
      protect_walkable_clearance(tiles, protected_keys, access.x, access.y);
    }
  }

  const targets = [
    ...(dungeon.rooms ?? []).map((room) => ({ x: room.center_x, y: room.center_y })),
    dungeon.exit
  ];
  protect_access_routes(tiles, dungeon.start, targets, protected_keys);

  return { protected_keys, maximum_lava_by_room };
}

function protect_access_routes(tiles, start, targets, protected_keys) {
  const previous = build_shortest_path_tree(tiles, start);
  const start_key = position_key(start.x, start.y);

  for (const target of targets) {
    let current_key = position_key(target.x, target.y);
    if (!previous.has(current_key)) {
      continue;
    }
    while (current_key) {
      const [x, y] = current_key.split(",").map(Number);
      protect_walkable_clearance(tiles, protected_keys, x, y);
      if (current_key === start_key) {
        break;
      }
      current_key = previous.get(current_key);
    }
  }
}

function build_shortest_path_tree(tiles, start) {
  const start_key = position_key(start.x, start.y);
  const queue = [{ x: start.x, y: start.y }];
  const previous = new Map([[start_key, null]]);

  while (queue.length > 0) {
    const current = queue.shift();
    for (const direction of cardinal_directions) {
      const x = current.x + direction.x;
      const y = current.y + direction.y;
      const key = position_key(x, y);
      if (previous.has(key) || !is_walkable(tiles, x, y)) {
        continue;
      }
      previous.set(key, position_key(current.x, current.y));
      queue.push({ x, y });
    }
  }
  return previous;
}

function protect_walkable_clearance(tiles, protected_keys, x, y) {
  for (const direction of [{ x: 0, y: 0 }, ...cardinal_directions]) {
    const next_x = x + direction.x;
    const next_y = y + direction.y;
    if (is_walkable(tiles, next_x, next_y)) {
      protected_keys.add(position_key(next_x, next_y));
    }
  }
}

function build_protected_keys(dungeon, protected_positions, room_protected_keys = new Set()) {
  const protected_keys = new Set([
    ...room_protected_keys,
    position_key(dungeon.start.x, dungeon.start.y),
    position_key(dungeon.exit.x, dungeon.exit.y)
  ]);

  for (const position of protected_positions) {
    if (Number.isFinite(position?.x) && Number.isFinite(position?.y)) {
      protected_keys.add(position_key(position.x, position.y));
    }
  }
  return protected_keys;
}

function create_lava_patch(
  dungeon,
  protected_keys,
  existing_lava_keys,
  lava_count_by_room,
  safety_profile,
  minimum_size,
  target_size
) {
  const tiles = dungeon.grid.tiles;
  const seed_candidates = collect_seed_candidates(
    dungeon,
    protected_keys,
    existing_lava_keys,
    lava_count_by_room,
    safety_profile,
    minimum_size,
    false
  );
  if (seed_candidates.length === 0) {
    seed_candidates.push(...collect_seed_candidates(
      dungeon,
      protected_keys,
      existing_lava_keys,
      lava_count_by_room,
      safety_profile,
      minimum_size,
      true
    ));
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
      lava_count_by_room,
      safety_profile,
      target_size
    );

    if (patch.length >= minimum_size) {
      return patch;
    }
    restore_patch(tiles, patch);
  }
  return [];
}

function collect_seed_candidates(
  dungeon,
  protected_keys,
  existing_lava_keys,
  lava_count_by_room,
  safety_profile,
  minimum_size,
  allow_entry_room
) {
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
      if ((safety_profile.maximum_lava_by_room.get(tile.room_index) ?? 0) - (lava_count_by_room.get(tile.room_index) ?? 0) < minimum_size) {
        continue;
      }
      if (!is_candidate_tile(
        tiles,
        x,
        y,
        protected_keys,
        existing_lava_keys,
        new Set(),
        tile.room_index,
        lava_count_by_room,
        safety_profile,
        0
      )) {
        continue;
      }
      candidates.push({ x, y, room_index: tile.room_index });
    }
  }
  return candidates;
}

function grow_patch_from_seed(
  dungeon,
  seed,
  protected_keys,
  existing_lava_keys,
  lava_count_by_room,
  safety_profile,
  target_size
) {
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
      seed.room_index,
      lava_count_by_room,
      safety_profile,
      patch.length
    )) {
      continue;
    }

    const original_terrain_id = tiles[candidate.y][candidate.x].terrain_id;
    tiles[candidate.y][candidate.x].terrain_id = "lava_floor";
    if (!all_walkable_tiles_connected(tiles, dungeon.start, dungeon.exit) || !are_all_rooms_accessible(dungeon)) {
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

function is_candidate_tile(
  tiles,
  x,
  y,
  protected_keys,
  existing_lava_keys,
  patch_keys,
  room_index,
  lava_count_by_room,
  safety_profile,
  pending_patch_size
) {
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

  const accepted_room_lava = lava_count_by_room.get(room_index) ?? 0;
  const maximum_room_lava = safety_profile.maximum_lava_by_room.get(room_index) ?? 0;
  if (accepted_room_lava + pending_patch_size >= maximum_room_lava) {
    return false;
  }

  return cardinal_directions.every((direction) => {
    const neighbor_key = position_key(x + direction.x, y + direction.y);
    return !existing_lava_keys.has(neighbor_key);
  });
}

function collect_room_tiles(tiles, room_index) {
  const positions = [];
  for (let y = 0; y < tiles.length; y += 1) {
    for (let x = 0; x < tiles[y].length; x += 1) {
      if (tiles[y][x].room_index === room_index) {
        positions.push({ x, y });
      }
    }
  }
  return positions;
}

function collect_room_access_points(tiles, room_index, include_lava_room_tiles) {
  const access_points = [];
  for (const position of collect_room_tiles(tiles, room_index)) {
    if (!include_lava_room_tiles && !is_walkable(tiles, position.x, position.y)) {
      continue;
    }
    const touches_outside_route = cardinal_directions.some((direction) => {
      const x = position.x + direction.x;
      const y = position.y + direction.y;
      const neighbor = tiles[y]?.[x];
      return Boolean(
        neighbor &&
        neighbor.room_index !== room_index &&
        terrain_database[neighbor.terrain_id]?.walkable
      );
    });
    if (touches_outside_route) {
      access_points.push(position);
    }
  }
  return access_points;
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
  const visited = collect_reachable_keys(tiles, start);
  return visited.size === walkable_count && visited.has(position_key(exit.x, exit.y));
}

function collect_reachable_keys(tiles, start) {
  if (!is_walkable(tiles, start.x, start.y)) {
    return new Set();
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
  return visited;
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
