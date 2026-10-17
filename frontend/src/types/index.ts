export type TargetClass = 'hostile' | 'friendly' | 'civil' | 'false_alarm';

export type ResponseOption =
  | 'continue_monitoring'
  | 'request_verification'
  | 'raise_alert'
  | 'authorise_protective_response';

export interface SyntheticTrack {
  track_id: string;
  timestamp: float;
  x: number;
  y: number;
  range_m: number;
  bearing_deg: number;
  altitude_m: number;
  speed_mps: number;
  heading_deg: number;
  rcs_estimate_dbsm: number;
  rf_detected_ghz: number | null;
  sensor_confidence: number;
  visual_signature: string;
  thermal_signature: string;
  is_clutter: boolean;
  status: 'tracking' | 'degraded' | 'masked';
  underlying_target_id: string | null;
}

type float = number;

export interface TargetDefinition {
  id: string;
  target_class: TargetClass;
  model_type: string;
  start_time: number;
  start_x: number;
  start_y: number;
  heading_deg: number;
  speed_mps: number;
  altitude_m: number;
  rcs_dbsm: number;
  rf_signature_ghz: number;
  maneuver_style?: string;
}

export interface Scenario {
  id: string;
  title: string;
  seed: number;
  terrain: 'urban' | 'rural' | 'border' | 'coastal';
  time_of_day: 'day' | 'dusk' | 'night';
  threat_type: string;
  difficulty: number;
  sensor_state: 'normal' | 'degraded' | 'jammed';
  sensor_reliability: number;
  clutter_density: number;
  target_count: number;
  track_source_type: string;
  target_definitions?: TargetDefinition[];
}

export interface TraineeProfile {
  id: string;
  unit_id: string;
  callsign: string;
  rank: string;
  current_difficulty: number;
}

export interface UnitProfile {
  id: string;
  name: string;
  base_location: string;
}

export interface AIAssistResult {
  suggested_class: TargetClass;
  confidence: number;
  explanation: string;
  feature_importance: Record<string, number>;
}

export interface TargetScoreDetail {
  target_id: string;
  true_class: TargetClass;
  detected: boolean;
  detection_latency: number;
  detection_score_pts: number;
  classified: boolean;
  trainee_classification: string;
  classification_correct: boolean;
  classification_score_pts: number;
  responded: boolean;
  trainee_response: string;
  decision_outcome: 'Optimal' | 'Acceptable' | 'Over-reaction' | 'Under-reaction' | 'Dangerous error';
  decision_score_pts: number;
  decision_path: string;
  ai_suggested_class: string;
  ai_followed: boolean;
  ai_agreed: boolean;
}

export interface AARReport {
  session_id: string;
  trainee: {
    id: string;
    callsign: string;
    rank: string;
    unit: string;
    current_difficulty: number;
  };
  scenario: Scenario;
  duration_seconds: number;
  score: {
    total_score: number;
    detection_score: number;
    classification_score: number;
    decision_score: number;
    avg_detection_latency: number;
    classification_accuracy: number;
    optimal_decisions_pct: number;
    dangerous_errors_count: number;
    missed_detections_count: number;
    ai_assist_agreement_pct: number;
    coach_feedback: string;
  };
  ai_coaching_analysis: string;
  difficulty_change_reason: string;
  target_events: Array<{
    target_id: string;
    true_class: TargetClass;
    detected_at: number;
    trainee_classification: string;
    trainee_response: string;
    decision_outcome: string;
    decision_path: string;
    score_points: number;
    ai_followed: boolean;
  }>;
}
