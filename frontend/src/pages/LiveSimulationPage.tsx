import React, { useState, useEffect, useRef } from 'react';
import { SyntheticTrack, SensorPlot, Scenario, TraineeProfile, TargetClass, ResponseOption } from '../types';
import { Radar2DView } from '../components/Radar2DView';
import { Tactical3DView } from '../components/Tactical3DView';
import { FlirCameraView } from '../components/FlirCameraView';
import { TraineeActionDeck } from '../components/TraineeActionDeck';
import { SensorStatusPanel } from '../components/SensorStatusPanel';
import { soundFx } from '../utils/audio';
import { Radio, AlertOctagon, CheckCircle2, ShieldAlert, Clock, Eye, Layers } from 'lucide-react';

interface LiveSimulationPageProps {
  scenario: Scenario;
  trainee: TraineeProfile;
  onFinishSession: (sessionSummary: any) => void;
}

export const LiveSimulationPage: React.FC<LiveSimulationPageProps> = ({
  scenario,
  trainee,
  onFinishSession,
}) => {
  const [sessionId, setSessionId] = useState<string>('');
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [activeTracks, setActiveTracks] = useState<SyntheticTrack[]>([]);
  const [sensorPlots, setSensorPlots] = useState<SensorPlot[]>([]);
  const [enabledSensors, setEnabledSensors] = useState<Record<string, boolean>>({
    radar: true,
    acoustic: true,
    camera_eo: true,
    camera_thermal: true,
    rf: true,
  });
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [isFinishing, setIsFinishing] = useState<boolean>(false);

  // Trainee recorded events: targetId -> { detected, detectedAt, classification, response, aiFollowed, confidenceRating }
  const [eventsMap, setEventsMap] = useState<
    Map<string, { detected: boolean; detectedAt?: number; classification?: string; response?: string; aiFollowed?: boolean; confidenceRating?: number }>
  >(new Map());

  const timerRef = useRef<number | null>(null);
  const pollingRef = useRef<number | null>(null);

  // 1. Initialize session on backend
  useEffect(() => {
    let isMounted = true;
    fetch('/api/sessions/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trainee_id: trainee.id,
        scenario_id: scenario.id,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setSessionId(data.session_id);
        }
      })
      .catch((e) => console.error('Failed to start session', e));

    return () => {
      isMounted = false;
    };
  }, [scenario.id, trainee.id]);

  // 2. High-precision simulation timer
  useEffect(() => {
    const startTime = Date.now();
    timerRef.current = window.setInterval(() => {
      setElapsedTime((Date.now() - startTime) / 1000);
    }, 100);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // 3. Poll tracks from backend at 2.5Hz (400ms)
  useEffect(() => {
    if (!sessionId) return;

    const pollTracks = async () => {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/tracks?t=${elapsedTime.toFixed(2)}`);
        if (res.ok) {
          const data = await res.json();
          const trks: SyntheticTrack[] = data.tracks || [];
          const plots: SensorPlot[] = data.sensor_plots || [];
          setActiveTracks(trks);
          setSensorPlots(plots);

          // Default select first track if none selected
          if (!selectedTrackId && trks.length > 0) {
            setSelectedTrackId(trks[0].track_id);
          }
        }
      } catch (e) {
        console.error('Error polling tracks', e);
      }
    };

    pollTracks();
    pollingRef.current = window.setInterval(pollTracks, 400);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [sessionId, elapsedTime, selectedTrackId]);

  // Handle Trainee Actions
  const handleDetect = (track: SyntheticTrack) => {
    const nextMap = new Map(eventsMap);
    const existing = nextMap.get(track.track_id) || { detected: false };
    existing.detected = true;
    existing.detectedAt = elapsedTime;
    nextMap.set(track.track_id, existing);
    setEventsMap(nextMap);

    // Record on backend
    if (sessionId) {
      fetch(`/api/sessions/${sessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_id: track.underlying_target_id || track.track_id,
          action_type: 'detect',
          elapsed_seconds: elapsedTime,
        }),
      }).catch(console.error);
    }
  };

  const handleClassify = (track: SyntheticTrack, cls: TargetClass, aiFollowed?: boolean, confidenceRating: number = 4) => {
    const nextMap = new Map(eventsMap);
    const existing = nextMap.get(track.track_id) || { detected: true, detectedAt: elapsedTime };
    existing.classification = cls;
    existing.aiFollowed = aiFollowed;
    existing.confidenceRating = confidenceRating;
    nextMap.set(track.track_id, existing);
    setEventsMap(nextMap);

    if (sessionId) {
      fetch(`/api/sessions/${sessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_id: track.underlying_target_id || track.track_id,
          action_type: 'classify',
          elapsed_seconds: elapsedTime,
          classification: cls,
          ai_followed: aiFollowed,
          confidence_rating: confidenceRating,
        }),
      }).catch(console.error);
    }
  };

  const handleRespond = (track: SyntheticTrack, resp: ResponseOption) => {
    const nextMap = new Map(eventsMap);
    const existing = nextMap.get(track.track_id) || { detected: true, detectedAt: elapsedTime };
    existing.response = resp;
    nextMap.set(track.track_id, existing);
    setEventsMap(nextMap);

    if (sessionId) {
      fetch(`/api/sessions/${sessionId}/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target_id: track.underlying_target_id || track.track_id,
          action_type: 'respond',
          elapsed_seconds: elapsedTime,
          response: resp,
        }),
      }).catch(console.error);
    }
  };

  // Complete Drill and Navigate to AAR
  const handleFinishDrill = async () => {
    setIsFinishing(true);
    soundFx.playButtonClick();

    try {
      // Build event list
      const eventPayload = [];
      for (const [trackId, ev] of eventsMap.entries()) {
        const trk = activeTracks.find((t) => t.track_id === trackId);
        eventPayload.push({
          target_id: trk?.underlying_target_id || trackId,
          detected_at: ev.detectedAt,
          trainee_classification: ev.classification,
          trainee_response: ev.response,
          proximity_m: trk?.range_m || 1500,
          ai_followed: ev.aiFollowed,
          confidence_rating: ev.confidenceRating || 4,
        });
      }

      const res = await fetch(`/api/sessions/${sessionId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          duration_seconds: elapsedTime,
          events: eventPayload,
        }),
      });

      if (res.ok) {
        // Fetch full AAR
        const aarRes = await fetch(`/api/sessions/${sessionId}/aar`);
        if (aarRes.ok) {
          const aarData = await aarRes.json();
          onFinishSession(aarData);
        }
      }
    } catch (e) {
      console.error('Error completing session', e);
    } finally {
      setIsFinishing(false);
    }
  };

  const selectedTrack = activeTracks.find((t) => t.track_id === selectedTrackId) || null;

  return (
    <div className="space-y-4 pb-12">
      {/* Top CIC Command Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-xl px-4 py-2.5 font-mono text-xs shadow-xl">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="font-bold text-red-400">DEFCON 2 // AIR INTRUSION</span>
          </div>

          <div className="text-slate-400">
            SESSION: <span className="text-cyan-300 font-bold">{sessionId || 'INITIALIZING'}</span>
          </div>

          <div className="text-slate-400">
            CONTACTS: <span className="text-amber-400 font-bold">{activeTracks.length} TRACKING</span>
          </div>
        </div>

        {/* View Switcher & Timer & Finish */}
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex border border-slate-700 rounded-lg overflow-hidden bg-slate-950">
            <button
              onClick={() => {
                soundFx.playButtonClick();
                setViewMode('2d');
              }}
              className={`px-3 py-1 text-xs font-bold transition ${
                viewMode === '2d' ? 'bg-cyan-600 text-slate-950' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              2D RADAR PPI
            </button>
            <button
              onClick={() => {
                soundFx.playButtonClick();
                setViewMode('3d');
              }}
              className={`px-3 py-1 text-xs font-bold transition flex items-center gap-1 ${
                viewMode === '3d' ? 'bg-cyan-600 text-slate-950' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> 3D AIRSPACE
            </button>
          </div>

          {/* Mission Timer */}
          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-cyan-400 font-bold text-sm">
            <Clock className="w-4 h-4 text-cyan-500" />
            {Math.floor(elapsedTime / 60)
              .toString()
              .padStart(2, '0')}
            :{(elapsedTime % 60).toFixed(1).padStart(4, '0')}
          </div>

          {/* Finish Drill Button */}
          <button
            disabled={isFinishing}
            onClick={handleFinishDrill}
            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold transition shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isFinishing ? 'CALCULATING AAR...' : 'COMPLETE DRILL'}
          </button>
        </div>
      </div>

      {/* Main Simulation Layout: Left View + Right Telemetry & Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Radar / 3D Canvas View (7 cols) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center bg-slate-950/60 border border-slate-800 rounded-2xl p-4 shadow-2xl space-y-3">
          {viewMode === '2d' && (
            <div className="w-full">
              <SensorStatusPanel
                weather={scenario.weather}
                jammingLevel={scenario.jamming_level}
                sensorBiasEnabled={scenario.sensor_bias_enabled}
                enabledSensors={enabledSensors}
                onToggleSensor={(sensorKey) =>
                  setEnabledSensors((prev) => ({ ...prev, [sensorKey]: !prev[sensorKey] }))
                }
              />
            </div>
          )}
          {viewMode === '2d' ? (
            <Radar2DView
              tracks={activeTracks}
              sensorPlots={sensorPlots}
              enabledSensors={enabledSensors}
              selectedTrackId={selectedTrackId}
              onSelectTrack={(id) => setSelectedTrackId(id)}
              terrain={scenario.terrain}
              sensorState={scenario.sensor_state}
            />
          ) : (
            <Tactical3DView
              tracks={activeTracks}
              selectedTrackId={selectedTrackId}
              terrain={scenario.terrain}
            />
          )}
        </div>

        {/* Intelligence, Camera & Trainee Action Deck (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Telemetry HUD Card */}
          <div className="bg-slate-900/90 border border-slate-700/70 rounded-xl p-3.5 font-mono text-xs shadow-lg space-y-2">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-slate-400 font-bold">CONTACT TELEMETRY</span>
              <span className="text-cyan-400 font-bold">
                {selectedTrack ? selectedTrack.track_id : 'NO TARGET'}
              </span>
            </div>

            {selectedTrack ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Slant Range:</span>
                  <span className="text-slate-200 font-bold">{Math.round(selectedTrack.range_m)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Azimuth Bearing:</span>
                  <span className="text-slate-200 font-bold">{selectedTrack.bearing_deg.toFixed(1)}°</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Altitude (AGL):</span>
                  <span className="text-slate-200 font-bold">{Math.round(selectedTrack.altitude_m)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Ground Speed:</span>
                  <span className="text-slate-200 font-bold">{selectedTrack.speed_mps.toFixed(1)} m/s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">RCS Signature:</span>
                  <span className="text-slate-200 font-bold">{selectedTrack.rcs_estimate_dbsm.toFixed(1)} dBsm</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">RF Datalink:</span>
                  <span className="text-cyan-300 font-bold">
                    {selectedTrack.rf_detected_ghz ? `${selectedTrack.rf_detected_ghz} GHz` : 'SILENT'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-center py-2">
                Click any radar blip or table contact to view telemetry.
              </div>
            )}
          </div>

          {/* FLIR Gimbal Camera Feed */}
          <FlirCameraView
            selectedTrack={selectedTrack}
            timeOfDay={scenario.time_of_day}
            sensorState={scenario.sensor_state}
          />

          {/* Trainee Action Deck */}
          <TraineeActionDeck
            selectedTrack={selectedTrack}
            targetEvents={eventsMap}
            onDetect={handleDetect}
            onClassify={handleClassify}
            onRespond={handleRespond}
          />
        </div>
      </div>

      {/* Bottom Track List Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-300 font-bold flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" /> ACTIVE RADAR CONTACTS ({activeTracks.length})
          </span>
          <span className="text-slate-500 text-[11px]">
            Terrain: {scenario.terrain.toUpperCase()} | Env: {scenario.time_of_day.toUpperCase()} | Sensors: {scenario.sensor_state.toUpperCase()}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-2 px-3">Track ID</th>
                <th className="py-2 px-3">Range</th>
                <th className="py-2 px-3">Bearing</th>
                <th className="py-2 px-3">Altitude</th>
                <th className="py-2 px-3">Speed</th>
                <th className="py-2 px-3">RCS</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Detection</th>
                <th className="py-2 px-3">Classification</th>
                <th className="py-2 px-3">Response</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {activeTracks.map((trk) => {
                const isSelected = trk.track_id === selectedTrackId;
                const ev = eventsMap.get(trk.track_id);
                return (
                  <tr
                    key={trk.track_id}
                    onClick={() => {
                      soundFx.playTargetLock();
                      setSelectedTrackId(trk.track_id);
                    }}
                    className={`cursor-pointer transition ${
                      isSelected ? 'bg-cyan-950/40 text-cyan-300' : 'hover:bg-slate-850 text-slate-300'
                    }`}
                  >
                    <td className="py-2 px-3 font-bold">{trk.track_id}</td>
                    <td className="py-2 px-3">{Math.round(trk.range_m)}m</td>
                    <td className="py-2 px-3">{trk.bearing_deg.toFixed(1)}°</td>
                    <td className="py-2 px-3">{Math.round(trk.altitude_m)}m</td>
                    <td className="py-2 px-3">{trk.speed_mps.toFixed(1)}m/s</td>
                    <td className="py-2 px-3">{trk.rcs_estimate_dbsm.toFixed(1)} dBsm</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          trk.is_clutter
                            ? 'bg-slate-800 text-slate-400'
                            : trk.status === 'tracking'
                            ? 'bg-emerald-950 text-emerald-400'
                            : 'bg-amber-950 text-amber-400'
                        }`}
                      >
                        {trk.is_clutter ? 'CLUTTER' : trk.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      {ev?.detected ? (
                        <span className="text-emerald-400 font-bold">YES ({ev.detectedAt?.toFixed(1)}s)</span>
                      ) : (
                        <span className="text-slate-500">PENDING</span>
                      )}
                    </td>
                    <td className="py-2 px-3 uppercase">
                      {ev?.classification ? (
                        <span className="font-bold text-amber-300">
                          {ev.classification.replace('_', ' ')}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="py-2 px-3 uppercase">
                      {ev?.response ? (
                        <span className="font-bold text-cyan-300">
                          {ev.response.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
