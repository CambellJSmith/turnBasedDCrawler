import {
  calculate_monster_experience,
  experience_required_for_level,
  player_progression_config
} from "../config/player_progression.js";
import {
  get_player_upgrade_rank,
  player_upgrade_definitions,
  player_upgrade_database
} from "../data/player_upgrades.js";

const health_per_upgrade = 12;
const magic_per_upgrade = 7;
const attack_per_upgrade = 2;
const defence_per_upgrade = 1;

export class PlayerProgressionSystem {
  constructor(game) {
    this.game = game;
  }

  get_experience_requirement() {
    return experience_required_for_level(this.game.state.player_level);
  }

  apply_to_player(player, saved_vitals = null) {
    const base_health = player.base_maximum_health ?? player.maximum_health;
    const base_magic = player.base_maximum_magic ?? player.maximum_magic;
    const base_attack = player.base_attack ?? player.attack;
    const base_defence = player.base_defence ?? player.defence;
    const base_magic_power = player.base_magic_power ?? player.magic_power;
    const legacy_levels = Math.max(0, this.game.state.legacy_completed_levels || 0);

    player.base_maximum_health = base_health;
    player.base_maximum_magic = base_magic;
    player.base_attack = base_attack;
    player.base_defence = base_defence;
    player.base_magic_power = base_magic_power;

    player.maximum_health = base_health +
      legacy_levels * player_progression_config.health_per_level +
      get_player_upgrade_rank(this.game.state, "maximum_health") * health_per_upgrade;
    player.maximum_magic = base_magic +
      legacy_levels * player_progression_config.magic_per_level +
      get_player_upgrade_rank(this.game.state, "maximum_magic") * magic_per_upgrade;
    player.attack = base_attack + get_player_upgrade_rank(this.game.state, "attack") * attack_per_upgrade;
    player.defence = base_defence + get_player_upgrade_rank(this.game.state, "defence") * defence_per_upgrade;
    player.magic_power = base_magic_power;

    const saved_health = Number(saved_vitals?.health);
    const saved_magic = Number(saved_vitals?.magic);
    player.health = Number.isFinite(saved_health)
      ? Math.max(1, Math.min(player.maximum_health, saved_health))
      : player.maximum_health;
    player.magic = Number.isFinite(saved_magic)
      ? Math.max(0, Math.min(player.maximum_magic, saved_magic))
      : player.maximum_magic;
  }

  award_for_monster(monster) {
    const base_experience = calculate_monster_experience(monster);
    const bonus_rank = get_player_upgrade_rank(this.game.state, "bonus_experience");
    const experience = Math.max(1, Math.round(base_experience * (1 + bonus_rank * 0.15)));
    this.game.state.player_experience += experience;
    this.game.add_log(`${monster.name} yields ${experience} xp`);

    let levels_gained = 0;
    while (this.game.state.player_experience >= this.get_experience_requirement()) {
      const required_experience = this.get_experience_requirement();
      this.game.state.player_experience -= required_experience;
      this.level_up();
      levels_gained += 1;
    }

    return { experience, levels_gained };
  }

  level_up() {
    this.game.state.player_level += 1;
    this.game.state.pending_level_choices += 1;
    this.game.add_effect("heal", this.game.player.grid_x, this.game.player.grid_y);
    this.game.add_log(`level ${this.game.state.player_level} · choose a permanent upgrade`);
    this.game.level_up_controller?.show_next_choice();
  }

  get_upgrade_choices(count = 3) {
    const available = player_upgrade_definitions.filter((definition) =>
      get_player_upgrade_rank(this.game.state, definition.id) < definition.maximum_rank
    );
    const pool = [...available];
    const choices = [];
    while (pool.length > 0 && choices.length < count) {
      const index = this.game.dungeon.random.integer(0, pool.length - 1);
      choices.push(pool.splice(index, 1)[0]);
    }
    return choices;
  }

  choose_upgrade(upgrade_id) {
    const definition = player_upgrade_database[upgrade_id];
    if (!definition || this.game.state.pending_level_choices <= 0) {
      return false;
    }

    const old_health = this.game.player.health;
    const old_magic = this.game.player.magic;
    const old_maximum_health = this.game.player.maximum_health;
    const old_maximum_magic = this.game.player.maximum_magic;
    const current_rank = get_player_upgrade_rank(this.game.state, upgrade_id);
    if (current_rank >= definition.maximum_rank) {
      return false;
    }

    this.game.state.player_upgrade_ranks[upgrade_id] = current_rank + 1;
    this.apply_to_player(this.game.player, { health: old_health, magic: old_magic });
    this.game.player.health = Math.min(
      this.game.player.maximum_health,
      this.game.player.health + Math.max(0, this.game.player.maximum_health - old_maximum_health)
    );
    this.game.player.magic = Math.min(
      this.game.player.maximum_magic,
      this.game.player.magic + Math.max(0, this.game.player.maximum_magic - old_maximum_magic)
    );
    this.game.state.pending_level_choices -= 1;
    this.game.add_log(`${definition.name} rank ${current_rank + 1} acquired`);
    this.game.save_manager.save(this.game);

    if (this.game.state.pending_level_choices > 0) {
      this.game.level_up_controller?.show_next_choice();
    } else {
      this.game.level_up_controller?.hide();
      this.game.paused = false;
    }
    return true;
  }
}

export function install_player_progression(game, saved_vitals = null) {
  const progression_system = new PlayerProgressionSystem(game);
  game.player_progression_system = progression_system;
  progression_system.apply_to_player(game.player, saved_vitals);

  const generate_floor = game.generate_floor.bind(game);
  game.generate_floor = () => {
    const pending_vitals = game.pending_player_vitals ?? null;
    game.pending_player_vitals = null;
    const result = generate_floor();
    progression_system.apply_to_player(game.player, pending_vitals);
    return result;
  };

  if (game.state.pending_level_choices > 0) {
    queueMicrotask(() => game.level_up_controller?.show_next_choice());
  }

  return progression_system;
}
