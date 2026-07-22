export const spell_database = Object.freeze({
  fire_bolt: {
    id: "fire_bolt",
    name: "fire bolt",
    description: "strikes the nearest visible enemy",
    magic_cost: 8,
    power: 18,
    range: 6,
    targeting: "nearest_enemy"
  },
  healing_light: {
    id: "healing_light",
    name: "healing light",
    description: "restores health to the caster",
    magic_cost: 10,
    power: 26,
    range: 0,
    targeting: "self"
  },
  frost_nova: {
    id: "frost_nova",
    name: "frost nova",
    description: "damages every nearby enemy",
    magic_cost: 14,
    power: 12,
    range: 2.5,
    targeting: "area_self"
  }
});
