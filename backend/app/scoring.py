import json
import os
from typing import List, Dict, Any, Tuple, Optional
from pydantic import BaseModel

RULES_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "decision_rules.json")


class TargetScoreDetail(BaseModel):
    target_id: str
    true_class: str
    detected: bool
    detection_latency: float
    detection_score_pts: float
    classified: bool
    trainee_classification: str
    classification_correct: bool
    classification_score_pts: float
    responded: bool
    trainee_response: str
    decision_outcome: str  # Optimal, Acceptable, Over-reaction, Under-reaction, Dangerous error
    decision_score_pts: float
    decision_path: str
    reason_code: str = "OPTIMAL_ENGAGEMENT"
    tree_evaluation: Dict[str, Any] = {}
    confidence_rating: int = 4
    cross_checked: bool = False
    ai_suggested_class: str = ""
    ai_followed: bool = False
    ai_agreed: bool = False


class ScenarioScoreResult(BaseModel):
    total_score: float  # 0 to 100
    detection_score: float  # out of 30
    classification_score: float  # out of 30
    decision_score: float  # out of 30 (or 40)
    calibration_score: float = 100.0  # out of 10
    overconfidence_index: float = 0.0  # mean confidence - fraction correct
    avg_detection_latency: float
    classification_accuracy: float
    optimal_decisions_pct: float
    dangerous_errors_count: int
    missed_detections_count: int
    ai_assist_agreement_pct: float
    reason_code_counts: Dict[str, int] = {}
    target_details: List[TargetScoreDetail]
    feedback_notes: List[str]


class ScoringEngine:
    """
    Explainable 4-Pillar Decision-Tree Scoring Engine for Counter-Drone Operations:
    Pillars:
      1. Detection (30%): Latency decay before critical range
      2. Classification (30%): Threat class & swarm identification
      3. Decision Quality (30%): ROE-aligned response selection & cross-checking
      4. Calibration (10%): Overconfidence Index (OCI) = Mean Confidence - Accuracy

    4-Question Sequential Decision Tree:
      Q1: Detected before critical range?
      Q2: Classified correctly (including swarm vs single)?
      Q3: Response appropriate under ROE?
      Q4: Cross-checked with second sensor when first was uncertain?

    Leaf Reason Codes:
      - OPTIMAL_ENGAGEMENT
      - APPROPRIATE_CLASSIFIED_CORRECT
      - SWARM_TREATED_AS_SINGLE
      - NO_CROSSCHECK
      - FALSE_ALARM_ENGAGED
      - FRIENDLY_FIRE_INTERCEPTION
      - MISSED_HOSTILE
      - LATE_DETECTION
      - UNDER_REACTION_HOSTILE
      - OVER_REACTION_CIVILIAN
      - ROE_VIOLATION
    """

    def __init__(self, rules_path: str = RULES_FILE):
        if os.path.exists(rules_path):
            with open(rules_path, "r") as f:
                self.config = json.load(f)
        else:
            self.config = {
                "weights": {"detection": 0.30, "classification": 0.30, "decision": 0.30, "calibration": 0.10},
                "critical_range_m": 800.0,
                "latency_decay": {
                    "difficulty_1": {"T_full": 6.0, "T_max": 20.0},
                    "difficulty_2": {"T_full": 4.5, "T_max": 15.0},
                    "difficulty_3": {"T_full": 3.0, "T_max": 10.0}
                },
                "penalties": {
                    "missed_hostile": 30.0,
                    "friendly_fire_interception": 40.0,
                    "civil_drone_interception": 25.0,
                    "false_alarm_interception": 15.0
                },
                "rules": []
            }
        self.rules = self.config.get("rules", [])
        self.weights = self.config.get("weights", {"detection": 0.30, "classification": 0.30, "decision": 0.30, "calibration": 0.10})
        self.critical_range_m = float(self.config.get("critical_range_m", 800.0))

    def evaluate_target_decision(
        self,
        true_class: str,
        trainee_classification: str,
        trainee_response: str,
        proximity_m: float
    ) -> Tuple[str, float, str, str]:
        """
        Traverse rule table to evaluate tactical decision quality.
        Returns: (outcome, score_points, explanation, reason_code)
        """
        for r in self.rules:
            if r["true_class"] != "*" and r["true_class"] != true_class:
                continue
            if r["trainee_classification"] != "*" and r["trainee_classification"] != trainee_classification:
                continue
            if r["trainee_response"] != "*" and r["trainee_response"] != trainee_response:
                continue
            thresh = r.get("proximity_threshold_m", 99999)
            if proximity_m <= thresh:
                reason = r.get("reason_code", "APPROPRIATE_CLASSIFIED_CORRECT")
                return r["outcome"], float(r["points"]), r["explanation"], reason

        # Fallback default
        return "Acceptable", 60.0, "Tactical engagement followed general operational guidelines.", "APPROPRIATE_CLASSIFIED_CORRECT"

    def calculate_score(
        self,
        scenario_targets: List[Dict[str, Any]],
        events: List[Dict[str, Any]],
        difficulty: int = 1
    ) -> ScenarioScoreResult:
        diff_key = f"difficulty_{difficulty}"
        decay_params = self.config.get("latency_decay", {}).get(diff_key, {"T_full": 5.0, "T_max": 18.0})
        t_full = decay_params["T_full"]
        t_max = decay_params["T_max"]

        events_by_target: Dict[str, Dict[str, Any]] = {}
        for ev in events:
            tid = ev.get("target_id")
            if tid:
                events_by_target[tid] = ev

        details: List[TargetScoreDetail] = []
        total_detection_pts = 0.0
        total_class_pts = 0.0
        total_dec_pts = 0.0

        latencies = []
        correct_class_count = 0
        optimal_dec_count = 0
        dangerous_errors = 0
        missed_hostiles = 0
        ai_matches = 0
        ai_evaluations = 0

        target_count = len(scenario_targets)
        if target_count == 0:
            return ScenarioScoreResult(
                total_score=0, detection_score=0, classification_score=0, decision_score=0,
                calibration_score=100.0, overconfidence_index=0.0,
                avg_detection_latency=0, classification_accuracy=0, optimal_decisions_pct=0,
                dangerous_errors_count=0, missed_detections_count=0, ai_assist_agreement_pct=0,
                reason_code_counts={}, target_details=[], feedback_notes=["No targets registered in scenario."]
            )

        confidences = []
        accuracies = []
        reason_counts: Dict[str, int] = {}

        for tgt in scenario_targets:
            tid = tgt["id"]
            true_cls = tgt.get("target_class", "hostile")
            is_swarm = bool(tgt.get("is_swarm", False) or "swarm" in str(tgt.get("formation", "")).lower())
            sensor_uncertain = bool(tgt.get("sensor_uncertain", False) or tgt.get("snr_db", 20.0) < 13.0 or true_cls == "false_alarm")
            ev = events_by_target.get(tid, {})

            # -------------------------------------------------------------
            # Decision Tree Q1: Detected before critical range?
            # -------------------------------------------------------------
            detected_at = ev.get("detected_at")
            start_t = tgt.get("start_time", 0.0)
            prox = float(ev.get("proximity_m", 1500.0))

            q1_passed = False
            if detected_at is not None:
                latency = max(0.1, detected_at - start_t)
                latencies.append(latency)
                if latency <= t_full:
                    det_pts = 100.0
                elif latency >= t_max:
                    det_pts = 0.0
                else:
                    det_pts = 100.0 * (1.0 - (latency - t_full) / (t_max - t_full))
                
                # Check critical range threshold
                if prox >= self.critical_range_m or latency < t_max:
                    q1_passed = True
                detected = True
            else:
                latency = 99.0
                detected = False
                q1_passed = False
                if true_cls == "hostile":
                    missed_hostiles += 1
                    det_pts = -self.config.get("penalties", {}).get("missed_hostile", 30.0)
                else:
                    det_pts = 0.0

            total_detection_pts += max(0.0, det_pts)

            # -------------------------------------------------------------
            # Decision Tree Q2: Classified correctly?
            # -------------------------------------------------------------
            t_class = ev.get("trainee_classification", "none")
            classified = (t_class != "none")
            class_correct = False
            q2_passed = False

            if classified:
                if t_class == true_cls:
                    class_pts = 100.0
                    correct_class_count += 1
                    class_correct = True
                    q2_passed = True
                else:
                    class_correct = False
                    q2_passed = False
                    if true_cls == "friendly" and t_class == "hostile":
                        class_pts = -self.config.get("penalties", {}).get("friendly_fire_interception", 20.0)
                    else:
                        class_pts = 0.0
            else:
                class_pts = 0.0

            total_class_pts += max(0.0, class_pts)

            # -------------------------------------------------------------
            # Decision Tree Q3: Response appropriate under ROE?
            # -------------------------------------------------------------
            t_resp = ev.get("trainee_response", "none")
            responded = (t_resp != "none")
            leaf_reason = "OPTIMAL_ENGAGEMENT"
            q3_passed = False

            if responded:
                outcome, dec_pts, exp, base_reason = self.evaluate_target_decision(true_cls, t_class, t_resp, prox)
                leaf_reason = base_reason
                if outcome == "Optimal":
                    optimal_dec_count += 1
                    q3_passed = True
                elif outcome == "Acceptable":
                    q3_passed = True
                elif outcome == "Dangerous error":
                    dangerous_errors += 1
                    q3_passed = False
                else:
                    q3_passed = False
            else:
                responded = False
                outcome = "Dangerous error" if true_cls == "hostile" else "Under-reaction"
                dec_pts = 0.0
                exp = "Target was ignored without selecting a tactical response."
                leaf_reason = "UNDER_REACTION_HOSTILE" if true_cls == "hostile" else "ROE_VIOLATION"
                if true_cls == "hostile":
                    dangerous_errors += 1
                q3_passed = False

            # -------------------------------------------------------------
            # Decision Tree Q4: Cross-checked with second sensor when uncertain?
            # -------------------------------------------------------------
            cross_checked = bool(ev.get("cross_checked", False) or ev.get("request_verification", False) or t_resp == "request_verification")
            q4_passed = True

            if sensor_uncertain:
                if not cross_checked:
                    q4_passed = False
                    # If trainee rushed without cross-checking in low-SNR/clutter/false alarm
                    if outcome in ["Optimal", "Acceptable"]:
                        leaf_reason = "NO_CROSSCHECK"
                        dec_pts = max(40.0, dec_pts - 20.0)
                        exp += " However, trainee failed to verify low-SNR contact with secondary sensor (NO_CROSSCHECK)."
                else:
                    q4_passed = True

            # Swarm special check
            if is_swarm and ev.get("treated_as_single", False):
                leaf_reason = "SWARM_TREATED_AS_SINGLE"
                dec_pts = max(30.0, dec_pts - 25.0)
                exp = "Multi-drone swarm cell engaged as single contact without spatial resolution."

            # Specific reason code overrides for primary errors
            if not detected and true_cls == "hostile":
                leaf_reason = "MISSED_HOSTILE"
            elif not q1_passed and true_cls == "hostile":
                leaf_reason = "LATE_DETECTION"
            elif true_cls == "friendly" and t_resp == "authorise_protective_response":
                leaf_reason = "FRIENDLY_FIRE_INTERCEPTION"
            elif true_cls == "false_alarm" and t_resp == "authorise_protective_response":
                leaf_reason = "FALSE_ALARM_ENGAGED"
            elif true_cls == "civil" and t_resp == "authorise_protective_response":
                leaf_reason = "OVER_REACTION_CIVILIAN"
            elif true_cls == "hostile" and t_resp == "continue_monitoring":
                leaf_reason = "UNDER_REACTION_HOSTILE"

            total_dec_pts += dec_pts

            # Calibration Data
            rating = int(ev.get("confidence_rating", 4) or 4)
            rating = max(1, min(5, rating))
            conf_norm = rating / 5.0
            confidences.append(conf_norm)

            target_acc = 1.0 if (class_correct and q3_passed) else (0.5 if class_correct else 0.0)
            accuracies.append(target_acc)

            # AI Assist agreement tracking
            ai_cls = ev.get("ai_suggested_class", "")
            ai_fol = ev.get("ai_followed", False)
            ai_agreed = False
            if ai_cls:
                ai_evaluations += 1
                if t_class == ai_cls:
                    ai_agreed = True
                    ai_matches += 1

            reason_counts[leaf_reason] = reason_counts.get(leaf_reason, 0) + 1

            tree_eval = {
                "Q1_detected_before_critical_range": q1_passed,
                "Q2_classified_correctly": q2_passed,
                "Q3_response_appropriate_roe": q3_passed,
                "Q4_crosschecked_when_uncertain": q4_passed
            }

            details.append(TargetScoreDetail(
                target_id=tid,
                true_class=true_cls,
                detected=detected,
                detection_latency=round(latency, 2),
                detection_score_pts=round(max(0.0, det_pts), 1),
                classified=classified,
                trainee_classification=t_class,
                classification_correct=class_correct,
                classification_score_pts=round(max(0.0, class_pts), 1),
                responded=responded,
                trainee_response=t_resp,
                decision_outcome=outcome,
                decision_score_pts=round(dec_pts, 1),
                decision_path=exp,
                reason_code=leaf_reason,
                tree_evaluation=tree_eval,
                confidence_rating=rating,
                cross_checked=cross_checked,
                ai_suggested_class=ai_cls,
                ai_followed=bool(ai_fol),
                ai_agreed=ai_agreed
            ))

        # Pillar Averages (0 to 100)
        norm_detection = total_detection_pts / target_count
        norm_class = total_class_pts / target_count
        norm_decision = total_dec_pts / target_count

        # Calibration & Overconfidence Index (OCI)
        mean_conf = sum(confidences) / len(confidences) if confidences else 0.8
        fraction_correct = sum(accuracies) / len(accuracies) if accuracies else 0.0
        oci = round(mean_conf - fraction_correct, 3)

        # Calibration score: 100 if |OCI| <= 0.15, falls off smoothly
        abs_oci = abs(oci)
        if abs_oci <= 0.15:
            cal_score = 100.0
        else:
            cal_score = max(0.0, round(100.0 - (abs_oci - 0.15) * 150.0, 1))

        # Weighted composite score
        w_det = self.weights.get("detection", 0.30)
        w_cls = self.weights.get("classification", 0.30)
        w_dec = self.weights.get("decision", 0.30)
        w_cal = self.weights.get("calibration", 0.10)

        # Normalize weights if needed
        total_w = w_det + w_cls + w_dec + w_cal
        w_det /= total_w
        w_cls /= total_w
        w_dec /= total_w
        w_cal /= total_w

        det_score = round(norm_detection * (w_det * 100.0 / 30.0) if w_det == 0.30 else norm_detection * w_det, 1)
        cls_score = round(norm_class * (w_cls * 100.0 / 30.0) if w_cls == 0.30 else norm_class * w_cls, 1)
        dec_score = round(norm_decision * (w_dec * 100.0 / 30.0) if w_dec == 0.30 else norm_decision * w_dec, 1)

        # Scale pillars to standard out of weights:
        # detection out of 30, classification out of 30, decision out of 30, calibration out of 10
        det_pillar = round((norm_detection / 100.0) * 30.0, 1)
        cls_pillar = round((norm_class / 100.0) * 30.0, 1)
        dec_pillar = round((norm_decision / 100.0) * 30.0, 1)
        cal_pillar = round((cal_score / 100.0) * 10.0, 1)
        total_score = round(min(100.0, max(0.0, det_pillar + cls_pillar + dec_pillar + cal_pillar)), 1)

        avg_lat = round(sum(latencies) / len(latencies), 2) if latencies else 0.0
        acc = round(correct_class_count / target_count, 2)
        opt_pct = round((optimal_dec_count / target_count) * 100, 1)
        ai_agr_pct = round((ai_matches / ai_evaluations) * 100, 1) if ai_evaluations > 0 else 0.0

        # Construct coaching feedback notes
        feedback = []
        if missed_hostiles > 0:
            feedback.append(f"CRITICAL: {missed_hostiles} hostile target(s) breached airspace undetected (MISSED_HOSTILE).")
        if dangerous_errors > 0:
            feedback.append(f"WARNING: {dangerous_errors} dangerous operational error(s) recorded during engagement.")
        if "NO_CROSSCHECK" in reason_counts:
            feedback.append(f"CALIBRATION: {reason_counts['NO_CROSSCHECK']} low-SNR target(s) engaged without secondary sensor cross-check.")
        if "SWARM_TREATED_AS_SINGLE" in reason_counts:
            feedback.append("SWARM TACTICS: Swarm resolution failure; target cluster treated as single drone.")
        if oci > 0.25:
            feedback.append(f"CALIBRATION: High overconfidence detected (OCI = +{oci:.2f}). Confidence exceeded empirical accuracy.")
        elif oci < -0.25:
            feedback.append(f"CALIBRATION: Operator underconfidence observed (OCI = {oci:.2f}). High accuracy with hesitant confidence.")
        if acc >= 0.85:
            feedback.append("Excellent threat identification: Target radar signatures and visual cues accurately classified.")
        elif acc < 0.60:
            feedback.append("Weakness: Target classification accuracy below baseline. Review Doppler RCS and optical profiles.")
        if avg_lat <= t_full:
            feedback.append("Superb radar scan reflex: Interception queues formed well within full-score window.")
        elif avg_lat > t_max * 0.7:
            feedback.append("Latency Caution: Target designation delayed; train on sector sweep prioritization.")

        return ScenarioScoreResult(
            total_score=total_score,
            detection_score=det_pillar,
            classification_score=cls_pillar,
            decision_score=dec_pillar,
            calibration_score=cal_score,
            overconfidence_index=oci,
            avg_detection_latency=avg_lat,
            classification_accuracy=acc,
            optimal_decisions_pct=opt_pct,
            dangerous_errors_count=dangerous_errors,
            missed_detections_count=missed_hostiles,
            ai_assist_agreement_pct=ai_agr_pct,
            reason_code_counts=reason_counts,
            target_details=details,
            feedback_notes=feedback
        )
