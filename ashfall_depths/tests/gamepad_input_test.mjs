const listeners = new Map();
const status_element = {
  textContent: "",
  classList: {
    toggle() {
    }
  }
};

globalThis.window = {
  addEventListener(type, callback) {
    listeners.set(type, callback);
  }
};

globalThis.document = {
  querySelector(selector) {
    return selector === "#gamepad_status" ? status_element : null;
  }
};

let connected_gamepads = [];
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    getGamepads() {
      return connected_gamepads;
    }
  }
});

const { GamepadInputSystem } = await import("../src/systems/gamepad_input_system.js");
const { input_actions } = await import("../src/config/input_config.js");
const actions = [];
const input_system = new GamepadInputSystem((action) => actions.push(action));
const gamepad = {
  index: 0,
  id: "Xbox Wireless Controller",
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }))
};

connected_gamepads = [gamepad];
listeners.get("gamepadconnected")?.({ gamepad });

gamepad.buttons[2] = { pressed: true, value: 1 };
input_system.update(0);
input_system.update(16);
assert_count(input_actions.attack, 1, "x must emit one attack per press");

gamepad.buttons[2] = { pressed: false, value: 0 };
input_system.update(32);
gamepad.buttons[2] = { pressed: true, value: 1 };
input_system.update(48);
assert_count(input_actions.attack, 2, "x must emit again after release");

gamepad.buttons[2] = { pressed: false, value: 0 };
gamepad.axes[0] = -0.9;
input_system.update(100);
input_system.update(250);
input_system.update(401);
assert_count(input_actions.move_west, 2, "held stick direction must repeat after its initial delay");

gamepad.axes[0] = 0;
gamepad.buttons[0] = { pressed: true, value: 1 };
input_system.update(450);
assert_count(input_actions.confirm, 1, "a must emit confirm");

gamepad.buttons[0] = { pressed: false, value: 0 };
gamepad.buttons[4] = { pressed: true, value: 1 };
input_system.update(500);
assert_count(input_actions.spell_1, 1, "lb must emit spell one");

gamepad.buttons[4] = { pressed: false, value: 0 };
gamepad.buttons[5] = { pressed: true, value: 1 };
input_system.update(550);
assert_count(input_actions.spell_2, 1, "rb must emit spell two");

gamepad.buttons[5] = { pressed: false, value: 0 };
gamepad.buttons[9] = { pressed: true, value: 1 };
input_system.update(600);
assert_count(input_actions.menu, 1, "menu button must emit menu");

console.log("gamepad input test passed");

function assert_count(action, expected_count, message) {
  const actual_count = actions.filter((candidate) => candidate === action).length;
  if (actual_count !== expected_count) {
    throw new Error(`${message}: expected ${expected_count}, received ${actual_count}`);
  }
}
