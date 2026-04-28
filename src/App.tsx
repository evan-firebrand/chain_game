import { useEffect, useState } from "react";
import { DevPanel } from "./components/DevPanel";
import { ModeSelect } from "./components/ModeSelect";
import { RoadmapView } from "./components/RoadmapView";
import { ScenariosPage } from "./components/ScenariosPage";
import { useSettingsPersistence } from "./hooks/useSettingsPersistence";
import { useGameController } from "./hooks/useGameController";
import { GameView } from "./views/GameView";
import "./App.css";

export default function App() {
  const [settings, setSettings] = useSettingsPersistence();
  const ctrl = useGameController(settings, setSettings);
  const [devOpen, setDevOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "`" || e.key === "~") setDevOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { state, view, runs, telemetry, actions } = ctrl;
  const elapsedSec = (now - state.startedAt) / 1000;

  const devPanel = devOpen && (
    <DevPanel
      state={state}
      telemetry={telemetry}
      elapsedSec={elapsedSec}
      onNewRunWithSeed={actions.newRunWithSeed}
      algo={settings.algo}
      queueDepth={settings.queueDepth}
      strength={settings.strength}
      softness={settings.softness}
      mode={settings.mode}
      targetsEnabled={settings.targetsEnabled}
      ratchetEnabled={settings.ratchetEnabled}
      boardRows={settings.boardRows}
      boardCols={settings.boardCols}
      poolSize={settings.poolSize}
      onChangeAlgo={actions.changeAlgo}
      onChangeQueueDepth={actions.changeQueueDepth}
      onChangeStrength={actions.changeStrength}
      onChangeSoftness={actions.changeSoftness}
      onChangeMode={actions.changeMode}
      onChangeTargetsEnabled={actions.changeTargetsEnabled}
      onChangeRatchetEnabled={actions.changeRatchetEnabled}
      onChangeBoardSize={actions.changeBoardSize}
      onChangePoolSize={actions.changePoolSize}
      onResetDefaults={actions.resetDefaults}
      runs={runs}
      onRunsChanged={actions.runsChanged}
      onStampModifiers={actions.stampModifiers}
    />
  );

  const appClass = `app${devOpen ? " app-dev-open" : ""}`;

  if (view === "scenarios") {
    return (
      <div className={appClass}>
        <ScenariosPage
          settings={{ algo: settings.algo, strength: settings.strength, softness: settings.softness }}
          onLoad={actions.loadScenario}
          onBack={actions.backToMenu}
        />
      </div>
    );
  }

  if (view === "roadmap") {
    return (
      <div className={appClass}>
        <RoadmapView onBack={actions.backToMenu} />
      </div>
    );
  }

  if (view === "modeSelect") {
    return (
      <div className={appClass}>
        <ModeSelect
          mode={settings.mode}
          ratchetEnabled={settings.ratchetEnabled}
          blindfoldEnabled={settings.blindfoldEnabled}
          onSelectMode={actions.changeMode}
          onToggleRatchet={actions.changeRatchetEnabled}
          onToggleBlindfold={actions.changeBlindfold}
          onStart={actions.startFromMenu}
          onOpenScenarios={actions.openScenarios}
          onOpenRoadmap={actions.openRoadmap}
        />
        {devPanel}
      </div>
    );
  }

  return (
    <div className={appClass}>
      <GameView ctrl={ctrl} settings={settings} />
      {devPanel}
    </div>
  );
}
