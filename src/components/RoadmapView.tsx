import { Fragment, useState, type CSSProperties } from "react";
import "./RoadmapView.css";
import { FEATURES, PHASES, PILLARS } from "../content/roadmap";
import type { Feature, PhaseNumber } from "../content/roadmap";

type Props = { onBack: () => void };
type Tab = "sprint" | "full";

const SPRINT_PHASES: PhaseNumber[] = [1, 2, 3];

export function RoadmapView({ onBack }: Props) {
  const [tab, setTab] = useState<Tab>("sprint");

  return (
    <div className="rm-page">
      <div className="rm-header">
        <button className="btn btn-ghost rm-back" onClick={onBack}>← Back</button>
        <h1 className="rm-title">Product Roadmap</h1>
        <div className="rm-tabs">
          <button
            className={`rm-tab${tab === "sprint" ? " rm-tab-active" : ""}`}
            onClick={() => setTab("sprint")}
          >
            Now · Next · Soon
          </button>
          <button
            className={`rm-tab${tab === "full" ? " rm-tab-active" : ""}`}
            onClick={() => setTab("full")}
          >
            All Phases
          </button>
        </div>
      </div>

      {tab === "sprint" ? <SprintView /> : <SwimlaneView />}
    </div>
  );
}

/* ── Sprint view (phases 1–3) ─────────────────────────────────── */

function SprintView() {
  return (
    <div className="sp-columns">
      {SPRINT_PHASES.map((num) => {
        const phase = PHASES.find((p) => p.number === num)!;
        const features = FEATURES.filter((f) => f.phase === num);
        const p0Count = features.filter((f) => f.priority === "P0").length;
        const fixCount = features.filter((f) => f.category === "fix").length;
        const label = num === 1 ? "Now" : num === 2 ? "Next" : "Soon";
        const hot = num <= 2;

        return (
          <div key={num} className={`sp-col${hot ? " sp-col-hot" : ""}`}>
            <div className="sp-phase-head">
              <div className="sp-phase-top">
                <span className="sp-label">{label}</span>
                <span className="sp-phase-num">Phase {num}</span>
              </div>
              <h2 className="sp-phase-name">{phase.name}</h2>
              <p className="sp-thesis">{phase.thesis}</p>
              <div className="sp-stats">
                {fixCount > 0 && <span className="sp-stat sp-stat-fix">{fixCount} fixes</span>}
                {p0Count > 0 && <span className="sp-stat sp-stat-p0">{p0Count} P0</span>}
                <span className="sp-stat">{features.length} total</span>
              </div>
            </div>

            <div className="sp-pillar-list">
              {PILLARS.map((pillar) => {
                const pf = features.filter((f) => f.pillar === pillar.id);
                if (pf.length === 0) return null;
                return (
                  <div
                    key={pillar.id}
                    className="sp-pillar-group"
                    style={{ "--pa": pillar.accent } as CSSProperties}
                  >
                    <div className="sp-pillar-name">{pillar.title}</div>
                    <ul className="sp-feature-list">
                      {pf.map((f) => (
                        <li key={f.id} className="sp-feature-row" title={f.oneLiner}>
                          <span className={`sp-dot sp-dot-${f.priority.toLowerCase()}${f.category === "fix" ? " sp-dot-fix" : ""}`} />
                          <span className="sp-feature-title">{f.title}</span>
                          {f.category === "fix" && <span className="chip chip-cat cat-fix">fix</span>}
                          <span className={`chip status-${f.status}`}>{f.status}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Full swimlane view (all phases) ─────────────────────────── */

function SwimlaneView() {
  return (
    <div className="rm-grid-wrap">
      <div className="rm-grid">
        <div className="rm-corner" />
        {PHASES.map((ph) => (
          <div key={ph.number} className={`rm-phase-head rm-ph-${ph.number <= 2 ? "hot" : ph.number <= 3 ? "warm" : "cool"}`}>
            <span className="rm-ph-num">Phase {ph.number}</span>
            <span className="rm-ph-name">{ph.name}</span>
          </div>
        ))}
        {PILLARS.map((pillar) => {
          const pillarFeatures = FEATURES.filter((f) => f.pillar === pillar.id);
          return (
            <Fragment key={pillar.id}>
              <div
                className="rm-pillar-label"
                style={{ "--pa": pillar.accent } as CSSProperties}
              >
                <span className="rm-pillar-name">{pillar.title}</span>
                <span className="rm-pillar-q">{pillar.tagline}</span>
                <span className="rm-pillar-count">{pillarFeatures.length}</span>
              </div>
              {PHASES.map((ph) => {
                const cells = pillarFeatures.filter((f) => f.phase === ph.number);
                return (
                  <div key={`${pillar.id}-${ph.number}`} className="rm-cell">
                    {cells.map((f) => (
                      <FeatureCard key={f.id} feature={f} />
                    ))}
                  </div>
                );
              })}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div className={`rm-card rm-card-${feature.status}`} title={feature.oneLiner}>
      <div className="rm-card-chips">
        <span className={`chip chip-pri pri-${feature.priority.toLowerCase()}`}>{feature.priority}</span>
        {feature.category === "fix" && <span className="chip chip-cat cat-fix">fix</span>}
        <span className={`chip status-${feature.status}`}>{feature.status}</span>
      </div>
      <span className="rm-card-title">{feature.title}</span>
    </div>
  );
}
