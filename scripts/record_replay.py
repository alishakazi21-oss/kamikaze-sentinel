import os
import sys
import json
import argparse

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.app.sources.native import NativeSimSource


def record_scenario_to_replay(
    output_path: str,
    threat_type: str = "swarm_wedge",
    target_count: int = 5,
    seed: int = 999,
    duration_seconds: float = 60.0,
    sample_rate_hz: float = 1.0
):
    print(f"[*] Recording flight trajectory for '{threat_type}' (seed: {seed})...")
    sim = NativeSimSource(seed=seed)
    sim.initialize({
        "seed": seed,
        "threat_type": threat_type,
        "target_count": target_count,
        "difficulty": 2
    })

    timestamps = []
    t = 0.0
    while t <= duration_seconds:
        timestamps.append(round(t, 2))
        t += 1.0 / sample_rate_hz

    # Collect keyframes per target
    targets_map = {}
    for tgt in sim.targets:
        targets_map[tgt["id"]] = {
            "id": tgt["id"],
            "target_class": tgt["target_class"],
            "model_type": tgt["model_type"],
            "start_time": tgt["start_time"],
            "rcs_dbsm": tgt["rcs_dbsm"],
            "rf_signature_ghz": tgt["rf_signature_ghz"],
            "keyframes": []
        }

    for t_step in timestamps:
        tracks = sim.get_ground_truth(t_step)
        for trk in tracks:
            if trk.id in targets_map:
                targets_map[trk.id]["keyframes"].append({
                    "t": t_step,
                    "x": trk.x,
                    "y": trk.y,
                    "alt": trk.altitude,
                    "spd": trk.speed,
                    "hdg": trk.heading
                })

    replay_payload = {
        "mission_id": f"REC-{threat_type.upper()}-{seed}",
        "recorded_from": "ASTRA VEER Native Sim Flight Recorder",
        "threat_type": threat_type,
        "duration_seconds": duration_seconds,
        "targets": list(targets_map.values())
    }

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(replay_payload, f, indent=2)

    print(f"[+] Replay mission recorded successfully to: {output_path} ({len(replay_payload['targets'])} targets)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Record synthetic or simulated drone trajectories to replay JSON")
    parser.add_argument("--output", default="backend/data/sample_replay_mission.json", help="Destination JSON path")
    parser.add_argument("--threat", default="swarm_wedge", help="Formation / Threat type")
    parser.add_argument("--count", type=int, default=5, help="Target count")
    parser.add_argument("--seed", type=int, default=999, help="Random seed")
    parser.add_argument("--duration", type=float, default=60.0, help="Duration in seconds")
    args = parser.parse_args()

    record_scenario_to_replay(
        output_path=args.output,
        threat_type=args.threat,
        target_count=args.count,
        seed=args.seed,
        duration_seconds=args.duration
    )
