import { get_player_upgrade_rank } from "../data/player_upgrades.js";
import { spell_database } from "../data/spells.js";
import { distance_between } from "../utils/math.js";

export class MagicSystem {
  constructor(game) {
    this.game = game;
  }

  cast(spell_id, caster, now) {
    const spell = spell_database[spell_id];
    const magic_cost = this.get_magic_cost(spell, caster);
    if (!spell || caster.magic < magic_cost || !caster.alive) {
      this.game.add_log(spell ? `not enough magic for ${spell.name}` : "unknown spell");
      return false;
    }

    const output_multiplier = this.get_spell_output_multiplier(caster);

    if (spell.targeting === "nearest_enemy") {
      const target = this.game.get_living_monsters()
        .filter((monster) => distance_between(caster, monster) <= spell.range)
        .sort((a, b) => distance_between(caster, a) - distance_between(caster, b))[0];
      if (!target) {
        this.game.add_log("no enemy is within spell range");
        return false;
      }
      caster.magic -= magic_cost;
      const damage = Math.max(1, Math.round(
        (spell.power + Math.floor(caster.magic_power * 0.6)) * output_multiplier
      ));
      this.game.combat_system.apply_damage(target, damage, caster, now);
      this.game.add_effect("fire", target.grid_x, target.grid_y);
      this.game.add_log(`${caster.name} casts ${spell.name}`);
      return true;
    }

    if (spell.targeting === "self") {
      caster.magic -= magic_cost;
      const healing_power = Math.max(1, Math.round(
        (spell.power + Math.floor(caster.magic_power * 0.4)) * output_multiplier
      ));
      const restored = Math.min(healing_power, caster.maximum_health - caster.health);
      caster.health += restored;
      this.game.add_effect("heal", caster.grid_x, caster.grid_y);
      this.game.add_log(`${caster.name} restores ${restored} health`);
      return true;
    }

    if (spell.targeting === "area_self") {
      const targets = this.game.get_living_monsters().filter((monster) => distance_between(caster, monster) <= spell.range);
      if (targets.length === 0) {
        this.game.add_log("no enemies are close enough");
        return false;
      }
      caster.magic -= magic_cost;
      for (const target of targets) {
        const damage = Math.max(1, Math.round(
          (spell.power + Math.floor(caster.magic_power * 0.3)) * output_multiplier
        ));
        this.game.combat_system.apply_damage(target, damage, caster, now);
        this.game.add_effect("frost", target.grid_x, target.grid_y);
      }
      this.game.add_log(`${caster.name} casts ${spell.name}`);
      return true;
    }

    return false;
  }

  get_magic_cost(spell, caster) {
    if (!spell) {
      return Infinity;
    }
    if (caster !== this.game.player) {
      return spell.magic_cost;
    }
    const discount = get_player_upgrade_rank(this.game.state, "cheaper_spells");
    return Math.max(1, spell.magic_cost - discount);
  }

  get_spell_output_multiplier(caster) {
    if (caster !== this.game.player) {
      return 1;
    }
    return 1 + get_player_upgrade_rank(this.game.state, "stronger_spells") * 0.12;
  }
}
