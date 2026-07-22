export const player_progression_config = Object.freeze({
  health_per_level: 8,
  magic_per_level: 4,
  base_experience_requirement: 24,
  experience_requirement_growth: 16
});

export function experience_required_for_level(level_number) {
  const level = Math.max(1, Math.floor(Number(level_number) || 1));
  return player_progression_config.base_experience_requirement +
    (level - 1) * player_progression_config.experience_requirement_growth;
}

export function calculate_monster_experience(monster) {
  const ability = monster?.special_ability;
  const special_strength = ability
    ? ability.power * 1.5 + ability.range + ability.use_chance * 4
    : 0;
  const scaled_strength =
    (Number(monster?.maximum_health) || 0) * 0.12 +
    (Number(monster?.attack) || 0) * 1.5 +
    (Number(monster?.defence) || 0) * 2 +
    (Number(monster?.magic_power) || 0) +
    special_strength +
    (Number(monster?.difficulty_floor) || 1) * 0.5;

  return Math.max(4, Math.round(scaled_strength));
}
