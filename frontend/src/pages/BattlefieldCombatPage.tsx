import React, { useState } from 'react';
import { Battlefield3DSimulator } from '../components/Battlefield3DSimulator';
import { Shield, Crosshair, Users, Activity, Sun, Moon, Cloud, Play, RotateCcw } from 'lucide-react';
import { TraineeProfile, UnitProfile } from '../types';
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
  const [terrain, setTerrain] = useState<'border' | 'urban' | 'coastal' | 'rural'>('border');
  const [timeOfDay, setTimeOfDay] = useState<'day' | 'dusk' | 'night'>('day');
  const [threatType, setThreatType] = useState<string>('swarm_wedge');
  const [difficulty, setDifficulty] = useState<number>(currentTrainee?.current_difficulty || 1);
  const [simKey, setSimKey] = useState<number>(1);

  const handleRestart = () => {
    soundFx.playButtonClick();
    setSimKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-4 pb-12 font-mono">
      {/* Top Controller Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase">
            <Shield className="w-4 h-4" /> SOLDIER COMBAT SIMULATION // FIRST-PERSON TACTICAL TRAINER
          </div>
          <h1 className="text-2xl font-tactical font-black text-slate-100">
            3D BATTLEFIELD THREAT RESPONSE
          </h1>
          <p className="text-xs text-slate-400">
            Operator: <span className="text-cyan-300 font-bold">{currentTrainee?.rank} {currentTrainee?.callsign}</span> |
            Use Anti-Drone RF Jammer gun, binoculars, and tactical cover to counter incoming drone incursions.
          </p>
        </div>

        {/* Quick Scenario Calibrators */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Lighting */}
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
                  className={`px-2.5 py-1 rounded flex items-center gap-1 font-bold transition ${
                    timeOfDay === tod.id ? 'bg-cyan-600 text-slate-950' : 'text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {tod.label}
                </button>
              );
            })}
          </div>

          {/* Threat Type */}
          <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[
              { id: 'single', label: 'KAMIKAZE DIVE' },
              { id: 'swarm_wedge', label: 'TACTICAL SWARM' },
            ].map((th) => (
              <button
                key={th.id}
                onClick={() => {
                  soundFx.playButtonClick();
                  setThreatType(th.id);
                  setSimKey((k) => k + 1);
                }}
                className={`px-2.5 py-1 rounded font-bold transition ${
                  threatType === th.id ? 'bg-cyan-600 text-slate-950' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {th.label}
              </button>
            ))}
          </div>

          {/* Restart Scenario */}
          <button
            onClick={handleRestart}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Restart Scenario"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          {/* Switch to HQ Radar Room */}
          <button
            onClick={onSwitchToRadar}
            className="px-3 py-1.5 rounded-lg bg-slate-950 border border-cyan-500/50 hover:bg-cyan-950 text-cyan-300 font-bold transition flex items-center gap-1.5"
          >
            <Activity className="w-3.5 h-3.5" /> SWITCH TO RADAR CIC
          </button>
        </div>
      </div>

      {/* Main 3D Battlefield Simulator Canvas */}
      <Battlefield3DSimulator
        key={simKey}
        terrainType={terrain}
        timeOfDay={timeOfDay}
        difficulty={difficulty}
        threatType={threatType}
        onFinishDrill={onFinishCombatDrill}
      />
    </div>
  );
};
