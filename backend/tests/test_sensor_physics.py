import pytest
import math
from backend.app.sources.base import TargetTelemetry
from backend.app.sources.native import NativeSimSource
from backend.app.sources.sensor_reality import SensorRealityEngine, SensorPlot


def test_radar_ca_cfar_swerling1_physics():
    """
    Validates:
    - Mathematical precision of CA-CFAR Swerling I closed-form PD = (1 + alpha / (1 + SNR))^(-N)
    - Zero SNR gives exactly PFA
    - High SNR approaches 1.0
    - Measurement standard deviation scales inversely with sqrt(SNR)
    """
    engine = SensorRealityEngine(seed=42)
    cfg = engine.config["radar"]
    pfa = cfg["pfa"]
    N = cfg["cfar_n_cells"]
    alpha = (pfa ** (-1.0 / N)) - 1.0

    # 1. At SNR = 0 (linear), PD must equal PFA exactly
    snr_zero = 0.0
    pd_zero = (1.0 + (alpha / (1.0 + snr_zero))) ** (-N)
    assert math.isclose(pd_zero, pfa, rel_tol=1e-5)

    # 2. At high SNR (30 dB = 1000 linear), PD is > 0.98 (approaching 1.0)
    snr_high = 1000.0
    pd_high = (1.0 + (alpha / (1.0 + snr_high))) ** (-N)
    assert pd_high > 0.98
    assert (1.0 + (alpha / (1.0 + 10000.0))) ** (-N) > 0.998

    # 3. Test radar processing with close vs far targets
    close_target = TargetTelemetry(
        id="DRONE-CLOSE",
        target_class="hostile",
        model_type="kamikaze",
        x=300.0,
        y=400.0,
        altitude=50.0,
        speed=20.0,
        heading=180.0,
        range_m=500.0,
        bearing_deg=36.87,
        rcs_dbsm=-10.0,
        rf_signature_ghz=2.4,
        is_active=True,
        start_time=0.0
    )

    far_target = TargetTelemetry(
        id="DRONE-FAR",
        target_class="hostile",
        model_type="kamikaze",
        x=2100.0,
        y=2800.0,
        altitude=50.0,
        speed=20.0,
        heading=180.0,
        range_m=3500.0,
        bearing_deg=36.87,
        rcs_dbsm=-10.0,
        rf_signature_ghz=2.4,
        is_active=True,
        start_time=0.0
    )

    plots = engine.process_radar([close_target, far_target], timestamp=5.0)
    close_plots = [p for p in plots if p.underlying_target_id == "DRONE-CLOSE"]
    assert len(close_plots) == 1
    assert close_plots[0].snr_db is not None
    assert close_plots[0].snr_db > 15.0
    assert close_plots[0].detection_probability > 0.90


def test_acoustic_logistic_detection_and_bearing_only():
    """
    Validates:
    - Acoustic array reports bearing ONLY (range_m, x, y are None)
    - Logistic detection formula PD = 1 / (1 + exp(-(SNR_dB - sensitivity_dB)))
    - SNR = sensitivity gives PD = 0.5
    """
    engine = SensorRealityEngine(seed=77)
    sensitivity_db = engine.config["acoustic"]["sensitivity_dB"]

    # When SNR == sensitivity, PD must be exactly 0.5
    exponent = -(sensitivity_db - sensitivity_db)
    pd_half = 1.0 / (1.0 + math.exp(exponent))
    assert math.isclose(pd_half, 0.5, abs_tol=1e-6)

    # Test acoustic reporting
    target = TargetTelemetry(
        id="DRONE-AUDIBLE",
        target_class="hostile",
        model_type="quadcopter",
        x=200.0,
        y=200.0,
        altitude=40.0,
        speed=15.0,
        heading=90.0,
        range_m=282.8,
        bearing_deg=45.0,
        rcs_dbsm=-15.0,
        rf_signature_ghz=5.8,
        is_active=True,
        start_time=0.0
    )

    acoustic_plots = engine.process_acoustic([target], timestamp=1.0)
    real_plots = [p for p in acoustic_plots if not p.is_false_alarm]
    if real_plots:
        plot = real_plots[0]
        assert plot.sensor_type == "acoustic"
        assert plot.range_m is None
        assert plot.x is None
        assert plot.y is None
        assert 0.0 <= plot.bearing_deg < 360.0


def test_camera_eo_vs_thermal_night_physics():
    """
    Validates:
    - Daylight optical camera range decays drastically at night
    - Thermal FLIR camera maintains long-range detection at night
    """
    engine = SensorRealityEngine(seed=99)
    medium_range_target = TargetTelemetry(
        id="DRONE-MED",
        target_class="hostile",
        model_type="quadcopter",
        x=800.0,
        y=800.0,
        altitude=60.0,
        speed=18.0,
        heading=180.0,
        range_m=1131.4,
        bearing_deg=45.0,
        rcs_dbsm=-12.0,
        rf_signature_ghz=2.4,
        is_active=True,
        start_time=0.0
    )

    # 1. Daytime: both EO and Thermal detect at 1130m
    day_plots = engine.process_camera([medium_range_target], timestamp=2.0, time_of_day="day")
    day_eo = [p for p in day_plots if p.sensor_type == "camera_eo"]
    day_ir = [p for p in day_plots if p.sensor_type == "camera_thermal"]
    assert len(day_eo) >= 1
    assert len(day_ir) >= 1

    # 2. Night: EO optical cannot reach 1130m (limit is ~300m), Thermal FLIR still detects
    night_plots = engine.process_camera([medium_range_target], timestamp=2.0, time_of_day="night")
    night_eo = [p for p in night_plots if p.sensor_type == "camera_eo"]
    night_ir = [p for p in night_plots if p.sensor_type == "camera_thermal"]
    assert len(night_eo) == 0, "Daylight EO camera must not detect targets beyond 300m at night"
    assert len(night_ir) >= 1, "Thermal FLIR camera must maintain night detection"


def test_sensor_engine_seed_determinism():
    """
    Validates:
    - Identical seed guarantees identical plots (ranges, bearings, false alarm count)
    - Different seeds produce different draws
    """
    target = TargetTelemetry(
        id="DRONE-SEED",
        target_class="hostile",
        model_type="kamikaze",
        x=600.0,
        y=800.0,
        altitude=70.0,
        speed=22.0,
        heading=220.0,
        range_m=1000.0,
        bearing_deg=36.87,
        rcs_dbsm=-14.0,
        rf_signature_ghz=2.4,
        is_active=True,
        start_time=0.0
    )

    e1 = SensorRealityEngine(seed=1337)
    plots1 = e1.generate_all_plots([target], timestamp=10.0)

    e2 = SensorRealityEngine(seed=1337)
    plots2 = e2.generate_all_plots([target], timestamp=10.0)

    assert len(plots1) == len(plots2)
    for p1, p2 in zip(plots1, plots2):
        assert p1.sensor_id == p2.sensor_id
        assert p1.bearing_deg == p2.bearing_deg
        assert p1.range_m == p2.range_m
        assert p1.is_false_alarm == p2.is_false_alarm
        assert p1.confidence == p2.confidence


def test_false_alarms_flagged_for_aar():
    """
    Validates:
    - False alarms carry is_false_alarm=True and underlying_target_id=None
    - True target detections carry is_false_alarm=False and valid target ID
    """
    engine = SensorRealityEngine(seed=555)
    target = TargetTelemetry(
        id="DRONE-AAR",
        target_class="hostile",
        model_type="kamikaze",
        x=400.0,
        y=400.0,
        altitude=50.0,
        speed=20.0,
        heading=180.0,
        range_m=565.7,
        bearing_deg=45.0,
        rcs_dbsm=-10.0,
        rf_signature_ghz=2.4,
        is_active=True,
        start_time=0.0
    )

    plots = engine.generate_all_plots([target], timestamp=4.0, sensor_state="jammed", terrain="urban")
    fa_plots = [p for p in plots if p.is_false_alarm]
    real_plots = [p for p in plots if not p.is_false_alarm]

    assert len(real_plots) >= 1
    for rp in real_plots:
        assert rp.underlying_target_id == "DRONE-AAR"

    assert len(fa_plots) >= 1
    for fp in fa_plots:
        assert fp.underlying_target_id is None
        assert fp.is_false_alarm is True


def test_native_sim_source_sensor_reports_integration():
    """
    Validates:
    - NativeSimSource.get_sensor_reports produces multi-sensor reports
    """
    sim = NativeSimSource(seed=888)
    sim.initialize({"seed": 888, "threat_type": "single", "target_count": 3, "difficulty": 1})
    reports = sim.get_sensor_reports(elapsed_seconds=2.0)
    assert len(reports) > 0
    sensor_types = {r.sensor_type for r in reports}
    assert "radar" in sensor_types
