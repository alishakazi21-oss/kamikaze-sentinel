import React, { useRef, useEffect, useState } from 'react';
import { SyntheticTrack, SensorPlot } from '../types';
import { soundFx } from '../utils/audio';

interface Radar2DViewProps {
  tracks: SyntheticTrack[];
  sensorPlots?: SensorPlot[];
  enabledSensors?: Record<string, boolean>;
  selectedTrackId: string | null;
  onSelectTrack: (trackId: string) => void;
  terrain: string;
  sensorState: string;
  maxRangeMeters?: number;
}

export const Radar2DView: React.FC<Radar2DViewProps> = ({
  tracks,
  sensorPlots = [],
  enabledSensors = {
    radar: true,
    acoustic: true,
    camera_eo: true,
    camera_thermal: true,
    rf: true
  },
  selectedTrackId,
  onSelectTrack,
  terrain,
  sensorState,
  maxRangeMeters = 3500,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [zoomRange, setZoomRange] = useState<number>(maxRangeMeters);
  const trackTrailsRef = useRef<Map<string, Array<{ x: number; y: number; time: number }>>>(new Map());
  const sweepAngleRef = useRef<number>(0);

  // Update track historical trails
  useEffect(() => {
    const now = Date.now();
    const trails = trackTrailsRef.current;

    tracks.forEach((t) => {
      if (!trails.has(t.track_id)) {
        trails.set(t.track_id, []);
      }
      const history = trails.get(t.track_id)!;
      history.push({ x: t.x, y: t.y, time: now });
      while (history.length > 10 || (history.length > 0 && now - history[0].time > 8000)) {
        history.shift();
      }
    });
  }, [tracks]);

  // Main Canvas Rendering Loop with continuous sweep beam and multi-sensor overlays
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(centerX, centerY) - 25;

      // Clear with military tactical dark background
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, width, height);

      // Radar PPI scope background
      const grad = ctx.createRadialGradient(centerX, centerY, 5, centerX, centerY, radius);
      grad.addColorStop(0, 'rgba(8, 20, 36, 0.95)');
      grad.addColorStop(0.7, 'rgba(6, 16, 28, 0.98)');
      grad.addColorStop(1, 'rgba(4, 10, 18, 1)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();

      // Urban Masking Zones (building shadows in urban terrain)
      if (terrain === 'urban') {
        ctx.fillStyle = 'rgba(239, 68, 68, 0.04)';
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, (120 - 90) * (Math.PI / 180), (155 - 90) * (Math.PI / 180));
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = 'rgba(239, 68, 68, 0.2)';
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Range Rings (1000m, 2000m, 3000m, etc.)
      const ringSteps = [0.25, 0.5, 0.75, 1.0];
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.lineWidth = 1;

      ringSteps.forEach((step) => {
        const r = radius * step;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();

        // Range text
        const distKm = ((zoomRange * step) / 1000).toFixed(1);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.6)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(`${distKm}km`, centerX + 4, centerY - r + 12);
      });

      // Azimuth Radial Crosshairs (every 30 degrees)
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      ctx.lineWidth = 1;
      for (let deg = 0; deg < 360; deg += 30) {
        const rad = ((deg - 90) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + radius * Math.cos(rad), centerY + radius * Math.sin(rad));
        ctx.stroke();

        // Degree numbers
        const textRad = ((deg - 90) * Math.PI) / 180;
        const tx = centerX + (radius + 14) * Math.cos(textRad);
        const ty = centerY + (radius + 14) * Math.sin(textRad);
        ctx.fillStyle = 'rgba(148, 163, 184, 0.65)';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${deg}°`, tx, ty);
      }

      // Rotating Radar Sweep Beam
      sweepAngleRef.current = (sweepAngleRef.current + 1.2) % 360;
      const sweepRad = ((sweepAngleRef.current - 90) * Math.PI) / 180;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, sweepRad - 0.35, sweepRad);
      ctx.closePath();
      ctx.fillStyle = 'rgba(6, 182, 212, 0.08)';
      ctx.fill();

      // Leading bright sweep line
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(centerX + radius * Math.cos(sweepRad), centerY + radius * Math.sin(sweepRad));
      ctx.stroke();
      ctx.restore();

      // Helper function to scale coordinates
      const toScreenCoord = (xMeters: number, yMeters: number) => {
        const sx = centerX + (xMeters / zoomRange) * radius;
        const sy = centerY - (yMeters / zoomRange) * radius;
        return { sx, sy };
      };

      // Draw trails (past history dots)
      const trails = trackTrailsRef.current;
      trails.forEach((points) => {
        points.forEach((pt, idx) => {
          const { sx, sy } = toScreenCoord(pt.x, pt.y);
          const alpha = ((idx + 1) / points.length) * 0.4;
          ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      // -----------------------------------------------------------------------
      // MULTI-SENSOR PLOTS RENDERING (Distinct Markers per Sensor)
      // -----------------------------------------------------------------------
      if (sensorPlots && sensorPlots.length > 0) {
        sensorPlots.forEach((plot) => {
          if (!enabledSensors[plot.sensor_type]) return;

          const isSelected =
            plot.underlying_target_id === selectedTrackId ||
            plot.plot_id === selectedTrackId ||
            (selectedTrackId && selectedTrackId.includes(plot.underlying_target_id || ''));

          // 1. BEARING-ONLY SENSORS (Acoustic Array & RF Direction Finder)
          if (plot.range_m === null) {
            const rad = ((plot.bearing_deg - 90) * Math.PI) / 180;
            const endX = centerX + radius * Math.cos(rad);
            const endY = centerY + radius * Math.sin(rad);

            ctx.save();
            if (plot.sensor_type === 'acoustic') {
              // Amber dashed acoustic bearing strobe
              ctx.strokeStyle = plot.is_false_alarm ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.85)';
              ctx.lineWidth = isSelected ? 2.5 : 1.5;
              ctx.setLineDash([5, 5]);
              ctx.beginPath();
              ctx.moveTo(centerX, centerY);
              ctx.lineTo(endX, endY);
              ctx.stroke();
              ctx.setLineDash([]);

              // Acoustic receiver wave arc at outer edge
              ctx.strokeStyle = '#f59e0b';
              ctx.beginPath();
              ctx.arc(endX, endY, 6, rad - 0.4, rad + 0.4);
              ctx.stroke();

              ctx.fillStyle = '#f59e0b';
              ctx.font = '9px "JetBrains Mono", monospace';
              ctx.fillText(`ACU ${plot.bearing_deg}°`, endX + 8 * Math.cos(rad), endY + 8 * Math.sin(rad));
            } else if (plot.sensor_type === 'rf') {
              // Yellow RF strobe
              ctx.strokeStyle = 'rgba(234, 179, 8, 0.85)';
              ctx.lineWidth = isSelected ? 2.5 : 1.5;
              ctx.setLineDash([8, 3]);
              ctx.beginPath();
              ctx.moveTo(centerX, centerY);
              ctx.lineTo(endX, endY);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.fillStyle = '#eab308';
              ctx.font = '9px "JetBrains Mono", monospace';
              const freq = plot.metadata?.rf_frequency_ghz ? `${plot.metadata.rf_frequency_ghz}G` : '';
              ctx.fillText(`RF ${plot.bearing_deg}° ${freq}`, endX + 8 * Math.cos(rad), endY + 8 * Math.sin(rad));
            }
            ctx.restore();
            return;
          }

          // 2. RANGE-MEASURING SENSORS (Radar, Camera EO, Thermal FLIR)
          const pX = plot.x !== null ? plot.x : plot.range_m * Math.sin((plot.bearing_deg * Math.PI) / 180);
          const pY = plot.y !== null ? plot.y : plot.range_m * Math.cos((plot.bearing_deg * Math.PI) / 180);
          const { sx, sy } = toScreenCoord(pX, pY);

          ctx.save();
          ctx.translate(sx, sy);

          // SWARM MERGED RESOLUTION CELL (Flashing Warning Halo)
          if (plot.is_merged_swarm) {
            const pulse = 14 + Math.sin(Date.now() / 150) * 4;
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.8)';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);
            ctx.beginPath();
            ctx.arc(0, 0, pulse, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // Swarm Pill Badge
            ctx.fillStyle = 'rgba(239, 68, 68, 0.9)';
            ctx.fillRect(-22, -26, 44, 13);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 9px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`SWARM x${plot.merged_target_count}`, 0, -17);
          }

          // Sensor-Specific Plot Marker
          if (plot.sensor_type === 'radar') {
            // Cyan Diamond
            ctx.fillStyle = plot.is_false_alarm ? 'rgba(100, 116, 139, 0.7)' : '#38bdf8';
            ctx.beginPath();
            ctx.moveTo(0, -6);
            ctx.lineTo(6, 0);
            ctx.lineTo(0, 6);
            ctx.lineTo(-6, 0);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#94a3b8';
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(plot.plot_id, 9, -4);
          } else if (plot.sensor_type === 'camera_eo') {
            // Emerald Optical Crosshair Bracket [ + ]
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 1.5;
            const b = 6;
            ctx.beginPath();
            ctx.moveTo(-b, -b);
            ctx.lineTo(-b, -b + 3);
            ctx.moveTo(-b, -b);
            ctx.lineTo(-b + 3, -b);

            ctx.moveTo(b, -b);
            ctx.lineTo(b, -b + 3);
            ctx.moveTo(b, -b);
            ctx.lineTo(b - 3, -b);

            ctx.moveTo(-b, b);
            ctx.lineTo(-b, b - 3);
            ctx.moveTo(-b, b);
            ctx.lineTo(-b + 3, b);

            ctx.moveTo(b, b);
            ctx.lineTo(b, b - 3);
            ctx.moveTo(b, b);
            ctx.lineTo(b - 3, b);

            ctx.moveTo(0, -2);
            ctx.lineTo(0, 2);
            ctx.moveTo(-2, 0);
            ctx.lineTo(2, 0);
            ctx.stroke();

            ctx.fillStyle = '#10b981';
            ctx.font = '8px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText('EO CAM', 9, 5);
          } else if (plot.sensor_type === 'camera_thermal') {
            // Purple Thermal Heat Square [ ■ ]
            ctx.strokeStyle = '#c084fc';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-5, -5, 10, 10);
            ctx.fillStyle = 'rgba(192, 132, 252, 0.6)';
            ctx.fillRect(-2, -2, 4, 4);

            ctx.fillStyle = '#c084fc';
            ctx.font = '8px "JetBrains Mono", monospace';
            ctx.textAlign = 'left';
            ctx.fillText('FLIR', 8, 5);
          }

          // Lock-on Reticle if Selected
          if (isSelected) {
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.arc(0, 0, 16, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
          }

          ctx.restore();
        });
      } else {
        // Fallback: draw standard fused tracks if sensorPlots is empty
        tracks.forEach((track) => {
          const { sx, sy } = toScreenCoord(track.x, track.y);
          const isSelected = track.track_id === selectedTrackId;
          const color = track.is_clutter ? '#64748b' : track.status === 'degraded' ? '#f59e0b' : '#38bdf8';

          ctx.save();
          ctx.translate(sx, sy);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(6, 0);
          ctx.lineTo(0, 6);
          ctx.lineTo(-6, 0);
          ctx.closePath();
          ctx.fill();

          if (isSelected) {
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, Math.PI * 2);
            ctx.stroke();
          }
          ctx.restore();
        });
      }

      // Base Station Center Marker
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('BASE (0,0)', centerX + 12, centerY + 3);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [tracks, sensorPlots, enabledSensors, selectedTrackId, zoomRange, terrain, sensorState]);

  // Click on canvas to designate target
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(centerX, centerY) - 25;

    const mPerPixel = zoomRange / radius;
    const clickXMeters = (clickX - centerX) * mPerPixel;
    const clickYMeters = -(clickY - centerY) * mPerPixel;

    let closestId: string | null = null;
    let minDist = 400;

    // Check tracks first
    tracks.forEach((t) => {
      const dist = Math.hypot(t.x - clickXMeters, t.y - clickYMeters);
      if (dist < minDist) {
        minDist = dist;
        closestId = t.track_id;
      }
    });

    // Check range plots
    sensorPlots.forEach((p) => {
      if (p.x !== null && p.y !== null) {
        const dist = Math.hypot(p.x - clickXMeters, p.y - clickYMeters);
        if (dist < minDist) {
          minDist = dist;
          closestId = p.underlying_target_id || p.plot_id;
        }
      }
    });

    if (closestId) {
      soundFx.playTargetLock();
      onSelectTrack(closestId);
    }
  };

  return (
    <div className="relative flex flex-col items-center select-none">
      {/* Range Zoom Controls */}
      <div className="absolute top-3 left-4 z-10 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur border border-slate-700/60 rounded px-2 py-1 text-xs font-mono">
        <span className="text-slate-400">RANGE:</span>
        {[1500, 3000, 5000].map((rng) => (
          <button
            key={rng}
            onClick={() => setZoomRange(rng)}
            className={`px-2 py-0.5 rounded transition ${
              zoomRange === rng
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {rng / 1000}km
          </button>
        ))}
      </div>

      {/* Sensor Legend Banner */}
      <div className="absolute top-3 right-4 z-10 hidden sm:flex items-center gap-3 bg-slate-900/85 backdrop-blur border border-slate-800 rounded px-3 py-1 text-[10px] font-mono text-slate-300">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rotate-45 bg-cyan-400 inline-block"></span>
          <span>Radar</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-0.5 border-t border-amber-400 border-dashed inline-block"></span>
          <span>Acoustic</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-emerald-400 font-bold">⊞</span>
          <span>EO Cam</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 border border-purple-400 inline-block"></span>
          <span>Thermal</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-0.5 border-t border-yellow-400 inline-block"></span>
          <span>RF DF</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full border border-red-500 inline-block animate-pulse"></span>
          <span className="text-red-400 font-bold">Swarm</span>
        </div>
      </div>

      {/* PPI Canvas */}
      <canvas
        ref={canvasRef}
        width={580}
        height={580}
        onClick={handleCanvasClick}
        className="rounded-full shadow-2xl border-2 border-cyan-500/30 cursor-crosshair"
      />
    </div>
  );
};
