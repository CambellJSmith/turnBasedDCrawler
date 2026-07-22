import { distance_between } from "../utils/math.js";

export class MonsterAbilitySystem {
  constructor(game) {
    this.game = game;
  }

  can_use_special(monster, target) {
    const ability = monster.special_ability;
    if (!monster.alive || !target?.alive || !ability) {
      return false;
    }

    if (monster.magic < ability.magic_cost) {
      return false;
    }

    return distance_between(monster, target) <= ability.range;
  }

  use_special(monster, target, now) {
    const ability = monster.special_ability;
    if (!this.can_use_special(monster, target)) {
      return false;
    }

    monster.magic -= ability.magic_cost;
    const scaling_stat = ability.scaling === "attack" ? monster.attack : monster.magic_power;
    const raw_damage = ability.power + Math.floor(scaling_stat * ability.scale);
    const damage_reduction = Math.floor(target.defence * ability.defence_scale);
    const damage = Math.max(1, raw_damage - damage_reduction);

    this.game.combat_system.apply_damage(target, damage, monster, now);
    this.game.add_effect(ability.effect, target.grid_x, target.grid_y);
    this.game.add_log(`${monster.name} uses ${ability.name} for ${damage}`);

    if (target.type === "player" && target.health <= 0) {
      this.game.handle_player_defeat();
    }

    return true;
  }
}
