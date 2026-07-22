import {
  calculate_monster_experience,
  experience_required_for_level,
  player_progression_config
} from "../config/player_progression.js";

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
    const completed_levels = Math.max(0, this.game.state.player_level - 1);

    player.base_maximum_health = base_health;
    player.base_maximum_magic = base_magic;
    player.maximum_health = base_health + completed_levels * player_progression_config.health_per_level;
    player.maximum_magic = base_magic + completed_levels * player_progression_config.magic_per_level;
    player.health = saved_vitals
      ? Math.max(1, Math.min(player.maximum_health, Number(saved_vitals.health) || player.maximum_health))
      : player.maximum_health;
    player.magic = saved_vitals
      ? Math.max(0, Math.min(player.maximum_magic, Number(saved_vitals.magic) || 0))
      : player.maximum_magic;
  }

  award_for_monster(monster) {
    const experience = calculate_monster_experience(monster);
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
    const old_health = this.game.player.health;
    const old_magic = this.game.player.magic;
    this.game.state.player_level += 1;
    this.apply_to_player(this.game.player, {
      health: old_health + player_progression_config.health_per_level,
      magic: old_magic + player_progression_config.magic_per_level
    });
    this.game.add_effect("heal", this.game.player.grid_x, this.game.player.grid_y);
    this.game.add_log(
      `level ${this.game.state.player_level} · maximum health +${player_progression_config.health_per_level} · maximum magic +${player_progression_config.magic_per_level}`
    );
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

  return progression_system;
}
