import os
import json
import math
import random
import zlib
from typing import List, Dict, Any, Optional, Tuple
from pydantic import BaseModel
from .base import TargetTelemetry

CONFIG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "data",
    "sensor_config.json"
)


def stable_id_hash(target_id: str) -> int:
    """Deterministic 32-bit CRC hash ensuring stability across Python processes without PYTHONHASHSEED dependency."""
    return zlib.crc32(target_id.encode("utf-8")) & 0x7FFFFFFF


class SensorPlot(BaseModel):
    """
    Standardized physical sensor report output.
    Note: 'is_false_alarm' is ground-truth context preserved for After-Action Review (AAR)
    and instructor debriefing, strictly hidden from trainees in the live console.
    """
    plot_id: str
    sensor_id: str
    sensor_type: str  # radar, acoustic, camera_eo, camera_thermal, rf
    timestamp: float
    bearing_deg: float
    range_m: Optional[float] = None  # None for bearing-only sensors (e.g., acoustic array)
    x: Optional[float] = None
    y: Optional[float] = None
    altitude_m: Optional[float] = None
    snr_db: Optional[float] = None
    detection_probability: float
    confidence: float  # Trainee-visible signal confidence 0.0 to 1.0
    is_false_alarm: bool = False
    underlying_target_id: Optional[str] = None
    is_merged_swarm: bool = False
    merged_target_count: int = 1
    metadata: Dict[str, Any] = {}


class SensorRealityEngine:
    """
    Deterministic Sensor Reality Engine for VYOM-RAKSHAK.
    Translates ground-truth target kinematics into noisy, physical multi-sensor plot detections
    using closed-form CA-CFAR Swerling-I radar models, acoustic propagation loss, and EO/IR optics.
    """

    def __init__(self, seed: Optional[int] = 42, config_path: str = CONFIG_PATH):
        self.master_seed = seed if seed is not None else 42
        self.config = self._load_config(config_path)

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        if os.path.exists(config_path):
            with open(config_path, "r") as f:
                return json.load(f)
        # Fallback default textbook parameters
        return {
            "radar": {
                "sensor_id": "RADAR-01",
                "sensor_type": "radar",
                "max_range_m": 4000.0,
                "reference_range_m": 3500.0,
                "range_cells": 400,
                "beams": 36,
                "pfa": 0.0001,
                "cfar_n_cells": 16,
                "range_resolution_m": 35.0,
                "angular_resolution_deg": 3.0,
                "min_range_sigma_m": 2.0,
                "base_range_sigma_m": 16.0,
                "min_bearing_sigma_deg": 0.25,
                "base_bearing_sigma_deg": 1.8
            },
            "acoustic": {
                "sensor_id": "ACOUSTIC-01",
                "sensor_type": "acoustic",
                "max_range_m": 1200.0,
                "source_spl_ref_dB": 75.0,
                "base_ambient_noise_dB": 45.0,
                "sensitivity_dB": 6.0,
                "atmospheric_absorption_dB_per_m": 0.005,
                "angular_resolution_deg": 8.0,
                "min_bearing_sigma_deg": 1.2,
                "base_bearing_sigma_deg": 7.5,
                "false_alarm_rate_per_scan": 0.30
            },
            "camera_eo": {
                "sensor_id": "CAM-EO-01",
                "sensor_type": "camera_eo",
                "max_range_day_m": 2500.0,
                "max_range_dusk_m": 1200.0,
                "max_range_night_m": 300.0,
                "angular_resolution_deg": 0.5,
                "min_bearing_sigma_deg": 0.1,
                "base_bearing_sigma_deg": 0.5,
                "false_alarm_rate_per_scan": 0.10
            },
            "camera_thermal": {
                "sensor_id": "CAM-IR-01",
                "sensor_type": "camera_thermal",
                "max_range_day_m": 2000.0,
                "max_range_night_m": 1800.0,
                "angular_resolution_deg": 0.6,
                "min_bearing_sigma_deg": 0.12,
                "base_bearing_sigma_deg": 0.6,
                "false_alarm_rate_per_scan": 0.08
            },
            "rf_df": {
                "sensor_id": "RF-DF-01",
                "sensor_type": "rf",
                "max_range_m": 4500.0,
                "sensitivity_dbm": -95.0,
                "angular_resolution_deg": 5.0,
                "min_bearing_sigma_deg": 0.8,
                "base_bearing_sigma_deg": 3.5,
                "false_alarm_rate_per_scan": 0.15
            }
        }

    def _get_seeded_rng(self, timestamp: float, salt: int = 0) -> random.Random:
        """Derives a deterministic pseudo-random generator uniquely keyed to (master_seed, timestamp, salt)."""
        time_quantized = int(round(timestamp * 100))
        scan_seed = (self.master_seed * 1000003 + time_quantized * 1009 + salt) & 0xFFFFFFFF
        return random.Random(scan_seed)

    def _sample_poisson(self, lam: float, rng: random.Random) -> int:
        """Knuth's deterministic Poisson generator using seeded RNG."""
        if lam <= 0:
            return 0
        if lam > 30:
            # Normal approximation for large lambda
            val = rng.gauss(lam, math.sqrt(lam))
            return max(0, int(round(val)))
        L = math.exp(-lam)
        k = 0
        p = 1.0
        while p > L:
            k += 1
            p *= rng.random()
        return k - 1

    # -------------------------------------------------------------------------
    # 1. Radar Model (CA-CFAR, Swerling I Target Fluctuations)
    # -------------------------------------------------------------------------
    def process_radar(
        self,
        ground_truth: List[TargetTelemetry],
        timestamp: float,
        sensor_state: str = "normal",
        sensor_reliability: float = 1.0,
        terrain: str = "urban",
        weather: str = "clear",
        jamming_level: float = 0.0
    ) -> List[SensorPlot]:
        cfg = self.config["radar"]
        rng = self._get_seeded_rng(timestamp, salt=101)
        plots: List[SensorPlot] = []

        # CA-CFAR Swerling I Constants:
        # alpha = PFA^(-1/N) - 1
        pfa = cfg.get("pfa", 1e-4)
        N = cfg.get("cfar_n_cells", 16)
        alpha = (pfa ** (-1.0 / N)) - 1.0
        ref_range = cfg.get("reference_range_m", 3500.0)
        max_range = cfg.get("max_range_m", 4000.0)

        # Environmental & Jamming multipliers
        jamming_factor = max(0.0, min(1.0, jamming_level + (0.6 if sensor_state == "jammed" else 0.0)))
        weather_loss_db = 2.5 if weather == "rain" else (1.0 if weather == "fog" else 0.0)
        terrain_loss_db = 2.0 if terrain == "urban" else 0.0
        total_loss_linear = 10.0 ** (-(weather_loss_db + terrain_loss_db + jamming_factor * 8.0) / 10.0)

        for tgt in ground_truth:
            if not tgt.is_active or timestamp < tgt.start_time:
                continue

            # Per-target deterministic RNG ensures target order in list does not affect detection
            tgt_rng = self._get_seeded_rng(timestamp, salt=101 + (stable_id_hash(tgt.id) % 10007))

            r = max(10.0, tgt.range_m)
            if r > max_range:
                continue

            # Convert RCS from dBsm to linear square meters: sigma = 10^(rcs_dbsm / 10)
            sigma_m2 = 10.0 ** (tgt.rcs_dbsm / 10.0)

            # Radar range equation: SNR_linear = (R_ref / R)^4 * (sigma / sigma_ref) * losses
            snr_linear = ((ref_range / r) ** 4.0) * sigma_m2 * total_loss_linear * sensor_reliability
            snr_db = 10.0 * math.log10(max(1e-6, snr_linear))

            # CA-CFAR Swerling I detection probability:
            # PD = (1 + alpha / (1 + SNR))^(-N)
            pd = (1.0 + (alpha / (1.0 + snr_linear))) ** (-N)
            pd = max(0.001, min(0.999, pd))

            # Deterministic detection decision
            if tgt_rng.random() <= pd:
                # Measurement noise shrinks as SNR rises (Cramer-Rao lower bound scaling)
                snr_scaling = math.sqrt(max(0.1, snr_linear))
                range_sigma = max(cfg["min_range_sigma_m"], cfg["base_range_sigma_m"] / snr_scaling)
                bearing_sigma = max(cfg["min_bearing_sigma_deg"], cfg["base_bearing_sigma_deg"] / snr_scaling)

                reported_range = max(10.0, r + tgt_rng.gauss(0, range_sigma))
                reported_bearing = (tgt.bearing_deg + tgt_rng.gauss(0, bearing_sigma)) % 360.0

                rad = math.radians(reported_bearing)
                rep_x = reported_range * math.sin(rad)
                rep_y = reported_range * math.cos(rad)
                rep_alt = max(5.0, tgt.altitude + tgt_rng.gauss(0, range_sigma * 0.8))

                confidence = max(0.20, min(0.98, pd * (1.0 - 0.25 * jamming_factor)))

                plots.append(SensorPlot(
                    plot_id=f"PLT-RDR-{tgt.id}-{int(timestamp*10)}",
                    sensor_id=cfg["sensor_id"],
                    sensor_type="radar",
                    timestamp=timestamp,
                    bearing_deg=round(reported_bearing, 2),
                    range_m=round(reported_range, 1),
                    x=round(rep_x, 1),
                    y=round(rep_y, 1),
                    altitude_m=round(rep_alt, 1),
                    snr_db=round(snr_db, 2),
                    detection_probability=round(pd, 4),
                    confidence=round(confidence, 2),
                    is_false_alarm=False,
                    underlying_target_id=tgt.id,
                    metadata={"rcs_estimate_dbsm": tgt.rcs_dbsm}
                ))

        # False Alarms / Radar Clutter
        # Expected false alarms per scan: lambda_fa = PFA * range_cells * beams * clutter_multiplier
        clutter_multiplier = 1.0
        if terrain == "urban":
            clutter_multiplier *= 1.8
        if sensor_state == "jammed" or jamming_factor > 0.3:
            clutter_multiplier *= 2.5
        elif sensor_state == "degraded":
            clutter_multiplier *= 1.4

        expected_fa = pfa * cfg["range_cells"] * cfg["beams"] * clutter_multiplier
        fa_count = self._sample_poisson(expected_fa, rng)

        for i in range(fa_count):
            fa_range = rng.uniform(300.0, max_range * 0.85)
            fa_bearing = rng.uniform(0.0, 360.0)
            fa_rad = math.radians(fa_bearing)
            fa_x = fa_range * math.sin(fa_rad)
            fa_y = fa_range * math.cos(fa_rad)
            fa_alt = rng.uniform(20.0, 200.0)

            plots.append(SensorPlot(
                plot_id=f"PLT-RDR-FA-{int(timestamp*10)}-{i+1}",
                sensor_id=cfg["sensor_id"],
                sensor_type="radar",
                timestamp=timestamp,
                bearing_deg=round(fa_bearing, 2),
                range_m=round(fa_range, 1),
                x=round(fa_x, 1),
                y=round(fa_y, 1),
                altitude_m=round(fa_alt, 1),
                snr_db=round(rng.uniform(3.0, 8.0), 2),
                detection_probability=round(pfa, 5),
                confidence=round(rng.uniform(0.25, 0.45), 2),
                is_false_alarm=True,
                underlying_target_id=None,
                metadata={"origin": "radar_clutter_cfar"}
            ))

        return plots

    # -------------------------------------------------------------------------
    # 2. Acoustic Array Model (Bearing-Only Logistic Detection)
    # -------------------------------------------------------------------------
    def process_acoustic(
        self,
        ground_truth: List[TargetTelemetry],
        timestamp: float,
        sensor_state: str = "normal",
        terrain: str = "urban",
        jamming_level: float = 0.0
    ) -> List[SensorPlot]:
        cfg = self.config["acoustic"]
        rng = self._get_seeded_rng(timestamp, salt=202)
        plots: List[SensorPlot] = []

        max_range = cfg.get("max_range_m", 1200.0)
        source_spl = cfg.get("source_spl_ref_dB", 75.0)
        base_noise = cfg.get("base_ambient_noise_dB", 45.0)
        sensitivity_db = cfg.get("sensitivity_dB", 6.0)
        alpha_abs = cfg.get("atmospheric_absorption_dB_per_m", 0.005)

        # Urban environments exhibit higher ambient traffic / reflection noise
        ambient_noise = base_noise + (12.0 if terrain == "urban" else 0.0) + (jamming_level * 10.0)

        for tgt in ground_truth:
            if not tgt.is_active or timestamp < tgt.start_time:
                continue

            tgt_rng = self._get_seeded_rng(timestamp, salt=202 + (stable_id_hash(tgt.id) % 10007))

            r = max(5.0, tgt.range_m)
            if r > max_range:
                continue

            # Acoustic transmission loss: 20*log10(R) + alpha_abs*R
            spl_at_sensor = source_spl - (20.0 * math.log10(r)) - (alpha_abs * r)
            snr_db = spl_at_sensor - ambient_noise

            # Logistic acoustic detection probability:
            # PD = 1 / (1 + exp(-(SNR_dB - sensitivity_dB)))
            exponent = -(snr_db - sensitivity_db)
            # Clip exponent to prevent overflow
            exponent = max(-20.0, min(20.0, exponent))
            pd = 1.0 / (1.0 + math.exp(exponent))

            if tgt_rng.random() <= pd:
                snr_linear = max(0.1, 10.0 ** (snr_db / 10.0))
                bearing_sigma = max(cfg["min_bearing_sigma_deg"], cfg["base_bearing_sigma_deg"] / math.sqrt(snr_linear))
                reported_bearing = (tgt.bearing_deg + tgt_rng.gauss(0, bearing_sigma)) % 360.0

                confidence = max(0.20, min(0.95, pd * 0.90))

                plots.append(SensorPlot(
                    plot_id=f"PLT-ACU-{tgt.id}-{int(timestamp*10)}",
                    sensor_id=cfg["sensor_id"],
                    sensor_type="acoustic",
                    timestamp=timestamp,
                    bearing_deg=round(reported_bearing, 2),
                    range_m=None,  # Bearing-only sensor
                    x=None,
                    y=None,
                    altitude_m=None,
                    snr_db=round(snr_db, 2),
                    detection_probability=round(pd, 4),
                    confidence=round(confidence, 2),
                    is_false_alarm=False,
                    underlying_target_id=tgt.id,
                    metadata={"sensor_mode": "bearing_only", "spl_db": round(spl_at_sensor, 1)}
                ))

        # Acoustic false transient alarms
        expected_fa = cfg.get("false_alarm_rate_per_scan", 0.30)
        if terrain == "urban":
            expected_fa *= 1.6
        fa_count = self._sample_poisson(expected_fa, rng)
        for i in range(fa_count):
            fa_bearing = rng.uniform(0.0, 360.0)
            plots.append(SensorPlot(
                plot_id=f"PLT-ACU-FA-{int(timestamp*10)}-{i+1}",
                sensor_id=cfg["sensor_id"],
                sensor_type="acoustic",
                timestamp=timestamp,
                bearing_deg=round(fa_bearing, 2),
                range_m=None,
                x=None,
                y=None,
                altitude_m=None,
                snr_db=round(rng.uniform(2.0, 7.0), 2),
                detection_probability=round(0.25, 4),
                confidence=round(rng.uniform(0.20, 0.40), 2),
                is_false_alarm=True,
                underlying_target_id=None,
                metadata={"origin": "acoustic_ambient_transient"}
            ))

        return plots

    # -------------------------------------------------------------------------
    # 3. Camera EO & Thermal Models (Lighting and Visibility Dependent)
    # -------------------------------------------------------------------------
    def process_camera(
        self,
        ground_truth: List[TargetTelemetry],
        timestamp: float,
        time_of_day: str = "day",
        weather: str = "clear"
    ) -> List[SensorPlot]:
        plots: List[SensorPlot] = []
        rng = self._get_seeded_rng(timestamp, salt=303)

        cfg_eo = self.config["camera_eo"]
        cfg_ir = self.config["camera_thermal"]

        # Daylight optical effective range
        if time_of_day == "night":
            eo_max_range = cfg_eo.get("max_range_night_m", 300.0)
            eo_factor = 0.25
        elif time_of_day == "dusk":
            eo_max_range = cfg_eo.get("max_range_dusk_m", 1200.0)
            eo_factor = 0.70
        else:
            eo_max_range = cfg_eo.get("max_range_day_m", 2500.0)
            eo_factor = 1.0

        if weather == "rain" or weather == "fog":
            eo_max_range *= 0.55
            eo_factor *= 0.60

        # Thermal IR effective range (night-capable)
        ir_max_range = cfg_ir.get("max_range_night_m", 1800.0) if time_of_day == "night" else cfg_ir.get("max_range_day_m", 2000.0)
        if weather == "rain" or weather == "fog":
            ir_max_range *= 0.75

        for tgt in ground_truth:
            if not tgt.is_active or timestamp < tgt.start_time:
                continue

            tgt_rng = self._get_seeded_rng(timestamp, salt=303 + (stable_id_hash(tgt.id) % 10007))
            r = max(5.0, tgt.range_m)

            # EO Detection
            if r <= eo_max_range:
                pd_eo = max(0.0, (1.0 - ((r / eo_max_range) ** 1.8))) * eo_factor
                if tgt_rng.random() <= pd_eo:
                    bearing_sigma = max(cfg_eo["min_bearing_sigma_deg"], cfg_eo["base_bearing_sigma_deg"] * (r / eo_max_range))
                    reported_bearing = (tgt.bearing_deg + tgt_rng.gauss(0, bearing_sigma)) % 360.0
                    range_est = max(10.0, r + tgt_rng.gauss(0, r * 0.08))  # Optical range estimation error
                    rad = math.radians(reported_bearing)

                    plots.append(SensorPlot(
                        plot_id=f"PLT-EO-{tgt.id}-{int(timestamp*10)}",
                        sensor_id=cfg_eo["sensor_id"],
                        sensor_type="camera_eo",
                        timestamp=timestamp,
                        bearing_deg=round(reported_bearing, 2),
                        range_m=round(range_est, 1),
                        x=round(range_est * math.sin(rad), 1),
                        y=round(range_est * math.cos(rad), 1),
                        altitude_m=round(tgt.altitude + tgt_rng.gauss(0, 4.0), 1),
                        detection_probability=round(pd_eo, 4),
                        confidence=round(max(0.30, min(0.95, pd_eo * 0.95)), 2),
                        is_false_alarm=False,
                        underlying_target_id=tgt.id,
                        metadata={"camera_type": "daylight_eo", "lighting": time_of_day}
                    ))

            # Thermal IR Detection: propulsion motor heat creates strong contrast against cooling sky/terrain
            if r <= ir_max_range:
                contrast_scale = 0.96 if time_of_day == "night" else 0.88
                normalized_r = r / ir_max_range
                pd_ir = max(0.05, min(0.98, (1.0 - 0.5 * (normalized_r ** 2.0)) * contrast_scale))
                if tgt_rng.random() <= pd_ir:
                    bearing_sigma = max(cfg_ir["min_bearing_sigma_deg"], cfg_ir["base_bearing_sigma_deg"] * (r / ir_max_range))
                    reported_bearing = (tgt.bearing_deg + tgt_rng.gauss(0, bearing_sigma)) % 360.0
                    range_est = max(10.0, r + tgt_rng.gauss(0, r * 0.09))
                    rad = math.radians(reported_bearing)

                    plots.append(SensorPlot(
                        plot_id=f"PLT-IR-{tgt.id}-{int(timestamp*10)}",
                        sensor_id=cfg_ir["sensor_id"],
                        sensor_type="camera_thermal",
                        timestamp=timestamp,
                        bearing_deg=round(reported_bearing, 2),
                        range_m=round(range_est, 1),
                        x=round(range_est * math.sin(rad), 1),
                        y=round(range_est * math.cos(rad), 1),
                        altitude_m=round(tgt.altitude + tgt_rng.gauss(0, 5.0), 1),
                        detection_probability=round(pd_ir, 4),
                        confidence=round(max(0.35, min(0.96, pd_ir * 0.98)), 2),
                        is_false_alarm=False,
                        underlying_target_id=tgt.id,
                        metadata={"camera_type": "thermal_flir", "cooling": "active_mwir"}
                    ))

        return plots

    # -------------------------------------------------------------------------
    # 4. Passive RF Direction Finder Model
    # -------------------------------------------------------------------------
    def process_rf(
        self,
        ground_truth: List[TargetTelemetry],
        timestamp: float,
        sensor_state: str = "normal",
        terrain: str = "urban",
        jamming_level: float = 0.0
    ) -> List[SensorPlot]:
        cfg = self.config.get("rf_df", {})
        if not cfg:
            return []

        rng = self._get_seeded_rng(timestamp, salt=404)
        plots: List[SensorPlot] = []

        base_range = cfg.get("max_range_m", 4500.0)
        # Terrain impact: Urban buildings attenuate RF and cause multipath; Rural has clear line of sight
        if terrain == "urban":
            max_rf_range = base_range * 0.50  # 2250m
        elif terrain == "rural":
            max_rf_range = base_range * 1.25  # 5625m
        else:
            max_rf_range = base_range

        # Jamming adds high background RF power, masking datalinks
        jamming_factor = max(0.0, min(1.0, jamming_level + (0.5 if sensor_state == "jammed" else 0.0)))
        max_rf_range *= (1.0 - 0.5 * jamming_factor)

        for tgt in ground_truth:
            if not tgt.is_active or timestamp < tgt.start_time:
                continue

            # Target must have an active RF transmitter (drones emit at 2.4/5.8 GHz; birds/balloons have 0.0)
            if tgt.rf_signature_ghz <= 0.01:
                continue

            r = max(5.0, tgt.range_m)
            if r > max_rf_range:
                continue

            tgt_rng = self._get_seeded_rng(timestamp, salt=404 + (stable_id_hash(tgt.id) % 10007))

            # Detection probability scales inversely with range
            pd_rf = max(0.1, min(0.96, (1.0 - (r / max_rf_range) ** 1.5) * (1.0 - 0.6 * jamming_factor)))
            if tgt_rng.random() <= pd_rf:
                bearing_sigma = max(cfg.get("min_bearing_sigma_deg", 0.8), cfg.get("base_bearing_sigma_deg", 3.5) * (r / max_rf_range))
                reported_bearing = (tgt.bearing_deg + tgt_rng.gauss(0, bearing_sigma)) % 360.0

                confidence = max(0.25, min(0.95, pd_rf * (1.0 - 0.3 * jamming_factor)))

                plots.append(SensorPlot(
                    plot_id=f"PLT-RF-{tgt.id}-{int(timestamp*10)}",
                    sensor_id=cfg.get("sensor_id", "RF-DF-01"),
                    sensor_type="rf",
                    timestamp=timestamp,
                    bearing_deg=round(reported_bearing, 2),
                    range_m=None,  # Passive RF DF provides bearing only
                    x=None,
                    y=None,
                    altitude_m=None,
                    detection_probability=round(pd_rf, 4),
                    confidence=round(confidence, 2),
                    is_false_alarm=False,
                    underlying_target_id=tgt.id,
                    metadata={"rf_frequency_ghz": tgt.rf_signature_ghz, "terrain": terrain}
                ))

        # Jamming-induced RF false bearings
        expected_fa = cfg.get("false_alarm_rate_per_scan", 0.15) * (3.0 if jamming_factor > 0.3 else 1.0)
        fa_count = self._sample_poisson(expected_fa, rng)
        for i in range(fa_count):
            fa_bearing = rng.uniform(0.0, 360.0)
            plots.append(SensorPlot(
                plot_id=f"PLT-RF-FA-{int(timestamp*10)}-{i+1}",
                sensor_id=cfg.get("sensor_id", "RF-DF-01"),
                sensor_type="rf",
                timestamp=timestamp,
                bearing_deg=round(fa_bearing, 2),
                range_m=None,
                x=None,
                y=None,
                altitude_m=None,
                detection_probability=0.20,
                confidence=round(rng.uniform(0.20, 0.40), 2),
                is_false_alarm=True,
                underlying_target_id=None,
                metadata={"origin": "rf_background_spurious_emission"}
            ))

        return plots

    # -------------------------------------------------------------------------
    # 5. Swarm Resolution Merging Engine
    # -------------------------------------------------------------------------
    def resolve_swarm_cells(self, plots: List[SensorPlot], timestamp: float) -> List[SensorPlot]:
        """
        Swarm resolution physics:
        If two or more drones are closer together than a sensor's resolution cell
        (range resolution and angular resolution parameters), the sensor reports one
        merged plot at their centroid. A finer-resolution sensor still separates them.
        """
        sensor_res_specs = {
            "radar": {
                "range_res_m": self.config["radar"].get("range_resolution_m", 35.0),
                "angular_res_deg": self.config["radar"].get("angular_resolution_deg", 3.0)
            },
            "acoustic": {
                "range_res_m": None,  # bearing only
                "angular_res_deg": self.config["acoustic"].get("angular_resolution_deg", 8.0)
            },
            "camera_eo": {
                "range_res_m": 500.0,  # coarse optical depth
                "angular_res_deg": self.config["camera_eo"].get("angular_resolution_deg", 0.5)
            },
            "camera_thermal": {
                "range_res_m": 450.0,
                "angular_res_deg": self.config["camera_thermal"].get("angular_resolution_deg", 0.6)
            },
            "rf": {
                "range_res_m": None,
                "angular_res_deg": self.config.get("rf_df", {}).get("angular_resolution_deg", 5.0)
            }
        }

        resolved_all: List[SensorPlot] = []

        # Process per sensor type
        sensor_types = set(p.sensor_type for p in plots)
        for stype in sensor_types:
            type_plots = [p for p in plots if p.sensor_type == stype]
            # Separate false alarms from real target plots (clutter is not merged into swarm)
            real_plots = [p for p in type_plots if not p.is_false_alarm]
            clutter_plots = [p for p in type_plots if p.is_false_alarm]

            specs = sensor_res_specs.get(stype, {"range_res_m": None, "angular_res_deg": 3.0})
            r_res = specs["range_res_m"]
            theta_res = specs["angular_res_deg"]

            if len(real_plots) < 2:
                resolved_all.extend(type_plots)
                continue

            # Connected component clustering based on resolution cell
            merged_indices = set()
            clusters = []

            for i in range(len(real_plots)):
                if i in merged_indices:
                    continue
                cluster = [i]
                for j in range(i + 1, len(real_plots)):
                    if j in merged_indices:
                        continue
                    p1 = real_plots[i]
                    p2 = real_plots[j]

                    # Angular difference (with 360 wrap-around)
                    diff_bearing = abs(p1.bearing_deg - p2.bearing_deg) % 360.0
                    if diff_bearing > 180.0:
                        diff_bearing = 360.0 - diff_bearing

                    angular_close = (diff_bearing <= theta_res)

                    # Range difference (if sensor measures range)
                    if r_res is not None and p1.range_m is not None and p2.range_m is not None:
                        range_close = (abs(p1.range_m - p2.range_m) <= r_res)
                    else:
                        range_close = True  # bearing-only sensor: resolved by angle only

                    if angular_close and range_close:
                        cluster.append(j)
                        merged_indices.add(j)

                if len(cluster) > 1:
                    merged_indices.add(i)
                    clusters.append(cluster)

            # Output unmerged individual plots
            for idx, p in enumerate(real_plots):
                if idx not in merged_indices:
                    resolved_all.append(p)

            # Output merged centroid plots
            for cluster_indices in clusters:
                cluster_plots = [real_plots[idx] for idx in cluster_indices]
                k = len(cluster_plots)
                primary = cluster_plots[0]

                # Centroid bearing (vector sum)
                sin_sum = sum(math.sin(math.radians(p.bearing_deg)) for p in cluster_plots)
                cos_sum = sum(math.cos(math.radians(p.bearing_deg)) for p in cluster_plots)
                centroid_bearing = (math.degrees(math.atan2(sin_sum, cos_sum)) + 360.0) % 360.0

                # Centroid range and Cartesian coordinates
                has_range = all(p.range_m is not None for p in cluster_plots)
                if has_range:
                    centroid_range = sum(p.range_m for p in cluster_plots) / k
                    rad = math.radians(centroid_bearing)
                    c_x = centroid_range * math.sin(rad)
                    c_y = centroid_range * math.cos(rad)
                else:
                    centroid_range = None
                    c_x = None
                    c_y = None

                # Centroid altitude
                has_alt = any(p.altitude_m is not None for p in cluster_plots)
                centroid_alt = (
                    sum(p.altitude_m for p in cluster_plots if p.altitude_m is not None) / max(1, len([p for p in cluster_plots if p.altitude_m is not None]))
                    if has_alt else None
                )

                # Radar composite RCS: elevated by 10*log10(K)
                composite_snr = primary.snr_db
                if stype == "radar" and composite_snr is not None:
                    composite_snr += 10.0 * math.log10(k)

                merged_conf = min(0.98, max(p.confidence for p in cluster_plots) + 0.04)

                merged_plot = SensorPlot(
                    plot_id=f"PLT-MRG-{primary.sensor_id}-{int(timestamp*10)}-{primary.underlying_target_id}",
                    sensor_id=primary.sensor_id,
                    sensor_type=primary.sensor_type,
                    timestamp=timestamp,
                    bearing_deg=round(centroid_bearing, 2),
                    range_m=round(centroid_range, 1) if centroid_range is not None else None,
                    x=round(c_x, 1) if c_x is not None else None,
                    y=round(c_y, 1) if c_y is not None else None,
                    altitude_m=round(centroid_alt, 1) if centroid_alt is not None else None,
                    snr_db=round(composite_snr, 2) if composite_snr is not None else None,
                    detection_probability=round(max(p.detection_probability for p in cluster_plots), 4),
                    confidence=round(merged_conf, 2),
                    is_false_alarm=False,
                    underlying_target_id=primary.underlying_target_id,
                    is_merged_swarm=True,
                    merged_target_count=k,
                    metadata={
                        "merged_target_ids": [p.underlying_target_id for p in cluster_plots],
                        "swarm_resolution_merged": True,
                        "resolution_cell": {"range_res_m": r_res, "angular_res_deg": theta_res}
                    }
                )
                resolved_all.append(merged_plot)

            resolved_all.extend(clutter_plots)

        return resolved_all

    # -------------------------------------------------------------------------
    # 6. Fixed Systematic Sensor Bias
    # -------------------------------------------------------------------------
    def apply_sensor_bias(self, plots: List[SensorPlot]) -> List[SensorPlot]:
        """
        Applies fixed, realistic systematic bias per sensor (scenario flag enabled).
        Allows sensors to display realistic inter-sensor calibration disagreement.
        """
        biases = {
            "radar": {"bearing_deg": +1.2, "range_m": +15.0},
            "acoustic": {"bearing_deg": -3.5, "range_m": 0.0},
            "camera_eo": {"bearing_deg": +0.4, "range_m": -8.0},
            "camera_thermal": {"bearing_deg": -0.5, "range_m": 0.0},
            "rf": {"bearing_deg": +2.0, "range_m": 0.0}
        }

        biased_plots: List[SensorPlot] = []
        for p in plots:
            b = biases.get(p.sensor_type, {"bearing_deg": 0.0, "range_m": 0.0})
            new_bearing = (p.bearing_deg + b["bearing_deg"]) % 360.0
            new_range = p.range_m
            new_x = p.x
            new_y = p.y

            if p.range_m is not None and b["range_m"] != 0.0:
                new_range = max(5.0, p.range_m + b["range_m"])
                rad = math.radians(new_bearing)
                new_x = new_range * math.sin(rad)
                new_y = new_range * math.cos(rad)
            elif p.range_m is not None:
                rad = math.radians(new_bearing)
                new_x = p.range_m * math.sin(rad)
                new_y = p.range_m * math.cos(rad)

            p_copy = p.model_copy(update={
                "bearing_deg": round(new_bearing, 2),
                "range_m": round(new_range, 1) if new_range is not None else None,
                "x": round(new_x, 1) if new_x is not None else None,
                "y": round(new_y, 1) if new_y is not None else None,
                "metadata": {**p.metadata, "systematic_bias_applied": True}
            })
            biased_plots.append(p_copy)

        return biased_plots

    # -------------------------------------------------------------------------
    # 7. Master Fusion Dispatcher
    # -------------------------------------------------------------------------
    def generate_all_plots(
        self,
        ground_truth: List[TargetTelemetry],
        timestamp: float,
        sensor_state: str = "normal",
        sensor_reliability: float = 1.0,
        terrain: str = "urban",
        time_of_day: str = "day",
        weather: str = "clear",
        jamming_level: float = 0.0,
        sensor_bias_enabled: bool = False
    ) -> List[SensorPlot]:
        """Runs all enabled physical sensor models deterministically and collates their plots."""
        all_plots: List[SensorPlot] = []

        # 1. Radar
        radar_plots = self.process_radar(
            ground_truth=ground_truth,
            timestamp=timestamp,
            sensor_state=sensor_state,
            sensor_reliability=sensor_reliability,
            terrain=terrain,
            weather=weather,
            jamming_level=jamming_level
        )
        all_plots.extend(radar_plots)

        # 2. Acoustic Array
        acoustic_plots = self.process_acoustic(
            ground_truth=ground_truth,
            timestamp=timestamp,
            sensor_state=sensor_state,
            terrain=terrain,
            jamming_level=jamming_level
        )
        all_plots.extend(acoustic_plots)

        # 3. Camera EO / IR
        camera_plots = self.process_camera(
            ground_truth=ground_truth,
            timestamp=timestamp,
            time_of_day=time_of_day,
            weather=weather
        )
        all_plots.extend(camera_plots)

        # 4. Passive RF Direction Finder
        rf_plots = self.process_rf(
            ground_truth=ground_truth,
            timestamp=timestamp,
            sensor_state=sensor_state,
            terrain=terrain,
            jamming_level=jamming_level
        )
        all_plots.extend(rf_plots)

        # 5. Apply Swarm Resolution Cell Merging
        resolved_plots = self.resolve_swarm_cells(all_plots, timestamp)

        # 6. Apply Optional Systematic Sensor Bias
        if sensor_bias_enabled:
            resolved_plots = self.apply_sensor_bias(resolved_plots)

        return resolved_plots
