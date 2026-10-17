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


adaptive_engine = AdaptiveDifficultyEngine()
