import pytest
from backend.app.adaptive import (
    BayesianKnowledgeTracing,
    AdaptiveDifficultyEngine,
    CORE_SKILLS,
    SKILL_DISPLAY_NAMES
)


def test_bkt_mathematical_updates():
    """Verify standard BKT posterior update and transition math."""
    bkt = BayesianKnowledgeTracing(p_l0=0.15, p_t=0.10, p_g=0.15, p_s=0.10)

    # Prior
    p0 = bkt.p_l0

    # Observing correct responses should monotonically increase mastery
    p1 = bkt.update_mastery(p0, correct=True)
    p2 = bkt.update_mastery(p1, correct=True)
    p3 = bkt.update_mastery(p2, correct=True)
    assert p1 > p0
    assert p2 > p1
    assert p3 > p2

    # Observing incorrect response should decrease mastery
    p_fail = bkt.update_mastery(p3, correct=False)
    assert p_fail < p3

    # Expected success rate matches formula: p(L)*(1-p_s) + (1-p_L)*p_g
    exp_rate = bkt.expected_success_rate(p3)
    manual_calc = p3 * 0.90 + (1.0 - p3) * 0.15
    assert abs(exp_rate - manual_calc) < 1e-3


def test_6_skill_profile_updates():
    """Verify BKT updates across all 6 core counter-drone skills."""
    engine = AdaptiveDifficultyEngine()

    current_skills = {k: 0.20 for k in CORE_SKILLS}

    # Simulate target details with poor swarm assessment and no crosscheck
    target_details = [
        {
            "target_id": "TGT-01",
            "true_class": "hostile",
            "detected": True,
            "detection_latency": 2.1,
            "classification_correct": True,
            "decision_outcome": "Optimal",
            "reason_code": "SWARM_TREATED_AS_SINGLE",
            "cross_checked": False
        },
        {
            "target_id": "TGT-02",
            "true_class": "hostile",
            "detected": True,
            "detection_latency": 2.5,
            "classification_correct": True,
            "decision_outcome": "Acceptable",
            "reason_code": "NO_CROSSCHECK",
            "cross_checked": False
        }
    ]

    scenario_meta = {"threat_type": "swarm_wedge", "difficulty": 2, "weather": "clear", "clutter_density": 0.10}
    updated = engine.update_bkt_skill_profiles(current_skills, target_details, scenario_meta)

    assert len(updated) == 6
    for k in CORE_SKILLS:
        assert k in updated
        assert "current_mastery" in updated[k]
        assert "expected_success_rate" in updated[k]

    # Classification and detection were successful -> increased mastery
    assert updated["classification"]["current_mastery"] > 0.20
    assert updated["detection_clutter"]["current_mastery"] > 0.20

    # Swarm assessment failed -> decreased mastery
    assert updated["swarm_assessment"]["current_mastery"] < 0.20
    assert updated["sensor_crosscheck"]["current_mastery"] < 0.20


def test_adaptive_next_scenario_targets_weakest_skill():
    """Verify adaptive scenario selection targets the weakest skill and aims for ~70% success."""
    engine = AdaptiveDifficultyEngine()

    # Skill profile where swarm_assessment is weakest
    skills = {
        "detection_clutter": 0.80,
        "classification": 0.75,
        "swarm_assessment": 0.18,  # weakest
        "sensor_crosscheck": 0.60,
        "response_selection": 0.70,
        "decision_under_pressure": 0.65
    }

    rec = engine.select_next_scenario(skills, completed_sessions_count=1, mode="ADAPTIVE")
    assert rec["mode"] == "ADAPTIVE"
    assert rec["is_review"] is False
    assert rec["targeted_skill"] == "swarm_assessment"
    assert rec["threat_type"] == "swarm_wedge"
    assert "swarm" in rec["scenario_title"].lower()


def test_1_in_5_review_rule():
    """Verify that every 5th drill selects a review drill of a previously mastered skill."""
    engine = AdaptiveDifficultyEngine()

    skills = {
        "detection_clutter": 0.85,  # mastered
        "classification": 0.80,     # mastered
        "swarm_assessment": 0.25,   # unmastered
        "sensor_crosscheck": 0.30,  # unmastered
        "response_selection": 0.75, # mastered
        "decision_under_pressure": 0.35
    }

    # Session 4 (index 4 -> drill 5) must trigger 1-in-5 review
    rec = engine.select_next_scenario(skills, completed_sessions_count=4, mode="ADAPTIVE")
    assert rec["is_review"] is True
    assert rec["targeted_skill"] in ["detection_clutter", "classification", "response_selection"]
    assert "Retention Review" in rec["coaching_rationale"]


def test_fixed_sequence_mode():
    """Verify FIXED_SEQUENCE mode steps deterministically through the standard syllabus."""
    engine = AdaptiveDifficultyEngine()
    skills = {k: 0.50 for k in CORE_SKILLS}

    rec1 = engine.select_next_scenario(skills, completed_sessions_count=0, mode="FIXED_SEQUENCE", fixed_index=0)
    rec2 = engine.select_next_scenario(skills, completed_sessions_count=1, mode="FIXED_SEQUENCE", fixed_index=1)

    assert rec1["mode"] == "FIXED_SEQUENCE"
    assert rec2["mode"] == "FIXED_SEQUENCE"
    assert rec1["scenario_title"] != rec2["scenario_title"]
    assert rec1["difficulty"] == 1
    assert rec2["threat_type"] == "friendly_test"
