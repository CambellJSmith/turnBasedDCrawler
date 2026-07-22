export class ExplorationSystem {
  constructor(game, vision_radius = 5) {
    this.game = game;
    this.vision_radius = vision_radius;
    this.known_chest_positions = new Map();
  }

  initialize_floor() {
    this.known_chest_positions.clear();
    for (const row of this.game.dungeon.grid.tiles) {
      for (const tile of row) {
        tile.explored = false;
        tile.visible = false;
      }
    }
    this.update_visibility();
  }

  update_visibility() {
    const grid = this.game.dungeon?.grid;
    const player = this.game.player;
    if (!grid || !player) {
      return;
    }

    for (const row of grid.tiles) {
      for (const tile of row) {
        tile.visible = false;
      }
    }

    const current_tile = grid.get_tile(player.grid_x, player.grid_y);
    if (current_tile?.room_index !== null && current_tile?.room_index !== undefined) {
      for (let y = 0; y < grid.height; y += 1) {
        for (let x = 0; x < grid.width; x += 1) {
          const tile = grid.get_tile(x, y);
          if (tile.room_index === current_tile.room_index) {
            tile.explored = true;
            tile.visible = true;
          }
        }
      }
    }

    for (let y = Math.max(0, player.grid_y - this.vision_radius); y <= Math.min(grid.height - 1, player.grid_y + this.vision_radius); y += 1) {
      for (let x = Math.max(0, player.grid_x - this.vision_radius); x <= Math.min(grid.width - 1, player.grid_x + this.vision_radius); x += 1) {
        if (Math.hypot(x - player.grid_x, y - player.grid_y) > this.vision_radius + 0.35) {
          continue;
        }
        if (!this.has_line_of_sight(player.grid_x, player.grid_y, x, y)) {
          continue;
        }
        const tile = grid.get_tile(x, y);
        tile.explored = true;
        tile.visible = true;
      }
    }

    this.update_known_chests();
  }

  update_known_chests() {
    const grid = this.game.dungeon.grid;
    for (let y = 0; y < grid.height; y += 1) {
      for (let x = 0; x < grid.width; x += 1) {
        if (grid.get_tile(x, y)?.visible) {
          this.known_chest_positions.delete(position_key(x, y));
        }
      }
    }

    for (const entity of this.game.entities) {
      if (entity.alive && entity.type === "chest" && !entity.carried_by_entity_id && this.is_visible(entity.grid_x, entity.grid_y)) {
        this.known_chest_positions.set(position_key(entity.grid_x, entity.grid_y), {
          x: entity.grid_x,
          y: entity.grid_y
        });
      }
    }
  }

  is_visible(x, y) {
    return Boolean(this.game.dungeon.grid.get_tile(x, y)?.visible);
  }

  is_explored(x, y) {
    return Boolean(this.game.dungeon.grid.get_tile(x, y)?.explored);
  }

  has_line_of_sight(start_x, start_y, target_x, target_y) {
    let x = start_x;
    let y = start_y;
    const dx = Math.abs(target_x - start_x);
    const dy = Math.abs(target_y - start_y);
    const step_x = start_x < target_x ? 1 : -1;
    const step_y = start_y < target_y ? 1 : -1;
    let error = dx - dy;

    while (x !== target_x || y !== target_y) {
      const double_error = error * 2;
      if (double_error > -dy) {
        error -= dy;
        x += step_x;
      }
      if (double_error < dx) {
        error += dx;
        y += step_y;
      }
      if (x === target_x && y === target_y) {
        return true;
      }
      if (this.blocks_vision(x, y)) {
        return false;
      }
    }
    return true;
  }

  blocks_vision(x, y) {
    const tile = this.game.dungeon.grid.get_tile(x, y);
    if (!tile || tile.terrain_id === "wall") {
      return true;
    }
    return this.game.entities.some((entity) =>
      entity.alive && entity.grid_x === x && entity.grid_y === y && entity.blocks_vision === true
    );
  }
}

function position_key(x, y) {
  return `${x},${y}`;
}
