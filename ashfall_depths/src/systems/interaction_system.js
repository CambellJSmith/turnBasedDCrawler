import { distance_between } from "../utils/math.js";

export class InteractionSystem {
  constructor(game) {
    this.game = game;
  }

  interact() {
    if (this.game.loot_system.collect_items_at_player()) {
      return { consumes_turn: true, skip_non_player_turns: false };
    }

    const recruitable = this.game.recruitment_system.get_nearby_recruitable();
    if (recruitable) {
      this.game.dialogue_controller.show_sequence(
        recruitable.name,
        recruitable.dialogue,
        () => {
          if (this.game.recruitment_system.recruit(recruitable)) {
            this.game.turn_system.commit_player_action();
            this.game.save_manager.save(this.game);
          }
        }
      );
      return { consumes_turn: false, deferred: true };
    }

    const tile = this.game.dungeon.grid.get_tile(this.game.player.grid_x, this.game.player.grid_y);
    if (tile?.terrain_id === "exit") {
      this.game.advance_floor();
      return { consumes_turn: true, skip_non_player_turns: true };
    }

    const nearby_item = this.game.entities.find((entity) =>
      entity.alive && entity.type === "ground_item" && distance_between(this.game.player, entity) <= 1.5
    );
    if (nearby_item) {
      this.game.add_log("stand on the item and press e or xbox a to collect it");
      return { consumes_turn: false };
    }

    this.game.add_log("nothing here responds");
    return { consumes_turn: false };
  }

  get_prompt() {
    const ground_item = this.game.entities.find((entity) =>
      entity.alive && entity.type === "ground_item" && entity.grid_x === this.game.player.grid_x && entity.grid_y === this.game.player.grid_y
    );
    if (ground_item) {
      return `press e or xbox a to collect ${ground_item.name} · consumes a turn`;
    }
    const recruitable = this.game.recruitment_system.get_nearby_recruitable();
    if (recruitable) {
      return `press e or xbox a to speak with ${recruitable.name}`;
    }
    const tile = this.game.dungeon.grid.get_tile(this.game.player.grid_x, this.game.player.grid_y);
    if (tile?.terrain_id === "exit") {
      return "press e or xbox a to descend · remaining enemies are optional";
    }
    return "";
  }
}
