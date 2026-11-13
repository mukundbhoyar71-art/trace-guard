"""
TRACE GUARD - Downloadable Security Dossier & Report Generator
Uses ReportLab with numbered canvas footers to build executive security audit PDFs
exclusively from authenticated user database records, covering all 15 dossier dimensions.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from xml.sax.saxutils import escape as xml_escape
from sqlalchemy.orm import Session

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    HRFlowable,
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT

from app.models.user import User, UserSession
from app.models.security import (
    SecurityReport,
    SecurityRecommendation,
    SecurityActivity,
    ExternalCheckRecord,
    PrivacyPermissionReview,
    MonitoringReminder,
    MonitoringConfig,
    MonitoringExecution,
)
from app.models.scan import ExposureScan, BreachFinding
from app.services.risk_engine import calculate_privacy_risk_score
from app.services.recommendation_engine import sync_user_recommendations
from app.services.activity import log_activity
from app.services.unified_scans import MEDIA_SCAN_ACTIVITY_TYPES


REPORT_STORAGE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "storage", "reports")
)


class _NumberedCanvas(rl_canvas.Canvas):
    """ReportLab Canvas rendering 'Page X of Y' and confidentiality notice on every page."""

    def __init__(self, *args, **kwargs):
        self._report_id_short = kwargs.pop("report_id_short", "TG-DOSSIER")
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self._draw_footer(num_pages)
            super().showPage()
        super().save()

    def _draw_footer(self, page_count: int):
        self.saveState()
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.5)
        self.line(36, 30, letter[0] - 36, 30)
        self.setFont("Helvetica", 7.5)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(
            36,
            18,
            f"TRACE GUARD CONFIDENTIAL  |  Dossier Ref: {self._report_id_short}  |  Generated from Verified User Telemetry",
        )
        self.drawRightString(
            letter[0] - 36,
            18,
            f"Page {self._pageNumber} of {page_count}",
        )
        self.restoreState()


def _esc(val: Any) -> str:
    """Safely XML-escape dynamic strings before embedding inside ReportLab Paragraphs."""
    if val is None:
        return ""
    return xml_escape(str(val))


def _fmt_dt(dt: Optional[datetime], fallback: str = "Not assessed") -> str:
    if dt is None:
        return fallback
    if hasattr(dt, "tzinfo") and dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    try:
        return dt.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    except Exception:
        return str(dt)


def _infer_permission_provenance(review: PrivacyPermissionReview) -> str:
    plat = review.platform or "Web"
    app_lower = (review.app_name or "").lower()
    is_browser = plat.lower() == "web" and any(
        k in app_lower
        for k in ["browser", "chrome", "firefox", "safari", "edge", "brave", "opera", "navigator"]
    )
    if is_browser:
        return "Browser Permissions API (W3C)"
    return f"Manual User Attestation ({plat})"


def _summarize_permissions_map(perms_json: Optional[Dict[str, Any]]) -> str:
    if not perms_json:
        return "No permission scopes recorded"
    parts = [f"{k}: {str(v).upper()}" for k, v in perms_json.items()]
    return ", ".join(parts) if parts else "No permission scopes recorded"


def generate_security_pdf(
    db: Session,
    user: User,
    report_title: Optional[str] = None,
    include_demo: bool = False,
) -> SecurityReport:
    """
    Generates a formal 15-section executive security audit dossier PDF for the authenticated user,
    persists it on disk inside REPORT_STORAGE_DIR, stores metadata in SecurityReport, and logs activity.
    """
    os.makedirs(REPORT_STORAGE_DIR, exist_ok=True)
    user_dir = os.path.join(REPORT_STORAGE_DIR, f"user_{user.id}")
    os.makedirs(user_dir, exist_ok=True)

    report_uuid = str(uuid.uuid4())
    filename = f"traceguard_security_report_{report_uuid[:8]}.pdf"
    file_path = os.path.join(user_dir, filename)

    # 1. Sync recommendations & compute real-data risk intelligence
    sync_user_recommendations(db, user.id)
    risk_data = calculate_privacy_risk_score(db, user.id)

    now = datetime.datetime.now(datetime.timezone.utc) if hasattr(datetime, "datetime") else datetime.now(timezone.utc)

    # Account identity & active sessions count
    active_sessions_count = (
        db.query(UserSession)
        .filter(UserSession.user_id == user.id)
        .count()
    )
    auth_method = "Google OAuth 2.0 (OpenID)" if (user.google_id and not user.hashed_password) else "Argon2id Email & Password"

    # Recommendations (strictly filter out demo recs unless include_demo=True)
    rec_query = db.query(SecurityRecommendation).filter(
        SecurityRecommendation.user_id == user.id
    )
    if not include_demo:
        rec_query = rec_query.filter(SecurityRecommendation.is_demo == False)
    recommendations = (
        rec_query.order_by(
            SecurityRecommendation.status.asc(),
            SecurityRecommendation.created_at.desc(),
        )
        .limit(15)
        .all()
    )

    # Production Live Exposure Scans
    live_scans = (
        db.query(ExposureScan)
        .filter(
            ExposureScan.user_id == user.id,
            ExposureScan.is_demo == False,
        )
        .order_by(ExposureScan.created_at.desc())
        .limit(10)
        .all()
    )
    total_live_scans_count = (
        db.query(ExposureScan)
        .filter(ExposureScan.user_id == user.id, ExposureScan.is_demo == False)
        .count()
    )

    # Individual Breach Findings from Live Scans
    live_findings = (
        db.query(BreachFinding)
        .join(ExposureScan, BreachFinding.scan_id == ExposureScan.id)
        .filter(
            ExposureScan.user_id == user.id,
            ExposureScan.is_demo == False,
        )
        .order_by(BreachFinding.breach_date.desc().nullslast(), BreachFinding.created_at.desc())
        .limit(20)
        .all()
    )

    # Isolated Demo Scans (ONLY queried if explicitly requested)
    demo_scans: List[ExposureScan] = []
    if include_demo:
        demo_scans = (
            db.query(ExposureScan)
            .filter(
                ExposureScan.user_id == user.id,
                ExposureScan.is_demo == True,
            )
            .order_by(ExposureScan.created_at.desc())
            .limit(5)
            .all()
        )

    # External Checks (user-confirmed HIBP checks)
    ext_checks = (
        db.query(ExternalCheckRecord)
        .filter(ExternalCheckRecord.user_id == user.id)
        .order_by(ExternalCheckRecord.check_date.desc())
        .limit(10)
        .all()
    )
    total_ext_checks_count = (
        db.query(ExternalCheckRecord)
        .filter(ExternalCheckRecord.user_id == user.id)
        .count()
    )

    # Browser & App Permission Reviews
    perm_reviews = (
        db.query(PrivacyPermissionReview)
        .filter(PrivacyPermissionReview.user_id == user.id)
        .order_by(PrivacyPermissionReview.updated_at.desc())
        .limit(15)
        .all()
    )

    # Zero-knowledge Password K-Anonymity Audits & Sensitive Media Scans
    pwd_checks = (
        db.query(SecurityActivity)
        .filter(
            SecurityActivity.user_id == user.id,
            SecurityActivity.activity_type == "PASSWORD_BREACH_CHECK",
        )
        .order_by(SecurityActivity.created_at.desc())
        .limit(10)
        .all()
    )
    total_pwd_checks_count = (
        db.query(SecurityActivity)
        .filter(
            SecurityActivity.user_id == user.id,
            SecurityActivity.activity_type == "PASSWORD_BREACH_CHECK",
        )
        .count()
    )
    media_scans = (
        db.query(SecurityActivity)
        .filter(
            SecurityActivity.user_id == user.id,
            SecurityActivity.activity_type.in_(MEDIA_SCAN_ACTIVITY_TYPES),
        )
        .order_by(SecurityActivity.created_at.desc())
        .limit(10)
        .all()
    )
    total_media_scans_count = (
        db.query(SecurityActivity)
        .filter(
            SecurityActivity.user_id == user.id,
            SecurityActivity.activity_type.in_(MEDIA_SCAN_ACTIVITY_TYPES),
        )
        .count()
    )

    # Monitoring Configuration, Executions & Reminder Notifications
    auto_cfg = (
        db.query(MonitoringConfig)
        .filter(MonitoringConfig.user_id == user.id)
        .first()
    )
    recent_executions = (
        db.query(MonitoringExecution)
        .filter(MonitoringExecution.user_id == user.id)
        .order_by(MonitoringExecution.started_at.desc())
        .limit(5)
        .all()
    )
    active_reminder = (
        db.query(MonitoringReminder)
        .filter(
            MonitoringReminder.user_id == user.id,
            MonitoringReminder.is_active == True,
        )
        .order_by(MonitoringReminder.created_at.desc())
        .first()
    )
    latest_reminder = active_reminder or (
        db.query(MonitoringReminder)
        .filter(MonitoringReminder.user_id == user.id)
        .order_by(MonitoringReminder.created_at.desc())
        .first()
    )

    # 2. Build PDF Document with canvas page numbering
    doc = SimpleDocTemplate(
        file_path,
        pagesize=letter,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=44,
    )

    styles = getSampleStyleSheet()
    primary_color = colors.HexColor("#0F172A")
    brand_blue = colors.HexColor("#3B82F6")
    text_dark = colors.HexColor("#1E293B")
    text_muted = colors.HexColor("#64748B")
    card_bg = colors.HexColor("#F8FAFC")
    border_color = colors.HexColor("#E2E8F0")
    danger_color = colors.HexColor("#EF4444")
    warning_color = colors.HexColor("#F59E0B")
    success_color = colors.HexColor("#10B981")
    neutral_color = colors.HexColor("#64748B")

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=19,
        leading=23,
        textColor=primary_color,
        spaceAfter=4,
    )
    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=primary_color,
        spaceBefore=10,
        spaceAfter=5,
    )
    body_style = ParagraphStyle(
        "DocBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=text_dark,
    )
    small_style = ParagraphStyle(
        "DocSmall",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=7.8,
        leading=10.5,
        textColor=text_muted,
    )
    disclaimer_style = ParagraphStyle(
        "Disclaimer",
        parent=styles["Normal"],
        fontName="Helvetica-Oblique",
        fontSize=7.5,
        leading=10,
        textColor=text_muted,
        alignment=TA_CENTER,
    )

    table_base_style = TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E2E8F0")),
            ("GRID", (0, 0), (-1, -1), 0.5, border_color),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ]
    )

    story = []

    # (1) Header Branding + (2) Report Date & Ref + (3) User Account Identifier
    effective_title = (
        report_title.strip()
        if report_title and report_title.strip()
        else "Comprehensive Digital Exposure & Privacy Assessment"
    )
    header_data = [
        [
            Paragraph(
                "<b>TRACE GUARD</b> &nbsp;|&nbsp; <font color='#6366F1'>PERSONAL DATA FOOTPRINT DOSSIER</font>",
                title_style,
            ),
            Paragraph(
                f"<b>CONFIDENTIAL</b><br/><font size='7' color='#64748B'>Ref: {_esc(report_uuid[:12])}</font>",
                ParagraphStyle("HdrRight", parent=body_style, alignment=TA_RIGHT),
            ),
        ]
    ]
    header_table = Table(header_data, colWidths=[390, 150])
    header_table.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
                ("TOPPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )
    story.append(header_table)
    story.append(Spacer(1, 3))
    story.append(Paragraph(f"<b>Report Title:</b> {_esc(effective_title)}", body_style))
    story.append(
        HRFlowable(
            width="100%",
            thickness=1.5,
            color=brand_blue,
            spaceAfter=8,
            spaceBefore=4,
        )
    )

    # Metadata Bar
    now_str = datetime.now(timezone.utc).strftime("%B %d, %Y - %H:%M UTC")
    coverage_pct = risk_data.get("coverage_percentage", 0)
    engine_ver = risk_data.get("engine_version", "3.0")
    has_sufficient_data = bool(risk_data.get("has_sufficient_data", False))
    scope_label = "Production + Demo Addendum" if include_demo else "Verified Production Data Only"

    meta_data = [
        [
            Paragraph(f"<b>Account Identifier:</b> {_esc(user.email)} ({_esc(user.full_name)})", body_style),
            Paragraph(f"<b>Generated Date:</b> {_esc(now_str)}", body_style),
            Paragraph(
                f"<b>Engine / Coverage:</b> v{_esc(engine_ver)} ({coverage_pct}%)",
                body_style,
            ),
        ],
        [
            Paragraph(
                f"<b>Identity Verified:</b> {'Yes' if user.is_email_verified else 'No (Unverified)'} | <b>Auth:</b> {_esc(auth_method)}",
                small_style,
            ),
            Paragraph(f"<b>Telemetry Scope:</b> {_esc(scope_label)}", small_style),
            Paragraph(
                f"<b>Live Scans / External Checks:</b> {total_live_scans_count} / {total_ext_checks_count}",
                small_style,
            ),
        ],
    ]
    meta_table = Table(meta_data, colWidths=[225, 175, 140])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), card_bg),
                ("BOX", (0, 0), (-1, -1), 0.5, border_color),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # (4) Security Assessment Overview + (5) Attack Surface Risk Score + (6) Assessment Coverage
    score = (
        risk_data.get("risk_score")
        if risk_data.get("risk_score") is not None
        else risk_data.get("score")
    )
    category_raw = risk_data.get("risk_category") or risk_data.get("category") or "Insufficient Data"
    category = category_raw.upper()
    rating = risk_data.get("rating", "Unknown")
    display_score = str(score) if score is not None else "--"

    score_color = success_color
    if not has_sufficient_data or score is None or category == "INSUFFICIENT DATA":
        score_color = neutral_color
    elif category in ("HIGH", "CRITICAL"):
        score_color = danger_color
    elif category in ("MEDIUM", "ELEVATED", "MODERATE"):
        score_color = warning_color

    if not has_sufficient_data or score is None:
        exec_text = (
            f"This audit dossier compiles real security records for <b>{_esc(user.email)}</b>. "
            f"Assessment status: <b>Not assessed &mdash; Insufficient Verified Data</b>. "
            f"{_esc(risk_data.get('status_message', 'Complete a live exposure scan or log a verified HIBP check to compute a quantitative risk score.'))} "
            f"Current pillar coverage is <b>{coverage_pct}%</b> across 5 security dimensions; unassessed categories are never treated as zero risk."
        )
    else:
        exec_text = (
            f"This security assessment compiles authenticated telemetry for <b>{_esc(user.email)}</b>. "
            f"<b>Attack Surface Risk Score: {display_score}/100</b> "
            f"({_esc(category)} Risk &mdash; Rating: {_esc(rating)}), with <b>{coverage_pct}% Assessment Coverage</b> "
            f"(Engine v{_esc(engine_ver)}). Lower scores indicate lower exposure risk. Unassessed pillars are explicitly flagged as Not assessed. "
            f"{'Simulated demo records are isolated strictly into Appendix A.' if include_demo else 'Simulated demo telemetry is excluded from this dossier.'}"
        )

    risk_summary_data = [
        [
            Paragraph(
                f"<font color='#E2E8F0'><b>Attack Surface Score</b></font><br/>"
                f"<font size='24' color='{score_color.hexval()}'><b>{display_score}</b></font>"
                f"<font size='9' color='#94A3B8'> / 100</font><br/>"
                f"<font size='8.5' color='{score_color.hexval()}'><b>{_esc(category)}</b></font><br/>"
                f"<font size='7.5' color='#94A3B8'>Coverage: {coverage_pct}%</font>",
                ParagraphStyle("ScoreBox", parent=body_style, alignment=TA_CENTER),
            ),
            Paragraph(f"<b>Security Assessment Overview</b><br/>{exec_text}", body_style),
        ]
    ]
    risk_summary_table = Table(risk_summary_data, colWidths=[135, 405])
    risk_summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#0F172A")),
                ("BACKGROUND", (1, 0), (1, 0), card_bg),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOX", (0, 0), (-1, -1), 0.5, border_color),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    story.append(risk_summary_table)
    story.append(Spacer(1, 10))

    # (7) Account & Identity Security + Five Pillars Coverage Breakdown
    story.append(Paragraph("<b>1. Account &amp; Identity Security and 5-Pillar Coverage</b>", section_heading))
    identity_rows = [
        [
            Paragraph("<b>Account Email</b>", body_style),
            Paragraph("<b>Email Verification</b>", body_style),
            Paragraph("<b>Authentication Mechanism</b>", body_style),
            Paragraph("<b>Active Sessions</b>", body_style),
            Paragraph("<b>Account Created</b>", body_style),
        ],
        [
            Paragraph(_esc(user.email), small_style),
            Paragraph("Verified" if user.is_email_verified else "Unverified (+15 penalty)", small_style),
            Paragraph(_esc(auth_method), small_style),
            Paragraph(f"{active_sessions_count} Active Session(s)", small_style),
            Paragraph(_esc(_fmt_dt(user.created_at)), small_style),
        ],
    ]
    id_table = Table(identity_rows, colWidths=[140, 100, 130, 85, 85])
    id_table.setStyle(table_base_style)
    story.append(id_table)
    story.append(Spacer(1, 6))

    factors_list = risk_data.get("factors", [])
    factor_rows = [
        [
            Paragraph("<b>Security Pillar</b>", body_style),
            Paragraph("<b>Weight</b>", body_style),
            Paragraph("<b>Penalty</b>", body_style),
            Paragraph("<b>Assessment State</b>", body_style),
            Paragraph("<b>Verified Evidence &amp; Last Checked</b>", body_style),
        ]
    ]
    for f in factors_list:
        raw_status = f.get("status", "")
        is_not_assessed = raw_status == "CHECK_NOT_PERFORMED"
        state_label = "Not assessed" if is_not_assessed else (f.get("status_label") or raw_status)
        checked_str = f.get("last_checked_at") or "Not assessed"
        if isinstance(checked_str, str) and "T" in checked_str:
            checked_str = checked_str[:16].replace("T", " ") + " UTC"
        evidence_line = f.get("evidence_summary") or f.get("description") or "Not assessed"
        factor_rows.append(
            [
                Paragraph(f"<b>{_esc(f.get('name', 'Pillar'))}</b>", small_style),
                Paragraph(f"{f.get('weight', 0)}%", small_style),
                Paragraph("--" if is_not_assessed else f"{f.get('score', 0)} pts", small_style),
                Paragraph(_esc(state_label), small_style),
                Paragraph(
                    f"{_esc(evidence_line)}<br/><font color='#475569'>Last checked: {_esc(checked_str)}</font>",
                    small_style,
                ),
            ]
        )

    factor_table = Table(factor_rows, colWidths=[115, 42, 48, 95, 240])
    factor_table.setStyle(table_base_style)
    story.append(factor_table)
    story.append(Spacer(1, 10))

    # (8) Personal Data Exposure Findings
    story.append(Paragraph("<b>2. Personal Data Exposure Findings (API-Verified Scans)</b>", section_heading))
    if live_scans:
        scan_rows = [
            [
                Paragraph("<b>Scan ID &amp; Date</b>", body_style),
                Paragraph("<b>Target Email</b>", body_style),
                Paragraph("<b>Status</b>", body_style),
                Paragraph("<b>Verified Breaches</b>", body_style),
                Paragraph("<b>Scan Score</b>", body_style),
            ]
        ]
        for s in live_scans:
            scan_rows.append(
                [
                    Paragraph(f"EXP-{s.id}<br/>{_esc(_fmt_dt(s.created_at))}", small_style),
                    Paragraph(_esc(s.email), small_style),
                    Paragraph(_esc(s.status.upper()), small_style),
                    Paragraph(f"{s.breaches_count} ({s.exposed_categories_count} classes)", small_style),
                    Paragraph(f"{s.risk_score}/100 ({_esc(s.risk_level)})", small_style),
                ]
            )
        scan_table = Table(scan_rows, colWidths=[115, 165, 70, 95, 95])
        scan_table.setStyle(table_base_style)
        story.append(scan_table)
        story.append(Spacer(1, 6))

        if live_findings:
            finding_rows = [
                [
                    Paragraph("<b>Breach Incident</b>", body_style),
                    Paragraph("<b>Breach Date</b>", body_style),
                    Paragraph("<b>Severity</b>", body_style),
                    Paragraph("<b>Verification &amp; State</b>", body_style),
                    Paragraph("<b>Exposed Data Classes</b>", body_style),
                ]
            ]
            for bf in live_findings:
                ver_label = "API-Verified" if (bf.is_verified and not bf.is_fabricated) else "Unverified"
                res_label = "Resolved" if bf.is_resolved else "Unresolved"
                classes_text = ", ".join(bf.data_classes or []) or "Not specified"
                finding_rows.append(
                    [
                        Paragraph(f"<b>{_esc(bf.title or bf.breach_name)}</b>", small_style),
                        Paragraph(_esc(bf.breach_date or "Unknown"), small_style),
                        Paragraph(_esc((bf.severity or "medium").upper()), small_style),
                        Paragraph(f"{ver_label} / {res_label}", small_style),
                        Paragraph(_esc(classes_text), small_style),
                    ]
                )
            finding_table = Table(finding_rows, colWidths=[115, 70, 60, 105, 190])
            finding_table.setStyle(table_base_style)
            story.append(finding_table)
        else:
            story.append(
                Paragraph(
                    "Completed live HIBP API exposure scans returned <b>0 confirmed breach incidents</b> for this address.",
                    small_style,
                )
            )
    else:
        story.append(
            Paragraph(
                "<b>Not assessed:</b> No live Have I Been Pwned API exposure scans have been completed for this account. Missing scans are never treated as clean.",
                small_style,
            )
        )
    story.append(Spacer(1, 10))

    # (9) External Breach Verification Results
    story.append(
        Paragraph("<b>3. External Breach Verification Results (User-Confirmed Checks)</b>", section_heading)
    )
    if ext_checks:
        ext_rows = [
            [
                Paragraph("<b>ID &amp; Date (UTC)</b>", body_style),
                Paragraph("<b>Checked Email</b>", body_style),
                Paragraph("<b>Provenance</b>", body_style),
                Paragraph("<b>Findings &amp; Notes</b>", body_style),
            ]
        ]
        for c in ext_checks:
            breach_list = ", ".join(c.breach_names or []) if c.breach_names else "None listed"
            notes_part = f" | Notes: {c.user_notes}" if c.user_notes else ""
            ver_source = (
                "User-Confirmed Manual Check"
                if c.is_verified_by_user
                else "Unverified External Entry"
            )
            ext_rows.append(
                [
                    Paragraph(f"EXT-{c.id}<br/>{_esc(_fmt_dt(c.check_date))}", small_style),
                    Paragraph(_esc(c.email), small_style),
                    Paragraph(_esc(ver_source), small_style),
                    Paragraph(
                        f"<b>{c.breaches_found_count} breach(es)</b> &mdash; Incidents: {_esc(breach_list)}{_esc(notes_part)}",
                        small_style,
                    ),
                ]
            )
        ext_table = Table(ext_rows, colWidths=[110, 140, 120, 170])
        ext_table.setStyle(table_base_style)
        story.append(ext_table)
    else:
        story.append(
            Paragraph(
                "<b>Not assessed:</b> No user-confirmed external Have I Been Pwned checks have been logged.",
                small_style,
            )
        )
    story.append(Spacer(1, 10))

    # (10) Browser & App Permission Audit Findings
    story.append(Paragraph("<b>4. Browser &amp; App Permission Audit Findings</b>", section_heading))
    if perm_reviews:
        perm_rows = [
            [
                Paragraph("<b>App / Browser</b>", body_style),
                Paragraph("<b>Provenance</b>", body_style),
                Paragraph("<b>Risk Level</b>", body_style),
                Paragraph("<b>Audited Scopes</b>", body_style),
                Paragraph("<b>Audit Date (UTC)</b>", body_style),
            ]
        ]
        for pr in perm_reviews:
            perm_rows.append(
                [
                    Paragraph(f"<b>{_esc(pr.app_name)}</b> ({_esc(pr.platform)})", small_style),
                    Paragraph(_esc(_infer_permission_provenance(pr)), small_style),
                    Paragraph(_esc((pr.risk_level or "low").upper()), small_style),
                    Paragraph(_esc(_summarize_permissions_map(pr.permissions_json)), small_style),
                    Paragraph(_esc(_fmt_dt(pr.reviewed_at or pr.updated_at)), small_style),
                ]
            )
        perm_table = Table(perm_rows, colWidths=[105, 115, 65, 155, 100])
        perm_table.setStyle(table_base_style)
        story.append(perm_table)
    else:
        story.append(
            Paragraph(
                "<b>Not assessed:</b> No browser permission snapshots or manual app permission reviews recorded.",
                small_style,
            )
        )
    story.append(Spacer(1, 10))

    # (11) Security Hygiene Assessment
    story.append(Paragraph("<b>5. Security Hygiene &amp; Credential Posture Assessment</b>", section_heading))
    hygiene_factor = next((f for f in factors_list if f.get("category_id") == "hygiene"), {})
    hygiene_state = (
        "Not assessed"
        if hygiene_factor.get("status") == "CHECK_NOT_PERFORMED"
        else hygiene_factor.get("status_label", "Active")
    )
    last_pwd_check = pwd_checks[0] if pwd_checks else None
    pwd_status_text = (
        f"{total_pwd_checks_count} anonymous k-anonymity check(s) (Latest: {_fmt_dt(last_pwd_check.created_at)})"
        if last_pwd_check
        else "Not assessed (0 k-anonymity password checks logged)"
    )
    completed_recs = sum(1 for r in recommendations if r.status == "completed")
    pending_recs = sum(1 for r in recommendations if r.status == "pending")
    hygiene_rows = [
        [
            Paragraph("<b>Audit Cadence Vigilance</b>", body_style),
            Paragraph("<b>Password Exposure Checks</b>", body_style),
            Paragraph("<b>Mitigation Completion</b>", body_style),
        ],
        [
            Paragraph(f"<b>{_esc(hygiene_state)}</b><br/>{_esc(hygiene_factor.get('evidence_summary', 'Not assessed'))}", small_style),
            Paragraph(_esc(pwd_status_text), small_style),
            Paragraph(f"{completed_recs} Completed / {pending_recs} Pending recommendations", small_style),
        ],
    ]
    hygiene_table = Table(hygiene_rows, colWidths=[195, 195, 150])
    hygiene_table.setStyle(table_base_style)
    story.append(hygiene_table)
    story.append(Spacer(1, 10))

    # (12) Recommendations
    story.append(Paragraph("<b>6. Security Recommendations &amp; Remediation Plan</b>", section_heading))
    if recommendations:
        rec_rows = [
            [
                Paragraph("<b>Priority</b>", body_style),
                Paragraph("<b>Action Required</b>", body_style),
                Paragraph("<b>Rationale / Threat Impact</b>", body_style),
                Paragraph("<b>Status</b>", body_style),
            ]
        ]
        for rec in recommendations:
            if rec.status == "completed":
                status_text = "<font color='#10B981'><b>COMPLETED</b></font>"
            elif rec.status == "dismissed":
                status_text = "<font color='#64748B'>DISMISSED</font>"
            else:
                status_text = "<font color='#EF4444'><b>PENDING</b></font>"
            prio = (rec.priority or "MEDIUM").upper()
            prio_color = (
                "#EF4444"
                if prio in ("CRITICAL", "HIGH")
                else ("#F59E0B" if prio == "MEDIUM" else "#3B82F6")
            )
            title_prefix = "[DEMO] " if rec.is_demo and "[DEMO]" not in (rec.title or "") else ""
            rec_rows.append(
                [
                    Paragraph(f"<font color='{prio_color}'><b>{_esc(prio)}</b></font>", small_style),
                    Paragraph(f"<b>{_esc(title_prefix + (rec.title or ''))}</b>", small_style),
                    Paragraph(_esc(rec.reason or rec.description), small_style),
                    Paragraph(status_text, small_style),
                ]
            )
        rec_table = Table(rec_rows, colWidths=[65, 160, 235, 80])
        rec_table.setStyle(table_base_style)
        story.append(rec_table)
    else:
        story.append(Paragraph("No security recommendations recorded at this time.", small_style))
    story.append(Spacer(1, 10))

    # (13) Consolidated Scan History Summary Across Implemented Modules
    story.append(Paragraph("<b>7. Consolidated Scan History Summary</b>", section_heading))
    browser_perms_cnt = sum(1 for pr in perm_reviews if _infer_permission_provenance(pr).startswith("Browser"))
    app_perms_cnt = len(perm_reviews) - browser_perms_cnt
    history_summary_rows = [
        [
            Paragraph("<b>Scan / Audit Category</b>", body_style),
            Paragraph("<b>Records Count</b>", body_style),
            Paragraph("<b>Verification Provenance</b>", body_style),
            Paragraph("<b>Latest Timestamp (UTC)</b>", body_style),
        ],
        [
            Paragraph("Email Exposure Scans", small_style),
            Paragraph(str(total_live_scans_count) if total_live_scans_count > 0 else "Not assessed", small_style),
            Paragraph("API-Verified (HIBP v3)", small_style),
            Paragraph(_esc(_fmt_dt(live_scans[0].created_at if live_scans else None)), small_style),
        ],
        [
            Paragraph("Password Breach Checks", small_style),
            Paragraph(str(total_pwd_checks_count) if total_pwd_checks_count > 0 else "Not assessed", small_style),
            Paragraph("Zero-Knowledge K-Anonymity", small_style),
            Paragraph(_esc(_fmt_dt(pwd_checks[0].created_at if pwd_checks else None)), small_style),
        ],
        [
            Paragraph("External Breach Verifications", small_style),
            Paragraph(str(total_ext_checks_count) if total_ext_checks_count > 0 else "Not assessed", small_style),
            Paragraph("User-Confirmed Manual Input", small_style),
            Paragraph(_esc(_fmt_dt(ext_checks[0].check_date if ext_checks else None)), small_style),
        ],
        [
            Paragraph("Browser &amp; App Permission Audits", small_style),
            Paragraph(
                f"{len(perm_reviews)} ({browser_perms_cnt} Browser / {app_perms_cnt} App)" if perm_reviews else "Not assessed",
                small_style,
            ),
            Paragraph("W3C Permissions API / Manual Checklist", small_style),
            Paragraph(_esc(_fmt_dt(perm_reviews[0].reviewed_at if perm_reviews else None)), small_style),
        ],
        [
            Paragraph("Sensitive Media &amp; Document Scans", small_style),
            Paragraph(str(total_media_scans_count) if total_media_scans_count > 0 else "Not assessed", small_style),
            Paragraph("On-Device AI / In-Memory Analyzer", small_style),
            Paragraph(_esc(_fmt_dt(media_scans[0].created_at if media_scans else None)), small_style),
        ],
    ]
    hist_summary_table = Table(history_summary_rows, colWidths=[150, 95, 165, 130])
    hist_summary_table.setStyle(table_base_style)
    story.append(hist_summary_table)
    story.append(Spacer(1, 10))

    # (14) Security Monitoring Status (Configuration vs Scheduled Runs vs Reminders vs Manual Scans)
    story.append(Paragraph("<b>8. Security Monitoring Configuration, Executions &amp; Reminders</b>", section_heading))
    is_auto_enabled = bool(auto_cfg and auto_cfg.is_enabled)
    auto_freq_str = auto_cfg.frequency.capitalize() if auto_cfg else "Not configured"
    auto_next_str = _fmt_dt(auto_cfg.next_run_at, "Not scheduled") if is_auto_enabled else "Paused / Disabled"
    last_exec_str = (
        f"{recent_executions[0].status.upper()} ({recent_executions[0].trigger_type}) at {_fmt_dt(recent_executions[0].started_at)}"
        if recent_executions
        else "Never Executed"
    )
    if recent_executions and recent_executions[0].status == "failed" and recent_executions[0].error_message:
        last_exec_str += f" &mdash; {_esc(recent_executions[0].error_message[:90])}"

    is_rem_enabled = bool(active_reminder and active_reminder.is_active)
    rem_freq_str = (
        active_reminder.frequency.capitalize()
        if is_rem_enabled
        else (f"{latest_reminder.frequency.capitalize()} (Paused)" if latest_reminder else "Not Scheduled")
    )
    next_rem_str = _fmt_dt(active_reminder.next_reminder_at, "Not Scheduled") if is_rem_enabled else "Not Scheduled"
    last_live_str = _fmt_dt(live_scans[0].completed_at or live_scans[0].created_at, "Never Performed") if live_scans else "Never Performed"
    last_ext_str = _fmt_dt(ext_checks[0].check_date, "Never Performed") if ext_checks else "Never Performed"

    mon_rows = [
        [
            Paragraph("<b>Automated Monitoring Config</b>", body_style),
            Paragraph("<b>Latest Execution Outcome</b>", body_style),
            Paragraph("<b>Reminder Notifications</b>", body_style),
            Paragraph("<b>On-Demand &amp; External Checks</b>", body_style),
        ],
        [
            Paragraph(
                f"{'<font color=\"#10B981\"><b>ENABLED</b></font>' if is_auto_enabled else '<font color=\"#64748B\"><b>DISABLED</b></font>'}<br/>"
                f"Cadence: {_esc(auto_freq_str)}<br/>Next run: {_esc(auto_next_str)}",
                small_style,
            ),
            Paragraph(last_exec_str, small_style),
            Paragraph(
                f"{'<font color=\"#10B981\"><b>ACTIVE</b></font>' if is_rem_enabled else '<font color=\"#64748B\"><b>DISABLED</b></font>'}<br/>"
                f"Freq: {_esc(rem_freq_str)}<br/>Next: {_esc(next_rem_str)}",
                small_style,
            ),
            Paragraph(
                f"Manual Live Scan: {_esc(last_live_str)}<br/>Manual External HIBP: {_esc(last_ext_str)}",
                small_style,
            ),
        ],
    ]
    mon_table = Table(mon_rows, colWidths=[125, 145, 130, 140])
    mon_table.setStyle(table_base_style)
    story.append(mon_table)
    story.append(Spacer(1, 10))

    # (15) Data Sources & Verification Limitations
    story.append(Paragraph("<b>9. Data Sources, Verification Provenance &amp; Limitations</b>", section_heading))
    limitation_rows = [
        [
            Paragraph("<b>Classification</b>", body_style),
            Paragraph("<b>Meaning &amp; Verification Scope</b>", body_style),
        ],
        [
            Paragraph("<b>API-Verified</b>", small_style),
            Paragraph("Confirmed directly via authenticated Have I Been Pwned API v3 responses.", small_style),
        ],
        [
            Paragraph("<b>User-Confirmed</b>", small_style),
            Paragraph("Manual breach verification counts submitted by the account holder after visiting haveibeenpwned.com.", small_style),
        ],
        [
            Paragraph("<b>Browser API vs Manual Checklist</b>", small_style),
            Paragraph("Web permissions originate from browser navigator.permissions APIs; Android/iOS/Desktop permissions reflect user-entered checklists (no background OS agent).", small_style),
        ],
        [
            Paragraph("<b>Zero-Knowledge / On-Device</b>", small_style),
            Paragraph("Password checks transmit only 5-char SHA-1 prefixes via k-anonymity; media/document scans run locally/in-memory without retaining plaintext passwords or private files.", small_style),
        ],
        [
            Paragraph("<b>Not assessed / Demo Data</b>", small_style),
            Paragraph("Unassessed modules are explicitly reported as 'Not assessed' and are never treated as zero risk. Simulated Demo records are strictly isolated.", small_style),
        ],
    ]
    lim_table = Table(limitation_rows, colWidths=[145, 395])
    lim_table.setStyle(table_base_style)
    story.append(lim_table)

    # Optional Simulated Demo Addendum (ONLY when include_demo=True)
    if include_demo:
        story.append(Spacer(1, 10))
        story.append(
            Paragraph(
                "<b>Appendix A. Isolated Simulated Demo Scans (Fictional Telemetry)</b>",
                section_heading,
            )
        )
        if demo_scans:
            demo_rows = [
                [
                    Paragraph("<b>Timestamp (UTC)</b>", body_style),
                    Paragraph("<b>Target Email</b>", body_style),
                    Paragraph("<b>Simulated Breaches</b>", body_style),
                    Paragraph("<b>Simulated Score</b>", body_style),
                ]
            ]
            for ds in demo_scans:
                demo_rows.append(
                    [
                        Paragraph(_esc(_fmt_dt(ds.created_at)), small_style),
                        Paragraph(_esc(ds.email), small_style),
                        Paragraph(f"{ds.breaches_count} (Synthetic)", small_style),
                        Paragraph(f"{ds.risk_score}/100 ({_esc(ds.risk_level)})", small_style),
                    ]
                )
            demo_table = Table(demo_rows, colWidths=[125, 175, 120, 120])
            demo_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#EDE9FE")),
                        ("GRID", (0, 0), (-1, -1), 0.5, border_color),
                        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ("LEFTPADDING", (0, 0), (-1, -1), 5),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                    ]
                )
            )
            story.append(demo_table)
        else:
            story.append(Paragraph("No simulated demo scans exist for this account.", small_style))

    story.append(Spacer(1, 14))

    disclaimer_text = (
        "<b>LEGAL &amp; COMPLIANCE DISCLAIMER:</b> This report is generated strictly from verified database telemetry "
        "and explicit user-confirmed audit inputs belonging to the authenticated account. TRACE GUARD does not claim "
        "visibility over unindexed leaks or third-party dark web repositories. Passwords verified with "
        "k-anonymity are never transmitted or stored in plaintext. Report generated for personal security posture review."
    )
    story.append(Paragraph(disclaimer_text, disclaimer_style))

    # Build PDF with numbered canvas
    doc.build(
        story,
        canvasmaker=lambda *args, **kwargs: _NumberedCanvas(
            *args, report_id_short=report_uuid[:12], **kwargs
        ),
    )

    file_size = os.path.getsize(file_path)

    report_record = SecurityReport(
        user_id=user.id,
        report_title=effective_title,
        file_path=file_path,
        file_size_bytes=file_size,
        risk_score=score,
        risk_category=category_raw,
        summary_json={
            "score": score,
            "category": category_raw,
            "rating": rating,
            "has_sufficient_data": has_sufficient_data,
            "coverage_percentage": coverage_pct,
            "engine_version": engine_ver,
            "factors": factors_list,
            "metrics": risk_data.get("metrics", {}),
            "is_demo": bool(include_demo),
            "include_demo_requested": bool(include_demo),
            "live_scans_count": total_live_scans_count,
            "live_findings_count": len(live_findings),
            "external_checks_count": total_ext_checks_count,
            "permission_reviews_count": len(perm_reviews),
            "password_checks_count": total_pwd_checks_count,
            "media_scans_count": total_media_scans_count,
            "recommendations_count": len(recommendations),
            "monitoring_enabled": is_rem_enabled,
            "auto_monitoring_enabled": is_auto_enabled,
        },
        is_demo=bool(include_demo),
    )
    db.add(report_record)
    db.commit()
    db.refresh(report_record)

    log_activity(
        db=db,
        user_id=user.id,
        activity_type="REPORT_GENERATED",
        title="Security Dossier PDF Generated",
        metadata={
            "report_id": report_record.id,
            "risk_score": score,
            "coverage_percentage": coverage_pct,
            "is_demo": report_record.is_demo,
            "file_size": file_size,
        },
    )

    return report_record
