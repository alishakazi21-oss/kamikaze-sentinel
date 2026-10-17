# THIRD PARTY NOTICES AND CITATIONS

ASTRA VEER (AI-Enabled Drone & Counter-Drone Threat Simulation Trainer - SIH 247) utilizes and references several open-source concepts, architectures, and libraries. In compliance with open-source licensing principles, the following notices apply:

---

## 1. Reference Repositories Assessment & Attributions

### A. Cosys-Lab/Cosys-AirSim
- **Repository**: [https://github.com/cosys-lab/cosys-airsim](https://github.com/cosys-lab/cosys-airsim)
- **License**: MIT License
- **Role in ASTRA VEER**: Used as an architectural reference for the optional High-Fidelity Unreal Engine bridge (`AirSimBridgeSource`). The core trainer operates 100% independently in `NativeSimSource` mode with zero GPU/Unreal dependency. No proprietary or binary assets are vendored.
- **Copyright**: Copyright (c) 2023 Cosys-Lab, University of Antwerp / Microsoft Corporation.

### B. vishwagw/Sky-Sim-drone-simulator-3.0
- **Repository**: [https://github.com/vishwagw/Sky-Sim-drone-simulator-3.0](https://github.com/vishwagw/Sky-Sim-drone-simulator-3.0)
- **License**: MIT License
- **Role in ASTRA VEER**: Conceptual reference for seeded benchmark determinism, procedural noise, and turbulence modeling.
- **Copyright**: Copyright (c) 2024 Vishwa G.W.

### C. mac799l/drone-swarm-simulation
- **Repository**: [https://github.com/mac799l/drone-swarm-simulation](https://github.com/mac799l/drone-swarm-simulation)
- **License**: No license declared (All rights reserved)
- **Role in ASTRA VEER**: Used strictly for conceptual study of swarm formation dynamics (leader-follower, line, wedge, dispersed). **Zero lines of code or assets are copied or linked.** All swarm formation mathematics are implemented from scratch.

### D. VVriter/FPV-ONLINE
- **Repository**: [https://github.com/VVriter/FPV-ONLINE](https://github.com/VVriter/FPV-ONLINE)
- **License**: No license declared (All rights reserved)
- **Role in ASTRA VEER**: Conceptual inspiration for low-poly lightweight browser 3D rendering. **Zero lines of code or assets are copied or linked.** All Three.js canvas shaders and meshes are written cleanly from scratch.

### E. szymon-tulodziecki/Drone-Simulator
- **Repository**: [https://github.com/szymon-tulodziecki/Drone-Simulator](https://github.com/szymon-tulodziecki/Drone-Simulator)
- **License**: GNU General Public License v2.0 (GPL-2.0)
- **Strict Compliance Notice**: **NO CODE, ASSETS, OR BINARIES FROM THIS REPOSITORY ARE VENDORED OR LINKED.** Under GPL-2.0 copyleft terms, incorporating code would restrict commercial/defense deployment. ASTRA VEER independently reimplements the UI concept of step-by-step flight trajectory replay with distance markers completely from scratch in TypeScript and HTML5 Canvas.

---

## 2. Open Source Libraries

The project uses the following permissively licensed libraries (MIT / BSD / Apache 2.0):
- **FastAPI / Starlette / Pydantic** (MIT License)
- **SQLAlchemy / SQLite** (MIT License)
- **scikit-learn / NumPy** (BSD 3-Clause License)
- **React / Vite** (MIT License)
- **Tailwind CSS** (MIT License)
- **Lucide React** (ISC License)
- **Recharts** (MIT License)
- **Three.js** (MIT License)
- **Canvas Confetti** (MIT License)
