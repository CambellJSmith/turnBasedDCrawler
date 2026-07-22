import { gamepad_config, input_actions, xbox_button_bindings } from "../config/input_config.js";

const direction_actions = new Set([
  input_actions.move_north,
  input_actions.move_south,
  input_actions.move_west,
  input_actions.move_east
]);

export class GamepadInputSystem {
  constructor(queue_action) {
    this.queue_action = queue_action;
    this.controller_states = new Map();
    this.status_element = document.querySelector("#gamepad_status");
    this.connected_count = 0;
    this.on_connected = this.on_connected.bind(this);
    this.on_disconnected = this.on_disconnected.bind(this);
    window.addEventListener("gamepadconnected", this.on_connected);
    window.addEventListener("gamepaddisconnected", this.on_disconnected);
    this.refresh_status();
  }

  update(now) {
    const gamepads = navigator.getGamepads?.() ?? [];
    let connected_count = 0;

    for (const gamepad of gamepads) {
      if (!gamepad) {
        continue;
      }
      connected_count += 1;
      this.poll_gamepad(gamepad, now);
    }

    if (connected_count === 0 && this.controller_states.size > 0) {
      this.controller_states.clear();
    }
    if (connected_count !== this.connected_count) {
      this.connected_count = connected_count;
      this.refresh_status();
    }
  }

  poll_gamepad(gamepad, now) {
    const state = this.get_controller_state(gamepad.index);
    const current_buttons = new Set();

    for (const [button_index_text, action] of Object.entries(xbox_button_bindings)) {
      const button_index = Number(button_index_text);
      const button = gamepad.buttons[button_index];
      if (!button?.pressed && (button?.value ?? 0) < 0.5) {
        continue;
      }
      current_buttons.add(button_index);
      if (!state.pressed_buttons.has(button_index) && !direction_actions.has(action)) {
        this.queue_action(action);
      }
    }

    const direction = this.read_direction(gamepad, current_buttons);
    this.update_direction_repeat(state, direction, now);
    state.pressed_buttons = current_buttons;
    state.id = gamepad.id;
  }

  read_direction(gamepad, current_buttons) {
    if (current_buttons.has(12)) {
      return input_actions.move_north;
    }
    if (current_buttons.has(13)) {
      return input_actions.move_south;
    }
    if (current_buttons.has(14)) {
      return input_actions.move_west;
    }
    if (current_buttons.has(15)) {
      return input_actions.move_east;
    }

    const horizontal = gamepad.axes[0] ?? 0;
    const vertical = gamepad.axes[1] ?? 0;
    if (Math.abs(horizontal) < gamepad_config.axis_deadzone && Math.abs(vertical) < gamepad_config.axis_deadzone) {
      return "";
    }
    if (Math.abs(horizontal) > Math.abs(vertical)) {
      return horizontal < 0 ? input_actions.move_west : input_actions.move_east;
    }
    return vertical < 0 ? input_actions.move_north : input_actions.move_south;
  }

  update_direction_repeat(state, direction, now) {
    if (!direction) {
      state.direction = "";
      state.next_direction_at = 0;
      return;
    }
    if (state.direction !== direction) {
      state.direction = direction;
      state.next_direction_at = now + gamepad_config.direction_repeat_delay_ms;
      this.queue_action(direction);
      return;
    }
    if (now >= state.next_direction_at) {
      state.next_direction_at = now + gamepad_config.direction_repeat_interval_ms;
      this.queue_action(direction);
    }
  }

  get_controller_state(index) {
    if (!this.controller_states.has(index)) {
      this.controller_states.set(index, {
        id: "",
        pressed_buttons: new Set(),
        direction: "",
        next_direction_at: 0
      });
    }
    return this.controller_states.get(index);
  }

  on_connected(event) {
    this.get_controller_state(event.gamepad.index).id = event.gamepad.id;
    this.refresh_status();
  }

  on_disconnected(event) {
    this.controller_states.delete(event.gamepad.index);
    this.connected_count = Math.max(0, this.connected_count - 1);
    this.refresh_status();
  }

  refresh_status() {
    if (!this.status_element) {
      return;
    }
    const gamepads = navigator.getGamepads?.() ?? [];
    const connected_gamepad = [...gamepads].find(Boolean);
    this.status_element.textContent = connected_gamepad ? "xbox controller connected" : "controller ready · press any button";
    this.status_element.classList.toggle("connected", Boolean(connected_gamepad));
  }
}
