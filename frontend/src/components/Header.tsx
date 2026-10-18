import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Shield, Radio, Activity, Cpu } from 'lucide-react';
import { soundFx } from '../utils/audio';
import { TraineeProfile, UnitProfile } from '../types';

interface HeaderProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  units: UnitProfile[];
  trainees: TraineeProfile[];
  currentTrainee: TraineeProfile | null;
  onSelectTrainee: (trainee: TraineeProfile) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  units,
  trainees,
  currentTrainee,
  onSelectTrainee,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [audioMuted, setAudioMuted] = useState<boolean>(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const utc = now.toUTCString().slice(17, 25) + ' UTC';
      const ist = now.toLocaleTimeString('en-IN', { hour12: false }) + ' IST';
      setTimeStr(`${ist} | ${utc}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleAudio = () => {
    const nextState = !audioMuted;
    setAudioMuted(nextState);
    soundFx.enabled = !nextState;
    if (!nextState) {
      soundFx.playButtonClick();
    }
  };

  const currentUnit = units.find((u) => u.id === currentTrainee?.unit_id) || units[0];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-cyan-500/30 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Designation */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 border border-cyan-400">
            <Shield className="w-6 h-6 text-slate-950" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-tactical font-black text-xl tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-emerald-400">
                ASTRA VEER
              </span>
              <span className="px-1.5 py-0.2 bg-cyan-950 text-cyan-400 border border-cyan-700/60 rounded text-[10px] font-mono font-bold">
                SIH 247
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400 tracking-tight">
              AI-ENABLED COUNTER-DRONE THREAT SIMULATION TRAINER
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          {[
            { id: 'home', label: 'COMMAND' },
            { id: 'battlefield', label: '🎮 3D SOLDIER SIM' },
            { id: 'sim', label: 'RADAR CIC' },
            { id: 'setup', label: 'SCENARIOS' },
            { id: 'aar', label: 'AAR DEBRIEF' },
            { id: 'analytics', label: 'ANALYTICS' },
            { id: 'instructor', label: 'INSTRUCTOR ROE' },
            { id: 'diagnostics', label: 'SYSTEM' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                soundFx.playButtonClick();
                onTabChange(tab.id);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                currentTab === tab.id
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Right Section: Time, Profile & Audio */}
        <div className="flex items-center gap-3">
          {/* Tactical Clock */}
          <div className="hidden lg:flex flex-col text-right font-mono text-[10px] text-slate-400">
            <span className="text-cyan-400 font-semibold">{timeStr}</span>
            <span className="text-emerald-400 flex items-center justify-end gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              OFFLINE READY // SECURE
            </span>
          </div>

          {/* Trainee Profile Picker */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={currentTrainee?.id || ''}
              onChange={(e) => {
                const found = trainees.find((t) => t.id === e.target.value);
                if (found) onSelectTrainee(found);
              }}
              className="bg-transparent text-xs font-mono text-slate-200 outline-none cursor-pointer"
            >
              {trainees.map((t) => (
                <option key={t.id} value={t.id} className="bg-slate-900 text-slate-200">
                  {t.rank} {t.callsign} (Lvl {t.current_difficulty})
                </option>
              ))}
            </select>
          </div>

          {/* Audio Mute Button */}
          <button
            onClick={toggleAudio}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 transition"
            title={audioMuted ? 'Unmute tactical audio' : 'Mute tactical audio'}
          >
            {audioMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>
        </div>
      </div>
    </header>
  );
};
