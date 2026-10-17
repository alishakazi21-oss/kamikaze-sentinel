import json
import os
import math
from typing import List, Dict, Any, Optional
from .base import TrackSource, TargetTelemetry

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
SAMPLE_REPLAY_PATH = os.path.join(DATA_DIR, "sample_replay_mission.json")


class ReplaySource(TrackSource):
    """
    Replays pre-recorded telemetry files (JSON) exported from external
    simulators (e.g. AirSim, SkySim, or live flight test captures).
    Provides interpolation across recorded telemetry timesteps.
    """

    def __init__(self, file_path: Optional[str] = None):
        self.file_path = file_path or SAMPLE_REPLAY_PATH
        self.replay_data: Dict[str, Any] = {}
        self.targets: List[Dict[str, Any]] = []

    def is_available(self) -> Dict[str, Any]:
        has_sample = os.path.exists(self.file_path)
        return {
            "source_type": "replay",
            "name": "Mission Telemetry Replay Engine",
            "status": "ready" if has_sample else "no_file",
            "available": True,
            "description": "Loads pre-recorded flight runs and black-box JSON logs for standardized bench-testing."
        }

    def initialize(self, scenario_config: Dict[str, Any]) -> None:
        target_file = scenario_config.get("replay_file", self.file_path)
        if not os.path.exists(target_file):
            # Create sample replay file if not present
            self._generate_sample_replay(target_file)

        with open(target_file, "r") as f:
            self.replay_data = json.load(f)

        self.targets = self.replay_data.get("targets", [])

    def _generate_sample_replay(self, path: str) -> None:
        """Create sample flight telemetry recording file."""
        os.makedirs(os.path.dirname(path), exist_ok=True)
        sample = {
            "mission_id": "REPLAY-DEMO-001",
            "recorded_from": "SkySim 3.0 / Cosys-AirSim Export",
            "duration_seconds": 60.0,
            "targets": [
                {
                    "id": "RPL-01",
                    "target_class": "hostile",
                    "model_type": "Recon Shahed-136 Fixed-Wing",
                    "start_time": 0.0,
                    "keyframes": [
                        {"t": 0.0, "x": 2800.0, "y": 2100.0, "alt": 140.0, "spd": 32.0, "hdg": 215.0},
                        {"t": 15.0, "x": 2300.0, "y": 1650.0, "alt": 130.0, "spd": 32.0, "hdg": 215.0},
                        {"t": 30.0, "x": 1750.0, "y": 1150.0, "alt": 110.0, "spd": 34.0, "hdg": 210.0},
                        {"t": 45.0, "x": 1150.0, "y": 600.0, "alt": 90.0, "spd": 35.0, "hdg": 205.0},
                        {"t": 60.0, "x": 550.0, "y": 150.0, "alt": 70.0, "spd": 36.0, "hdg": 205.0}
                    ],
                    "rcs_dbsm": -8.5,
                    "rf_signature_ghz": 2.4
                },
                {
                    "id": "RPL-02",
                    "target_class": "friendly",
                    "model_type": "Border Surveillance UAS (Friendly)",
                    "start_time": 5.0,
                    "keyframes": [
                        {"t": 5.0, "x": -2400.0, "y": 1800.0, "alt": 160.0, "spd": 18.0, "hdg": 135.0},
                        {"t": 25.0, "x": -1950.0, "y": 1350.0, "alt": 155.0, "spd": 18.0, "hdg": 135.0},
                        {"t": 45.0, "x": -1500.0, "y": 900.0, "alt": 150.0, "spd": 18.0, "hdg": 135.0},
                        {"t": 60.0, "x": -1100.0, "y": 550.0, "alt": 145.0, "spd": 18.0, "hdg": 135.0}
                    ],
                    "rcs_dbsm": -4.0,
                    "rf_signature_ghz": 1.4
                },
                {
                    "id": "RPL-03",
                    "target_class": "false_alarm",
                    "model_type": "Avian Migration Formation",
                    "start_time": 10.0,
                    "keyframes": [
                        {"t": 10.0, "x": 1200.0, "y": -2500.0, "alt": 60.0, "spd": 11.0, "hdg": 340.0},
                        {"t": 30.0, "x": 1050.0, "y": -2100.0, "alt": 55.0, "spd": 10.0, "hdg": 335.0},
                        {"t": 50.0, "x": 900.0, "y": -1700.0, "alt": 50.0, "spd": 10.0, "hdg": 330.0},
                        {"t": 60.0, "x": 820.0, "y": -1500.0, "alt": 48.0, "spd": 10.0, "hdg": 330.0}
                    ],
                    "rcs_dbsm": -22.0,
                    "rf_signature_ghz": 0.0
                }
            ]
        }
        with open(path, "w") as f:
            json.dump(sample, f, indent=2)

    def get_ground_truth(self, elapsed_seconds: float) -> List[TargetTelemetry]:
        results: List[TargetTelemetry] = []

        for tgt in self.targets:
            start_t = tgt["start_time"]
            if elapsed_seconds < start_t:
                continue

            keyframes = tgt["keyframes"]
            if not keyframes:
                continue

            # Linear interpolation across keyframes
            if elapsed_seconds <= keyframes[0]["t"]:
                kf = keyframes[0]
                cur_x, cur_y, cur_alt, cur_spd, cur_hdg = kf["x"], kf["y"], kf["alt"], kf["spd"], kf["hdg"]
            elif elapsed_seconds >= keyframes[-1]["t"]:
                kf = keyframes[-1]
                cur_x, cur_y, cur_alt, cur_spd, cur_hdg = kf["x"], kf["y"], kf["alt"], kf["spd"], kf["hdg"]
            else:
                # Find bounding keyframes
                kf1, kf2 = keyframes[0], keyframes[1]
                for i in range(len(keyframes) - 1):
                    if keyframes[i]["t"] <= elapsed_seconds <= keyframes[i+1]["t"]:
                        kf1, kf2 = keyframes[i], keyframes[i+1]
                        break
                dt = kf2["t"] - kf1["t"]
                alpha = (elapsed_seconds - kf1["t"]) / dt if dt > 0 else 0.0
                cur_x = kf1["x"] + alpha * (kf2["x"] - kf1["x"])
                cur_y = kf1["y"] + alpha * (kf2["y"] - kf1["y"])
                cur_alt = kf1["alt"] + alpha * (kf2["alt"] - kf1["alt"])
                cur_spd = kf1["spd"] + alpha * (kf2["spd"] - kf1["spd"])
                cur_hdg = kf1["hdg"] + alpha * (kf2["hdg"] - kf1["hdg"])

            range_m = math.hypot(cur_x, cur_y)
            bearing_deg = (math.degrees(math.atan2(cur_x, cur_y)) + 360) % 360

            results.append(TargetTelemetry(
                id=tgt["id"],
                target_class=tgt["target_class"],
                model_type=tgt["model_type"],
                x=round(cur_x, 1),
                y=round(cur_y, 1),
                altitude=round(cur_alt, 1),
                speed=round(cur_spd, 1),
                heading=round(cur_hdg, 1),
                range_m=round(range_m, 1),
                bearing_deg=round(bearing_deg, 1),
                rcs_dbsm=tgt["rcs_dbsm"],
                rf_signature_ghz=tgt["rf_signature_ghz"],
                is_active=True,
                start_time=start_t
            ))

        return results
