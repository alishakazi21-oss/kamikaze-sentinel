import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { AARReport, TargetScoreDetail } from '../types';
import { AARDecisionTreeVisualizer } from '../components/AARDecisionTreeVisualizer';
import { AARFlightTrailReplay } from '../components/AARFlightTrailReplay';
import { Award, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight, TrendingUp, Bot, Clock, Crosshair } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface AARPageProps {
  aarData: AARReport | null;
  onScrambleNext: () => void;
  onNavigate: (tab: string) => void;
}

export const AARPage: React.FC<AARPageProps> = ({
  aarData,
  onScrambleNext,
  onNavigate,
}) => {
  useEffect(() => {
    if (aarData && aarData.score.total_score >= 80) {
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#10b981', '#38bdf8'],
      });
    }
  }, [aarData]);

  if (!aarData) {
    return (
      <div className="max-w-4xl mx-auto py-16 text-center font-mono space-y-4">
        <div className="text-slate-500 text-lg">NO AAR DEBRIEF DATA AVAILABLE</div>
        <p className="text-slate-400 text-sm">
          Execute a tactical drill simulation from the Scenario Setup screen to generate a comprehensive debrief.
        </p>
        <button
          onClick={() => onNavigate('setup')}
          className="px-6 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition"
        >
          START NEW SIMULATION
        </button>
      </div>
    );
  }

  const { score, trainee, scenario, target_events, ai_coaching_analysis, difficulty_change_reason } = aarData;

  // Grade calculation
  const getGrade = (pts: number) => {
    if (pts >= 90) return { grade: 'ALPHA (S)', color: 'text-emerald-400 border-emerald-500 bg-emerald-950/40' };
    if (pts >= 75) return { grade: 'BRAVO (A)', color: 'text-cyan-400 border-cyan-500 bg-cyan-950/40' };
    if (pts >= 60) return { grade: 'CHARLIE (B)', color: 'text-amber-400 border-amber-500 bg-amber-950/40' };
    return { grade: 'DELTA (C)', color: 'text-red-400 border-red-500 bg-red-950/40' };
  };

  const gradeInfo = getGrade(score.total_score);

  // Convert target events to details for visualizer
  const detailsList: TargetScoreDetail[] = target_events.map((e) => {
    const isCorrect = e.trainee_classification === e.true_class;
    return {
      target_id: e.target_id,
      true_class: e.true_class,
      detected: e.detected_at !== null && e.detected_at < 90,
      detection_latency: e.detected_at || 12.0,
      detection_score_pts: 25.0,
      classified: !!e.trainee_classification,
      trainee_classification: e.trainee_classification,
      classification_correct: isCorrect,
      classification_score_pts: isCorrect ? 30.0 : 0.0,
      responded: !!e.trainee_response,
      trainee_response: e.trainee_response,
      decision_outcome: (e.decision_outcome as any) || 'Optimal',
      decision_score_pts: e.score_points,
      decision_path: e.decision_path || 'Standard defensive procedure',
      reason_code: e.reason_code || 'OPTIMAL_ENGAGEMENT',
      confidence_rating: e.confidence_rating || 4,
      cross_checked: e.cross_checked || false,
      ai_suggested_class: e.true_class,
      ai_followed: e.ai_followed,
      ai_agreed: e.trainee_classification === e.true_class,
    };
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Top Header Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-700/60 font-mono text-xs font-bold">
            MISSION DEBRIEF // SESSION: {aarData.session_id}
          </div>
          <h1 className="text-3xl font-tactical font-black text-slate-100">
            AFTER-ACTION REVIEW (AAR)
          </h1>
          <p className="text-xs font-mono text-slate-400">
            Trainee: <span className="text-slate-200 font-bold">{trainee.rank} {trainee.callsign}</span> ({trainee.unit}) | Drill: {scenario.title}
          </p>
        </div>

        {/* Big Composite Score Box */}
        <div className="flex items-center gap-4">
          <div className="text-right font-mono">
            <span className="text-xs text-slate-400 uppercase">Composite Score</span>
            <div className="text-4xl font-tactical font-black text-cyan-300">
              {score.total_score.toFixed(1)} <span className="text-lg text-slate-500">/ 100</span>
            </div>
          </div>

          <div className={`px-4 py-3 rounded-2xl border text-center font-tactical font-black text-xl shadow-lg ${gradeInfo.color}`}>
            {gradeInfo.grade}
          </div>
        </div>
      </div>

      {/* 4 Pillars of Vyom-Rakshak Score Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pillar 1: Detection */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" /> 1. DETECTION
            </span>
            <span className="text-xs font-bold text-cyan-300">
              {score.detection_score.toFixed(1)} / 30 PTS
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Avg Reaction Latency:</span>
              <span className="text-slate-100 font-bold">{score.avg_detection_latency.toFixed(2)}s</span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full"
                style={{ width: `${Math.min(100, (score.detection_score / 30) * 100)}%` }}
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            Linear decay before 800m critical perimeter.
          </p>
        </div>

        {/* Pillar 2: Classification */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-emerald-400" /> 2. CLASSIFY
            </span>
            <span className="text-xs font-bold text-emerald-300">
              {score.classification_score.toFixed(1)} / 30 PTS
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Accuracy Rate:</span>
              <span className="text-emerald-400 font-bold">
                {Math.round(score.classification_accuracy * 100)}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${score.classification_accuracy * 100}%` }}
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            Discriminates blue force & birds from hostiles.
          </p>
        </div>

        {/* Pillar 3: Decision Quality */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" /> 3. DECISION
            </span>
            <span className="text-xs font-bold text-amber-300">
              {score.decision_score.toFixed(1)} / 30 PTS
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Optimal Choices:</span>
              <span className="text-amber-400 font-bold">{score.optimal_decisions_pct}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${score.optimal_decisions_pct}%` }}
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            Tactical escalation aligned with operational ROE.
          </p>
        </div>

        {/* Pillar 4: Calibration & OCI */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" /> 4. CALIBRATION
            </span>
            <span className="text-xs font-bold text-purple-300">
              {(score.calibration_score ?? 100.0).toFixed(1)} / 100 PTS
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Overconfidence (OCI):</span>
              <span className={`font-bold ${
                Math.abs(score.overconfidence_index ?? 0) <= 0.15
                  ? 'text-emerald-400'
                  : (score.overconfidence_index ?? 0) > 0.15
                  ? 'text-red-400'
                  : 'text-amber-400'
              }`}>
                {(score.overconfidence_index ?? 0) > 0 ? `+${(score.overconfidence_index ?? 0).toFixed(2)}` : (score.overconfidence_index ?? 0).toFixed(2)}
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500 rounded-full"
                style={{ width: `${Math.min(100, (score.calibration_score ?? 100) )}%` }}
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            {Math.abs(score.overconfidence_index ?? 0) <= 0.15
              ? 'Well calibrated: Confidence matches empirical skill.'
              : (score.overconfidence_index ?? 0) > 0.15
              ? 'Overconfident: High certainty on incorrect decisions.'
              : 'Underconfident: Hesitant certainty despite high accuracy.'}
          </p>
        </div>
      </div>

      {/* Adaptive Progression & AI Coaching Banners */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 font-mono text-xs">
        {/* Adaptive Difficulty Adjustment */}
        <div className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-4 space-y-2 shadow-lg">
          <div className="flex items-center gap-2 text-cyan-400 font-bold uppercase">
            <TrendingUp className="w-4 h-4" /> ADAPTIVE DIFFICULTY CALIBRATION
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            {difficulty_change_reason}
          </p>
        </div>

        {/* Automated AI Weakness Diagnostics */}
        <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-4 space-y-2 shadow-lg">
          <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase">
            <Bot className="w-4 h-4" /> DATA-DRIVEN COACHING & WEAKNESS DIAGNOSIS
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            {ai_coaching_analysis}
          </p>
        </div>
      </div>

      {/* Decision-Tree Rule Traversal Visualizer */}
      <AARDecisionTreeVisualizer details={detailsList} />

      {/* Target Engagement & Reason Codes Table */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <span className="text-slate-200 font-bold uppercase flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-cyan-400" /> TARGET ENGAGEMENTS & LEAF REASON CODES
          </span>
          <span className="text-slate-400 text-[11px]">
            {target_events.length} CONTACTS EVALUATED
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Target ID</th>
                <th className="py-2.5 px-3">Ground Truth</th>
                <th className="py-2.5 px-3">Trainee Class</th>
                <th className="py-2.5 px-3">Response</th>
                <th className="py-2.5 px-3">Leaf Reason Code</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Cross-Checked</th>
                <th className="py-2.5 px-3">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {target_events.map((ev) => {
                const isCorrect = ev.trainee_classification === ev.true_class;
                const reason = ev.reason_code || (isCorrect ? 'OPTIMAL_ENGAGEMENT' : 'MISCLASSIFICATION');
                const badgeClass =
                  reason === 'OPTIMAL_ENGAGEMENT'
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600/60'
                    : reason === 'APPROPRIATE_CLASSIFIED_CORRECT'
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-600/60'
                    : reason === 'SWARM_TREATED_AS_SINGLE'
                    ? 'bg-amber-950 text-amber-300 border-amber-600/60'
                    : reason === 'NO_CROSSCHECK'
                    ? 'bg-yellow-950 text-yellow-300 border-yellow-600/60'
                    : reason === 'FALSE_ALARM_ENGAGED'
                    ? 'bg-orange-950 text-orange-300 border-orange-600/60'
                    : reason === 'FRIENDLY_FIRE_INTERCEPTION'
                    ? 'bg-red-950 text-red-300 border-red-600/60 animate-pulse'
                    : reason === 'MISSED_HOSTILE' || reason === 'LATE_DETECTION'
                    ? 'bg-red-950 text-red-400 border-red-700/60'
                    : 'bg-purple-950 text-purple-300 border-purple-600/60';

                return (
                  <tr key={ev.target_id} className="hover:bg-slate-850 transition">
                    <td className="py-2.5 px-3 font-bold text-slate-200">{ev.target_id}</td>
                    <td className="py-2.5 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-300 uppercase">
                        {ev.true_class}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold">
                      <span className={isCorrect ? 'text-emerald-400' : 'text-red-400'}>
                        {ev.trainee_classification?.toUpperCase() || 'UNCLASSIFIED'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {ev.trainee_response?.replace(/_/g, ' ') || 'NONE'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded border text-[9px] font-bold ${badgeClass}`}>
                        {reason}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-cyan-300 font-bold">
                      {ev.confidence_rating ? `${ev.confidence_rating}/5` : '4/5'}
                    </td>
                    <td className="py-2.5 px-3">
                      {ev.cross_checked ? (
                        <span className="text-emerald-400 font-bold">YES (EO/RF)</span>
                      ) : (
                        <span className="text-slate-500">NO</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-bold ${
                          ev.decision_outcome === 'Optimal'
                            ? 'text-emerald-400'
                            : ev.decision_outcome === 'Acceptable'
                            ? 'text-cyan-400'
                            : 'text-red-400'
                        }`}
                      >
                        {ev.decision_outcome}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Flight Path Replay Scrubber (inspired by szymon-tulodziecki) */}
      {scenario.target_definitions && (
        <AARFlightTrailReplay
          targets={scenario.target_definitions}
          details={detailsList}
          totalDurationSeconds={aarData.duration_seconds || 60}
        />
      )}

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4">
        <button
          onClick={() => {
            soundFx.playButtonClick();
            onNavigate('analytics');
          }}
          className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-mono text-xs font-bold transition"
        >
          VIEW HISTORICAL ANALYTICS
        </button>

        <button
          onClick={() => {
            soundFx.playTargetLock();
            onScrambleNext();
          }}
          className="px-8 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold font-mono text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 tactical-glow-cyan transition"
        >
          SCRAMBLE NEXT ADAPTIVE SORTIE <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
