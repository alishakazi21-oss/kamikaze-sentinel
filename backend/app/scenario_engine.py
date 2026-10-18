import random
import uuid
from typing import List, Dict, Any, Optional
from .sources.native import NativeSimSource


PRESET_SCENARIOS = [
    {
        "id": "PRESET-01",
        "title": "Operation Trishul: Border Outpost Incursion",
        "seed": 101,
        "terrain": "border",
        "time_of_day": "dusk",
        "weather": "clear",
        "jamming_level": 0.0,
        "sensor_bias_enabled": False,
        "threat_type": "single",
        "difficulty": 1,
        "sensor_state": "normal",
        "sensor_reliability": 0.98,
        "clutter_density": 0.05,
        "target_count": 4,
        "track_source_type": "native",
        "description": "High-altitude mountainous border radar post tracking incoming low-RCS loitering munitions at sunset."
    },
    {
        "id": "PRESET-02",
        "title": "Operation Garud: Urban Metropolis Swarm Breach",
        "seed": 202,
        "terrain": "urban",
        "time_of_day": "day",
        "weather": "fog",
        "jamming_level": 0.2,
        "sensor_bias_enabled": True,
        "threat_type": "swarm_wedge",
        "difficulty": 2,
        "sensor_state": "degraded",
        "sensor_reliability": 0.85,
        "clutter_density": 0.18,
        "target_count": 6,
        "track_source_type": "native",
        "description": "Dense urban airspace with tall structure radar shadowing; coordinated multi-UAV wedge attack against critical infrastructure."
    },
    {
        "id": "PRESET-03",
        "title": "Operation Sagar: Coastal Electronic Jamming Attack",
        "seed": 303,
        "terrain": "coastal",
        "time_of_day": "night",
        "weather": "rain",
        "jamming_level": 0.8,
        "sensor_bias_enabled": True,
        "threat_type": "decoy_mixed",
        "difficulty": 3,
        "sensor_state": "jammed",
        "sensor_reliability": 0.70,
        "clutter_density": 0.32,
        "target_count": 9,
        "track_source_type": "native",
        "description": "Pitch black night combined with shipborne EW radar jamming; sea-skimming drones masked amongst false biological tracks."
    },
    {
        "id": "PRESET-04",
        "title": "Operation Drona: Forward FOB Perimeter Defense",
        "seed": 404,
        "terrain": "rural",
        "time_of_day": "day",
        "weather": "clear",
        "jamming_level": 0.0,
        "sensor_bias_enabled": False,
        "threat_type": "swarm_leader",
        "difficulty": 2,
        "sensor_state": "normal",
        "sensor_reliability": 0.95,
        "clutter_density": 0.10,
        "target_count": 5,
        "track_source_type": "native",
        "description": "Echelon column swarm formation testing rapid sequential designation and friendly IFF filtering."
    }
]


class ScenarioEngine:
    """
    Handles scripted preset scenarios and seeded procedural scenario generation.
    Guarantees deterministic target paths for identical seeds.
    """

    @staticmethod
    def get_presets() -> List[Dict[str, Any]]:
        return PRESET_SCENARIOS

    @staticmethod
    def generate_scenario(
        title: Optional[str] = None,
        seed: Optional[int] = None,
        terrain: str = "urban",
        time_of_day: str = "day",
        weather: str = "clear",
        jamming_level: float = 0.0,
        sensor_bias_enabled: bool = False,
        threat_type: str = "single",
        difficulty: int = 1,
        sensor_state: str = "normal",
        sensor_reliability: float = 1.0,
        target_count: int = 4,
        track_source_type: str = "native"
    ) -> Dict[str, Any]:
        actual_seed = seed if seed is not None else random.randint(1000, 999999)
        scenario_id = f"SCN-{uuid.uuid4().hex[:8].upper()}"

        # Initialize native sim source with this seed to generate deterministic target definitions
        sim = NativeSimSource(seed=actual_seed)
        sim_config = {
            "seed": actual_seed,
            "threat_type": threat_type,
            "target_count": target_count,
            "difficulty": difficulty
        }
        sim.initialize(sim_config)

        # Retrieve target definitions
        target_defs = sim.targets

        # Clutter density by terrain
        clutter_density = 0.05
        if terrain == "urban":
            clutter_density = 0.20
        elif terrain == "coastal":
            clutter_density = 0.12
        elif terrain == "border":
            clutter_density = 0.08

        if sensor_state == "jammed" or jamming_level > 0.4:
            clutter_density += 0.15
        elif sensor_state == "degraded" or jamming_level > 0.1:
            clutter_density += 0.08

        scenario_name = title or f"Custom Tactical Drill: {threat_type.upper().replace('_', ' ')} in {terrain.title()}"

        return {
            "id": scenario_id,
            "title": scenario_name,
            "seed": actual_seed,
            "terrain": terrain,
            "time_of_day": time_of_day,
            "weather": weather,
            "jamming_level": jamming_level,
            "sensor_bias_enabled": sensor_bias_enabled,
            "threat_type": threat_type,
            "difficulty": difficulty,
            "sensor_state": sensor_state,
            "sensor_reliability": sensor_reliability,
            "clutter_density": round(clutter_density, 2),
            "target_count": len(target_defs),
            "track_source_type": track_source_type,
            "target_definitions": target_defs
        }
