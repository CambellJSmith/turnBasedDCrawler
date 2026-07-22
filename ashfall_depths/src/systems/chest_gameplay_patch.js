import { Game } from "../core/game.js";
import { distance_between } from "../utils/math.js";
import { CombatSystem } from "./combat_system.js";
import { EnemyAiSystem } from "./enemy_ai_system.js";
import { InteractionSystem } from "./interaction_system.js";
import { ChestSystem } from "./chest_system.js";

const original_generate_floor = Game.prototype.generate_floor;
Game.prototype.generate_floor = function generate_floor_with_chests() {
  const result = original_generate_floor.call(this);
  this.chest_system = new ChestSystem(this);
  this.chest_system.spawn_random_chests();
  return result;
};

const original_enemy_turn = EnemyAiSystem.prototype.take_turn;
EnemyAiSystem.prototype.take_turn = function take_turn_with_chests(monster, now) {
  const chest_system = this.game.chest_system;
  if (!chest_system || !monster.alive || monster.carried_chest_id) {
    return original_enemy_turn.call(this, monster, now);
  }

  const combat_target = this.find_target(monster);
  const target_distance = combat_target ? distance_between(monster, combat_target) : Infinity;
  if (target_distance > 1.25) {
    const adjacent_chest = chest_system.get_adjacent_chest(monster);
    if (adjacent_chest && chest_system.pick_up_chest(monster, adjacent_chest)) {
      return true;
    }

    const chest = chest_system.find_nearby_chest(monster);
    const chest_distance = chest
      ? Math.abs(monster.grid_x - chest.grid_x) + Math.abs(monster.grid_y - chest.grid_y)
      : Infinity;
    if (chest && chest_distance < target_distance) {
      const step = chest_system.find_step_toward_chest(monster, chest);
      if (step) {
        return this.game.movement_system.try_move(
          monster,
          { x: step.x - monster.grid_x, y: step.y - monster.grid_y },
          now
        );
      }
    }
  }

  return original_enemy_turn.call(this, monster, now);
};

const original_defeat_entity = CombatSystem.prototype.defeat_entity;
CombatSystem.prototype.defeat_entity = function defeat_entity_with_chest_drop(entity, source = null) {
  const carried_chest_id = entity.type === "monster" ? entity.carried_chest_id : null;
  const result = original_defeat_entity.call(this, entity, source);
  if (carried_chest_id) {
    this.game.chest_system?.drop_carried_chest(entity);
  }
  return result;
};

const original_interact = InteractionSystem.prototype.interact;
InteractionSystem.prototype.interact = function interact_with_chests() {
  const ground_item_here = this.game.entities.some((entity) =>
    entity.alive &&
    entity.type === "ground_item" &&
    entity.grid_x === this.game.player.grid_x &&
    entity.grid_y === this.game.player.grid_y
  );
  if (!ground_item_here) {
    const chest = this.game.chest_system?.get_adjacent_chest(this.game.player);
    if (chest && this.game.chest_system.open_chest(chest)) {
      return { consumes_turn: true, skip_non_player_turns: false };
    }
  }
  return original_interact.call(this);
};

const original_get_prompt = InteractionSystem.prototype.get_prompt;
InteractionSystem.prototype.get_prompt = function get_prompt_with_chests() {
  const original_prompt = original_get_prompt.call(this);
  if (original_prompt) {
    return original_prompt;
  }
  const chest = this.game.chest_system?.get_adjacent_chest(this.game.player);
  return chest ? "press e or xbox a to open treasure chest · consumes a turn" : "";
};
