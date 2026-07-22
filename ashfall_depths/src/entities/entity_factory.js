import { character_database } from "../data/characters.js";
import { monster_database } from "../data/monsters.js";

let next_entity_id = 1;

function create_base_entity(type, grid_x, grid_y) {
  return {
    entity_id: `${type}_${next_entity_id++}`,
    type,
    grid_x,
    grid_y,
    display_x: grid_x,
    display_y: grid_y,
    move_from_x: grid_x,
    move_from_y: grid_y,
    move_started_at: 0,
    moving: false,
    alive: true,
    flash_until: 0
  };
}

export function create_player(grid_x, grid_y) {
  const data = character_database.hero;
  return {
    ...create_base_entity("player", grid_x, grid_y),
    character_id: data.id,
    name: data.name,
    maximum_health: data.maximum_health,
    health: data.maximum_health,
    maximum_magic: data.maximum_magic,
    magic: data.maximum_magic,
    attack: data.attack,
    defence: data.defence,
    magic_power: data.magic_power,
    color: data.color,
    spell_ids: [...data.starting_spells],
    facing: { x: 1, y: 0 }
  };
}

export function create_monster(monster_id, grid_x, grid_y) {
  const data = monster_database[monster_id];
  if (!data) {
    throw new Error(`unknown monster id: ${monster_id}`);
  }

  return {
    ...create_base_entity("monster", grid_x, grid_y),
    monster_id,
    name: data.name,
    archetype: data.archetype,
    ai_profile: data.ai_profile,
    maximum_health: data.maximum_health,
    health: data.maximum_health,
    maximum_magic: data.maximum_magic,
    magic: data.maximum_magic,
    attack: data.attack,
    defence: data.defence,
    magic_power: data.magic_power,
    speed: data.speed,
    color: data.color,
    special_ability: data.special_ability ? { ...data.special_ability } : null
  };
}

export function create_recruitable(character_id, grid_x, grid_y) {
  const data = character_database[character_id];
  return {
    ...create_base_entity("recruitable", grid_x, grid_y),
    character_id,
    name: data.name,
    maximum_health: data.maximum_health,
    health: data.maximum_health,
    maximum_magic: data.maximum_magic,
    magic: data.maximum_magic,
    attack: data.attack,
    defence: data.defence,
    magic_power: data.magic_power,
    color: data.color,
    spell_ids: [...data.starting_spells],
    dialogue: [...data.dialogue],
    recruited: false
  };
}

export function create_companion(character_id, grid_x, grid_y) {
  const data = character_database[character_id];
  return {
    ...create_base_entity("companion", grid_x, grid_y),
    character_id,
    name: data.name,
    maximum_health: data.maximum_health,
    health: data.maximum_health,
    maximum_magic: data.maximum_magic,
    magic: data.maximum_magic,
    attack: data.attack,
    defence: data.defence,
    magic_power: data.magic_power,
    color: data.color,
    spell_ids: [...data.starting_spells]
  };
}

export function create_ground_item(item_id, grid_x, grid_y) {
  return {
    ...create_base_entity("ground_item", grid_x, grid_y),
    item_id,
    name: item_id.replaceAll("_", " ")
  };
}
