import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.database.session import Base

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

class ExposureScan(Base):
    __tablename__ = "exposure_scans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    email = Column(String(255), nullable=False, index=True)
    status = Column(String(50), nullable=False, default="completed")  # "completed", "failed", "running"
    breaches_count = Column(Integer, default=0, nullable=False)
    exposed_categories_count = Column(Integer, default=0, nullable=False)
    risk_score = Column(Integer, default=0, nullable=False)  # 0-100
    risk_level = Column(String(20), default="low", nullable=False)  # "low", "moderate", "high", "critical"
    provider = Column(String(50), default="haveibeenpwned", nullable=False)
    is_demo = Column(Boolean, default=False, nullable=False, index=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    user = relationship("User", back_populates="scans")
    findings = relationship(
        "BreachFinding",
        back_populates="scan",
        cascade="all, delete-orphan",
        order_by="desc(BreachFinding.breach_date)"
    )


class BreachFinding(Base):
    __tablename__ = "breach_findings"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(Integer, ForeignKey("exposure_scans.id", ondelete="CASCADE"), nullable=False, index=True)
    breach_name = Column(String(255), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    domain = Column(String(255), nullable=True)
    breach_date = Column(String(50), nullable=True)
    added_date = Column(DateTime(timezone=True), nullable=True)
    modified_date = Column(DateTime(timezone=True), nullable=True)
    pwn_count = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    logo_url = Column(String(500), nullable=True)
    data_classes = Column(JSON, nullable=False, default=list)  # list of exposed data categories
    is_verified = Column(Boolean, default=True, nullable=False)
    is_fabricated = Column(Boolean, default=False, nullable=False)
    is_sensitive = Column(Boolean, default=False, nullable=False)
    is_retired = Column(Boolean, default=False, nullable=False)
    is_spam_list = Column(Boolean, default=False, nullable=False)
    is_malware = Column(Boolean, default=False, nullable=False)
    severity = Column(String(20), default="medium", nullable=False)  # "low", "medium", "high", "critical"
    is_resolved = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    recommended_actions = Column(JSON, nullable=False, default=list)  # list of action recommendations
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    # Relationships
    scan = relationship("ExposureScan", back_populates="findings")

