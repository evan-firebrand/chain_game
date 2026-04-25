/**
 * Single CLI entry point. Dispatches to subcommands so agents have one
 * stable interface and one place to discover capabilities.
 *
 *   harness bench          — per-mode benchmark
 *   harness sweep          — board × pool sweep
 *   harness baseline       — capture perf + behaviour baseline
 *   harness study <name>   — run a fixed study under scripts/studies/
 *   harness replay <file>  — re-execute a past run from its manifest
 *   harness describe <topic> — schema endpoints (metrics|bots|modes|algos|all)
 *   harness help           — list commands
 *
 * All subcommands take the same flags as the underlying scripts. JSON output
 * is always written so any past run is replayable.
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, type DescribeTopic } from "./schema";
import { isMainModule } from "./_lib";

import { main as benchMain } from "./benchmark";
import { main as sweepMain } from "./sweep-config";
import { main as baselineMain } from "./baseline";
import { main as compareMain } from "./compare";
import { main as powerMain } from "./power";

const COMMANDS = ["bench", "sweep", "baseline", "study", "replay", "compare", "power", "describe", "help"] as const;
type Command = (typeof COMMANDS)[number];

function help(): void {
  console.log(`
harness — test harness CLI

Subcommands:
  bench [flags]           Per-mode benchmark across spawn algos.
  sweep [flags]           Cartesian sweep over board size and spawn pool.
  baseline [flags]        Capture a perf + behaviour baseline to baselines/.
  study <name> [flags]    Run a fixed study (e.g. wilds-launch).
  replay <manifest.json>  Re-run with the same args/seeds as a past manifest.
  compare <a> <b>         Paired-bootstrap delta CIs between two bench manifests.
  power [flags]           Required N for a target MDE given variance.
  describe <topic>        Schema endpoint: metrics | bots | modes | algos | all.
  help                    This message.

Available studies:
${listStudies().map((s) => `  ${s}`).join("\n")}

Common flags (for run subcommands):
  --seed <uint32>         Master seed (deterministic seed list).
  --seeds <csv>           Explicit seed list (overrides --seed).
  --n <int>               Number of seeds (default per script).
  --max-moves <int>       Per-game move cap (default 300).
  --max-games <int>       Total-game guardrail (default 5000).
  --allow-long            Bypass guardrails for legitimately big runs.
  --out <path>            Override output JSON path.

Examples:
  npx tsx scripts/harness.ts bench --mode classic --n 30
  npx tsx scripts/harness.ts sweep --rows 7,8 --cols 5,6 --pool 4,6 --seeds 30
  npx tsx scripts/harness.ts study wilds-launch --seed 42 --n 30
  npx tsx scripts/harness.ts describe metrics
  npx tsx scripts/harness.ts replay dist/bench-1234.json
`);
}

function listStudies(): string[] {
  const dir = join(import.meta.dirname ?? "scripts", "studies");
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".ts")).map((f) => f.replace(/\.ts$/, ""));
}

async function runStudy(name: string, argv: string[]): Promise<void> {
  if (!name) throw new Error("Usage: harness study <name>. Available: " + listStudies().join(", "));
  const studies = listStudies();
  if (!studies.includes(name)) {
    throw new Error(`Unknown study "${name}". Available: ${studies.join(", ")}`);
  }
  // Dynamic import keeps each study optional and isolates their deps.
  const mod = await import(`./studies/${name}.ts`);
  if (typeof mod.main !== "function") {
    throw new Error(`Study "${name}" does not export main(argv).`);
  }
  mod.main(argv);
}

async function replay(manifestPath: string, extraArgv: string[]): Promise<void> {
  if (!manifestPath) throw new Error("Usage: harness replay <manifest.json>");
  if (!existsSync(manifestPath)) throw new Error(`Manifest not found: ${manifestPath}`);
  const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  const m = raw.manifest ?? raw; // tolerate either {manifest, ...} or flat baseline-style
  const schema = m.schema as string | undefined;
  const args = m.args ?? {};
  const seedList = m.seedList ?? raw.seedList ?? [];

  // Reconstruct argv. We pass --seeds (explicit list) so the replay is bit-exact
  // regardless of the original master seed or seed-list path.
  const replayArgv: string[] = [];
  const push = (k: string, v: unknown) => { if (v !== undefined && v !== null) replayArgv.push(k, String(v)); };

  if (seedList.length > 0) push("--seeds", seedList.join(","));

  // Schema-specific arg reconstruction.
  if (schema === "harness-benchmark") {
    push("--mode", args.mode);
    if (Array.isArray(args.algos) && args.algos.length > 0) push("--algo", args.algos.join(","));
    push("--policy", args.policy);
    push("--max-moves", args.maxMoves);
    console.log(`[replay] benchmark ← ${manifestPath}`);
    benchMain([...replayArgv, ...extraArgv]);
  } else if (schema === "harness-sweep-config") {
    if (Array.isArray(args.rows)) push("--rows", args.rows.join(","));
    if (Array.isArray(args.cols)) push("--cols", args.cols.join(","));
    if (Array.isArray(args.poolSizes)) push("--pool", args.poolSizes.join(","));
    push("--mode", args.mode);
    push("--algo", args.algo);
    push("--policy", args.policy);
    push("--max-moves", args.maxMoves);
    console.log(`[replay] sweep-config ← ${manifestPath}`);
    sweepMain([...replayArgv, ...extraArgv]);
  } else if (schema === "harness-perf-baseline") {
    push("--n", args.n);
    push("--max-moves", args.maxMoves);
    // baseline uses --seed (single uint32, not --seeds list)
    if (m.args?.masterSeed !== undefined) {
      // strip --seeds and pass --seed
      const idx = replayArgv.indexOf("--seeds");
      if (idx !== -1) replayArgv.splice(idx, 2);
      push("--seed", args.masterSeed);
    }
    console.log(`[replay] baseline ← ${manifestPath}`);
    baselineMain([...replayArgv, ...extraArgv]);
  } else if (schema?.startsWith("harness-study-")) {
    const studyName = schema.replace("harness-study-", "");
    push("--n", args.n);
    push("--max-moves", args.maxMoves);
    push("--seed", args.masterSeed);
    // strip --seeds: studies use --seed master, not explicit --seeds, since they
    // generate paired lists internally. Replay with the same master gives the
    // same lists.
    const idx = replayArgv.indexOf("--seeds");
    if (idx !== -1) replayArgv.splice(idx, 2);
    console.log(`[replay] study ${studyName} ← ${manifestPath}`);
    await runStudy(studyName, [...replayArgv, ...extraArgv]);
  } else {
    throw new Error(`Unknown manifest schema: ${schema ?? "(missing)"}.`);
  }
}

function runDescribe(topic: string | undefined): void {
  const valid: DescribeTopic[] = ["metrics", "bots", "modes", "algos", "all"];
  if (!topic || !valid.includes(topic as DescribeTopic)) {
    throw new Error(`Usage: harness describe <${valid.join("|")}>`);
  }
  console.log(JSON.stringify(describe(topic as DescribeTopic), null, 2));
}

export async function main(argv: string[]): Promise<void> {
  const [cmd, ...rest] = argv;
  if (!cmd || cmd === "--help" || cmd === "-h") return help();
  switch (cmd as Command) {
    case "bench":     return benchMain(rest);
    case "sweep":     return sweepMain(rest);
    case "baseline":  return baselineMain(rest);
    case "study": {
      const [name, ...studyArgv] = rest;
      return runStudy(name, studyArgv);
    }
    case "replay": {
      const [path, ...replayArgv] = rest;
      return replay(path, replayArgv);
    }
    case "compare":   return compareMain(rest);
    case "power":     return powerMain(rest);
    case "describe":  return runDescribe(rest[0]);
    case "help":      return help();
    default:
      console.error(`Unknown subcommand: ${cmd}\n`);
      help();
      process.exit(1);
  }
}

if (isMainModule(import.meta.url)) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(`error: ${e.message}`);
    process.exit(1);
  });
}

// Quiet "unused import" — statSync available for future timestamp checks.
void statSync;
