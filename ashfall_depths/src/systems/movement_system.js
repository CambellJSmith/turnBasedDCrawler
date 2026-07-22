import { game_config } from "../config/game_config.js";
import { clamp, lerp } from "../utils/math.js";

export class MovementSystem {
  constructor(game) {
    this.game = game;
  }

  try_move(entity, direction, now) {
    if (!entity.alive || entity.moving) {
      return false;
    }
    const target_x = entity.grid_x + direction.x;
    const target_y = entity.grid_y + direction.y;
    if (!this.game.dungeon.grid.is_walkable(target_x, target_y) || this.game.is_tile_blocked(target_x, target_y, entity.entity_id)) {
      return false;
    }
    entity.move_from_x = entity.display_x;
    entity.move_from_y = entity.display_y;
    entity.grid_x = target_x;
    entity.grid_y = target_y;
    entity.move_started_at = now;
    entity.moving = true;
    return true;
  }

  update_entity(entity, now) {
    if (!entity.moving) {
      entity.display_x = entity.grid_x;
      entity.display_y = entity.grid_y;
      return;
    }
    const progress = clamp((now - entity.move_started_at) / game_config.movement_duration_ms, 0, 1);
    entity.display_x = lerp(entity.move_from_x, entity.grid_x, progress);
    entity.display_y = lerp(entity.move_from_y, entity.grid_y, progress);
    if (progress >= 1) {
      entity.moving = false;
    }
  }

  update(now) {
    for (const entity of this.game.entities) {
      this.update_entity(entity, now);
    }
  }
}
