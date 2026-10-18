from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime, timedelta
import math


CORE_SKILLS = [
    "detection_clutter",
    "classification",
    "swarm_assessment",
    "sensor_crosscheck",
    "response_selection",
    "decision_under_pressure"
]

SKILL_DISPLAY_NAMES = {
    "detection_clutter": "Detection in Clutter & Adverse Weather",
    "classification": "Target Classification & Threat Identification",
    "swarm_assessment": "Swarm Resolution & Density Estimation",
    "sensor_crosscheck": "Multi-Sensor Cross-Checking Under Uncertainty",
    "response_selection": "Tactical ROE Response Selection",
    "decision_under_pressure": "Decisions Under High-Speed Pressure"
}


class BayesianKnowledgeTracing:
    """
    Bayesian Knowledge Tracing (BKT) Engine (Corbett & Anderson 1994):
    Tracks latent cognitive mastery p(L) per skill:
      p(L_0): Prior probability of mastery (default 0.15)
      p(T):   Transition / learning probability per trial (default 0.10)
      p(G):   Guess probability (default 0.15)
      p(S):   Slip probability (default 0.10)
    """

    def __init__(self, p_l0: float = 0.15, p_t: float = 0.10, p_g: float = 0.15, p_s: float = 0.10):
        self.p_l0 = p_l0
        self.p_t = p_t
        self.p_g = p_g
        self.p_s = p_s

    def update_mastery(self, p_l: float, correct: bool) -> float:
        """Computes posterior mastery p(L | obs) and applies transit update p(T)."""
        if correct:
            p_obs_given_l = 1.0 - self.p_s
            p_obs_given_not_l = self.p_g
        else:
            p_obs_given_l = self.p_s
            p_obs_given_not_l = 1.0 - self.p_g

        num = p_l * p_obs_given_l
        den = num + (1.0 - p_l) * p_obs_given_not_l
        if den <= 0:
            p_l_given_obs = p_l
        else:
            p_l_given_obs = num / den

        p_next = p_l_given_obs + (1.0 - p_l_given_obs) * self.p_t
        return round(max(0.01, min(0.99, p_next)), 4)

    def expected_success_rate(self, p_l: float) -> float:
        """P(correct) = p(L)*(1-p_s) + (1-p_L)*p_g"""
        rate = p_l * (1.0 - self.p_s) + (1.0 - p_l) * self.p_g
        return round(rate, 4)


class AdaptiveDifficultyEngine:
    """
    Comprehensive Adaptive Engine:
    - Multi-session moving average difficulty level (Cadet, Tactical, Commander)
    - 6-Skill Bayesian Knowledge Tracing (BKT)
    - Adaptive curriculum targeting 70% expected success rate
    - 1-in-5 review drills to prevent skill atrophy
    - Mode switch: ADAPTIVE vs FIXED_SEQUENCE
    """

    def __init__(self, window_size: int = 3, promotion_threshold: float = 80.0, demotion_threshold: float = 50.0):
        self.window_size = window_size
        self.promotion_threshold = promotion_threshold
        self.demotion_threshold = demotion_threshold
        self.bkt = BayesianKnowledgeTracing(p_l0=0.15, p_t=0.10, p_g=0.15, p_s=0.10)

    # -------------------------------------------------------------
    # 1. Global Difficulty Tier Progression
    # -------------------------------------------------------------
    def evaluate_next_difficulty(
        self,
        current_difficulty: int,
        recent_scores: List[float]
    ) -> Tuple[int, str]:
        if not recent_scores:
            return current_difficulty, "No prior session history; retaining current operational tier."

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
        else:
            return {
                "difficulty_label": "Level 3: Combat Commander",
                "target_count_range": (7, 12),
                "sensor_states": ["degraded", "jammed"],
                "default_sensor_reliability": 0.70,
                "clutter_density": 0.30,
                "max_simultaneous_swarms": 2,
                "latency_window_sec": 3.0
            }

    # -------------------------------------------------------------
    # 2. 6-Skill Bayesian Knowledge Tracing Evaluation
    # -------------------------------------------------------------
    def update_bkt_skill_profiles(
        self,
        current_mastery_map: Dict[str, float],
        target_details: List[Any],
        scenario_meta: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Dict[str, Any]]:
        """
        Updates BKT probability of mastery p(L) for the 6 core counter-drone skills.
        """
        meta = scenario_meta or {}
        clutter_density = float(meta.get("clutter_density", 0.05))
        weather = meta.get("weather", "clear")
        is_high_clutter = clutter_density > 0.15 or weather in ["fog", "rain", "storm"]

        # Skill observations
        skill_results: Dict[str, List[bool]] = {k: [] for k in CORE_SKILLS}

        for td in target_details:
            # Handle both pydantic TargetScoreDetail and dict
            t_id = getattr(td, "target_id", None) or (td.get("target_id") if isinstance(td, dict) else "TGT")
            true_cls = getattr(td, "true_class", None) or (td.get("true_class") if isinstance(td, dict) else "hostile")
            detected = getattr(td, "detected", False) if not isinstance(td, dict) else td.get("detected", False)
            latency = getattr(td, "detection_latency", 99.0) if not isinstance(td, dict) else td.get("detection_latency", 99.0)
            class_corr = getattr(td, "classification_correct", False) if not isinstance(td, dict) else td.get("classification_correct", False)
            outcome = getattr(td, "decision_outcome", "none") if not isinstance(td, dict) else td.get("decision_outcome", "none")
            reason = getattr(td, "reason_code", "") if not isinstance(td, dict) else td.get("reason_code", "")
            cross_chk = getattr(td, "cross_checked", False) if not isinstance(td, dict) else td.get("cross_checked", False)
            prox = getattr(td, "proximity_m", 1500.0) if isinstance(td, dict) else 1500.0

            # 1. Detection in Clutter
            if is_high_clutter or true_cls == "false_alarm":
                skill_results["detection_clutter"].append(detected and latency < 8.0)
            else:
                skill_results["detection_clutter"].append(detected and latency < 6.0)

            # 2. Classification
            skill_results["classification"].append(bool(class_corr))

            # 4. Sensor Cross-Check
            if reason == "NO_CROSSCHECK":
                skill_results["sensor_crosscheck"].append(False)
            elif cross_chk:
                skill_results["sensor_crosscheck"].append(True)
            elif is_high_clutter and not cross_chk:
                skill_results["sensor_crosscheck"].append(False)

            # 5. Response Selection
            skill_results["response_selection"].append(outcome in ["Optimal", "Acceptable"])

            # 6. Decision Under Pressure
            if "fast" in str(meta.get("threat_type", "")).lower() or latency <= 4.0:
                skill_results["decision_under_pressure"].append(detected and outcome in ["Optimal", "Acceptable"])
            else:
                skill_results["decision_under_pressure"].append(outcome != "Dangerous error")

        # Swarm Assessment evaluated at scenario / formation level
        swarm_failure = any(
            getattr(td, "reason_code", None) == "SWARM_TREATED_AS_SINGLE" or
            (td.get("reason_code") if isinstance(td, dict) else "") == "SWARM_TREATED_AS_SINGLE"
            for td in target_details
        )
        if "swarm" in str(meta.get("threat_type", "")).lower() or swarm_failure:
            skill_results["swarm_assessment"].append(not swarm_failure)

        updated_profiles: Dict[str, Dict[str, Any]] = {}
        for skill_key in CORE_SKILLS:
            current_p = current_mastery_map.get(skill_key, self.bkt.p_l0)
            obs_list = skill_results[skill_key]
            
            p_running = current_p
            for obs in obs_list:
                p_running = self.bkt.update_mastery(p_running, obs)

            expected_p = self.bkt.expected_success_rate(p_running)
            updated_profiles[skill_key] = {
                "skill_key": skill_key,
                "display_name": SKILL_DISPLAY_NAMES[skill_key],
                "previous_mastery": current_p,
                "current_mastery": p_running,
                "expected_success_rate": expected_p,
                "trials_evaluated": len(obs_list),
                "is_mastered": p_running >= 0.70
            }

        return updated_profiles

    # -------------------------------------------------------------
    # 3. Next Scenario Selection (Adaptive vs Fixed, 70% Target, 1-in-5 Review)
    # -------------------------------------------------------------
    def select_next_scenario(
        self,
        skill_mastery_map: Dict[str, float],
        completed_sessions_count: int = 0,
        mode: str = "ADAPTIVE",
        fixed_index: int = 0
    ) -> Dict[str, Any]:
        """
        Recommends the next scenario:
        - Mode: 'ADAPTIVE' vs 'FIXED_SEQUENCE'
        - In ADAPTIVE: Target weakest skill, challenge calibrated to ~70% success.
        - 1-in-5 Review rule: Every 5th drill reviews a previously mastered skill.
        """
        if mode == "FIXED_SEQUENCE":
            fixed_templates = [
                {"title": "Standard Drill 1: Base Perimeter Defense", "threat_type": "single", "difficulty": 1, "terrain": "border"},
                {"title": "Standard Drill 2: Urban Blue-Force De-confliction", "threat_type": "friendly_test", "difficulty": 1, "terrain": "urban"},
                {"title": "Standard Drill 3: Coastal Clutter Intercept", "threat_type": "single", "difficulty": 2, "terrain": "coastal"},
                {"title": "Standard Drill 4: Mountain Sector Swarm Defense", "threat_type": "swarm_wedge", "difficulty": 2, "terrain": "mountain"},
                {"title": "Standard Drill 5: High-Speed Terminal Intercept", "threat_type": "fast_fpv", "difficulty": 3, "terrain": "border"},
            ]
            idx = fixed_index % len(fixed_templates)
            selected = fixed_templates[idx]
            return {
                "mode": "FIXED_SEQUENCE",
                "is_review": False,
                "targeted_skill": "balanced_curriculum",
                "targeted_skill_name": "Standard Fixed Sequence",
                "scenario_title": selected["title"],
                "threat_type": selected["threat_type"],
                "difficulty": selected["difficulty"],
                "terrain": selected["terrain"],
                "target_count": 3 + selected["difficulty"] * 2,
                "coaching_rationale": f"Fixed sequential syllabus exercise {idx + 1} of {len(fixed_templates)}."
            }

        # --- ADAPTIVE MODE ---
        drill_num = completed_sessions_count + 1
        is_review = (drill_num % 5 == 0)

        # Identify mastered skills (p >= 0.65) and unmastered skills
        mastered = [s for s in CORE_SKILLS if skill_mastery_map.get(s, self.bkt.p_l0) >= 0.65]
        unmastered = [s for s in CORE_SKILLS if s not in mastered]

        if is_review and mastered:
            # 1-in-5 Review: pick a mastered skill to reinforce retention
            targeted_skill = sorted(mastered, key=lambda s: skill_mastery_map.get(s, 0.70))[0]
            rationale_prefix = f"Drill #{drill_num} is a scheduled 1-in-5 Retention Review to consolidate mastered competencies."
        else:
            # Target weakest skill
            targeted_skill = min(CORE_SKILLS, key=lambda s: skill_mastery_map.get(s, self.bkt.p_l0))
            p_val = skill_mastery_map.get(targeted_skill, self.bkt.p_l0)
            rationale_prefix = f"Targeting priority deficiency area '{SKILL_DISPLAY_NAMES[targeted_skill]}' (BKT mastery: {p_val*100:.1f}%)."

        p_mastery = skill_mastery_map.get(targeted_skill, self.bkt.p_l0)
        exp_success = self.bkt.expected_success_rate(p_mastery)

        # Calibrate difficulty targeting ~70% success zone (Zone of Proximal Development)
        if p_mastery < 0.35:
            difficulty = 1
            sensor_state = "normal"
            weather = "clear"
            target_count = 3
        elif p_mastery < 0.70:
            difficulty = 2
            sensor_state = "normal" if p_mastery < 0.50 else "degraded"
            weather = "fog" if targeted_skill == "detection_clutter" else "clear"
            target_count = 5
        else:
            difficulty = 3
            sensor_state = "degraded" if targeted_skill != "sensor_crosscheck" else "jammed"
            weather = "rain" if targeted_skill == "detection_clutter" else "clear"
            target_count = 7

        skill_templates = {
            "detection_clutter": {
                "title": f"Adaptive Sortie: Low-Doppler Clutter Discrimination ({difficulty}★)",
                "threat_type": "single",
                "terrain": "border",
                "coaching": "Filter false avian clutter tracks using doppler range rate before firing."
            },
            "classification": {
                "title": f"Adaptive Sortie: High-Density IFF ROE Discipline ({difficulty}★)",
                "threat_type": "friendly_test",
                "terrain": "urban",
                "coaching": "Verify civilian transponder frequency before authorizing air defense countermeasures."
            },
            "swarm_assessment": {
                "title": f"Adaptive Sortie: Swarm Cell Merged Resolution ({difficulty}★)",
                "threat_type": "swarm_wedge",
                "terrain": "border",
                "coaching": "Watch for anomalous composite RCS; cross-reference optical camera to resolve merged contacts."
            },
            "sensor_crosscheck": {
                "title": f"Adaptive Sortie: Multi-Spectral Cross-Check Under EW ({difficulty}★)",
                "threat_type": "single",
                "terrain": "mountain",
                "coaching": "When primary active radar is degraded or low-SNR, cross-check with passive RF and FLIR thermal camera."
            },
            "response_selection": {
                "title": f"Adaptive Sortie: Escalation ROE Protocol Selection ({difficulty}★)",
                "threat_type": "friendly_test",
                "terrain": "urban",
                "coaching": "Select appropriate proportional response (monitoring, verification, or intercept) matching target classification."
            },
            "decision_under_pressure": {
                "title": f"Adaptive Sortie: Fast Kamikaze Dive Interception ({difficulty}★)",
                "threat_type": "fast_fpv",
                "terrain": "coastal",
                "coaching": "High-velocity inbound contact; lock and execute protective response before critical 800m perimeter."
            }
        }

        tmpl = skill_templates.get(targeted_skill, skill_templates["detection_clutter"])

        return {
            "mode": "ADAPTIVE",
            "is_review": is_review,
            "targeted_skill": targeted_skill,
            "targeted_skill_name": SKILL_DISPLAY_NAMES[targeted_skill],
            "current_skill_mastery": p_mastery,
            "expected_success_rate": exp_success,
            "scenario_title": tmpl["title"],
            "threat_type": tmpl["threat_type"],
            "difficulty": difficulty,
            "terrain": tmpl["terrain"],
            "sensor_state": sensor_state,
            "weather": weather,
            "target_count": target_count,
            "coaching_rationale": f"{rationale_prefix} Calibrated for ~{exp_success*100:.0f}% expected success. {tmpl['coaching']}"
        }

    # -------------------------------------------------------------
    # 4. Backward Compatibility Helper (for test_per_skill_adaptive_training)
    # -------------------------------------------------------------
    def evaluate_per_skill_profile(self, events: List[Dict[str, Any]]) -> Dict[str, Any]:
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
            if "detection_latency" in ev:
                lat = ev["detection_latency"]
                score = max(20.0, 100.0 - (lat * 15.0))
                detection_scores.append(score)

            if "true_class" in ev and "trainee_classification" in ev:
                iff_total += 1
                if ev["true_class"] == ev["trainee_classification"]:
                    iff_correct += 1

            if ev.get("is_swarm_trap") or "swarm" in ev.get("action", "") or "merge" in ev.get("action", ""):
                swarm_total += 1
                if ev.get("trap_resolved") or ev.get("action") == "resolve_swarm":
                    swarm_resolved += 1

            if "decision_outcome" in ev or "action" in ev:
                ew_total += 1
                if ev.get("decision_outcome") == "Optimal" or "neutralized" in ev.get("action", ""):
                    ew_correct += 1

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

        weakest_skill = min(skills, key=skills.get)
        weakest_score = skills[weakest_skill]

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

        return {
            "skills": skills,
            "weakest_skill": weakest_skill,
            "weakest_score": weakest_score,
            "prescription": prescriptions.get(weakest_skill, prescriptions["swarm_resolution"])
        }


adaptive_engine = AdaptiveDifficultyEngine()
