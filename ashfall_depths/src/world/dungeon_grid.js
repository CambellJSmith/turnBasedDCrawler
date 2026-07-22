import { terrain_database } from "../data/terrain.js";

export class DungeonGrid {
  constructor(width, height, tiles) {
    this.width = width;
    this.height = height;
    this.tiles = tiles;
  }

  is_inside(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  get_tile(x, y) {
    if (!this.is_inside(x, y)) {
      return null;
    }
    return this.tiles[y][x];
  }

  is_walkable(x, y) {
    const tile = this.get_tile(x, y);
    return Boolean(tile && terrain_database[tile.terrain_id]?.walkable);
  }

  get_floor_positions() {
    const positions = [];
    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        if (this.is_walkable(x, y)) {
          positions.push({ x, y });
        }
      }
    }
    return positions;
  }
}
