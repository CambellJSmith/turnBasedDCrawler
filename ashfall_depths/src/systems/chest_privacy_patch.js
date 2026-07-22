import { ChestSystem } from "./chest_system.js";

for (const method_name of ["pick_up_chest", "drop_carried_chest"]) {
  const original_method = ChestSystem.prototype[method_name];
  ChestSystem.prototype[method_name] = function perform_hidden_chest_transfer(...args) {
    const original_add_log = this.game.add_log;
    this.game.add_log = () => {};
    try {
      return original_method.apply(this, args);
    } finally {
      this.game.add_log = original_add_log;
    }
  };
}
