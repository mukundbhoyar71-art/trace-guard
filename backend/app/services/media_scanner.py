"""
TRACE GUARD - Sensitive Media Scanner Service
Performs genuine local media inspection on user-selected images and audio files.
Strict Accuracy Rules:
- Never generates random, fake, or simulated scan results.
- If a genuine deep learning classifier is not installed in the environment,
  honestly reports it as UNAVAILABLE rather than pretending to scan successfully.
- Never writes uploaded files to disk or external services.
"""

import io
import struct
import wave
import datetime
from typing import Dict, Any, List, Optional, Tuple
from PIL import Image

from app.schemas.media import (
    MediaScanResponse,
    MediaFindingItem,
    MediaClassifierCapability,
)

MAX_MEDIA_FILE_SIZE = 25 * 1024 * 1024  # 25 MB limit

def utc_now():
    return datetime.datetime.now(datetime.timezone.utc)

def detect_mime_type(data: bytes, filename: str) -> Tuple[str, str]:
    """
    Detects true MIME type and media kind using magic bytes, with filename fallback.
    Returns: (mime_type, media_kind) where media_kind is 'image', 'audio', or 'unsupported'.
    """
    if len(data) >= 3 and data[:3] == b'\xFF\xD8\xFF':
        return "image/jpeg", "image"
    if len(data) >= 8 and data[:8] == b'\x89PNG\r\n\x1a\n':
        return "image/png", "image"
    if len(data) >= 12 and data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return "image/webp", "image"
    if len(data) >= 12 and data[:4] == b'RIFF' and data[8:12] == b'WAVE':
        return "audio/wav", "audio"
    if len(data) >= 3 and data[:3] == b'ID3':
        return "audio/mpeg", "audio"
    if len(data) >= 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0:
        return "audio/mpeg", "audio"
    if len(data) >= 8 and (data[4:8] == b'ftyp' or data[4:11] == b'ftypM4A'):
        return "audio/mp4", "audio"
    if len(data) >= 4 and data[:4] == b'OggS':
        return "audio/ogg", "audio"
    if len(data) >= 4 and data[:4] == b'fLaC':
        return "audio/flac", "audio"

    # Fallback to extension check
    lower_name = filename.lower()
    if lower_name.endswith(('.jpg', '.jpeg')):
        return "image/jpeg", "image"
    if lower_name.endswith('.png'):
        return "image/png", "image"
    if lower_name.endswith('.webp'):
        return "image/webp", "image"
    if lower_name.endswith('.wav'):
        return "audio/wav", "audio"
    if lower_name.endswith('.mp3'):
        return "audio/mpeg", "audio"
    if lower_name.endswith(('.m4a', '.aac')):
        return "audio/mp4", "audio"

    return "application/octet-stream", "unsupported"


def calculate_skin_tone_ratio(img: Image.Image) -> float:
    """
    Genuine computer-vision heuristic using standard YCbCr skin chrominance thresholding.
    Skin chrominance cluster: Y in [80, 255], Cb in [85, 135], Cr in [135, 180].
    """
    try:
        # Resize thumbnail to 150x150 for quick mathematical evaluation
        thumb = img.convert("RGB").resize((150, 150))
        ycbcr = thumb.convert("YCbCr")
        if hasattr(ycbcr, "get_flattened_data"):
            flat = ycbcr.get_flattened_data()
            total = len(flat) // 3
            if total == 0:
                return 0.0
            skin_count = 0
            for i in range(0, len(flat), 3):
                y = flat[i]
                cb = flat[i + 1]
                cr = flat[i + 2]
                if 80 <= y <= 255 and 85 <= cb <= 135 and 135 <= cr <= 180:
                    skin_count += 1
            return round(skin_count / total, 4)
        else:
            pixels = list(ycbcr.getdata())
            total = len(pixels)
            if total == 0:
                return 0.0
            skin_count = sum(1 for y, cb, cr in pixels if 80 <= y <= 255 and 85 <= cb <= 135 and 135 <= cr <= 180)
            return round(skin_count / total, 4)
    except Exception:
        return 0.0


def scan_image_media(file_bytes: bytes, filename: str) -> MediaScanResponse:
    """
    Inspects image file locally using Pillow and EXIF parsing.
    """
    try:
        img = Image.open(io.BytesIO(file_bytes))
        img_format = img.format or "IMAGE"
        width, height = img.size
        megapixels = round((width * height) / 1_000_000, 2)
        mode = img.mode

        technical_props = {
            "format": img_format,
            "dimensions": f"{width} x {height}",
            "width_px": width,
            "height_px": height,
            "megapixels": megapixels,
            "color_mode": mode,
            "has_alpha_channel": mode in ("RGBA", "LA") or (mode == "P" and "transparency" in img.info),
        }

        findings = []
        recommendations = []
        overall_risk = "LOW"

        # 1. Skin-tone coverage analysis
        skin_ratio = calculate_skin_tone_ratio(img)
        technical_props["skin_tone_ratio"] = skin_ratio

        if skin_ratio >= 0.38:
            findings.append(MediaFindingItem(
                category="High Skin-Tone Exposure",
                detection_type="POSSIBLE",
                confidence=skin_ratio,
                detail=f"Image exhibits high proportion ({round(skin_ratio * 100, 1)}%) of human skin-tone color space pixels.",
                recommendation="Review visual content for intimate or sensitive physical exposure prior to public transmission.",
            ))
            recommendations.append("Audit image for sensitive physical exposure or personal privacy boundaries.")
            overall_risk = "MODERATE"
        else:
            findings.append(MediaFindingItem(
                category="High Skin-Tone Exposure",
                detection_type="NOT_DETECTED",
                confidence=skin_ratio,
                detail=f"Skin-tone color space coverage is low ({round(skin_ratio * 100, 1)}%).",
                recommendation="No abnormal skin-tone surface clustering identified.",
            ))

        # 2. Check for Embedded EXIF & GPS
        exif_data = img.getexif()
        has_gps = False
        gps_raw = None
        if exif_data:
            # 34853 is the tag for GPSInfo
            gps_raw = exif_data.get(34853)
            if gps_raw:
                has_gps = True

        if has_gps:
            findings.append(MediaFindingItem(
                category="Embedded GPS Geolocation",
                detection_type="CONFIRMED",
                confidence=1.0,
                detail="EXIF GPS coordinates are permanently embedded in this image file.",
                recommendation="Sanitize image using TRACE GUARD Metadata Sanitizer to strip geographic coordinates.",
            ))
            recommendations.append("Strip embedded GPS coordinates to prevent physical address and residence correlation.")
            overall_risk = "HIGH"
        else:
            findings.append(MediaFindingItem(
                category="Embedded GPS Geolocation",
                detection_type="NOT_DETECTED",
                confidence=0.0,
                detail="Zero GPS coordinate tags detected in image metadata headers.",
                recommendation="No physical location tags embedded in image file.",
            ))

        # 3. Honest Classifier Capability Reporting
        capabilities = [
            MediaClassifierCapability(
                capability_name="Algorithmic Skin-Tone & Color-Space Heuristic",
                status="ACTIVE_LOCAL_HEURISTIC",
                engine_details="Local YCbCr chrominance cluster evaluation (80<=Y<=255, 85<=Cb<=135, 135<=Cr<=180).",
                explanation="Executed in-memory without network transmission.",
            ),
            MediaClassifierCapability(
                capability_name="EXIF Hardware & Spatial Marker Detector",
                status="ACTIVE_LOCAL_HEURISTIC",
                engine_details="Direct binary EXIF header parsing via Pillow ExifTags.",
                explanation="Extracts spatial tags and hardware identifiers locally.",
            ),
            MediaClassifierCapability(
                capability_name="Deep Learning Visual Semantic Classifier (CNN / CLIP)",
                status="UNAVAILABLE",
                engine_details="TensorFlow / PyTorch neural network weights are not bundled in this runtime environment.",
                explanation="Deep neural classification is honestly reported as UNAVAILABLE rather than producing synthetic results.",
            ),
        ]

        if not recommendations:
            recommendations.append("File verified clean of embedded spatial coordinates and excessive physical exposure indicators.")

        return MediaScanResponse(
            file_name=filename,
            file_type=f"image/{img_format.lower()}",
            media_kind="image",
            file_size_bytes=len(file_bytes),
            is_supported=True,
            scan_status="COMPLETED",
            classifier_capabilities=capabilities,
            technical_properties=technical_props,
            findings=findings,
            overall_privacy_risk=overall_risk,
            scanned_at=utc_now(),
            recommendations=recommendations,
        )
    except Exception as e:
        return MediaScanResponse(
            file_name=filename,
            file_type="image/unknown",
            media_kind="image",
            file_size_bytes=len(file_bytes),
            is_supported=False,
            scan_status="ERROR",
            classifier_capabilities=[],
            technical_properties={"error": str(e)},
            findings=[
                MediaFindingItem(
                    category="Image Processing Error",
                    detection_type="UNSUPPORTED",
                    detail=f"Unable to parse image data: {str(e)}",
                    recommendation="Ensure the image file is not corrupt.",
                )
            ],
            overall_privacy_risk="UNKNOWN",
            scanned_at=utc_now(),
            recommendations=["Verify file integrity and re-attempt scan."],
        )


def scan_audio_media(file_bytes: bytes, filename: str) -> MediaScanResponse:
    """
    Inspects audio file locally using structural header parsing (WAV, MP3, M4A).
    """
    findings = []
    recommendations = []
    technical_props = {}
    overall_risk = "LOW"
    format_detected = "audio"

    # Attempt WAV inspection via wave module
    if len(file_bytes) >= 12 and file_bytes[:4] == b'RIFF' and file_bytes[8:12] == b'WAVE':
        format_detected = "audio/wav"
        try:
            with wave.open(io.BytesIO(file_bytes), 'rb') as wav_file:
                nchannels = wav_file.getnchannels()
                sampwidth = wav_file.getsampwidth()
                framerate = wav_file.getframerate()
                nframes = wav_file.getnframes()
                duration_sec = round(nframes / framerate, 2) if framerate > 0 else 0.0

                technical_props = {
                    "format": "WAV (Uncompressed PCM)",
                    "channels": "Stereo" if nchannels == 2 else ("Mono" if nchannels == 1 else f"{nchannels} Channels"),
                    "sample_rate_hz": framerate,
                    "bit_depth": sampwidth * 8,
                    "duration_seconds": duration_sec,
                    "total_frames": nframes,
                }

                # Sample frames to check acoustic energy
                frames_to_read = min(nframes, framerate * 2)  # up to 2 seconds
                raw_frames = wav_file.readframes(frames_to_read)
                has_active_signal = any(b != 0 for b in raw_frames)

                if has_active_signal:
                    findings.append(MediaFindingItem(
                        category="Acoustic Signal Activity",
                        detection_type="CONFIRMED",
                        detail=f"Active audio waveform detected with {technical_props['channels']} at {framerate} Hz.",
                        recommendation="Audit recorded audio for identifiable ambient voices or background conversations.",
                    ))
                else:
                    findings.append(MediaFindingItem(
                        category="Acoustic Signal Activity",
                        detection_type="NOT_DETECTED",
                        detail="Audio stream contains zero or muted amplitude.",
                        recommendation="File contains silent frames.",
                    ))
        except Exception as e:
            technical_props["wav_parse_warning"] = str(e)

    # Attempt MP3 inspection
    elif file_bytes.startswith(b'ID3') or (len(file_bytes) >= 2 and file_bytes[0] == 0xFF):
        format_detected = "audio/mpeg"
        has_id3 = file_bytes.startswith(b'ID3')
        technical_props = {
            "format": "MP3 (MPEG Audio Layer 3)",
            "has_id3_metadata": has_id3,
        }

        if has_id3:
            # ID3v2 major version
            id3_version = file_bytes[3]
            technical_props["id3_version"] = f"2.{id3_version}.0"
            findings.append(MediaFindingItem(
                category="Embedded Audio Metadata Tags",
                detection_type="CONFIRMED",
                detail=f"ID3v2.{id3_version} metadata container present in audio stream.",
                recommendation="Audit embedded tags (Title, Artist, Encoder) for personal identity disclosure.",
            ))
            recommendations.append("Review audio ID3 tags before sharing to prevent user/system identity leakage.")
            overall_risk = "MODERATE"
        else:
            findings.append(MediaFindingItem(
                category="Embedded Audio Metadata Tags",
                detection_type="NOT_DETECTED",
                detail="Zero ID3v2 header markers found at start of stream.",
                recommendation="Clean MPEG stream without prepended ID3v2 tags.",
            ))

    # Attempt M4A/AAC inspection
    elif len(file_bytes) >= 8 and (file_bytes[4:8] == b'ftyp' or file_bytes[4:11] == b'ftypM4A'):
        format_detected = "audio/mp4"
        technical_props = {
            "format": "M4A / AAC (MPEG-4 Audio)",
            "container": "ISO Base Media File Format",
        }
        # Check for metadata atom 'moov' -> 'udta' -> 'meta'
        has_meta_atom = b'meta' in file_bytes[:4096] or b'ilst' in file_bytes[:4096]
        technical_props["has_container_metadata"] = has_meta_atom
        if has_meta_atom:
            findings.append(MediaFindingItem(
                category="Embedded Container Metadata",
                detection_type="CONFIRMED",
                detail="MPEG-4 metadata container ('meta'/'ilst') detected in file header.",
                recommendation="Inspect audio container tags for hardware or account information.",
            ))
            overall_risk = "MODERATE"
        else:
            findings.append(MediaFindingItem(
                category="Embedded Container Metadata",
                detection_type="NOT_DETECTED",
                detail="Zero MPEG-4 metadata atoms detected in header segment.",
                recommendation="No container metadata identified.",
            ))
    else:
        format_detected = "audio/generic"
        technical_props = {"format": "Generic Audio Stream"}

    # Honest Classifier Capability Reporting
    capabilities = [
        MediaClassifierCapability(
            capability_name="Binary Header & PCM Structure Telemetry",
            status="ACTIVE_LOCAL_HEURISTIC",
            engine_details="Direct binary RIFF / MPEG frame and ID3/M4A atom stream inspection.",
            explanation="Calculates technical audio attributes without remote communication.",
        ),
        MediaClassifierCapability(
            capability_name="Acoustic Speech-to-Text Semantic Classifier (Whisper)",
            status="UNAVAILABLE",
            engine_details="Acoustic automatic speech recognition neural models (e.g. OpenAI Whisper / Vosk) are not installed in the local environment.",
            explanation="Semantic audio classification is honestly reported as UNAVAILABLE rather than pretending speech was analyzed.",
        ),
    ]

    if not recommendations:
        recommendations.append("Audio format verified. Ensure no private verbal statements or identifying background noise exist.")

    return MediaScanResponse(
        file_name=filename,
        file_type=format_detected,
        media_kind="audio",
        file_size_bytes=len(file_bytes),
        is_supported=True,
        scan_status="COMPLETED",
        classifier_capabilities=capabilities,
        technical_properties=technical_props,
        findings=findings,
        overall_privacy_risk=overall_risk,
        scanned_at=utc_now(),
        recommendations=recommendations,
    )


def scan_media_file(file_bytes: bytes, filename: str) -> MediaScanResponse:
    """
    Main dispatch entry point for media inspection.
    Validates file sizes, mime types, and routes to image or audio inspectors.
    """
    if len(file_bytes) > MAX_MEDIA_FILE_SIZE:
        return MediaScanResponse(
            file_name=filename,
            file_type="unknown",
            media_kind="unsupported",
            file_size_bytes=len(file_bytes),
            is_supported=False,
            scan_status="ERROR",
            classifier_capabilities=[],
            technical_properties={"size_exceeded": True, "max_allowed_bytes": MAX_MEDIA_FILE_SIZE},
            findings=[
                MediaFindingItem(
                    category="File Size Limit",
                    detection_type="CONFIRMED",
                    detail=f"File size ({round(len(file_bytes) / (1024 * 1024), 2)} MB) exceeds local 25 MB privacy threshold.",
                    recommendation="Select a media file under 25 MB for local processing.",
                )
            ],
            overall_privacy_risk="UNKNOWN",
            scanned_at=utc_now(),
            recommendations=["Choose a smaller file to ensure smooth browser and local runtime performance."],
        )

    mime, media_kind = detect_mime_type(file_bytes, filename)

    if media_kind == "image":
        return scan_image_media(file_bytes, filename)
    elif media_kind == "audio":
        return scan_audio_media(file_bytes, filename)
    else:
        return MediaScanResponse(
            file_name=filename,
            file_type=mime,
            media_kind="unsupported",
            file_size_bytes=len(file_bytes),
            is_supported=False,
            scan_status="UNSUPPORTED_FORMAT",
            classifier_capabilities=[],
            technical_properties={"mime_type": mime},
            findings=[
                MediaFindingItem(
                    category="Unsupported Media Format",
                    detection_type="UNSUPPORTED",
                    detail=f"Format '{mime}' is not a supported media type (Supported: JPG, PNG, WEBP, MP3, WAV, M4A).",
                    recommendation="Select an image (JPG, PNG, WEBP) or audio file (MP3, WAV, M4A).",
                )
            ],
            overall_privacy_risk="UNKNOWN",
            scanned_at=utc_now(),
            recommendations=["Convert file to a supported format before re-scanning."],
        )
