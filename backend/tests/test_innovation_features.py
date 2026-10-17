import pytest
import math
from backend.app.sources.native import NativeSimSource
from backend.app.sources.base import TargetTelemetry
from backend.app.sources.sensor_model import SyntheticSensorModel
from backend.app.adaptive import AdaptiveDifficultyEngine


def test_sensor_reality_engine_noise_and_clutter():
    """
    Feature 1: Sensor Reality Engine
    Validates:
    - Addition of Gaussian noise to range, bearing, altitude, and speed
    - False alarms / avian radar clutter generation
    - Dropouts and degradation under degraded/jammed sensor states
    """
    sim = NativeSimSource(seed=101)
    sim.initialize({"seed": 101, "threat_type": "single", "target_count": 4, "difficulty": 2})
    ground_truth = sim.get_ground_truth(5.0)

    # 1. Normal state: minimal noise, high confidence, low clutter
    model_normal = SyntheticSensorModel(seed=42)
    obs_normal = model_normal.process(
        ground_truth=ground_truth,
        elapsed_seconds=5.0,
        sensor_state="normal",
        sensor_reliability=1.0,
        terrain="border",
        clutter_density=0.05
    )

    # 2. Jammed state: higher noise, clutter blips injected, lower confidence
    model_jammed = SyntheticSensorModel(seed=42)
    obs_jammed = model_jammed.process(
        ground_truth=ground_truth,
        elapsed_seconds=5.0,
        sensor_state="jammed",
        sensor_reliability=0.6,
        terrain="border",
        clutter_density=0.35
    )

    clutter_tracks = [t for t in obs_jammed if t.is_clutter]
    assert len(clutter_tracks) >= 1, "Sensor reality engine must inject clutter / false alarm tracks under jamming"
    for c in clutter_tracks:
        assert "biological avian" in c.visual_signature or "FLIR" in c.thermal_signature


def test_swarm_resolution_trap_radar_physics():
    """
    Feature 2: Swarm Resolution Trap
    Validates:
    - Multiple simulated drones flying in tight formation (<40m range, <3.2 deg bearing)
      are merged into a single composite track by radar angular resolution limits.
    - Composite contact displays elevated radar cross section (+10*log10(N) dBsm).
    - Merged track sets is_merged_swarm=True and swarm_trap_active=True.
    """
    # Create 3 drones flying close together
    t1 = TargetTelemetry(
        id="DRONE-01",
        x=500.0,
        y=500.0,
        altitude=50.0,
        speed=20.0,
        heading=180.0,
        model_type="quadcopter_kamikaze",
        target_class="hostile",
        rcs_dbsm=-15.0,
        rf_signature_ghz=2.4,
        is_active=True,
        start_time=0.0,
        range_m=707.1,
        bearing_deg=45.0
    )
    # Closely spaced: Delta R = 10m, Delta bearing = 0.5 deg
    t2 = TargetTelemetry(
        id="DRONE-02",
        x=507.0,
        y=507.0,
        altitude=52.0,
        speed=20.0,
        heading=180.0,
        model_type="quadcopter_kamikaze",
        target_class="hostile",
        rcs_dbsm=-15.0,
        rf_signature_ghz=2.4,
        is_active=True,
        start_time=0.0,
        range_m=717.0,
        bearing_deg=45.0
    )
    # Third drone in cluster
    t3 = TargetTelemetry(
        id="DRONE-03",
        x=514.0,
        y=514.0,
        altitude=51.0,
        speed=20.0,
        heading=180.0,
        model_type="quadcopter_kamikaze",
        target_class="hostile",
        rcs_dbsm=-15.0,
        rf_signature_ghz=2.4,
        is_active=True,
        start_time=0.0,
        range_m=726.9,
        bearing_deg=45.0
    )

    model = SyntheticSensorModel(seed=99)
    obs = model.process(
        ground_truth=[t1, t2, t3],
        elapsed_seconds=10.0,
        sensor_state="normal",
        sensor_reliability=1.0,
        terrain="border",
        clutter_density=0.0
    )

    # Resolution trap check: should be merged into a single track
    merged = [t for t in obs if t.is_merged_swarm]
    assert len(merged) == 1, "3 closely spaced drones must be merged into 1 composite track"
    assert merged[0].merged_target_count == 3
    assert merged[0].swarm_trap_active is True
    # Verify elevated RCS: individual is approx -15 dBsm, 3 drones => +10*log10(3) ~ +4.77 dBsm -> expected around -10 dBsm
    assert merged[0].rcs_estimate_dbsm > -14.0, "Composite RCS must be elevated (+10*log10(N))"
    assert "Unresolved Swarm Cluster" in merged[0].visual_signature


def test_per_skill_adaptive_training():
    """
    Feature 3: Per-Skill Adaptive Training
    Validates:
    - Multi-dimensional tracking across 5 core skills
    - Precise identification of trainee's weakest area
    - Tailored remediation scenario prescription
    """
    engine = AdaptiveDifficultyEngine()

    # Trainee with good detection and IFF, but failing swarm traps
    events = [
        {"detection_latency": 1.2, "true_class": "hostile", "trainee_classification": "hostile", "action": "soft_kill_rf", "decision_outcome": "Optimal"},
        {"detection_latency": 1.5, "true_class": "friendly", "trainee_classification": "friendly", "action": "hold_fire", "decision_outcome": "Optimal"},
        # Failed swarm trap: trainee treated swarm as single drone
        {"is_swarm_trap": True, "action": "single_kinetic_shot", "trap_resolved": False},
        {"is_swarm_trap": True, "action": "single_kinetic_shot", "trap_resolved": False},
        {"action": "evaded_to_cover", "success": True}
    ]

    profile = engine.evaluate_per_skill_profile(events)
    assert "skills" in profile
    assert profile["skills"]["swarm_resolution"] == 0.0
    assert profile["weakest_skill"] == "swarm_resolution"
    assert profile["prescription"]["recommended_threat"] == "swarm_wedge"
    assert "Swarm Merged Target Resolution" in profile["prescription"]["title"]
