import React, { useState } from 'react';
import { TargetScoreDetail } from '../types';
import { GitBranch, ShieldAlert, CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';

interface AARDecisionTreeVisualizerProps {
  details: TargetScoreDetail[];
}

export const AARDecisionTreeVisualizer: React.FC<AARDecisionTreeVisualizerProps> = ({ details }) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    details.length > 0 ? details[0].target_id : ''
  );

  const selectedDetail = details.find((d) => d.target_id === selectedTargetId) || details[0];

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome) {
      case 'Optimal':
        return (
          <span className="px-2.5 py-1 rounded bg-emerald-950/80 border border-emerald-500/60 text-emerald-300 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> OPTIMAL (+{selectedDetail.decision_score_pts} PTS)
          </span>
        );
      case 'Acceptable':
        return (
          <span className="px-2.5 py-1 rounded bg-cyan-950/80 border border-cyan-500/60 text-cyan-300 font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> ACCEPTABLE (+{selectedDetail.decision_score_pts} PTS)
          </span>
        );
      case 'Over-reaction':
      case 'Under-reaction':
        return (
          <span className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-500/60 text-amber-300 font-bold flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> {outcome.toUpperCase()} (+{selectedDetail.decision_score_pts} PTS)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded bg-red-950/80 border border-red-500/60 text-red-300 font-bold flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" /> DANGEROUS ERROR ({selectedDetail.decision_score_pts} PTS)
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-700/70 rounded-xl p-4 shadow-xl space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <span className="text-xs font-mono text-cyan-400 font-bold uppercase flex items-center gap-1.5">
            <GitBranch className="w-4 h-4" /> DECISION-TREE RULE ENGINE EVALUATION
          </span>
          <p className="text-xs text-slate-400">
            Rule-based traversal path keyed on true class, trainee classification, sensor state, and proximity.
          </p>
        </div>

        {/* Target Tabs */}
        <div className="flex gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
          {details.map((d) => (
            <button
              key={d.target_id}
              onClick={() => setSelectedTargetId(d.target_id)}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition ${
                selectedTargetId === d.target_id
                  ? 'bg-cyan-600 text-slate-950'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {d.target_id}
            </button>
          ))}
        </div>
      </div>

      {selectedDetail ? (
        <div className="space-y-4">
          {/* Visual Decision Tree Nodes */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-center font-mono text-xs">
            {/* Node 1: True Class */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1 relative">
              <span className="text-[10px] text-slate-500 uppercase">1. Ground Truth</span>
              <div className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-cyan-400" />
                {selectedDetail.true_class.toUpperCase()}
              </div>
              <div className="text-[11px] text-slate-400">
                Detection latency: {selectedDetail.detection_latency.toFixed(1)}s
              </div>
            </div>

            <div className="hidden md:flex justify-center text-slate-600">
              <ArrowRight className="w-5 h-5 text-cyan-500" />
            </div>

            {/* Node 2: Trainee Classification & Response */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
              <span className="text-[10px] text-slate-500 uppercase">2. Trainee Action</span>
              <div className="font-bold text-slate-200 text-sm">
                {selectedDetail.trainee_classification ? selectedDetail.trainee_classification.toUpperCase() : 'NONE'}
              </div>
              <div className="text-[11px] text-amber-400 font-semibold truncate">
                Action: {selectedDetail.trainee_response ? selectedDetail.trainee_response.replace(/_/g, ' ') : 'NO RESPONSE'}
              </div>
            </div>

            {/* Node 3: Evaluated Outcome */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
              <span className="text-[10px] text-slate-500 uppercase">3. Decision Tree Outcome</span>
              <div>{getOutcomeBadge(selectedDetail.decision_outcome)}</div>
            </div>
          </div>

          {/* Decision Path Explanation Rationale */}
          <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 text-xs font-mono space-y-1">
            <span className="text-slate-400 font-bold uppercase text-[11px]">
              RULE SPECIFICATION & RATIONALE:
            </span>
            <p className="text-slate-200 leading-relaxed">
              {selectedDetail.decision_path}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
};
