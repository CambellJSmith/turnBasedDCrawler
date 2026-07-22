import { HudController } from "./hud_controller.js";

const original_get_phase_text = HudController.prototype.get_phase_text;

HudController.prototype.get_phase_text = function get_phase_text_with_level_up() {
  if (this.game.level_up_controller?.is_open()) {
    return "choose an upgrade";
  }
  return original_get_phase_text.call(this);
};
