import { game_config } from "../config/game_config.js";

export class ResourceRecoverySystem {
  constructor(game) {
    this.game = game;
  }

  recover_all_actors_after_turn() {
    const actors = [
      this.game.player,
      ...this.game.get_living_companions(),
      ...this.game.get_living_monsters()
    ];

    for (const entity of actors) {
      if (!entity?.alive) {
        continue;
      }

      this.recover_health(entity);
      this.recover_magic(entity);
    }
  }

  recover_health(entity) {
    if (!Number.isFinite(entity.health) || !Number.isFinite(entity.maximum_health)) {
      return;
    }

    entity.health = Math.min(
      entity.maximum_health,
      entity.health + game_config.health_recovery_per_turn
    );
  }

  recover_magic(entity) {
    if (!Number.isFinite(entity.magic) || !Number.isFinite(entity.maximum_magic)) {
      return;
    }

    entity.magic = Math.min(
      entity.maximum_magic,
      entity.magic + game_config.magic_recovery_per_turn
    );
  }
}
