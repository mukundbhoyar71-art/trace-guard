import io
import os
import re
import struct
import datetime
from typing import Optional, List, Dict, Any, Tuple
from PIL import Image, ExifTags

from app.schemas.media import (
    MetadataExtractionResponse,
    MetadataFieldItem,
)

def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)

def _dms_to_decimal(dms: Any, ref: str) -> Optional[float]:
    """Converts Degrees, Minutes, Seconds rational/tuple to decimal degrees."""
    try:
        if isinstance(dms, (list, tuple)) and len(dms) >= 3:
            deg = float(dms[0])
            minute = float(dms[1])
            sec = float(dms[2])
            decimal = deg + (minute / 60.0) + (sec / 3600.0)
            if ref and ref.upper() in ["S", "W"]:
                decimal = -decimal
            return round(decimal, 6)
        elif isinstance(dms, (int, float)):
            decimal = float(dms)
            if ref and ref.upper() in ["S", "W"]:
                decimal = -decimal
            return round(decimal, 6)
    except Exception:
        return None
    return None

def extract_image_metadata(file_bytes: bytes, filename: str) -> MetadataExtractionResponse:
    """Extracts all EXIF, GPS, camera, and structural tags from image files."""
    fields: List[MetadataFieldItem] = []
    has_exif = False
    has_gps = False
    gps_info: Optional[Dict[str, Any]] = None
    overall_risk = "LOW"

    try:
        img = Image.open(io.BytesIO(file_bytes))
        width, height = img.size
        img_format = img.format or "IMAGE"
        img_mode = img.mode

        # Structural properties
        fields.append(
            MetadataFieldItem(
                key="dimensions",
                label="Resolution & Dimensions",
                value=f"{width} x {height} px",
                category="Technical / Structural",
                privacy_risk_level="INFO",
                privacy_significance="Aspect ratio and resolution indicate native display or sensor dimensions.",
            )
        )
        fields.append(
            MetadataFieldItem(
                key="color_mode",
                label="Color Encoding Mode",
                value=f"{img_mode} ({img_format})",
                category="Technical / Structural",
                privacy_risk_level="INFO",
                privacy_significance="Color space and compression profile used by the encoder.",
            )
        )

        # Attempt to read EXIF
        exif = img.getexif()
        if exif and len(exif) > 0:
            has_exif = True

            # Check for GPS in IFD
            gps_ifd = None
            try:
                gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo)
            except Exception:
                # Fallback tag 34853
                if 34853 in exif:
                    gps_ifd = exif[34853]

            if gps_ifd:
                lat_raw = gps_ifd.get(2) or gps_ifd.get(ExifTags.GPS.GPSLatitude)
                lat_ref = gps_ifd.get(1) or gps_ifd.get(ExifTags.GPS.GPSLatitudeRef, "N")
                lon_raw = gps_ifd.get(4) or gps_ifd.get(ExifTags.GPS.GPSLongitude)
                lon_ref = gps_ifd.get(3) or gps_ifd.get(ExifTags.GPS.GPSLongitudeRef, "E")
                alt_raw = gps_ifd.get(6) or gps_ifd.get(ExifTags.GPS.GPSAltitude)

                dec_lat = _dms_to_decimal(lat_raw, str(lat_ref))
                dec_lon = _dms_to_decimal(lon_raw, str(lon_ref))

                if dec_lat is not None and dec_lon is not None:
                    has_gps = True
                    overall_risk = "CRITICAL"
                    maps_link = f"https://www.google.com/maps?q={dec_lat},{dec_lon}"

                    gps_info = {
                        "latitude": dec_lat,
                        "longitude": dec_lon,
                        "latitude_ref": str(lat_ref),
                        "longitude_ref": str(lon_ref),
                        "altitude": float(alt_raw) if alt_raw is not None else None,
                        "maps_url": maps_link,
                    }

                    fields.append(
                        MetadataFieldItem(
                            key="gps_coordinates",
                            label="EXIF GPS Coordinates",
                            value=f"{dec_lat}, {dec_lon} ({lat_ref}/{lon_ref})",
                            category="Geolocation",
                            privacy_risk_level="CRITICAL",
                            privacy_significance="CRITICAL PRIVACY HAZARD: Discloses exact physical GPS location where the photo was shot. Can expose personal residences, workplaces, travel routes, or confidential physical premises.",
                        )
                    )

                    if alt_raw is not None:
                        fields.append(
                            MetadataFieldItem(
                                key="gps_altitude",
                                label="EXIF GPS Altitude",
                                value=f"{float(alt_raw):.1f} meters",
                                category="Geolocation",
                                privacy_risk_level="HIGH",
                                privacy_significance="Reveals building floor level or geographic elevation data.",
                            )
                        )

            # Known EXIF tags to interpret
            tag_privacy_map = {
                "Make": ("Device & Hardware", "HIGH", "Hardware manufacturer name used to capture the image. Enables hardware fingerprinting."),
                "Model": ("Device & Hardware", "HIGH", "Exact camera or smartphone model. Used in digital device correlation and targeted exploit profiling."),
                "LensMake": ("Device & Hardware", "MEDIUM", "Lens hardware manufacturer."),
                "LensModel": ("Device & Hardware", "MEDIUM", "Identifies specific optical lens configuration."),
                "CameraSerialNumber": ("Device & Hardware", "CRITICAL", "Unique hardware factory serial number. Links distinct images to the exact same physical device owner."),
                "LensSerialNumber": ("Device & Hardware", "HIGH", "Unique optical lens factory serial number."),
                "Software": ("Device & Hardware", "HIGH", "OS build or editing software used. Reveals platform version vulnerabilities."),
                "HostComputer": ("Device & Hardware", "HIGH", "Hostname or computer identifier where image was exported."),
                "DateTimeOriginal": ("Temporal / Timestamps", "HIGH", "Exact second the shutter was triggered. Reveals daily routine, work hours, or presence at an event."),
                "DateTimeDigitized": ("Temporal / Timestamps", "MEDIUM", "Timestamp when photo was digitized into electronic storage."),
                "DateTime": ("Temporal / Timestamps", "MEDIUM", "Last modified timestamp recorded by hardware."),
                "OffsetTime": ("Temporal / Timestamps", "MEDIUM", "Timezone offset from UTC, pinpointing geographic timezone."),
                "Artist": ("Author / Identity", "HIGH", "Author, creator, or photographer identity embedded in file."),
                "Copyright": ("Author / Identity", "MEDIUM", "Legal owner or copyright holder name."),
                "ExposureTime": ("Technical / Structural", "LOW", "Shutter exposure time in seconds."),
                "FNumber": ("Technical / Structural", "LOW", "Aperture f-stop setting."),
                "ISOSpeedRatings": ("Technical / Structural", "LOW", "Sensor sensitivity setting."),
                "Flash": ("Technical / Structural", "LOW", "Flash trigger mode and firing status."),
            }

            for tag_id, tag_val in exif.items():
                tag_name = ExifTags.TAGS.get(tag_id, str(tag_id))
                if tag_name in ["GPSInfo", "MakerNote"]:
                    continue  # Handled separately or binary proprietary blob

                str_val = str(tag_val).strip()
                if not str_val or len(str_val) > 200:
                    str_val = str_val[:200] + "..." if str_val else ""

                if tag_name in tag_privacy_map:
                    cat, risk, sig = tag_privacy_map[tag_name]
                    if overall_risk != "CRITICAL" and risk == "HIGH":
                        overall_risk = "HIGH"
                    elif overall_risk == "LOW" and risk == "MEDIUM":
                        overall_risk = "MEDIUM"

                    fields.append(
                        MetadataFieldItem(
                            key=tag_name.lower(),
                            label=f"EXIF {tag_name}",
                            value=str_val,
                            category=cat,
                            privacy_risk_level=risk,
                            privacy_significance=sig,
                        )
                    )

    except Exception as e:
        fields.append(
            MetadataFieldItem(
                key="parse_notice",
                label="Image Parser Notice",
                value=str(e),
                category="Technical / Structural",
                privacy_risk_level="INFO",
                privacy_significance="Encountered non-standard EXIF packaging or unrecognized image container.",
            )
        )

    # Summary generator
    if has_gps:
        summary = "CRITICAL RISK: Embedded GPS geolocation coordinates detected. This image reveals your exact physical coordinates."
    elif overall_risk == "HIGH":
        summary = "ELEVATED RISK: Hardware device serials, camera model, or creator tags detected that allow device fingerprinting."
    elif overall_risk == "MEDIUM":
        summary = "MODERATE RISK: Embedded timestamps and camera settings detected that expose capture timeline."
    else:
        summary = "MINIMAL RISK: No sensitive EXIF geolocation or hardware identifiers detected."

    return MetadataExtractionResponse(
        file_name=filename,
        file_type=f"image/{filename.split('.')[-1].lower()}",
        media_kind="image",
        file_size_bytes=len(file_bytes),
        has_exif=has_exif,
        has_gps=has_gps,
        gps_coordinates=gps_info,
        metadata_fields=fields,
        overall_metadata_risk=overall_risk,
        extracted_at=utc_now(),
        sanitization_available=True,
        summary=summary,
    )

def extract_audio_metadata(file_bytes: bytes, filename: str) -> MetadataExtractionResponse:
    """Extracts ID3 and RIFF chunk metadata from audio files."""
    fields: List[MetadataFieldItem] = []
    overall_risk = "LOW"
    ext = filename.split(".")[-1].lower()

    # Audio structural info
    fields.append(
        MetadataFieldItem(
            key="file_format",
            label="Audio Container Format",
            value=ext.upper(),
            category="Technical / Structural",
            privacy_risk_level="INFO",
            privacy_significance="Audio container format and standard stream specification.",
        )
    )

    # 1. WAV RIFF Chunks Parser
    if ext == "wav" and file_bytes.startswith(b"RIFF") and len(file_bytes) >= 12:
        try:
            pos = 12
            while pos + 8 <= len(file_bytes):
                chunk_id, chunk_size = struct.unpack("<4sI", file_bytes[pos:pos+8])
                chunk_str = chunk_id.decode("ascii", errors="ignore").strip()
                pos += 8

                if chunk_str == "LIST" and pos + 4 <= len(file_bytes):
                    list_type = file_bytes[pos:pos+4].decode("ascii", errors="ignore")
                    if list_type == "INFO":
                        # Parse subchunks inside INFO list
                        sub_pos = pos + 4
                        list_end = pos + chunk_size
                        info_tag_map = {
                            "INAM": ("Title / Track Name", "HIGH", "Exposes recording title or user-assigned song name."),
                            "IART": ("Artist / Creator", "HIGH", "Identifies author, voice actor, or recording creator."),
                            "ICRD": ("Creation Date", "MEDIUM", "Recording date recorded by software."),
                            "ICMT": ("Comment / Notes", "HIGH", "Internal notes, software settings, or user comments."),
                            "IGNR": ("Genre", "LOW", "Categorization genre."),
                            "ISFT": ("Software / Encoder", "MEDIUM", "DAW or software application used to render audio."),
                        }
                        while sub_pos + 8 <= list_end and sub_pos + 8 <= len(file_bytes):
                            sub_id, sub_size = struct.unpack("<4sI", file_bytes[sub_pos:sub_pos+8])
                            sub_str = sub_id.decode("ascii", errors="ignore").strip()
                            sub_pos += 8
                            sub_val = file_bytes[sub_pos:sub_pos+sub_size].decode("utf-8", errors="ignore").rstrip("\x00").strip()
                            sub_pos += sub_size + (sub_size % 2)

                            if sub_str in info_tag_map and sub_val:
                                label, risk, sig = info_tag_map[sub_str]
                                if overall_risk != "HIGH" and risk == "HIGH":
                                    overall_risk = "HIGH"
                                fields.append(
                                    MetadataFieldItem(
                                        key=f"wav_{sub_str.lower()}",
                                        label=f"WAV INFO: {label}",
                                        value=sub_val,
                                        category="Author / Identity" if "Artist" in label or "Title" in label else "Device & Hardware",
                                        privacy_risk_level=risk,
                                        privacy_significance=sig,
                                    )
                                )

                pos += chunk_size + (chunk_size % 2)
        except Exception:
            pass

    # 2. MP3 ID3v2 Parser
    if file_bytes.startswith(b"ID3") and len(file_bytes) >= 10:
        try:
            ver_major = file_bytes[3]
            size_bytes = file_bytes[6:10]
            tag_size = (size_bytes[0] << 21) | (size_bytes[1] << 14) | (size_bytes[2] << 7) | size_bytes[3]
            fields.append(
                MetadataFieldItem(
                    key="id3v2_tag",
                    label="ID3v2 Header",
                    value=f"ID3v2.{ver_major} ({tag_size} bytes metadata payload)",
                    category="Technical / Structural",
                    privacy_risk_level="MEDIUM",
                    privacy_significance="Embedded ID3 tag package storing author, title, and recording application data.",
                )
            )

            id3v2_tag_map = {
                "TIT2": ("Title", "HIGH", "Song or recording title."),
                "TPE1": ("Lead Artist", "HIGH", "Directly identifies the performer, speaker, or creator."),
                "TALB": ("Album", "MEDIUM", "Album or project collection title."),
                "TYER": ("Year", "LOW", "Release or recording year."),
                "TDRC": ("Recording Time", "MEDIUM", "Precise date and time of audio recording."),
                "COMM": ("Comments", "HIGH", "Personal comments, engineering notes, or user identifiers."),
                "TSSE": ("Encoder Software", "MEDIUM", "Identifies local audio encoding tool and version."),
                "TCOP": ("Copyright", "LOW", "Legal entity holding rights."),
            }

            pos = 10
            tag_end = min(10 + tag_size, len(file_bytes))
            while pos + 10 <= tag_end:
                frame_id = file_bytes[pos:pos+4].decode("ascii", errors="ignore").strip()
                if not frame_id or not frame_id.isalnum() or len(frame_id) < 4:
                    break
                frame_size = struct.unpack(">I", file_bytes[pos+4:pos+8])[0]
                pos += 10
                if pos + frame_size > tag_end:
                    break

                frame_data = file_bytes[pos:pos+frame_size]
                # Decode string (skip encoding byte)
                if len(frame_data) > 1:
                    enc_byte = frame_data[0]
                    payload = frame_data[1:]
                    decoded_text = ""
                    try:
                        if enc_byte == 1:  # UTF-16 with BOM
                            decoded_text = payload.decode("utf-16", errors="ignore")
                        else:  # ISO-8859-1 or UTF-8
                            decoded_text = payload.decode("utf-8", errors="ignore")
                    except Exception:
                        decoded_text = payload.decode("ascii", errors="ignore")

                    decoded_text = decoded_text.rstrip("\x00").strip()
                    if frame_id in id3v2_tag_map and decoded_text:
                        label, risk, sig = id3v2_tag_map[frame_id]
                        if overall_risk != "HIGH" and risk == "HIGH":
                            overall_risk = "HIGH"
                        fields.append(
                            MetadataFieldItem(
                                key=f"id3_{frame_id.lower()}",
                                label=f"ID3 Tag: {label}",
                                value=decoded_text[:120],
                                category="Author / Identity" if "Artist" in label or "Title" in label else "Device & Hardware",
                                privacy_risk_level=risk,
                                privacy_significance=sig,
                            )
                        )

                pos += frame_size

        except Exception:
            pass

    # 3. MP3 ID3v1 Parser (Last 128 bytes)
    if len(file_bytes) >= 128 and file_bytes[-128:-125] == b"TAG":
        try:
            title = file_bytes[-125:-95].decode("latin-1", errors="ignore").strip("\x00 ").strip()
            artist = file_bytes[-95:-65].decode("latin-1", errors="ignore").strip("\x00 ").strip()
            album = file_bytes[-65:-35].decode("latin-1", errors="ignore").strip("\x00 ").strip()
            year = file_bytes[-35:-31].decode("latin-1", errors="ignore").strip("\x00 ").strip()

            if title:
                fields.append(MetadataFieldItem(key="id3v1_title", label="ID3v1 Title", value=title, category="Author / Identity", privacy_risk_level="HIGH", privacy_significance="Legacy ID3v1 title."))
                if overall_risk != "HIGH":
                    overall_risk = "HIGH"
            if artist:
                fields.append(MetadataFieldItem(key="id3v1_artist", label="ID3v1 Artist", value=artist, category="Author / Identity", privacy_risk_level="HIGH", privacy_significance="Legacy ID3v1 creator name."))
                if overall_risk != "HIGH":
                    overall_risk = "HIGH"
            if album:
                fields.append(MetadataFieldItem(key="id3v1_album", label="ID3v1 Album", value=album, category="Author / Identity", privacy_risk_level="MEDIUM", privacy_significance="Legacy ID3v1 album name."))
            if year:
                fields.append(MetadataFieldItem(key="id3v1_year", label="ID3v1 Year", value=year, category="Temporal / Timestamps", privacy_risk_level="LOW", privacy_significance="Legacy ID3v1 recording year."))
        except Exception:
            pass

    summary = (
        "Audio metadata contains identifying tags (Artist/Title/Encoder). Sanitization recommended before public sharing."
        if overall_risk == "HIGH"
        else "Audio contains minimal identifying tags."
    )

    return MetadataExtractionResponse(
        file_name=filename,
        file_type=f"audio/{ext}",
        media_kind="audio",
        file_size_bytes=len(file_bytes),
        has_exif=False,
        has_gps=False,
        gps_coordinates=None,
        metadata_fields=fields,
        overall_metadata_risk=overall_risk,
        extracted_at=utc_now(),
        sanitization_available=True,
        summary=summary,
    )

def extract_file_metadata(file_bytes: bytes, filename: str) -> MetadataExtractionResponse:
    """Router for metadata extraction based on file extension."""
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    if ext in ["jpg", "jpeg", "png", "webp"]:
        return extract_image_metadata(file_bytes, filename)
    elif ext in ["wav", "mp3", "m4a", "ogg"]:
        return extract_audio_metadata(file_bytes, filename)
    else:
        return MetadataExtractionResponse(
            file_name=filename,
            file_type="application/octet-stream",
            media_kind="unsupported",
            file_size_bytes=len(file_bytes),
            has_exif=False,
            has_gps=False,
            gps_coordinates=None,
            metadata_fields=[
                MetadataFieldItem(
                    key="unsupported",
                    label="File Format Notice",
                    value=f".{ext} is not a supported media format",
                    category="Technical / Structural",
                    privacy_risk_level="INFO",
                    privacy_significance="TRACE GUARD currently extracts rich EXIF/ID3 metadata for JPG, JPEG, PNG, WEBP, WAV, and MP3 files.",
                )
            ],
            overall_metadata_risk="LOW",
            extracted_at=utc_now(),
            sanitization_available=False,
            summary="Unsupported media format for EXIF/ID3 metadata intelligence.",
        )

def sanitize_media_file(file_bytes: bytes, filename: str) -> Tuple[bytes, str, str]:
    """
    Strips EXIF, GPS, camera, device serials, and ID3 audio metadata without modifying the original.
    Returns: (sanitized_bytes, mime_type, sanitized_filename)
    """
    ext = filename.split(".")[-1].lower() if "." in filename else ""
    base_name = os.path.splitext(filename)[0]
    sanitized_filename = f"sanitized_{base_name}.{ext}"

    # 1. Image Sanitization (JPG, PNG, WEBP)
    if ext in ["jpg", "jpeg", "png", "webp"]:
        img = Image.open(io.BytesIO(file_bytes))
        format_name = img.format or ("JPEG" if ext in ["jpg", "jpeg"] else ext.upper())

        # Clean canvas
        clean_img = Image.new(img.mode, img.size)
        clean_img.paste(img)

        out_io = io.BytesIO()

        if format_name.upper() in ["JPEG", "JPG"]:
            if clean_img.mode in ("RGBA", "P"):
                clean_img = clean_img.convert("RGB")
            # Save without EXIF
            clean_img.save(out_io, format="JPEG", quality=95)
            mime = "image/jpeg"
        elif format_name.upper() == "PNG":
            clean_img.save(out_io, format="PNG")
            mime = "image/png"
        elif format_name.upper() == "WEBP":
            clean_img.save(out_io, format="WEBP", quality=95)
            mime = "image/webp"
        else:
            clean_img.save(out_io, format=format_name)
            mime = f"image/{format_name.lower()}"

        return out_io.getvalue(), mime, sanitized_filename

    # 2. Audio Sanitization (WAV)
    elif ext == "wav":
        if file_bytes.startswith(b"RIFF") and len(file_bytes) >= 12:
            out_io = io.BytesIO()
            pos = 12
            chunks_to_keep = []
            while pos + 8 <= len(file_bytes):
                chunk_id, chunk_size = struct.unpack("<4sI", file_bytes[pos:pos+8])
                chunk_str = chunk_id.decode("ascii", errors="ignore").strip()
                pos += 8
                chunk_data = file_bytes[pos:pos+chunk_size]
                # Keep fmt and data chunks, omit LIST, ID3, and non-audio metadata chunks
                if chunk_str in ["fmt", "data", "fact"]:
                    chunks_to_keep.append((chunk_id, chunk_data))
                pos += chunk_size + (chunk_size % 2)

            # Reconstruct clean WAV container
            total_size = 4  # 'WAVE'
            for cid, cdata in chunks_to_keep:
                total_size += 8 + len(cdata) + (len(cdata) % 2)

            out_io.write(b"RIFF")
            out_io.write(struct.pack("<I", total_size))
            out_io.write(b"WAVE")
            for cid, cdata in chunks_to_keep:
                out_io.write(cid)
                out_io.write(struct.pack("<I", len(cdata)))
                out_io.write(cdata)
                if len(cdata) % 2 == 1:
                    out_io.write(b"\x00")

            return out_io.getvalue(), "audio/wav", sanitized_filename
        else:
            return file_bytes, "audio/wav", sanitized_filename

    # 3. Audio Sanitization (MP3)
    elif ext == "mp3":
        pos_start = 0
        if file_bytes.startswith(b"ID3") and len(file_bytes) >= 10:
            size_bytes = file_bytes[6:10]
            tag_size = (size_bytes[0] << 21) | (size_bytes[1] << 14) | (size_bytes[2] << 7) | size_bytes[3]
            pos_start = 10 + tag_size

        pos_end = len(file_bytes)
        if len(file_bytes) >= 128 and file_bytes[-128:-125] == b"TAG":
            pos_end -= 128

        clean_mp3 = file_bytes[pos_start:pos_end]
        return clean_mp3, "audio/mpeg", sanitized_filename

    # Fallback
    return file_bytes, "application/octet-stream", sanitized_filename

