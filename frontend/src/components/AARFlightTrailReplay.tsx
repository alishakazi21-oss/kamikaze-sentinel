import React, { useRef, useEffect, useState } from 'react';
import { TargetDefinition, TargetScoreDetail } from '../types';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react';

interface AARFlightTrailReplayProps {
  targets: TargetDefinition[];
  details: TargetScoreDetail[];
  totalDurationSeconds: number;
}

export const AARFlightTrailReplay: React.FC<AARFlightTrailReplayProps> = ({
  targets,
  details,
  totalDurationSeconds = 60,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Playback timer loop
  useEffect(() => {
    let timer: number;
    if (isPlaying) {
      timer = window.setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= totalDurationSeconds) {
            setIsPlaying(false);
            return totalDurationSeconds;
          }
          return Math.min(totalDurationSeconds, prev + 0.2 * playbackSpeed);
        });
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, totalDurationSeconds]);

  // Render Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRange = 3600;
    const scale = (Math.min(centerX, centerY) - 30) / maxRange;

    // Background
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, width, height);

    // Range rings
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;
    [1000, 2000, 3000].forEach((r) => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, r * scale, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(100, 116, 139, 0.6)';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`${r}m`, centerX + 5, centerY - r * scale + 12);
    });

    // Crosshairs
    ctx.beginPath();
    ctx.moveTo(centerX, 20);
    ctx.lineTo(centerX, height - 20);
    ctx.moveTo(20, centerY);
    ctx.lineTo(width - 20, centerY);
    ctx.stroke();

    // Center Base
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.fillText('DEFENSE PERIMETER (0,0)', centerX + 10, centerY + 3);

    // Details lookup
    const detailsMap = new Map(details.map((d) => [d.target_id, d]));

    // Draw Flight Trails for each target
    targets.forEach((tgt) => {
      const d = detailsMap.get(tgt.id);
      const isHostile = tgt.target_class === 'hostile';
      const trailColor = isHostile ? 'rgba(239, 68, 68, 0.6)' : 'rgba(56, 189, 248, 0.6)';

      const startT = tgt.start_time;
      const spd = tgt.speed_mps;
      const hdgRad = ((tgt.heading_deg - 90) * Math.PI) / 180;

      // Full trajectory line
      const maxTraveled = spd * totalDurationSeconds;
      const endX = centerX + (tgt.start_x + maxTraveled * Math.cos(hdgRad)) * scale;
      const endY = centerY - (tgt.start_y + maxTraveled * Math.sin(hdgRad)) * scale;
      const sx = centerX + tgt.start_x * scale;
      const sy = centerY - tgt.start_y * scale;

      ctx.strokeStyle = 'rgba(51, 65, 85, 0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Trail up to currentTime
      if (currentTime >= startT) {
        const activeT = currentTime - startT;
        const currentDist = spd * activeT;
        const cx = centerX + (tgt.start_x + currentDist * Math.cos(hdgRad)) * scale;
        const cy = centerY - (tgt.start_y + currentDist * Math.sin(hdgRad)) * scale;

        // Solid traveled trail
        ctx.strokeStyle = trailColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(cx, cy);
        ctx.stroke();

        // Distance Labels along trail (every 500m)
        const stepDist = 600;
        for (let dist = stepDist; dist <= currentDist; dist += stepDist) {
          const lx = centerX + (tgt.start_x + dist * Math.cos(hdgRad)) * scale;
          const ly = centerY - (tgt.start_y + dist * Math.sin(hdgRad)) * scale;
          ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.fillText(`${dist}m`, lx + 4, ly - 4);
          ctx.beginPath();
          ctx.arc(lx, ly, 2, 0, Math.PI * 2);
          ctx.fill();
        }

        // Target current location blip
        ctx.fillStyle = isHostile ? '#ef4444' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(tgt.id, cx + 8, cy - 4);

        // Detection Point Flag
        if (d && d.detected && d.detection_latency <= activeT) {
          const detDist = spd * d.detection_latency;
          const dx = centerX + (tgt.start_x + detDist * Math.cos(hdgRad)) * scale;
          const dy = centerY - (tgt.start_y + detDist * Math.sin(hdgRad)) * scale;

          ctx.fillStyle = '#10b981';
          ctx.beginPath();
          ctx.arc(dx, dy, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#34d399';
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.fillText(`DETECTED (${d.detection_latency.toFixed(1)}s)`, dx + 6, dy + 10);
        }
      }
    });
  }, [targets, details, currentTime, totalDurationSeconds]);

  return (
    <div className="flex flex-col bg-slate-900 border border-slate-700/70 rounded-xl p-4 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-mono text-cyan-400 font-bold uppercase">
            FLIGHT PATH & ENGAGEMENT TRAIL REPLAY
          </span>
          <p className="text-xs text-slate-400">
            Interactive trajectory scrubber with dynamic distance labels and designation markers.
          </p>
        </div>

        {/* Speed Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded border border-slate-800 text-xs font-mono">
          <span className="text-slate-400">SPEED:</span>
          {[1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => setPlaybackSpeed(s)}
              className={`px-1.5 py-0.5 rounded ${
                playbackSpeed === s ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex justify-center bg-slate-950 rounded-lg p-2 border border-slate-800">
        <canvas ref={canvasRef} width={620} height={420} className="rounded" />
      </div>

      {/* Scrubber Controls */}
      <div className="flex items-center gap-4 bg-slate-950 px-4 py-2.5 rounded-lg border border-slate-800">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition font-bold"
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>

        <button
          onClick={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Timeline Slider */}
        <div className="flex-1 flex items-center gap-2">
          <span className="text-xs font-mono text-cyan-400 w-12">
            {currentTime.toFixed(1)}s
          </span>
          <input
            type="range"
            min={0}
            max={totalDurationSeconds}
            step={0.1}
            value={currentTime}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentTime(parseFloat(e.target.value));
            }}
            className="flex-1 accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
          />
          <span className="text-xs font-mono text-slate-500 w-12 text-right">
            {totalDurationSeconds.toFixed(1)}s
          </span>
        </div>

        <button
          onClick={() => setCurrentTime((t) => Math.min(totalDurationSeconds, t + 5))}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
        >
          <FastForward className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
