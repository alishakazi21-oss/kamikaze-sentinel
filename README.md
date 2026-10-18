# ASTRA VEER // VYOM-RAKSHAK (अस्त्र वीर // व्योम रक्षक)
### Sensor-Realistic, Per-Skill Adaptive, Explainable Counter-Drone Operator Trainer
**Smart India Hackathon 2026 // Problem Statement SIH 247**  
*Ministry of Defence | Defence Services Staff College (DSSC) | Software, Robotics & Drones*

> **Tagline**: *Sensor-Realistic. Explainable. Calibrated. Adaptive.*

---

## 1. Executive Summary & Problem Context
Modern air defense operators and tactical forward commanders face an asymmetric drone threat landscape: from micro-RCS stealth kamikaze quadcopters to multi-UAV saturation swarms operating in adverse weather, electronic warfare (EW) jamming, and dense urban airspaces.

Operational requirements mandate a software platform that **runs offline on a standard laptop without dedicated GPUs**, maintains **deterministic reproducibility for any given scenario seed**, and utilizes **published, unclassified sensor physics parameters** rather than game heuristics.

**VYOM-RAKSHAK (ASTRA VEER Enhancement)** transforms the simulator into a sensor-realistic, calibrated, explainable, and adaptive counter-UAS training suite:
1. **Interactive 3D Soldier Combat Simulator**: Playable first/third-person 3D battlefield where an outpost soldier aims an Anti-Drone RF Jammer gun, seeks sandbag cover, and engages kamikaze drones and swarms.
2. **Sensor Reality Engine**: CA-CFAR active radar detection with Swerling I radar cross-section (RCS) fluctuation, acoustic array bearing-only logistic detection, optical/thermal cameras, and RF direction finding (Richards 2014; Skolnik 2008; Besada et al. 2022).
3. **Multi-Sensor Swarm Resolution**: Physical angular/range resolution limits cause multi-drone swarms to merge into a single composite track on active radar/acoustic, requiring finer optical crosshairs to resolve individual drones before weapon release.
4. **Explainable 4-Question Decision Tree & Leaf Reason Codes**: Replaces opaque scoring with a transparent 4-question tree (Detection before critical range, Classification, ROE response, and multi-sensor cross-checking under uncertainty) returning actionable reason codes (e.g. `OPTIMAL_ENGAGEMENT`, `NO_CROSSCHECK`, `SWARM_TREATED_AS_SINGLE`, `FALSE_ALARM_ENGAGED`, `FRIENDLY_FIRE_INTERCEPTION`).
5. **Overconfidence Index (OCI) & Calibration Scoring**: Evaluates metacognitive calibration ($\text{OCI} = \text{Mean Confidence} - \text{Accuracy}$) with 4-pillar weighting: Detection (30%), Classification (30%), Tactical Decision (30%), Confidence Calibration (10%).
6. **Bayesian Knowledge Tracing (BKT) 6-Skill Engine**: Tracks latent cognitive mastery $P(L)$ across 6 core skills: Detection in Clutter, Threat Classification, Swarm Assessment, Sensor Cross-Checking, Tactical Response Selection, and Decisions Under Pressure.
7. **Adaptive Scenario Recommendation & Spaced Retests**: Targets trainee's weakest competency aiming for ~70% expected success rate, enforces a 1-in-5 review drill, and schedules 3-day and 7-day retention retests.
8. **Instructor Console**: Unclassified JSON/GUI editor to modify Rules of Engagement (ROE), scoring weights, and penalty thresholds with zero backend redeployment.

---

## 2. Sensor Reality Engine & Published Parameters

Sensor parameters are unclassified and derived from established radar, acoustic, and electro-optical counter-UAS literature (configured in `backend/data/sensor_config.json`):

| Sensor Subsystem | Model / Equation | Key Parameters | Literature Basis |
|---|---|---|---|
| **Active 3D Radar** | Bistatic/Monostatic Radar Range Equation + Swerling I CA-CFAR | $P_t=25\text{ W}$, $G=24\text{ dBi}$, $f=9.4\text{ GHz}$, $F=4.5\text{ dB}$, $\Delta R=35\text{ m}$, $\Delta\theta=3.0^\circ$ | Richards (2014); Skolnik (2008) |
| **Acoustic Array** | Logistic detection probability, bearing-only ($\theta$) | $SL_0=72\text{ dB SPL}$, $\alpha=0.008\text{ dB/m}$, $\sigma_\theta=8.0^\circ$ | Besada et al. (2022) |
| **EO / FLIR Cameras** | Johnson criteria optical resolution, day/night thermal contrast | EO $0.5^\circ$ beam; Thermal $\Delta T=12\text{ K}$ motor hotspot | Besada et al. (2022) |
| **RF Direction Finder** | Wedge bearing detection on drone datalinks | Frequencies: $0.9, 1.2, 1.4, 2.4, 5.8\text{ GHz}$; $\sigma_\theta=6.0^\circ$ | Besada et al. (2022) |
| **Swarm Resolution** | Resolution cell centroid merging + elevated RCS ($+10\log_{10}N$) | Merges if $\Delta R < 35\text{ m}$ and $\Delta\theta < 3.0^\circ$ | Richards (2014) |

*Ground truth data (true classifications, false alarm flags, and individual swarm drone positions) are strictly concealed from the trainee during live drills and only revealed in the After-Action Review (AAR).*

---

## 3. Explainable Scoring & Calibration (4 Pillars)

Scoring is partitioned into 4 distinct pillars:
- **Detection Latency (30%)**: Linear decay curve terminating before the 800m critical perimeter.
- **Classification Accuracy (30%)**: Discriminating hostiles from friendly military assets, commercial drones, and avian clutter.
- **Decision Quality (30%)**: Rule-based ROE alignment and multi-sensor verification under uncertainty.
- **Confidence Calibration (10%)**: Overconfidence Index $\text{OCI} = \overline{C} - \text{Accuracy}$.

### 4-Question Sequential Decision Tree:
```
                      [Q1: Detected before critical range (800m)?]
                                   /                 \
                                 YES                  NO (MISSED_HOSTILE / LATE_DETECTION)
                                 /
                   [Q2: Classified correctly?]
                       /                 \
                     YES                  NO (SWARM_TREATED_AS_SINGLE / ROE_MISIDENTIFIED)
                     /
        [Q3: Tactical response appropriate under ROE?]
                 /                 \
               YES                  NO (UNDER_REACTION_HOSTILE / FRIENDLY_FIRE / FALSE_ALARM_ENGAGED)
               /
  [Q4: Cross-checked with secondary sensor when uncertain?]
           /                 \
         YES                  NO (NO_CROSSCHECK)
         /
 [OPTIMAL_ENGAGEMENT / APPROPRIATE_CLASSIFIED_CORRECT]
```

---

## 4. Bayesian Knowledge Tracing (BKT) 6-Skill Engine

Latent skill mastery $P(L)$ is updated per trial using standard Bayesian Knowledge Tracing (Corbett & Anderson 1994):
- $P(L_0) = 0.15$ (Prior mastery)
- $P(T) = 0.10$ (Learning transition rate)
- $P(G) = 0.15$ (Guess rate)
- $P(S) = 0.10$ (Slip rate)

$$\text{Posterior: } P(L \mid \text{Obs}=1) = \frac{P(L) \cdot (1 - P(S))}{P(L) \cdot (1 - P(S)) + (1 - P(L)) \cdot P(G)}$$
$$\text{Transition: } P(L_{t+1}) = P(L \mid \text{Obs}) + (1 - P(L \mid \text{Obs})) \cdot P(T)$$

### The 6 Core Competencies:
1. `detection_clutter`: Early detection in radar clutter, rain, and fog.
2. `classification`: IFF and visual/RF signature discrimination.
3. `swarm_assessment`: Swarm cluster density and separation.
4. `sensor_crosscheck`: Cross-referencing secondary sensors under EW jamming or low SNR.
5. `response_selection`: Selecting proportional ROE actions (monitor vs verify vs intercept).
6. `decision_under_pressure`: Timely defensive execution against high-speed terminal diving FPVs.

---

## 5. Quick Start (Running Offline on Standard Hardware)

### Prerequisites:
- Python 3.10+
- Node.js v18+ and npm

### Terminal 1: Python Backend
```bash
# Windows
python -m venv .venv
.\.venv\Scripts\activate
pip install -r backend/requirements.txt

# Run server on port 8000
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Terminal 2: React Frontend
```bash
cd frontend
npm install
npm run dev
```
Open your browser at: `http://localhost:5173`

---

## 6. Running Automated Tests
Run the comprehensive 30-test suite verifying sensor physics, swarm resolution, explainable scoring, BKT adaptive updates, and AI assist:

```bash
python -m pytest backend/tests/ -v
```

Expected output:
```
backend/tests/test_astra_veer.py (6 passed)
backend/tests/test_environment_and_swarms.py (4 passed)
backend/tests/test_explainable_scoring.py (6 passed)
backend/tests/test_bkt_adaptive.py (5 passed)
backend/tests/test_innovation_features.py (3 passed)
backend/tests/test_sensor_physics.py (6 passed)
============================= 30 passed in 1.79s =============================
```

---

## 7. SIH 3-Minute Jury Evaluation & Demo Script

1. **Sensor Reality & Swarm Trap (45 seconds)**:
   - Navigate to **RADAR CIC** with scenario `Border Outpost (Swarm Wedge)`.
   - Show how radar shows a single diamond contact with elevated RCS due to physical angular resolution limits ($3.0^\circ$).
   - Switch to **Optical / EO Camera** or toggle sensor filters: the fine $0.5^\circ$ optical crosshairs separate the individual drones in the cluster.
2. **Action Deck & Confidence Calibration (45 seconds)**:
   - Designate target and select response.
   - Adjust the **Self-Reported Confidence Slider (1–5)**: point out that the system explicitly measures operator metacognition.
   - Show the **Scikit-Learn AI Assist** card displaying calibrated probabilities, Shannon prediction entropy, and uncertainty warnings.
3. **After-Action Review & Explainable Tree (45 seconds)**:
   - Complete the drill to enter the **AAR Debrief**.
   - Show the **4-Pillar Score**: Detection, Classification, Decision, and Confidence Calibration.
   - Point out the **Overconfidence Index (OCI)**: flags whether the operator was well-calibrated, overconfident, or underconfident.
   - Inspect the **Target Engagement Table** showing leaf reason codes: `OPTIMAL_ENGAGEMENT`, `SWARM_TREATED_AS_SINGLE`, or `NO_CROSSCHECK`.
4. **Adaptive Engine & Instructor Console (45 seconds)**:
   - Switch to **ANALYTICS**: show the **6-Skill BKT Cognitive Mastery Profile** and click **Simulate Time (+3 Days)** to see the spaced retention retests come due.
   - Open **INSTRUCTOR ROE**: demonstrate editing scoring weights and ROE decision rules with live hot-reloading!

---

## 8. Academic References & Citations

1. **Richards, Mark A.** (2014). *Fundamentals of Radar Signal Processing* (2nd ed.). McGraw-Hill Education. (CA-CFAR, Swerling I target fluctuations, radar range equation, CRLB noise bounds).
2. **Skolnik, Merrill I.** (2008). *Radar Handbook* (3rd ed.). McGraw-Hill. (Resolution cell geometry, atmospheric attenuation, pulse width resolution).
3. **Besada, J. A., et al.** (2022). *Drone and Counter-UAS Sensor Technologies: A Comprehensive Survey*. IEEE Access. (Acoustic SPL acoustic decay, thermal infrared signature of drone motors, RF direction finding).
4. **Corbett, A. T., & Anderson, J. R.** (1994). *Knowledge Tracing: Modeling the Acquisition of Procedural Knowledge*. User Modeling and User-Adapted Interaction, 4(4), 253-278. (Bayesian Knowledge Tracing formulation).
