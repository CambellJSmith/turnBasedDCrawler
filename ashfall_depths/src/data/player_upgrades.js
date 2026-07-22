export const player_upgrade_definitions = Object.freeze([
  Object.freeze({ id: "attack", name: "sharpened steel", description: "+2 attack", maximum_rank: 99 }),
  Object.freeze({ id: "defence", name: "hardened guard", description: "+1 defence", maximum_rank: 99 }),
  Object.freeze({ id: "maximum_health", name: "deep vitality", description: "+12 maximum health and restore 12 health", maximum_rank: 99 }),
  Object.freeze({ id: "maximum_magic", name: "expanded reserve", description: "+7 maximum magic and restore 7 magic", maximum_rank: 99 }),
  Object.freeze({ id: "stronger_spells", name: "arcane force", description: "+12% spell damage and healing", maximum_rank: 99 }),
  Object.freeze({ id: "cheaper_spells", name: "efficient casting", description: "spells cost 1 less magic, to a minimum of 1", maximum_rank: 99 }),
  Object.freeze({ id: "chest_rewards", name: "treasure sense", description: "chests contain more gold and can gain extra items", maximum_rank: 99 }),
  Object.freeze({ id: "recruitment_chance", name: "merciful victor", description: "defeated monsters are more likely to offer allegiance", maximum_rank: 99 }),
  Object.freeze({ id: "bonus_experience", name: "battle insight", description: "+15% experience from defeated monsters", maximum_rank: 99 }),
  Object.freeze({ id: "lava_resistance", name: "ashwalker", description: "walk across lava; each rank reduces lava damage", maximum_rank: 99 })
]);

export const player_upgrade_database = Object.freeze(Object.fromEntries(
  player_upgrade_definitions.map((definition) => [definition.id, definition])
));

export function create_default_player_upgrade_ranks() {
  return Object.fromEntries(player_upgrade_definitions.map((definition) => [definition.id, 0]));
}

export function normalize_player_upgrade_ranks(value) {
  const normalized = create_default_player_upgrade_ranks();
  for (const definition of player_upgrade_definitions) {
    normalized[definition.id] = Math.max(
      0,
      Math.min(definition.maximum_rank, Math.floor(Number(value?.[definition.id]) || 0))
    );
  }
  return normalized;
}

export function get_player_upgrade_rank(state, upgrade_id) {
  return Math.max(0, Math.floor(Number(state?.player_upgrade_ranks?.[upgrade_id]) || 0));
}
