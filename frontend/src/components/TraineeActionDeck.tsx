import React, { useState } from 'react';
import { SyntheticTrack, TargetClass, ResponseOption, AIAssistResult } from '../types';
import { soundFx } from '../utils/audio';
import { ShieldAlert, Crosshair, HelpCircle, Eye, AlertTriangle, Zap, Bot, CheckCircle2 } from 'lucide-react';

interface TraineeActionDeckProps {
  selectedTrack: SyntheticTrack | null;
  targetEvents: Map<string, { detected: boolean; classification?: string; response?: string; aiFollowed?: boolean; confidenceRating?: number }>;
  onDetect: (track: SyntheticTrack) => void;
  onClassify: (track: SyntheticTrack, targetClass: TargetClass, aiFollowed?: boolean, confidenceRating?: number) => void;
  onRespond: (track: SyntheticTrack, response: ResponseOption) => void;
}

export const TraineeActionDeck: React.FC<TraineeActionDeckProps> = ({
  selectedTrack,
  targetEvents,
  onDetect,
  onClassify,
  onRespond,
}) => {
  const [aiEnabled, setAiEnabled] = useState<boolean>(true);
  const [aiResult, setAiResult] = useState<AIAssistResult | null>(null);
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [confidenceRating, setConfidenceRating] = useState<number>(4);

  // Current track action status
  const currentEvent = selectedTrack ? targetEvents.get(selectedTrack.track_id) : undefined;
  const isDetected = currentEvent?.detected || false;
  const currentClassification = currentEvent?.classification;
  const currentResponse = currentEvent?.response;

  // Query Real ML Model from Backend
  const handleQueryAI = async (track: SyntheticTrack) => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          speed: track.speed_mps,
          altitude: track.altitude_m,
          range_m: track.range_m,
          rcs_estimate: track.rcs_estimate_dbsm,
          rf_frequency: track.rf_detected_ghz,
          time_of_day: 'day',
          sensor_state: track.status === 'degraded' ? 'degraded' : 'normal',
        }),
      });
      if (res.ok) {
        const data: AIAssistResult = await res.json();
        setAiResult(data);
      }
    } catch (e) {
      console.error('AI inference error', e);
    } finally {
      setAiLoading(false);
    }
  };

  // Re-run AI when track changes and AI is enabled
  React.useEffect(() => {
    if (selectedTrack && aiEnabled) {
      handleQueryAI(selectedTrack);
    } else {
      setAiResult(null);
    }
  }, [selectedTrack?.track_id, aiEnabled]);

  const handleClassifyClick = (cls: TargetClass) => {
    if (!selectedTrack) return;
    soundFx.playButtonClick();
    const followedAI = aiResult ? cls === aiResult.suggested_class : false;
    onClassify(selectedTrack, cls, followedAI, confidenceRating);
  };

  const handleRespondClick = (resp: ResponseOption) => {
    if (!selectedTrack) return;
    if (resp === 'authorise_protective_response') {
      soundFx.playEngagementAlert();
    } else {
      soundFx.playButtonClick();
    }
    onRespond(selectedTrack, resp);
  };

  return (
    <div className="flex flex-col bg-slate-900/90 border border-slate-700/70 rounded-xl p-4 shadow-xl space-y-4">
      {/* Target Status Banner */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <span className="text-xs font-mono text-slate-400">DESIGNATED TARGET</span>
          <h3 className="text-lg font-tactical font-bold text-cyan-400">
            {selectedTrack ? selectedTrack.track_id : 'NO TARGET SELECTED'}
          </h3>
        </div>

        {/* AI Assist Toggle */}
        <div className="flex items-center gap-2 bg-slate-950/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <Bot className={`w-4 h-4 ${aiEnabled ? 'text-cyan-400' : 'text-slate-500'}`} />
          <span className="text-xs font-mono text-slate-300">AI ASSIST</span>
          <button
            onClick={() => setAiEnabled(!aiEnabled)}
            className={`w-8 h-4 rounded-full transition-colors relative ${
              aiEnabled ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                aiEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* AI Inference Card */}
      {aiEnabled && selectedTrack && (
        <div className="bg-cyan-950/20 border border-cyan-500/30 rounded-lg p-3 text-xs font-mono space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-cyan-400 font-semibold flex items-center gap-1.5">
              <Bot className="w-3.5 h-3.5" /> SCIKIT-LEARN RADAR CLASSIFIER
            </span>
            {aiLoading ? (
              <span className="text-slate-400 animate-pulse">Analyzing...</span>
            ) : aiResult ? (
              <span className="px-2 py-0.5 rounded bg-cyan-900/60 text-cyan-300 font-bold border border-cyan-600/40">
                {Math.round(aiResult.confidence * 100)}% CONFIDENCE
              </span>
            ) : null}
          </div>

          {aiResult && (
            <>
              <div className="flex items-center justify-between text-slate-200">
                <div>
                  Suggested Class:{' '}
                  <span className="font-bold uppercase text-amber-300">
                    {aiResult.suggested_class.replace('_', ' ')}
                  </span>
                </div>
                {aiResult.is_uncertain ? (
                  <span className="px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-600/60 font-bold text-[10px] animate-pulse">
                    HIGH UNCERTAINTY (VERIFY)
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-600/60 font-bold text-[10px]">
                    UNCERTAINTY: {((aiResult.uncertainty_score ?? 0.1) * 100).toFixed(0)}%
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {aiResult.explanation}
              </p>
              {aiResult.class_probabilities && (
                <div className="grid grid-cols-4 gap-1 pt-1 text-[9px] text-slate-400 border-t border-cyan-900/40">
                  {Object.entries(aiResult.class_probabilities).map(([cls, prob]) => (
                    <div key={cls} className="text-center">
                      <span className="uppercase text-[8px] text-slate-500 block truncate">{cls.replace('false_alarm', 'clutter')}</span>
                      <span className="font-bold text-slate-300">{Math.round((prob as number) * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ACTION STEP 1: DETECT */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-slate-400">STEP 1: DESIGNATE / DETECT</span>
          {isDetected && (
            <span className="text-emerald-400 flex items-center gap-1 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5" /> MARKED DETECTED
            </span>
          )}
        </div>

        <button
          disabled={!selectedTrack || isDetected}
          onClick={() => {
            if (selectedTrack) {
              soundFx.playTargetLock();
              onDetect(selectedTrack);
            }
          }}
          className={`w-full py-2 px-3 rounded-lg flex items-center justify-center gap-2 font-mono text-xs font-bold transition ${
            !selectedTrack
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : isDetected
              ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
              : 'bg-cyan-600 hover:bg-cyan-500 text-slate-950 tactical-glow-cyan'
          }`}
        >
          <Crosshair className="w-4 h-4" />
          {isDetected ? 'TARGET DESIGNATION LOCKED' : 'DESIGNATE & MARK DETECTION TIME'}
        </button>
      </div>

      {/* ACTION STEP 2: CLASSIFY */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-slate-400">STEP 2: THREAT CLASSIFICATION</span>
          {currentClassification && (
            <span className="text-cyan-400 font-bold uppercase">
              {currentClassification.replace('_', ' ')}
            </span>
          )}
        </div>

        {/* Confidence Slider (1 to 5) */}
        <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 space-y-1.5">
          <div className="flex justify-between items-center text-[11px] font-mono">
            <span className="text-slate-400">OPERATOR CONFIDENCE:</span>
            <span className="font-bold text-cyan-400">
              {confidenceRating} / 5 · {
                confidenceRating === 1 ? 'Very Low / Speculative' :
                confidenceRating === 2 ? 'Low / Uncertain' :
                confidenceRating === 3 ? 'Moderate / Plausible' :
                confidenceRating === 4 ? 'High / Confident' : 'Very High / Certain'
              }
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={confidenceRating}
            onChange={(e) => setConfidenceRating(parseInt(e.target.value, 10))}
            className="w-full accent-cyan-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[9px] font-mono text-slate-500 px-0.5">
            <span>1: Guess</span>
            <span>2: Uncertain</span>
            <span>3: Plausible</span>
            <span>4: Confident</span>
            <span>5: Certain</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Hostile */}
          <button
            disabled={!selectedTrack}
            onClick={() => handleClassifyClick('hostile')}
            className={`p-2 rounded-lg border text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition ${
              currentClassification === 'hostile'
                ? 'bg-red-950 border-red-500 text-red-300 tactical-glow-red'
                : 'bg-slate-950/70 border-slate-800 text-red-400 hover:border-red-500/50'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" /> HOSTILE DRONE
          </button>

          {/* Friendly */}
          <button
            disabled={!selectedTrack}
            onClick={() => handleClassifyClick('friendly')}
            className={`p-2 rounded-lg border text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition ${
              currentClassification === 'friendly'
                ? 'bg-emerald-950 border-emerald-500 text-emerald-300 tactical-glow-green'
                : 'bg-slate-950/70 border-slate-800 text-emerald-400 hover:border-emerald-500/50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> FRIENDLY UAS
          </button>

          {/* Civil */}
          <button
            disabled={!selectedTrack}
            onClick={() => handleClassifyClick('civil')}
            className={`p-2 rounded-lg border text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition ${
              currentClassification === 'civil'
                ? 'bg-amber-950 border-amber-500 text-amber-300'
                : 'bg-slate-950/70 border-slate-800 text-amber-400 hover:border-amber-500/50'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" /> CIVIL / DRONE
          </button>

          {/* False Alarm */}
          <button
            disabled={!selectedTrack}
            onClick={() => handleClassifyClick('false_alarm')}
            className={`p-2 rounded-lg border text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition ${
              currentClassification === 'false_alarm'
                ? 'bg-slate-800 border-slate-400 text-slate-200'
                : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-600'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" /> BIRD / CLUTTER
          </button>
        </div>
      </div>

      {/* ACTION STEP 3: TACTICAL ENGAGEMENT RESPONSE */}
      <div className="space-y-2">
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-slate-400">STEP 3: ENGAGEMENT DECISION</span>
          {currentResponse && (
            <span className="text-amber-400 font-bold uppercase text-[11px]">
              {currentResponse.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Monitor */}
          <button
            disabled={!selectedTrack}
            onClick={() => handleRespondClick('continue_monitoring')}
            className={`p-2 rounded-lg border text-xs font-mono transition text-left ${
              currentResponse === 'continue_monitoring'
                ? 'bg-slate-800 border-cyan-400 text-cyan-200'
                : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600'
            }`}
          >
            <div className="font-bold">CONTINUE MONITOR</div>
            <div className="text-[10px] text-slate-500">Track passive path</div>
          </button>

          {/* Verify */}
          <button
            disabled={!selectedTrack}
            onClick={() => handleRespondClick('request_verification')}
            className={`p-2 rounded-lg border text-xs font-mono transition text-left ${
              currentResponse === 'request_verification'
                ? 'bg-slate-800 border-cyan-400 text-cyan-200'
                : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-600'
            }`}
          >
            <div className="font-bold">REQUEST VERIFY</div>
            <div className="text-[10px] text-slate-500">Secondary IFF query</div>
          </button>

          {/* Alert */}
          <button
            disabled={!selectedTrack}
            onClick={() => handleRespondClick('raise_alert')}
            className={`p-2 rounded-lg border text-xs font-mono transition text-left ${
              currentResponse === 'raise_alert'
                ? 'bg-amber-950/80 border-amber-500 text-amber-200'
                : 'bg-slate-950/70 border-slate-800 text-amber-400 hover:border-amber-500/50'
            }`}
          >
            <div className="font-bold flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> RAISE AIR ALERT
            </div>
            <div className="text-[10px] text-slate-500">Defensive scramble</div>
          </button>

          {/* Authorise Protective Response */}
          <button
            disabled={!selectedTrack}
            onClick={() => handleRespondClick('authorise_protective_response')}
            className={`p-2 rounded-lg border text-xs font-mono transition text-left ${
              currentResponse === 'authorise_protective_response'
                ? 'bg-red-950 border-red-500 text-red-200 tactical-glow-red animate-pulse'
                : 'bg-slate-950/70 border-slate-800 text-red-400 hover:border-red-500/50'
            }`}
          >
            <div className="font-bold flex items-center gap-1">
              <Zap className="w-3 h-3 text-red-400" /> INTERCEPT / JAM
            </div>
            <div className="text-[10px] text-slate-500">Kinetic/EW response</div>
          </button>
        </div>
      </div>
    </div>
  );
};
