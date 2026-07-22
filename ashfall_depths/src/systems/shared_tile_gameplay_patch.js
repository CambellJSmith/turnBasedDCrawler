import { Game } from "../core/game.js";
import { distance_between } from "../utils/math.js";
import { ChestSystem } from "./chest_system.js";
import { CompanionAiSystem } from "./companion_ai_system.js";
import { EnemyAiSystem } from "./enemy_ai_system.js";
import { InteractionSystem } from "./interaction_system.js";
import { MovementSystem } from "./movement_system.js";

const cardinal_directions = Object.freeze([
  Object.freeze({ x: 1, y: 0 }),
  Object.freeze({ x: -1, y: 0 }),
  Object.freeze({ x: 0, y: 1 }),
  Object.freeze({ x: 0, y: -1 })
]);

const actor_types = new Set(["player", "monster", "companion", "recruitable"]);
const impassable_terrain_ids = new Set(["wall", "void"]);
const lava_source = Object.freeze({ name: "lava", type: "environment" });

Game.prototype.is_tile_blocked = function is_tile_blocked_by_actor(x, y, ignored_entity_id = "") {
  return this.entities.some((entity) =>
    entity.alive &&
    actor_types.has(entity.type) &&
    entity.entity_id !== ignored_entity_id &&
    entity.grid_x === x &&
    entity.grid_y === y
  );
};

Game.prototype.can_actor_traverse = function can_actor_traverse(_actor, x, y) {
  const tile = this.dungeon?.grid?.get_tile(x, y);
  if (!tile || impassable_terrain_ids.has(tile.terrain_id)) {
    return false;
  }

  const closed_secret_wall = this.dungeon_object_system?.get_object_at(
    x,
    y,
    (object) => object.object_type === "secret_wall" && !object.open
  );
  return !closed_secret_wall;
};

MovementSystem.prototype.try_move = function try_move_across_shared_tiles(entity, direction, now) {
  if (!entity.alive || entity.moving) {
    return false;
  }

  const target_x = entity.grid_x + direction.x;
  const target_y = entity.grid_y + direction.y;
  const secret_wall = this.game.dungeon_object_system?.get_object_at(
    target_x,
    target_y,
    (object) => object.object_type === "secret_wall" && !object.open
  );

  if (secret_wall) {
    if (entity.type === "player") {
      return this.game.dungeon_object_system.reveal_secret_wall(secret_wall);
    }
    return false;
  }

  if (!this.game.can_actor_traverse(entity, target_x, target_y)) {
    return false;
  }

  const blocking_actor = this.game.entities.find((candidate) =>
    candidate.alive &&
    actor_types.has(candidate.type) &&
    candidate.entity_id !== entity.entity_id &&
    candidate.grid_x === target_x &&
    candidate.grid_y === target_y
  );

  if (blocking_actor) {
    if (entity.type === "player" && blocking_actor.type === "companion" && !blocking_actor.moving) {
      return this.swap_entities(entity, blocking_actor, now);
    }
    return false;
  }

  this.begin_move(entity, target_x, target_y, now);
  return true;
};

const original_begin_move = MovementSystem.prototype.begin_move;
MovementSystem.prototype.begin_move = function begin_move_with_shared_tile_hazards(entity, target_x, target_y, now) {
  original_begin_move.call(this, entity, target_x, target_y, now);
  if (entity.alive && this.game.dungeon.grid.get_tile(target_x, target_y)?.terrain_id === "lava_floor") {
    apply_lava_damage(this.game, entity, now);
  }
};

EnemyAiSystem.prototype.move_toward = function move_toward_across_shared_tiles(monster, target, now) {
  const next_step = find_next_actor_step(this.game, monster, target);
  if (!next_step) {
    return false;
  }
  return this.game.movement_system.try_move(
    monster,
    { x: next_step.x - monster.grid_x, y: next_step.y - monster.grid_y },
    now
  );
};

EnemyAiSystem.prototype.try_retreat = function try_retreat_across_shared_tiles(monster, target, now) {
  const candidates = cardinal_directions
    .map((direction) => ({
      direction,
      x: monster.grid_x + direction.x,
      y: monster.grid_y + direction.y
    }))
    .filter((position) =>
      this.game.can_actor_traverse(monster, position.x, position.y) &&
      !this.game.is_tile_blocked(position.x, position.y, monster.entity_id)
    )
    .sort((a, b) => {
      const distance_a = Math.hypot(a.x - target.grid_x, a.y - target.grid_y);
      const distance_b = Math.hypot(b.x - target.grid_x, b.y - target.grid_y);
      return distance_b - distance_a;
    });

  const retreat = candidates[0];
  if (!retreat) {
    return false;
  }
  const current_distance = distance_between(monster, target);
  const retreat_distance = Math.hypot(retreat.x - target.grid_x, retreat.y - target.grid_y);
  if (retreat_distance <= current_distance) {
    return false;
  }
  return this.game.movement_system.try_move(monster, retreat.direction, now);
};

CompanionAiSystem.prototype.take_turn = function take_turn_across_shared_tiles(companion, now) {
  if (!companion.alive) {
    return false;
  }

  const monster = this.game.get_living_monsters()
    .sort((a, b) => distance_between(companion, a) - distance_between(companion, b))[0];
  if (monster && distance_between(companion, monster) <= 1.25) {
    return this.game.combat_system.companion_attack(companion, monster, now);
  }

  const target = monster && distance_between(companion, monster) <= 5 ? monster : this.game.player;
  if (target === this.game.player && distance_between(companion, target) <= 2.2) {
    return false;
  }

  const next_step = find_next_actor_step(this.game, companion, target);
  if (!next_step) {
    return false;
  }
  return this.game.movement_system.try_move(
    companion,
    { x: next_step.x - companion.grid_x, y: next_step.y - companion.grid_y },
    now
  );
};

ChestSystem.prototype.find_step_toward_chest = function find_step_onto_chest(monster, chest) {
  return find_next_actor_step(this.game, monster, chest);
};

InteractionSystem.prototype.interact = function interact_with_current_tile() {
  if (this.game.loot_system.collect_items_at_player()) {
    return { consumes_turn: true, skip_non_player_turns: false };
  }

  const chest = get_chest_at_player(this.game);
  if (chest && this.game.chest_system.open_chest(chest)) {
    return { consumes_turn: true, skip_non_player_turns: false };
  }

  const object = get_object_at_player(this.game);
  if (object && this.game.dungeon_object_system.interact(object)) {
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

  const secret_wall = get_revealed_adjacent_secret_wall(this.game);
  if (secret_wall && this.game.dungeon_object_system.interact(secret_wall)) {
    return { consumes_turn: true, skip_non_player_turns: false };
  }

  const nearby_item = this.game.entities.find((entity) =>
    entity.alive && entity.type === "ground_item" && distance_between(this.game.player, entity) <= 1.5
  );
  if (nearby_item) {
    this.game.add_log("stand on the item and press e or xbox a to collect it");
    return { consumes_turn: false };
  }

  const nearby_chest = this.game.chest_system?.get_ground_chests()
    .find((candidate) => distance_between(this.game.player, candidate) <= 1.5);
  if (nearby_chest) {
    this.game.add_log("stand on the treasure chest and press e or xbox a to open it");
    return { consumes_turn: false };
  }

  const nearby_object = this.game.dungeon_object_system?.get_objects()
    .find((candidate) => candidate.object_type !== "secret_wall" && distance_between(this.game.player, candidate) <= 1.5);
  if (nearby_object) {
    this.game.add_log(`stand on the ${nearby_object.name} and press e or xbox a to interact`);
    return { consumes_turn: false };
  }

  this.game.add_log("nothing here responds");
  return { consumes_turn: false };
};

InteractionSystem.prototype.get_prompt = function get_current_tile_prompt() {
  const ground_item = this.game.entities.find((entity) =>
    entity.alive &&
    entity.type === "ground_item" &&
    entity.grid_x === this.game.player.grid_x &&
    entity.grid_y === this.game.player.grid_y
  );
  if (ground_item) {
    return `press e or xbox a to collect ${ground_item.name} · consumes a turn`;
  }

  const chest = get_chest_at_player(this.game);
  if (chest) {
    return "press e or xbox a to open treasure chest · consumes a turn";
  }

  const object = get_object_at_player(this.game);
  const object_prompt = this.game.dungeon_object_system?.get_prompt(object) ?? "";
  if (object_prompt) {
    return object_prompt;
  }

  const recruitable = this.game.recruitment_system.get_nearby_recruitable();
  if (recruitable) {
    return `press e or xbox a to speak with ${recruitable.name}`;
  }

  const tile = this.game.dungeon.grid.get_tile(this.game.player.grid_x, this.game.player.grid_y);
  if (tile?.terrain_id === "exit") {
    return "press e or xbox a to descend · remaining enemies are optional";
  }

  const secret_wall = get_revealed_adjacent_secret_wall(this.game);
  return this.game.dungeon_object_system?.get_prompt(secret_wall) ?? "";
};

function apply_lava_damage(game, entity, now) {
  const resistance_rank = entity.type === "player"
    ? Math.max(0, Number(game.state?.player_upgrade_ranks?.lava_resistance) || 0)
    : 0;
  const damage = Math.max(1, 11 - resistance_rank * 2);

  if (game.combat_system?.apply_damage) {
    game.combat_system.apply_damage(entity, damage, lava_source, now);
  } else {
    entity.health = Math.max(0, entity.health - damage);
    entity.flash_until = now + 140;
    game.spawn_combat_text?.(entity.grid_x, entity.grid_y, `-${damage}`);
    if (entity.health <= 0) {
      entity.alive = false;
    }
  }

  game.add_effect?.("fire", entity.grid_x, entity.grid_y);
  if (entity.type === "player") {
    game.add_log(`lava burns you for ${damage}`);
    if (!entity.alive) {
      game.handle_player_defeat();
    }
  }
}

function find_next_actor_step(game, actor, target) {
  const start = { x: actor.grid_x, y: actor.grid_y };
  const destination = { x: target.grid_x, y: target.grid_y };
  const start_key = position_key(start.x, start.y);
  const destination_key = position_key(destination.x, destination.y);
  const queue = [start];
  const previous = new Map([[start_key, null]]);

  while (queue.length > 0) {
    const current = queue.shift();
    if (position_key(current.x, current.y) === destination_key) {
      break;
    }

    for (const direction of cardinal_directions) {
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      const key = position_key(next.x, next.y);
      if (previous.has(key) || !game.can_actor_traverse(actor, next.x, next.y)) {
        continue;
      }
      if (key !== destination_key && game.is_tile_blocked(next.x, next.y, actor.entity_id)) {
        continue;
      }
      previous.set(key, current);
      queue.push(next);
    }
  }

  if (!previous.has(destination_key)) {
    return null;
  }

  let current = destination;
  let previous_position = previous.get(destination_key);
  while (previous_position && position_key(previous_position.x, previous_position.y) !== start_key) {
    current = previous_position;
    previous_position = previous.get(position_key(current.x, current.y));
  }
  return current;
}

function get_chest_at_player(game) {
  return game.chest_system?.get_ground_chests().find((chest) =>
    chest.grid_x === game.player.grid_x && chest.grid_y === game.player.grid_y
  ) ?? null;
}

function get_object_at_player(game) {
  return game.dungeon_object_system?.get_object_at(
    game.player.grid_x,
    game.player.grid_y,
    (object) => game.dungeon_object_system.can_interact(object)
  ) ?? null;
}

function get_revealed_adjacent_secret_wall(game) {
  return game.dungeon_object_system?.get_objects().find((object) =>
    object.object_type === "secret_wall" &&
    object.revealed &&
    !object.open &&
    distance_between(game.player, object) <= 1
  ) ?? null;
}

function position_key(x, y) {
  return `${x},${y}`;
}
