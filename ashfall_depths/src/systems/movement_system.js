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
    if (!this.game.dungeon.grid.is_walkable(target_x, target_y)) {
      return false;
    }

    const blocking_entity = this.game.entities.find((candidate) =>
      candidate.alive &&
      candidate.entity_id !== entity.entity_id &&
      candidate.type !== "ground_item" &&
      candidate.grid_x === target_x &&
      candidate.grid_y === target_y
    );

    if (blocking_entity) {
      if (entity.type === "player" && blocking_entity.type === "companion" && !blocking_entity.moving) {
        return this.swap_entities(entity, blocking_entity, now);
      }
      return false;
    }

    this.begin_move(entity, target_x, target_y, now);
    return true;
  }

  begin_move(entity, target_x, target_y, now) {
    entity.move_from_x = entity.display_x;
    entity.move_from_y = entity.display_y;
    entity.grid_x = target_x;
    entity.grid_y = target_y;
    entity.move_started_at = now;
    entity.moving = true;
  }

  swap_entities(player, companion, now) {
    const player_target_x = companion.grid_x;
    const player_target_y = companion.grid_y;
    const companion_target_x = player.grid_x;
    const companion_target_y = player.grid_y;

    this.begin_move(player, player_target_x, player_target_y, now);
    this.begin_move(companion, companion_target_x, companion_target_y, now);
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
