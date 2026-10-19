import React, { useState, useEffect } from 'react';
import { Sliders, Shield, Sun, Moon, Cloud, Crosshair, Users, Radio, Lock, Shuffle, Play } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface ScenarioSetupPageProps {
  onStartScenario: (scenarioData: any) => void;
  defaultDifficulty?: number;
}

export const ScenarioSetupPage: React.FC<ScenarioSetupPageProps> = ({
  onStartScenario,
  defaultDifficulty = 1,
}) => {
  const [terrain, setTerrain] = useState<'urban' | 'rural' | 'border' | 'coastal'>('border');
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'dusk' | 'night'>('day');
  const [threatType, setThreatType] = useState<string>('swarm_wedge');
  const [targetCount, setTargetCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<number>(defaultDifficulty);
  const [sensorState, setSensorState] = useState<'normal' | 'degraded' | 'jammed'>('normal');
  const [sensorReliability, setSensorReliability] = useState<number>(0.95);
  const [seed, setSeed] = useState<number>(() => Math.floor(1000 + Math.random() * 9000));
  const [trackSource, setTrackSource] = useState<string>('native');
  const [sourcesList, setSourcesList] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Fetch track source availability
  useEffect(() => {
    fetch('/api/sources')
      .then((res) => res.json())
      .then((data) => {
        if (data.sources) setSourcesList(data.sources);
      })
      .catch((e) => console.error(e));
  }, []);

  const handleRandomizeSeed = () => {
    soundFx.playButtonClick();
    setSeed(Math.floor(1000 + Math.random() * 9000));
  };

  const handleLaunchDrill = async () => {
    soundFx.playTargetLock();
    setLoading(true);

    try {
      const payload = {
        title: `Tactical Drill: ${threatType.toUpperCase().replace('_', ' ')} in ${terrain.toUpperCase()}`,
        seed: seed,
        terrain: terrain,
        time_of_day: timeOfDay,
        threat_type: threatType,
        difficulty: difficulty,
        sensor_state: sensorState,
        sensor_reliability: sensorReliability,
        target_count: targetCount,
        track_source_type: trackSource,
      };

      const res = await fetch('/api/scenarios/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const scn = await res.json();
        onStartScenario(scn);
      }
    } catch (e) {
      console.error('Error generating scenario', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs font-bold uppercase">
            <Sliders className="w-4 h-4" /> MISSION PARAMETER CALIBRATION
          </div>
          <h1 className="text-3xl font-tactical font-black text-slate-100">
            SCENARIO SETUP & THREAT PROFILING
          </h1>
          <p className="text-xs text-slate-400">
            Customize environmental variables, swarm formations, sensor fidelity, and reproducible seed determinism.
          </p>
        </div>

        {/* Seed Controls */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 font-mono text-xs">
          <Lock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">SEED:</span>
          <input
            type="number"
            value={seed}
            onChange={(e) => setSeed(parseInt(e.target.value) || 0)}
            className="w-20 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-cyan-300 font-bold outline-none text-center"
          />
          <button
            onClick={handleRandomizeSeed}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Generate Random Seed"
          >
            <Shuffle className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Terrain & Environment */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-tactical font-bold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            1. OPERATIONAL TERRAIN
          </h2>

          <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
            {[
              { id: 'border', label: 'BORDER MOUNTAIN', desc: 'High relief, elevation masking' },
              { id: 'urban', label: 'URBAN METROPOLIS', desc: 'Tall building radar shadows' },
              { id: 'coastal', label: 'COASTAL NAVAL BASE', desc: 'Sea skimming, low clutter' },
              { id: 'rural', label: 'RURAL PLAINS', desc: 'Open line-of-sight radar' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  soundFx.playButtonClick();
                  setTerrain(t.id as any);
                }}
                className={`p-3 rounded-xl border text-left transition ${
                  terrain === t.id
                    ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold">{t.label}</div>
                <div className="text-[10px] text-slate-500 mt-1">{t.desc}</div>
              </button>
            ))}
          </div>

          <h2 className="text-sm font-tactical font-bold text-slate-200 pt-3 border-t border-slate-800 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            2. TIME OF DAY & LIGHTING
          </h2>

          <div className="grid grid-cols-3 gap-2 font-mono text-xs">
            {[
              { id: 'day', label: 'DAYLIGHT', icon: Sun, desc: 'High optical contrast' },
              { id: 'dusk', label: 'DUSK / FOG', icon: Cloud, desc: 'Ambient cooling' },
              { id: 'night', label: 'PITCH NIGHT', icon: Moon, desc: 'FLIR thermal only' },
            ].map((tod) => {
              const Icon = tod.icon;
              return (
                <button
                  key={tod.id}
                  onClick={() => {
                    soundFx.playButtonClick();
                    setTimeOfDay(tod.id as any);
                  }}
                  className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                    timeOfDay === tod.id
                      ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10'
                      : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-4 h-4 text-cyan-400" />
                  <div className="font-bold text-[11px]">{tod.label}</div>
                  <div className="text-[9px] text-slate-500">{tod.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Threat Configuration & Swarms */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-tactical font-bold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            3. THREAT FORMATION & SWARM DYNAMICS
          </h2>

          <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
            {[
              { id: 'single', label: 'SINGLE DRONE', desc: 'Isolated high-speed recon' },
              { id: 'swarm_wedge', label: 'SWARM WEDGE', desc: 'Apex leader + staggered wings' },
              { id: 'swarm_leader', label: 'LEADER-FOLLOWER', desc: 'Linear column echelon' },
              { id: 'swarm_line', label: 'LINE ABREAST', desc: 'Broad simultaneous front' },
              { id: 'decoy_mixed', label: 'MIXED DECOYS', desc: 'Drones masked with birds' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  soundFx.playButtonClick();
                  setThreatType(f.id);
                }}
                className={`p-3 rounded-xl border text-left transition ${
                  threatType === f.id
                    ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold">{f.label}</div>
                <div className="text-[10px] text-slate-500 mt-1">{f.desc}</div>
              </button>
            ))}
          </div>

          {/* Target Count Slider */}
          <div className="space-y-1.5 pt-3 border-t border-slate-800 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">SIMULTANEOUS TARGETS:</span>
              <span className="text-cyan-400 font-bold">{targetCount} CONTACTS</span>
            </div>
            <input
              type="range"
              min={3}
              max={12}
              value={targetCount}
              onChange={(e) => setTargetCount(parseInt(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>3 (Minimal)</span>
              <span>8 (Tactical)</span>
              <span>12 (Heavy Swarm)</span>
            </div>
          </div>
        </div>

        {/* 3. Sensor Fidelity & EW Environment */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-tactical font-bold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            4. SENSOR FIDELITY & RADAR INTEGRITY
          </h2>

          <div className="grid grid-cols-3 gap-2 font-mono text-xs">
            {[
              { id: 'normal', label: 'NORMAL', desc: '98% reliability, low noise' },
              { id: 'degraded', label: 'DEGRADED', desc: '85% reliability, dropouts' },
              { id: 'jammed', label: 'EW JAMMED', desc: '70% reliability, false blips' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  soundFx.playButtonClick();
                  setSensorState(s.id as any);
                  setSensorReliability(s.id === 'normal' ? 0.98 : s.id === 'degraded' ? 0.85 : 0.70);
                }}
                className={`p-3 rounded-xl border text-center transition flex flex-col items-center gap-1 ${
                  sensorState === s.id
                    ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="font-bold text-[11px]">{s.label}</div>
                <div className="text-[9px] text-slate-500">{s.desc}</div>
              </button>
            ))}
          </div>

          <div className="space-y-1.5 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">SENSOR UPDATE RELIABILITY:</span>
              <span className="text-emerald-400 font-bold">{Math.round(sensorReliability * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1.0}
              step={0.05}
              value={sensorReliability}
              onChange={(e) => setSensorReliability(parseFloat(e.target.value))}
              className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
            />
          </div>
        </div>

        {/* 4. Track Source Selector & Difficulty */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h2 className="text-sm font-tactical font-bold text-slate-200 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            5. TRACK SOURCE ADAPTER
          </h2>

          <div className="space-y-2 font-mono text-xs">
            {[
              { id: 'native', name: 'KAMIKAZE SENTINEL NATIVE SIM', status: 'ACTIVE (0 GPU)', badge: 'bg-emerald-950 text-emerald-400 border-emerald-500/50' },
              { id: 'replay', name: 'FLIGHT TELEMETRY REPLAY', status: 'READY (JSON)', badge: 'bg-cyan-950 text-cyan-400 border-cyan-700/50' },
              { id: 'airsim', name: 'COSYS-AIRSIM (UE5)', status: 'STANDBY / LAB ONLY', badge: 'bg-slate-800 text-slate-400 border-slate-700' },
            ].map((src) => (
              <label
                key={src.id}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                  trackSource === src.id
                    ? 'bg-slate-950 border-cyan-500 text-slate-200 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <input
                    type="radio"
                    name="trackSource"
                    value={src.id}
                    checked={trackSource === src.id}
                    onChange={() => {
                      soundFx.playButtonClick();
                      setTrackSource(src.id);
                    }}
                    className="accent-cyan-500"
                  />
                  <span className="font-bold">{src.name}</span>
                </div>
                <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${src.badge}`}>
                  {src.status}
                </span>
              </label>
            ))}
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-800 font-mono text-xs">
            <span className="text-slate-400 font-bold">OPERATIONAL DIFFICULTY:</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { lvl: 1, label: 'CADET (6s)' },
                { lvl: 2, label: 'TACTICAL (4.5s)' },
                { lvl: 3, label: 'COMMANDER (3s)' },
              ].map((d) => (
                <button
                  key={d.lvl}
                  onClick={() => {
                    soundFx.playButtonClick();
                    setDifficulty(d.lvl);
                  }}
                  className={`py-2 rounded-lg border font-bold transition text-xs ${
                    difficulty === d.lvl
                      ? 'bg-cyan-600 text-slate-950 border-cyan-400'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Launch Mission Button */}
      <div className="flex justify-center pt-4">
        <button
          disabled={loading}
          onClick={handleLaunchDrill}
          className="px-10 py-4 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold font-mono text-base flex items-center gap-3 shadow-xl shadow-cyan-500/20 tactical-glow-cyan transition"
        >
          <Play className="w-5 h-5 fill-current" />
          {loading ? 'INITIALIZING RADAR AIRSPACE...' : 'SCRAMBLE TACTICAL SORTIE NOW'}
        </button>
      </div>
    </div>
  );
};
