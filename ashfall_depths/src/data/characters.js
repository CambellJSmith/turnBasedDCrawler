export const character_database = Object.freeze({
  hero: {
    id: "hero",
    name: "the wanderer",
    maximum_health: 100,
    maximum_magic: 60,
    attack: 12,
    defence: 4,
    magic_power: 10,
    color: "#68b8ff",
    starting_spells: ["fire_bolt", "healing_light", "frost_nova"]
  },
  mira_ashwalker: {
    id: "mira_ashwalker",
    name: "mira ashwalker",
    maximum_health: 72,
    maximum_magic: 88,
    attack: 8,
    defence: 3,
    magic_power: 16,
    color: "#f1a35b",
    starting_spells: ["fire_bolt", "healing_light"],
    dialogue: [
      "you are not one of the hollowed. good.",
      "i have been tracking the thing below these ruins.",
      "take me with you. my fire is more useful than another grave."
    ]
  }
});
