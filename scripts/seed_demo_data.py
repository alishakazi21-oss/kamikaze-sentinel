import os
import sys
import random
from datetime import datetime, timedelta

# Ensure repo root is in python path
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from backend.app.database import engine, Base, SessionLocal
from backend.app.models import Unit, Trainee, Scenario, Session, TargetEvent, Score, DifficultyHistory
from backend.app.scenario_engine import ScenarioEngine
from backend.app.scoring import ScoringEngine
from backend.app.adaptive import AdaptiveDifficultyEngine


def seed_database():
    print("[*] Initializing database schema...")
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    # Clear existing demo data
    db.query(Score).delete()
    db.query(TargetEvent).delete()
    db.query(DifficultyHistory).delete()
    db.query(Session).delete()
    db.query(Scenario).delete()
    db.query(Trainee).delete()
    db.query(Unit).delete()
    db.commit()

    print("[*] Creating military units and trainees...")
    unit_alpha = Unit(
        id="UNIT-ALPHA",
        name="12th Garud Air Defense Squadron",
        base_location="Forward Air Base Ambala (Western Sector)"
    )
    unit_bravo = Unit(
        id="UNIT-BRAVO",
        name="45th Army Air Defense (AAD) Counter-UAS Battery",
        base_location="Eastern Sector Corps Tezpur"
    )
    db.add_all([unit_alpha, unit_bravo])
    db.commit()

    trainees = [
        Trainee(id="TR-101", unit_id="UNIT-ALPHA", callsign="Viper-1", rank="Flight Lieutenant", current_difficulty=3),
        Trainee(id="TR-102", unit_id="UNIT-ALPHA", callsign="Hawk-Eye", rank="Flying Officer", current_difficulty=2),
        Trainee(id="TR-103", unit_id="UNIT-ALPHA", callsign="Falcon-Lead", rank="Squadron Leader", current_difficulty=3),
        Trainee(id="TR-201", unit_id="UNIT-BRAVO", callsign="Trishul-1", rank="Captain", current_difficulty=2),
        Trainee(id="TR-202", unit_id="UNIT-BRAVO", callsign="Rudra-2", rank="Lieutenant", current_difficulty=1),
        Trainee(id="TR-203", unit_id="UNIT-BRAVO", callsign="Tejas-Lead", rank="Major", current_difficulty=3),
    ]
    db.add_all(trainees)
    db.commit()

    scoring_engine = ScoringEngine()
    adaptive_engine = AdaptiveDifficultyEngine()

    threat_pool = ["single", "swarm_wedge", "swarm_leader", "decoy_mixed"]
    terrain_pool = ["urban", "rural", "border", "coastal"]
    time_pool = ["day", "dusk", "night"]

    total_sessions_created = 0
    now = datetime.utcnow()

    print("[*] Running headless simulation and scoring pipeline across 28 realistic sessions...")

    for tr_idx, trainee in enumerate(trainees):
        # 4 to 5 sessions per trainee with an upward learning curve
        session_count = 5 if tr_idx < 4 else 4
        current_diff = 1

        for s_idx in range(session_count):
            # Performance trend improves over sessions
            progress_factor = s_idx / float(session_count)  # 0.0 to 0.8
            base_skill = 0.55 + (tr_idx % 3) * 0.10
            skill = min(0.96, base_skill + progress_factor * 0.35 + random.uniform(-0.05, 0.05))

            terrain = terrain_pool[(s_idx + tr_idx) % len(terrain_pool)]
            time_of_day = time_pool[(s_idx * 2 + tr_idx) % len(time_pool)]
            threat_type = threat_pool[(s_idx + tr_idx) % len(threat_pool)]

            sensor_state = "normal"
            sensor_reliability = 1.0
            if current_diff == 2 and random.random() < 0.5:
                sensor_state = "degraded"
                sensor_reliability = 0.85
            elif current_diff == 3:
                sensor_state = random.choice(["degraded", "jammed"])
                sensor_reliability = 0.70

            target_count = 3 + current_diff * 2

            # Generate real scenario
            seed_val = 1000 + tr_idx * 50 + s_idx
            scn_data = ScenarioEngine.generate_scenario(
                title=f"Sortie {s_idx+1}: {threat_type.upper().replace('_', ' ')} over {terrain.title()}",
                seed=seed_val,
                terrain=terrain,
                time_of_day=time_of_day,
                threat_type=threat_type,
                difficulty=current_diff,
                sensor_state=sensor_state,
                sensor_reliability=sensor_reliability,
                target_count=target_count
            )

            db_scenario = Scenario(
                id=scn_data["id"],
                title=scn_data["title"],
                seed=scn_data["seed"],
                terrain=scn_data["terrain"],
                time_of_day=scn_data["time_of_day"],
                threat_type=scn_data["threat_type"],
                difficulty=scn_data["difficulty"],
                sensor_state=scn_data["sensor_state"],
                sensor_reliability=scn_data["sensor_reliability"],
                clutter_density=scn_data["clutter_density"],
                target_count=scn_data["target_count"],
                track_source_type="native",
                target_definitions=scn_data["target_definitions"]
            )
            db.add(db_scenario)
            db.commit()

            # Session timing (staggered in past days)
            days_ago = (len(trainees) - tr_idx) * 4 + (session_count - s_idx)
            started_at = now - timedelta(days=days_ago, hours=s_idx * 2, minutes=random.randint(10, 50))
            duration_sec = 45.0 + random.uniform(5.0, 25.0)

            db_session = Session(
                id=f"SES-SEED-{tr_idx+1:02d}-{s_idx+1:02d}",
                trainee_id=trainee.id,
                scenario_id=db_scenario.id,
                started_at=started_at,
                completed_at=started_at + timedelta(seconds=duration_sec),
                duration_seconds=round(duration_sec, 1),
                status="completed"
            )
            db.add(db_session)
            db.commit()

            # Simulate trainee responses based on skill level
            simulated_events = []
            for tgt in db_scenario.target_definitions:
                tid = tgt["id"]
                true_cls = tgt["target_class"]
                start_t = tgt.get("start_time", 0.0)

                # Detection latency (faster as skill improves)
                latency = max(1.2, (8.0 - skill * 5.0) + random.uniform(-1.0, 1.2))
                det_time = start_t + latency

                # Classification accuracy based on skill
                if random.random() < skill:
                    chosen_class = true_cls
                else:
                    alt_classes = [c for c in ["hostile", "friendly", "civil", "false_alarm"] if c != true_cls]
                    chosen_class = random.choice(alt_classes)

                # Response selection based on classification and skill
                if chosen_class == "hostile":
                    chosen_resp = "authorise_protective_response" if (random.random() < 0.85) else "raise_alert"
                elif chosen_class == "friendly":
                    chosen_resp = "continue_monitoring" if (random.random() < 0.88) else "request_verification"
                elif chosen_class == "civil":
                    chosen_resp = "request_verification" if (random.random() < 0.82) else "raise_alert"
                else:
                    chosen_resp = "continue_monitoring"

                ai_agreed = (random.random() < 0.85)
                simulated_events.append({
                    "target_id": tid,
                    "detected_at": det_time,
                    "trainee_classification": chosen_class,
                    "trainee_response": chosen_resp,
                    "proximity_m": random.uniform(800, 2200),
                    "ai_suggested_class": true_cls,
                    "ai_followed": ai_agreed
                })

            # Run real scoring engine
            score_res = scoring_engine.calculate_score(
                scenario_targets=db_scenario.target_definitions,
                events=simulated_events,
                difficulty=current_diff
            )

            # Store score
            db_score = Score(
                session_id=db_session.id,
                total_score=score_res.total_score,
                detection_score=score_res.detection_score,
                classification_score=score_res.classification_score,
                decision_score=score_res.decision_score,
                avg_detection_latency=score_res.avg_detection_latency,
                classification_accuracy=score_res.classification_accuracy,
                optimal_decisions_pct=score_res.optimal_decisions_pct,
                dangerous_errors_count=score_res.dangerous_errors_count,
                missed_detections_count=score_res.missed_detections_count,
                ai_assist_agreement_pct=score_res.ai_assist_agreement_pct,
                coach_feedback=" | ".join(score_res.feedback_notes),
                created_at=started_at + timedelta(seconds=duration_sec)
            )
            db.add(db_score)

            # Store target events
            for td in score_res.target_details:
                ev_record = TargetEvent(
                    session_id=db_session.id,
                    target_id=td.target_id,
                    true_class=td.true_class,
                    detected_at=td.detection_latency,
                    trainee_classification=td.trainee_classification,
                    trainee_response=td.trainee_response,
                    decision_outcome=td.decision_outcome,
                    decision_path=td.decision_path,
                    score_points=td.decision_score_pts,
                    ai_followed=td.ai_followed
                )
                db.add(ev_record)

            # Check difficulty progression
            past_scores = [s.total_score for s in db.query(Score).join(Session).filter(Session.trainee_id == trainee.id).all()]
            new_diff, diff_reason = adaptive_engine.evaluate_next_difficulty(current_diff, past_scores)
            if new_diff != current_diff:
                dh = DifficultyHistory(
                    trainee_id=trainee.id,
                    previous_difficulty=current_diff,
                    new_difficulty=new_diff,
                    reason=diff_reason,
                    evaluated_at=started_at + timedelta(seconds=duration_sec + 2)
                )
                db.add(dh)
                current_diff = new_diff

            total_sessions_created += 1

        trainee.current_difficulty = current_diff
        db.commit()

    print(f"[+] Successfully seeded database with {total_sessions_created} realistic training sessions across 2 units and 6 trainees!")
    db.close()


if __name__ == "__main__":
    seed_database()
