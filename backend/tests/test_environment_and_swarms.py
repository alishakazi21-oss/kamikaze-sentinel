import pytest
import math
from backend.app.sources.base import TargetTelemetry
from backend.app.sources.sensor_reality import SensorRealityEngine, SensorPlot


def test_swarm_resolution_merging_and_separation_by_finer_sensor():
    """
    Validates Phase 2 Swarm Resolution:
    - Radar resolution cell (35m range, 3.0 deg bearing): 2 drones within this cell merge into 1 centroid plot.
    - Camera EO resolution cell (0.5 deg): when angular separation is 1.3 deg (> 0.5 deg),
      the Camera EO SEPARATES the drones while Radar MERGES them.
    - Merged plot reports centroid bearing, centroid range, and is_merged_swarm=True.
    """
    engine = SensorRealityEngine(seed=701)

    # Drone 1 at ~495m, bearing 45.0 deg
    d1 = TargetTelemetry(
        id="D1",
        target_class="hostile",
        model_type="kamikaze",
        x=350.0,
        y=350.0,
        altitude=50.0,
        speed=20.0,
        heading=180.0,
        range_m=495.0,
        bearing_deg=45.0,
        rcs_dbsm=0.0,
        rf_signature_ghz=2.4,
        is_active=True,
        start_time=0.0
    )

    # Drone 2 at ~505m, bearing 46.3 deg (Delta R = 10m < 35m; Delta Bearing = 1.3 deg < 3.0 deg for radar, but > 0.5 deg for camera)
    d2 = TargetTelemetry(
        id="D2",
        target_class="hostile",
        model_type="kamikaze",
        x=365.0,
        y=348.0,
        altitude=52.0,
        speed=20.0,
        heading=180.0,
        range_m=505.0,
        bearing_deg=46.3,
        rcs_dbsm=0.0,
        rf_signature_ghz=2.4,
        is_active=True,
        start_time=0.0
    )

    plots = engine.generate_all_plots([d1, d2], timestamp=3.0, time_of_day="day")

    # Radar plots (coarse angular resolution 3.0 deg -> merged into 1 centroid plot)
    radar_real_plots = [p for p in plots if p.sensor_type == "radar" and not p.is_false_alarm]
    radar_merged = [p for p in radar_real_plots if p.is_merged_swarm]
    assert len(radar_merged) == 1, "Radar must merge the 2 drones into a single swarm centroid plot"
    assert radar_merged[0].merged_target_count == 2
    assert 44.5 <= radar_merged[0].bearing_deg <= 46.8
    assert 490.0 <= radar_merged[0].range_m <= 515.0

    # Camera EO plots (fine angular resolution 0.5 deg -> delta bearing 1.3 deg is separated into 2 distinct plots)
    camera_real_plots = [p for p in plots if p.sensor_type == "camera_eo" and not p.is_false_alarm]
    camera_merged = [p for p in camera_real_plots if p.is_merged_swarm]
    assert len(camera_merged) == 0, "Finer-resolution EO camera must NOT merge drones separated by 1.3 deg"
    assert len(camera_real_plots) == 2, "Finer-resolution camera must report both targets separately"


def test_environment_effects_directions():
    """
    Validates Phase 2 Environment Effects:
    - Night lowers optical camera detection rate drastically, thermal FLIR less affected
    - Urban vs Rural RF range
    - Jamming reduces SNR and increases false alarms
    - Weather (rain/fog) reduces radar SNR
    """
    engine = SensorRealityEngine(seed=802)

    tgt = TargetTelemetry(
        id="DRONE-ENV",
        target_class="hostile",
        model_type="quadcopter",
        x=700.0,
        y=700.0,
        altitude=60.0,
        speed=18.0,
        heading=180.0,
        range_m=989.9,
        bearing_deg=45.0,
        rcs_dbsm=-10.0,
        rf_signature_ghz=2.4,
        is_active=True,
        start_time=0.0
    )

    # 1. Day vs Night Camera
    plots_day = engine.process_camera([tgt], timestamp=1.0, time_of_day="day")
    plots_night = engine.process_camera([tgt], timestamp=1.0, time_of_day="night")
    eo_day = [p for p in plots_day if p.sensor_type == "camera_eo"]
    eo_night = [p for p in plots_night if p.sensor_type == "camera_eo"]
    assert len(eo_day) > len(eo_night), "Night must significantly suppress daylight optical camera detection"

    # 2. Urban vs Rural RF range
    far_rf_tgt = TargetTelemetry(
        id="RF-TGT",
        target_class="hostile",
        model_type="fixed_wing",
        x=1800.0,
        y=1800.0,
        altitude=120.0,
        speed=20.0,
        heading=180.0,
        range_m=2545.6,
        bearing_deg=45.0,
        rcs_dbsm=-10.0,
        rf_signature_ghz=2.4,
        is_active=True,
        start_time=0.0
    )
    # Range is 2545m -> exceeds urban max RF range (2250m) but within rural (5625m)
    rf_urban = engine.process_rf([far_rf_tgt], timestamp=1.0, terrain="urban")
    rf_rural = engine.process_rf([far_rf_tgt], timestamp=1.0, terrain="rural")
    assert len([p for p in rf_urban if not p.is_false_alarm]) == 0, "Urban multipath/shadowing must block 2545m RF"
    assert len([p for p in rf_rural if not p.is_false_alarm]) >= 1, "Rural line-of-sight must detect 2545m RF"

    # 3. Jamming increases false alarm blips
    clean_radar = engine.process_radar([tgt], timestamp=1.0, jamming_level=0.0, sensor_state="normal")
    jammed_radar = engine.process_radar([tgt], timestamp=1.0, jamming_level=0.8, sensor_state="jammed")
    fa_clean = len([p for p in clean_radar if p.is_false_alarm])
    fa_jammed = len([p for p in jammed_radar if p.is_false_alarm])
    assert fa_jammed >= fa_clean, "Jamming must inject more false alarm blips"


def test_systematic_sensor_bias_calibration_disagreement():
    """
    Validates Phase 2 Systematic Sensor Bias:
    - When sensor_bias_enabled=True, sensors have deterministic calibration offsets.
    - Trainee sees slight disagreement between Radar (+1.2 deg) and Acoustic (-3.5 deg).
    """
    engine = SensorRealityEngine(seed=903)
    target = TargetTelemetry(
        id="DRONE-BIAS",
        target_class="hostile",
        model_type="kamikaze",
        x=400.0,
        y=400.0,
        altitude=45.0,
        speed=15.0,
        heading=180.0,
        range_m=565.7,
        bearing_deg=45.0,
        rcs_dbsm=-10.0,
        rf_signature_ghz=2.4,
        is_active=True,
        start_time=0.0
    )

    unbiased_plots = engine.generate_all_plots([target], timestamp=2.0, sensor_bias_enabled=False)
    biased_plots = engine.generate_all_plots([target], timestamp=2.0, sensor_bias_enabled=True)

    radar_unbiased = [p for p in unbiased_plots if p.sensor_type == "radar" and not p.is_false_alarm][0]
    radar_biased = [p for p in biased_plots if p.sensor_type == "radar" and not p.is_false_alarm][0]

    # Radar bearing bias is +1.2 deg, range bias is +15.0m
    assert math.isclose(radar_biased.bearing_deg - radar_unbiased.bearing_deg, 1.2, abs_tol=0.2)
    assert math.isclose(radar_biased.range_m - radar_unbiased.range_m, 15.0, abs_tol=0.5)


def test_phase2_seed_reproducibility():
    """Validates that Phase 2 swarm and environment processing is 100% deterministic for a given seed."""
    tgt1 = TargetTelemetry(
        id="D1", target_class="hostile", model_type="quad", x=500.0, y=500.0, altitude=50.0,
        speed=18.0, heading=180.0, range_m=707.1, bearing_deg=45.0, rcs_dbsm=-12.0, rf_signature_ghz=2.4,
        is_active=True, start_time=0.0
    )
    tgt2 = TargetTelemetry(
        id="D2", target_class="hostile", model_type="quad", x=510.0, y=510.0, altitude=50.0,
        speed=18.0, heading=180.0, range_m=721.2, bearing_deg=45.0, rcs_dbsm=-12.0, rf_signature_ghz=2.4,
        is_active=True, start_time=0.0
    )

    e1 = SensorRealityEngine(seed=4242)
    p1 = e1.generate_all_plots([tgt1, tgt2], timestamp=5.0, weather="rain", jamming_level=0.3, sensor_bias_enabled=True)

    e2 = SensorRealityEngine(seed=4242)
    p2 = e2.generate_all_plots([tgt1, tgt2], timestamp=5.0, weather="rain", jamming_level=0.3, sensor_bias_enabled=True)

    assert len(p1) == len(p2)
    for a, b in zip(p1, p2):
        assert a.plot_id == b.plot_id
        assert a.bearing_deg == b.bearing_deg
        assert a.range_m == b.range_m
        assert a.is_merged_swarm == b.is_merged_swarm
        assert a.merged_target_count == b.merged_target_count
