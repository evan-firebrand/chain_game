import { SCENARIO_CATEGORIES, SCENARIOS, buildScenarioState } from "../game/scenarios";
import type { ScenarioBlueprint, ScenarioSettings } from "../game/scenarios";
import type { GameState } from "../game/types";

type Props = {
  settings: ScenarioSettings;
  onLoad: (state: GameState) => void;
  onBack: () => void;
};

function ScenarioCard({ bp, onLoad }: { bp: ScenarioBlueprint; onLoad: () => void }) {
  return (
    <div className="scenario-card">
      <div className="scenario-card-name">{bp.name}</div>
      <div className="scenario-card-desc">{bp.desc}</div>
      <button className="btn btn-ghost scenario-card-btn" onClick={onLoad}>
        Load →
      </button>
    </div>
  );
}

export function ScenariosPage({ settings, onLoad, onBack }: Props) {
  return (
    <div className="scenarios-page">
      <div className="scenarios-inner">
        <div className="scenarios-header">
          <button className="btn btn-ghost scenarios-back" onClick={onBack}>
            ← Back
          </button>
          <div>
            <h1 className="scenarios-title">Scenarios</h1>
            <p className="scenarios-subtitle">Load a board state to test a specific feature</p>
          </div>
        </div>

        {SCENARIO_CATEGORIES.map(({ id, label }) => {
          const items = SCENARIOS.filter((s) => s.category === id);
          if (items.length === 0) return null;
          return (
            <section key={id} className="scenarios-section">
              <h2 className="scenarios-section-title">{label}</h2>
              <div className="scenarios-grid">
                {items.map((bp) => (
                  <ScenarioCard
                    key={bp.id}
                    bp={bp}
                    onLoad={() => onLoad(buildScenarioState(bp, settings))}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
