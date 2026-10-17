import React, { useState } from 'react';
import { SyntheticTrack } from '../types';

interface FlirCameraViewProps {
  selectedTrack: SyntheticTrack | null;
  timeOfDay: string;
  sensorState: string;
}

export const FlirCameraView: React.FC<FlirCameraViewProps> = ({
  selectedTrack,
  timeOfDay,
  sensorState,
}) => {
  const [feedMode, setFeedMode] = useState<'optical' | 'flir_white' | 'flir_iron'>('flir_white');
  const [zoomLevel, setZoomLevel] = useState<number>(2);

  const isNight = timeOfDay === 'night';
  const isJammed = sensorState === 'jammed';

  return (
    <div className="flex flex-col bg-slate-900/90 border border-slate-700/70 rounded-xl overflow-hidden shadow-lg">
      {/* Header with Mode & Zoom controls */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950/80 border-b border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span className="font-semibold text-slate-200 uppercase tracking-wider">
            EO/IR GIMBAL FEED
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Feed Palette Switcher */}
          <div className="flex border border-slate-700 rounded overflow-hidden">
            <button
              onClick={() => setFeedMode('optical')}
              className={`px-2 py-0.5 text-[10px] ${
                feedMode === 'optical' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              OPT
            </button>
            <button
              onClick={() => setFeedMode('flir_white')}
              className={`px-2 py-0.5 text-[10px] ${
                feedMode === 'flir_white' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              W-HOT
            </button>
            <button
              onClick={() => setFeedMode('flir_iron')}
              className={`px-2 py-0.5 text-[10px] ${
                feedMode === 'flir_iron' ? 'bg-amber-600 text-white font-bold' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              IRON
            </button>
          </div>

          {/* Zoom Selector */}
          <div className="flex border border-slate-700 rounded overflow-hidden">
            {[1, 2, 4].map((z) => (
              <button
                key={z}
                onClick={() => setZoomLevel(z)}
                className={`px-1.5 py-0.5 text-[10px] ${
                  zoomLevel === z ? 'bg-slate-700 text-cyan-300 font-bold' : 'text-slate-400 hover:bg-slate-800'
                }`}
              >
                {z}X
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Simulated Camera Viewfinder */}
      <div className="relative h-48 w-full bg-black overflow-hidden flex items-center justify-center">
        {/* Scan line and thermal noise background */}
        <div
          className={`absolute inset-0 pointer-events-none opacity-20 ${
            feedMode === 'flir_iron' ? 'bg-gradient-to-b from-purple-900 via-amber-900 to-black' : ''
          }`}
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4) 1px, transparent 1px, transparent 2px)',
          }}
        />

        {/* Optical night blur or Jamming noise */}
        {isJammed && (
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-10">
            <span className="text-red-400 font-mono text-xs px-2 py-1 bg-black/80 border border-red-500/50 rounded animate-pulse">
              [SENSOR JAMMING DETECTED - FLIR DEGRADED]
            </span>
          </div>
        )}

        {/* Crosshairs & Reticle Overlay */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="w-16 h-16 border border-cyan-400/40 rounded-full" />
          <div className="absolute w-24 h-[1px] bg-cyan-400/50" />
          <div className="absolute h-24 w-[1px] bg-cyan-400/50" />
          <div className="absolute top-3 left-3 text-[10px] font-mono text-cyan-400/80">
            FOV: {(45 / zoomLevel).toFixed(1)}° | {zoomLevel}X
          </div>
          <div className="absolute bottom-3 left-3 text-[10px] font-mono text-cyan-400/80">
            AZ: {selectedTrack ? `${selectedTrack.bearing_deg.toFixed(1)}°` : '000.0°'} | EL: -4.2°
          </div>
          <div className="absolute bottom-3 right-3 text-[10px] font-mono text-cyan-400/80">
            RNG: {selectedTrack ? `${Math.round(selectedTrack.range_m)} m` : 'NO LOCK'}
          </div>
        </div>

        {/* Target Graphic & Thermal Hotspot */}
        {selectedTrack ? (
          <div
            className={`flex flex-col items-center transition-transform duration-300 ${
              isNight && feedMode === 'optical' ? 'opacity-25 blur-[1px]' : 'opacity-100'
            }`}
            style={{ transform: `scale(${zoomLevel * 0.9})` }}
          >
            {selectedTrack.is_clutter ? (
              // Bird cluster silhouette
              <div className="flex gap-1 animate-bounce">
                <span className="text-slate-400 text-xs font-mono">^ ^ ^</span>
              </div>
            ) : (
              // Drone silhouette with motor hotspot glow
              <div className="relative flex flex-col items-center">
                {/* Drone Airframe */}
                <div
                  className={`w-12 h-4 rounded-sm border ${
                    feedMode === 'optical'
                      ? 'bg-slate-700 border-slate-500'
                      : feedMode === 'flir_white'
                      ? 'bg-white border-white shadow-[0_0_12px_#ffffff]'
                      : 'bg-amber-400 border-amber-300 shadow-[0_0_15px_#f59e0b]'
                  }`}
                />
                {/* 4 Rotors / Motor Hotspots */}
                <div className="flex justify-between w-16 -mt-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 blur-[1px] animate-pulse" />
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 blur-[1px] animate-pulse" />
                </div>
                <div className="flex justify-between w-16 mt-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 blur-[1px] animate-pulse" />
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500 blur-[1px] animate-pulse" />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-600 font-mono text-xs tracking-wider">
            NO TARGET DESIGNATED - GIMBAL IN SECTOR SCAN
          </div>
        )}
      </div>

      {/* Visual & Thermal Telemetry Text */}
      <div className="px-3 py-2 bg-slate-950 text-xs font-mono text-slate-300 border-t border-slate-800/80 space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400">Optical Sig:</span>
          <span className="text-cyan-300 truncate max-w-[280px]">
            {selectedTrack ? selectedTrack.visual_signature : 'Optical feed standby'}
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-400">FLIR MWIR Sig:</span>
          <span className="text-amber-300 truncate max-w-[280px]">
            {selectedTrack ? selectedTrack.thermal_signature : 'Thermal feed standby'}
          </span>
        </div>
      </div>
    </div>
  );
};
