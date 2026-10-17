import os
from typing import List, Dict, Any, Optional
from .base import TrackSource, TargetTelemetry


class AirSimBridgeSource(TrackSource):
    """
    Optional High-Fidelity Bridge to Cosys-AirSim (Unreal Engine 5).
    Safely probes for cosysairsim / airsim Python client and local RPC socket (port 41451).
    When AirSim is unavailable, fails gracefully with informative diagnostic status,
    ensuring standard unit-level offline operation is never compromised.
    """

    def __init__(self, host_ip: str = "127.0.0.1", port: int = 41451):
        self.host_ip = host_ip
        self.port = port
        self.client = None
        self.connected = False
        self.status_message = "Cosys-AirSim bridge inactive. High-Fidelity Unreal Engine 5 mode is optional."

    def is_available(self) -> Dict[str, Any]:
        """Probes environment for airsim / cosysairsim client package and local simulator socket."""
        has_pkg = False
        try:
            import airsim  # type: ignore
            has_pkg = True
        except ImportError:
            try:
                import cosysairsim as airsim  # type: ignore
                has_pkg = True
            except ImportError:
                has_pkg = False

        if not has_pkg:
            return {
                "source_type": "airsim",
                "name": "Cosys-AirSim High-Fidelity Bridge (UE5)",
                "status": "client_not_installed",
                "available": False,
                "description": "Optional Unreal Engine 5 simulation bridge. Python package 'cosysairsim' or 'airsim' not detected.",
                "remedy": "To enable high-fidelity mode in lab environments: install Unreal Engine 5 + Cosys-AirSim and 'pip install cosysairsim'."
            }

        # Check if RPC socket is listening
        import socket
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.5)
        try:
            res = sock.connect_ex((self.host_ip, self.port))
            sock.close()
            if res == 0:
                return {
                    "source_type": "airsim",
                    "name": "Cosys-AirSim High-Fidelity Bridge (UE5)",
                    "status": "ready",
                    "available": True,
                    "description": f"Connected to Unreal Engine Cosys-AirSim instance on {self.host_ip}:{self.port}."
                }
            else:
                return {
                    "source_type": "airsim",
                    "name": "Cosys-AirSim High-Fidelity Bridge (UE5)",
                    "status": "unreal_engine_offline",
                    "available": False,
                    "description": f"Cosys-AirSim package found, but Unreal Engine simulator is not running on {self.host_ip}:{self.port}."
                }
        except Exception as e:
            return {
                "source_type": "airsim",
                "name": "Cosys-AirSim High-Fidelity Bridge (UE5)",
                "status": "socket_error",
                "available": False,
                "description": f"Connection check error: {str(e)}"
            }

    def initialize(self, scenario_config: Dict[str, Any]) -> None:
        avail = self.is_available()
        if not avail["available"]:
            self.connected = False
            self.status_message = avail["description"]
            return

        try:
            import cosysairsim as airsim  # type: ignore
            self.client = airsim.MultirotorClient(ip=self.host_ip)
            self.client.confirmConnection()
            self.connected = True
        except Exception as e:
            self.connected = False
            self.status_message = f"Failed to handshake with Cosys-AirSim: {str(e)}"

    def get_ground_truth(self, elapsed_seconds: float) -> List[TargetTelemetry]:
        """
        Polls ground-truth positions of spawned vehicles via AirSim MultirotorClient.
        Returns empty list if offline.
        """
        if not self.connected or not self.client:
            return []

        results: List[TargetTelemetry] = []
        try:
            # Query spawned drone states in UE5
            drone_names = ["Drone1", "Drone2", "Drone3"]
            for idx, name in enumerate(drone_names):
                state = self.client.getMultirotorState(vehicle_name=name)
                pos = state.kinematics_estimated.position
                vel = state.kinematics_estimated.linear_velocity

                x = float(pos.y_val)  # East
                y = float(pos.x_val)  # North
                alt = float(-pos.z_val)  # Altitude AGL (AirSim NED convention)
                spd = float((vel.x_val**2 + vel.y_val**2 + vel.z_val**2)**0.5)

                import math
                range_m = math.hypot(x, y)
                bearing_deg = (math.degrees(math.atan2(x, y)) + 360) % 360

                results.append(TargetTelemetry(
                    id=f"AIRSIM-{idx+1:02d}",
                    target_class="hostile" if idx == 0 else "civil",
                    model_type=f"UE5 AirSim Mesh {name}",
                    x=round(x, 1),
                    y=round(y, 1),
                    altitude=round(max(5.0, alt), 1),
                    speed=round(spd, 1),
                    heading=0.0,
                    range_m=round(range_m, 1),
                    bearing_deg=round(bearing_deg, 1),
                    rcs_dbsm=-10.0,
                    rf_signature_ghz=2.4,
                    is_active=True,
                    start_time=0.0
                ))
        except Exception:
            pass

        return results
