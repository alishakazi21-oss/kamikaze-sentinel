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

export interface SensorPlot {
  plot_id: string;
  sensor_id: string;
  sensor_type: 'radar' | 'acoustic' | 'camera_eo' | 'camera_thermal' | 'rf';
  timestamp: number;
  bearing_deg: number;
  range_m: number | null;
  x: number | null;
  y: number | null;
  altitude_m: number | null;
  snr_db: number | null;
  detection_probability: number;
  confidence: number;
  is_false_alarm: boolean;
  underlying_target_id: string | null;
  is_merged_swarm: boolean;
  merged_target_count: number;
  metadata?: Record<string, any>;
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
  weather?: 'clear' | 'rain' | 'fog';
  jamming_level?: number;
  sensor_bias_enabled?: boolean;
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
  entropy?: number;
  uncertainty_score?: number;
  is_uncertain?: boolean;
  class_probabilities?: Record<string, number>;
  explanation: string;
  feature_importance: Record<string, number>;
  held_out_model_accuracy?: number;
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
  reason_code?: string;
  confidence_rating?: number;
  cross_checked?: boolean;
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
    calibration_score?: number;
    overconfidence_index?: number;
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
    reason_code?: string;
    confidence_rating?: number;
    cross_checked?: boolean;
    score_points: number;
    ai_followed: boolean;
  }>;
}

export interface SkillProfileItem {
  skill_key: string;
  display_name: string;
  mastery_prob: number;
  mastery_pct: number;
  expected_success_rate: number;
  trials_count: number;
  is_mastered: boolean;
}

export interface ScheduledRetestItem {
  id: number;
  skill_key: string;
  skill_name: string;
  scenario_id: string;
  interval_days: number;
  due_date: string;
  completed: boolean;
  is_due_now: boolean;
}

