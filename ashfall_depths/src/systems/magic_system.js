import { spell_database } from "../data/spells.js";
import { distance_between } from "../utils/math.js";

export class MagicSystem {
  constructor(game) {
    this.game = game;
  }

  cast(spell_id, caster, now) {
    const spell = spell_database[spell_id];
    if (!spell || caster.magic < spell.magic_cost || !caster.alive) {
      this.game.add_log(spell ? `not enough magic for ${spell.name}` : "unknown spell");
      return false;
    }

    if (spell.targeting === "nearest_enemy") {
      const target = this.game.get_living_monsters()
        .filter((monster) => distance_between(caster, monster) <= spell.range)
        .sort((a, b) => distance_between(caster, a) - distance_between(caster, b))[0];
      if (!target) {
        this.game.add_log("no enemy is within spell range");
        return false;
      }
      caster.magic -= spell.magic_cost;
      const damage = spell.power + Math.floor(caster.magic_power * 0.6);
      this.game.combat_system.apply_damage(target, damage, caster, now);
      this.game.add_effect("fire", target.grid_x, target.grid_y);
      this.game.add_log(`${caster.name} casts ${spell.name}`);
      return true;
    }

    if (spell.targeting === "self") {
      caster.magic -= spell.magic_cost;
      const restored = Math.min(spell.power + Math.floor(caster.magic_power * 0.4), caster.maximum_health - caster.health);
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
      caster.magic -= spell.magic_cost;
      for (const target of targets) {
        const damage = spell.power + Math.floor(caster.magic_power * 0.3);
        this.game.combat_system.apply_damage(target, damage, caster, now);
        this.game.add_effect("frost", target.grid_x, target.grid_y);
      }
      this.game.add_log(`${caster.name} casts ${spell.name}`);
      return true;
    }

    return false;
  }
}
