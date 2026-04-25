export type PillarId = "pieces" | "space" | "rules" | "pacing" | "choice" | "persistence";
export type FeatureCategory = "fix" | "addition";
export type FeatureStatus = "idea" | "spec" | "building" | "shipped";
export type FeaturePriority = "P0" | "P1" | "P2";
export type Effort = "S" | "M" | "L";
export type PhaseNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type Feature = {
  id: string;
  pillar: PillarId;
  title: string;
  oneLiner: string;
  detail: string;
  category: FeatureCategory;
  status: FeatureStatus;
  priority: FeaturePriority;
  phase: PhaseNumber;
  effort?: Effort;
};

export type Pillar = {
  id: PillarId;
  title: string;
  tagline: string;
  description: string;
  accent: string;
};

export type Phase = {
  number: PhaseNumber;
  name: string;
  thesis: string;
};

export const THESIS =
  "2248 has a smart core mechanic wrapped in a minimum-viable experience. Its flatness isn't a mechanical failure — the chain-as-compressed-cascade is genuinely interesting — it's a content and decision-surface failure. Every run is the same run, every turn the same turn. The fix isn't small tweaks; it's adopting the roguelike puzzle game stack — tiles, modifiers, boards, events, meta-progression — applied to mechanics this game already has.";

export const PILLARS: Pillar[] = [
  {
    id: "pieces",
    title: "Pieces",
    tagline: "What objects exist on the board?",
    description:
      "Tile types beyond the standard number tile. Each new tile introduces a new tactical pattern and source of decisions. Today: 1 standard + 1 boost = 2 types. A proper puzzle game ships 10–20.",
    accent: "#5dd6ff",
  },
  {
    id: "space",
    title: "Space",
    tagline: "What's the playing field?",
    description:
      "Board shape, layout, walls, holes, zones. Today: a single fixed 5×7 rectangle. Layout variety multiplies every other system — same tiles + same modifiers feel different on a hex grid or an L-shape.",
    accent: "#ff6bd9",
  },
  {
    id: "rules",
    title: "Rules",
    tagline: "How do mechanics work?",
    description:
      "Chain validity, merge math, gravity, spawn algorithms, undo, target curve. The core machinery. Most foundation fixes live here, plus alt-rule variants (Fibonacci merges, branching chains, free-start chains) that turn one game into many.",
    accent: "#f0d048",
  },
  {
    id: "pacing",
    title: "Pacing",
    tagline: "What changes mid-run, time-wise?",
    description:
      "Boss events, deadlines, escalating constraints. Today: nothing. The game's loop is uninterrupted from move 1 to move 500. Pacing breaks that monotony with short-horizon objectives that interrupt and reward.",
    accent: "#ff8c40",
  },
  {
    id: "choice",
    title: "Choice",
    tagline: "What does the player pick?",
    description:
      "Run-start drafts, modifiers, builds, mid-run shops. Today: zero — every run starts identical. The single highest-leverage missing system. A modifier draft turns one game into 50 different builds.",
    accent: "#7cdb93",
  },
  {
    id: "persistence",
    title: "Persistence",
    tagline: "What carries between runs?",
    description:
      "Unlocks, stakes, achievements, daily challenges. Today: zero meta-progression. Without it, every loss is a pure loss. With it, each run contributes to a library — the engine that turns 20-minute sessions into 50-hour journeys.",
    accent: "#5d9eff",
  },
];

export const PHASES: Phase[] = [
  {
    number: 1,
    name: "Foundation Tightening",
    thesis: "Fix existing systems that would sink any new content. Tighten the game-over gate, fix or cut Boost, reduce excessive lookahead, constrain undo, sub-exponential targets.",
  },
  {
    number: 2,
    name: "Tile Zoo",
    thesis: "Ship 6–8 tile variants on a generalized `modifier` field. Each tile interacts with every existing system — massive gameplay surface for small code cost.",
  },
  {
    number: 3,
    name: "Modifier Draft (the Joker layer)",
    thesis: "Run-start draft of 2–3 modifiers across scoring/rule/spawn/board categories. Single highest-leverage content system — modifier × tile combinations are emergent.",
  },
  {
    number: 4,
    name: "Board Variety",
    thesis: "Ship 4–5 layouts plus walls/holes. Drafting becomes 'which modifiers + which board.' Layout × tile × modifier = compounding variety.",
  },
  {
    number: 5,
    name: "Boss & Pacing Events",
    thesis: "Mini-events fire every 10–15 moves. Short-horizon objectives interrupt the one-move loop, create new decisions, and shape subsequent play through rewards.",
  },
  {
    number: 6,
    name: "Meta-Progression",
    thesis: "Gate modifier/tile/layout libraries behind run completion. Failed runs feel like progress. This converts the game from one-shot puzzler into long-arc unlock journey.",
  },
  {
    number: 7,
    name: "Frame & Polish",
    thesis: "Pick a theme. Rename tiles. Add flavor text. Cheapest content multiplier — same mechanics, completely different emotional register.",
  },
];

export const FEATURES: Feature[] = [
  // ── PILLAR 1: PIECES ─────────────────────────────────────────────
  {
    id: "boost-rebalance",
    pillar: "pieces",
    title: "Boost rebalance",
    oneLiner: "Lower chain threshold to 3+ or convert boost to wildcard",
    detail:
      "Today: boost activates only on 5+ chains, which are rare, so most boosts spawn and expire unused. Either lower the activation threshold or pivot the tile to wildcard semantics — match any value in a chain.",
    category: "fix",
    status: "shipped",
    priority: "P1",
    phase: 1,
    effort: "S",
  },
  {
    id: "wildcard-tile",
    pillar: "pieces",
    title: "Wildcard tile",
    oneLiner: "Matches any value in a chain",
    detail:
      "A rare tile that satisfies the chain rule for any neighbor — both as a chain starter (counts as equal) and as an extension (counts as equal-or-double). Unblocks stuck boards. Forces 'save for when I need it' decisions.",
    category: "addition",
    status: "shipped",
    priority: "P0",
    phase: 2,
    effort: "M",
  },
  {
    id: "lock-tile",
    pillar: "pieces",
    title: "Lock tile",
    oneLiner: "Cannot chain through. Cleared by N adjacent merges.",
    detail:
      "Obstacle inside the puzzle. Locks block chains spatially until enough merges happen around them. Forces players to play AROUND something rather than through it.",
    category: "addition",
    status: "shipped",
    priority: "P0",
    phase: 2,
    effort: "M",
  },
  {
    id: "bomb-tile",
    pillar: "pieces",
    title: "Bomb tile",
    oneLiner: "On merge, detonates 3×3 cleared around endpoint",
    detail:
      "The 'nuclear option' for stuck boards. Sacrifices the chain's score in exchange for clearing space. Creates risk/reward decisions at moments of crisis.",
    category: "addition",
    status: "shipped",
    priority: "P0",
    phase: 2,
    effort: "M",
  },
  {
    id: "ice-tile",
    pillar: "pieces",
    title: "Ice tile",
    oneLiner: "Frozen until N moves pass or adjacent merge thaws it",
    detail:
      "Adds patience as a resource. Players plan around the thaw timer. An adjacent merge can release it early — creating pivot strategies.",
    category: "addition",
    status: "shipped",
    priority: "P1",
    phase: 2,
    effort: "M",
  },
  {
    id: "anchor-tile",
    pillar: "pieces",
    title: "Anchor tile",
    oneLiner: "Ignores gravity — stays in place after merges",
    detail:
      "Strategic placement tile. Players use anchors to shape board topology, hold value tiles in fixed positions, and break the predictable downward gravity flow.",
    category: "addition",
    status: "shipped",
    priority: "P1",
    phase: 2,
    effort: "M",
  },
  {
    id: "splitter-tile",
    pillar: "pieces",
    title: "Splitter tile",
    oneLiner: "Merge result splits into two half-value tiles",
    detail:
      "Anti-snowball mechanic. Counters late-game tile accumulation by splitting big merges into pairs. Creates a different scoring economy when included in chains.",
    category: "addition",
    status: "shipped",
    priority: "P1",
    phase: 2,
    effort: "M",
  },
  {
    id: "multiplier-tile",
    pillar: "pieces",
    title: "Multiplier tile",
    oneLiner: "Adjacent merges score ×K (K configurable)",
    detail:
      "Spatial tableau tile — you play AROUND it, not with it. Encourages building chains in specific board regions. Stationary value source.",
    category: "addition",
    status: "shipped",
    priority: "P1",
    phase: 2,
    effort: "M",
  },
  {
    id: "portal-pair",
    pillar: "pieces",
    title: "Portal pair",
    oneLiner: "Two linked tiles — adjacency is transitive through them",
    detail:
      "Spatial reasoning twist. A chain can hop from one portal to its pair's neighbors as if they were adjacent. Adjacency stops being purely physical.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 2,
    effort: "L",
  },
  {
    id: "mimic-tile",
    pillar: "pieces",
    title: "Mimic tile",
    oneLiner: "Copies the value of whichever tile you chain into first",
    detail:
      "Flexible chain starter. Lets players begin chains they otherwise couldn't construct. Becomes more strategic when players choose which adjacent tile to 'lock in'.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 2,
    effort: "M",
  },
  {
    id: "doubler-tile",
    pillar: "pieces",
    title: "Doubler tile",
    oneLiner: "Next merge in this column scores ×2",
    detail:
      "Positional timing puzzle. Players control WHEN to trigger the doubler effect by routing chains through specific columns at specific moments.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 2,
    effort: "S",
  },
  {
    id: "phoenix-tile",
    pillar: "pieces",
    title: "Phoenix tile",
    oneLiner: "When merged, respawns at 2× value next spawn cycle",
    detail:
      "Death/rebirth tension. Players decide whether to use a Phoenix immediately for guaranteed value or preserve it for the rebirth boost.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 2,
    effort: "M",
  },
  {
    id: "linker-tile",
    pillar: "pieces",
    title: "Linker tile",
    oneLiner: "On merge, all matching-value tiles drop one row",
    detail:
      "Chain reactions extend beyond the path. A merge causes board-wide ripples among same-value tiles, which can cascade further.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 2,
    effort: "L",
  },
  {
    id: "poison-tile",
    pillar: "pieces",
    title: "Poison tile",
    oneLiner: "If not merged in N moves, spreads to a neighbor",
    detail:
      "Forced-action mechanic. Creates per-tile deadlines, not just per-game ones. Spread mechanic forces players to prioritize specific cells.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 2,
    effort: "M",
  },
  {
    id: "crystal-tile",
    pillar: "pieces",
    title: "Crystal tile",
    oneLiner: "Can be merged with, but cannot be chained through",
    detail:
      "Breaks the equal-or-double extension rule. Crystals are valid as chain endpoints but can't sit in the middle of a chain. Specific topology challenge.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 2,
    effort: "S",
  },
  {
    id: "void-tile",
    pillar: "pieces",
    title: "Void tile",
    oneLiner: "Consumes one tile in its column every move",
    detail:
      "Active enemy on the board. Voids erode player value over time, forcing engagement to clear them before the column collapses.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 2,
    effort: "M",
  },

  // ── PILLAR 2: SPACE ──────────────────────────────────────────────
  {
    id: "tighten-game-over",
    pillar: "space",
    title: "Tighten game-over gate",
    oneLiner: "4-way adjacency for pair counting OR shrink grid",
    detail:
      "Today: 5×7 grid with 8-way pair counting almost never hits zero pairs. The terminal state never threatens. Either drop diagonal adjacency in pair counting (halves adjacency count), shrink the grid, or both. Death must shape play.",
    category: "fix",
    status: "shipped",
    priority: "P0",
    phase: 1,
    effort: "S",
  },
  {
    id: "hexagonal-grid",
    pillar: "space",
    title: "Hexagonal grid",
    oneLiner: "6 neighbors per cell instead of 4/8",
    detail:
      "Different adjacency rules create different chain topologies. Tiles can extend in 6 directions instead of 8. Distinctively different tactical surface.",
    category: "addition",
    status: "idea",
    priority: "P1",
    phase: 4,
    effort: "L",
  },
  {
    id: "cramped-46-grid",
    pillar: "space",
    title: "4×6 cramped layout",
    oneLiner: "Smaller grid — tense, fast lockup",
    detail:
      "Reduces the board to 24 cells. Pair management becomes acute, game-over threatens more often. Different flow than the spacious default.",
    category: "addition",
    status: "idea",
    priority: "P1",
    phase: 4,
    effort: "S",
  },
  {
    id: "spacious-77-grid",
    pillar: "space",
    title: "7×7 spacious layout",
    oneLiner: "Larger grid for strategic depth",
    detail:
      "49 cells gives room to plan multi-turn setups. Reduces pair pressure but makes individual chains larger. Suited to long-form strategic play.",
    category: "addition",
    status: "idea",
    priority: "P1",
    phase: 4,
    effort: "S",
  },
  {
    id: "walls",
    pillar: "space",
    title: "Walls / blocked cells",
    oneLiner: "Permanent layout obstacles that gravity flows around",
    detail:
      "Walls fragment the grid into sub-regions, creating localized pair scarcity. Layouts with strategic wall placement become tactical puzzles in themselves.",
    category: "addition",
    status: "idea",
    priority: "P1",
    phase: 4,
    effort: "M",
  },
  {
    id: "holes",
    pillar: "space",
    title: "Holes",
    oneLiner: "Removed cells — gravity flows around them",
    detail:
      "Like walls but tiles can fall into them and disappear. Adds a different kind of spatial pressure where overflow becomes a real cost.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 4,
    effort: "M",
  },
  {
    id: "zones",
    pillar: "space",
    title: "Zones",
    oneLiner: "Region-specific rules (e.g. top rows score ×2)",
    detail:
      "Different parts of the grid have different rules. Players gravitate toward favorable zones, building positional play styles around board geography.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 4,
    effort: "M",
  },
  {
    id: "dynamic-walls",
    pillar: "space",
    title: "Dynamic walls",
    oneLiner: "Walls appear mid-run as a challenge",
    detail:
      "Walls spawn during a run, fragmenting the board further as time progresses. Combines spatial pressure with time pressure.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 4,
    effort: "M",
  },
  {
    id: "themed-shapes",
    pillar: "space",
    title: "Themed layout shapes",
    oneLiner: "L, plus, cross, custom outlines",
    detail:
      "Non-rectangular grid outlines. Each shape biases play toward specific tactical patterns. Cosmetic + mechanical variety.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 4,
    effort: "M",
  },

  // ── PILLAR 3: RULES ──────────────────────────────────────────────
  {
    id: "reduce-lookahead",
    pillar: "rules",
    title: "Reduce weighted lookahead",
    oneLiner: "8 tiles → 2-3 per column",
    detail:
      "Today: weighted spawn shows 8 upcoming tiles per column = 40 tiles of future info. This trivializes planning. 2–3 tiles is the goldilocks zone — enough to plan a chain, not enough to pre-solve the game.",
    category: "fix",
    status: "shipped",
    priority: "P0",
    phase: 1,
    effort: "S",
  },
  {
    id: "constrain-undo",
    pillar: "rules",
    title: "Constrain undo",
    oneLiner: "Restore merged tiles only — preserve the spawn",
    detail:
      "Today: full state rollback erases all consequence. Constrain undo to restore the chain's tiles only — the spawn (and everything else) stands. Now undo fixes 'I picked the wrong chain' but doesn't reroll the world.",
    category: "fix",
    status: "shipped",
    priority: "P0",
    phase: 1,
    effort: "M",
  },
  {
    id: "subexp-targets",
    pillar: "rules",
    title: "Sub-exponential level targets",
    oneLiner: "512 → 768 → 1024 instead of 1024 → 2048",
    detail:
      "Today: level targets double each level (512, 1024, 2048, 4096…), outgrowing the board's geometric capacity by level 4. Sub-exponential growth (e.g., +50% per level) keeps progression challenging without becoming a wall.",
    category: "fix",
    status: "shipped",
    priority: "P0",
    phase: 1,
    effort: "S",
  },
  {
    id: "topk-hostile",
    pillar: "rules",
    title: "Top-K hostile sampling",
    oneLiner: "Replace deterministic adversarial with weighted top-K",
    detail:
      "Today: adversarial spawn is fully deterministic — players can solve the counter-meta. Sample from the top K most hostile spawns weighted by hostility score. Preserves adversarial feel, prevents anti-pattern exploitation.",
    category: "fix",
    status: "shipped",
    priority: "P1",
    phase: 1,
    effort: "M",
  },
  {
    id: "decouple-hostility-lookahead",
    pillar: "rules",
    title: "Decouple hostility from lookahead",
    oneLiner: "Two independent settings, not one difficulty knob",
    detail:
      "Today: spawn algo conflates spawn-hostility (how adversarial RNG is) with information-visible (how much you can plan). Split into two sliders. Now 4 corners exist: chill+visible, chill+hidden, hostile+visible, hostile+hidden — four different games.",
    category: "fix",
    status: "shipped",
    priority: "P1",
    phase: 1,
    effort: "M",
  },
  {
    id: "free-start",
    pillar: "rules",
    title: "Free Start rule variant",
    oneLiner: "Chain step 1 allows doubling, not just equal",
    detail:
      "Removes the equal-only constraint on the first chain link. Massively changes pair scarcity dynamics — chains can begin from any compatible pair, not just exact matches.",
    category: "addition",
    status: "idea",
    priority: "P1",
    phase: 3,
    effort: "S",
  },
  {
    id: "triple-threat",
    pillar: "rules",
    title: "Triple Threat rule variant",
    oneLiner: "Chain extends on triple (3×), not double (2×)",
    detail:
      "Different merge formula: chain steps must be equal or 3× the previous. Creates a different power curve based on powers-of-3 arithmetic.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 3,
    effort: "M",
  },
  {
    id: "fibonacci-merges",
    pillar: "rules",
    title: "Fibonacci merge math",
    oneLiner: "Results land on Fibonacci values, not powers-of-2",
    detail:
      "Replace `smallest power-of-2 ≥ sum` with `smallest Fibonacci ≥ sum`. Same chain rules, completely different scoring economy.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 3,
    effort: "M",
  },
  {
    id: "branching-chains",
    pillar: "rules",
    title: "Branching chains",
    oneLiner: "Chain paths can fork, not just be linear",
    detail:
      "Today: chains are linear paths. Allow forking at specific tiles (e.g., wildcards or specific tile types) — chains become trees. Massive new strategic surface.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 3,
    effort: "L",
  },

  // ── PILLAR 4: PACING ─────────────────────────────────────────────
  {
    id: "chain-challenge",
    pillar: "pacing",
    title: "Chain Challenge event",
    oneLiner: "Make a 6+ chain in next 3 moves — reward: +1 undo charge",
    detail:
      "Periodic event that fires every ~15 moves. Short-horizon objective interrupts the loop with a specific chain target. Reward shapes subsequent play.",
    category: "addition",
    status: "idea",
    priority: "P0",
    phase: 5,
    effort: "M",
  },
  {
    id: "purge-event",
    pillar: "pacing",
    title: "Purge event",
    oneLiner: "Clear all tiles of value X — reward: extra modifier slot",
    detail:
      "Mid-run cleanup objective. Player must remove all tiles of a specific value within a deadline. Encourages tactical shifts away from default scoring play.",
    category: "addition",
    status: "idea",
    priority: "P0",
    phase: 5,
    effort: "M",
  },
  {
    id: "feast-event",
    pillar: "pacing",
    title: "Feast event",
    oneLiner: "Next 5 merges score ×2 — but you must make 5 merges",
    detail:
      "Pressure to play aggressively for a brief window. Deadline counter forces tempo change. Reward is upfront; cost is forced play style.",
    category: "addition",
    status: "idea",
    priority: "P1",
    phase: 5,
    effort: "S",
  },
  {
    id: "tyrant-event",
    pillar: "pacing",
    title: "Tyrant event",
    oneLiner: "A void tile spawns — clear adjacent tiles in 10 moves",
    detail:
      "Active threat appears. If unhandled, tyrant escalates (multiplies, spreads). Forces defensive play as primary objective for a brief window.",
    category: "addition",
    status: "idea",
    priority: "P1",
    phase: 5,
    effort: "M",
  },
  {
    id: "blind-event",
    pillar: "pacing",
    title: "Blind event",
    oneLiner: "No spawn queue for 10 moves — score ×2 during",
    detail:
      "Disables lookahead temporarily. Player plays purely reactively. High risk/reward window — bonus score if you can navigate without future info.",
    category: "addition",
    status: "idea",
    priority: "P1",
    phase: 5,
    effort: "S",
  },
  {
    id: "anti-modifiers",
    pillar: "pacing",
    title: "Anti-modifiers",
    oneLiner: "Game-imposed constraints that activate at higher levels",
    detail:
      "As difficulty escalates, the game itself imposes negative modifiers (no undo, harder spawns, score penalties). Creates difficulty-curve variety beyond just bigger numbers.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 5,
    effort: "M",
  },
  {
    id: "movebudget-progression",
    pillar: "pacing",
    title: "Move-budget × progression",
    oneLiner: "Moves Limited mode: gain moves on level-up",
    detail:
      "Today: Moves Limited doesn't refill on level-up — two parallel systems that don't talk. Let level-ups grant +N moves. Now leveling has meaning in this mode.",
    category: "fix",
    status: "shipped",
    priority: "P2",
    phase: 1,
    effort: "S",
  },
  {
    id: "difficulty-spikes",
    pillar: "pacing",
    title: "Periodic difficulty spikes",
    oneLiner: "Every 25 moves, brief intense phase",
    detail:
      "Predictable difficulty waves. Player learns to anticipate spike windows and prepare. Creates rhythm and tension cycles within a run.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 5,
    effort: "M",
  },

  // ── PILLAR 5: CHOICE ─────────────────────────────────────────────
  {
    id: "modifier-draft",
    pillar: "choice",
    title: "Modifier draft system",
    oneLiner: "Pick 2-3 modifiers at run start",
    detail:
      "The keystone richness feature. At run start, player drafts from 5–6 randomly-offered modifiers. Each modifier bends a specific rule. Single highest-leverage system — combinations create emergent builds.",
    category: "addition",
    status: "idea",
    priority: "P0",
    phase: 3,
    effort: "L",
  },
  {
    id: "scoring-modifiers",
    pillar: "choice",
    title: "Scoring modifiers (4)",
    oneLiner: "Prime Hunter, Compound Interest, Glutton, Ascetic",
    detail:
      "Prime Hunter: chains 3/5/7/11 score ×2. Compound Interest: each chain +5% to next. Glutton: chains 8+ score ×3, chains ≤3 score 0. Ascetic: no undo, all scores ×1.3.",
    category: "addition",
    status: "idea",
    priority: "P0",
    phase: 3,
    effort: "M",
  },
  {
    id: "rule-modifiers",
    pillar: "choice",
    title: "Rule modifiers (4)",
    oneLiner: "Fibonacci Forge, Triple Threat, Free Start, Palindrome",
    detail:
      "Fibonacci Forge: merges produce Fibonacci values. Triple Threat: chain extension is 3×. Free Start: step 1 allows doubling. Palindrome: chains valid in reverse.",
    category: "addition",
    status: "idea",
    priority: "P0",
    phase: 3,
    effort: "M",
  },
  {
    id: "spawn-modifiers",
    pillar: "choice",
    title: "Spawn modifiers (3)",
    oneLiner: "Hoarder, Feast or Famine, Echoes",
    detail:
      "Hoarder: 2× tiles of smallest value spawn each turn. Feast or Famine: alternate 0 and 4× spawn turns. Echoes: every spawn includes a ghost matching anything (decays in 2 moves).",
    category: "addition",
    status: "idea",
    priority: "P1",
    phase: 3,
    effort: "M",
  },
  {
    id: "board-modifiers",
    pillar: "choice",
    title: "Board modifiers (3)",
    oneLiner: "Gravity Well, Rotating World, Shrink",
    detail:
      "Gravity Well: tiles 64+ attract equal-value tiles. Rotating World: grid rotates 90° every 10 moves. Shrink: lose a row every 20 moves (rogue-like timer).",
    category: "addition",
    status: "idea",
    priority: "P1",
    phase: 3,
    effort: "L",
  },
  {
    id: "inventory-slot",
    pillar: "choice",
    title: "Inventory slot",
    oneLiner: "Bank 1 tile off-board for later use",
    detail:
      "A single off-board slot. Player can stash one tile there and place it back on the board later. Adds a strategic resource and timing decision to every turn.",
    category: "addition",
    status: "idea",
    priority: "P1",
    phase: 3,
    effort: "M",
  },
  {
    id: "modifier-shop",
    pillar: "choice",
    title: "Mid-run modifier shop",
    oneLiner: "Earn currency, swap or buy modifiers between rounds",
    detail:
      "Currency earned through scoring. Spent at periodic shops on rerolls, swaps, or new modifier purchases. Roguelike economy layered on top of the puzzle.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 3,
    effort: "L",
  },
  {
    id: "modifier-rarities",
    pillar: "choice",
    title: "Modifier rarities",
    oneLiner: "Common / rare / legendary tiers",
    detail:
      "Modifiers have rarity tiers affecting draft probabilities. Rare and legendary modifiers have stronger or more unusual effects. Adds collection appeal and uneven powers.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 3,
    effort: "S",
  },
  {
    id: "modifier-synergies",
    pillar: "choice",
    title: "Modifier synergies",
    oneLiner: "Explicit combo bonuses for specific modifier pairs",
    detail:
      "Some modifier pairs have explicit synergy bonuses (e.g., Compound Interest + Prime Hunter triggers an additional ×1.5). Encourages build construction.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 3,
    effort: "M",
  },
  {
    id: "anti-modifier-rerolls",
    pillar: "choice",
    title: "Anti-modifier rerolls",
    oneLiner: "Once per run, swap a forced anti-modifier",
    detail:
      "If the game forces an anti-modifier on the player (Pacing pillar), player gets one reroll per run. Adds agency to the difficulty escalation system.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 3,
    effort: "S",
  },

  // ── PILLAR 6: PERSISTENCE ────────────────────────────────────────
  {
    id: "modifier-library",
    pillar: "persistence",
    title: "Modifier library unlocks",
    oneLiner: "Start with 10 modifiers; unlock 30 more over time",
    detail:
      "Run completion gates new modifiers. Every player has the same starting 10; veterans have 40+. Each unlock changes the next run's draft pool.",
    category: "addition",
    status: "idea",
    priority: "P0",
    phase: 6,
    effort: "M",
  },
  {
    id: "tile-library",
    pillar: "persistence",
    title: "Tile library unlocks",
    oneLiner: "Gate tile variants behind completion milestones",
    detail:
      "Early runs include 3–4 tile types. Late runs include 15. Tile variety per run scales with player progression — keeping early game accessible, late game rich.",
    category: "addition",
    status: "idea",
    priority: "P0",
    phase: 6,
    effort: "M",
  },
  {
    id: "layout-library",
    pillar: "persistence",
    title: "Layout library unlocks",
    oneLiner: "Beat mode X on layout Y to unlock layout Z",
    detail:
      "Same gating model as modifiers and tiles, applied to board layouts. Each layout is a content-locked option in run setup.",
    category: "addition",
    status: "idea",
    priority: "P1",
    phase: 6,
    effort: "S",
  },
  {
    id: "stakes",
    pillar: "persistence",
    title: "Stakes / difficulty levels",
    oneLiner: "Beat easy → harder stakes unlock with new constraints",
    detail:
      "Roguelike-style stakes ladder. Each stake adds a specific constraint (no undo, shorter event timers, adversarial-only spawn). Replayability via difficulty progression.",
    category: "addition",
    status: "idea",
    priority: "P1",
    phase: 6,
    effort: "M",
  },
  {
    id: "daily-seed",
    pillar: "persistence",
    title: "Daily seed challenges",
    oneLiner: "Same seed for all players each day — global leaderboard",
    detail:
      "Seeded run shared globally each day. Players compete on identical conditions. D1 retention hook — single highest-impact retention pattern in puzzle games.",
    category: "addition",
    status: "idea",
    priority: "P1",
    phase: 6,
    effort: "L",
  },
  {
    id: "achievement-bonuses",
    pillar: "persistence",
    title: "Achievement bonuses",
    oneLiner: "Earn an achievement → start-of-run buff",
    detail:
      "Achievements aren't vanity badges — they grant tangible run-start bonuses (extra undo charge, rerolled draft, starting modifier). Rewards skill expression.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 6,
    effort: "M",
  },
  {
    id: "levelup-board-clear",
    pillar: "persistence",
    title: "Level-up partial board clear",
    oneLiner: "Clear N lowest-value tiles when leveling up",
    detail:
      "Today: level-up resets nothing — late levels play on clogged boards. Clear the N lowest-value tiles on level-up. Each level feels like a fresh challenge with progress preserved.",
    category: "fix",
    status: "shipped",
    priority: "P2",
    phase: 1,
    effort: "S",
  },
  {
    id: "run-history",
    pillar: "persistence",
    title: "Run history with seeds",
    oneLiner: "Replay any past run via seed",
    detail:
      "Today: run logging exists locally but isn't surfaced. Build a run history view; click any run to replay it via its seed. Educational + competitive value.",
    category: "addition",
    status: "idea",
    priority: "P2",
    phase: 6,
    effort: "M",
  },
];

// ── Helpers ────────────────────────────────────────────────────────
export function featuresByPillar(pillarId: PillarId): Feature[] {
  return FEATURES.filter((f) => f.pillar === pillarId);
}

export function featuresByPhase(phase: PhaseNumber): Feature[] {
  return FEATURES.filter((f) => f.phase === phase);
}

export function statusCounts(features: Feature[]): Record<FeatureStatus, number> {
  return features.reduce(
    (acc, f) => {
      acc[f.status] = (acc[f.status] || 0) + 1;
      return acc;
    },
    { idea: 0, spec: 0, building: 0, shipped: 0 } as Record<FeatureStatus, number>
  );
}
