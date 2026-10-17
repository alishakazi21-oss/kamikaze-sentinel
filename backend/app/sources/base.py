from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class TargetTelemetry(BaseModel):
    id: str
    target_class: str  # hostile, friendly, civil, false_alarm
    model_type: str
    x: float  # meters (East: +X)
    y: float  # meters (North: +Y)
    altitude: float  # meters AGL
    speed: float  # m/s
    heading: float  # degrees (0-360)
    range_m: float
    bearing_deg: float
    rcs_dbsm: float
    rf_signature_ghz: float
    is_active: bool
    start_time: float


class TrackSource(ABC):
    """
    Abstract interface for all drone telemetry providers.
    Scoring and AAR interact exclusively with this abstraction,
    ensuring decoupled execution across NativeSim, Replay, and AirSimBridge.
    """

    @abstractmethod
    def initialize(self, scenario_config: Dict[str, Any]) -> None:
        """Initialize simulation environment or replay state with scenario params."""
        pass

    @abstractmethod
    def get_ground_truth(self, elapsed_seconds: float) -> List[TargetTelemetry]:
        """Return ground-truth state of all targets at given simulation time."""
        pass

    @abstractmethod
    def is_available(self) -> Dict[str, Any]:
        """Return source health, status, and availability descriptor."""
        pass
