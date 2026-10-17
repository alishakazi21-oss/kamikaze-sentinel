import React from 'react';
import { Shield, Target, Award, Cpu, Play, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { TraineeProfile, UnitProfile, Scenario } from '../types';
import { soundFx } from '../utils/audio';

interface HomePageProps {
  onStartPreset: (presetId: string) => void;
  onNavigate: (tab: string) => void;
  currentTrainee: TraineeProfile | null;
  currentUnit: UnitProfile | null;
}

export const HomePage: React.FC<HomePageProps> = ({
  onStartPreset,
  onNavigate,
  currentTrainee,
  currentUnit,
}) => {
  return (
    <div className="space-y-8 pb-12">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-cyan-950/40 border border-cyan-500/30 p-8 shadow-2xl">
        {/* Glowing tactical accents */}
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 text-xs font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            MINISTRY OF DEFENCE // DEFENCE SERVICES STAFF COLLEGE (SIH 247)
          </div>

          <h1 className="text-4xl md:text-5xl font-tactical font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-cyan-300 leading-tight">
            AI-ENABLED DRONE & COUNTER-DRONE THREAT SIMULATOR
          </h1>

          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            Train Smarter. Respond Stronger. High-readiness counter-UAS simulation platform
            delivering scripted and procedurally generated drone swarm incursions, 3-pillar decision-tree scoring,
            after-action review (AAR), and scikit-learn AI coaching. Usable at unit level with zero GPU or internet dependencies.
          </p>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => {
                soundFx.playButtonClick();
                onNavigate('battlefield');
              }}
              className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 via-sky-300 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black font-mono text-sm flex items-center gap-2.5 shadow-xl shadow-cyan-500/25 tactical-glow-cyan transition transform hover:scale-[1.02]"
            >
              <Play className="w-5 h-5 fill-current" /> 🎮 LAUNCH 3D SOLDIER SIMULATOR
            </button>

            <button
              onClick={() => {
                soundFx.playButtonClick();
                onStartPreset('PRESET-01');
              }}
              className="px-6 py-3.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 text-cyan-300 font-mono text-sm flex items-center gap-2 transition"
            >
              RADAR C4I SCRAMBLE <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                soundFx.playButtonClick();
                onNavigate('setup');
              }}
              className="px-5 py-3.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-700 text-slate-300 font-mono text-sm flex items-center gap-2 transition"
            >
              SCENARIO SETUP
            </button>
          </div>
        </div>
      </div>

      {/* Trainee Readiness & Operational Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Stat 1 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Target className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-100">28 SORTIES</div>
            <div className="text-xs text-slate-400 font-mono">Completed Drill Log</div>
          </div>
        </div>

        {/* Stat 2 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-emerald-400">84.2% AVG</div>
            <div className="text-xs text-slate-400 font-mono">Unit Readiness Index</div>
          </div>
        </div>

        {/* Stat 3 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-950 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-amber-400">3.4 SEC</div>
            <div className="text-xs text-slate-400 font-mono">Avg Detection Latency</div>
          </div>
        </div>

        {/* Stat 4 */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 shadow-lg flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-red-950 border border-red-500/40 flex items-center justify-center text-red-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-100">96.5%</div>
            <div className="text-xs text-slate-400 font-mono">Airspace Interception</div>
          </div>
        </div>
      </div>

      {/* Simulator Modes Architecture Overview */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-tactical font-bold text-slate-100">
              OPERATIONAL TRACK SOURCES & HARDWARE TIERS
            </h2>
            <p className="text-xs text-slate-400">
              Decoupled architecture: native zero-GPU simulation for field units, optional high-fidelity bridge for research labs.
            </p>
          </div>
          <span className="px-3 py-1 bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-mono font-bold">
            100% OFFLINE CAPABLE
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          {/* Card 1: Native Mode */}
          <div className="bg-slate-950/80 border border-cyan-500/40 rounded-xl p-5 space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-cyan-400 font-bold text-sm">NATIVE SIM ENGINE</span>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/50 text-[10px] font-bold">
                DEFAULT (ACTIVE)
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Seeded deterministic kinematics, procedural swarm formations (Wedge, Leader-Follower, Line, Dispersed) with 3 to 12 drones, and sensor degradation.
            </p>
            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400">
              Hardware: Standard Unit Laptop (Zero GPU / No Internet)
            </div>
          </div>

          {/* Card 2: Replay Mode */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-200 font-bold text-sm">REPLAY ENGINE</span>
              <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-700/50 text-[10px] font-bold">
                STANDARDIZED
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              Loads pre-recorded flight paths and black-box JSON logs from live flight exercises or SkySim benchmark runs with identical scoring criteria.
            </p>
            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400">
              Hardware: Standard Laptop
            </div>
          </div>

          {/* Card 3: AirSim Bridge */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-200 font-bold text-sm">COSYS-AIRSIM BRIDGE</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[10px]">
                OPTIONAL LAB TIER
              </span>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              High-Fidelity Unreal Engine 5 simulation bridge via RPC socket. Fails gracefully if Unreal Engine workstation is not attached.
            </p>
            <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-400">
              Hardware: Dedicated UE5 Workstation + GPU (Training Centers)
            </div>
          </div>
        </div>
      </div>

      {/* Scripted Mission Presets */}
      <div className="space-y-4">
        <h2 className="text-xl font-tactical font-bold text-slate-100">
          OFFICIAL TACTICAL SCENARIO PRESETS
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              id: 'PRESET-01',
              title: 'Operation Trishul: Border Outpost Incursion',
              terrain: 'Border Mountains',
              time: 'Dusk',
              threat: 'Single Recon / Kamikaze',
              difficulty: 'Level 1 (Cadet)',
              sensors: 'Normal Radar & FLIR',
              desc: 'High-altitude border radar post tracking incoming low-RCS loitering munitions at sunset.',
            },
            {
              id: 'PRESET-02',
              title: 'Operation Garud: Urban Metropolis Swarm Breach',
              terrain: 'Urban Metropolis',
              time: 'Daylight',
              threat: 'Tactical Swarm (Wedge Formation)',
              difficulty: 'Level 2 (Tactical)',
              sensors: 'Degraded (Building Shadow Clutter)',
              desc: 'Dense urban airspace with tall structure radar shadowing; coordinated multi-UAV wedge attack against critical infrastructure.',
            },
            {
              id: 'PRESET-03',
              title: 'Operation Sagar: Coastal Electronic Jamming Attack',
              terrain: 'Coastal Naval Base',
              time: 'Pitch Black Night',
              threat: 'Mixed Decoys & Avian Flocks',
              difficulty: 'Level 3 (Commander)',
              sensors: 'Jammed (Severe EW Noise)',
              desc: 'Pitch black night combined with shipborne EW radar jamming; sea-skimming drones masked amongst false biological tracks.',
            },
            {
              id: 'PRESET-04',
              title: 'Operation Drona: Forward FOB Perimeter Defense',
              terrain: 'Rural Plains',
              time: 'Daylight',
              threat: 'Echelon Leader-Follower Swarm',
              difficulty: 'Level 2 (Tactical)',
              sensors: 'Normal Radar',
              desc: 'Echelon column swarm formation testing rapid sequential designation and friendly IFF filtering.',
            },
          ].map((preset) => (
            <div
              key={preset.id}
              className="bg-slate-900 border border-slate-800 hover:border-cyan-500/50 rounded-xl p-5 space-y-3 transition group flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-cyan-400">{preset.id}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-300">
                    {preset.difficulty}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-100 group-hover:text-cyan-300 transition">
                  {preset.title}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">{preset.desc}</p>
                <div className="flex flex-wrap gap-2 pt-2 text-[11px] font-mono text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                    Terrain: {preset.terrain}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                    Env: {preset.time}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                    Sensors: {preset.sensors}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  soundFx.playButtonClick();
                  onStartPreset(preset.id);
                }}
                className="w-full mt-3 py-2 rounded-lg bg-cyan-950/70 hover:bg-cyan-600 hover:text-slate-950 border border-cyan-700/60 text-cyan-300 font-mono text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> SCRAMBLE PRESET MISSION
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
