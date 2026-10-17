import React, { useRef, useEffect, useState } from 'react';
import { SyntheticTrack } from '../types';
import { soundFx } from '../utils/audio';

interface Radar2DViewProps {
  tracks: SyntheticTrack[];
  selectedTrackId: string | null;
  onSelectTrack: (trackId: string) => void;
  terrain: string;
  sensorState: string;
  maxRangeMeters?: number;
}

export const Radar2DView: React.FC<Radar2DViewProps> = ({
  tracks,
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
      // Keep only last 10 points within 8 seconds
      while (history.length > 10 || (history.length > 0 && now - history[0].time > 8000)) {
        history.shift();
      }
    });
  }, [tracks]);

  // Main Canvas Rendering Loop with continuous sweep beam
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
        // Masking wedge between 120° and 155°
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

      // Range Rings (1000m, 2000m, 3000m etc.)
      const ringSteps = [0.25, 0.5, 0.75, 1.0];
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
      ctx.lineWidth = 1;

      ringSteps.forEach((step) => {
        const r = radius * step;
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();

        // Distance label
        const distLabel = `${Math.round((zoomRange * step) / 100) / 10} km`;
        ctx.fillStyle = 'rgba(6, 182, 212, 0.6)';
        ctx.font = '10px "JetBrains Mono", monospace';
        ctx.fillText(distLabel, centerX + 6, centerY - r + 12);
      });

      // Azimuth Crosshairs and 30-degree spokes
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
      for (let deg = 0; deg < 360; deg += 30) {
        const rad = ((deg - 90) * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + radius * Math.cos(rad), centerY + radius * Math.sin(rad));
        ctx.stroke();

        // Azimuth degree labels on circumference
        const labelRad = ((deg - 90) * Math.PI) / 180;
        const lx = centerX + (radius + 14) * Math.cos(labelRad);
        const ly = centerY + (radius + 14) * Math.sin(labelRad);
        ctx.fillStyle = deg % 90 === 0 ? 'rgba(6, 182, 212, 0.9)' : 'rgba(100, 116, 139, 0.7)';
        ctx.font = deg % 90 === 0 ? 'bold 11px "JetBrains Mono", monospace' : '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const card = deg === 0 ? '000° N' : deg === 90 ? '090° E' : deg === 180 ? '180° S' : deg === 270 ? '270° W' : `${deg}°`;
        ctx.fillText(card, lx, ly);
      }

      // Outer bezel ring
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Rotating Radar Sweeper Beam with phosphor glow tail
      sweepAngleRef.current = (sweepAngleRef.current + 1.2) % 360;
      const sweepRad = ((sweepAngleRef.current - 90) * Math.PI) / 180;
      const tailAngle = 45 * (Math.PI / 180); // 45-degree persistence arc

      const sweepGrad = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      sweepGrad.addColorStop(0, 'rgba(6, 182, 212, 0.4)');
      sweepGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, sweepRad - tailAngle, sweepRad);
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
        // x is East (+X), y is North (+Y)
        const sx = centerX + (xMeters / zoomRange) * radius;
        const sy = centerY - (yMeters / zoomRange) * radius;
        return { sx, sy };
      };

      // Draw trails (past history dots)
      const trails = trackTrailsRef.current;
      trails.forEach((points) => {
        points.forEach((pt, idx) => {
          const { sx, sy } = toScreenCoord(pt.x, pt.y);
          const alpha = (idx + 1) / points.length * 0.4;
          ctx.fillStyle = `rgba(6, 182, 212, ${alpha})`;
          ctx.beginPath();
          ctx.arc(sx, sy, 2, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      // Draw active tracks
      tracks.forEach((track) => {
        const { sx, sy } = toScreenCoord(track.x, track.y);
        const isSelected = track.track_id === selectedTrackId;

        // Choose color based on track category/clutter
        let color = '#38bdf8'; // Default cyan
        if (track.is_clutter) {
          color = '#64748b'; // Avian/Clutter slate
        } else if (track.status === 'degraded' || sensorState === 'jammed') {
          color = '#f59e0b'; // Amber warning
        }

        // Draw track blip
        ctx.save();
        ctx.translate(sx, sy);

        if (track.is_clutter) {
          // Cross blip for clutter
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(-4, -4);
          ctx.lineTo(4, 4);
          ctx.moveTo(4, -4);
          ctx.lineTo(-4, 4);
          ctx.stroke();
        } else {
          // Tactical diamond blip
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(6, 0);
          ctx.moveTo(6, 0);
          ctx.lineTo(0, 6);
          ctx.lineTo(-6, 0);
          ctx.closePath();
          ctx.fill();

          // Velocity vector line (heading and speed)
          const hdgRad = ((track.heading_deg - 90) * Math.PI) / 180;
          const vecLen = Math.min(25, Math.max(8, track.speed_mps * 0.7));
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(vecLen * Math.cos(hdgRad), vecLen * Math.sin(hdgRad));
          ctx.stroke();

          // Track label
          ctx.fillStyle = isSelected ? '#38bdf8' : '#94a3b8';
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.fillText(track.track_id, 9, -5);
          ctx.font = '9px "JetBrains Mono", monospace';
          ctx.fillStyle = '#64748b';
          ctx.fillText(`${Math.round(track.altitude_m)}m | ${Math.round(track.speed_mps)}m/s`, 9, 6);
        }

        // If selected: Rotating lock-on reticle
        if (isSelected) {
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.arc(0, 0, 16, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Outer brackets
          const bSize = 20;
          ctx.strokeStyle = '#ef4444';
          ctx.strokeRect(-bSize / 2, -bSize / 2, bSize, bSize);
        }

        ctx.restore();
      });

      // Base Station Center Marker
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#059669';
      ctx.strokeRect(centerX - 9, centerY - 9, 18, 18);
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#10b981';
      ctx.fillText('BASE (0,0)', centerX + 12, centerY + 3);

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [tracks, selectedTrackId, zoomRange, terrain, sensorState]);

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

    // Convert click to meters
    const mPerPixel = zoomRange / radius;
    const clickXMeters = (clickX - centerX) * mPerPixel;
    const clickYMeters = -(clickY - centerY) * mPerPixel;

    // Find closest track within threshold
    let closestTrack: SyntheticTrack | null = null;
    let minDist = 400; // meters threshold

    tracks.forEach((t) => {
      const dist = Math.hypot(t.x - clickXMeters, t.y - clickYMeters);
      if (dist < minDist) {
        minDist = dist;
        closestTrack = t;
      }
    });

    if (closestTrack) {
      soundFx.playTargetLock();
      onSelectTrack((closestTrack as SyntheticTrack).track_id);
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

      {/* Sensor Fidelity Badge */}
      <div className="absolute top-3 right-4 z-10 flex items-center gap-2 bg-slate-900/80 backdrop-blur border border-slate-700/60 rounded px-2.5 py-1 text-xs font-mono">
        <span className="text-slate-400">SENSOR:</span>
        <span
          className={`font-semibold uppercase ${
            sensorState === 'normal'
              ? 'text-emerald-400'
              : sensorState === 'degraded'
              ? 'text-amber-400'
              : 'text-red-400 animate-pulse'
          }`}
        >
          {sensorState}
        </span>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        width={560}
        height={560}
        onClick={handleCanvasClick}
        className="cursor-crosshair rounded-xl border border-cyan-500/30 tactical-glow-cyan bg-slate-950 shadow-2xl"
      />
    </div>
  );
};
