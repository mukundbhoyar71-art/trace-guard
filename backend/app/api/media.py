import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.user import User
from app.schemas.media import (
    MediaScanResponse,
    MetadataExtractionResponse,
    DocumentScanResponse,
    ImageDetectionResult,
    BatchImageDetectionResponse,
)
from app.services.session import get_current_user
from app.services.media_scanner import scan_media_file
from app.services.metadata_intelligence import (
    extract_file_metadata,
    sanitize_media_file,
)
from app.services.document_scanner import scan_document_for_pii
from app.services.media_detector import (
    detect_single_image,
    detect_batch_images,
    check_model_availability,
)
from app.services.activity import log_activity

router = APIRouter(prefix="/media", tags=["Sensitive Media Scanner & Privacy Intelligence"])

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

# ==========================================
# 1. SENSITIVE MEDIA SCANNER
# ==========================================

@router.post("/scan-media", response_model=MediaScanResponse)
async def scan_media_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Scans a user-selected image (JPG, PNG, WEBP) or audio file (MP3, WAV, M4A) locally.
    Evaluates skin-tone/exposure ratios, embedded EXIF/GPS, and audio parameters.
    Reports classifier capabilities truthfully with zero simulated scores.
    Files are processed in-memory and never stored on disk.
    """
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read media upload stream: {str(e)}",
        )

    scan_result = scan_media_file(content, file.filename or "unknown_file")

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="MEDIA_SCAN_COMPLETED",
        title=f"Media Privacy Scan: {scan_result.file_name}",
        description=f"Scanned {scan_result.media_kind} file for privacy exposures and metadata.",
        status="warning" if scan_result.overall_privacy_risk in ["HIGH", "CRITICAL"] else "info",
        metadata={
            "file_name": scan_result.file_name,
            "media_kind": scan_result.media_kind,
            "overall_privacy_risk": scan_result.overall_privacy_risk,
            "is_supported": scan_result.is_supported,
        },
    )

    return scan_result


# ==========================================
# 4. PHASE A: ON-DEVICE AI IMAGE DETECTION
# ==========================================

@router.get("/model-status")
async def get_media_model_status_endpoint(
    current_user: User = Depends(get_current_user),
):
    """
    Returns the real-time status, provenance, and configuration of the local ONNX classifier.
    Never invents or hallucinates model status.
    """
    is_available = check_model_availability()
    return {
        "model_name": "Falconsai/nsfw_image_detection (ONNX ViT)",
        "source": "Hugging Face (onnx-community/nsfw_image_detection-ONNX)",
        "license": "Apache-2.0",
        "status": "AVAILABLE" if is_available else "UNAVAILABLE",
        "architecture": "ViTForImageClassification (Vision Transformer)",
        "input_dimensions": "224x224x3 (RGB)",
        "supported_labels": ["normal", "nsfw"],
        "execution_provider": "CPUExecutionProvider",
        "is_local": True,
        "checked_at": utc_now(),
    }

@router.post("/detect-image", response_model=ImageDetectionResult)
async def detect_single_image_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Executes local ONNX inference on a user-selected image (JPG, PNG, WEBP).
    Processes in-memory without saving original image or calling third-party cloud APIs.
    """
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read image stream: {str(e)}",
        )

    result = detect_single_image(
        file_bytes=content,
        file_name=file.filename or "image.jpg",
        mime_type=file.content_type,
    )

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="ON_DEVICE_AI_IMAGE_SCAN",
        title=f"AI Image Scan: {result.file_name}",
        description=f"Status: {result.status_display}. Sensitive: {result.is_sensitive}.",
        status="warning" if result.is_sensitive else "info",
        metadata={
            "file_name": result.file_name,
            "status": result.status,
            "is_sensitive": result.is_sensitive,
            "confidence_percent": result.confidence_percent,
        },
    )

    return result

@router.post("/detect-images", response_model=BatchImageDetectionResponse)
async def detect_batch_images_endpoint(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Executes local ONNX inference on multiple user-selected images in a single batch.
    Processes all items in-memory and returns actual classification probabilities.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image files uploaded in request.",
        )

    prepared_files = []
    for f in files:
        try:
            content = await f.read()
            prepared_files.append((content, f.filename or "image.jpg", f.content_type))
        except Exception:
            prepared_files.append((b"", f.filename or "image.jpg", f.content_type))

    batch_result = detect_batch_images(prepared_files)

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="BATCH_AI_IMAGE_SCAN",
        title=f"Batch AI Image Scan ({batch_result.total_files} files)",
        description=f"Processed {batch_result.processed_files} images. Detected {batch_result.sensitive_files_count} sensitive files.",
        status="warning" if batch_result.sensitive_files_count > 0 else "info",
        metadata={
            "total_files": batch_result.total_files,
            "sensitive_count": batch_result.sensitive_files_count,
            "overall_risk": batch_result.overall_risk,
        },
    )

    return batch_result


# ==========================================
# 2. METADATA INTELLIGENCE
# ==========================================

@router.post("/metadata", response_model=MetadataExtractionResponse)
async def extract_metadata_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Extracts complete EXIF, GPS geolocation coordinates, camera hardware serials,
    and audio ID3/WAV chunks from selected media files.
    Explains the privacy impact of each field.
    """
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read media file for metadata extraction: {str(e)}",
        )

    result = extract_file_metadata(content, file.filename or "unknown_file")

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="METADATA_EXTRACTED",
        title=f"Metadata Extracted: {result.file_name}",
        description=f"Extracted {len(result.metadata_fields)} metadata tags. GPS detected: {result.has_gps}.",
        status="warning" if result.overall_metadata_risk in ["HIGH", "CRITICAL"] else "info",
        metadata={
            "file_name": result.file_name,
            "has_gps": result.has_gps,
            "overall_metadata_risk": result.overall_metadata_risk,
            "fields_count": len(result.metadata_fields),
        },
    )

    return result

@router.post("/sanitize")
async def sanitize_media_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Strips EXIF, GPS, camera manufacturer metadata, and audio tags from the media file.
    Returns a sanitized copy as an attachment stream without modifying the user's original file.
    """
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read media stream for sanitization: {str(e)}",
        )

    sanitized_bytes, mime_type, sanitized_filename = sanitize_media_file(
        content, file.filename or "file.bin"
    )

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="MEDIA_SANITIZED",
        title=f"Media Sanitized: {sanitized_filename}",
        description="Stripped EXIF, GPS, and metadata. Downloaded sanitized copy.",
        status="success",
        metadata={
            "original_filename": file.filename,
            "sanitized_filename": sanitized_filename,
            "original_bytes": len(content),
            "sanitized_bytes": len(sanitized_bytes),
        },
    )

    return Response(
        content=sanitized_bytes,
        media_type=mime_type,
        headers={
            "Content-Disposition": f'attachment; filename="{sanitized_filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )

# ==========================================
# 3. SENSITIVE INFORMATION DETECTION
# ==========================================

@router.post("/scan-document", response_model=DocumentScanResponse)
async def scan_document_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Scans TXT, CSV, JSON, LOG, and PDF documents for sensitive PII and cryptographic secrets.
    Employs Luhn checksum validation for credit cards and Mod-97 validation for IBANs.
    Files are analyzed strictly in-memory and never persisted to disk.
    """
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read document stream: {str(e)}",
        )

    scan_result = scan_document_for_pii(content, file.filename or "document.txt")

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="DOCUMENT_PII_SCAN",
        title=f"Document PII Scan: {scan_result.file_name}",
        description=f"Scanned document ({scan_result.total_lines} lines). Identified {len(scan_result.findings)} sensitive findings.",
        status="warning" if scan_result.overall_privacy_risk in ["HIGH", "CRITICAL"] else "info",
        metadata={
            "file_name": scan_result.file_name,
            "total_lines": scan_result.total_lines,
            "overall_privacy_risk": scan_result.overall_privacy_risk,
            "findings_count": len(scan_result.findings),
            "critical_count": scan_result.findings_count_by_severity.get("CRITICAL", 0),
        },
    )

    return scan_result


# ==========================================
# 4. PHASE A: ON-DEVICE AI IMAGE DETECTION
# ==========================================

@router.get("/model-status")
async def get_media_model_status_endpoint(
    current_user: User = Depends(get_current_user),
):
    """
    Returns the real-time status, provenance, and configuration of the local ONNX classifier.
    Never invents or hallucinates model status.
    """
    is_available = check_model_availability()
    return {
        "model_name": "Falconsai/nsfw_image_detection (ONNX ViT)",
        "source": "Hugging Face (onnx-community/nsfw_image_detection-ONNX)",
        "license": "Apache-2.0",
        "status": "AVAILABLE" if is_available else "UNAVAILABLE",
        "architecture": "ViTForImageClassification (Vision Transformer)",
        "input_dimensions": "224x224x3 (RGB)",
        "supported_labels": ["normal", "nsfw"],
        "execution_provider": "CPUExecutionProvider",
        "is_local": True,
        "checked_at": utc_now(),
    }

@router.post("/detect-image", response_model=ImageDetectionResult)
async def detect_single_image_endpoint(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Executes local ONNX inference on a user-selected image (JPG, PNG, WEBP).
    Processes in-memory without saving original image or calling third-party cloud APIs.
    """
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read image stream: {str(e)}",
        )

    result = detect_single_image(
        file_bytes=content,
        file_name=file.filename or "image.jpg",
        mime_type=file.content_type,
    )

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="ON_DEVICE_AI_IMAGE_SCAN",
        title=f"AI Image Scan: {result.file_name}",
        description=f"Status: {result.status_display}. Sensitive: {result.is_sensitive}.",
        status="warning" if result.is_sensitive else "info",
        metadata={
            "file_name": result.file_name,
            "status": result.status,
            "is_sensitive": result.is_sensitive,
            "confidence_percent": result.confidence_percent,
        },
    )

    return result

@router.post("/detect-images", response_model=BatchImageDetectionResponse)
async def detect_batch_images_endpoint(
    files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Executes local ONNX inference on multiple user-selected images in a single batch.
    Processes all items in-memory and returns actual classification probabilities.
    """
    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No image files uploaded in request.",
        )

    prepared_files = []
    for f in files:
        try:
            content = await f.read()
            prepared_files.append((content, f.filename or "image.jpg", f.content_type))
        except Exception:
            prepared_files.append((b"", f.filename or "image.jpg", f.content_type))

    batch_result = detect_batch_images(prepared_files)

    log_activity(
        db=db,
        user_id=current_user.id,
        activity_type="BATCH_AI_IMAGE_SCAN",
        title=f"Batch AI Image Scan ({batch_result.total_files} files)",
        description=f"Processed {batch_result.processed_files} images. Detected {batch_result.sensitive_files_count} sensitive files.",
        status="warning" if batch_result.sensitive_files_count > 0 else "info",
        metadata={
            "total_files": batch_result.total_files,
            "sensitive_count": batch_result.sensitive_files_count,
            "overall_risk": batch_result.overall_risk,
        },
    )

    return batch_result

