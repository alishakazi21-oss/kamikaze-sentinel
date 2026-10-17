import math
import random
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from .base import TargetTelemetry


class ObservedTrack(BaseModel):
    track_id: str
    timestamp: float
    x: float
    y: float
    range_m: float
    bearing_deg: float
    altitude_m: float
    speed_mps: float
    heading_deg: float
    rcs_estimate_dbsm: float
    rf_detected_ghz: Optional[float] = None
    sensor_confidence: float  # 0.0 to 1.0
    visual_signature: str
    thermal_signature: str
    is_clutter: bool = False
    status: str = "tracking"  # tracking, degraded, masked
    underlying_target_id: Optional[str] = None


class SyntheticSensorModel:
    """
    Transforms clean ground-truth targets into realistic synthetic radar and EO tracks.
    Introduces Gaussian sensor noise, radar horizon masking, urban building occlusion,
    environmental attenuation (night/fog), dropout, and false clutter blips.
    """

    def __init__(self, seed: Optional[int] = None):
        self.rng = random.Random(seed if seed is not None else 42)

    def process(
        self,
        ground_truth: List[TargetTelemetry],
        elapsed_seconds: float,
        sensor_state: str = "normal",
        sensor_reliability: float = 1.0,
        terrain: str = "urban",
        time_of_day: str = "day",
        clutter_density: float = 0.1
    ) -> List[ObservedTrack]:
        observed_tracks: List[ObservedTrack] = []

        # Determine noise multipliers based on sensor state
        if sensor_state == "jammed":
            range_noise_sigma = 85.0
            bearing_noise_sigma = 3.5
            altitude_noise_sigma = 40.0
            speed_noise_sigma = 6.0
            dropout_prob = max(0.40, 1.0 - sensor_reliability * 0.4)
            confidence_base = 0.45
        elif sensor_state == "degraded":
            range_noise_sigma = 35.0
            bearing_noise_sigma = 1.8
            altitude_noise_sigma = 20.0
            speed_noise_sigma = 3.2
            dropout_prob = max(0.20, 1.0 - sensor_reliability * 0.7)
            confidence_base = 0.65
        else:  # normal
            range_noise_sigma = 8.0
            bearing_noise_sigma = 0.4
            altitude_noise_sigma = 5.0
            speed_noise_sigma = 0.8
            dropout_prob = max(0.02, 1.0 - sensor_reliability)
            confidence_base = 0.92

        # Process each ground-truth target
        for tgt in ground_truth:
            if not tgt.is_active or elapsed_seconds < tgt.start_time:
                continue

            # Check urban building masking: if low altitude (< 35m) in urban terrain at range > 1200m
            is_masked = False
            if terrain == "urban" and tgt.altitude < 40.0 and tgt.range_m > 1000.0:
                # 30% chance of being in building radar shadow
                if self.rng.random() < 0.28:
                    is_masked = True

            # If masked or dropped out due to sensor degradation
            if is_masked:
                continue

            if self.rng.random() < dropout_prob:
                # Dropout on this radar sweep
                continue

            # Add Gaussian noise
            noisy_range = max(10.0, tgt.range_m + self.rng.gauss(0, range_noise_sigma))
            noisy_bearing = (tgt.bearing_deg + self.rng.gauss(0, bearing_noise_sigma)) % 360.0
            noisy_alt = max(5.0, tgt.altitude + self.rng.gauss(0, altitude_noise_sigma))
            noisy_speed = max(0.0, tgt.speed + self.rng.gauss(0, speed_noise_sigma))
            noisy_heading = (tgt.heading + self.rng.gauss(0, bearing_noise_sigma * 2)) % 360.0

            # Calculate Cartesian (East/North) from noisy range and bearing
            rad = math.radians(noisy_bearing)
            noisy_x = noisy_range * math.sin(rad)
            noisy_y = noisy_range * math.cos(rad)

            # Night & Fog visual degradation
            if time_of_day == "night":
                vis_sig = "Low-light optical: Unresolved dark silhouette; IR glow active"
                thermal_sig = f"FLIR LWIR: Motor hot-spot ~{38 + int(tgt.speed * 1.5)}°C; rotor heat flicker"
                conf_penalty = 0.18
            elif time_of_day == "dusk":
                vis_sig = "Dusk ambient: Moderate optical contrast; strobe flashing observed"
                thermal_sig = "FLIR MWIR: Sharp thermal contrast against cooling sky"
                conf_penalty = 0.08
            else:
                vis_sig = f"Clear Day Optical: High-res silhouette; {tgt.model_type} airframe"
                thermal_sig = "FLIR MWIR: Normal propulsion thermal signature"
                conf_penalty = 0.0

            # Compute track confidence
            track_conf = max(0.20, min(0.99, confidence_base - conf_penalty + self.rng.uniform(-0.05, 0.05)))

            # RF signature detection (probabilistic under jamming)
            rf_detected = tgt.rf_signature_ghz if (self.rng.random() > (0.4 if sensor_state == "jammed" else 0.05)) else None

            observed_tracks.append(ObservedTrack(
                track_id=f"TRK-{tgt.id}",
                timestamp=elapsed_seconds,
                x=round(noisy_x, 1),
                y=round(noisy_y, 1),
                range_m=round(noisy_range, 1),
                bearing_deg=round(noisy_bearing, 1),
                altitude_m=round(noisy_alt, 1),
                speed_mps=round(noisy_speed, 1),
                heading_deg=round(noisy_heading, 1),
                rcs_estimate_dbsm=round(tgt.rcs_dbsm + self.rng.gauss(0, 1.5), 2),
                rf_detected_ghz=rf_detected,
                sensor_confidence=round(track_conf, 2),
                visual_signature=vis_sig,
                thermal_signature=thermal_sig,
                is_clutter=False,
                status="tracking" if sensor_state == "normal" else "degraded",
                underlying_target_id=tgt.id
            ))

        # Generate False Tracks / Radar Clutter (birds, multipath, atmospheric blips)
        clutter_count = 0
        if sensor_state == "jammed":
            clutter_count = self.rng.randint(2, 5)
        elif sensor_state == "degraded":
            clutter_count = self.rng.randint(1, 3)
        elif clutter_density > 0.15:
            clutter_count = self.rng.randint(1, 2)

        for i in range(clutter_count):
            c_range = self.rng.uniform(600, 3200)
            c_bearing = self.rng.uniform(0, 360)
            c_rad = math.radians(c_bearing)
            c_x = c_range * math.sin(c_rad)
            c_y = c_range * math.cos(c_rad)

            observed_tracks.append(ObservedTrack(
                track_id=f"CLUTTER-{int(elapsed_seconds)}-{i+1}",
                timestamp=elapsed_seconds,
                x=round(c_x, 1),
                y=round(c_y, 1),
                range_m=round(c_range, 1),
                bearing_deg=round(c_bearing, 1),
                altitude_m=round(self.rng.uniform(15, 120), 1),
                speed_mps=round(self.rng.uniform(3, 14), 1),
                heading_deg=round(self.rng.uniform(0, 360), 1),
                rcs_estimate_dbsm=round(self.rng.uniform(-25.0, -12.0), 2),
                rf_detected_ghz=None,
                sensor_confidence=round(self.rng.uniform(0.25, 0.48), 2),
                visual_signature="Optical feed: Erratic flutter; biological avian cluster or sea spray",
                thermal_signature="FLIR: Low ambient differential thermal signature",
                is_clutter=True,
                status="degraded",
                underlying_target_id=None
            ))

        return observed_tracks
