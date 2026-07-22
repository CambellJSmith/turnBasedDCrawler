import { monster_database } from "../data/monsters.js";
import { item_database } from "../data/items.js";
import { distance_between } from "../utils/math.js";

export class CombatSystem {
  constructor(game) {
    this.game = game;
  }

  player_attack(now) {
    if (!this.game.player.alive || this.game.player.moving) {
      return false;
    }

    const candidates = this.game.get_living_monsters()
      .filter((monster) => distance_between(this.game.player, monster) <= 1.25)
      .sort((a, b) => distance_between(this.game.player, a) - distance_between(this.game.player, b));
    const target = candidates[0];

    if (!target) {
      this.game.add_log("your weapon cuts through empty air");
      return true;
    }

    const weapon = item_database[this.game.state.inventory.equipped_weapon_id];
    const damage = Math.max(1, this.game.player.attack + (weapon?.attack_bonus ?? 0) - target.defence);
    this.apply_damage(target, damage, this.game.player, now);
    return true;
  }

  companion_attack(companion, target, now) {
    if (!companion.alive || !target.alive) {
      return false;
    }

    const damage = Math.max(1, companion.attack - target.defence);
    this.apply_damage(target, damage, companion, now);
    return true;
  }

  monster_attack(monster, target, now) {
    if (!monster.alive || !target.alive) {
      return false;
    }

    const damage = Math.max(1, monster.attack - target.defence);
    this.apply_damage(target, damage, monster, now);
    if (target.type === "player") {
      this.game.add_log(`${monster.name} hits you for ${damage}`);
      if (target.health <= 0) {
        this.game.handle_player_defeat();
      }
    }
    return true;
  }

  apply_damage(target, amount, source, now) {
    target.health = Math.max(0, target.health - amount);
    target.flash_until = now + 120;
    this.game.spawn_combat_text(target.grid_x, target.grid_y, `-${amount}`);
    if (target.type === "monster") {
      this.game.add_log(`${source.name} deals ${amount} to ${target.name}`);
    }
    if (target.health <= 0 && target.alive) {
      this.defeat_entity(target);
    }
  }

  defeat_entity(entity) {
    entity.alive = false;
    if (entity.type === "monster") {
      const data = monster_database[entity.monster_id];
      const gold = this.game.dungeon.random.integer(data.gold_min, data.gold_max);
      this.game.state.gold += gold;
      this.game.state.defeated_monsters += 1;
      this.game.add_log(`${entity.name} falls · ${gold} gold`);
      this.game.loot_system.roll_monster_drop(entity, data);
    }
    if (entity.type === "companion") {
      this.game.add_log(`${entity.name} has fallen for this floor`);
    }
  }
}
