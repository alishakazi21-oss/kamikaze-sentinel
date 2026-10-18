import React from 'react';
import { Radio, Mic, Camera, Flame, Wifi, AlertTriangle, CheckCircle, ShieldAlert } from 'lucide-react';
import { Scenario } from '../types';

interface SensorStatusPanelProps {
  scenario?: Scenario;
  weather?: 'clear' | 'rain' | 'fog';
  jammingLevel?: number;
  sensorBiasEnabled?: boolean;
  enabledSensors: Record<string, boolean>;
  onToggleSensor: (sensorType: string) => void;
  plotCounts?: Record<string, number>;
}

export type ReliabilityStatus = 'good' | 'degraded' | 'poor';

interface SensorMetadata {
  id: string;
  type: string;
  name: string;
  icon: React.ReactNode;
  coverageText: string;
  resolutionText: string;
  reliability: ReliabilityStatus;
  reason: string;
  accentColor: string;
}

export const SensorStatusPanel: React.FC<SensorStatusPanelProps> = ({
  scenario,
  weather: propWeather,
  jammingLevel: propJammingLevel,
  sensorBiasEnabled: propSensorBiasEnabled,
  enabledSensors,
  onToggleSensor,
  plotCounts = {}
}) => {
  const terrain = scenario?.terrain ?? 'plains';
  const weather = propWeather ?? scenario?.weather ?? 'clear';
  const time_of_day = scenario?.time_of_day ?? 'day';
  const sensor_state = scenario?.sensor_state ?? 'nominal';
  const jamming_level = propJammingLevel ?? scenario?.jamming_level ?? 0.0;
  const sensor_bias_enabled = propSensorBiasEnabled ?? scenario?.sensor_bias_enabled ?? false;

  // Compute per-sensor reliability according to environmental rules
  const getSensorReliability = (): SensorMetadata[] => {
    // 1. Radar
    let radarRel: ReliabilityStatus = 'good';
    let radarReason = 'Nominal active surveillance; clear line of sight.';
    if (sensor_state === 'jammed' || jamming_level > 0.4) {
      radarRel = 'poor';
      radarReason = 'Active EW noise jamming elevated noise floor (+8dB); elevated false alarms.';
    } else if (weather === 'rain' || terrain === 'urban' || sensor_state === 'degraded' || jamming_level > 0.1) {
      radarRel = 'degraded';
      radarReason = weather === 'rain'
        ? 'Precipitation attenuation & urban multipath clutter active.'
        : 'Urban structure clutter & radar horizon shadows active.';
    }

    // 2. Acoustic Array
    let acousticRel: ReliabilityStatus = 'good';
    let acousticReason = 'Low ambient noise; clean acoustic bearing vectors.';
    if (jamming_level > 0.5 || weather === 'rain') {
      acousticRel = 'poor';
      acousticReason = weather === 'rain'
        ? 'Rain acoustic impact masking drone rotor sound pressure.'
        : 'High environmental noise / acoustic suppression.';
    } else if (terrain === 'urban') {
      acousticRel = 'degraded';
      acousticReason = 'Urban street ambient traffic (+12dB); multi-path acoustic echo.';
    }

    // 3. Daylight EO Camera
    let eoRel: ReliabilityStatus = 'good';
    let eoReason = 'Optimal daylight optical contrast and high-resolution tracking.';
    if (time_of_day === 'night') {
      eoRel = 'poor';
      eoReason = 'Low ambient illumination; optical sensor range suppressed to <300m.';
    } else if (time_of_day === 'dusk' || weather === 'fog' || weather === 'rain') {
      eoRel = 'degraded';
      eoReason = weather !== 'clear' ? 'Atmospheric fog/rain obscuration.' : 'Dusk low-light optical contrast degradation.';
    }

    // 4. Thermal FLIR Camera
    let irRel: ReliabilityStatus = 'good';
    let irReason = time_of_day === 'night'
      ? 'Optimal thermal delta-T contrast against cold nighttime sky.'
      : 'Nominal MWIR thermal heat-spot propulsion tracking.';
    if (weather === 'rain' || weather === 'fog') {
      irRel = 'degraded';
      irReason = 'Water droplet scattering attenuating infrared transmission.';
    }

    // 5. Passive RF Direction Finder
    let rfRel: ReliabilityStatus = 'good';
    let rfReason = 'Unobstructed line of sight for 2.4/5.8 GHz UAV datalinks.';
    if (sensor_state === 'jammed' || jamming_level > 0.3) {
      rfRel = 'poor';
      rfReason = 'Broadband electronic jamming blanket masking C2 link signals.';
    } else if (terrain === 'urban') {
      rfRel = 'degraded';
      rfReason = 'Urban concrete structural attenuation (-50% RF range).';
    }

    return [
      {
        id: 'RADAR-01',
        type: 'radar',
        name: 'Ku-Band 3D Radar',
        icon: <Radio className="w-3.5 h-3.5" />,
        coverageText: '4000m / 360°',
        resolutionText: '35m · 3.0°',
        reliability: radarRel,
        reason: radarReason,
        accentColor: '#38bdf8' // Cyan
      },
      {
        id: 'ACOUSTIC-01',
        type: 'acoustic',
        name: 'Acoustic Array',
        icon: <Mic className="w-3.5 h-3.5" />,
        coverageText: '1200m / Bearing',
        resolutionText: 'Bearing Only · 8.0°',
        reliability: acousticRel,
        reason: acousticReason,
        accentColor: '#f59e0b' // Amber
      },
      {
        id: 'CAM-EO-01',
        type: 'camera_eo',
        name: 'Daylight EO Optical',
        icon: <Camera className="w-3.5 h-3.5" />,
        coverageText: time_of_day === 'night' ? '300m (Night)' : '2500m (Day)',
        resolutionText: '0.5° (High Res)',
        reliability: eoRel,
        reason: eoReason,
        accentColor: '#10b981' // Emerald
      },
      {
        id: 'CAM-IR-01',
        type: 'camera_thermal',
        name: 'Thermal MWIR FLIR',
        icon: <Flame className="w-3.5 h-3.5" />,
        coverageText: '1800m / Day+Night',
        resolutionText: '0.6° · Heat Spot',
        reliability: irRel,
        reason: irReason,
        accentColor: '#c084fc' // Purple
      },
      {
        id: 'RF-DF-01',
        type: 'rf',
        name: 'RF Direction Finder',
        icon: <Wifi className="w-3.5 h-3.5" />,
        coverageText: terrain === 'urban' ? '2250m (Urban)' : '4500m (Rural)',
        resolutionText: '5.0° · 0.4-6.0GHz',
        reliability: rfRel,
        reason: rfReason,
        accentColor: '#eab308' // Yellow
      }
    ];
  };

  const sensors = getSensorReliability();

  const getBadgeStyle = (status: ReliabilityStatus) => {
    switch (status) {
      case 'good':
        return 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300';
      case 'degraded':
        return 'bg-amber-950/80 border-amber-500/50 text-amber-300';
      case 'poor':
        return 'bg-red-950/80 border-red-500/50 text-red-300 animate-pulse';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3 shadow-lg space-y-3 font-mono text-xs">
      {/* Header with Environment Factors */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-200 tracking-wider">SENSOR SUITE STATUS</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">{terrain}</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">{time_of_day}</span>
          {weather !== 'clear' && (
            <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 uppercase">{weather}</span>
          )}
          {jamming_level > 0 && (
            <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 uppercase">
              EW {Math.round(jamming_level * 100)}%
            </span>
          )}
          {sensor_bias_enabled && (
            <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800 uppercase" title="Sensors have systematic calibration misalignment">
              BIAS ACTIVE
            </span>
          )}
        </div>
      </div>

      {/* Sensor List Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
        {sensors.map((s) => {
          const isEnabled = enabledSensors[s.type] ?? true;
          const count = plotCounts[s.type] ?? 0;

          return (
            <button
              key={s.id}
              onClick={() => onToggleSensor(s.type)}
              title={`Click to toggle ${s.name} on radar display\n${s.reason}`}
              className={`p-2 rounded-lg border text-left transition flex flex-col justify-between ${
                isEnabled
                  ? 'bg-slate-950/70 border-slate-700/80 hover:border-slate-500'
                  : 'bg-slate-950/30 border-slate-800/40 opacity-40 hover:opacity-70'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5" style={{ color: s.accentColor }}>
                    {s.icon}
                    <span className="font-bold text-[11px] truncate">{s.name}</span>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase ${getBadgeStyle(s.reliability)}`}>
                    {s.reliability}
                  </span>
                </div>

                <div className="text-[10px] text-slate-400 space-y-0.5 mb-1.5">
                  <div className="flex justify-between">
                    <span>Coverage:</span>
                    <span className="text-slate-300">{s.coverageText}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Res:</span>
                    <span className="text-slate-300">{s.resolutionText}</span>
                  </div>
                </div>
              </div>

              <div className="pt-1 border-t border-slate-800/60 flex items-center justify-between text-[10px]">
                <span className="text-slate-400">Plots: <b className="text-cyan-400">{count}</b></span>
                <span className={`text-[9px] ${isEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isEnabled ? '● ACTIVE' : '○ MUTED'}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
