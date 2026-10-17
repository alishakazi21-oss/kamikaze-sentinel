import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  BarChart, Bar
} from 'recharts';
import { TraineeProfile, UnitProfile } from '../types';
import { Award, TrendingUp, Users, Shield, ArrowUpDown, Crosshair, Clock } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface AnalyticsPageProps {
  currentTrainee: TraineeProfile | null;
  units: UnitProfile[];
}

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({ currentTrainee, units }) => {
  const [traineeHistory, setTraineeHistory] = useState<any[]>([]);
  const [unitData, setUnitData] = useState<any | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    currentTrainee?.unit_id || 'UNIT-ALPHA'
  );

  // Comparator states
  const [compareSessionA, setCompareSessionA] = useState<string>('');
  const [compareSessionB, setCompareSessionB] = useState<string>('');

  // Fetch trainee history
  useEffect(() => {
    if (!currentTrainee) return;
    fetch(`/api/trainees/${currentTrainee.id}/history`)
      .then((res) => res.json())
      .then((data) => {
        if (data.history) {
          setTraineeHistory(data.history);
          if (data.history.length >= 2) {
            setCompareSessionA(data.history[data.history.length - 2].session_id);
            setCompareSessionB(data.history[data.history.length - 1].session_id);
          }
        }
      })
      .catch((e) => console.error(e));
  }, [currentTrainee]);

  // Fetch unit aggregate
  useEffect(() => {
    fetch(`/api/units/${selectedUnitId}/aggregate`)
      .then((res) => res.json())
      .then((data) => setUnitData(data))
      .catch((e) => console.error(e));
  }, [selectedUnitId]);

  const sessionA = traineeHistory.find((s) => s.session_id === compareSessionA);
  const sessionB = traineeHistory.find((s) => s.session_id === compareSessionB);

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16 font-mono">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase">
            <TrendingUp className="w-4 h-4" /> PERFORMANCE ANALYTICS & READINESS
          </div>
          <h1 className="text-3xl font-tactical font-black text-slate-100">
            TRAINING PROGRESSION & UNIT AGGREGATES
          </h1>
          <p className="text-xs text-slate-400">
            Real data from SQLite database tracking individual learning curves, reaction latencies, and unit-level combat readiness.
          </p>
        </div>

        {/* Unit Selector */}
        <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs">
          <Users className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-400">UNIT:</span>
          <select
            value={selectedUnitId}
            onChange={(e) => {
              soundFx.playButtonClick();
              setSelectedUnitId(e.target.value);
            }}
            className="bg-transparent text-slate-200 font-bold outline-none cursor-pointer"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id} className="bg-slate-900 text-slate-200">
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Trainee Progression Charts */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-tactical font-bold text-slate-100">
              INDIVIDUAL TRAINEE SORTIE PROGRESSION ({currentTrainee?.callsign})
            </h2>
            <p className="text-xs text-slate-400">
              Composite score and reaction latency trajectory across sequential training sorties.
            </p>
          </div>
          <span className="px-3 py-1 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60 text-xs font-bold">
            {traineeHistory.length} SORTIES RECORDED
          </span>
        </div>

        {traineeHistory.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
            {/* Chart 1: Score Progression */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-2">
              <span className="text-xs text-cyan-400 font-bold">COMPOSITE SCORE TREND (/100)</span>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={traineeHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="session_id" stroke="#64748b" fontSize={9} />
                    <YAxis domain={[0, 100]} stroke="#64748b" fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#090e1a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="total_score" stroke="#06b6d4" strokeWidth={2.5} name="Total Score" dot={{ fill: '#06b6d4' }} />
                    <Line type="monotone" dataKey="decision_score" stroke="#f59e0b" strokeWidth={1.5} name="Decision Quality" strokeDasharray="4 4" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Reaction Latency Reduction */}
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-2">
              <span className="text-xs text-emerald-400 font-bold">DETECTION REACTION TIME (SECONDS)</span>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={traineeHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="session_id" stroke="#64748b" fontSize={9} />
                    <YAxis domain={[0, 8]} stroke="#64748b" fontSize={10} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#090e1a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="avg_detection_latency" stroke="#10b981" strokeWidth={2.5} name="Reaction Latency (s)" dot={{ fill: '#10b981' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-slate-500 text-center py-12">
            No session history for this trainee yet. Run sorties to generate progression analytics.
          </div>
        )}
      </div>

      {/* Unit Aggregates Dashboard */}
      {unitData && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-tactical font-bold text-slate-100 uppercase">
                {unitData.unit.name} // OPERATIONAL READINESS
              </h2>
              <p className="text-xs text-slate-400">Base Location: {unitData.unit.base_location}</p>
            </div>

            <div className="px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold text-xs">
              INDEX: {unitData.readiness_index}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase">Active Personnel</span>
              <div className="text-xl font-bold text-slate-100">{unitData.active_personnel} Operators</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase">Unit Avg Score</span>
              <div className="text-xl font-bold text-cyan-400">{unitData.unit_average_score}%</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase">Avg Reaction Time</span>
              <div className="text-xl font-bold text-emerald-400">{unitData.unit_average_detection_latency}s</div>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase">Dangerous Errors</span>
              <div className="text-xl font-bold text-red-400">{unitData.total_dangerous_errors}</div>
            </div>
          </div>

          {/* Personnel Table */}
          <div className="overflow-x-auto pt-2">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 text-[10px] uppercase">
                <tr>
                  <th className="py-2.5 px-3">Callsign</th>
                  <th className="py-2.5 px-3">Rank</th>
                  <th className="py-2.5 px-3">Operational Tier</th>
                  <th className="py-2.5 px-3">Sorties Logged</th>
                  <th className="py-2.5 px-3">Average Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {unitData.personnel.map((p: any) => (
                  <tr key={p.trainee_id} className="hover:bg-slate-850 text-slate-300">
                    <td className="py-2 px-3 font-bold text-cyan-300">{p.callsign}</td>
                    <td className="py-2 px-3">{p.rank}</td>
                    <td className="py-2 px-3">Level {p.difficulty}</td>
                    <td className="py-2 px-3">{p.sorties_count}</td>
                    <td className="py-2 px-3 font-bold">{p.average_score}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Head-to-Head Session Comparator Tool */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-tactical font-bold text-slate-100">
            HEAD-TO-HEAD SESSION COMPARATOR
          </h2>
        </div>
        <p className="text-xs text-slate-400">
          Compare any two operational sorties side-by-side to inspect reaction speed, decision fidelity, and accuracy improvements.
        </p>

        {traineeHistory.length >= 2 ? (
          <div className="space-y-4 pt-2">
            {/* Pickers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                <span className="text-cyan-400 font-bold">SESSION A:</span>
                <select
                  value={compareSessionA}
                  onChange={(e) => setCompareSessionA(e.target.value)}
                  className="bg-transparent text-slate-200 outline-none flex-1 cursor-pointer"
                >
                  {traineeHistory.map((s) => (
                    <option key={s.session_id} value={s.session_id} className="bg-slate-900">
                      {s.session_id} - {s.scenario_title} ({s.total_score}%)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs">
                <span className="text-emerald-400 font-bold">SESSION B:</span>
                <select
                  value={compareSessionB}
                  onChange={(e) => setCompareSessionB(e.target.value)}
                  className="bg-transparent text-slate-200 outline-none flex-1 cursor-pointer"
                >
                  {traineeHistory.map((s) => (
                    <option key={s.session_id} value={s.session_id} className="bg-slate-900">
                      {s.session_id} - {s.scenario_title} ({s.total_score}%)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Side by side comparison table */}
            {sessionA && sessionB && (
              <div className="grid grid-cols-2 gap-4 pt-2">
                {/* Session A Card */}
                <div className="bg-slate-950 border border-cyan-500/30 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="font-bold text-cyan-400">{sessionA.session_id}</span>
                    <span className="text-xl font-bold font-tactical text-slate-100">{sessionA.total_score}%</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Drill:</span>
                      <span className="text-slate-200 truncate max-w-[200px]">{sessionA.scenario_title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Avg Reaction Latency:</span>
                      <span className="text-slate-200 font-bold">{sessionA.avg_detection_latency}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Classification Accuracy:</span>
                      <span className="text-slate-200 font-bold">{Math.round(sessionA.accuracy * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Dangerous Errors:</span>
                      <span className={sessionA.dangerous_errors > 0 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                        {sessionA.dangerous_errors}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Session B Card */}
                <div className="bg-slate-950 border border-emerald-500/30 rounded-xl p-4 space-y-3 text-xs">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="font-bold text-emerald-400">{sessionB.session_id}</span>
                    <span className="text-xl font-bold font-tactical text-slate-100">{sessionB.total_score}%</span>
                  </div>
                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Drill:</span>
                      <span className="text-slate-200 truncate max-w-[200px]">{sessionB.scenario_title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Avg Reaction Latency:</span>
                      <span className="text-slate-200 font-bold">{sessionB.avg_detection_latency}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Classification Accuracy:</span>
                      <span className="text-slate-200 font-bold">{Math.round(sessionB.accuracy * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Dangerous Errors:</span>
                      <span className={sessionB.dangerous_errors > 0 ? 'text-red-400 font-bold' : 'text-emerald-400'}>
                        {sessionB.dangerous_errors}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-slate-500 text-xs py-4 text-center">
            Need at least 2 completed sessions to compare side-by-side.
          </div>
        )}
      </div>
    </div>
  );
};
