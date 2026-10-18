import math
import random
from typing import List, Dict, Any, Optional
from .base import TrackSource, TargetTelemetry
from .sensor_reality import SensorRealityEngine, SensorPlot


class NativeSimSource(TrackSource):
    """
    Default simulator source requiring zero GPU, zero Unreal Engine, zero internet.
    Generates deterministic seeded procedural drone paths and tactical swarms
    (Leader-Follower, Wedge, Line, Dispersed) with realistic kinematics.
    Coupled with SensorRealityEngine for multi-sensor radar/acoustic/camera reports.
    """

    def __init__(self, seed: Optional[int] = 42):
        self.seed = seed or 42
        self.rng = random.Random(self.seed)
        self.sensor_engine = SensorRealityEngine(seed=self.seed)
        self.scenario_config: Dict[str, Any] = {}
        self.targets: List[Dict[str, Any]] = []

    def is_available(self) -> Dict[str, Any]:
        return {
            "source_type": "native",
            "name": "ASTRA VEER Native Simulator (Built-in)",
            "status": "ready",
            "available": True,
            "description": "Deterministic CPU physics engine with tactical swarm formations (3-12 drones), terrain clutter, and seeded kinematics."
        }

    def initialize(self, scenario_config: Dict[str, Any]) -> None:
        self.scenario_config = scenario_config
        self.seed = scenario_config.get("seed", 42)
        self.rng = random.Random(self.seed)
        self.sensor_engine = SensorRealityEngine(seed=self.seed)

        target_count = scenario_config.get("target_count", 4)
        threat_type = scenario_config.get("threat_type", "single")
        difficulty = scenario_config.get("difficulty", 1)

        self.targets = []

        if "definitions" in scenario_config and scenario_config["definitions"]:
            self.targets = scenario_config["definitions"]
            return

        # Procedural generation based on threat_type
        if threat_type.startswith("swarm_"):
            self._generate_swarm_formation(threat_type, target_count, difficulty)
        elif threat_type == "decoy_mixed":
            self._generate_mixed_decoy_scenario(target_count, difficulty)
        else:
            self._generate_standard_targets(target_count, difficulty)

    def _generate_standard_targets(self, count: int, difficulty: int) -> None:
        classes_pool = [
            ("hostile", "Fixed-Wing Kamikaze Drone (Shahed-Class)", -8.0, 2.4, 28.0, 140.0),
            ("hostile", "Tactical Quadcopter Bomber (FPV Munition)", -15.0, 5.8, 18.0, 75.0),
            ("friendly", "Blue-Force Border Patrol Drone (Netra-V4)", -5.0, 1.4, 15.0, 120.0),
            ("civil", "Commercial Media Hexacopter (DJI Matrice 300)", -10.0, 2.4, 12.0, 90.0),
            ("false_alarm", "Migratory Crane Bird Flock (Biological)", -18.0, 0.0, 8.0, 45.0)
        ]

        for i in range(count):
            if i == 0:
                t_cls, m_type, rcs, rf, spd, alt = classes_pool[0]  # At least one hostile
            else:
                idx = self.rng.randint(0, len(classes_pool) - 1)
                t_cls, m_type, rcs, rf, spd, alt = classes_pool[idx]

            spawn_bearing = self.rng.uniform(0, 360)
            spawn_range = self.rng.uniform(2600, 3800)
            
            # Trajectory heading: generally inwards towards base center (0,0) with offset
            rad_spawn = math.radians(spawn_bearing)
            start_x = spawn_range * math.sin(rad_spawn)
            start_y = spawn_range * math.cos(rad_spawn)

            target_x = self.rng.uniform(-400, 400)
            target_y = self.rng.uniform(-400, 400)
            dx = target_x - start_x
            dy = target_y - start_y
            heading_deg = (math.degrees(math.atan2(dx, dy)) + 360) % 360

            self.targets.append({
                "id": f"TGT-{i+1:02d}",
                "target_class": t_cls,
                "model_type": m_type,
                "start_time": round(i * 3.5, 1),
                "start_x": start_x,
                "start_y": start_y,
                "heading_deg": heading_deg,
                "speed_mps": spd + (difficulty * 2.0),
                "altitude_m": alt,
                "rcs_dbsm": rcs,
                "rf_signature_ghz": rf,
                "maneuver_style": self.rng.choice(["direct", "weaving", "step_altitude"])
            })

    def _generate_swarm_formation(self, formation_type: str, count: int, difficulty: int) -> None:
        """
        Generate coordinated multi-drone swarm formations (3 to 12 drones)
        Formation styles: Wedge, Leader-Follower, Line, Dispersed.
        """
        swarm_size = max(3, min(count, 12))
        base_bearing = self.rng.uniform(30, 330)
        base_range = self.rng.uniform(3000, 4000)
        rad = math.radians(base_bearing)
        leader_start_x = base_range * math.sin(rad)
        leader_start_y = base_range * math.cos(rad)

        # Inward heading towards base
        dx = -leader_start_x
        dy = -leader_start_y
        lead_heading = (math.degrees(math.atan2(dx, dy)) + 360) % 360
        lead_rad = math.radians(lead_heading)

        # Unit vectors along heading and perpendicular
        fwd_x = math.sin(lead_rad)
        fwd_y = math.cos(lead_rad)
        perp_x = -fwd_y
        perp_y = fwd_x

        spacing = 90.0  # meters between swarm members
        base_speed = 22.0 + (difficulty * 3.0)

        for i in range(swarm_size):
            if formation_type == "swarm_wedge":
                # Leader at apex, followers staggered left/right
                row = (i + 1) // 2
                side = -1 if (i % 2 == 1) else 1
                if i == 0:
                    ox, oy = 0.0, 0.0
                else:
                    ox = side * row * spacing * perp_x - row * spacing * fwd_x
                    oy = side * row * spacing * perp_y - row * spacing * fwd_y
            elif formation_type == "swarm_leader":
                # Linear echelon column behind leader
                ox = -i * spacing * fwd_x + (self.rng.uniform(-15, 15) * perp_x)
                oy = -i * spacing * fwd_y + (self.rng.uniform(-15, 15) * perp_y)
            elif formation_type == "swarm_line":
                # Broad abreast line formation
                offset_idx = i - (swarm_size // 2)
                ox = offset_idx * spacing * perp_x
                oy = offset_idx * spacing * perp_y
            else:  # dispersed
                ox = self.rng.uniform(-250, 250)
                oy = self.rng.uniform(-250, 250)

            # Swarm composition: mostly hostile with 1-2 possible electronic decoys
            is_hostile = True
            if i == swarm_size - 1 and self.rng.random() < 0.35:
                t_cls = "false_alarm"
                m_type = "Autonomous Radar Decoy Glider"
            else:
                t_cls = "hostile"
                m_type = f"Swarm Drone Delta-{i+1} (Micro-Kamikaze)"

            self.targets.append({
                "id": f"SWM-{i+1:02d}",
                "target_class": t_cls,
                "model_type": m_type,
                "start_time": 0.0 if i < 3 else round(i * 1.5, 1),
                "start_x": leader_start_x + ox,
                "start_y": leader_start_y + oy,
                "heading_deg": lead_heading,
                "speed_mps": base_speed,
                "altitude_m": 85.0 + (i % 3) * 20.0,
                "rcs_dbsm": -12.0,
                "rf_signature_ghz": 2.4,
                "maneuver_style": "swarm_coordinated"
            })

    def _generate_mixed_decoy_scenario(self, count: int, difficulty: int) -> None:
        """Mixed scenario with hostile drones masked among commercial craft and avian flocks."""
        for i in range(count):
            if i % 3 == 0:
                t_cls = "hostile"
                m_type = "Low-RCS Infiltration Drone"
                rcs, rf, spd, alt = -16.0, 5.8, 26.0, 50.0
            elif i % 3 == 1:
                t_cls = "civil"
                m_type = "Urban Delivery Drone (Authorized Flight Plan)"
                rcs, rf, spd, alt = -10.0, 2.4, 14.0, 80.0
            else:
                t_cls = "false_alarm"
                m_type = "Avian Thermal Updraft Clutter"
                rcs, rf, spd, alt = -22.0, 0.0, 9.0, 35.0

            ang = self.rng.uniform(0, 360)
            rng_val = self.rng.uniform(2400, 3600)
            sx = rng_val * math.sin(math.radians(ang))
            sy = rng_val * math.cos(math.radians(ang))

            dx = -sx + self.rng.uniform(-300, 300)
            dy = -sy + self.rng.uniform(-300, 300)
            hdg = (math.degrees(math.atan2(dx, dy)) + 360) % 360

            self.targets.append({
                "id": f"MIX-{i+1:02d}",
                "target_class": t_cls,
                "model_type": m_type,
                "start_time": round(i * 2.0, 1),
                "start_x": sx,
                "start_y": sy,
                "heading_deg": hdg,
                "speed_mps": spd,
                "altitude_m": alt,
                "rcs_dbsm": rcs,
                "rf_signature_ghz": rf,
                "maneuver_style": "weaving" if t_cls == "hostile" else "direct"
            })

    def get_ground_truth(self, elapsed_seconds: float) -> List[TargetTelemetry]:
        results: List[TargetTelemetry] = []

        for tgt in self.targets:
            start_t = tgt["start_time"]
            if elapsed_seconds < start_t:
                continue

            active_t = elapsed_seconds - start_t
            spd = tgt["speed_mps"]
            base_heading = tgt["heading_deg"]

            # Compute maneuver dynamics
            style = tgt.get("maneuver_style", "direct")
            cur_heading = base_heading

            if style == "weaving":
                # Sine wave yaw oscillation
                yaw_offset = math.sin(active_t * 0.4) * 20.0
                cur_heading = (base_heading + yaw_offset) % 360.0
            elif style == "step_altitude":
                alt_offset = math.sin(active_t * 0.2) * 15.0
                tgt["altitude_m"] = max(20.0, tgt["altitude_m"] + alt_offset * 0.05)

            # Kinematic integration
            rad_hdg = math.radians(cur_heading)
            dist_traveled = spd * active_t
            curr_x = tgt["start_x"] + dist_traveled * math.sin(rad_hdg)
            curr_y = tgt["start_y"] + dist_traveled * math.cos(rad_hdg)

            range_m = math.hypot(curr_x, curr_y)
            bearing_deg = (math.degrees(math.atan2(curr_x, curr_y)) + 360) % 360

            # Target remains active until it penetrates origin (< 100m) or exits operational zone (> 5000m)
            is_active = (range_m > 80.0 and range_m < 5200.0)

            results.append(TargetTelemetry(
                id=tgt["id"],
                target_class=tgt["target_class"],
                model_type=tgt["model_type"],
                x=round(curr_x, 1),
                y=round(curr_y, 1),
                altitude=round(tgt["altitude_m"], 1),
                speed=round(spd, 1),
                heading=round(cur_heading, 1),
                range_m=round(range_m, 1),
                bearing_deg=round(bearing_deg, 1),
                rcs_dbsm=tgt["rcs_dbsm"],
                rf_signature_ghz=tgt["rf_signature_ghz"],
                is_active=is_active,
                start_time=start_t
            ))

        return results

    def get_sensor_reports(
        self,
        elapsed_seconds: float,
        sensor_state: str = "normal",
        sensor_reliability: float = 1.0,
        terrain: str = "urban",
        time_of_day: str = "day",
        weather: str = "clear",
        jamming_level: float = 0.0
    ) -> List[SensorPlot]:
        """
        Converts ground-truth drone positions into noisy physical sensor reports
        (Radar, Acoustic Array, EO Camera, Thermal Camera).
        """
        ground_truth = self.get_ground_truth(elapsed_seconds)
        if self.sensor_engine is None:
            self.sensor_engine = SensorRealityEngine(seed=self.seed)

        return self.sensor_engine.generate_all_plots(
            ground_truth=ground_truth,
            timestamp=elapsed_seconds,
            sensor_state=sensor_state,
            sensor_reliability=sensor_reliability,
            terrain=terrain,
            time_of_day=time_of_day,
            weather=weather,
            jamming_level=jamming_level
        )

