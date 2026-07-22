import { DungeonGrid } from "./dungeon_grid.js";
import { SeededRandom } from "../utils/random.js";

export function generate_dungeon(width, height, seed) {
  const random = new SeededRandom(seed);
  const tiles = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => ({ terrain_id: "wall", ground_item_ids: [], explored: true }))
  );

  const rooms = [];
  const room_count = 8;

  for (let index = 0; index < room_count; index += 1) {
    const room_width = random.integer(4, 7);
    const room_height = random.integer(4, 7);
    const x = random.integer(1, width - room_width - 2);
    const y = random.integer(1, height - room_height - 2);
    const room = { x, y, width: room_width, height: room_height, center_x: x + Math.floor(room_width / 2), center_y: y + Math.floor(room_height / 2) };

    carve_room(tiles, room, random);
    if (rooms.length > 0) {
      carve_corridor(tiles, rooms.at(-1), room, random);
    }
    rooms.push(room);
  }

  const start = { x: rooms[0].center_x, y: rooms[0].center_y };
  const exit = { x: rooms.at(-1).center_x, y: rooms.at(-1).center_y };
  tiles[exit.y][exit.x].terrain_id = "exit";

  return {
    grid: new DungeonGrid(width, height, tiles),
    rooms,
    start,
    exit,
    seed,
    random
  };
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
