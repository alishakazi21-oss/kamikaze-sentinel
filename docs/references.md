# External References & Conceptual Inspirations

ASTRA VEER (SIH 247) references the following public repositories for architectural study, telemetry interfaces, and kinematics. In accordance with strict software engineering and legal compliance, external code without clear permissive licensing is never copied into this codebase.

## 1. Cosys-Lab/Cosys-AirSim (MIT License)
- **URL**: [https://github.com/cosys-lab/cosys-airsim](https://github.com/cosys-lab/cosys-airsim)
- **Usage**: Reference for the optional High-Fidelity Unreal Engine 5 drone bridge adapter (`backend/app/sources/airsim_bridge.py`). Used for multirotor kinematics and radar echo sensor design patterns.

## 2. Sky-Sim-drone-simulator-3.0 (MIT License)
- **URL**: [https://github.com/vishwagw/Sky-Sim-drone-simulator-3.0](https://github.com/vishwagw/Sky-Sim-drone-simulator-3.0)
- **Usage**: Conceptual reference for seeded benchmark determinism, noise modeling, and reproducible flight vectors.

## 3. drone-swarm-simulation (mac799l)
- **URL**: [https://github.com/mac799l/drone-swarm-simulation](https://github.com/mac799l/drone-swarm-simulation)
- **Usage**: Conceptual study of military swarm formations (Wedge, Leader-Follower, Line, Dispersed). Swarm coordinate geometry implemented independently from scratch in `NativeSimSource`.

## 4. FPV-ONLINE (VVriter)
- **URL**: [https://github.com/VVriter/FPV-ONLINE](https://github.com/VVriter/FPV-ONLINE)
- **Usage**: Tactical inspiration for lightweight low-poly browser 3D rendering. All Three.js shaders and rendering pipelines written from scratch.

## 5. Drone-Simulator (szymon-tulodziecki) (GPL-2.0 Copyleft)
- **URL**: [https://github.com/szymon-tulodziecki/Drone-Simulator](https://github.com/szymon-tulodziecki/Drone-Simulator)
- **Strict Compliance**: Zero code or assets copied to avoid copyleft encumbrance. The UI concept of step-by-step flight trajectory scrubber with distance labels is cleanly implemented in React Canvas for the AAR view.
