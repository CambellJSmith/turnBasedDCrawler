export function get_floor_progression(floor_number) {
  const floor = Math.max(1, Math.floor(Number(floor_number) || 1));
  const depth = floor - 1;

  return Object.freeze({
    floor,
    map_width: 12 + depth,
    map_height: 12 + depth,
    room_count: 2 + Math.floor(depth * 0.75),
    minimum_room_size: 3,
    maximum_room_size: 5 + Math.floor(depth / 12),
    extra_connection_count: Math.floor(depth / 2),
    monster_count: 1 + depth,
    monster_threat_limit: 36 + depth * 8,
    health_multiplier: floor === 1 ? 0.35 : 0.75 + depth * 0.12,
    attack_multiplier: floor === 1 ? 0.4 : 0.72 + depth * 0.07,
    magic_multiplier: floor === 1 ? 0.35 : 0.7 + depth * 0.08,
    defence_bonus: Math.floor(depth / 3),
    guaranteed_archetype_count: Math.min(3, Math.floor(depth / 2)),
    minimum_spawn_distance: Math.min(7, 3 + Math.floor(depth / 4))
  });
}

export function calculate_monster_threat(monster) {
  return monster.maximum_health * 0.3 +
    monster.attack * 2 +
    monster.defence * 3 +
    monster.magic_power;
}
