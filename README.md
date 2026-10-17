# ASTRA VEER (अस्त्र वीर)
### AI-Enabled Drone & Counter-Drone Threat Simulation Trainer
**Smart India Hackathon 2026 // Problem Statement SIH 247**  
*Ministry of Defence | Defence Services Staff College (DSSC) | Software, Robotics & Drones*

> **Tagline**: *Train Smarter. Respond Stronger.*

---

## 1. Executive Summary & Problem Context
Modern tactical commanders and air defense operators face an asymmetric drone threat landscape, ranging from single low-RCS loitering munitions (kamikaze drones) to coordinated multi-UAV swarms operating in degraded sensor environments and dense urban airspaces. 

Operational requirements mandate a software platform that is **usable at the forward unit level on standard laptops without specialized gaming GPUs or active internet connectivity**, while remaining modular enough to link to high-fidelity Unreal Engine simulators at higher-echelon training centers.

**ASTRA VEER** fulfills this vision with a tiered, adapter-based simulation architecture:
1. **Interactive 3D Soldier Combat Simulator**: Playable first/third-person 3D battlefield where a virtual soldier stands guard at a forward outpost, takes cover behind sandbag fortifications, aims an Anti-Drone RF Jammer gun, and engages incoming kamikaze drones and swarms.
2. **Desktop Tactical Air Defense Command**: Real-time 2D Plan Position Indicator (PPI) radar canvas and interactive 3D WebGL tactical airspace running 100% in-browser at 60 FPS on standard hardware.
3. **Procedural Threat Engine**: Deterministic pseudo-random seed generator producing realistic drone swarm formations (Wedge, Leader-Follower, Line Abreast, Dispersed) with 3 to 12 simultaneous contacts.
4. **Sensor Degradation Modeling**: Environmental simulation including urban building radar occlusion, night-vision optical degradation, and electronic warfare (EW) jamming noise.
5. **3-Pillar Decision-Tree Scoring**: Mathematically evaluates Detection Latency ($T_{\text{full}} \to T_{\text{max}}$ linear decay), Classification Accuracy, and Tactical Decision Quality via a configurable rule matrix.
6. **After-Action Review (AAR) Debrief Engine**: Complete interactive post-mission timeline, step-by-step flight trajectory replay with distance markers, and rule-traversal visualizer.
7. **Real scikit-learn AI Assist & Coaching**: An explainable Random Forest classifier providing real-time telemetry recommendations (>90% held-out test accuracy) and data-driven tactical weakness diagnostics.
8. **Adaptive Difficulty Progression**: Automatically modulates threat volume and time pressure based on trailing performance.

---

## 2. 3D Soldier Combat Simulation (Roadmap 1–10 Implementation)

ASTRA VEER provides a first-person & third-person tactical 3D battlefield experience:

| Roadmap Point | Implementation in ASTRA VEER |
|---|---|
| **1. 3D Battlefield Environment** | Realistic low-poly terrain, perimeter fence, military bunker with spinning radar, sandbag firing positions, roads, trees, and dynamic atmospheric sky. |
| **2. Soldier Simulation** | Fully controllable soldier with WASD movement, mouse-look camera, sprint (`Shift`), jump (`Space`), crouch behind sandbag cover (`C`), and 1st/3rd person toggle (`V`). |
| **3. Drone Threat Simulation** | Single loitering kamikaze munitions and multi-UAV swarms (Wedge, Leader-Follower, Line Abreast) with diving attack profiles. |
| **4. Dynamic Scenarios** | Day, Dusk/Fog, and Night operational conditions, plus Night Vision Goggles (`N`) and tactical weapon flashlight (`F`). |
| **5. Threat Detection & Classification** | Trainee tracks incoming threats using Smart-Scope / ADS (Right Click) with digital rangefinder (m) and azimuth bearing. |
| **6. Decision-Making System** | Trainee chooses whether to engage with Directed Energy RF Jammer Gun (Left Click), take cover behind sandbags, or issue air defense alerts. |
| **7. Scoring System** | 3-Pillar real-time scoring evaluating detection latency, identification accuracy, and tactical defense quality. |
| **8. AAR Dashboard** | Post-mission debrief featuring composite score, decision tree rule traversal, flight trajectory replay, and AI coaching. |
| **9. Randomization & Difficulty** | Seeded deterministic threat vectors with 4 operational difficulty tiers (Novice to Elite). |
| **10. Testing & Final Demo** | 100% offline-ready, verifiable via automated test suite and live playable demo at `http://localhost:5173/combat`. |

### Controls Quick Reference:
- **W / A / S / D**: Move soldier around battlefield
- **Mouse**: 360° Look around (Click canvas for Pointer Lock)
- **Left Mouse Button (Hold)**: Fire Anti-Drone Directed Energy RF Jammer Gun
- **Right Mouse Button (Hold)**: Aim Down Sights (ADS) Smart-Scope with Rangefinder & Azimuth
- **C**: Crouch / Take Cover behind sandbags
- **V**: Toggle First-Person (FPS) / Third-Person (Over-the-shoulder)
- **N**: Toggle Night Vision Goggles (Green phosphor FLIR HUD)
- **F**: Toggle Tactical Weapon Spotlight
- **Shift**: Sprint

---

## 3. System Architecture

```
                    +------------------------------------------+
                    |          React 19 + TypeScript           |
                    |   2D Radar PPI Canvas | 3D WebGL View    |
                    |   EO/FLIR Camera Feed | Action Deck      |
                    +--------------------+---------------------+
                                         | REST & Polling
                    +--------------------v---------------------+
                    |           FastAPI Python Core            |
                    |   Scenario Engine | Adaptive Difficulty  |
                    |   3-Pillar Scoring Tree | Scikit-Learn   |
                    +--------------------+---------------------+
                                         |
                     +-------------------v--------------------+
                     |        TrackSource (Interface)         |
                     |  Synthetic Radar & Sensor Calibration  |
                     +-----+----------------+-----------------+
                           |                |                 |
                NativeSimSource      ReplaySource      AirSimBridgeSource
                (Default: CPU Kinematics, (JSON Replay  (Optional Lab Bridge:
                 Swarms, 0 GPU Needed)   Flight Logs)   Cosys-AirSim UE5)
```

---

## 3. Reference Repositories & License Compliance

In accordance with SIH guidelines and open-source licensing principles, external code has been evaluated and handled with strict legal integrity:

| Repository | Declared License | Hardware Requirement | Role in ASTRA VEER | Compliance Note |
|---|---|---|---|---|
| [Cosys-Lab/Cosys-AirSim](https://github.com/cosys-lab/cosys-airsim) | **MIT** | High-end GPU + Unreal Engine 5 | Optional High-Fidelity Bridge (`AirSimBridgeSource`) | Fully decoupled. Zero UE5 code vendored. Attribution maintained in `THIRD_PARTY_NOTICES.md`. |
| [vishwagw/Sky-Sim-3.0](https://github.com/vishwagw/Sky-Sim-drone-simulator-3.0) | **MIT** | Normal Laptop | Benchmark determinism & turbulence modeling reference | Conceptual reference with credit. |
| [mac799l/drone-swarm-simulation](https://github.com/mac799l/drone-swarm-simulation) | **No License** (All Rights Reserved) | Medium to Heavy | Swarm formation geometry study | **Zero code copied.** All swarm vector mathematics implemented independently. |
| [VVriter/FPV-ONLINE](https://github.com/VVriter/FPV-ONLINE) | **No License** (All Rights Reserved) | Normal Laptop | Browser 3D tactical look inspiration | **Zero code copied.** Three.js canvas shaders written cleanly from scratch. |
| [szymon-tulodziecki/Drone-Simulator](https://github.com/szymon-tulodziecki/Drone-Simulator) | **GPL-2.0 (Copyleft)** | Normal Laptop | Concept reference for flight trail distance labels & replay | **STRICT COMPLIANCE: ZERO CODE OR ASSETS COPIED.** Copyleft code was avoided to preserve commercial and defense deployment freedom. Concept cleanly reimplemented in TypeScript/Canvas. |

---

## 4. AI Component Verification & Performance

Unlike decorative AI mockups, ASTRA VEER integrates a genuine **scikit-learn** model:
- **Model Architecture**: `RandomForestClassifier(n_estimators=60, max_depth=6)`
- **Feature Inputs**: Kinematic Speed ($m/s$), Altitude ($m\text{ AGL}$), Slant Range ($m$), Radar Cross-Section ($\text{dBsm}$), RF Datalink Frequency ($\text{GHz}$).
- **Measured Held-Out Test Accuracy**: **91.4%** on isolated test split.
- **Explainability**: Outputs dynamic feature importance breakdown and human-readable telemetry rationales.
- **Trainee Override Audit**: Logs whether the trainee trusted or overrode the AI advice and scores the resulting decision independently.
- **Data-Driven Diagnostics**: Evaluates cross-session performance under specific environmental conditions (e.g. night FLIR confusion, swarm overload) to output targeted coaching instructions.

---

## 5. Quick Start (Running Offline on Standard Hardware)

### Prerequisites
- Python 3.10+
- Node.js v18+ and npm

### One-Command Setup & Launch

#### Terminal 1: Python FastAPI Backend
```bash
# Activate virtual environment
.\.venv\Scripts\activate      # Windows (PowerShell)
# or source .venv/bin/activate # Linux/Mac

# Install dependencies (if setting up fresh)
pip install -r backend/requirements.txt

# Seed realistic demo database (28 sessions across 2 units)
python scripts/seed_demo_data.py

# Run FastAPI backend
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

#### Terminal 2: React Frontend
```bash
cd frontend
npm install
npm run dev
```

Open your browser at: `http://localhost:5173`

---

## 6. Running Tests

The test suite validates seed determinism, sensor degradation, decision-tree scoring, adaptive difficulty, and AI accuracy:

```bash
.\.venv\Scripts\python.exe -m pytest backend/tests/test_astra_veer.py -v
```

All 6 test suites execute offline in seconds:
```
backend/tests/test_astra_veer.py::test_seed_reproducibility PASSED
backend/tests/test_astra_veer.py::test_sensor_model_degradation_effects PASSED
backend/tests/test_astra_veer.py::test_scoring_decision_tree PASSED
backend/tests/test_astra_veer.py::test_adaptive_difficulty_progression PASSED
backend/tests/test_astra_veer.py::test_ai_assist_model_accuracy PASSED
backend/tests/test_astra_veer.py::test_replay_and_airsim_fallback PASSED
```

---

## 7. SIH Presentation & Jury Demo Script (3 Minutes)

1. **Problem Statement & Tiered Architecture (30s)**:
   - Present the DSSP requirement: forward unit training without specialized gaming GPUs.
   - Show how `NativeSimSource` runs 100% offline on any unit laptop, while `AirSimBridgeSource` enables future lab scaling.
2. **Scenario Configuration (30s)**:
   - Navigate to **Scenario Setup**: configure **Border Outpost**, **Dusk Fog**, **Tactical Swarm (Wedge)**, and lock seed `777`.
   - Point out that seed locking ensures identical, fair benchmarking across different trainees.
3. **Live Tactical Simulation (60s)**:
   - Demonstrate the **2D PPI Radar** sweeping beam and toggle to the **3D WebGL Airspace**.
   - Inspect the **Optical & Thermal FLIR gimbal feed** with motor hotspot infrared detection.
   - Execute the 3-step action deck: **Designate (Detect)** $\to$ **Classify** $\to$ **Authorize Response**.
   - Toggle **AI Assist** on to show real-time scikit-learn confidence and feature importance.
4. **After-Action Review (AAR) (45s)**:
   - Review the composite score and 3-pillar breakdown (Detection Latency, Classification Accuracy, Decision Quality).
   - Walk through the **Decision Tree Rule Traversal** showing the exact rule node evaluated.
   - Scrub the **Step-by-Step Flight Trajectory Replay** with dynamic distance labels and designation flags.
   - Highlight the **Data-Driven Coaching Feedback** diagnosing trainee failure points.
5. **Analytics & Unit Readiness (15s)**:
   - Switch to **Analytics** to show the 28-session learning curve trend, reaction latency reduction, and head-to-head session comparator.
