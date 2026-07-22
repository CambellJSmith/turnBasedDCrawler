import { game_config } from "../config/game_config.js";
import { clamp, lerp } from "../utils/math.js";
import { ChestSystem } from "./chest_system.js";
import { CombatSystem } from "./combat_system.js";
import { DungeonObjectSystem } from "./dungeon_object_system.js";
import { MagicSystem } from "./magic_system.js";
import { MovementSystem } from "./movement_system.js";
import { RecruitmentSystem } from "./recruitment_system.js";
import { TurnSystem } from "./turn_system.js";
import { LevelUpController } from "../ui/level_up_controller.js";

const previous_apply_damage = CombatSystem.prototype.apply_damage;
CombatSystem.prototype.apply_damage = function apply_damage_with_impact(target, amount, source, now) {
  const health_before = target.health;
  const incoming_damage = Math.max(0, Number(amount) || 0);
  const would_be_fatal = health_before - incoming_damage <= 0;
  const result = previous_apply_damage.call(this, target, amount, source, now);
  const damage_dealt = Math.min(health_before, incoming_damage);
  if (damage_dealt > 0) {
    const combat_text = this.game.combat_texts.at(-1);
    if (combat_text && combat_text.grid_x === target.grid_x && combat_text.grid_y === target.grid_y) {
      combat_text.kind = target.type === "player" || target.type === "companion" ? "danger" : "damage";
      combat_text.emphasis = damage_dealt >= Math.max(8, target.maximum_health * 0.2) || would_be_fatal;
    }
    this.game.game_feel?.impact(target, source, damage_dealt, now, { fatal: would_be_fatal });
  }
  return result;
};

const previous_player_attack = CombatSystem.prototype.player_attack;
CombatSystem.prototype.player_attack = function player_attack_with_swing(now) {
  const target = this.game.get_living_monsters()
    .filter((monster) => Math.hypot(monster.grid_x - this.game.player.grid_x, monster.grid_y - this.game.player.grid_y) <= 1.25)
    .sort((first, second) =>
      Math.hypot(first.grid_x - this.game.player.grid_x, first.grid_y - this.game.player.grid_y) -
      Math.hypot(second.grid_x - this.game.player.grid_x, second.grid_y - this.game.player.grid_y)
    )[0] ?? null;
  const result = previous_player_attack.call(this, now);
  if (result) {
    this.game.game_feel?.pulse_command("command_attack");
    if (!target) {
      this.game.game_feel?.whiff(this.game.player, now);
    }
  }
  return result;
};

const previous_begin_move = MovementSystem.prototype.begin_move;
MovementSystem.prototype.begin_move = function begin_move_with_step_feedback(entity, target_x, target_y, now) {
  const departure_x = entity.display_x;
  const departure_y = entity.display_y;
  previous_begin_move.call(this, entity, target_x, target_y, now);
  this.game.game_feel?.step(entity, now, departure_x, departure_y);
};

MovementSystem.prototype.update_entity = function update_entity_with_snappy_easing(entity, now) {
  if (!entity.moving) {
    entity.display_x = entity.grid_x;
    entity.display_y = entity.grid_y;
    return;
  }
  const progress = clamp((now - entity.move_started_at) / game_config.movement_duration_ms, 0, 1);
  const eased_progress = 1 - Math.pow(1 - progress, 3);
  entity.display_x = lerp(entity.move_from_x, entity.grid_x, eased_progress);
  entity.display_y = lerp(entity.move_from_y, entity.grid_y, eased_progress);
  if (progress >= 1) {
    entity.moving = false;
  }
};

const previous_cast = MagicSystem.prototype.cast;
MagicSystem.prototype.cast = function cast_with_spell_feedback(spell_id, caster, now) {
  const health_before = caster.health;
  const result = previous_cast.call(this, spell_id, caster, now);
  if (result) {
    this.game.game_feel?.spell(spell_id, caster, now);
    const restored = Math.max(0, caster.health - health_before);
    if (restored > 0) {
      this.game.spawn_combat_text(caster.grid_x, caster.grid_y, `+${restored}`);
      const combat_text = this.game.combat_texts.at(-1);
      if (combat_text) {
        combat_text.kind = "heal";
        combat_text.emphasis = restored >= Math.max(8, caster.maximum_health * 0.2);
      }
      this.game.game_feel?.heal(caster, restored, now);
    }
  }
  return result;
};

const previous_open_chest = ChestSystem.prototype.open_chest;
ChestSystem.prototype.open_chest = function open_chest_with_reward_feedback(chest) {
  const position = chest ? { grid_x: chest.grid_x, grid_y: chest.grid_y } : null;
  const result = previous_open_chest.call(this, chest);
  if (result && position) {
    this.game.game_feel?.chest(position, performance.now());
  }
  return result;
};

const previous_interact_object = DungeonObjectSystem.prototype.interact;
DungeonObjectSystem.prototype.interact = function interact_with_object_feedback(object) {
  const result = previous_interact_object.call(this, object);
  if (result && object) {
    this.game.game_feel?.interaction(object, performance.now());
  }
  return result;
};

const previous_recruit = RecruitmentSystem.prototype.recruit;
RecruitmentSystem.prototype.recruit = function recruit_with_reward_feedback(entity) {
  const result = previous_recruit.call(this, entity);
  if (result) {
    this.game.game_feel?.chest(entity, performance.now());
  }
  return result;
};

const previous_turn_update = TurnSystem.prototype.update;
TurnSystem.prototype.update = function update_with_turn_ready_feedback() {
  const was_resolving = this.turn_in_progress;
  previous_turn_update.call(this);
  if (was_resolving && !this.turn_in_progress && this.game.player.alive) {
    this.game.game_feel?.turn_ready(performance.now());
  }
};

const previous_choose_upgrade = LevelUpController.prototype.choose;
LevelUpController.prototype.choose = function choose_upgrade_with_feedback(upgrade_id) {
  const result = previous_choose_upgrade.call(this, upgrade_id);
  if (result) {
    this.game.game_feel?.chest(this.game.player, performance.now());
  }
  return result;
};
