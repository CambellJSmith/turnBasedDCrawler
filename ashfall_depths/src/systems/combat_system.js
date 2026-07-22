import { get_player_upgrade_rank } from "../data/player_upgrades.js";
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
      this.defeat_entity(target, source);
    }
  }

  defeat_entity(entity, source = null) {
    entity.alive = false;
    if (entity.type === "monster") {
      const data = monster_database[entity.monster_id];
      const gold = this.game.dungeon.random.integer(data.gold_min, data.gold_max);
      this.game.state.gold += gold;
      this.game.state.defeated_monsters += 1;
      this.game.add_log(`${entity.name} falls · ${gold} gold`);
      this.game.player_progression_system?.award_for_monster(entity);

      const recruitment_rank = get_player_upgrade_rank(this.game.state, "recruitment_chance");
      const recruitment_chance = Math.min(0.35, 0.01 + recruitment_rank * 0.02);
      if (source?.type === "player" && this.game.dungeon.random.chance(recruitment_chance)) {
        this.revive_as_recruitable(entity);
      } else {
        this.game.loot_system.roll_monster_drop(entity, data);
      }
    }
    if (entity.type === "companion") {
      this.handle_permanent_companion_death(entity);
    }
  }

  handle_permanent_companion_death(companion) {
    const member_id = companion.character_id;
    const removed = this.game.state.party?.remove_member?.(member_id) ?? false;

    companion.permanently_dead = true;
    this.game.add_log(
      removed
        ? `${companion.name} has died and is permanently lost from the team`
        : `${companion.name} has died permanently`
    );

    if (removed) {
      this.game.save_manager?.save(this.game);
    }
    return removed;
  }

  revive_as_recruitable(entity) {
    entity.type = "recruitable";
    entity.character_id = `reformed_${entity.monster_id}_${entity.entity_id}`;
    entity.recruitment_kind = "monster";
    entity.recruited = false;
    entity.alive = true;
    entity.health = Math.max(1, Math.ceil(entity.maximum_health * 0.25));
    entity.magic = Math.max(0, Math.ceil(entity.maximum_magic * 0.25));
    entity.dialogue = [
      `${entity.name} drags itself back from death.`,
      "It lowers its weapon and offers its strength to your team.",
      "Accept this unlikely ally?"
    ];
    this.game.add_effect("heal", entity.grid_x, entity.grid_y);
    this.game.add_log(`${entity.name} returns from death and offers to join you`);
  }
}
