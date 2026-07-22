import assert from "node:assert/strict";
import { GameOverController } from "../src/ui/game_over_controller.js";

let click_handler = null;
let focused = false;
let save_cleared = false;
let page_reloaded = false;

const overlay = { hidden: true };
const restart_button = {
  disabled: false,
  addEventListener(type, handler) {
    if (type === "click") {
      click_handler = handler;
    }
  },
  focus() {
    focused = true;
  }
};

globalThis.document = {
  querySelector(selector) {
    if (selector === "#game_over_overlay") {
      return overlay;
    }
    if (selector === "#wipe_restart_game") {
      return restart_button;
    }
    return null;
  }
};

globalThis.window = {
  location: {
    reload() {
      page_reloaded = true;
    }
  }
};

const game = {
  save_manager: {
    clear() {
      save_cleared = true;
    }
  }
};

const controller = new GameOverController(game);
assert.equal(typeof click_handler, "function", "restart button should be wired");
controller.show();
assert.equal(overlay.hidden, false, "game over overlay should be shown");
assert.equal(focused, true, "restart button should receive focus");

click_handler();
assert.equal(restart_button.disabled, true, "restart button should lock after activation");
assert.equal(save_cleared, true, "restart must clear saved progress");
assert.equal(page_reloaded, true, "restart must reload into a fresh run");

console.log("game over controller tests passed");
