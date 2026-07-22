import { input_actions } from "../config/input_config.js";
import { get_player_upgrade_rank } from "../data/player_upgrades.js";

export class LevelUpController {
  constructor(game) {
    this.game = game;
    this.overlay = document.querySelector("#level_up_overlay");
    this.level_text = document.querySelector("#level_up_level");
    this.remaining_text = document.querySelector("#level_up_remaining");
    this.choices_container = document.querySelector("#level_up_choices");
    this.choices = [];
    this.selected_index = 0;

    this.choices_container?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-upgrade-id]");
      if (button) {
        this.choose(button.dataset.upgradeId);
      }
    });
  }

  is_open() {
    return Boolean(this.overlay && !this.overlay.hidden);
  }

  show_next_choice() {
    if (!this.overlay || this.game.state.pending_level_choices <= 0) {
      return false;
    }

    this.choices = this.game.player_progression_system?.get_upgrade_choices(3) ?? [];
    if (this.choices.length === 0) {
      this.game.state.pending_level_choices = 0;
      this.hide();
      if (this.game.player.alive && !this.game.game_over_controller?.is_open()) {
        this.game.paused = false;
      }
      return false;
    }

    this.selected_index = 0;
    this.game.paused = true;
    this.overlay.hidden = false;
    this.level_text.textContent = `level ${this.game.state.player_level}`;
    this.remaining_text.textContent = this.game.state.pending_level_choices > 1
      ? `${this.game.state.pending_level_choices} upgrade choices waiting`
      : "choose one permanent upgrade";
    this.render_choices();
    return true;
  }

  render_choices() {
    if (!this.choices_container) {
      return;
    }
    this.choices_container.replaceChildren();
    this.choices.forEach((choice, index) => {
      const rank = get_player_upgrade_rank(this.game.state, choice.id);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "level_up_choice";
      button.dataset.upgradeId = choice.id;
      button.setAttribute("aria-pressed", index === this.selected_index ? "true" : "false");

      const number = document.createElement("span");
      number.className = "level_up_choice_number";
      number.textContent = `${index + 1}`;
      const name = document.createElement("strong");
      name.textContent = choice.name;
      const rank_text = document.createElement("span");
      rank_text.className = "level_up_choice_rank";
      rank_text.textContent = `rank ${rank} → ${rank + 1}`;
      const description = document.createElement("span");
      description.className = "level_up_choice_description";
      description.textContent = choice.description;

      button.append(number, name, rank_text, description);
      this.choices_container.append(button);
    });
  }

  handle_input(action) {
    if (!this.is_open() || this.choices.length === 0) {
      return false;
    }
    if (action === input_actions.move_north || action === input_actions.move_west) {
      this.selected_index = (this.selected_index - 1 + this.choices.length) % this.choices.length;
      this.render_choices();
      return true;
    }
    if (action === input_actions.move_south || action === input_actions.move_east) {
      this.selected_index = (this.selected_index + 1) % this.choices.length;
      this.render_choices();
      return true;
    }
    if (action === input_actions.spell_1) {
      return this.choose(this.choices[0]?.id);
    }
    if (action === input_actions.spell_2) {
      return this.choose(this.choices[1]?.id);
    }
    if (action === input_actions.spell_3) {
      return this.choose(this.choices[2]?.id);
    }
    if (action === input_actions.confirm || action === input_actions.interact || action === input_actions.attack) {
      return this.choose(this.choices[this.selected_index]?.id);
    }
    return false;
  }

  choose(upgrade_id) {
    if (!upgrade_id) {
      return false;
    }
    return this.game.player_progression_system?.choose_upgrade(upgrade_id) ?? false;
  }

  hide() {
    if (this.overlay) {
      this.overlay.hidden = true;
    }
    this.choices = [];
  }
}
