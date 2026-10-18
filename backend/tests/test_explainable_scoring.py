import pytest
from backend.app.scoring import ScoringEngine


def test_4_question_decision_tree_optimal():
    """Verify optimal engagement passes all 4 questions and yields OPTIMAL_ENGAGEMENT."""
    engine = ScoringEngine()

    targets = [
        {"id": "TGT-01", "target_class": "hostile", "start_time": 0.0, "range_m": 2000.0}
    ]

    events = [
        {
            "target_id": "TGT-01",
            "detected_at": 2.0,
            "trainee_classification": "hostile",
            "trainee_response": "authorise_protective_response",
            "proximity_m": 1800.0,
            "confidence_rating": 5,
            "cross_checked": True
        }
    ]

    result = engine.calculate_score(targets, events, difficulty=1)
    assert result.total_score >= 90.0
    detail = result.target_details[0]
    assert detail.reason_code == "OPTIMAL_ENGAGEMENT"
    assert detail.tree_evaluation["Q1_detected_before_critical_range"] is True
    assert detail.tree_evaluation["Q2_classified_correctly"] is True
    assert detail.tree_evaluation["Q3_response_appropriate_roe"] is True
    assert detail.tree_evaluation["Q4_crosschecked_when_uncertain"] is True


def test_decision_tree_no_crosscheck_on_uncertain_sensor():
    """Verify that an uncertain contact (low SNR / clutter) without cross-checking yields NO_CROSSCHECK."""
    engine = ScoringEngine()

    targets = [
        {"id": "TGT-UNCERTAIN", "target_class": "hostile", "start_time": 0.0, "sensor_uncertain": True}
    ]

    events = [
        {
            "target_id": "TGT-UNCERTAIN",
            "detected_at": 2.5,
            "trainee_classification": "hostile",
            "trainee_response": "authorise_protective_response",
            "proximity_m": 1600.0,
            "cross_checked": False,
            "confidence_rating": 5
        }
    ]

    result = engine.calculate_score(targets, events, difficulty=1)
    detail = result.target_details[0]
    assert detail.reason_code == "NO_CROSSCHECK"
    assert detail.tree_evaluation["Q4_crosschecked_when_uncertain"] is False


def test_decision_tree_swarm_treated_as_single():
    """Verify that treating a multi-drone swarm as a single target yields SWARM_TREATED_AS_SINGLE."""
    engine = ScoringEngine()

    targets = [
        {"id": "TGT-SWARM", "target_class": "hostile", "start_time": 0.0, "is_swarm": True}
    ]

    events = [
        {
            "target_id": "TGT-SWARM",
            "detected_at": 2.0,
            "trainee_classification": "hostile",
            "trainee_response": "authorise_protective_response",
            "proximity_m": 1500.0,
            "treated_as_single": True,
            "confidence_rating": 4
        }
    ]

    result = engine.calculate_score(targets, events, difficulty=1)
    detail = result.target_details[0]
    assert detail.reason_code == "SWARM_TREATED_AS_SINGLE"


def test_decision_tree_false_alarm_engaged():
    """Verify authorizing intercept on a biological false alarm yields FALSE_ALARM_ENGAGED."""
    engine = ScoringEngine()

    targets = [
        {"id": "TGT-BIRD", "target_class": "false_alarm", "start_time": 0.0}
    ]

    events = [
        {
            "target_id": "TGT-BIRD",
            "detected_at": 3.0,
            "trainee_classification": "hostile",
            "trainee_response": "authorise_protective_response",
            "proximity_m": 1200.0,
            "confidence_rating": 5
        }
    ]

    result = engine.calculate_score(targets, events, difficulty=1)
    detail = result.target_details[0]
    assert detail.reason_code == "FALSE_ALARM_ENGAGED"
    assert result.dangerous_errors_count >= 1


def test_calibration_and_overconfidence_index():
    """Verify Overconfidence Index (OCI) = mean confidence - fraction correct, and calibration scoring."""
    engine = ScoringEngine()

    # Trainee gives confidence 5 (1.0) on both targets, but gets both wrong
    targets = [
        {"id": "TGT-01", "target_class": "hostile", "start_time": 0.0},
        {"id": "TGT-02", "target_class": "friendly", "start_time": 0.0}
    ]

    events_overconfident = [
        {
            "target_id": "TGT-01",
            "detected_at": 2.0,
            "trainee_classification": "civil",
            "trainee_response": "request_verification",
            "confidence_rating": 5
        },
        {
            "target_id": "TGT-02",
            "detected_at": 2.5,
            "trainee_classification": "hostile",
            "trainee_response": "authorise_protective_response",
            "confidence_rating": 5
        }
    ]

    result = engine.calculate_score(targets, events_overconfident, difficulty=1)
    # Mean confidence = 1.0, accuracy = 0.0 -> OCI = +1.0
    assert result.overconfidence_index > 0.50
    assert result.calibration_score == 0.0
    assert any("overconfidence" in note.lower() for note in result.feedback_notes)


def test_scoring_weights_proportions():
    """Verify weights adhere to detection 30%, classification 30%, decision 30%, calibration 10%."""
    engine = ScoringEngine()
    assert engine.weights.get("detection") == 0.30
    assert engine.weights.get("classification") == 0.30
    assert engine.weights.get("decision") == 0.30
    assert engine.weights.get("calibration") == 0.10
