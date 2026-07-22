export class HudController {
  constructor(game) {
    this.game = game;
    this.health_fill = document.querySelector("#health_fill");
    this.magic_fill = document.querySelector("#magic_fill");
    this.health_text = document.querySelector("#health_text");
    this.magic_text = document.querySelector("#magic_text");
    this.floor_text = document.querySelector("#floor_text");
    this.gold_text = document.querySelector("#gold_text");
    this.team_text = document.querySelector("#team_text");
    this.level_text = document.querySelector("#level_text");
    this.experience_text = document.querySelector("#experience_text");
    this.turn_text = document.querySelector("#turn_text");
    this.phase_text = document.querySelector("#phase_text");
    this.interaction_prompt = document.querySelector("#interaction_prompt");
  }

  update() {
    const player = this.game.player;
    this.health_fill.style.width = `${(player.health / player.maximum_health) * 100}%`;
    this.magic_fill.style.width = `${(player.magic / player.maximum_magic) * 100}%`;
    this.health_text.textContent = `${player.health} / ${player.maximum_health}`;
    this.magic_text.textContent = `${player.magic} / ${player.maximum_magic}`;
    this.floor_text.textContent = `floor ${this.game.state.floor}`;
    this.gold_text.textContent = `gold ${this.game.state.gold}`;
    this.team_text.textContent = `team ${this.game.state.party.member_ids.length}`;
    this.level_text.textContent = `level ${this.game.state.player_level}`;
    const required_experience = this.game.player_progression_system?.get_experience_requirement() ?? 0;
    this.experience_text.textContent = `xp ${this.game.state.player_experience} / ${required_experience}`;
    this.turn_text.textContent = `turn ${this.game.state.turn_count}`;
    this.phase_text.textContent = this.get_phase_text();

    const prompt = this.game.interaction_system.get_prompt();
    this.interaction_prompt.hidden = !prompt;
    this.interaction_prompt.textContent = prompt;
  }

  get_phase_text() {
    if (!this.game.player.alive) {
      return "defeated";
    }
    if (this.game.paused) {
      return "menu · time stopped";
    }
    if (this.game.turn_system.turn_in_progress) {
      return `${this.game.turn_system.phase} acting`;
    }
    return "your turn";
  }
}
