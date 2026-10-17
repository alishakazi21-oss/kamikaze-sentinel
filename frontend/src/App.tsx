import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { HomePage } from './pages/HomePage';
import { BattlefieldCombatPage } from './pages/BattlefieldCombatPage';
import { ScenarioSetupPage } from './pages/ScenarioSetupPage';
import { LiveSimulationPage } from './pages/LiveSimulationPage';
import { AARPage } from './pages/AARPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { TraineeProfile, UnitProfile, Scenario, AARReport } from './types';
import { soundFx } from './utils/audio';

const DEFAULT_UNITS: UnitProfile[] = [
  { id: 'UNIT-NORTH', name: '14th Strike Corps (Northern Command)', base_location: 'Udhampur Sector' },
  { id: 'UNIT-WEST', name: '9th Desert Surveillance Battalion', base_location: 'Jodhpur Sector' }
];

const DEFAULT_TRAINEES: TraineeProfile[] = [
  { id: 'TRN-701', unit_id: 'UNIT-NORTH', callsign: 'GARUDA-01', rank: 'Captain', current_difficulty: 2 },
  { id: 'TRN-702', unit_id: 'UNIT-NORTH', callsign: 'VALIANT-04', rank: 'Lieutenant', current_difficulty: 1 },
  { id: 'TRN-703', unit_id: 'UNIT-WEST', callsign: 'DESERT-FOX', rank: 'Major', current_difficulty: 3 }
];

export function App() {
  const [currentTab, setCurrentTab] = useState<string>('battlefield'); // Default straight to 3D Soldier Simulation!
  const [units, setUnits] = useState<UnitProfile[]>(DEFAULT_UNITS);
  const [trainees, setTrainees] = useState<TraineeProfile[]>(DEFAULT_TRAINEES);
  const [currentTrainee, setCurrentTrainee] = useState<TraineeProfile | null>(DEFAULT_TRAINEES[0]);

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
          setCurrentTab('battlefield'); // Launch straight into 3D Soldier Combat!
        }
      }
    } catch (e) {
      console.error('Error launching preset', e);
    }
  };

  // Launch scenario from setup
  const handleStartScenario = (scn: Scenario) => {
    setActiveScenario(scn);
    setCurrentTab('battlefield');
  };

  // When 3D Soldier Combat completes
  const handleFinishCombatDrill = (results: {
    duration: number;
    score: number;
    events: any[];
    dronesNeutralized: number;
    dronesTotal: number;
    baseIntegrity: number;
  }) => {
    soundFx.playButtonClick();

    // Create synthetic AAR report from combat drill
    const mockAar: AARReport = {
      session_id: `SES-COMBAT-${Math.floor(1000 + Math.random() * 9000)}`,
      trainee: {
        id: currentTrainee?.id || 'TR-101',
        callsign: currentTrainee?.callsign || 'Viper-1',
        rank: currentTrainee?.rank || 'Flight Lieutenant',
        unit: '12th Garud Air Defense Squadron',
        current_difficulty: currentTrainee?.current_difficulty || 1,
      },
      scenario: activeScenario || {
        id: 'SCN-BATTLEFIELD-01',
        title: '3D Battlefield Tactical Drone Swarm Incursion',
        seed: 777,
        terrain: 'border',
        time_of_day: 'day',
        threat_type: 'swarm_wedge',
        difficulty: currentTrainee?.current_difficulty || 1,
        sensor_state: 'normal',
        sensor_reliability: 0.98,
        clutter_density: 0.08,
        target_count: results.dronesTotal,
        track_source_type: 'native',
      },
      duration_seconds: results.duration,
      score: {
        total_score: results.score,
        detection_score: Math.min(30, (results.score * 0.3)),
        classification_score: Math.min(30, (results.score * 0.3)),
        decision_score: Math.min(40, (results.score * 0.4)),
        avg_detection_latency: 2.8,
        classification_accuracy: results.dronesNeutralized / Math.max(1, results.dronesTotal),
        optimal_decisions_pct: Math.round((results.dronesNeutralized / Math.max(1, results.dronesTotal)) * 100),
        dangerous_errors_count: results.baseIntegrity < 50 ? 1 : 0,
        missed_detections_count: Math.max(0, results.dronesTotal - results.dronesNeutralized),
        ai_assist_agreement_pct: 88,
        coach_feedback: results.dronesNeutralized >= results.dronesTotal
          ? 'Exceptional 3D engagement: All incoming loitering munitions neutralized with directed RF jamming before reaching defensive perimeter.'
          : 'Combat Warning: Drone breached perimeter. Prioritize firing directed RF jammer earlier at maximum effective range (200m).',
      },
      ai_coaching_analysis:
        'Tactical Analysis: Good weapon posture and Smart-Scope usage. Maintain jammer beam steadily on drone fuselage until lift failure occurs.',
      difficulty_change_reason:
        results.score >= 80
          ? 'Promoted difficulty for next sortie based on rapid target neutralizations.'
          : 'Sustained current operational tier to master lead target acquisition.',
      target_events: [
        {
          target_id: 'UAV-HOSTILE-01',
          true_class: 'hostile',
          detected_at: 2.1,
          trainee_classification: 'hostile',
          trainee_response: 'authorise_protective_response',
          decision_outcome: 'Optimal',
          decision_path: 'Directed RF Jammer beam energized on approaching loitering munition causing aerodynamic stall.',
          score_points: 100,
          ai_followed: true,
        },
        {
          target_id: 'SWM-DRONE-02',
          true_class: 'hostile',
          detected_at: 3.5,
          trainee_classification: 'hostile',
          trainee_response: 'authorise_protective_response',
          decision_outcome: 'Optimal',
          decision_path: 'Secondary swarm member jammed successfully.',
          score_points: 90,
          ai_followed: true,
        },
      ],
    };

    setLatestAAR(mockAar);
    setCurrentTab('aar');
  };

  // When live radar simulation completes
  const handleFinishSession = (aarData: AARReport) => {
    setLatestAAR(aarData);
    setCurrentTab('aar');

    if (currentTrainee && aarData.trainee.current_difficulty) {
      setCurrentTrainee((prev) =>
        prev ? { ...prev, current_difficulty: aarData.trainee.current_difficulty } : null
      );
    }
  };

  // Scramble next adaptive sortie from AAR
  const handleScrambleNext = () => {
    setCurrentTab('battlefield');
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

        {currentTab === 'battlefield' && (
          <BattlefieldCombatPage
            currentTrainee={currentTrainee}
            onFinishCombatDrill={handleFinishCombatDrill}
            onSwitchToRadar={() => setCurrentTab('sim')}
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
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setCurrentTab('battlefield')}
                className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold font-mono text-xs transition shadow-lg shadow-cyan-500/20"
              >
                🎮 ENTER 3D SOLDIER BATTLEFIELD
              </button>
              <button
                onClick={() => setCurrentTab('setup')}
                className="px-6 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold font-mono text-xs transition"
              >
                SCENARIO SETUP
              </button>
            </div>
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
            SOLDIER COMBAT SIMULATION & COUNTER-UAS TRAINER - 100% OFFLINE CAPABLE
          </span>
          <span>BUILD v1.0-DEMO // ALL RIGHTS RESERVED</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
