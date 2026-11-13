import io
import os
import datetime
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple

from PIL import Image, UnidentifiedImageError
import numpy as np

from app.schemas.media import ImageDetectionResult, BatchImageDetectionResponse

# Set PIL safety limits against decompression bombs
Image.MAX_IMAGE_PIXELS = 50_000_000

logger = logging.getLogger(__name__)

# Max upload size: 25 MB
MAX_IMAGE_SIZE_BYTES = 25 * 1024 * 1024
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Model configuration
DEFAULT_MODEL_PATH = (
    Path(__file__).resolve().parent.parent.parent / "models" / "nsfw_detector.onnx"
)

# Global session cache
_CACHED_SESSION = None
_CACHED_SESSION_PATH = None

def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)

def get_onnx_session(model_path: Optional[str] = None):
    """
    Retrieves or initializes an ONNX Runtime InferenceSession for CPU execution.
    Returns None if the model file is missing or onnxruntime cannot load it.
    """
    global _CACHED_SESSION, _CACHED_SESSION_PATH

    target_path = Path(model_path) if model_path else DEFAULT_MODEL_PATH

    if not target_path.exists():
        return None

    if _CACHED_SESSION is not None and _CACHED_SESSION_PATH == str(target_path):
        return _CACHED_SESSION

    try:
        import onnxruntime as ort

        # Initialize with CPUExecutionProvider
        sess_options = ort.SessionOptions()
        sess_options.intra_op_num_threads = 2
        sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        session = ort.InferenceSession(
            str(target_path),
            sess_options=sess_options,
            providers=["CPUExecutionProvider"],
        )
        _CACHED_SESSION = session
        _CACHED_SESSION_PATH = str(target_path)
        return _CACHED_SESSION
    except Exception as e:
        logger.error(f"Failed to load ONNX model from {target_path}: {e}")
        return None

def check_model_availability(model_path: Optional[str] = None) -> bool:
    """Checks if the ONNX model is available and loadable."""
    target_path = Path(model_path) if model_path else DEFAULT_MODEL_PATH
    return target_path.exists()

def preprocess_image_tensor(img: Image.Image) -> np.ndarray:
    """
    Preprocesses PIL image for FalconsAI ViT ONNX model:
    1. Converts to RGB.
    2. Resizes to 224x224 (bilinear interpolation).
    3. Rescales values by 1/255.
    4. Normalizes with mean=[0.5, 0.5, 0.5] and std=[0.5, 0.5, 0.5].
    5. Formats as [1, 3, 224, 224] float32 tensor.
    """
    # Convert any alpha/palette mode to pure RGB
    rgb_img = img.convert("RGB")
    # Resize to model input dimensions
    resized = rgb_img.resize((224, 224), Image.Resampling.BILINEAR)

    # Convert to float numpy array normalized between -1.0 and 1.0
    arr = np.array(resized, dtype=np.float32) / 255.0
    arr = (arr - 0.5) / 0.5  # Mean=0.5, Std=0.5

    # Channels first: [H, W, C] -> [C, H, W]
    arr = np.transpose(arr, (2, 0, 1))

    # Add batch dimension: [1, 3, 224, 224]
    return np.expand_dims(arr, axis=0)

def detect_single_image(
    file_bytes: bytes,
    file_name: str,
    mime_type: Optional[str] = None,
    model_path: Optional[str] = None,
) -> ImageDetectionResult:
    """
    Performs on-device AI detection on a single image in-memory.
    Follows strict safety, decompression bomb protection, and truthful capability reporting.
    """
    ext = os.path.splitext(file_name)[1].lower() if file_name else ""
    now = utc_now()
    resolved_mime = mime_type or f"image/{ext.lstrip('.')}"

    # General probabilistic disclaimer required by Section 5
    probabilistic_disclaimer = (
        "Classification is probabilistic and may produce false positives or false negatives. "
        "Note: An absence of detected sensitive categories does not guarantee an image is safe or benign."
    )

    # 1. Validate File Size
    if len(file_bytes) == 0:
        return ImageDetectionResult(
            file_name=file_name,
            file_size_bytes=0,
            mime_type=resolved_mime,
            status="UNSUPPORTED_FILE",
            status_display="Unsupported file",
            interpretation=f"File is empty (0 bytes). {probabilistic_disclaimer}",
            recommendation="Select a valid non-empty image file.",
            processed_at=now,
            error_detail="Empty file stream.",
        )

    if len(file_bytes) > MAX_IMAGE_SIZE_BYTES:
        return ImageDetectionResult(
            file_name=file_name,
            file_size_bytes=len(file_bytes),
            mime_type=resolved_mime,
            status="UNSUPPORTED_FILE",
            status_display="Unsupported file",
            interpretation=f"File exceeds the 25 MB upload size limit. {probabilistic_disclaimer}",
            recommendation="Reduce the image resolution or compress file before scanning.",
            processed_at=now,
            error_detail=f"File size ({len(file_bytes)} bytes) exceeds 25 MB limit.",
        )

    # 2. Validate File Extension
    if ext not in SUPPORTED_EXTENSIONS:
        return ImageDetectionResult(
            file_name=file_name,
            file_size_bytes=len(file_bytes),
            mime_type=resolved_mime,
            status="UNSUPPORTED_FILE",
            status_display="Unsupported file",
            interpretation=f"Unsupported format '{ext}'. TRACE GUARD supports JPG, JPEG, PNG, and WEBP formats. {probabilistic_disclaimer}",
            recommendation="Convert your image to JPG, PNG, or WEBP before scanning.",
            processed_at=now,
            error_detail=f"Unsupported file extension: {ext}",
        )

    # 3. Decode & Verify Image In-Memory (Decompression Bomb & Corruption Guard)
    try:
        # Pass 1: verify headers and integrity
        raw_stream = io.BytesIO(file_bytes)
        img_verify = Image.open(raw_stream)
        img_verify.verify()

        # Pass 2: actual image load
        raw_stream.seek(0)
        img = Image.open(raw_stream)
        img.load()  # Force decoding of all pixel buffers
    except Image.DecompressionBombError as dbe:
        return ImageDetectionResult(
            file_name=file_name,
            file_size_bytes=len(file_bytes),
            mime_type=resolved_mime,
            status="SCAN_FAILED",
            status_display="Scan failed",
            interpretation=f"Decompression bomb detected. Image resolution exceeds safe decoding limits. {probabilistic_disclaimer}",
            recommendation="Avoid loading extreme resolution images that could exhaust memory.",
            processed_at=now,
            error_detail=str(dbe),
        )
    except (UnidentifiedImageError, OSError, SyntaxError) as err:
        return ImageDetectionResult(
            file_name=file_name,
            file_size_bytes=len(file_bytes),
            mime_type=resolved_mime,
            status="SCAN_FAILED",
            status_display="Scan failed",
            interpretation=f"Image decoding failed or corrupted file contents detected. {probabilistic_disclaimer}",
            recommendation="Verify the image is not corrupted and is a valid image format.",
            processed_at=now,
            error_detail=str(err),
        )
    except Exception as err:
        return ImageDetectionResult(
            file_name=file_name,
            file_size_bytes=len(file_bytes),
            mime_type=resolved_mime,
            status="SCAN_FAILED",
            status_display="Scan failed",
            interpretation=f"Unexpected error encountered during image decoding. {probabilistic_disclaimer}",
            recommendation="Try scanning a different image file.",
            processed_at=now,
            error_detail=str(err),
        )

    # 4. Check Local ONNX Model Availability
    session = get_onnx_session(model_path)
    if session is None:
        return ImageDetectionResult(
            file_name=file_name,
            file_size_bytes=len(file_bytes),
            mime_type=resolved_mime,
            status="MODEL_UNAVAILABLE",
            status_display="Model unavailable",
            interpretation=f"The on-device AI image classification model (nsfw_detector.onnx) is not installed or available at the configured path. {probabilistic_disclaimer}",
            recommendation="Ensure the ONNX model file is deployed locally in backend/models/nsfw_detector.onnx.",
            model_info={
                "model_name": "Falconsai/nsfw_image_detection (ONNX ViT)",
                "status": "UNAVAILABLE",
                "execution_provider": "CPUExecutionProvider",
                "license": "Apache-2.0",
                "is_local": True,
            },
            processed_at=now,
            error_detail="Model binary file missing or uninitialized.",
        )

    # 5. Execute On-Device Inference
    try:
        tensor = preprocess_image_tensor(img)
        outputs = session.run(["logits"], {"pixel_values": tensor})
        logits = outputs[0][0]

        # Softmax computation
        exp_logits = np.exp(logits - np.max(logits))
        probabilities = exp_logits / np.sum(exp_logits)

        # Labels mapping (0: normal, 1: nsfw)
        normal_prob = float(probabilities[0])
        nsfw_prob = float(probabilities[1])

        probs_dict = {
            "normal": round(normal_prob, 4),
            "nsfw": round(nsfw_prob, 4),
        }

        # Model Info metadata
        model_info = {
            "model_name": "Falconsai/nsfw_image_detection (ONNX ViT)",
            "status": "AVAILABLE",
            "execution_provider": "CPUExecutionProvider",
            "license": "Apache-2.0",
            "is_local": True,
            "architecture": "ViTForImageClassification",
            "input_resolution": "224x224",
        }

        # Determine sensitivity based on 50% threshold
        if nsfw_prob >= 0.50:
            status = "SENSITIVE_DETECTED"
            status_display = "Potentially sensitive content detected"
            primary_label = "nsfw"
            confidence = round(nsfw_prob, 4)
            confidence_pct = round(nsfw_prob * 100, 2)
            is_sensitive = True
            risk_level = "HIGH"
            interpretation = (
                f"Local ONNX AI model detected potentially sensitive visual content ({confidence_pct}% confidence). "
                f"{probabilistic_disclaimer}"
            )
            recommendation = (
                "Review this image before external distribution, sharing, or public cloud storage. "
                "Consider redacting or storing in an encrypted vault."
            )
        else:
            status = "NO_SENSITIVE_DETECTED"
            status_display = "No supported sensitive category detected"
            primary_label = "normal"
            confidence = round(normal_prob, 4)
            confidence_pct = round(normal_prob * 100, 2)
            is_sensitive = False
            risk_level = "LOW"
            interpretation = (
                f"No supported sensitive category detected by the local classifier (Normal confidence: {confidence_pct}%). "
                f"{probabilistic_disclaimer}"
            )
            recommendation = (
                "Ensure standard operational privacy. Note that automated classification is probabilistic "
                "and does not guarantee absolute safety."
            )

        return ImageDetectionResult(
            file_name=file_name,
            file_size_bytes=len(file_bytes),
            mime_type=resolved_mime,
            status=status,
            status_display=status_display,
            primary_label=primary_label,
            confidence=confidence,
            confidence_percent=confidence_pct,
            probabilities=probs_dict,
            is_sensitive=is_sensitive,
            risk_level=risk_level,
            interpretation=interpretation,
            recommendation=recommendation,
            model_info=model_info,
            processed_at=now,
        )

    except Exception as e:
        logger.error(f"Inference error on {file_name}: {e}")
        return ImageDetectionResult(
            file_name=file_name,
            file_size_bytes=len(file_bytes),
            mime_type=resolved_mime,
            status="SCAN_FAILED",
            status_display="Scan failed",
            interpretation=f"An error occurred during local ONNX inference: {str(e)}. {probabilistic_disclaimer}",
            recommendation="Retry scanning or check system resources.",
            processed_at=now,
            error_detail=str(e),
        )

def detect_batch_images(
    files: List[Tuple[bytes, str, Optional[str]]],
    model_path: Optional[str] = None,
) -> BatchImageDetectionResponse:
    """
    Processes multiple images in-memory and aggregates findings.
    """
    results: List[ImageDetectionResult] = []
    sensitive_count = 0
    model_available = check_model_availability(model_path)

    for file_bytes, filename, mime_type in files:
        res = detect_single_image(
            file_bytes=file_bytes,
            file_name=filename,
            mime_type=mime_type,
            model_path=model_path,
        )
        if res.is_sensitive:
            sensitive_count += 1
        results.append(res)

    overall_risk = "HIGH" if sensitive_count > 0 else "LOW"

    return BatchImageDetectionResponse(
        total_files=len(files),
        processed_files=len(results),
        sensitive_files_count=sensitive_count,
        model_status="AVAILABLE" if model_available else "UNAVAILABLE",
        results=results,
        overall_risk=overall_risk,
        scanned_at=utc_now(),
    )

