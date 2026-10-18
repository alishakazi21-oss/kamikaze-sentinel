from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from .database import Base


class Unit(Base):
    __tablename__ = "units"

    id = Column(String, primary_key=True, index=True)  # e.g., "UNIT-ALPHA", "UNIT-BRAVO"
    name = Column(String, nullable=False)
    base_location = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    trainees = relationship("Trainee", back_populates="unit")


class Trainee(Base):
    __tablename__ = "trainees"

    id = Column(String, primary_key=True, index=True)  # e.g., "TR-101", "TR-102"
    unit_id = Column(String, ForeignKey("units.id"), nullable=False)
    callsign = Column(String, nullable=False)
    rank = Column(String, nullable=False)
    current_difficulty = Column(Integer, default=1)  # 1: Cadet, 2: Tactical, 3: Commander
    created_at = Column(DateTime, default=datetime.utcnow)

    unit = relationship("Unit", back_populates="trainees")
    sessions = relationship("Session", back_populates="trainee")
    difficulty_history = relationship("DifficultyHistory", back_populates="trainee")


class Scenario(Base):
    __tablename__ = "scenarios"

    id = Column(String, primary_key=True, index=True)
    title = Column(String, nullable=False)
    seed = Column(Integer, nullable=False)
    terrain = Column(String, nullable=False)  # urban, rural, border, coastal
    time_of_day = Column(String, nullable=False)  # day, dusk, night
    threat_type = Column(String, nullable=False)  # single, swarm_wedge, swarm_leader, swarm_line, swarm_dispersed
    difficulty = Column(Integer, nullable=False)  # 1, 2, 3
    sensor_state = Column(String, nullable=False)  # normal, degraded, jammed
    sensor_reliability = Column(Float, default=1.0)
    clutter_density = Column(Float, default=0.1)
    target_count = Column(Integer, default=1)
    track_source_type = Column(String, default="native")  # native, replay, airsim
    target_definitions = Column(JSON, nullable=False)  # ground truth targets metadata
    weather = Column(String, default="clear")  # clear, rain, fog
    jamming_level = Column(Float, default=0.0)  # 0.0 to 1.0
    sensor_bias_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("Session", back_populates="scenario")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, index=True)
    trainee_id = Column(String, ForeignKey("trainees.id"), nullable=False)
    scenario_id = Column(String, ForeignKey("scenarios.id"), nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, default=0.0)
    status = Column(String, default="in_progress")  # in_progress, completed, aborted

    trainee = relationship("Trainee", back_populates="sessions")
    scenario = relationship("Scenario", back_populates="sessions")
    events = relationship("TargetEvent", back_populates="session", cascade="all, delete-orphan")
    score = relationship("Score", back_populates="session", uselist=False, cascade="all, delete-orphan")


class TargetEvent(Base):
    __tablename__ = "target_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=False)
    target_id = Column(String, nullable=False)
    true_class = Column(String, nullable=False)  # hostile, friendly, civil, false_alarm
    
    # Trainee actions
    detected_at = Column(Float, nullable=True)  # elapsed seconds
    detection_latency = Column(Float, nullable=True)  # latency from target onset
    trainee_classification = Column(String, nullable=True)
    classified_at = Column(Float, nullable=True)
    trainee_response = Column(String, nullable=True)
    responded_at = Column(Float, nullable=True)

    # AI Assist data
    ai_suggested_class = Column(String, nullable=True)
    ai_confidence = Column(Float, nullable=True)
    ai_followed = Column(Boolean, nullable=True)

    # Evaluation
    decision_outcome = Column(String, nullable=True)  # Optimal, Acceptable, Over-reaction, Under-reaction, Dangerous error
    decision_path = Column(String, nullable=True)  # rule explanation
    reason_code = Column(String, nullable=True)  # Leaf reason code (e.g. OPTIMAL_ENGAGEMENT, NO_CROSSCHECK, SWARM_TREATED_AS_SINGLE)
    confidence_rating = Column(Integer, nullable=True, default=4)  # 1 to 5
    cross_checked = Column(Boolean, nullable=True, default=False)
    penalty = Column(Float, default=0.0)
    score_points = Column(Float, default=0.0)

    session = relationship("Session", back_populates="events")


class Score(Base):
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String, ForeignKey("sessions.id"), unique=True, nullable=False)
    total_score = Column(Float, nullable=False)  # 0 to 100
    detection_score = Column(Float, nullable=False)  # out of 30
    classification_score = Column(Float, nullable=False)  # out of 30
    decision_score = Column(Float, nullable=False)  # out of 30 (or 40)
    calibration_score = Column(Float, default=100.0)  # out of 10
    overconfidence_index = Column(Float, default=0.0)  # Mean Confidence - Fraction Correct
    
    avg_detection_latency = Column(Float, nullable=False)
    classification_accuracy = Column(Float, nullable=False)  # 0.0 to 1.0
    optimal_decisions_pct = Column(Float, nullable=False)
    dangerous_errors_count = Column(Integer, default=0)
    missed_detections_count = Column(Integer, default=0)

    ai_assist_agreement_pct = Column(Float, default=0.0)
    coach_feedback = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("Session", back_populates="score")


class SkillProfile(Base):
    __tablename__ = "skill_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trainee_id = Column(String, ForeignKey("trainees.id"), nullable=False)
    skill_key = Column(String, nullable=False)  # detection_clutter, classification, swarm_assessment, sensor_crosscheck, response_selection, decision_under_pressure
    mastery_prob = Column(Float, default=0.10)  # BKT p(L) probability of mastery
    trials_count = Column(Integer, default=0)
    last_updated = Column(DateTime, default=datetime.utcnow)

    trainee = relationship("Trainee")


class ScheduledRetest(Base):
    __tablename__ = "scheduled_retests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trainee_id = Column(String, ForeignKey("trainees.id"), nullable=False)
    skill_key = Column(String, nullable=False)
    scenario_id = Column(String, nullable=False)
    interval_days = Column(Integer, default=3)  # 3 or 7
    due_date = Column(DateTime, nullable=False)
    completed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    trainee = relationship("Trainee")


class DifficultyHistory(Base):
    __tablename__ = "difficulty_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    trainee_id = Column(String, ForeignKey("trainees.id"), nullable=False)
    previous_difficulty = Column(Integer, nullable=False)
    new_difficulty = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)
    evaluated_at = Column(DateTime, default=datetime.utcnow)

    trainee = relationship("Trainee", back_populates="difficulty_history")
