import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HomePage } from './pages/HomePage';
import { ScenarioSetupPage } from './pages/ScenarioSetupPage';
import { LiveSimulationPage } from './pages/LiveSimulationPage';
import { AARPage } from './pages/AARPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { TraineeProfile, UnitProfile, Scenario, AARReport } from './types';
import { soundFx } from './utils/audio';

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('home');
  const [units, setUnits] = useState<UnitProfile[]>([]);
  const [trainees, setTrainees] = useState<TraineeProfile[]>([]);
  const [currentTrainee, setCurrentTrainee] = useState<TraineeProfile | null>(null);

  const [activeScenario, setActiveScenario] = useState<Scenario | null>(null);
  const [latestAAR, setLatestAAR] = useState<AARReport | null>(null);

  // Load profiles from backend
  useEffect(() => {
    fetch('/api/profiles')
      .then((res) => res.json())
      .then((data) => {
        if (data.units && data.units.length > 0) {
          setUnits(data.units);
        }
        if (data.trainees && data.trainees.length > 0) {
          setTrainees(data.trainees);
          setCurrentTrainee(data.trainees[0]);
        }
      })
      .catch((e) => console.error('Error fetching profiles', e));
  }, []);

  // Quick Scramble preset from Home
  const handleStartPreset = async (presetId: string) => {
    try {
      const presetsRes = await fetch('/api/scenarios/presets');
      const presetsData = await presetsRes.json();
      const preset = presetsData.presets?.find((p: any) => p.id === presetId);

      if (preset) {
        const genRes = await fetch('/api/scenarios/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: preset.title,
            seed: preset.seed,
            terrain: preset.terrain,
            time_of_day: preset.time_of_day,
            threat_type: preset.threat_type,
            difficulty: preset.difficulty,
            sensor_state: preset.sensor_state,
            sensor_reliability: preset.sensor_reliability,
            target_count: preset.target_count,
            track_source_type: preset.track_source_type,
          }),
        });

        if (genRes.ok) {
          const scn = await genRes.json();
          setActiveScenario(scn);
          setCurrentTab('sim');
        }
      }
    } catch (e) {
      console.error('Error launching preset', e);
    }
  };

  // Launch scenario from setup
  const handleStartScenario = (scn: Scenario) => {
    setActiveScenario(scn);
    setCurrentTab('sim');
  };

  // When live simulation completes
  const handleFinishSession = (aarData: AARReport) => {
    setLatestAAR(aarData);
    setCurrentTab('aar');

    // Refresh trainee difficulty in state
    if (currentTrainee && aarData.trainee.current_difficulty) {
      setCurrentTrainee((prev) =>
        prev ? { ...prev, current_difficulty: aarData.trainee.current_difficulty } : null
      );
    }
  };

  // Scramble next adaptive sortie from AAR
  const handleScrambleNext = () => {
    setCurrentTab('setup');
  };

  const currentUnit = units.find((u) => u.id === currentTrainee?.unit_id) || units[0] || null;

  return (
    <div className="min-h-screen bg-[#060a12] text-slate-100 flex flex-col font-sans">
      <Header
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        units={units}
        trainees={trainees}
        currentTrainee={currentTrainee}
        onSelectTrainee={(t) => setCurrentTrainee(t)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 pt-6">
        {currentTab === 'home' && (
          <HomePage
            onStartPreset={handleStartPreset}
            onNavigate={(tab) => setCurrentTab(tab)}
            currentTrainee={currentTrainee}
            currentUnit={currentUnit}
          />
        )}

        {currentTab === 'setup' && (
          <ScenarioSetupPage
            onStartScenario={handleStartScenario}
            defaultDifficulty={currentTrainee?.current_difficulty || 1}
          />
        )}

        {currentTab === 'sim' && activeScenario && currentTrainee && (
          <LiveSimulationPage
            scenario={activeScenario}
            trainee={currentTrainee}
            onFinishSession={handleFinishSession}
          />
        )}

        {currentTab === 'sim' && (!activeScenario || !currentTrainee) && (
          <div className="text-center py-24 font-mono space-y-4">
            <div className="text-slate-400 text-lg">NO ACTIVE TACTICAL SCENARIO</div>
            <p className="text-slate-500 text-xs">Configure a scenario or quick scramble from Command Overview.</p>
            <button
              onClick={() => setCurrentTab('setup')}
              className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-xs transition"
            >
              GO TO SCENARIO SETUP
            </button>
          </div>
        )}

        {currentTab === 'aar' && (
          <AARPage
            aarData={latestAAR}
            onScrambleNext={handleScrambleNext}
            onNavigate={(tab) => setCurrentTab(tab)}
          />
        )}

        {currentTab === 'analytics' && (
          <AnalyticsPage currentTrainee={currentTrainee} units={units} />
        )}

        {currentTab === 'diagnostics' && <DiagnosticsPage />}
      </main>

      {/* Military Status Footer */}
      <footer className="bg-slate-950/80 border-t border-slate-900 py-3 text-center text-[10px] font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <span>ASTRA VEER // DEFENCE SERVICES STAFF COLLEGE (SIH 247)</span>
          <span className="text-cyan-400/80">
            SIMULATED TRAINING PLATFORM ONLY - STRICTLY OFFLINE CAPABLE - ZERO OPERATIONAL LINK
          </span>
          <span>BUILD v1.0-DEMO // ALL RIGHTS RESERVED</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
