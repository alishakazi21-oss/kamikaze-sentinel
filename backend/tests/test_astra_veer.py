import pytest
import os
import json
from backend.app.sources.native import NativeSimSource
from backend.app.sources.sensor_model import SyntheticSensorModel
from backend.app.sources.replay import ReplaySource
from backend.app.sources.airsim_bridge import AirSimBridgeSource
from backend.app.scoring import ScoringEngine
from backend.app.adaptive import AdaptiveDifficultyEngine
from backend.app.ai_assistant import AIAssistModel


def test_seed_reproducibility():
    """Verify that the exact same seed generates identical targets and coordinates."""
    sim1 = NativeSimSource(seed=777)
    sim1.initialize({"seed": 777, "threat_type": "swarm_wedge", "target_count": 5, "difficulty": 2})
    tracks1_t0 = sim1.get_ground_truth(0.0)
    tracks1_t10 = sim1.get_ground_truth(10.0)

    sim2 = NativeSimSource(seed=777)
    sim2.initialize({"seed": 777, "threat_type": "swarm_wedge", "target_count": 5, "difficulty": 2})
    tracks2_t0 = sim2.get_ground_truth(0.0)
    tracks2_t10 = sim2.get_ground_truth(10.0)

    assert len(tracks1_t0) == len(tracks2_t0)
    for t1, t2 in zip(tracks1_t0, tracks2_t0):
        assert t1.id == t2.id
        assert t1.x == t2.x
        assert t1.y == t2.y
        assert t1.heading == t2.heading

    for t1, t2 in zip(tracks1_t10, tracks2_t10):
        assert t1.x == t2.x
        assert t1.y == t2.y


def test_sensor_model_degradation_effects():
    """Verify that degraded and jammed sensor states introduce higher noise and lower confidence."""
    sim = NativeSimSource(seed=123)
    sim.initialize({"seed": 123, "threat_type": "single", "target_count": 3, "difficulty": 1})
    ground_truth = sim.get_ground_truth(5.0)

    model_normal = SyntheticSensorModel(seed=42)
    obs_normal = model_normal.process(ground_truth, elapsed_seconds=5.0, sensor_state="normal", sensor_reliability=1.0)

    model_jammed = SyntheticSensorModel(seed=42)
    obs_jammed = model_jammed.process(ground_truth, elapsed_seconds=5.0, sensor_state="jammed", sensor_reliability=0.6)

    # Jammed sensors have significantly lower average sensor confidence
    avg_conf_normal = sum(t.sensor_confidence for t in obs_normal if not t.is_clutter) / max(1, len(obs_normal))
    avg_conf_jammed = sum(t.sensor_confidence for t in obs_jammed if not t.is_clutter) / max(1, len(obs_jammed))

    assert avg_conf_normal > avg_conf_jammed


def test_scoring_decision_tree():
    """Verify 3-pillar decision-tree scoring and friendly fire penalties."""
    engine = ScoringEngine()

    targets = [
        {"id": "TGT-01", "target_class": "hostile", "start_time": 0.0},
        {"id": "TGT-02", "target_class": "friendly", "start_time": 0.0}
    ]

    # Perfect actions
    events_perfect = [
        {
            "target_id": "TGT-01",
            "detected_at": 2.0,
            "trainee_classification": "hostile",
            "trainee_response": "authorise_protective_response",
            "proximity_m": 1200.0
        },
        {
            "target_id": "TGT-02",
            "detected_at": 2.5,
            "trainee_classification": "friendly",
            "trainee_response": "continue_monitoring",
            "proximity_m": 2000.0
        }
    ]
    res_perfect = engine.calculate_score(targets, events_perfect, difficulty=1)
    assert res_perfect.total_score >= 90.0
    assert res_perfect.dangerous_errors_count == 0

    # Friendly fire error
    events_friendly_fire = [
        {
            "target_id": "TGT-01",
            "detected_at": 2.0,
            "trainee_classification": "hostile",
            "trainee_response": "authorise_protective_response",
            "proximity_m": 1200.0
        },
        {
            "target_id": "TGT-02",
            "detected_at": 2.5,
            "trainee_classification": "hostile",
            "trainee_response": "authorise_protective_response",
            "proximity_m": 1500.0
        }
    ]
    res_ff = engine.calculate_score(targets, events_friendly_fire, difficulty=1)
    assert res_ff.dangerous_errors_count >= 1
    assert res_ff.total_score < res_perfect.total_score


def test_adaptive_difficulty_progression():
    """Verify adaptive promotion on >80 score and demotion on <50 score."""
    engine = AdaptiveDifficultyEngine(window_size=3, promotion_threshold=80.0, demotion_threshold=50.0)

    # High performance promotes difficulty
    new_diff, reason = engine.evaluate_next_difficulty(current_difficulty=1, recent_scores=[85.0, 92.0, 88.0])
    assert new_diff == 2
    assert "Promoted" in reason

    # Low performance demotes difficulty
    new_diff_demoted, reason_demoted = engine.evaluate_next_difficulty(current_difficulty=2, recent_scores=[40.0, 45.0, 48.0])
    assert new_diff_demoted == 1
    assert "Demoted" in reason_demoted


def test_ai_assist_model_accuracy():
    """Verify real scikit-learn classifier achieves > 85% held-out test accuracy."""
    ai = AIAssistModel()
    assert ai.held_out_accuracy >= 0.85
    pred = ai.predict_target(speed=28.0, altitude=75.0, range_m=1200.0, rcs_estimate=-8.0, rf_frequency=2.4)
    assert pred["suggested_class"] in ["hostile", "civil", "friendly", "false_alarm"]
    assert pred["confidence"] > 0.40


def test_replay_and_airsim_fallback():
    """Verify ReplaySource loads telemetry and AirSim fails gracefully when offline."""
    replay = ReplaySource()
    status = replay.is_available()
    assert status["available"] is True

    airsim = AirSimBridgeSource()
    airsim_status = airsim.is_available()
    assert airsim_status["available"] is False
    assert "Unreal" in airsim_status["name"] or "Cosys-AirSim" in airsim_status["name"]
