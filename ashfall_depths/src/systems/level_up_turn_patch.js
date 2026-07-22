import { TurnSystem } from "./turn_system.js";

TurnSystem.prototype.resolve_companion_phase = function resolve_companions_until_level_up(now) {
  this.phase = "companions";
  if (this.game.state.pending_level_choices > 0) {
    this.phase = "level_up";
    return;
  }

  const companions = [...this.game.get_living_companions()];
  for (const companion of companions) {
    if (this.game.state.pending_level_choices > 0) {
      this.phase = "level_up";
      return;
    }
    if (companion.alive) {
      this.game.companion_ai_system.take_turn(companion, now);
    }
  }
};

TurnSystem.prototype.resolve_monster_phase = function resolve_monsters_until_level_up(now) {
  this.phase = "monsters";
  if (this.game.state.pending_level_choices > 0) {
    this.phase = "level_up";
    return;
  }

  const monsters = [...this.game.get_living_monsters()];
  for (const monster of monsters) {
    if (!this.game.player.alive || this.game.state.pending_level_choices > 0) {
      this.phase = this.game.state.pending_level_choices > 0 ? "level_up" : "defeat";
      break;
    }
    if (monster.alive) {
      this.game.enemy_ai_system.take_turn(monster, now);
    }
  }
};
