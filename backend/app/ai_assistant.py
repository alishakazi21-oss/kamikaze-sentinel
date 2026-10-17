import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
from typing import Dict, Any, List, Tuple, Optional


class AIAssistModel:
    """
    Real scikit-learn Machine Learning classifier for Counter-Drone Threat Classification.
    Trained on synthetic radar Doppler features, RCS (dBsm), RF frequencies, and altitude vectors.
    Reports measured held-out test accuracy.
    """

    CLASS_NAMES = ["hostile", "friendly", "civil", "false_alarm"]

    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=60, max_depth=6, random_state=42)
        self.held_out_accuracy: float = 0.0
        self.train_and_evaluate()

    def _generate_training_dataset(self, n_samples: int = 1500) -> Tuple[np.ndarray, np.ndarray]:
        rng = np.random.RandomState(42)
        X = []
        y = []

        for _ in range(n_samples):
            cls_idx = rng.randint(0, 4)
            y.append(cls_idx)

            if cls_idx == 0:  # Hostile (Kamikaze / FPV / Military Loitering)
                spd = rng.normal(26.0, 5.0)
                alt = rng.normal(80.0, 25.0)
                rcs = rng.normal(-10.0, 3.0)
                rf = rng.choice([2.4, 5.8, 0.9])
                rng_m = rng.uniform(500, 3500)
            elif cls_idx == 1:  # Friendly (Military IFF transponder)
                spd = rng.normal(16.0, 3.0)
                alt = rng.normal(140.0, 20.0)
                rcs = rng.normal(-5.0, 2.0)
                rf = rng.choice([1.4, 1.2])  # Secure military datalink
                rng_m = rng.uniform(800, 3200)
            elif cls_idx == 2:  # Civil / Commercial (DJI / Delivery)
                spd = rng.normal(12.0, 3.0)
                alt = rng.normal(60.0, 15.0)
                rcs = rng.normal(-12.0, 2.5)
                rf = rng.choice([2.4, 5.8])
                rng_m = rng.uniform(400, 2500)
            else:  # False alarm / Biological / Clutter
                spd = rng.normal(8.0, 3.5)
                alt = rng.normal(35.0, 20.0)
                rcs = rng.normal(-24.0, 4.0)
                rf = 0.0  # Zero RF emissions
                rng_m = rng.uniform(300, 2200)

            # Features: [speed, altitude, range, rcs, rf]
            X.append([max(1.0, spd), max(5.0, alt), rng_m, rcs, rf])

        return np.array(X), np.array(y)

    def train_and_evaluate(self) -> None:
        X, y = self._generate_training_dataset(1800)
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.25, random_state=42)

        self.model.fit(X_train, y_train)
        y_pred = self.model.predict(X_test)
        self.held_out_accuracy = float(accuracy_score(y_test, y_pred))

    def predict_target(
        self,
        speed: float,
        altitude: float,
        range_m: float,
        rcs_estimate: float,
        rf_frequency: Optional[float] = None,
        time_of_day: str = "day",
        sensor_state: str = "normal"
    ) -> Dict[str, Any]:
        """
        Runs ML inference on observed telemetry to suggest target classification.
        """
        rf_val = rf_frequency if rf_frequency is not None else 0.0
        features = np.array([[speed, altitude, range_m, rcs_estimate, rf_val]])
        probs = self.model.predict_proba(features)[0]

        pred_idx = int(np.argmax(probs))
        suggested_class = self.CLASS_NAMES[pred_idx]
        confidence = float(probs[pred_idx])

        # Rationale construction
        feat_importances = {
            "RCS (Radar Cross Section)": round(float(self.model.feature_importances_[3]), 3),
            "Kinematic Speed (m/s)": round(float(self.model.feature_importances_[0]), 3),
            "RF Datalink Signature": round(float(self.model.feature_importances_[4]), 3),
            "Altitude (m AGL)": round(float(self.model.feature_importances_[1]), 3),
            "Slant Range": round(float(self.model.feature_importances_[2]), 3),
        }

        if suggested_class == "hostile":
            explanation = f"High kinematic velocity ({speed:.1f} m/s) with stealth RCS ({rcs_estimate:.1f} dBsm) matches loitering munition attack profiles."
        elif suggested_class == "friendly":
            explanation = f"Telemetry correlates with friendly transponder frequency ({rf_val:.1f} GHz) and regular patrol flight envelope."
        elif suggested_class == "civil":
            explanation = f"RCS ({rcs_estimate:.1f} dBsm) and standard consumer ISM frequency ({rf_val:.1f} GHz) consistent with commercial quadcopter."
        else:
            explanation = f"Sub-threshold radar cross-section ({rcs_estimate:.1f} dBsm) and non-existent RF emissions indicate avian or ground clutter."

        return {
            "suggested_class": suggested_class,
            "confidence": round(confidence, 2),
            "explanation": explanation,
            "feature_importance": feat_importances,
            "held_out_model_accuracy": round(self.held_out_accuracy * 100, 1)
        }


def generate_data_driven_coaching(session_history: List[Dict[str, Any]]) -> str:
    """
    Performs data-driven failure mode analysis across past trainee sessions
    to diagnose systemic tactical weaknesses (e.g., night optical confusion, swarm panic).
    """
    if not session_history:
        return "Initial baseline session completed. Continue training to establish trend diagnostics."

    night_errors = 0
    night_sessions = 0
    swarm_errors = 0
    swarm_sessions = 0
    degraded_errors = 0
    degraded_sessions = 0
    dangerous_errors_total = 0

    for s in session_history:
        cond = s.get("conditions", {})
        dang = s.get("dangerous_errors", 0)
        acc = s.get("accuracy", 1.0)
        dangerous_errors_total += dang

        if cond.get("time_of_day") == "night":
            night_sessions += 1
            if acc < 0.70 or dang > 0:
                night_errors += 1

        if cond.get("threat_type", "").startswith("swarm_"):
            swarm_sessions += 1
            if acc < 0.70 or dang > 0:
                swarm_errors += 1

        if cond.get("sensor_state") in ["degraded", "jammed"]:
            degraded_sessions += 1
            if acc < 0.70 or dang > 0:
                degraded_errors += 1

    recommendations = []
    if night_sessions > 0 and (night_errors / night_sessions) >= 0.5:
        recommendations.append(
            "Low-Light Vulnerability: High misclassification rate in night scenarios. Do not rely on optical camera; prioritize FLIR thermal motor hotspot differentials."
        )

    if swarm_sessions > 0 and (swarm_errors / swarm_sessions) >= 0.5:
        recommendations.append(
            "Swarm Saturation: Trainee decision latency spikes under multi-drone swarm formations. Prioritize lead apex drone before peripheral wingmen."
        )

    if degraded_sessions > 0 and (degraded_errors / degraded_sessions) >= 0.5:
        recommendations.append(
            "Sensor Jamming Vulnerability: Elevated false-alarm engagement when sensor noise is active. Verify track continuity before authorizing kinetic response."
        )

    if dangerous_errors_total >= 3:
        recommendations.append(
            "Tactical Trigger Discipline: Repeat friendly-fire / civil interception violations recorded. Double check transponder IFF protocol."
        )

    if not recommendations:
        return "Strong tactical execution across environmental conditions. Recommend advancing to Commander difficulty with electronic warfare jamming."

    return " | ".join(recommendations)


# Singleton model instance
ai_assist_instance = AIAssistModel()
