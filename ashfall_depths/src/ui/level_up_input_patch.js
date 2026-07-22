import { Game } from "../core/game.js";

const original_process_input = Game.prototype.process_input;

Game.prototype.process_input = function process_input_with_level_up_choices() {
  if (!this.level_up_controller?.is_open()) {
    return original_process_input.call(this);
  }

  const actions = this.input_system.consume_actions();
  for (const action of actions) {
    this.level_up_controller.handle_input(action);
  }
};
