import { input_actions } from "../config/input_config.js";

export class DialogueController {
  constructor(game) {
    this.game = game;
    this.overlay = document.querySelector("#dialogue_overlay");
    this.name_element = document.querySelector("#dialogue_name");
    this.text_element = document.querySelector("#dialogue_text");
    this.continue_button = document.querySelector("#dialogue_continue");
    this.lines = [];
    this.line_index = 0;
    this.on_complete = null;
    this.continue_button.addEventListener("click", () => this.advance());
  }

  show_sequence(name, lines, on_complete) {
    this.name_element.textContent = name;
    this.lines = [...lines];
    this.line_index = 0;
    this.on_complete = on_complete;
    this.overlay.hidden = false;
    this.game.paused = true;
    this.text_element.textContent = this.lines[0] ?? "";
    this.continue_button.focus();
  }

  handle_input(action) {
    if ([input_actions.confirm, input_actions.cancel, input_actions.interact, input_actions.attack].includes(action)) {
      this.advance();
    }
  }

  advance() {
    this.line_index += 1;
    if (this.line_index < this.lines.length) {
      this.text_element.textContent = this.lines[this.line_index];
      return;
    }
    this.overlay.hidden = true;
    this.game.paused = !this.game.player.alive;
    const callback = this.on_complete;
    this.on_complete = null;
    callback?.();
  }
}
