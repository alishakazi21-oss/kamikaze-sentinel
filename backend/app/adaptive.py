from typing import List, Dict, Any, Tuple


class AdaptiveDifficultyEngine:
    """
    Transparent adaptive progression engine:
    Evaluates moving average score over the last N sessions (default 3) to dynamically calibrate:
    - Target count (3 to 12)
    - Sensor degradation (normal -> degraded -> jammed)
    - Time window pressure (T_full, T_max)
    - Clutter & decoy injection rate
    """

    def __init__(self, window_size: int = 3, promotion_threshold: float = 80.0, demotion_threshold: float = 50.0):
        self.window_size = window_size
        self.promotion_threshold = promotion_threshold
        self.demotion_threshold = demotion_threshold

    def evaluate_next_difficulty(
        self,
        current_difficulty: int,
        recent_scores: List[float]
    ) -> Tuple[int, str]:
        """
        Calculates new difficulty level (1: Cadet, 2: Tactical, 3: Commander)
        and returns a clear, transparent human-readable reason.
        """
        if not recent_scores:
            return current_difficulty, "No prior session history; retaining current operational tier."

        # Take last N sessions
        eval_scores = recent_scores[-self.window_size:]
        avg_score = sum(eval_scores) / len(eval_scores)

        if avg_score >= self.promotion_threshold:
            if current_difficulty < 3:
                new_diff = current_difficulty + 1
                reason = f"Promoted to Level {new_diff} due to high average score of {avg_score:.1f}% across last {len(eval_scores)} sorties (threshold: {self.promotion_threshold}%)."
                return new_diff, reason
            else:
                return 3, f"Mastery demonstrated at maximum Level 3 (Commander Tier) with {avg_score:.1f}% average."

        elif avg_score < self.demotion_threshold:
            if current_difficulty > 1:
                new_diff = current_difficulty - 1
                reason = f"Demoted to Level {new_diff} to rebuild fundamentals after average score dropped to {avg_score:.1f}% (threshold: {self.demotion_threshold}%)."
                return new_diff, reason
            else:
                return 1, f"Retaining Level 1 (Cadet Tier) with {avg_score:.1f}% average to strengthen radar tracking fundamentals."

        else:
            return current_difficulty, f"Difficulty sustained at Level {current_difficulty}; performance steady at {avg_score:.1f}%."

    def get_difficulty_parameters(self, difficulty: int) -> Dict[str, Any]:
        """Maps difficulty level to tactical scenario constraints."""
        if difficulty == 1:
            return {
                "difficulty_label": "Level 1: Cadet",
                "target_count_range": (3, 5),
                "sensor_states": ["normal"],
                "default_sensor_reliability": 0.98,
                "clutter_density": 0.05,
                "max_simultaneous_swarms": 0,
                "latency_window_sec": 6.0
            }
        elif difficulty == 2:
            return {
                "difficulty_label": "Level 2: Tactical Officer",
                "target_count_range": (5, 8),
                "sensor_states": ["normal", "degraded"],
                "default_sensor_reliability": 0.85,
                "clutter_density": 0.15,
                "max_simultaneous_swarms": 1,
                "latency_window_sec": 4.5
            }
        else:  # 3
            return {
                "difficulty_label": "Level 3: Combat Commander",
                "target_count_range": (7, 12),
                "sensor_states": ["degraded", "jammed"],
                "default_sensor_reliability": 0.70,
                "clutter_density": 0.30,
                "max_simultaneous_swarms": 2,
                "latency_window_sec": 3.0
            }

    def evaluate_per_skill_profile(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Evaluates trainee mastery across 5 distinct counter-drone skills:
        1. Low-RCS Early Detection
        2. Friend-or-Foe (IFF) Discrimination
        3. Swarm Merged Target Resolution
        4. EW & Countermeasure Selection
        5. Tactical Evasion & Cover Discipline
        """
        detection_scores = []
        iff_correct = 0
        iff_total = 0
        swarm_resolved = 0
        swarm_total = 0
        ew_correct = 0
        ew_total = 0
        evasion_success = 0
        evasion_total = 0

        for ev in events:
            # Latency evaluation
            if "detection_latency" in ev:
                lat = ev["detection_latency"]
                score = max(20.0, 100.0 - (lat * 15.0))
                detection_scores.append(score)

            # IFF
            if "true_class" in ev and "trainee_classification" in ev:
                iff_total += 1
                if ev["true_class"] == ev["trainee_classification"]:
                    iff_correct += 1

            # Swarm Resolution Trap
            if ev.get("is_swarm_trap") or "swarm" in ev.get("action", "") or "merge" in ev.get("action", ""):
                swarm_total += 1
                if ev.get("trap_resolved") or ev.get("action") == "resolve_swarm":
                    swarm_resolved += 1

            # EW & Countermeasure
            if "decision_outcome" in ev or "action" in ev:
                ew_total += 1
                if ev.get("decision_outcome") == "Optimal" or "neutralized" in ev.get("action", ""):
                    ew_correct += 1

            # Evasion
            if "evaded" in ev.get("action", "") or "cover" in ev.get("action", ""):
                evasion_total += 1
                if ev.get("success", True):
                    evasion_success += 1

        p_detection = round(sum(detection_scores) / len(detection_scores), 1) if detection_scores else 88.0
        p_iff = round((iff_correct / max(1, iff_total)) * 100.0, 1) if iff_total else 92.0
        p_swarm = round((swarm_resolved / max(1, swarm_total)) * 100.0, 1) if swarm_total else 55.0
        p_ew = round((ew_correct / max(1, ew_total)) * 100.0, 1) if ew_total else 85.0
        p_evasion = round((evasion_success / max(1, evasion_total)) * 100.0, 1) if evasion_total else 90.0

        skills = {
            "low_rcs_detection": p_detection,
            "iff_discrimination": p_iff,
            "swarm_resolution": p_swarm,
            "ew_countermeasures": p_ew,
            "tactical_evasion": p_evasion
        }

        # Identify weakest skill
        weakest_skill = min(skills, key=skills.get)
        weakest_score = skills[weakest_skill]

        # Prescription logic based on weakness
        prescriptions = {
            "low_rcs_detection": {
                "title": "Remediation Drill: Micro-RCS Stealth Drone Intercept",
                "recommended_threat": "single",
                "recommended_terrain": "border",
                "recommended_sensor_state": "degraded",
                "coaching_tip": "Focus on picking up early radar velocity Doppler shifts before optical lock."
            },
            "iff_discrimination": {
                "title": "Remediation Drill: Mixed Civil/Military Airspace ROE Discipline",
                "recommended_threat": "friendly_test",
                "recommended_terrain": "urban",
                "recommended_sensor_state": "normal",
                "coaching_tip": "Verify transponder frequency and flight path corridor before authorizing engagement."
            },
            "swarm_resolution": {
                "title": "Remediation Drill: Dense Swarm Merged Target Resolution",
                "recommended_threat": "swarm_wedge",
                "recommended_terrain": "border",
                "recommended_sensor_state": "degraded",
                "coaching_tip": "Watch for anomalous high RCS (>+3 dBsm). Use optical zoom or channelizer to resolve merged contacts before firing."
            },
            "ew_countermeasures": {
                "title": "Remediation Drill: Multi-Spectral EW Jamming vs Fast Munitions",
                "recommended_threat": "fast_fpv",
                "recommended_terrain": "coastal",
                "recommended_sensor_state": "jammed",
                "coaching_tip": "Maintain directional RF horn steadily on target fuselage to drain battery rapidly."
            },
            "tactical_evasion": {
                "title": "Remediation Drill: High-Speed Kamikaze Terminal Dive Evacuation",
                "recommended_threat": "single",
                "recommended_terrain": "border",
                "recommended_sensor_state": "normal",
                "coaching_tip": "If target enters under 30m, abandon weapon and execute immediate bunker dive."
            }
        }

        prescription = prescriptions.get(weakest_skill, prescriptions["swarm_resolution"])

        return {
            "skills": skills,
            "weakest_skill": weakest_skill,
            "weakest_score": weakest_score,
            "prescription": prescription
        }


adaptive_engine = AdaptiveDifficultyEngine()
