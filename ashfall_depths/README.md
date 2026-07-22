# ashfall depths

A modular browser-game starter for an isometric, turn-based roguelike dungeon crawler. It combines tile-based exploration, procedural floors, loot, spells, party recruitment, and JRPG-style menus.

## play online

The game is deployed to GitHub Pages at:

`https://cambelljsmith.github.io/turnBasedDCrawler/`

The workflow in `.github/workflows/deploy-pages.yml` publishes the contents of `ashfall_depths/` whenever changes are pushed to `main`. In the repository settings, set **Pages → Build and deployment → Source** to **GitHub Actions**.

## turn rules

Every completed turn resolves in this order:

1. the player performs one significant action
2. every living companion acts once
3. every living monster acts once
4. every living player, companion, and monster recovers 2 health and 2 magic points
5. control returns to the player after movement animation finishes

The player always acts first. The game does not advance while the player is considering an action.

### actions that consume one turn

- successful movement to another tile
- a melee attack, including a swing that hits nothing
- a successful spell cast
- using a consumable item
- collecting items from the ground
- completing a character recruitment
- descending to the next floor, without giving the new floor a free enemy phase

### actions that are free

- opening, closing, or navigating the popup menu
- viewing dialogue pages
- changing equipment
- saving
- changing settings
- blocked movement
- failed spell casts
- interacting when nothing actionable is present

## included systems

- procedural isometric dungeon generation
- tile collision and smooth grid movement animation
- deterministic player, companion, monster, and recovery phases
- canvas rendering with simple geometric graphics and unified isometric depth sorting
- melee combat and enemy health
- archetype-driven enemy AI with one decision per monster turn
- companion follow and combat AI with one decision per companion turn
- bruiser, glass_cannon, tank, and balanced monster archetypes
- nine monster types with distinct statistics, silhouettes, targeting priorities, and magic-powered special attacks
- guaranteed bruiser, glass_cannon, and tank representation on every generated floor
- recruitable character encounter
- item drops, collection, inventory, equipment, and turn-consuming consumables
- fire bolt, healing light, and frost nova spells
- items, magic, stats, team, ground tile, and settings menus
- automatic end-of-turn recovery of 2 health and 2 magic for every living combatant
- hidden monster health and magic information
- depth-sorted walls and actors so foreground blocks occlude characters behind them
- visible turn counter and current phase display
- browser save data with turn count persistence
- modular JavaScript files grouped by responsibility
- Xbox-style controller support through the browser Gamepad API
- controller navigation for gameplay, dialogue, inventory, magic, settings, and other popup-menu sections

## monster archetypes

- `bruiser`: high attack and moderate health. Bruisers prioritize low-defence targets and frequently spend magic on heavy melee attacks.
- `glass_cannon`: low health and defence with strong ranged special attacks. Glass cannons prefer vulnerable targets and retreat when engaged in melee.
- `tank`: very high health and defence with lower damage. Tanks advance directly, hold close range, and use shield-style special attacks.
- `balanced`: moderate statistics and mixed melee or ranged behaviour.

Monster health and magic regenerate at the same end-of-turn rate as the player party. Monster health and magic values remain hidden from the player; only internal combat logic can access them.

## requirements

- Node.js 20 or newer for local hosting
- no local runtime requirements when playing through GitHub Pages

## run locally

```bash
npm start
```

Alternatively, run `start_game.bat` on Windows or `./start_game.sh` on macOS and Linux. Each launcher starts the local server and opens `http://127.0.0.1:5173` in the default browser. No dependency installation or build step is required.

## controls

### keyboard

| input | action |
|---|---|
| w, a, s, d or arrow keys | move one tile and consume a turn |
| space | melee attack and consume a turn |
| 1 | cast fire bolt and consume a turn when successful |
| 2 | cast healing light and consume a turn when successful |
| 3 | cast frost nova and consume a turn when successful |
| e or enter | interact, collect, recruit, or descend |
| tab or escape | open or close the free menu |

### xbox controller

| input | gameplay action |
|---|---|
| left stick or d-pad | move one tile and consume a turn |
| x | melee attack and consume a turn |
| a | interact, collect, recruit, descend, or confirm |
| lb | cast fire bolt; switch to the previous menu tab while paused |
| rb | cast healing light; switch to the next menu tab while paused |
| y | cast frost nova |
| menu or view button | open or close the free menu |
| b | close the menu, cancel, or advance dialogue |

In menus, use the d-pad or left stick to move focus, `a` to activate the focused control, `b` to close the menu, and `lb` or `rb` to change tabs. Moving left or right while a volume slider is focused adjusts its value.

## project layout

- `.github/workflows/deploy-pages.yml` deploys `ashfall_depths/` to GitHub Pages.
- `src/config/` contains game and input configuration.
- `src/core/` owns the main runtime and animation loop.
- `src/data/` contains grouped content databases.
- `src/entities/` creates players, monsters, companions, and items.
- `src/render/` draws the isometric world.
- `src/save/` contains persistence code.
- `src/state/` contains campaign, inventory, and party state.
- `src/systems/turn_system.js` owns turn order and player-input locking.
- `src/systems/gamepad_input_system.js` polls standard Xbox-style gamepads and handles edge presses, stick deadzones, and directional repeat.
- `src/systems/resource_recovery_system.js` restores health and magic to all living combatants after completed turns.
- `src/systems/monster_ability_system.js` validates and resolves monster special attacks.
- `src/systems/` contains the remaining isolated gameplay systems.
- `src/ui/` controls the HUD, dialogue, and popup menu.
- `src/world/` contains generation, projection, grid, and pathfinding code.
- `styles/` contains interface styling.

## suggested next additions

1. add a wait action for intentionally passing a turn
2. add directional or tile-targeted attacks and spells
3. replace geometric actors with sprite sheets
4. add handcrafted room templates
5. add bosses, elite encounters, and environmental hazards
6. move save data from localStorage to IndexedDB
7. add audio, controller glyph switching, and control remapping
8. split party members into active and reserve rosters
9. add persistent camp and relationship progression

## notes

This is a functional vertical-slice starter rather than a complete commercial game. All visual assets are generated by canvas drawing, so there are no third-party art files or licensing dependencies.
