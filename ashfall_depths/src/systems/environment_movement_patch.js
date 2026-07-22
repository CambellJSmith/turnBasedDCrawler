import { get_player_upgrade_rank } from "../data/player_upgrades.js";
import { MovementSystem } from "./movement_system.js";

const original_try_move = MovementSystem.prototype.try_move;
MovementSystem.prototype.try_move = function try_move_with_environment(entity, direction, now) {
  const target_x = entity.grid_x + direction.x;
  const target_y = entity.grid_y + direction.y;
  const blocking_object = this.game.dungeon_object_system?.get_object_at(
    target_x,
    target_y,
    (object) => object.blocks_movement && !object.open
  );

  if (entity.type === "player" && blocking_object?.object_type === "secret_wall") {
    return this.game.dungeon_object_system.reveal_secret_wall(blocking_object);
  }

  const terrain_id = this.game.dungeon.grid.get_tile(target_x, target_y)?.terrain_id;
  if (entity.type === "player" && terrain_id === "lava_floor") {
    const resistance_rank = get_player_upgrade_rank(this.game.state, "lava_resistance");
    if (resistance_rank <= 0 || this.game.is_tile_blocked(target_x, target_y, entity.entity_id)) {
      if (resistance_rank <= 0) {
        this.game.add_log("the lava is impassable without the ashwalker upgrade");
      }
      return false;
    }

    this.begin_move(entity, target_x, target_y, now);
    const damage = Math.max(1, 11 - resistance_rank * 2);
    entity.health = Math.max(0, entity.health - damage);
    entity.flash_until = now + 140;
    this.game.spawn_combat_text(target_x, target_y, `-${damage}`);
    this.game.add_effect("fire", target_x, target_y);
    this.game.add_log(`lava burns you for ${damage}`);
    if (entity.health <= 0 && entity.alive) {
      entity.alive = false;
      this.game.handle_player_defeat();
    }
    return true;
  }

  return original_try_move.call(this, entity, direction, now);
};

const original_begin_move = MovementSystem.prototype.begin_move;
MovementSystem.prototype.begin_move = function begin_move_with_floor_triggers(entity, target_x, target_y, now) {
  original_begin_move.call(this, entity, target_x, target_y, now);
  this.game.dungeon_object_system?.handle_actor_enter(entity, target_x, target_y);
  this.game.exploration_system?.update_visibility();
};
