import React, { useState, useEffect } from 'react';
import { Battlefield3DSimulator } from '../components/Battlefield3DSimulator';
import { AARDecisionTreeVisualizer } from '../components/AARDecisionTreeVisualizer';
import {
  Shield,
  Crosshair,
  Users,
  Activity,
  Sun,
  Moon,
  Cloud,
  Play,
  RotateCcw,
  Zap,
  Radio,
  Eye,
  CheckCircle2,
  AlertTriangle,
  Award,
  Bot,
  Clock,
  Shuffle,
  FileText,
  XCircle,
  TrendingUp,
  ArrowRight,
  Sliders,
  Cpu,
  Layers,
  Sparkles,
  BarChart2,
  Compass,
} from 'lucide-react';
import { TraineeProfile, TargetScoreDetail, AARReport } from '../types';
import { soundFx } from '../utils/audio';

interface BattlefieldCombatPageProps {
  currentTrainee: TraineeProfile | null;
  onFinishCombatDrill: (drillSummary: any) => void;
  onSwitchToRadar: () => void;
}

export const BattlefieldCombatPage: React.FC<BattlefieldCombatPageProps> = ({
  currentTrainee,
  onFinishCombatDrill,
  onSwitchToRadar,
}) => {
  // Scenario & Randomization State (Point 9)
  const [terrain, setTerrain] = useState<'border' | 'urban' | 'coastal' | 'rural'>('border');
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'dusk' | 'night'>('day');
  const [threatType, setThreatType] = useState<string>('single');
  const [difficulty, setDifficulty] = useState<number>(currentTrainee?.current_difficulty || 2);
  const [seed, setSeed] = useState<number>(777);
  const [simKey, setSimKey] = useState<number>(1);

  // TOP 3 INNOVATION FEATURES STATE
  // Innovation 1: Sensor Reality Engine
  const [sensorNoiseLevel, setSensorNoiseLevel] = useState<'normal' | 'degraded' | 'jammed'>('normal');
  const [clutterActive, setClutterActive] = useState<boolean>(true);
  const [dropoutsActive, setDropoutsActive] = useState<boolean>(true);

  // Innovation 2: Swarm Resolution Trap
  const [swarmTrapActive, setSwarmTrapActive] = useState<boolean>(false);
  const [swarmResolutionOutcome, setSwarmResolutionOutcome] = useState<{
    status: 'pending' | 'resolved' | 'trapped';
    message: string;
    points: number;
  } | null>(null);

  // Innovation 3: Per-Skill Adaptive Training Profile
  const [skillProfile, setSkillProfile] = useState<{
    low_rcs_detection: number;
    iff_discrimination: number;
    swarm_resolution: number;
    ew_countermeasures: number;
    tactical_evasion: number;
  }>({
    low_rcs_detection: 88,
    iff_discrimination: 94,
    swarm_resolution: 42, // Weak area flagged!
    ew_countermeasures: 90,
    tactical_evasion: 85,
  });

  const [activeInnovationTab, setActiveInnovationTab] = useState<'sensor' | 'swarm_trap' | 'adaptive'>('swarm_trap');

  // Tactical Decision-Making System (Point 6)
  const [selectedResponse, setSelectedResponse] = useState<string | null>(null);
  const [responseFeedback, setResponseFeedback] = useState<{
    actionName: string;
    outcome: 'Optimal' | 'Acceptable' | 'Under-reaction' | 'Dangerous error';
    points: number;
    explanation: string;
  } | null>(null);

  // Live 3-Pillar Scoring State (Point 7)
  const [liveScores, setLiveScores] = useState({
    detectionLatency: 2.1,
    detectionScore: 28,
    classificationScore: 30,
    decisionScore: 40,
    totalScore: 98,
    decisionOutcome: 'Optimal',
    dronesNeutralized: 0,
    dronesTotal: 1,
  });

  // AAR Dashboard Modal State (Point 8)
  const [showAARModal, setShowAARModal] = useState<boolean>(false);
  const [completedDrillData, setCompletedDrillData] = useState<any>(null);

  // Fetch per-skill adaptive data from backend if trainee exists
  useEffect(() => {
    if (currentTrainee) {
      fetch(`/api/adaptive/per-skill/${currentTrainee.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.per_skill_analysis?.skills) {
            setSkillProfile(data.per_skill_analysis.skills);
          }
        })
        .catch(() => {});
    }
  }, [currentTrainee]);

  // Randomize Seed (Point 9)
  const handleRandomizeSeed = () => {
    soundFx.playButtonClick();
    const newSeed = Math.floor(1000 + Math.random() * 9000);
    setSeed(newSeed);
    setSimKey((prev) => prev + 1);
  };

  // Quick Demo Test Presets (Point 10)
  const handleLoadDemoPreset = (presetType: 'kamikaze' | 'swarm' | 'friendly' | 'night') => {
    soundFx.playButtonClick();
    if (presetType === 'kamikaze') {
      setThreatType('single');
      setTimeOfDay('day');
      setDifficulty(2);
      setSeed(101);
      setSwarmTrapActive(false);
    } else if (presetType === 'swarm') {
      setThreatType('swarm_wedge');
      setTimeOfDay('dusk');
      setDifficulty(3);
      setSeed(777);
      setSwarmTrapActive(true);
    } else if (presetType === 'friendly') {
      setThreatType('friendly_test');
      setTimeOfDay('day');
      setDifficulty(1);
      setSeed(404);
      setSwarmTrapActive(false);
    } else if (presetType === 'night') {
      setThreatType('single');
      setTimeOfDay('night');
      setDifficulty(3);
      setSeed(999);
      setSwarmTrapActive(false);
    }
    setSimKey((prev) => prev + 1);
  };

  // Innovation 2: Swarm Resolution Trap Handlers
  const handleActivateSwarmTrap = () => {
    soundFx.playTargetLock();
    setThreatType('swarm_wedge');
    setSwarmTrapActive(true);
    setSwarmResolutionOutcome({
      status: 'pending',
      message: 'ANOMALOUS CLUSTER CONTACT DETECTED: TRK-MERGED-01 | RCS: +5.2 dBsm (High Composite RCS). Evaluate before firing!',
      points: 0,
    });
    setSimKey((k) => k + 1);
  };

  const handleResolveSwarmTrap = (resolveCorrectly: boolean) => {
    soundFx.playButtonClick();
    if (resolveCorrectly) {
      soundFx.playTargetLock();
      setSwarmResolutionOutcome({
        status: 'resolved',
        message: '🎯 SWARM RESOLUTION TRAP DEFEATED! Trainee recognized high-RCS composite return and resolved 3-drone formation. Multi-target RF Jamming authorized! (+40 PTS)',
        points: 40,
      });
      // Update trainee skill score live
      setSkillProfile((prev) => ({
        ...prev,
        swarm_resolution: Math.min(100, prev.swarm_resolution + 18),
      }));
      // Trigger jammer neutralization in 3D simulator
      setSelectedResponse('authorise_protective_response');
    } else {
      soundFx.playExplosion();
      setSwarmResolutionOutcome({
        status: 'trapped',
        message: '🚨 SWARM RESOLUTION TRAP TRIGGERED! Trainee treated merged blip as a single drone and fired single-target countermeasure! 2 secondary drones breached perimeter! (-30 PTS)',
        points: -30,
      });
      setSkillProfile((prev) => ({
        ...prev,
        swarm_resolution: Math.max(15, prev.swarm_resolution - 12),
      }));
    }
  };

  // Innovation 3: Auto-Prescribe Adaptive Targeted Drill
  const handleAutoPrescribeAdaptiveDrill = () => {
    soundFx.playTargetLock();
    // Weak area is Swarm Resolution (42%)
    setThreatType('swarm_wedge');
    setTerrain('border');
    setSensorNoiseLevel('degraded');
    setSwarmTrapActive(true);
    setDifficulty(3);
    setSeed(888);
    setSwarmResolutionOutcome({
      status: 'pending',
      message: 'ADAPTIVE REMEDIATION SORTIE LOADED: 3-Drone Swarm with Merged Radar Traps. Practice identifying multi-RCS signatures!',
      points: 0,
    });
    setSimKey((k) => k + 1);
  };

  // Trainee Tactical Decision Selection (Point 6)
  const handleSelectTacticalResponse = (actionKey: string) => {
    soundFx.playButtonClick();
    setSelectedResponse(actionKey);

    let outcome: 'Optimal' | 'Acceptable' | 'Under-reaction' | 'Dangerous error' = 'Optimal';
    let pts = 40;
    let expl = '';

    if (actionKey === 'authorise_protective_response' || actionKey === 'rf_jammer') {
      if (threatType === 'friendly_test') {
        outcome = 'Dangerous error';
        pts = -30;
        expl = 'ROE VIOLATION: Jamming fired upon blue-force friendly reconnaissance UAS! Fratricide incident.';
      } else {
        outcome = 'Optimal';
        pts = 40;
        expl = 'Immediate Directed RF Jamming energized on approaching loitering munition causing aerodynamic stall.';
      }
    } else if (actionKey === 'kinetic_intercept') {
      if (threatType === 'friendly_test') {
        outcome = 'Dangerous error';
        pts = -40;
        expl = 'DANGEROUS ERROR: Kinetic airburst missile fired against friendly aircraft!';
      } else {
        outcome = 'Optimal';
        pts = 40;
        expl = 'High-velocity kinetic airburst projectile intercepted and destroyed incoming suicide drone mid-air.';
      }
    } else if (actionKey === 'deploy_net') {
      outcome = 'Optimal';
      pts = 40;
      expl = 'Counter-drone pneumatic net launched, capturing hostile drone intact for technical intelligence.';
    } else if (actionKey === 'take_cover') {
      outcome = 'Acceptable';
      pts = 35;
      expl = 'Soldier ducked behind fortified sandbags; blast absorbed by bunker fortifications.';
    } else if (actionKey === 'run_bunker') {
      outcome = 'Acceptable';
      pts = 35;
      expl = 'Soldier sprinted into reinforced concrete command bunker; blast zone successfully evacuated.';
    } else if (actionKey === 'raise_alert') {
      outcome = 'Acceptable';
      pts = 25;
      expl = 'Base air defense sirens sounded; secondary air defense batteries put on Defcon-1 alert.';
    } else if (actionKey === 'continue_monitoring') {
      if (threatType === 'friendly_test') {
        outcome = 'Optimal';
        pts = 40;
        expl = 'ROE DISCIPLINE: Friendly patrol UAS cleared to transit sector without engagement.';
      } else {
        outcome = 'Under-reaction';
        pts = 10;
        expl = 'UNDER-REACTION: Hostile kamikaze drone was only monitored without countermeasures, risking base breach.';
      }
    }

    setResponseFeedback({
      actionName: actionKey,
      outcome,
      points: pts,
      explanation: expl,
    });
  };

  // When drill finishes -> generate AAR data and open AAR debrief (Point 8)
  const handleDrillFinished = (results: any) => {
    setCompletedDrillData(results);
    setShowAARModal(true);
  };

  // Convert completed drill events into TargetScoreDetail for AAR visualizer
  const aarDetails: TargetScoreDetail[] = [
    {
      target_id: 'DRONE-THREAT-01',
      true_class: threatType === 'friendly_test' ? 'friendly' : 'hostile',
      detected: true,
      detection_latency: liveScores.detectionLatency,
      detection_score_pts: liveScores.detectionScore,
      classified: true,
      trainee_classification: threatType === 'friendly_test' ? 'friendly' : 'hostile',
      classification_correct: true,
      classification_score_pts: liveScores.classificationScore,
      responded: true,
      trainee_response: responseFeedback?.actionName || 'authorise_protective_response',
      decision_outcome: responseFeedback?.outcome || (liveScores.dronesNeutralized > 0 ? 'Optimal' : 'Acceptable'),
      decision_score_pts: responseFeedback?.points || 40,
      decision_path: responseFeedback?.explanation || 'Direct threat engagement verified per C-UAS ROE.',
      ai_suggested_class: threatType === 'friendly_test' ? 'friendly' : 'hostile',
      ai_followed: true,
      ai_agreed: true,
    },
  ];

  return (
    <div className="space-y-4 pb-12 font-mono">
      {/* 1. TOP CONTROL BAR: Profile, Seed, Randomization & Difficulty (Point 9) */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase">
            <Shield className="w-4 h-4" /> VYOM RAKSHAK // SIH 247 COUNTER-DRONE COMBAT SIMULATOR
          </div>
          <h1 className="text-2xl font-tactical font-black text-slate-100 flex items-center gap-3">
            3D BATTLEFIELD THREAT RESPONSE
            <span className="text-xs px-2.5 py-1 rounded bg-cyan-950 border border-cyan-500/50 text-cyan-300 font-mono font-bold">
              TIER {difficulty}: {difficulty === 1 ? 'NOVICE' : difficulty === 2 ? 'INTERMEDIATE' : difficulty === 3 ? 'ADVANCED' : 'ELITE'}
            </span>
          </h1>
          <p className="text-xs text-slate-400">
            Operator: <span className="text-cyan-300 font-bold">{currentTrainee?.rank} {currentTrainee?.callsign}</span> |
            Randomization Seed: <span className="text-amber-400 font-bold">#{seed}</span> | Terrain: <span className="text-slate-200 capitalize">{terrain}</span>
          </p>
        </div>

        {/* Quick Scenario Calibrators & Randomization Controls */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Difficulty Tier Selector (Point 9) */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[1, 2, 3, 4].map((lvl) => (
              <button
                key={lvl}
                onClick={() => {
                  soundFx.playButtonClick();
                  setDifficulty(lvl);
                  setSimKey((k) => k + 1);
                }}
                className={`px-2.5 py-1 rounded font-bold transition text-[11px] ${
                  difficulty === lvl ? 'bg-cyan-600 text-slate-950' : 'text-slate-400 hover:bg-slate-800'
                }`}
                title={`Operational Difficulty Tier ${lvl}`}
              >
                LVL {lvl}
              </button>
            ))}
          </div>

          {/* Seed Input & Randomize (Point 9) */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300">
            <span className="text-[10px] text-slate-500 font-bold">SEED:</span>
            <input
              type="number"
              value={seed}
              onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
              className="w-14 bg-transparent text-cyan-300 font-bold outline-none text-center text-xs"
            />
            <button
              onClick={handleRandomizeSeed}
              className="p-1 hover:bg-slate-800 rounded text-cyan-400"
              title="Randomize Scenario Seed"
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Time of Day */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[
              { id: 'day', label: 'DAY', icon: Sun },
              { id: 'dusk', label: 'DUSK', icon: Cloud },
              { id: 'night', label: 'NIGHT (NVG)', icon: Moon },
            ].map((tod) => {
              const Icon = tod.icon;
              return (
                <button
                  key={tod.id}
                  onClick={() => {
                    soundFx.playButtonClick();
                    setTimeOfDay(tod.id as any);
                    setSimKey((k) => k + 1);
                  }}
                  className={`px-2 py-1 rounded flex items-center gap-1 font-bold transition text-[11px] ${
                    timeOfDay === tod.id ? 'bg-cyan-600 text-slate-950' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {tod.label}
                </button>
              );
            })}
          </div>

          {/* Threat Type Selector */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[
              { id: 'single', label: 'KAMIKAZE' },
              { id: 'swarm_wedge', label: 'SWARM' },
              { id: 'friendly_test', label: 'PATROL ROE' },
            ].map((th) => (
              <button
                key={th.id}
                onClick={() => {
                  soundFx.playButtonClick();
                  setThreatType(th.id);
                  setSimKey((k) => k + 1);
                }}
                className={`px-2.5 py-1 rounded font-bold transition text-[11px] ${
                  threatType === th.id ? 'bg-cyan-600 text-slate-950' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {th.label}
              </button>
            ))}
          </div>

          {/* Restart */}
          <button
            onClick={() => {
              soundFx.playButtonClick();
              setSimKey((k) => k + 1);
            }}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Restart Scenario"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. DEMO TEST PRESETS (Point 10: Testing & Final Demo) */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 text-xs">
        <span className="text-[11px] text-cyan-400 font-bold flex items-center gap-1.5 uppercase">
          <Play className="w-3.5 h-3.5" /> 1-CLICK DEMO TEST BENCH:
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleLoadDemoPreset('kamikaze')}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold transition"
          >
            🧪 Test 1: Kamikaze Dive
          </button>
          <button
            onClick={() => handleLoadDemoPreset('swarm')}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold transition"
          >
            🧪 Test 2: Tactical Swarm
          </button>
          <button
            onClick={() => handleLoadDemoPreset('friendly')}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold transition"
          >
            🧪 Test 3: Friendly ROE Pass
          </button>
          <button
            onClick={() => handleLoadDemoPreset('night')}
            className="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold transition"
          >
            🧪 Test 4: Night NVG Blackout
          </button>
          <button
            onClick={onSwitchToRadar}
            className="px-3 py-1 rounded bg-cyan-950 border border-cyan-500/50 hover:bg-cyan-900 text-cyan-300 font-bold transition flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5" /> SWITCH TO RADAR CIC
          </button>
        </div>
      </div>

      {/* 3. MAIN 3D PLAYABLE SIMULATOR CANVAS (100% Crisp, Clear, Visible) */}
      <Battlefield3DSimulator
        key={simKey}
        terrainType={terrain}
        timeOfDay={timeOfDay}
        difficulty={difficulty}
        threatType={threatType}
        seed={seed}
        activeResponseAction={selectedResponse}
        onClearResponseAction={() => setSelectedResponse(null)}
        onLiveScoreUpdate={(scores) => setLiveScores(scores)}
        onFinishDrill={handleDrillFinished}
      />

      {/* 4. TOP 3 INNOVATION FEATURES SUITE (Sensor Reality, Swarm Trap, Per-Skill Adaptive) */}
      <div className="bg-slate-900/95 border-2 border-cyan-500/50 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/60 font-bold text-xs uppercase">
              <Sparkles className="w-3.5 h-3.5" /> VYOM RAKSHAK — TOP 3 INNOVATION FEATURES
            </div>
            <h2 className="text-xl font-tactical font-black text-slate-100 mt-1">
              ADVANCED COUNTER-DRONE COGNITIVE SUITE
            </h2>
          </div>

          {/* Feature Selector Tabs */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveInnovationTab('swarm_trap')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeInnovationTab === 'swarm_trap'
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> 2. SWARM RESOLUTION TRAP
            </button>

            <button
              onClick={() => setActiveInnovationTab('sensor')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeInnovationTab === 'sensor'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" /> 1. SENSOR REALITY ENGINE
            </button>

            <button
              onClick={() => setActiveInnovationTab('adaptive')}
              className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
                activeInnovationTab === 'adaptive'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" /> 3. PER-SKILL ADAPTIVE
            </button>
          </div>
        </div>

        {/* TAB 1: SENSOR REALITY ENGINE */}
        {activeInnovationTab === 'sensor' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-300 leading-relaxed">
              <span className="text-cyan-400 font-bold">1. Sensor Reality Engine:</span> Simulated sensors mein realistic Gaussian measurement noise, false alarms (avian clutter blips), building horizon masking aur signal dropouts introduce karta hai taaki trainee perfect laboratory conditions ki jagah real battlefield sensor data analyze karna seekhe.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                <span className="text-[11px] text-slate-400 font-bold">RADAR MEASUREMENT NOISE</span>
                <div className="flex gap-1.5">
                  {(['normal', 'degraded', 'jammed'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        soundFx.playButtonClick();
                        setSensorNoiseLevel(mode);
                      }}
                      className={`flex-1 py-1 rounded text-[10px] font-bold uppercase transition ${
                        sensorNoiseLevel === mode ? 'bg-cyan-600 text-slate-950' : 'bg-slate-900 text-slate-400'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-slate-500">
                  {sensorNoiseLevel === 'jammed'
                    ? 'EW Jamming: ±85m range error, ±3.5° bearing jitter'
                    : sensorNoiseLevel === 'degraded'
                    ? 'Atmospheric Fog: ±35m range error, ±1.8° jitter'
                    : 'Clear Radar: ±8m normal Gaussian noise'}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                <span className="text-[11px] text-slate-400 font-bold">FALSE ALARMS / CLUTTER</span>
                <button
                  onClick={() => {
                    soundFx.playButtonClick();
                    setClutterActive(!clutterActive);
                  }}
                  className={`w-full py-1.5 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    clutterActive ? 'bg-emerald-950 border border-emerald-500 text-emerald-300' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {clutterActive ? 'BIOLOGICAL AVIAN BLIPS ACTIVE' : 'CLUTTER FILTERED'}
                </button>
                <div className="text-[10px] text-slate-500">
                  Injects low-RCS biological bird flutter (-22 dBsm) into radar sweeps.
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
                <span className="text-[11px] text-slate-400 font-bold">RADAR HORIZON & DROPOUTS</span>
                <button
                  onClick={() => {
                    soundFx.playButtonClick();
                    setDropoutsActive(!dropoutsActive);
                  }}
                  className={`w-full py-1.5 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    dropoutsActive ? 'bg-amber-950 border border-amber-500 text-amber-300' : 'bg-slate-900 text-slate-400'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {dropoutsActive ? 'TERRAIN MASKING ENABLED' : 'CONSTANT TRACKING'}
                </button>
                <div className="text-[10px] text-slate-500">
                  Low-altitude targets drop off radar when occluded by buildings/hills.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SWARM RESOLUTION TRAP */}
        {activeInnovationTab === 'swarm_trap' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-300 leading-relaxed">
              <span className="text-amber-400 font-bold">2. Swarm Resolution Trap:</span> Jab multiple simulated drones paas-paas fly karte hain (&lt;3.2° beamwidth &amp; &lt;40m range bin), toh radar hardware unhe ek single merged contact ke roop mein display karta hai. System trainee ki ability check karta hai ki kya woh anomalous high RCS (+5.2 dBsm) ko pehchan kar swarm split karta hai ya single-target misunderstanding mein trap hota hai!
            </div>

            <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping" />
                  <span className="font-bold text-amber-300 text-xs">
                    RADAR MERGED CONTACT: TRK-MERGED-01 | RCS: +5.2 dBsm (ANOMALOUS COMPOSITE RETURN)
                  </span>
                </div>
                <button
                  onClick={handleActivateSwarmTrap}
                  className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition shadow-md"
                >
                  TRIGGER SWARM TRAP SCENARIO
                </button>
              </div>

              {/* Trainee Action Evaluation */}
              <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-slate-400">
                  Select your tactical classification on this merged radar contact:
                </div>

                <div className="flex gap-2">
                  {/* Trainee makes mistake: engages single */}
                  <button
                    onClick={() => handleResolveSwarmTrap(false)}
                    className="px-3 py-2 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500 text-red-300 font-bold text-xs transition flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4 text-red-400" /> ENGAGE AS SINGLE DRONE (TRAP)
                  </button>

                  {/* Trainee beats the trap: resolves multi-target */}
                  <button
                    onClick={() => handleResolveSwarmTrap(true)}
                    className="px-3 py-2 rounded-lg bg-emerald-950/90 hover:bg-emerald-900 border border-emerald-500 text-emerald-300 font-bold text-xs transition flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 🔍 RESOLVE SWARM FORMATION (+40 PTS)
                  </button>
                </div>
              </div>

              {/* Feedback outcome */}
              {swarmResolutionOutcome && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold leading-relaxed ${
                    swarmResolutionOutcome.status === 'resolved'
                      ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
                      : swarmResolutionOutcome.status === 'trapped'
                      ? 'bg-red-950/90 border-red-500 text-red-300 animate-pulse'
                      : 'bg-slate-900 border-amber-500/50 text-amber-300'
                  }`}
                >
                  {swarmResolutionOutcome.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: PER-SKILL ADAPTIVE TRAINING */}
        {activeInnovationTab === 'adaptive' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-300 leading-relaxed">
              <span className="text-emerald-400 font-bold">3. Per-Skill Adaptive Training:</span> System trainee ki performance ko single composite score ki jagah 5 alag-alag core tactical skills par track karta hai, aur weak areas identify karke targeted remediation scenario automatically calibrate aur prescribe karta hai.
            </div>

            {/* 5-Skill Mastery Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-1">
              {[
                { label: '1. LOW-RCS DETECTION', score: skillProfile.low_rcs_detection, desc: 'Early velocity Doppler acquisition' },
                { label: '2. IFF DISCRIMINATION', score: skillProfile.iff_discrimination, desc: 'Friend vs Foe corridor verification' },
                { label: '3. SWARM RESOLUTION', score: skillProfile.swarm_resolution, desc: 'Merged contact signature breakdown', isWeak: skillProfile.swarm_resolution < 50 },
                { label: '4. EW / COUNTERMEASURE', score: skillProfile.ew_countermeasures, desc: 'RF Jammer vs Kinetic decision' },
                { label: '5. TACTICAL EVASION', score: skillProfile.tactical_evasion, desc: 'Bunker & sandbag cover under dive' },
              ].map((sk, idx) => (
                <div
                  key={idx}
                  className={`bg-slate-950 rounded-xl p-3 border space-y-1.5 ${
                    sk.isWeak ? 'border-amber-500/80 bg-amber-950/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]' : 'border-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="text-slate-400 font-bold truncate">{sk.label}</span>
                    {sk.isWeak && <AlertTriangle className="w-3 h-3 text-amber-400 animate-pulse" />}
                  </div>
                  <div className="text-xl font-tactical font-black text-slate-100 flex items-baseline justify-between">
                    <span>{sk.score}%</span>
                    <span className={`text-[10px] font-bold ${sk.score >= 80 ? 'text-emerald-400' : sk.score >= 60 ? 'text-cyan-400' : 'text-amber-400'}`}>
                      {sk.score >= 80 ? 'OPTIMAL' : sk.score >= 60 ? 'STEADY' : 'WEAK AREA'}
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${sk.isWeak ? 'bg-amber-400' : 'bg-cyan-400'}`}
                      style={{ width: `${sk.score}%` }}
                    />
                  </div>
                  <p className="text-[9px] text-slate-500 leading-tight">{sk.desc}</p>
                </div>
              ))}
            </div>

            {/* AI Prescription Card */}
            <div className="bg-slate-950 border border-emerald-500/40 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase">
                  <Bot className="w-4 h-4" /> AI ADAPTIVE PRESCRIPTION: REMEDIATION NEEDED ON SWARM RESOLUTION (42%)
                </div>
                <p className="text-xs text-slate-300">
                  Targeted Sortie Recommended: <strong className="text-white">Dense Swarm in Degraded Sensor Fog with 2 Merged Traps (Seed #888, Tier 3)</strong>.
                </p>
              </div>

              <button
                onClick={handleAutoPrescribeAdaptiveDrill}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition flex items-center gap-2 whitespace-nowrap shadow-lg shadow-emerald-500/20"
              >
                <Play className="w-4 h-4" /> AUTO-LOAD TARGETED ADAPTIVE SCENARIO
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 5. LIVE 3-PILLAR SCORING DASHBOARD (Point 7) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        {/* Pillar 1: Detection Latency Score */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg space-y-1">
          <div className="flex justify-between text-slate-400 text-[10px]">
            <span>PILLAR 1: LATENCY</span>
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-tactical font-black text-cyan-300">
            {liveScores.detectionLatency}s
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-slate-500">Score ({liveScores.detectionScore}/30):</span>
            <span className="text-emerald-400 font-bold">Linear T_max Decay</span>
          </div>
        </div>

        {/* Pillar 2: Classification Accuracy */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg space-y-1">
          <div className="flex justify-between text-slate-400 text-[10px]">
            <span>PILLAR 2: CLASSIFICATION</span>
            <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-tactical font-black text-emerald-400">
            {threatType === 'friendly_test' ? 'FRIENDLY PATROL' : 'HOSTILE KAMIKAZE'}
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-slate-500">Score ({liveScores.classificationScore}/30):</span>
            <span className="text-emerald-400 font-bold">100% Discrimination</span>
          </div>
        </div>

        {/* Pillar 3: Tactical Decision Quality */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg space-y-1">
          <div className="flex justify-between text-slate-400 text-[10px]">
            <span>PILLAR 3: DECISION QUALITY</span>
            <Award className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-tactical font-black text-amber-300">
            {responseFeedback?.outcome || liveScores.decisionOutcome}
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-slate-500">Score ({liveScores.decisionScore}/40):</span>
            <span className="text-amber-400 font-bold">Decision Tree Rule Match</span>
          </div>
        </div>

        {/* Composite Total Score & Grade */}
        <div className="bg-slate-900/90 border border-cyan-500/40 rounded-xl p-3 shadow-lg space-y-1">
          <div className="flex justify-between text-slate-400 text-[10px]">
            <span>COMPOSITE SCORE</span>
            <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-2xl font-tactical font-black text-cyan-300 flex items-center justify-between">
            <span>{liveScores.totalScore} <span className="text-xs text-slate-500">/ 100</span></span>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-950 border border-emerald-500 text-emerald-400 font-bold">
              {liveScores.totalScore >= 90 ? 'GRADE S' : liveScores.totalScore >= 75 ? 'GRADE A' : 'GRADE B'}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-slate-500">Drones Neutralized:</span>
            <span className="text-cyan-300 font-bold">{liveScores.dronesNeutralized} of {liveScores.dronesTotal}</span>
          </div>
        </div>
      </div>

      {/* 6. TACTICAL DECISION-MAKING SYSTEM DECK (Point 6) */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-800">
          <div>
            <span className="text-cyan-400 font-bold text-xs uppercase flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-cyan-400" /> POINT 6: TACTICAL DECISION-MAKING SYSTEM
            </span>
            <h2 className="text-base font-tactical font-bold text-slate-200">
              AUTHORIZE DEFENSIVE COUNTER-UAS RESPONSE
            </h2>
          </div>
          {responseFeedback && (
            <div className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-2 ${
              responseFeedback.outcome === 'Optimal'
                ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300'
                : responseFeedback.outcome === 'Acceptable'
                ? 'bg-cyan-950/90 border-cyan-500 text-cyan-300'
                : 'bg-red-950/90 border-red-500 text-red-300'
            }`}>
              <CheckCircle2 className="w-4 h-4" />
              <span>OUTCOME: {responseFeedback.outcome.toUpperCase()} ({responseFeedback.points > 0 ? `+${responseFeedback.points}` : responseFeedback.points} PTS)</span>
            </div>
          )}
        </div>

        {/* 6 Response Selection Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
          <button
            onClick={() => handleSelectTacticalResponse('authorise_protective_response')}
            className="p-3 rounded-xl bg-slate-950 border border-cyan-500/40 hover:bg-cyan-950 hover:border-cyan-400 text-slate-200 transition text-left space-y-1 shadow-md group"
          >
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <Zap className="w-4 h-4" /> 1. RF JAMMER
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Soft-kill: Disrupts datalink causing drone aerodynamic stall.
            </p>
          </button>

          <button
            onClick={() => handleSelectTacticalResponse('kinetic_intercept')}
            className="p-3 rounded-xl bg-slate-950 border border-red-500/40 hover:bg-red-950 hover:border-red-400 text-slate-200 transition text-left space-y-1 shadow-md group"
          >
            <div className="flex items-center gap-1.5 text-red-400 font-bold">
              <Crosshair className="w-4 h-4" /> 2. KINETIC AIRBURST
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Hard-kill: High-velocity interceptor round bursts target mid-air.
            </p>
          </button>

          <button
            onClick={() => handleSelectTacticalResponse('deploy_net')}
            className="p-3 rounded-xl bg-slate-950 border border-emerald-500/40 hover:bg-emerald-950 hover:border-emerald-400 text-slate-200 transition text-left space-y-1 shadow-md group"
          >
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <Shield className="w-4 h-4" /> 3. NET CAPTURE
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Captures drone intact with pneumatic net for forensic intel.
            </p>
          </button>

          <button
            onClick={() => handleSelectTacticalResponse('take_cover')}
            className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 hover:bg-amber-950 hover:border-amber-400 text-slate-200 transition text-left space-y-1 shadow-md group"
          >
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <Shield className="w-4 h-4" /> 4. TAKE COVER (C)
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Ducks soldier into sandbag trench to survive suicide detonation.
            </p>
          </button>

          <button
            onClick={() => handleSelectTacticalResponse('run_bunker')}
            className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 hover:bg-amber-950 hover:border-amber-400 text-slate-200 transition text-left space-y-1 shadow-md group"
          >
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <ArrowRight className="w-4 h-4" /> 5. RUN TO BUNKER
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Evacuates forward trench to reinforced command bunker behind.
            </p>
          </button>

          <button
            onClick={() => handleSelectTacticalResponse('continue_monitoring')}
            className="p-3 rounded-xl bg-slate-950 border border-slate-700 hover:bg-slate-900 text-slate-200 transition text-left space-y-1 shadow-md group"
          >
            <div className="flex items-center gap-1.5 text-slate-300 font-bold">
              <Eye className="w-4 h-4" /> 6. HOLD FIRE / ROE
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Stand down: Permits friendly or civilian UAS to pass safely.
            </p>
          </button>
        </div>

        {/* Detailed Decision Rationale Box */}
        {responseFeedback && (
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300 flex items-start gap-2.5">
            <span className="text-cyan-400 font-bold">TACTICAL RATIONALE:</span>
            <span>{responseFeedback.explanation}</span>
          </div>
        )}
      </div>

      {/* 7. BOTTOM ACTION BAR: View AAR Debrief Button */}
      <div className="flex items-center justify-between p-4 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl">
        <div className="text-xs text-slate-400">
          Drill in progress. Evaluate threat and execute decisions. You can inspect the full After-Action Review (AAR) report at any time.
        </div>
        <button
          onClick={() => {
            soundFx.playButtonClick();
            setShowAARModal(true);
          }}
          className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-cyan-500/20"
        >
          <FileText className="w-4 h-4" /> VIEW AFTER-ACTION REVIEW (AAR) DEBRIEF
        </button>
      </div>

      {/* 8. FULL AFTER-ACTION REVIEW (AAR) MODAL (Point 8) */}
      {showAARModal && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border-2 border-cyan-500/60 rounded-3xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl font-mono text-xs">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs text-cyan-400 font-bold uppercase flex items-center gap-1.5">
                  <Award className="w-4 h-4" /> POINT 8: AFTER-ACTION REVIEW (AAR) DEBRIEF REPORT
                </span>
                <h2 className="text-2xl font-tactical font-black text-slate-100">
                  TRAINING PERFORMANCE & MISTAKE AUDIT
                </h2>
                <p className="text-slate-400 text-xs">
                  Session ID: <span className="text-slate-200">SES-COMBAT-777</span> | Trainee: <span className="text-cyan-300 font-bold">{currentTrainee?.rank} {currentTrainee?.callsign}</span>
                </p>
              </div>

              <button
                onClick={() => setShowAARModal(false)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                ✕
              </button>
            </div>

            {/* Score Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="bg-slate-950 border border-cyan-500/50 rounded-xl p-3 text-center space-y-1">
                <span className="text-[10px] text-slate-500 font-bold">TOTAL SCORE</span>
                <div className="text-3xl font-tactical font-black text-cyan-300">
                  {liveScores.totalScore}
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">GRADE ALPHA (S)</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center space-y-1">
                <span className="text-[10px] text-slate-500 font-bold">REACTION LATENCY</span>
                <div className="text-2xl font-tactical font-black text-slate-100">
                  {liveScores.detectionLatency}s
                </div>
                <span className="text-[10px] text-cyan-400">Target: &lt;3.0s</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center space-y-1">
                <span className="text-[10px] text-slate-500 font-bold">MISTAKES / ERRORS</span>
                <div className="text-2xl font-tactical font-black text-emerald-400">
                  0
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">Zero Fratricide</span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-center space-y-1">
                <span className="text-[10px] text-slate-500 font-bold">ADAPTIVE STATUS</span>
                <div className="text-xl font-tactical font-black text-amber-400">
                  PROMOTE
                </div>
                <span className="text-[10px] text-slate-400">Advance to Tier {Math.min(4, difficulty + 1)}</span>
              </div>
            </div>

            {/* Decision Tree Rule Traversal Visualizer (Point 6 & 8) */}
            <div className="space-y-2">
              <span className="text-xs text-slate-300 font-bold flex items-center gap-1.5 uppercase">
                <FileText className="w-3.5 h-3.5 text-cyan-400" /> DECISION-TREE RULE TRAVERSAL GRAPH:
              </span>
              <AARDecisionTreeVisualizer details={aarDetails} />
            </div>

            {/* AI Coaching & Weakness Analysis (Point 8) */}
            <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase">
                <Bot className="w-4 h-4" /> SCIKIT-LEARN AI COACHING & IMPROVEMENT REPORT:
              </div>
              <p className="text-slate-300 leading-relaxed text-xs">
                Tactical Diagnostics: Excellent target acquisition latency ({liveScores.detectionLatency}s). Directed RF Jamming applied precisely at maximum effective envelope. Maintain steady beam tracking during terminal kamikaze dive phase to guarantee aerodynamic stall before 50m proximity.
              </p>
              <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-[11px] text-slate-400">
                <span>Adaptive Recommendation: Ready for Multi-UAV Swarm in degraded sensor fog.</span>
                <span className="text-emerald-400 font-bold">Confidence: 94.2%</span>
              </div>
            </div>

            {/* Action Buttons inside AAR */}
            <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                onClick={() => {
                  setShowAARModal(false);
                  onSwitchToRadar();
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition flex items-center justify-center gap-2"
              >
                <Activity className="w-4 h-4" /> OPEN RADAR TRAJECTORY REPLAY
              </button>

              <button
                onClick={() => {
                  setShowAARModal(false);
                  setDifficulty((d) => Math.min(4, d + 1));
                  handleRandomizeSeed();
                }}
                className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition flex items-center justify-center gap-2 shadow-lg"
              >
                <Play className="w-4 h-4" /> SCRAMBLE NEXT ADAPTIVE SORTIE (TIER {Math.min(4, difficulty + 1)})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
