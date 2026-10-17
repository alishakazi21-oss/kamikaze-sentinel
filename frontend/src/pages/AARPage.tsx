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

      {/* 3 Pillars Score Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Pillar 1: Detection */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" /> 1. DETECTION LATENCY
            </span>
            <span className="text-sm font-bold text-cyan-300">
              {score.detection_score.toFixed(1)} / 30.0 PTS
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Avg Reaction Latency:</span>
              <span className="text-slate-100 font-bold">{score.avg_detection_latency.toFixed(2)}s</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full"
                style={{ width: `${(score.detection_score / 30) * 100}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Evaluated on linear decay window ({scenario.difficulty === 1 ? '6s full mark' : scenario.difficulty === 2 ? '4.5s' : '3s'}).
          </p>
        </div>

        {/* Pillar 2: Classification */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1.5">
              <Crosshair className="w-4 h-4 text-emerald-400" /> 2. CLASSIFICATION ACCURACY
            </span>
            <span className="text-sm font-bold text-emerald-300">
              {score.classification_score.toFixed(1)} / 30.0 PTS
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Accuracy Rate:</span>
              <span className="text-emerald-400 font-bold">
                {Math.round(score.classification_accuracy * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${score.classification_accuracy * 100}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Zero friendly-fire tolerance. Hostiles differentiated from commercial craft and birds.
          </p>
        </div>

        {/* Pillar 3: Decision Quality */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 font-mono">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold uppercase flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-400" /> 3. DECISION QUALITY
            </span>
            <span className="text-sm font-bold text-amber-300">
              {score.decision_score.toFixed(1)} / 40.0 PTS
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Optimal Choices:</span>
              <span className="text-amber-400 font-bold">{score.optimal_decisions_pct}%</span>
            </div>
            <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${score.optimal_decisions_pct}%` }}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Evaluated by rule table on proximity, true threat nature, and defensive escalation.
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
