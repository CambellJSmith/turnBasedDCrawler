import { distance_between } from "../utils/math.js";
import { find_next_step } from "../world/pathfinding.js";

const cardinal_directions = Object.freeze([
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: -1, y: 0 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: 0, y: -1 })
]);

export class EnemyAiSystem {
  constructor(game) {
    this.game = game;
  }

  take_turn(monster, now) {
    if (!monster.alive) {
      return false;
    }

    const target = this.find_target(monster);
    if (!target) {
      return false;
    }

    if (monster.ai_profile === "bruiser") {
      return this.take_bruiser_turn(monster, target, now);
    }
    if (monster.ai_profile === "glass_cannon") {
      return this.take_glass_cannon_turn(monster, target, now);
    }
    if (monster.ai_profile === "tank") {
      return this.take_tank_turn(monster, target, now);
    }

    return this.take_balanced_turn(monster, target, now);
  }

  take_balanced_turn(monster, target, now) {
    const distance = distance_between(monster, target);
    if (this.should_use_special(monster, target)) {
      return this.game.monster_ability_system.use_special(monster, target, now);
    }
    if (distance <= 1.25) {
      return this.game.combat_system.monster_attack(monster, target, now);
    }
    return this.move_toward(monster, target, now);
  }

  take_bruiser_turn(monster, target, now) {
    if (distance_between(monster, target) <= 1.25) {
      if (this.should_use_special(monster, target)) {
        return this.game.monster_ability_system.use_special(monster, target, now);
      }
      return this.game.combat_system.monster_attack(monster, target, now);
    }

    return this.move_toward(monster, target, now);
  }

  take_glass_cannon_turn(monster, target, now) {
    const distance = distance_between(monster, target);
    if (distance <= 1.25 && this.try_retreat(monster, target, now)) {
      return true;
    }
    if (this.game.monster_ability_system.can_use_special(monster, target)) {
      return this.game.monster_ability_system.use_special(monster, target, now);
    }
    if (distance <= 1.25) {
      return this.game.combat_system.monster_attack(monster, target, now);
    }

    return this.move_toward(monster, target, now);
  }

  take_tank_turn(monster, target, now) {
    if (distance_between(monster, target) <= 1.25) {
      if (this.should_use_special(monster, target)) {
        return this.game.monster_ability_system.use_special(monster, target, now);
      }
      return this.game.combat_system.monster_attack(monster, target, now);
    }

    return this.move_toward(monster, target, now);
  }

  should_use_special(monster, target) {
    if (!this.game.monster_ability_system.can_use_special(monster, target)) {
      return false;
    }

    const chance = monster.special_ability?.use_chance ?? 0;
    return this.game.dungeon.random.chance(chance);
  }

  move_toward(monster, target, now) {
    const next_step = find_next_step(
      this.game.dungeon.grid,
      { x: monster.grid_x, y: monster.grid_y },
      { x: target.grid_x, y: target.grid_y },
      (x, y) => this.game.is_tile_blocked(x, y, monster.entity_id)
    );

    if (!next_step) {
      return false;
    }

    return this.game.movement_system.try_move(
      monster,
      { x: next_step.x - monster.grid_x, y: next_step.y - monster.grid_y },
      now
    );
  }

  try_retreat(monster, target, now) {
    const candidates = cardinal_directions
      .map((direction) => ({
        direction,
        x: monster.grid_x + direction.x,
        y: monster.grid_y + direction.y
      }))
      .filter((position) =>
        this.game.dungeon.grid.is_walkable(position.x, position.y) &&
        !this.game.is_tile_blocked(position.x, position.y, monster.entity_id)
      )
      .sort((a, b) => {
        const distance_a = Math.hypot(a.x - target.grid_x, a.y - target.grid_y);
        const distance_b = Math.hypot(b.x - target.grid_x, b.y - target.grid_y);
        return distance_b - distance_a;
      });

    const retreat = candidates[0];
    if (!retreat) {
      return false;
    }

    const current_distance = distance_between(monster, target);
    const retreat_distance = Math.hypot(retreat.x - target.grid_x, retreat.y - target.grid_y);
    if (retreat_distance <= current_distance) {
      return false;
    }

    return this.game.movement_system.try_move(monster, retreat.direction, now);
  }

  find_target(monster) {
    const targets = [this.game.player, ...this.game.get_living_companions()].filter((entity) => entity.alive);
    if (monster.ai_profile === "glass_cannon") {
      return targets.sort((a, b) => {
        const health_ratio_difference = (a.health / a.maximum_health) - (b.health / b.maximum_health);
        return health_ratio_difference || distance_between(monster, a) - distance_between(monster, b);
      })[0] ?? null;
    }
    if (monster.ai_profile === "bruiser") {
      return targets.sort((a, b) => a.defence - b.defence || distance_between(monster, a) - distance_between(monster, b))[0] ?? null;
    }

    return targets.sort((a, b) => distance_between(monster, a) - distance_between(monster, b))[0] ?? null;
  }
}
