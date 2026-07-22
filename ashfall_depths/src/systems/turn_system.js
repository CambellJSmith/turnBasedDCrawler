export class TurnSystem {
  constructor(game) {
    this.game = game;
    this.turn_in_progress = false;
    this.phase = "player";
  }

  try_player_action(action, options = {}) {
    if (!this.can_player_act()) {
      return false;
    }

    const now = performance.now();
    const action_performed = action(now);
    if (!action_performed) {
      return false;
    }

    this.commit_player_action(now, options);
    return true;
  }

  commit_player_action(now = performance.now(), options = {}) {
    if (this.turn_in_progress || !this.game.player.alive) {
      return false;
    }

    this.turn_in_progress = true;
    this.game.state.turn_count += 1;

    if (!options.skip_non_player_turns) {
      this.resolve_companion_phase(now);
      this.resolve_monster_phase(now);
    }

    this.phase = this.game.player.alive ? "resolving" : "defeat";
    return true;
  }

  resolve_companion_phase(now) {
    this.phase = "companions";
    const companions = [...this.game.get_living_companions()];
    for (const companion of companions) {
      if (companion.alive) {
        this.game.companion_ai_system.take_turn(companion, now);
      }
    }
  }

  resolve_monster_phase(now) {
    this.phase = "monsters";
    const monsters = [...this.game.get_living_monsters()];
    for (const monster of monsters) {
      if (!this.game.player.alive) {
        break;
      }
      if (monster.alive) {
        this.game.enemy_ai_system.take_turn(monster, now);
      }
    }
  }

  update() {
    if (!this.turn_in_progress || this.has_active_movement()) {
      return;
    }

    if (this.game.player.alive) {
      this.phase = "recovery";
      this.game.resource_recovery_system.recover_all_actors_after_turn();
    }

    this.turn_in_progress = false;
    this.phase = this.game.player.alive ? "player" : "defeat";
  }

  can_player_act() {
    return !this.game.paused && !this.turn_in_progress && this.game.player.alive;
  }

  has_active_movement() {
    return this.game.entities.some((entity) => entity.alive && entity.moving);
  }
}
