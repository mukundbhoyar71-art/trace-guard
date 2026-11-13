import os
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.models.security import SecurityReport
from app.schemas.security import (
    SecurityReportCreateRequest,
    SecurityReportResponse,
    SecurityReportListResponse,
)
from app.services.session import get_current_user
import app.services.report_generator as report_generator
import re

router = APIRouter(prefix="/reports", tags=["Downloadable Security Reports"])


def _safe_pdf_filename(report_id: int, report_title: Optional[str]) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "_", (report_title or f"Report_{report_id}")).strip("_")
    slug = slug[:60] if slug else f"Report_{report_id}"
    return f"TRACE_GUARD_{report_id}_{slug}.pdf"


def _is_within_storage_dir(file_path: Optional[str]) -> bool:
    if not file_path:
        return False
    try:
        base_real = os.path.realpath(report_generator.REPORT_STORAGE_DIR)
        target_real = os.path.realpath(file_path)
        return os.path.commonpath([base_real, target_real]) == base_real
    except Exception:
        return False


def _format_report_response(report: SecurityReport) -> SecurityReportResponse:
    file_available = bool(
        report.file_path
        and _is_within_storage_dir(report.file_path)
        and os.path.isfile(report.file_path)
    )
    return SecurityReportResponse(
        id=report.id,
        user_id=report.user_id,
        report_title=report.report_title,
        report_type=(
            "Demo-Inclusive Dossier" if report.is_demo else "Production Security Dossier"
        ),
        status="Available" if file_available else "File Unavailable",
        file_size_bytes=report.file_size_bytes,
        risk_score=report.risk_score,
        risk_category=report.risk_category,
        summary_json=report.summary_json or {},
        is_demo=report.is_demo,
        created_at=report.created_at,
    )


@router.post("", response_model=SecurityReportResponse)
def create_security_report(
    payload: SecurityReportCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates a formal, confidential cybersecurity audit dossier in PDF format.
    Includes risk scores, 5 security pillars, live exposure findings, external HIBP checks,
    permission audits, priority remediation plans, monitoring status, and legal disclaimers.
    """
    try:
        report = report_generator.generate_security_pdf(
            db=db,
            user=current_user,
            report_title=payload.report_title,
            include_demo=payload.include_demo_data,
        )
        return _format_report_response(report)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate security dossier PDF: {str(e)}",
        )


@router.get("", response_model=SecurityReportListResponse)
def list_security_reports(
    report_type: Optional[str] = Query(None, description="Optional filter: 'production' or 'demo'"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lists all generated security audit reports for the authenticated user.
    """
    query = db.query(SecurityReport).filter(SecurityReport.user_id == current_user.id)
    if report_type:
        norm = report_type.strip().lower()
        if norm == "production":
            query = query.filter(SecurityReport.is_demo == False)
        elif norm == "demo":
            query = query.filter(SecurityReport.is_demo == True)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid report_type filter. Expected 'production' or 'demo'.",
            )

    reports = query.order_by(SecurityReport.created_at.desc()).all()

    return SecurityReportListResponse(
        items=[_format_report_response(r) for r in reports],
        total=len(reports),
    )


@router.get("/{report_id}", response_model=SecurityReportResponse)
def get_security_report_details(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns metadata for a single generated report. Scoped strictly to current_user.id (IDOR prevention).
    """
    report = (
        db.query(SecurityReport)
        .filter(
            SecurityReport.id == report_id,
            SecurityReport.user_id == current_user.id,
        )
        .first()
    )
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found or access denied.",
        )
    return _format_report_response(report)


@router.get("/{report_id}/download")
def download_security_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Downloads the generated PDF report. Scoped strictly to current_user.id to prevent IDOR vulnerabilities.
    """
    report = (
        db.query(SecurityReport)
        .filter(
            SecurityReport.id == report_id,
            SecurityReport.user_id == current_user.id,
        )
        .first()
    )

    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found or access denied.",
        )

    if not _is_within_storage_dir(report.file_path) or not os.path.isfile(report.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="The requested report file is unavailable or failed path verification.",
        )

    filename = _safe_pdf_filename(report.id, report.report_title)
    return FileResponse(
        path=os.path.realpath(report.file_path),
        media_type="application/pdf",
        filename=filename,
        headers={
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store, private",
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )

