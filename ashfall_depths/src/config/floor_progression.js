export function get_floor_progression(floor_number) {
  const floor = Math.max(1, Math.floor(Number(floor_number) || 1));
  const depth = floor - 1;

  return Object.freeze({
    floor,
    map_width: 12 + Math.floor(depth / 2),
    map_height: 12 + Math.floor(depth / 2),
    room_count: 2 + Math.floor(depth / 3),
    minimum_room_size: 3,
    maximum_room_size: 5 + Math.floor(depth / 6),
    extra_connection_count: Math.floor(depth / 6),
    lava_patch_count: floor === 1 ? 0 : 1 + Math.floor((floor - 2) / 7),
    lava_patch_minimum_size: 2,
    lava_patch_maximum_size: 3 + Math.floor(depth / 8),
    monster_count: 1 + Math.floor(depth / 3),
    monster_threat_limit: 62 + depth * 2.5,
    health_multiplier: floor === 1 ? 0.28 : 0.52 + depth * 0.035,
    attack_multiplier: floor === 1 ? 0.3 : 0.46 + depth * 0.022,
    magic_multiplier: floor === 1 ? 0.3 : 0.45 + depth * 0.025,
    defence_bonus: Math.floor(depth / 10),
    guaranteed_archetype_count: Math.min(3, Math.floor(depth / 12)),
    minimum_spawn_distance: Math.min(10, 5 + Math.floor(depth / 5))
  });
}

export function calculate_monster_threat(monster) {
  const ability = monster.special_ability;
  const special_threat = ability
    ? ability.power * 3 + ability.range * 2 + ability.use_chance * 10
    : 0;

  return monster.maximum_health * 0.3 +
    monster.attack * 2 +
    monster.defence * 3 +
    monster.magic_power +
    special_threat;
}