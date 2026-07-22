export class InventoryState {
  constructor() {
    this.items = new Map([
      ["healing_potion", 2],
      ["mana_potion", 1]
    ]);
    this.equipped_weapon_id = null;
    this.equipped_accessory_id = null;
  }

  add_item(item_id, amount = 1) {
    this.items.set(item_id, (this.items.get(item_id) ?? 0) + amount);
  }

  remove_item(item_id, amount = 1) {
    const current_amount = this.items.get(item_id) ?? 0;
    if (current_amount < amount) {
      return false;
    }
    const next_amount = current_amount - amount;
    if (next_amount === 0) {
      this.items.delete(item_id);
    } else {
      this.items.set(item_id, next_amount);
    }
    return true;
  }

  get_amount(item_id) {
    return this.items.get(item_id) ?? 0;
  }

  to_json() {
    return {
      items: Object.fromEntries(this.items),
      equipped_weapon_id: this.equipped_weapon_id,
      equipped_accessory_id: this.equipped_accessory_id
    };
  }

  load(data) {
    this.items = new Map(Object.entries(data?.items ?? {}));
    this.equipped_weapon_id = data?.equipped_weapon_id ?? null;
    this.equipped_accessory_id = data?.equipped_accessory_id ?? null;
  }
}
