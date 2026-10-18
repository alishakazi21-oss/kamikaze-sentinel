from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


class TargetPosition(BaseModel):
    x: float  # meters relative to radar origin (North: +Y, East: +X)
    y: float
    altitude: float  # meters AGL
    speed: float  # m/s
    heading: float  # degrees (0-360)
    range_m: float
    bearing_deg: float


class GroundTruthTarget(BaseModel):
    id: str
    target_class: str  # hostile, friendly, civil, false_alarm
    model_type: str  # e.g., Quadcopter DJI Matrice, Fixed-wing Shahed-136, Pigeon flock
    start_time: float  # seconds when detectable
    position: TargetPosition
    rcs_dbsm: float  # Radar cross-section
    rf_signature_ghz: float  # e.g. 2.4, 5.8
    is_active: bool = True


class SyntheticSensorTrack(BaseModel):
    track_id: str
    timestamp: float
    range_m: float
    bearing_deg: float
    altitude_m: float
    speed_mps: float
    rcs_estimate_dbsm: float
    rf_detected_ghz: Optional[float] = None
    sensor_confidence: float  # 0.0 to 1.0
    visual_signature: Optional[str] = None  # description or thermal tag
    is_clutter: bool = False
    status: str = "tracking"  # tracking, lost, masked


class ScenarioCreateRequest(BaseModel):
    title: Optional[str] = None
    seed: Optional[int] = None
    terrain: str = "urban"  # urban, rural, border, coastal
    time_of_day: str = "day"  # day, dusk, night
    weather: str = "clear"  # clear, rain, fog
    jamming_level: float = 0.0  # 0.0 to 1.0
    sensor_bias_enabled: bool = False
    threat_type: str = "single"  # single, swarm_wedge, swarm_leader, swarm_line, swarm_dispersed, decoy_mixed
    difficulty: int = 1  # 1, 2, 3
    sensor_state: str = "normal"  # normal, degraded, jammed
    sensor_reliability: float = 1.0
    target_count: int = 4
    track_source_type: str = "native"  # native, replay, airsim


class ScenarioResponse(BaseModel):
    id: str
    title: str
    seed: int
    terrain: str
    time_of_day: str
    weather: Optional[str] = "clear"
    jamming_level: Optional[float] = 0.0
    sensor_bias_enabled: Optional[bool] = False
    threat_type: str
    difficulty: int
    sensor_state: str
    sensor_reliability: float
    clutter_density: float
    target_count: int
    track_source_type: str
    target_definitions: List[Dict[str, Any]]
    created_at: datetime


class SessionStartRequest(BaseModel):
    trainee_id: str
    scenario_id: str


class SessionEventRequest(BaseModel):
    target_id: str
    action_type: str  # "detect", "classify", "respond"
    elapsed_seconds: float
    classification: Optional[str] = None
    response: Optional[str] = None
    ai_followed: Optional[bool] = None


class AIAssistRequest(BaseModel):
    speed: float
    altitude: float
    range_m: float
    rcs_estimate: float
    rf_frequency: Optional[float] = None
    time_of_day: str = "day"
    sensor_state: str = "normal"


class AIAssistResponse(BaseModel):
    suggested_class: str
    confidence: float
    entropy: Optional[float] = 0.0
    uncertainty_score: Optional[float] = 0.0
    is_uncertain: Optional[bool] = False
    class_probabilities: Optional[Dict[str, float]] = {}
    explanation: str
    feature_importance: Dict[str, float]
    held_out_model_accuracy: Optional[float] = 88.0


class SessionCompleteRequest(BaseModel):
    duration_seconds: float
    events: List[Dict[str, Any]]
