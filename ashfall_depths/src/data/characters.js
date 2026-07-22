export const character_database = Object.freeze({
  hero: {
    id: "hero",
    name: "the wanderer",
    maximum_health: 125,
    maximum_magic: 70,
    attack: 14,
    defence: 7,
    magic_power: 12,
    color: "#68b8ff",
    starting_spells: ["fire_bolt", "healing_light", "frost_nova"]
  },
  mira_ashwalker: {
    id: "mira_ashwalker",
    name: "mira ashwalker",
    maximum_health: 82,
    maximum_magic: 92,
    attack: 9,
    defence: 5,
    magic_power: 17,
    color: "#f1a35b",
    starting_spells: ["fire_bolt", "healing_light"],
    dialogue: [
      "you are not one of the hollowed. good.",
      "i have been tracking the thing below these ruins.",
      "take me with you. my fire is more useful than another grave."
    ]
  }
});
