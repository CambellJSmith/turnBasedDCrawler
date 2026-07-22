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
const barrier_types = new Set(["locked_door", "secret_wall"]);
const impassable_terrain_ids = new Set(["wall", "void"]);

const previous_try_move = MovementSystem.prototype.try_move;
MovementSystem.prototype.try_move = function try_move_with_solid_closed_doors(entity, direction, now) {
  const target_x = entity.grid_x + direction.x;
  const target_y = entity.grid_y + direction.y;
  if (get_closed_barrier(this.game, target_x, target_y)?.object_type === "locked_door") {
    return false;
  }
  return previous_try_move.call(this, entity, direction, now);
};

EnemyAiSystem.prototype.move_toward = function move_toward_around_closed_barriers(monster, target, now) {
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

EnemyAiSystem.prototype.try_retreat = function try_retreat_around_closed_barriers(monster, target, now) {
  const candidates = cardinal_directions
    .map((direction) => ({
      direction,
      x: monster.grid_x + direction.x,
      y: monster.grid_y + direction.y
    }))
    .filter((position) =>
      can_actor_traverse(this.game, position.x, position.y) &&
      !get_blocking_actor(this.game, position.x, position.y, monster.entity_id)
    )
    .sort((first, second) => {
      const first_distance = Math.hypot(first.x - target.grid_x, first.y - target.grid_y);
      const second_distance = Math.hypot(second.x - target.grid_x, second.y - target.grid_y);
      return second_distance - first_distance;
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

CompanionAiSystem.prototype.take_turn = function take_turn_around_closed_barriers(companion, now) {
  if (!companion.alive) {
    return false;
  }

  const monster = this.game.get_living_monsters()
    .sort((first, second) => distance_between(companion, first) - distance_between(companion, second))[0];

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

ChestSystem.prototype.find_step_toward_chest = function find_step_toward_chest_around_barriers(monster, chest) {
  return find_next_actor_step(this.game, monster, chest);
};

const previous_interact = InteractionSystem.prototype.interact;
InteractionSystem.prototype.interact = function interact_with_adjacent_locked_door() {
  if (!has_primary_interaction(this.game)) {
    const locked_door = get_adjacent_locked_door(this.game);
    if (locked_door && this.game.dungeon_object_system.interact(locked_door)) {
      return { consumes_turn: true, skip_non_player_turns: false };
    }
  }
  return previous_interact.call(this);
};

const previous_get_prompt = InteractionSystem.prototype.get_prompt;
InteractionSystem.prototype.get_prompt = function get_prompt_for_adjacent_locked_door() {
  if (!has_primary_interaction(this.game)) {
    const locked_door = get_adjacent_locked_door(this.game);
    if (locked_door) {
      return this.game.dungeon_object_system.get_prompt(locked_door);
    }
  }
  return previous_get_prompt.call(this);
};

function has_primary_interaction(game) {
  const player = game.player;
  if (!player) {
    return false;
  }

  const current_entity = game.entities.some((entity) =>
    entity.alive &&
    entity.grid_x === player.grid_x &&
    entity.grid_y === player.grid_y &&
    (
      entity.type === "ground_item" ||
      entity.type === "chest" ||
      (
        entity.type === "dungeon_object" &&
        !barrier_types.has(entity.object_type) &&
        game.dungeon_object_system?.can_interact(entity)
      )
    )
  );
  if (current_entity || game.recruitment_system?.get_nearby_recruitable()) {
    return true;
  }

  return game.dungeon?.grid?.get_tile(player.grid_x, player.grid_y)?.terrain_id === "exit";
}

function get_adjacent_locked_door(game) {
  return game.dungeon_object_system?.get_objects()
    .filter((object) =>
      object.object_type === "locked_door" &&
      !object.open &&
      game.dungeon_object_system.can_interact(object) &&
      manhattan_distance(game.player, object) <= 1
    )
    .sort((first, second) => manhattan_distance(game.player, first) - manhattan_distance(game.player, second))[0] ?? null;
}

function can_actor_traverse(game, x, y) {
  const tile = game.dungeon?.grid?.get_tile(x, y);
  return Boolean(
    tile &&
    !impassable_terrain_ids.has(tile.terrain_id) &&
    !get_closed_barrier(game, x, y)
  );
}

function get_closed_barrier(game, x, y) {
  return game.dungeon_object_system?.get_object_at(
    x,
    y,
    (object) => barrier_types.has(object.object_type) && !object.open
  ) ?? null;
}

function get_blocking_actor(game, x, y, ignored_entity_id = "") {
  return game.entities.find((entity) =>
    entity.alive &&
    actor_types.has(entity.type) &&
    entity.entity_id !== ignored_entity_id &&
    entity.grid_x === x &&
    entity.grid_y === y
  ) ?? null;
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
      if (previous.has(key) || !can_actor_traverse(game, next.x, next.y)) {
        continue;
      }
      if (key !== destination_key && get_blocking_actor(game, next.x, next.y, actor.entity_id)) {
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

function manhattan_distance(first, second) {
  return Math.abs(first.grid_x - second.grid_x) + Math.abs(first.grid_y - second.grid_y);
}

function position_key(x, y) {
  return `${x},${y}`;
}
