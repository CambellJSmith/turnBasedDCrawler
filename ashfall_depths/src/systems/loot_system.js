import { create_ground_item } from "../entities/entity_factory.js";
import { item_database } from "../data/items.js";

export class LootSystem {
  constructor(game) {
    this.game = game;
  }

  roll_monster_drop(monster, monster_data) {
    if (!monster_data.loot_table.length || !this.game.dungeon.random.chance(0.48)) {
      return;
    }
    const item_id = this.game.dungeon.random.pick(monster_data.loot_table);
    this.game.entities.push(create_ground_item(item_id, monster.grid_x, monster.grid_y));
    this.game.add_log(`${item_database[item_id].name} drops to the ground`);
  }

  collect_items_at_player() {
    const ground_items = this.game.entities.filter((entity) =>
      entity.alive && entity.type === "ground_item" && entity.grid_x === this.game.player.grid_x && entity.grid_y === this.game.player.grid_y
    );
    if (ground_items.length === 0) {
      return false;
    }
    for (const ground_item of ground_items) {
      this.game.state.inventory.add_item(ground_item.item_id);
      ground_item.alive = false;
      this.game.add_log(`collected ${item_database[ground_item.item_id].name}`);
    }
    return true;
  }
}
