import { key_bindings } from "../config/input_config.js";
import { GamepadInputSystem } from "./gamepad_input_system.js";

export class InputSystem {
  constructor(game) {
    this.game = game;
    this.pressed_actions = [];
    this.on_key_down = this.on_key_down.bind(this);
    window.addEventListener("keydown", this.on_key_down);
    this.gamepad_input_system = new GamepadInputSystem((action) => this.queue_action(action));
  }

  update(now) {
    this.gamepad_input_system.update(now);
  }

  on_key_down(event) {
    const action = key_bindings[event.code];
    if (!action) {
      return;
    }
    event.preventDefault();
    if (!event.repeat || action.startsWith("move_")) {
      this.queue_action(action);
    }
  }

  queue_action(action) {
    if (!this.pressed_actions.includes(action)) {
      this.pressed_actions.push(action);
    }
  }

  consume_actions() {
    return this.pressed_actions.splice(0);
  }
}
