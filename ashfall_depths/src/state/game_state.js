import { InventoryState } from "./inventory_state.js";
import { PartyState } from "./party_state.js";

export class GameState {
  constructor() {
    this.floor = 1;
    this.gold = 0;
    this.turn_count = 0;
    this.defeated_monsters = 0;
    this.unlocked_character_ids = ["hero"];
    this.inventory = new InventoryState();
    this.party = new PartyState();
    this.settings = {
      master_volume: 0.8,
      screen_shake: true,
      show_grid_coordinates: false
    };
  }

  to_json() {
    return {
      floor: this.floor,
      gold: this.gold,
      turn_count: this.turn_count,
      defeated_monsters: this.defeated_monsters,
      unlocked_character_ids: [...this.unlocked_character_ids],
      inventory: this.inventory.to_json(),
      party: this.party.to_json(),
      settings: { ...this.settings }
    };
  }

  load(data) {
    if (!data) {
      return;
    }
    this.floor = Number(data.floor) || 1;
    this.gold = Number(data.gold) || 0;
    this.turn_count = Math.max(0, Number(data.turn_count) || 0);
    this.defeated_monsters = Number(data.defeated_monsters) || 0;
    this.unlocked_character_ids = Array.isArray(data.unlocked_character_ids) ? [...data.unlocked_character_ids] : ["hero"];
    this.inventory.load(data.inventory);
    this.party.load(data.party);
    this.settings = { ...this.settings, ...(data.settings ?? {}) };
  }
}
