import json
import os
from typing import List, Dict, Any, Tuple
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
    ai_suggested_class: str = ""
    ai_followed: bool = False
    ai_agreed: bool = False


class ScenarioScoreResult(BaseModel):
    total_score: float  # 0 to 100
    detection_score: float  # out of 30
    classification_score: float  # out of 30
    decision_score: float  # out of 40
    avg_detection_latency: float
    classification_accuracy: float
    optimal_decisions_pct: float
    dangerous_errors_count: int
    missed_detections_count: int
    ai_assist_agreement_pct: float
    target_details: List[TargetScoreDetail]
    feedback_notes: List[str]


class ScoringEngine:
    """
    3-Pillar Decision-Tree Scoring Engine for Counter-Drone Operations:
    1. Detection Latency (T_full -> T_max decay curve)
    2. Classification Accuracy & Threat Identification
    3. Tactical Decision Quality (Rule-based tree traversal)
    """

    def __init__(self, rules_path: str = RULES_FILE):
        if os.path.exists(rules_path):
            with open(rules_path, "r") as f:
                self.config = json.load(f)
        else:
            self.config = {
                "weights": {"detection": 0.30, "classification": 0.30, "decision": 0.40},
                "latency_decay": {
                    "difficulty_1": {"T_full": 6.0, "T_max": 20.0},
                    "difficulty_2": {"T_full": 4.5, "T_max": 15.0},
                    "difficulty_3": {"T_full": 3.0, "T_max": 10.0}
                },
                "penalties": {"missed_hostile": 30.0, "friendly_fire_interception": 40.0},
                "rules": []
            }
        self.rules = self.config.get("rules", [])
        self.weights = self.config.get("weights", {"detection": 0.30, "classification": 0.30, "decision": 0.40})

    def evaluate_target_decision(
        self,
        true_class: str,
        trainee_classification: str,
        trainee_response: str,
        proximity_m: float
    ) -> Tuple[str, float, str]:
        """
        Traverse rule table to evaluate decision quality and return (outcome, score_points, explanation).
        """
        for r in self.rules:
            # Match true_class
            if r["true_class"] != "*" and r["true_class"] != true_class:
                continue
            # Match trainee_classification
            if r["trainee_classification"] != "*" and r["trainee_classification"] != trainee_classification:
                continue
            # Match trainee_response
            if r["trainee_response"] != "*" and r["trainee_response"] != trainee_response:
                continue
            # Match proximity threshold
            thresh = r.get("proximity_threshold_m", 99999)
            if proximity_m <= thresh:
                return r["outcome"], float(r["points"]), r["explanation"]

        # Default fallback
        return "Acceptable", 60.0, "Tactical engagement followed general operational guidelines."

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

        # Map events by target_id
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
                avg_detection_latency=0, classification_accuracy=0, optimal_decisions_pct=0,
                dangerous_errors_count=0, missed_detections_count=0, ai_assist_agreement_pct=0,
                target_details=[], feedback_notes=["No targets registered in scenario."]
            )

        for tgt in scenario_targets:
            tid = tgt["id"]
            true_cls = tgt["target_class"]
            ev = events_by_target.get(tid, {})

            # 1. Detection scoring
            detected_at = ev.get("detected_at")
            start_t = tgt.get("start_time", 0.0)
            if detected_at is not None:
                latency = max(0.1, detected_at - start_t)
                latencies.append(latency)
                if latency <= t_full:
                    det_pts = 100.0
                elif latency >= t_max:
                    det_pts = 0.0
                else:
                    det_pts = 100.0 * (1.0 - (latency - t_full) / (t_max - t_full))
                detected = True
            else:
                latency = 99.0
                detected = False
                if true_cls == "hostile":
                    missed_hostiles += 1
                    det_pts = -self.config.get("penalties", {}).get("missed_hostile", 30.0)
                else:
                    det_pts = 0.0

            total_detection_pts += max(0.0, det_pts)

            # 2. Classification scoring
            t_class = ev.get("trainee_classification", "none")
            if t_class != "none":
                classified = True
                if t_class == true_cls:
                    class_pts = 100.0
                    correct_class_count += 1
                    class_correct = True
                else:
                    class_correct = False
                    if true_cls == "friendly" and t_class == "hostile":
                        class_pts = -self.config.get("penalties", {}).get("friendly_fire_interception", 20.0)
                    else:
                        class_pts = 0.0
            else:
                classified = False
                class_correct = False
                class_pts = 0.0

            total_class_pts += max(0.0, class_pts)

            # 3. Decision Quality
            t_resp = ev.get("trainee_response", "none")
            prox = ev.get("proximity_m", 1500.0)
            if t_resp != "none":
                responded = True
                outcome, dec_pts, exp = self.evaluate_target_decision(true_cls, t_class, t_resp, prox)
                if outcome == "Optimal":
                    optimal_dec_count += 1
                elif outcome == "Dangerous error":
                    dangerous_errors += 1
            else:
                responded = False
                outcome = "Dangerous error" if true_cls == "hostile" else "Under-reaction"
                dec_pts = 0.0
                exp = "Target was ignored without selecting a tactical response."
                if true_cls == "hostile":
                    dangerous_errors += 1

            total_dec_pts += dec_pts

            # AI Assist agreement tracking
            ai_cls = ev.get("ai_suggested_class", "")
            ai_fol = ev.get("ai_followed", False)
            ai_agreed = False
            if ai_cls:
                ai_evaluations += 1
                if t_class == ai_cls:
                    ai_agreed = True
                    ai_matches += 1

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
                ai_suggested_class=ai_cls,
                ai_followed=bool(ai_fol),
                ai_agreed=ai_agreed
            ))

        # Pillar Averages (0 to 100)
        norm_detection = total_detection_pts / target_count
        norm_class = total_class_pts / target_count
        norm_decision = total_dec_pts / target_count

        # Weighted composite score
        w_det = self.weights.get("detection", 0.30)
        w_cls = self.weights.get("classification", 0.30)
        w_dec = self.weights.get("decision", 0.40)

        det_score = round(norm_detection * w_det, 1)
        cls_score = round(norm_class * w_cls, 1)
        dec_score = round(norm_decision * w_dec, 1)
        total_score = round(min(100.0, max(0.0, det_score + cls_score + dec_score)), 1)

        avg_lat = round(sum(latencies) / len(latencies), 2) if latencies else 0.0
        acc = round(correct_class_count / target_count, 2)
        opt_pct = round((optimal_dec_count / target_count) * 100, 1)
        ai_agr_pct = round((ai_matches / ai_evaluations) * 100, 1) if ai_evaluations > 0 else 0.0

        # Construct coaching feedback notes
        feedback = []
        if missed_hostiles > 0:
            feedback.append(f"CRITICAL: {missed_hostiles} hostile target(s) breached airspace undetected.")
        if dangerous_errors > 0:
            feedback.append(f"WARNING: {dangerous_errors} dangerous operational error(s) recorded during engagement.")
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
            detection_score=det_score,
            classification_score=cls_score,
            decision_score=dec_score,
            avg_detection_latency=avg_lat,
            classification_accuracy=acc,
            optimal_decisions_pct=opt_pct,
            dangerous_errors_count=dangerous_errors,
            missed_detections_count=missed_hostiles,
            ai_assist_agreement_pct=ai_agr_pct,
            target_details=details,
            feedback_notes=feedback
        )
