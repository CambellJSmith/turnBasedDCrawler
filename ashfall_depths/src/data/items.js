export const item_database = Object.freeze({
  healing_potion: {
    id: "healing_potion",
    name: "healing potion",
    category: "consumable",
    description: "restores 35 health",
    effect: "restore_health",
    amount: 35,
    value: 18
  },
  mana_potion: {
    id: "mana_potion",
    name: "mana potion",
    category: "consumable",
    description: "restores 30 magic",
    effect: "restore_magic",
    amount: 30,
    value: 22
  },
  iron_sabre: {
    id: "iron_sabre",
    name: "iron sabre",
    category: "weapon",
    description: "a dependable one-handed blade",
    attack_bonus: 4,
    value: 55
  },
  ashwood_staff: {
    id: "ashwood_staff",
    name: "ashwood staff",
    category: "weapon",
    description: "channels unstable dungeon magic",
    attack_bonus: 2,
    magic_bonus: 5,
    value: 70
  },
  warding_charm: {
    id: "warding_charm",
    name: "warding charm",
    category: "accessory",
    description: "a cracked charm that still offers protection",
    defence_bonus: 3,
    value: 45
  }
});
