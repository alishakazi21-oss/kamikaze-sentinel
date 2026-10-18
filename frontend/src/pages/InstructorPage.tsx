import React, { useState, useEffect } from 'react';
import { Shield, Settings, Save, RefreshCw, AlertTriangle, CheckCircle2, Users, Sliders } from 'lucide-react';
import { soundFx } from '../utils/audio';

export const InstructorPage: React.FC = () => {
  const [roeConfig, setRoeConfig] = useState<any | null>(null);
  const [jsonText, setJsonText] = useState<string>('');
  const [overviewData, setOverviewData] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'rules' | 'trainees' | 'weights'>('rules');
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const fetchRoe = () => {
    fetch('/api/instructor/roe')
      .then((res) => res.json())
      .then((data) => {
        setRoeConfig(data);
        setJsonText(JSON.stringify(data, null, 2));
      })
      .catch((e) => console.error('Failed to load ROE config', e));
  };

  const fetchOverview = () => {
    fetch('/api/instructor/overview')
      .then((res) => res.json())
      .then((data) => setOverviewData(data))
      .catch((e) => console.error('Failed to load instructor overview', e));
  };

  useEffect(() => {
    fetchRoe();
    fetchOverview();
  }, []);

  const handleSaveJson = async () => {
    setIsSaving(true);
    setSaveStatus('');
    soundFx.playButtonClick();

    try {
      const parsed = JSON.parse(jsonText);
      const res = await fetch('/api/instructor/roe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });

      if (res.ok) {
        setSaveStatus('SUCCESS: Rules and scoring weights saved and hot-reloaded into backend.');
        setRoeConfig(parsed);
      } else {
        const err = await res.json();
        setSaveStatus(`ERROR: ${err.detail || 'Failed to update rules'}`);
      }
    } catch (e: any) {
      setSaveStatus(`JSON SYNTAX ERROR: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleWeightChange = (key: string, val: number) => {
    if (!roeConfig) return;
    const nextConfig = {
      ...roeConfig,
      weights: {
        ...roeConfig.weights,
        [key]: val,
      },
    };
    setRoeConfig(nextConfig);
    setJsonText(JSON.stringify(nextConfig, null, 2));
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 font-mono">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-bold uppercase">
            <Settings className="w-4 h-4" /> INSTRUCTOR TACTICAL CONTROL PANEL
          </div>
          <h1 className="text-3xl font-tactical font-black text-slate-100">
            RULES OF ENGAGEMENT & SCORING CALIBRATOR
          </h1>
          <p className="text-xs text-slate-400">
            Live unclassified configuration editor for decision-tree rules, scoring weights, and battalion-wide trainee skill profiles.
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'rules' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            ROE RULES TABLE
          </button>
          <button
            onClick={() => setActiveTab('weights')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'weights' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            SCORING WEIGHTS
          </button>
          <button
            onClick={() => setActiveTab('trainees')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              activeTab === 'trainees' ? 'bg-cyan-500 text-slate-950' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            TRAINEE PROFILES
          </button>
        </div>
      </div>

      {/* Save Status Banner */}
      {saveStatus && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            saveStatus.startsWith('SUCCESS')
              ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300'
              : 'bg-red-950/70 border-red-500/60 text-red-300'
          }`}
        >
          {saveStatus.startsWith('SUCCESS') ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-red-400" />
          )}
          {saveStatus}
        </div>
      )}

      {/* TAB 1: RULES TABLE & RAW JSON */}
      {activeTab === 'rules' && roeConfig && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400 font-bold">
              ACTIVE ROE RULES ({roeConfig.rules?.length || 0} REGISTERED)
            </span>
            <button
              disabled={isSaving}
              onClick={handleSaveJson}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition shadow flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'SAVING...' : 'SAVE & HOT-RELOAD ROE'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: JSON Editor */}
            <div className="space-y-2">
              <span className="text-xs text-slate-400 font-bold">RAW JSON CONFIGURATION:</span>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                rows={22}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-cyan-300 font-mono text-[11px] leading-relaxed outline-none focus:border-cyan-500"
              />
            </div>

            {/* Right: Parsed Rule Cards */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              <span className="text-xs text-slate-400 font-bold">PARSED RULES:</span>
              {roeConfig.rules?.map((r: any) => (
                <div
                  key={r.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5 text-xs"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-cyan-400">{r.id}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        r.outcome === 'Optimal'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-600/50'
                          : r.outcome === 'Acceptable'
                          ? 'bg-cyan-950 text-cyan-300 border border-cyan-600/50'
                          : 'bg-red-950 text-red-300 border border-red-600/50'
                      }`}
                    >
                      {r.outcome} ({r.points} pts)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400 border-t border-slate-900 pt-1">
                    <div>
                      True Class: <span className="text-slate-200 font-bold">{r.true_class}</span>
                    </div>
                    <div>
                      Trainee: <span className="text-slate-200 font-bold">{r.trainee_classification}</span>
                    </div>
                    <div>
                      Response: <span className="text-slate-200 font-bold truncate">{r.trainee_response}</span>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate-400 italic">"{r.explanation}"</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCORING WEIGHTS & PENALTIES */}
      {activeTab === 'weights' && roeConfig && (
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-tactical font-bold text-slate-100 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              4-PILLAR SCORING WEIGHT CALIBRATION
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {['detection', 'classification', 'decision', 'calibration'].map((k) => {
                const currentVal = roeConfig.weights?.[k] ?? 0.25;
                return (
                  <div key={k} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2">
                    <span className="text-xs uppercase text-slate-400 font-bold block">{k}</span>
                    <div className="text-2xl font-bold font-tactical text-cyan-300">
                      {(currentVal * 100).toFixed(0)}%
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.60"
                      step="0.05"
                      value={currentVal}
                      onChange={(e) => handleWeightChange(k, parseFloat(e.target.value))}
                      className="w-full accent-cyan-500 cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-slate-800">
              <div className="text-xs text-slate-400">
                Critical Range Threshold: <span className="text-cyan-400 font-bold">{roeConfig.critical_range_m || 800}m</span>
              </div>
              <button
                disabled={isSaving}
                onClick={handleSaveJson}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition shadow flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> SAVE WEIGHTS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: TRAINEE PROFILES & RETEST OVERVIEW */}
      {activeTab === 'trainees' && overviewData && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-400 font-bold">
              BATTALION ROSTER ({overviewData.total_trainees} OPERATORS)
            </span>
            <button
              onClick={fetchOverview}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> REFRESH
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {overviewData.trainees?.map((t: any) => (
              <div
                key={t.id}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg"
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      {t.rank} {t.callsign}
                    </h3>
                    <p className="text-[10px] text-slate-400">{t.unit}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-700/60">
                    LVL {t.current_difficulty}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Sorties:</span>
                    <span className="text-slate-200 font-bold">{t.completed_sessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Mean Score:</span>
                    <span className="text-cyan-400 font-bold">{t.mean_score}%</span>
                  </div>
                </div>

                {/* Cognitive Mastery Mini-Bars */}
                <div className="space-y-1.5 pt-1 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    BKT Cognitive Mastery
                  </span>
                  {Object.entries(t.skills || {}).map(([sKey, sPct]: [string, any]) => (
                    <div key={sKey} className="space-y-0.5 text-[10px]">
                      <div className="flex justify-between text-slate-400">
                        <span className="truncate max-w-[150px]">{sKey.replace(/_/g, ' ')}</span>
                        <span className="font-bold text-slate-300">{sPct}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${sPct >= 70 ? 'bg-emerald-500' : 'bg-cyan-500'}`}
                          style={{ width: `${sPct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
