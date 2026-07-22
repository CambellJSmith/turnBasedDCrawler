import { distance_between } from "../utils/math.js";
import { find_next_step } from "../world/pathfinding.js";

export class CompanionAiSystem {
  constructor(game) {
    this.game = game;
  }

  take_turn(companion, now) {
    if (!companion.alive) {
      return false;
    }

    const monster = this.game.get_living_monsters()
      .sort((a, b) => distance_between(companion, a) - distance_between(companion, b))[0];

    if (monster && distance_between(companion, monster) <= 1.25) {
      return this.game.combat_system.companion_attack(companion, monster, now);
    }

    const target = monster && distance_between(companion, monster) <= 5 ? monster : this.game.player;
    if (target === this.game.player && distance_between(companion, target) <= 2.2) {
      return false;
    }

    const next_step = find_next_step(
      this.game.dungeon.grid,
      { x: companion.grid_x, y: companion.grid_y },
      { x: target.grid_x, y: target.grid_y },
      (x, y) => this.game.is_tile_blocked(x, y, companion.entity_id)
    );

    if (!next_step) {
      return false;
    }

    return this.game.movement_system.try_move(
      companion,
      { x: next_step.x - companion.grid_x, y: next_step.y - companion.grid_y },
      now
    );
  }
}
