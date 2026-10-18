import os
import uuid
import json
import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple

from fastapi import FastAPI, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .database import engine, Base, get_db
from .models import (
    Unit, Trainee, Scenario, Session as DbSession, TargetEvent,
    Score, DifficultyHistory, SkillProfile, ScheduledRetest
)
from .schemas import (
    ScenarioCreateRequest, ScenarioResponse, SessionStartRequest,
    SessionEventRequest, SessionCompleteRequest, AIAssistRequest, AIAssistResponse
)
from .sources.base import TrackSource
from .sources.native import NativeSimSource
from .sources.replay import ReplaySource
from .sources.airsim_bridge import AirSimBridgeSource
from .sources.sensor_model import SyntheticSensorModel
from .scenario_engine import ScenarioEngine
from .scoring import ScoringEngine
from .ai_assistant import ai_assist_instance, generate_data_driven_coaching
from .adaptive import adaptive_engine, CORE_SKILLS, SKILL_DISPLAY_NAMES

# Initialize database schema
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="VYOM RAKSHAK API",
    description="Sensor-Realistic Explainable Counter-Drone Operator Trainer (SIH 247)",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Active simulation sources cache for live sessions
active_sim_sessions: Dict[str, Dict[str, Any]] = {}
scoring_engine = ScoringEngine()


def get_or_create_sim_source(session_id: str, scenario_data: Dict[str, Any]) -> Tuple[TrackSource, SyntheticSensorModel]:
    if session_id in active_sim_sessions:
        cached = active_sim_sessions[session_id]
        return cached["source"], cached["sensor_model"]

    source_type = scenario_data.get("track_source_type", "native")
    if source_type == "replay":
        source = ReplaySource()
    elif source_type == "airsim":
        source = AirSimBridgeSource()
    else:
        source = NativeSimSource(seed=scenario_data.get("seed", 42))

    source.initialize(scenario_data)
    sensor_model = SyntheticSensorModel(seed=scenario_data.get("seed", 42))

    active_sim_sessions[session_id] = {
        "source": source,
        "sensor_model": sensor_model,
        "scenario_data": scenario_data
    }
    return source, sensor_model


# -------------------------------------------------------------
# 1. System Health & Available Track Sources
# -------------------------------------------------------------
@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "system": "VYOM RAKSHAK Counter-Drone Trainer",
        "version": "1.0.0",
        "offline_ready": True,
        "timestamp": datetime.utcnow().isoformat(),
        "ai_model_accuracy": f"{ai_assist_instance.held_out_accuracy * 100:.1f}%"
    }


@app.get("/api/sources")
def list_track_sources():
    native = NativeSimSource().is_available()
    replay = ReplaySource().is_available()
    airsim = AirSimBridgeSource().is_available()
    return {
        "sources": [native, replay, airsim],
        "default": "native",
        "note": "Native simulation runs 100% offline with zero GPU. Cosys-AirSim bridge requires Unreal Engine 5."
    }


# -------------------------------------------------------------
# 2. Profiles (Trainees & Units)
# -------------------------------------------------------------
@app.get("/api/profiles")
def get_profiles(db: Session = Depends(get_db)):
    # Auto-seed basic units and trainees if empty
    units = db.query(Unit).all()
    if not units:
        u1 = Unit(id="UNIT-ALPHA", name="Garud Special Forces - 12th Air Defense Flight", base_location="Forward Air Base Ambala")
        u2 = Unit(id="UNIT-BRAVO", name="Army Air Defense (AAD) - 45th Counter-UAS Battery", base_location="Eastern Sector Tezpur")
        db.add_all([u1, u2])
        db.commit()

        t1 = Trainee(id="TR-101", unit_id="UNIT-ALPHA", callsign="Viper-1", rank="Flight Lieutenant", current_difficulty=2)
        t2 = Trainee(id="TR-102", unit_id="UNIT-ALPHA", callsign="Hawk-Eye", rank="Flying Officer", current_difficulty=1)
        t3 = Trainee(id="TR-201", unit_id="UNIT-BRAVO", callsign="Trishul-Lead", rank="Captain", current_difficulty=3)
        t4 = Trainee(id="TR-202", unit_id="UNIT-BRAVO", callsign="Rudra-2", rank="Lieutenant", current_difficulty=1)
        db.add_all([t1, t2, t3, t4])
        db.commit()
        units = db.query(Unit).all()

    trainees = db.query(Trainee).all()
    return {
        "units": [{"id": u.id, "name": u.name, "base_location": u.base_location} for u in units],
        "trainees": [
            {
                "id": t.id,
                "unit_id": t.unit_id,
                "callsign": t.callsign,
                "rank": t.rank,
                "current_difficulty": t.current_difficulty
            } for t in trainees
        ]
    }


# -------------------------------------------------------------
# 3. Scenario Management
# -------------------------------------------------------------
@app.get("/api/scenarios/presets")
def get_scenario_presets():
    return {"presets": ScenarioEngine.get_presets()}


@app.post("/api/scenarios/generate", response_model=ScenarioResponse)
def generate_scenario_endpoint(payload: ScenarioCreateRequest, db: Session = Depends(get_db)):
    data = ScenarioEngine.generate_scenario(
        title=payload.title,
        seed=payload.seed,
        terrain=payload.terrain,
        time_of_day=payload.time_of_day,
        weather=payload.weather,
        jamming_level=payload.jamming_level,
        sensor_bias_enabled=payload.sensor_bias_enabled,
        threat_type=payload.threat_type,
        difficulty=payload.difficulty,
        sensor_state=payload.sensor_state,
        sensor_reliability=payload.sensor_reliability,
        target_count=payload.target_count,
        track_source_type=payload.track_source_type
    )

    db_scenario = Scenario(
        id=data["id"],
        title=data["title"],
        seed=data["seed"],
        terrain=data["terrain"],
        time_of_day=data["time_of_day"],
        weather=data.get("weather", "clear"),
        jamming_level=data.get("jamming_level", 0.0),
        sensor_bias_enabled=data.get("sensor_bias_enabled", False),
        threat_type=data["threat_type"],
        difficulty=data["difficulty"],
        sensor_state=data["sensor_state"],
        sensor_reliability=data["sensor_reliability"],
        clutter_density=data["clutter_density"],
        target_count=data["target_count"],
        track_source_type=data["track_source_type"],
        target_definitions=data["target_definitions"]
    )
    db.add(db_scenario)
    db.commit()
    db.refresh(db_scenario)

    return db_scenario


@app.get("/api/scenarios/{scenario_id}")
def get_scenario(scenario_id: str, db: Session = Depends(get_db)):
    scn = db.query(Scenario).filter(Scenario.id == scenario_id).first()
    if not scn:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scn


# -------------------------------------------------------------
# 4. Live Session & Telemetry Stream
# -------------------------------------------------------------
@app.post("/api/sessions/start")
def start_session(payload: SessionStartRequest, db: Session = Depends(get_db)):
    scn = db.query(Scenario).filter(Scenario.id == payload.scenario_id).first()
    if not scn:
        raise HTTPException(status_code=404, detail="Scenario not found")

    session_id = f"SES-{uuid.uuid4().hex[:8].upper()}"
    new_session = DbSession(
        id=session_id,
        trainee_id=payload.trainee_id,
        scenario_id=payload.scenario_id,
        started_at=datetime.utcnow(),
        status="in_progress"
    )
    db.add(new_session)
    db.commit()

    # Pre-warm sim source
    scenario_dict = {
        "seed": scn.seed,
        "threat_type": scn.threat_type,
        "difficulty": scn.difficulty,
        "sensor_state": scn.sensor_state,
        "sensor_reliability": scn.sensor_reliability,
        "terrain": scn.terrain,
        "time_of_day": scn.time_of_day,
        "clutter_density": scn.clutter_density,
        "track_source_type": scn.track_source_type,
        "definitions": scn.target_definitions
    }
    get_or_create_sim_source(session_id, scenario_dict)

    return {
        "session_id": session_id,
        "trainee_id": payload.trainee_id,
        "scenario": {
            "id": scn.id,
            "title": scn.title,
            "seed": scn.seed,
            "terrain": scn.terrain,
            "time_of_day": scn.time_of_day,
            "threat_type": scn.threat_type,
            "difficulty": scn.difficulty,
            "sensor_state": scn.sensor_state,
            "sensor_reliability": scn.sensor_reliability,
            "target_count": scn.target_count
        }
    }


@app.get("/api/sessions/{session_id}/tracks")
def get_session_tracks(
    session_id: str,
    t: float = Query(0.0, description="Elapsed simulation time in seconds"),
    db: Session = Depends(get_db)
):
    ses = db.query(DbSession).filter(DbSession.id == session_id).first()
    if not ses:
        raise HTTPException(status_code=404, detail="Session not found")

    scn = ses.scenario
    scenario_dict = {
        "seed": scn.seed,
        "threat_type": scn.threat_type,
        "difficulty": scn.difficulty,
        "sensor_state": scn.sensor_state,
        "sensor_reliability": scn.sensor_reliability,
        "terrain": scn.terrain,
        "time_of_day": scn.time_of_day,
        "clutter_density": scn.clutter_density,
        "track_source_type": scn.track_source_type,
        "definitions": scn.target_definitions
    }
    source, sensor_model = get_or_create_sim_source(session_id, scenario_dict)

    ground_truth = source.get_ground_truth(t)
    scn_weather = getattr(scn, "weather", "clear") or "clear"
    scn_jamming = getattr(scn, "jamming_level", 0.0) or 0.0
    scn_bias = bool(getattr(scn, "sensor_bias_enabled", False))

    observed_tracks = sensor_model.process(
        ground_truth=ground_truth,
        elapsed_seconds=t,
        sensor_state=scn.sensor_state,
        sensor_reliability=scn.sensor_reliability,
        terrain=scn.terrain,
        time_of_day=scn.time_of_day,
        clutter_density=scn.clutter_density,
        weather=scn_weather,
        jamming_level=scn_jamming,
        sensor_bias_enabled=scn_bias
    )

    return {
        "session_id": session_id,
        "elapsed_seconds": round(t, 2),
        "tracks": [trk.model_dump() for trk in observed_tracks],
        "sensor_plots": [plt.model_dump() for plt in getattr(sensor_model, "last_sensor_plots", [])],
        "active_target_count": len([gt for gt in ground_truth if gt.is_active]),
        "total_targets": len(scn.target_definitions)
    }


@app.get("/api/sessions/{session_id}/sensor-plots")
def get_session_sensor_plots(
    session_id: str,
    t: float = Query(0.0, description="Elapsed simulation time in seconds"),
    db: Session = Depends(get_db)
):
    ses = db.query(DbSession).filter(DbSession.id == session_id).first()
    if not ses:
        raise HTTPException(status_code=404, detail="Session not found")

    scn = ses.scenario
    scenario_dict = {
        "seed": scn.seed,
        "threat_type": scn.threat_type,
        "difficulty": scn.difficulty,
        "sensor_state": scn.sensor_state,
        "sensor_reliability": scn.sensor_reliability,
        "terrain": scn.terrain,
        "time_of_day": scn.time_of_day,
        "clutter_density": scn.clutter_density,
        "track_source_type": scn.track_source_type,
        "definitions": scn.target_definitions
    }
    source, sensor_model = get_or_create_sim_source(session_id, scenario_dict)
    ground_truth = source.get_ground_truth(t)

    scn_weather = getattr(scn, "weather", "clear") or "clear"
    scn_jamming = getattr(scn, "jamming_level", 0.0) or 0.0
    scn_bias = bool(getattr(scn, "sensor_bias_enabled", False))

    plots = sensor_model.process_sensor_plots(
        ground_truth=ground_truth,
        elapsed_seconds=t,
        sensor_state=scn.sensor_state,
        sensor_reliability=scn.sensor_reliability,
        terrain=scn.terrain,
        time_of_day=scn.time_of_day,
        weather=scn_weather,
        jamming_level=scn_jamming,
        sensor_bias_enabled=scn_bias
    )

    return {
        "session_id": session_id,
        "elapsed_seconds": round(t, 2),
        "sensor_plots": [p.model_dump() for p in plots],
        "sensor_summary": {
            "radar_count": len([p for p in plots if p.sensor_type == "radar"]),
            "acoustic_count": len([p for p in plots if p.sensor_type == "acoustic"]),
            "camera_eo_count": len([p for p in plots if p.sensor_type == "camera_eo"]),
            "camera_thermal_count": len([p for p in plots if p.sensor_type == "camera_thermal"]),
            "rf_count": len([p for p in plots if p.sensor_type == "rf"])
        }
    }


@app.post("/api/sessions/{session_id}/events")
def record_event(session_id: str, payload: SessionEventRequest, db: Session = Depends(get_db)):
    ses = db.query(DbSession).filter(DbSession.id == session_id).first()
    if not ses:
        raise HTTPException(status_code=404, detail="Session not found")

    # Find or create target event
    ev = db.query(TargetEvent).filter(
        TargetEvent.session_id == session_id,
        TargetEvent.target_id == payload.target_id
    ).first()

    # Find target ground truth class from scenario
    true_class = "hostile"
    for td in ses.scenario.target_definitions:
        if td.get("id") == payload.target_id:
            true_class = td.get("target_class", "hostile")
            break

    if not ev:
        ev = TargetEvent(
            session_id=session_id,
            target_id=payload.target_id,
            true_class=true_class
        )
        db.add(ev)

    if payload.action_type == "detect":
        ev.detected_at = payload.elapsed_seconds
    elif payload.action_type == "classify":
        ev.trainee_classification = payload.classification
        ev.classified_at = payload.elapsed_seconds
        ev.ai_followed = payload.ai_followed
    elif payload.action_type == "respond":
        ev.trainee_response = payload.response
        ev.responded_at = payload.elapsed_seconds

    db.commit()
    return {"status": "event_recorded", "event_id": ev.id}


# -------------------------------------------------------------
# 5. Session Completion, Scoring & AAR
# -------------------------------------------------------------
@app.post("/api/sessions/{session_id}/complete")
def complete_session(session_id: str, payload: SessionCompleteRequest, db: Session = Depends(get_db)):
    ses = db.query(DbSession).filter(DbSession.id == session_id).first()
    if not ses:
        raise HTTPException(status_code=404, detail="Session not found")

    ses.status = "completed"
    ses.completed_at = datetime.utcnow()
    ses.duration_seconds = payload.duration_seconds

    # Run decision-tree scoring
    score_result = scoring_engine.calculate_score(
        scenario_targets=ses.scenario.target_definitions,
        events=payload.events,
        difficulty=ses.scenario.difficulty
    )

    # Persist score
    coach_text = " | ".join(score_result.feedback_notes)
    db_score = Score(
        session_id=session_id,
        total_score=score_result.total_score,
        detection_score=score_result.detection_score,
        classification_score=score_result.classification_score,
        decision_score=score_result.decision_score,
        calibration_score=score_result.calibration_score,
        overconfidence_index=score_result.overconfidence_index,
        avg_detection_latency=score_result.avg_detection_latency,
        classification_accuracy=score_result.classification_accuracy,
        optimal_decisions_pct=score_result.optimal_decisions_pct,
        dangerous_errors_count=score_result.dangerous_errors_count,
        missed_detections_count=score_result.missed_detections_count,
        ai_assist_agreement_pct=score_result.ai_assist_agreement_pct,
        coach_feedback=coach_text
    )
    db.add(db_score)

    # Persist target event evaluations
    for td in score_result.target_details:
        ev = db.query(TargetEvent).filter(
            TargetEvent.session_id == session_id,
            TargetEvent.target_id == td.target_id
        ).first()
        if not ev:
            ev = TargetEvent(
                session_id=session_id,
                target_id=td.target_id,
                true_class=td.true_class
            )
            db.add(ev)

        ev.detected_at = td.detection_latency
        ev.trainee_classification = td.trainee_classification
        ev.trainee_response = td.trainee_response
        ev.decision_outcome = td.decision_outcome
        ev.decision_path = td.decision_path
        ev.reason_code = td.reason_code
        ev.confidence_rating = td.confidence_rating
        ev.cross_checked = td.cross_checked
        ev.score_points = td.decision_score_pts

    # Evaluate Adaptive Difficulty progression
    trainee = db.query(Trainee).filter(Trainee.id == ses.trainee_id).first()
    if trainee:
        past_scores = [
            s.total_score for s in db.query(Score).join(DbSession).filter(
                DbSession.trainee_id == trainee.id,
                DbSession.status == "completed"
            ).order_by(Score.created_at.asc()).all()
        ]
        past_scores.append(score_result.total_score)

        new_diff, diff_reason = adaptive_engine.evaluate_next_difficulty(
            current_difficulty=trainee.current_difficulty,
            recent_scores=past_scores
        )
        if new_diff != trainee.current_difficulty:
            dh = DifficultyHistory(
                trainee_id=trainee.id,
                previous_difficulty=trainee.current_difficulty,
                new_difficulty=new_diff,
                reason=diff_reason
            )
            db.add(dh)
            trainee.current_difficulty = new_diff

    # Update Bayesian Knowledge Tracing (BKT) 6-Skill Profiles
    existing_skills = db.query(SkillProfile).filter(SkillProfile.trainee_id == ses.trainee_id).all()
    current_map = {sp.skill_key: sp.mastery_prob for sp in existing_skills}

    scenario_meta = {
        "threat_type": ses.scenario.threat_type,
        "difficulty": ses.scenario.difficulty,
        "weather": getattr(ses.scenario, "weather", "clear"),
        "clutter_density": getattr(ses.scenario, "clutter_density", 0.05)
    }
    updated_bkt = adaptive_engine.update_bkt_skill_profiles(
        current_mastery_map=current_map,
        target_details=score_result.target_details,
        scenario_meta=scenario_meta
    )
    for skill_key, pdata in updated_bkt.items():
        sp = next((s for s in existing_skills if s.skill_key == skill_key), None)
        if not sp:
            sp = SkillProfile(
                trainee_id=ses.trainee_id,
                skill_key=skill_key,
                mastery_prob=pdata["current_mastery"],
                trials_count=pdata["trials_evaluated"],
                last_updated=datetime.utcnow()
            )
            db.add(sp)
        else:
            sp.mastery_prob = pdata["current_mastery"]
            sp.trials_count += pdata["trials_evaluated"]
            sp.last_updated = datetime.utcnow()

    # Schedule Retention Retests (+3 days and +7 days)
    weakest_skill = min(updated_bkt.keys(), key=lambda k: updated_bkt[k]["current_mastery"])
    now = datetime.utcnow()
    retest_3d = ScheduledRetest(
        trainee_id=ses.trainee_id,
        skill_key=weakest_skill,
        scenario_id=ses.scenario_id,
        interval_days=3,
        due_date=now + timedelta(days=3),
        completed=False
    )
    retest_7d = ScheduledRetest(
        trainee_id=ses.trainee_id,
        skill_key=weakest_skill,
        scenario_id=ses.scenario_id,
        interval_days=7,
        due_date=now + timedelta(days=7),
        completed=False
    )
    db.add(retest_3d)
    db.add(retest_7d)

    db.commit()

    # Clean active simulation cache
    if session_id in active_sim_sessions:
        del active_sim_sessions[session_id]

    return {
        "status": "completed",
        "session_id": session_id,
        "score": score_result.model_dump()
    }


@app.get("/api/sessions/{session_id}/aar")
def get_session_aar(session_id: str, db: Session = Depends(get_db)):
    ses = db.query(DbSession).filter(DbSession.id == session_id).first()
    if not ses:
        raise HTTPException(status_code=404, detail="Session not found")

    if not ses.score:
        raise HTTPException(status_code=400, detail="Session has not been scored yet")

    # Fetch past sessions for data-driven coaching
    past_sessions = db.query(DbSession).filter(
        DbSession.trainee_id == ses.trainee_id,
        DbSession.status == "completed"
    ).all()

    history_dicts = []
    for s in past_sessions:
        if s.score:
            history_dicts.append({
                "conditions": {
                    "time_of_day": s.scenario.time_of_day,
                    "threat_type": s.scenario.threat_type,
                    "sensor_state": s.scenario.sensor_state
                },
                "accuracy": s.score.classification_accuracy,
                "dangerous_errors": s.score.dangerous_errors_count
            })

    coaching_summary = generate_data_driven_coaching(history_dicts)

    # Fetch event details
    events = db.query(TargetEvent).filter(TargetEvent.session_id == session_id).all()
    event_list = [
        {
            "target_id": e.target_id,
            "true_class": e.true_class,
            "detected_at": e.detected_at,
            "trainee_classification": e.trainee_classification,
            "trainee_response": e.trainee_response,
            "decision_outcome": e.decision_outcome,
            "decision_path": e.decision_path,
            "reason_code": getattr(e, "reason_code", "OPTIMAL_ENGAGEMENT"),
            "confidence_rating": getattr(e, "confidence_rating", 4),
            "cross_checked": getattr(e, "cross_checked", False),
            "score_points": e.score_points,
            "ai_followed": e.ai_followed
        } for e in events
    ]

    # Latest difficulty adjustment
    dh = db.query(DifficultyHistory).filter(DifficultyHistory.trainee_id == ses.trainee_id).order_by(DifficultyHistory.evaluated_at.desc()).first()

    return {
        "session_id": ses.id,
        "trainee": {
            "id": ses.trainee.id,
            "callsign": ses.trainee.callsign,
            "rank": ses.trainee.rank,
            "unit": ses.trainee.unit.name,
            "current_difficulty": ses.trainee.current_difficulty
        },
        "scenario": {
            "id": ses.scenario.id,
            "title": ses.scenario.title,
            "seed": ses.scenario.seed,
            "terrain": ses.scenario.terrain,
            "time_of_day": ses.scenario.time_of_day,
            "threat_type": ses.scenario.threat_type,
            "difficulty": ses.scenario.difficulty,
            "sensor_state": ses.scenario.sensor_state,
            "sensor_reliability": ses.scenario.sensor_reliability,
            "target_count": ses.scenario.target_count,
            "target_definitions": ses.scenario.target_definitions
        },
        "duration_seconds": ses.duration_seconds,
        "score": {
            "total_score": ses.score.total_score,
            "detection_score": ses.score.detection_score,
            "classification_score": ses.score.classification_score,
            "decision_score": ses.score.decision_score,
            "calibration_score": getattr(ses.score, "calibration_score", 100.0),
            "overconfidence_index": getattr(ses.score, "overconfidence_index", 0.0),
            "avg_detection_latency": ses.score.avg_detection_latency,
            "classification_accuracy": ses.score.classification_accuracy,
            "optimal_decisions_pct": ses.score.optimal_decisions_pct,
            "dangerous_errors_count": ses.score.dangerous_errors_count,
            "missed_detections_count": ses.score.missed_detections_count,
            "ai_assist_agreement_pct": ses.score.ai_assist_agreement_pct,
            "coach_feedback": ses.score.coach_feedback
        },
        "ai_coaching_analysis": coaching_summary,
        "difficulty_change_reason": dh.reason if dh else "Operating at standard tactical difficulty.",
        "target_events": event_list
    }


# -------------------------------------------------------------
# 6. Analytics & Dashboards (Trainee & Unit Aggregates)
# -------------------------------------------------------------
@app.get("/api/trainees/{trainee_id}/history")
def get_trainee_history(trainee_id: str, db: Session = Depends(get_db)):
    trainee = db.query(Trainee).filter(Trainee.id == trainee_id).first()
    if not trainee:
        raise HTTPException(status_code=404, detail="Trainee not found")

    sessions = db.query(DbSession).filter(
        DbSession.trainee_id == trainee_id,
        DbSession.status == "completed"
    ).order_by(DbSession.started_at.asc()).all()

    timeline = []
    for s in sessions:
        if s.score:
            timeline.append({
                "session_id": s.id,
                "date": s.started_at.strftime("%Y-%m-%d %H:%M"),
                "scenario_title": s.scenario.title,
                "difficulty": s.scenario.difficulty,
                "terrain": s.scenario.terrain,
                "time_of_day": s.scenario.time_of_day,
                "total_score": s.score.total_score,
                "detection_score": s.score.detection_score,
                "classification_score": s.score.classification_score,
                "decision_score": s.score.decision_score,
                "avg_detection_latency": s.score.avg_detection_latency,
                "accuracy": s.score.classification_accuracy,
                "dangerous_errors": s.score.dangerous_errors_count
            })

    return {
        "trainee": {
            "id": trainee.id,
            "callsign": trainee.callsign,
            "rank": trainee.rank,
            "unit": trainee.unit.name,
            "current_difficulty": trainee.current_difficulty
        },
        "total_sorties": len(timeline),
        "history": timeline
    }


@app.get("/api/units/{unit_id}/aggregate")
def get_unit_aggregate(unit_id: str, db: Session = Depends(get_db)):
    unit = db.query(Unit).filter(Unit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    trainees = unit.trainees
    all_scores: List[Score] = []
    trainee_summaries = []

    for tr in trainees:
        tr_scores = [s.score for s in tr.sessions if s.score is not None]
        all_scores.extend(tr_scores)
        avg_s = round(sum(s.total_score for s in tr_scores) / len(tr_scores), 1) if tr_scores else 0.0
        trainee_summaries.append({
            "trainee_id": tr.id,
            "callsign": tr.callsign,
            "rank": tr.rank,
            "difficulty": tr.current_difficulty,
            "sorties_count": len(tr_scores),
            "average_score": avg_s
        })

    if all_scores:
        unit_avg_score = round(sum(s.total_score for s in all_scores) / len(all_scores), 1)
        unit_avg_latency = round(sum(s.avg_detection_latency for s in all_scores) / len(all_scores), 2)
        unit_avg_acc = round(sum(s.classification_accuracy for s in all_scores) / len(all_scores) * 100, 1)
        total_dangerous_errors = sum(s.dangerous_errors_count for s in all_scores)
    else:
        unit_avg_score = 0.0
        unit_avg_latency = 0.0
        unit_avg_acc = 0.0
        total_dangerous_errors = 0

    return {
        "unit": {
            "id": unit.id,
            "name": unit.name,
            "base_location": unit.base_location
        },
        "active_personnel": len(trainees),
        "total_missions_completed": len(all_scores),
        "unit_average_score": unit_avg_score,
        "unit_average_detection_latency": unit_avg_latency,
        "unit_classification_accuracy_pct": unit_avg_acc,
        "total_dangerous_errors": total_dangerous_errors,
        "readiness_index": "COMBAT READY" if unit_avg_score >= 75 else ("OPERATIONAL" if unit_avg_score >= 60 else "NEEDS TRAINING"),
        "personnel": trainee_summaries
    }


# -------------------------------------------------------------
# 7. Real scikit-learn AI Assist Inference
# -------------------------------------------------------------
@app.post("/api/ai/predict", response_model=AIAssistResponse)
def get_ai_prediction(payload: AIAssistRequest):
    result = ai_assist_instance.predict_target(
        speed=payload.speed,
        altitude=payload.altitude,
        range_m=payload.range_m,
        rcs_estimate=payload.rcs_estimate,
        rf_frequency=payload.rf_frequency,
        time_of_day=payload.time_of_day,
        sensor_state=payload.sensor_state
    )
    return AIAssistResponse(
        suggested_class=result["suggested_class"],
        confidence=result["confidence"],
        entropy=result.get("entropy", 0.0),
        uncertainty_score=result.get("uncertainty_score", 0.0),
        is_uncertain=result.get("is_uncertain", False),
        class_probabilities=result.get("class_probabilities", {}),
        explanation=result["explanation"],
        feature_importance=result["feature_importance"],
        held_out_model_accuracy=result.get("held_out_model_accuracy", 88.0)
    )


# -------------------------------------------------------------
# 8. Top 3 Innovation Endpoints: Per-Skill Adaptive & Swarm Resolution
# -------------------------------------------------------------
@app.get("/api/adaptive/per-skill/{trainee_id}")
def get_per_skill_adaptive_profile(trainee_id: str, db: Session = Depends(get_db)):
    trainee = db.query(Trainee).filter(Trainee.id == trainee_id).first()
    if not trainee:
        raise HTTPException(status_code=404, detail="Trainee not found")

    events = db.query(TargetEvent).join(DbSession).filter(
        DbSession.trainee_id == trainee_id
    ).all()

    event_dicts = [
        {
            "target_id": e.target_id,
            "true_class": e.true_class,
            "trainee_classification": e.trainee_classification,
            "trainee_response": e.trainee_response,
            "decision_outcome": e.decision_outcome,
            "detection_latency": e.detected_at,
            "action": e.trainee_response or "",
            "is_swarm_trap": "SWM" in e.target_id or "MERGED" in e.target_id
        }
        for e in events
    ]

    profile = adaptive_engine.evaluate_per_skill_profile(event_dicts)
    return {
        "trainee": {
            "id": trainee.id,
            "callsign": trainee.callsign,
            "rank": trainee.rank,
            "difficulty": trainee.current_difficulty
        },
        "per_skill_analysis": profile
    }


@app.get("/api/trainees/{trainee_id}/skills")
def get_trainee_skills(trainee_id: str, db: Session = Depends(get_db)):
    trainee = db.query(Trainee).filter(Trainee.id == trainee_id).first()
    if not trainee:
        raise HTTPException(status_code=404, detail="Trainee not found")

    skills = db.query(SkillProfile).filter(SkillProfile.trainee_id == trainee_id).all()
    skill_map = {s.skill_key: s for s in skills}

    results = []
    for k in CORE_SKILLS:
        sp = skill_map.get(k)
        prob = sp.mastery_prob if sp else adaptive_engine.bkt.p_l0
        trials = sp.trials_count if sp else 0
        exp_success = adaptive_engine.bkt.expected_success_rate(prob)
        results.append({
            "skill_key": k,
            "display_name": SKILL_DISPLAY_NAMES[k],
            "mastery_prob": prob,
            "mastery_pct": round(prob * 100, 1),
            "expected_success_rate": round(exp_success * 100, 1),
            "trials_count": trials,
            "is_mastered": prob >= 0.70
        })

    weakest = min(results, key=lambda s: s["mastery_prob"])
    return {
        "trainee_id": trainee_id,
        "skills": results,
        "weakest_skill": weakest["skill_key"],
        "weakest_skill_name": weakest["display_name"]
    }


@app.get("/api/trainees/{trainee_id}/next-scenario")
def get_next_recommended_scenario(
    trainee_id: str,
    mode: str = Query("ADAPTIVE", description="ADAPTIVE or FIXED_SEQUENCE"),
    db: Session = Depends(get_db)
):
    trainee = db.query(Trainee).filter(Trainee.id == trainee_id).first()
    if not trainee:
        raise HTTPException(status_code=404, detail="Trainee not found")

    completed_count = db.query(DbSession).filter(
        DbSession.trainee_id == trainee_id,
        DbSession.status == "completed"
    ).count()

    skills = db.query(SkillProfile).filter(SkillProfile.trainee_id == trainee_id).all()
    skill_map = {s.skill_key: s.mastery_prob for s in skills}

    recommendation = adaptive_engine.select_next_scenario(
        skill_mastery_map=skill_map,
        completed_sessions_count=completed_count,
        mode=mode
    )

    return recommendation


@app.get("/api/trainees/{trainee_id}/retests")
def get_trainee_retests(trainee_id: str, db: Session = Depends(get_db)):
    retests = db.query(ScheduledRetest).filter(
        ScheduledRetest.trainee_id == trainee_id
    ).order_by(ScheduledRetest.due_date.asc()).all()

    now = datetime.utcnow()
    return [
        {
            "id": r.id,
            "skill_key": r.skill_key,
            "skill_name": SKILL_DISPLAY_NAMES.get(r.skill_key, r.skill_key),
            "scenario_id": r.scenario_id,
            "interval_days": r.interval_days,
            "due_date": r.due_date.isoformat(),
            "completed": r.completed,
            "is_due_now": r.due_date <= now
        } for r in retests
    ]


@app.post("/api/retests/simulate-time")
def simulate_time_advance(days: int = Query(3, description="Number of days to advance retention clock"), db: Session = Depends(get_db)):
    """Simulates moving the clock forward to test 3-day and 7-day retention retests."""
    retests = db.query(ScheduledRetest).all()
    for r in retests:
        r.due_date = r.due_date - timedelta(days=days)
    db.commit()
    now = datetime.utcnow()
    due_now_count = len([r for r in retests if r.due_date <= now and not r.completed])
    return {
        "status": "time_advanced",
        "days_advanced": days,
        "due_retests_count": due_now_count
    }


# -------------------------------------------------------------
# 9. Instructor Console: ROE & Scoring Configuration Editor
# -------------------------------------------------------------
@app.get("/api/instructor/roe")
def get_instructor_roe():
    """Returns current ROE decision rules and scoring weights configuration."""
    rules_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "decision_rules.json")
    if os.path.exists(rules_path):
        with open(rules_path, "r") as f:
            data = json.load(f)
        return data
    return scoring_engine.config


@app.post("/api/instructor/roe")
def update_instructor_roe(payload: Dict[str, Any]):
    """Validates and saves updated ROE decision rules and scoring weights, reloading the scoring engine."""
    rules_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "decision_rules.json")

    # Validation
    if "weights" not in payload:
        raise HTTPException(status_code=400, detail="Missing 'weights' in ROE payload")
    if "rules" not in payload:
        raise HTTPException(status_code=400, detail="Missing 'rules' in ROE payload")

    with open(rules_path, "w") as f:
        json.dump(payload, f, indent=2)

    # Hot reload scoring engine
    global scoring_engine
    scoring_engine = ScoringEngine(rules_path)

    return {
        "status": "updated",
        "rules_count": len(payload.get("rules", [])),
        "weights": payload.get("weights"),
        "critical_range_m": payload.get("critical_range_m")
    }


@app.get("/api/instructor/overview")
def get_instructor_overview(db: Session = Depends(get_db)):
    """Provides instructor-level oversight across all units, trainees, and retention retests."""
    trainees = db.query(Trainee).all()
    trainee_overviews = []
    for tr in trainees:
        skills = db.query(SkillProfile).filter(SkillProfile.trainee_id == tr.id).all()
        skill_map = {s.skill_key: round(s.mastery_prob * 100, 1) for s in skills}
        completed_sessions = db.query(DbSession).filter(DbSession.trainee_id == tr.id, DbSession.status == "completed").count()
        avg_score = db.query(Score).join(DbSession).filter(DbSession.trainee_id == tr.id).all()
        mean_score = round(sum(s.total_score for s in avg_score) / len(avg_score), 1) if avg_score else 0.0

        due_retests = db.query(ScheduledRetest).filter(
            ScheduledRetest.trainee_id == tr.id,
            ScheduledRetest.due_date <= datetime.utcnow(),
            ScheduledRetest.completed == False
        ).count()

        trainee_overviews.append({
            "id": tr.id,
            "callsign": tr.callsign,
            "rank": tr.rank,
            "unit": tr.unit.name if tr.unit else "Unknown",
            "current_difficulty": tr.current_difficulty,
            "completed_sessions": completed_sessions,
            "mean_score": mean_score,
            "skills": skill_map,
            "due_retests_count": due_retests
        })

    return {
        "total_trainees": len(trainees),
        "active_units": db.query(Unit).count(),
        "trainees": trainee_overviews
    }


# Static build mounting for production/Render deployment
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("api") or full_path.startswith("ws") or full_path.startswith("docs") or full_path.startswith("openapi.json"):
            raise HTTPException(status_code=404, detail="Not Found")
        target_file = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(target_file):
            return FileResponse(target_file)
        index_file = os.path.join(frontend_dist, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend build index.html not found")




