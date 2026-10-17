# ASTRA VEER: Complete Guide + Master Prompt (SIH 247)

AI-Enabled Drone & Counter-Drone Threat Simulation Trainer
Tagline: Train Smarter. Respond Stronger.

Is file mein sab kuch hai: repo reuse plan (licenses ke saath), architecture, master prompt, stage-wise prompts, GitHub workflow, demo plan aur checklist. Pehle Section 1 aur 2 padho, phir Section 4 (Master Prompt) AI coding tool mein paste karo.

---

## 1. Paanchon repos ka honest assessment

Ye paanchon repos **drone flight/robotics simulators ya drone programming tools** hain. Inme se koi bhi training, scoring ya AAR wala trainer nahi hai. Isliye inhe "base" nahi, "building blocks aur references" ki tarah use karna hai. Trainer ka core (scenario engine, scoring, AAR, dashboard) hum khud banayenge, yahi problem statement ka asli kaam hai.

| Repo | Kya hai | License | Hardware | Hum ise kaise use karenge |
|---|---|---|---|---|
| [Cosys-Lab/Cosys-AirSim](https://github.com/cosys-lab/cosys-airsim) | Unreal Engine par high-fidelity drone/car simulator. Python client, deterministic random dynamic objects, radar-jaisa Echo sensor, ROS support. | MIT | Heavy: Unreal Engine + GPU | **Optional "High-Fidelity Mode"**. Drone ground-truth positions Python API se lekar hamare sensor model mein bhejna. Default demo mein dependency nahi. |
| [vishwagw/Sky-Sim-drone-simulator-3.0](https://github.com/vishwagw/Sky-Sim-drone-simulator-3.0) | Godot 4 + C++ drone physics, SITL bridges, Python agent interface, seeded benchmark/determinism harness, browser (WASM) tier. | MIT | Normal laptop (web tier "preview" hai) | **Ideas aur selected parts**: seeded benchmark pattern, noise/turbulence modelling, optional browser physics. Code copy karo to LICENSE aur credit rakho. |
| [mac799l/drone-swarm-simulation](https://github.com/mac799l/drone-swarm-simulation) | AirSim/Gazebo mein drone swarm banane ki guides + scripts (SITL, MAVProxy, UDP networking, multi-drone). | **Koi license nahi mila** | Medium to heavy | **Sirf reference.** Swarm formation ideas (leader-follower etc.) padhne ke liye. Code copy mat karo. |
| [VVriter/FPV-ONLINE](https://github.com/VVriter/FPV-ONLINE) | Browser FPV drone simulator, Three.js + JavaScript, gamepad support. Hosted demo hai. | **Koi license nahi mila** | Normal laptop | **Sirf inspiration** (Three.js scene ka look). Code copy mat karo. Author khud kehta hai ki physics achhi nahi hai. |
| [szymon-tulodziecki/Drone-Simulator](https://github.com/szymon-tulodziecki/Drone-Simulator) | DJI Tello flight simulator, Godot 4.6 + GDScript. `easytello`-style Python scripts ko custom interpreter se chalata hai: obstacle course, collision detection, step-by-step mode, flight trail (arrows + distance labels). Educational drone-programming tool. | **GPL-2.0 (copyleft)** | Normal laptop (Godot app) | **Sirf concept reference.** Flight trail aur step-by-step replay ka idea AAR replay ke liye le sakte ho. **Code copy mat karo** (neeche GPL note dekho). |

### License ki baat (zaroori)
- Jis repo mein LICENSE file nahi hoti, uska code default mein "all rights reserved" hota hai. Usse copy ya modify karke apne project mein dalna legally safe nahi hai.
- Do options hain: (a) author ko issue ya email karke likhit permission lo, ya (b) sirf concepts samjho aur apna code khud likho. Is guide mein (b) default hai.
- MIT repos ka code use karo to uska LICENSE text aur copyright notice `THIRD_PARTY_NOTICES.md` mein rakho.
- **GPL-2.0 (Drone-Simulator by szymon-tulodziecki):** Is repo ka code ya assets apne project mein mila doge to poora ASTRA VEER ko GPL-2.0 ke under release karna padega (source public, same license). Ye hackathon aur future commercial/defence use dono ke liye restriction hai. Isliye iska code copy ya link nahi karna. Sirf idea (flight trail with distance labels, step-by-step replay) le sakte ho aur apna code khud likhna hai. Wo Godot/GDScript mein hai, hamara stack React/Python hai, to technically bhi reuse practical nahi hai.
- Jab tak GitHub par aap khud repo page par LICENSE file na dekh lo, mere assessment ko final mat maano. Repo ka License section ek baar khud verify kar lena.

### Sabse bada design risk
Cosys-AirSim ko Unreal Engine aur strong GPU chahiye. Problem statement kehta hai: *"usable at unit level with minimal specialized hardware"*. Agar poora trainer AirSim par depend karega, to ye requirement tut jayegi. Isliye:

> **Default = lightweight native simulator (normal laptop, browser). AirSim/SkySim = optional plug-in modes.**

Ye "tiered" approach judges ko ek strong architecture story bhi deti hai: *low-cost mode for units, high-fidelity mode for training centres.*

---

## 2. Architecture (adapter-based)

```
                +-----------------------------+
                |        React Frontend       |
                |  Setup | Live Sim | AAR |   |
                |  Dashboard (Instructor)     |
                +--------------+--------------+
                               | REST / WebSocket
                +--------------v--------------+
                |        FastAPI Backend      |
                | scenario | scoring | AAR |  |
                | adaptive difficulty | AI    |
                +--------------+--------------+
                               |
              +----------------v-----------------+
              |   TrackSource (interface)        |
              |  generates synthetic radar/EO    |
              |  tracks from ground-truth drones |
              +----+---------------+-------------+
                   |               |             |
        NativeSimSource    ReplaySource   AirSimBridgeSource
        (DEFAULT, no GPU)  (JSON from     (OPTIONAL, Cosys-AirSim
                            any sim)       Python client)
```

Rules:
1. Ground-truth drone positions kisi bhi source se aa sakte hain (native, replay, AirSim).
2. **Sensor model hamesha hamara apna hota hai** (noise, dropout, false tracks, night effect), taaki degraded-sensor scenarios sab sources par same chalein.
3. Scoring, AAR aur dashboard sirf `TrackSource` interface dekhte hain, kisi specific simulator ko nahi.

### Repo layout
```
astra-veer/
  frontend/            # React + Vite + TS + Tailwind + Recharts (+ Three.js later)
  backend/             # FastAPI, SQLite, scoring, adaptive difficulty, AI assist
    app/sources/       # native.py, replay.py, airsim_bridge.py (optional)
  scripts/             # seed_demo_data.py, record_replay.py
  third_party/         # only MIT code, with licenses (if any copied)
  docs/                # architecture, scoring rules, demo script
  THIRD_PARTY_NOTICES.md
  docker-compose.yml
  README.md
```

---

## 3. Mode-wise kya milega

| Mode | Hardware | Kya hota hai | Priority |
|---|---|---|---|
| **Native (default)** | Normal laptop, browser | 2D radar view + simple 3D view, drones scripted/procedural | Must-have, demo isi par |
| **Replay** | Normal laptop | AirSim/SkySim se record kiye drone paths (JSON) ko replay karo, same scoring | Nice-to-have |
| **AirSim Bridge** | Unreal + GPU | Cosys-AirSim se live ground-truth positions, hamare sensor model se tracks | Bonus (agar time bache) |

Judges ke saamne demo **Native mode** mein hona chahiye. AirSim bridge sirf "future/advanced capability" ya short video ke roop mein dikhao.

---

## 4. MASTER PROMPT (AI coding tool mein paste karo)

> Cursor / Claude Code / Lovable / Bolt, kuch bhi. Pehle ye poora paste karo, phir Section 5 ke stage prompts ek-ek karke.

You are a senior full-stack engineer, simulation engineer and UI designer. Build **ASTRA VEER**, an AI-Enabled Drone & Counter-Drone Threat Simulation Trainer for Smart India Hackathon 2026, problem statement SIH 247 (Ministry of Defence, Defence Services Staff College, Software, Robotics and Drones).

### 4.1 Official requirements (build exactly these)
A software-based platform to train personnel to recognise, classify and respond to drone and swarm threats across varied realistic scenarios (day/night, degraded sensors, urban/rural terrain, single drone and swarm). Usable at unit level with minimal specialised hardware. Outcomes:
1. Desktop or VR-capable simulator with scripted and procedurally generated threat scenarios.
2. Decision-tree-based scoring on detection time, threat classification accuracy and engagement decisions.
3. After-action review (AAR) dashboard tracking individual and unit performance over repeated sessions.
4. Adjustable difficulty and scenario randomisation to prevent rote learning.

Do not add unrelated modules (no chatbots, payments, real-hardware integration). Everything is simulated. Never connect to real drones, sensors, weapons or operational systems.

### 4.2 Stack
- Frontend: React + Vite + TypeScript, Tailwind CSS, Recharts.
- Simulation view: build a 2D top-down radar/tactical canvas first. Add a Three.js 3D view only after the full workflow works. Keep it low-poly and laptop-friendly.
- Backend: Python + FastAPI, Pydantic, SQLite (SQLAlchemy). REST for CRUD, WebSocket (or polling) for live tracks.
- Runs fully offline on one machine (`docker compose up` or two simple commands). VR is optional and not part of the core demo.

### 4.3 Track source abstraction (important)
Define an interface `TrackSource` that yields ground-truth drone states (id, class, position, velocity, altitude, timestamp). Implement:
1. `NativeSimSource` (default, no GPU): scripted + seeded procedural drone paths, including swarm formations (leader-follower, line, wedge, dispersed) with 3 to 12 drones.
2. `ReplaySource`: loads a JSON file of recorded drone paths so scenarios from any external simulator can be replayed.
3. `AirSimBridgeSource` (optional, behind a feature flag, off by default): connects through the Cosys-AirSim Python client to read ground-truth positions of spawned drones. If AirSim is not installed or reachable, the app must still run normally and this mode must show a clear "not available" message.

A separate **sensor model** (always ours, source-independent) converts ground truth into what the trainee sees: radar tracks with range/bearing/altitude/speed noise, dropout, delayed or missing updates, false tracks (clutter, birds), reduced visual confidence at night, and reduced reliability in degraded mode. This makes every mode comparable and keeps scoring against ground truth valid.

### 4.4 Scenario engine
Each scenario: scenario_id, seed, terrain (urban/rural), time of day, difficulty, sensor_state (normal/degraded with reliability %, noise, dropout), target list, ground truth per target, and acceptable outcomes.
- Ground-truth classes: **hostile drone, friendly drone, commercial/civil drone, bird / false alarm**.
- Scripted presets plus seeded procedural generation. The same seed must always reproduce the same scenario.
- Conditions must genuinely change the simulation (not just labels): night lowers visual cue quality, degraded sensors add noise and false tracks, swarms raise simultaneous tracks, urban adds clutter and masking zones.

### 4.5 Trainee workflow
1. Observe radar tracks and the sensor panel (range, bearing, altitude, speed, signature confidence, visual cue where available).
2. **Detect**: click a track to mark it. Detection time = time from the target becoming detectable until the trainee marks it.
3. **Classify**: choose one of the four classes.
4. **Respond**: pick a predefined engagement/response option: Continue Monitoring, Request Further Verification, Raise Alert, Authorise Predefined Protective Response (simulated training option only).

### 4.6 Scoring (decision tree, fully configurable)
- Detection: full marks within T_full seconds, linear decay to zero at T_max (both per difficulty, in config). Undetected hostile = missed detection, zero plus penalty.
- Classification: correct or incorrect per target; accuracy = correct / attempted. A false alarm or friendly marked hostile is penalised.
- Decision quality: readable rule table (YAML/JSON) keyed on (true class, trainee classification, sensor confidence, proximity) giving outcomes: Optimal, Acceptable, Over-reaction, Under-reaction, Dangerous error. Store and show the decision path taken per decision in the AAR.
- Total = configurable weighted sum (default 30 / 30 / 40). Do not claim the problem statement fixes weights.
- Missed detections, wrong classifications and bad decisions are listed separately and handled consistently.

### 4.7 AI component (real, small, honest)
- scikit-learn classifier trained on synthetic track features (speed, altitude, signature, flight pattern) producing a suggested class with confidence. Shown as an optional "AI Assist" toggle; log whether the trainee followed or overrode it. Report its held-out accuracy in the README.
- Data-driven weakness analysis from stored sessions (for example night + degraded sensors, swarms) producing specific coaching text in the AAR.
Do not label anything AI unless it is implemented and tested. Rule-based parts must be called rule-based.

### 4.8 Adaptive difficulty
Transparent rules from the last N sessions with configurable thresholds (for example average above 80 raises difficulty, below 50 lowers it, otherwise hold). Difficulty drives target count, sensor degradation, time pressure and decoy rate. The AAR states in one sentence why difficulty changed. Randomise terrain, lighting, sensor reliability, counts, paths and timing each session so patterns cannot be memorised.

### 4.9 Roles
Simple profile selection, no heavy auth. **Trainee** (trainee_id, unit_id) and **Instructor** (unit-level views). Seed several trainees across 2 units.

### 4.10 Screens
1. Home / Training Dashboard.
2. Scenario Setup (terrain, day/night, single/swarm, sensors, difficulty, scripted vs procedural, optional seed, track source selector with unavailable modes disabled and explained).
3. Live Simulation (radar view, sensor panel, timer, track list, classify and respond controls, progress, finish).
4. AAR Report (score, three metrics, per-target timeline, correct vs incorrect, misses, decision-tree path, strengths and improvements, difficulty-change reason, AI-assist agreement).
5. Performance Dashboard (history, trends, individual summary, unit aggregates, compare two sessions).

Theme: dark navy/charcoal, restrained green, cyan and amber, readable type, clear status indicators. Usability over decoration.

### 4.11 API (separate modules for sources, sensor model, scoring, persistence, API)
List presets; generate scenario; start session; stream or poll tracks; record detect/classify/respond events; complete session and score; get AAR; trainee history; unit aggregate; next recommended difficulty; list available track sources. Validate inputs and return clear errors.

### 4.12 Data
SQLite tables: trainees, units, sessions, scenarios, target_events (detect/classify/respond with timestamps), scores, difficulty_history. Dashboard reads only stored data. Provide `python scripts/seed_demo_data.py`, which runs the real simulation and scoring pipeline headlessly to create 25 to 30 sessions across trainees and 2 units with an improving trend.

### 4.13 Third-party code rules
- Reference repos: Cosys-AirSim (MIT), SkySim 3.0 (MIT), drone-swarm-simulation by mac799l (no license found), FPV-ONLINE by VVriter (no license found), Drone-Simulator by szymon-tulodziecki (GPL-2.0).
- **Do not copy code from repos without a license.** Reimplement ideas from scratch.
- **Do not copy, vendor or link any code or assets from the GPL-2.0 repo (szymon-tulodziecki/Drone-Simulator).** Copyleft would force this whole project to GPL-2.0. Only take concepts (for example flight-trail rendering with distance labels, step-by-step replay) and implement them independently in React/Canvas for the AAR replay view.
- Cosys-AirSim must be an optional external dependency, never vendored, never required for tests or the default demo.
- If any MIT code is copied, keep its LICENSE and copyright notice and list it in `THIRD_PARTY_NOTICES.md`.

### 4.14 Quality rules
- Every button on required screens works. No placeholder actions, fake charts or hardcoded dashboard figures.
- Loading, empty and error states everywhere.
- Tests (pytest + a few frontend tests): seed reproducibility, sensor model effects, scoring and decision tree, adaptive difficulty, DB persistence, AI classifier accuracy, `ReplaySource` loading, and graceful failure when AirSim is unavailable.
- Typed code, clean structure, README with architecture, setup, offline run, test instructions and limitations.

### 4.15 Git rules
Work in the existing Git repo. Create `.gitignore` first (no `node_modules`, `.venv`, `.env`, `*.db`, build output, large binaries). After each stage run tests, then commit with a clear message. Keep `main` runnable. At the end of each stage report: what works, how to run it, what is incomplete.

### 4.16 Final acceptance test
A reviewer can: open the app in a desktop browser; configure and start a scenario; see moving simulated targets affected by the chosen conditions; detect, classify and respond; finish and get a score; read the AAR with detection time, classification accuracy and decision quality; see the session in individual and unit dashboards; start another session whose difficulty and conditions changed from previous performance. This works fully with **no GPU, no Unreal Engine and no internet**.

If anything cannot be completed, say so explicitly instead of faking it. One fully working end-to-end scenario beats many half-working ones.

---

## 5. STAGE PROMPTS (ek-ek karke paste karo)

**Stage 1: Setup**
Create the repo structure (`frontend`, `backend`, `scripts`, `docs`, `third_party`), `.gitignore`, `THIRD_PARTY_NOTICES.md` skeleton, FastAPI app with health endpoint, React + Vite + TS + Tailwind app, SQLite models, docker-compose, README skeleton. Verify both servers run and communicate. Commit.

**Stage 2: Home, Setup screen, scenario generation**
Build Home and Scenario Setup screens with working state, presets from the API and the seeded scenario generator endpoint. Include the track-source selector (only Native enabled for now). Commit.

**Stage 3: TrackSource, sensor model and radar view**
Implement the `TrackSource` interface, `NativeSimSource` (including swarm formations), the sensor model and the 2D radar Live Simulation screen with timer and track list. Targets must move and conditions must visibly change the display. Add tests for seed reproducibility and sensor effects. Commit.

**Stage 4: Detect, classify, respond, scoring**
Implement detection marking, classification, response options, YAML decision-tree rule table, configurable scoring and tests. Commit.

**Stage 5: AAR and persistence**
Persist sessions and events, complete-session endpoint and the full AAR screen with per-decision tree path. Commit.

**Stage 6: Dashboards and seed data**
Individual and instructor/unit dashboards, trends, session comparison and `scripts/seed_demo_data.py`. Commit.

**Stage 7: Adaptive difficulty, randomisation, AI Assist**
Adaptive difficulty with explanation text, full randomisation, scikit-learn assist with measured accuracy and data-driven weakness feedback. Commit.

**Stage 8: ReplaySource and optional AirSim bridge**
Add `ReplaySource` with a sample JSON and `scripts/record_replay.py`. Add `AirSimBridgeSource` behind a feature flag using the Cosys-AirSim Python client; it must fail gracefully with a clear message if unavailable. Document setup in `docs/airsim_mode.md`. Commit.

**Stage 9: 3D view (optional) and polish**
Only if everything above is stable: add a low-poly Three.js 3D view. Run the full acceptance test, fix bugs, finish the README (architecture, offline run, limitations, third-party notices). Commit and tag `v1.0-demo`.

---

## 6. GitHub workflow (short)

```bash
git clone https://github.com/<username>/astra-veer.git
cd astra-veer
# AI tool ko isi folder mein kholo (Cursor / VS Code / `claude` in terminal)

# har stage ke baad:
git add .
git commit -m "feat: stage N <kya bana>"
git push            # pehli baar: git push -u origin main
```

- Teammates ko Settings → Collaborators se add karo. Kaam shuru karne se pehle `git pull`.
- Alag feature, alag branch: `git checkout -b feature/dashboard`, phir Pull Request.
- `.env`, API keys, `.db`, `node_modules`, `.venv` kabhi commit mat karo.
- Reference repos ko apne repo ke andar clone/copy mat karo. Unke links `docs/references.md` mein rakho.
- Cosys-AirSim bahut bada hai, isliye submodule bhi mat banao. Optional dependency ki tarah docs mein likho.

---

## 7. Demo plan (SIH presentation)

1. 30 sec: problem aur "minimal hardware" requirement.
2. Setup screen: night + rural + degraded sensors + swarm.
3. Live simulation: detect, classify, respond (AI Assist toggle on/off dikhao).
4. AAR: score, decision-tree path, difficulty-change reason.
5. Dashboard: seeded history se improvement trend, instructor unit view.
6. Next session: difficulty automatically badli hui.
7. Closing slide: "Native mode for units, AirSim/Replay mode for training centres" (video ya architecture diagram).

---

## 8. Final checklist

- [ ] Native mode bina GPU/internet ke chalta hai
- [ ] Scripted + seeded procedural scenarios
- [ ] Single drone + swarm, day/night, urban/rural, degraded sensors
- [ ] Detect, classify, respond + decision-tree scoring
- [ ] AAR per session, individual aur unit dashboard
- [ ] Adaptive difficulty + explanation
- [ ] AI Assist real aur measured, baaki rule-based honestly labelled
- [ ] `THIRD_PARTY_NOTICES.md` aur licenses sahi
- [ ] Tests pass, README complete, `v1.0-demo` tag
- [ ] Reference repos ke licenses khud verify kar liye
- [ ] GPL-2.0 repo ka koi code/asset hamare repo mein nahi hai
- [ ] AAR mein flight-path replay (trail + step mode) apne code se banaya
