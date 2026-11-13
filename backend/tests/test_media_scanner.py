import io
import wave
import struct
import pytest
from PIL import Image, ExifTags
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.user import User
from app.core.security import hash_password
from tests.conftest import TestSessionLocal

@pytest.fixture
def auth_user():
    db = TestSessionLocal()
    user = User(
        email="media_tester@example.com",
        full_name="Media Tester",
        hashed_password=hash_password("Password123!"),
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    uid = user.id
    db.close()
    return uid

async def login_client(client: AsyncClient, email: str = "media_tester@example.com"):
    resp = await client.post(
        "/api/auth/login",
        json={"email": email, "password": "Password123!", "remember_me": True},
    )
    assert resp.status_code == 200

def create_sample_png():
    """Generates a small in-memory PNG."""
    img = Image.new("RGB", (100, 100), color=(73, 109, 137))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def create_sample_jpeg_with_exif_gps():
    """Generates a JPEG with EXIF tags including Make, Model, and GPS Coordinates."""
    img = Image.new("RGB", (120, 120), color=(140, 90, 60))
    exif = img.getexif()

    # Hardware tags
    exif[ExifTags.Base.Make] = "CyberCamera"
    exif[ExifTags.Base.Model] = "CyberPro-9000"
    exif[ExifTags.Base.DateTimeOriginal] = "2026:11:08 12:30:00"

    # GPS IFD
    gps_ifd = exif.get_ifd(ExifTags.IFD.GPSInfo)
    # Latitude: 37 deg, 46 min, 29.88 sec N -> 37.774967
    gps_ifd[1] = "N"
    gps_ifd[2] = (37.0, 46.0, 29.88)
    # Longitude: 122 deg, 25 min, 9.84 sec W -> -122.419400
    gps_ifd[3] = "W"
    gps_ifd[4] = (122.0, 25.0, 9.84)
    gps_ifd[6] = 15.0

    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return buf.getvalue()

def create_sample_wav():
    """Generates a small in-memory valid PCM WAV audio file."""
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(44100)
        w.writeframes(b'\x00\x00' * 4410)
    return buf.getvalue()

# ==========================================
# STAGE 1 TESTS: SENSITIVE MEDIA SCANNER
# ==========================================

@pytest.mark.asyncio
async def test_image_media_scan(auth_user):
    """Tests genuine local image scanning and classifier transparency."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        png_bytes = create_sample_png()
        files = {"file": ("test_image.png", png_bytes, "image/png")}

        res = await client.post("/api/media/scan-media", files=files)
        assert res.status_code == 200
        data = res.json()

        assert data["file_name"] == "test_image.png"
        assert data["media_kind"] == "image"
        assert data["is_supported"] is True
        assert data["scan_status"] == "COMPLETED"
        assert "dimensions" in data["technical_properties"]
        assert data["technical_properties"]["width_px"] == 100

        # Verify findings exist and no fake scores
        categories = [f["category"] for f in data["findings"]]
        assert "High Skin-Tone Exposure" in categories
        assert "Embedded GPS Geolocation" in categories

        # Verify truthful classifier reporting (Deep Learning marked UNAVAILABLE)
        capabilities = {c["capability_name"]: c["status"] for c in data["classifier_capabilities"]}
        assert "Deep Learning Visual Semantic Classifier (CNN / CLIP)" in capabilities
        assert capabilities["Deep Learning Visual Semantic Classifier (CNN / CLIP)"] == "UNAVAILABLE"

@pytest.mark.asyncio
async def test_audio_media_scan(auth_user):
    """Tests genuine local audio structural analysis (WAV)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        wav_bytes = create_sample_wav()
        files = {"file": ("test_audio.wav", wav_bytes, "audio/wav")}

        res = await client.post("/api/media/scan-media", files=files)
        assert res.status_code == 200
        data = res.json()

        assert data["file_name"] == "test_audio.wav"
        assert data["media_kind"] == "audio"
        assert data["is_supported"] is True
        assert data["scan_status"] == "COMPLETED"
        assert data["technical_properties"]["sample_rate_hz"] == 44100
        assert data["technical_properties"]["channels"] == "Mono"

        capabilities = {c["capability_name"]: c["status"] for c in data["classifier_capabilities"]}
        assert "Acoustic Speech-to-Text Semantic Classifier (Whisper)" in capabilities
        assert capabilities["Acoustic Speech-to-Text Semantic Classifier (Whisper)"] == "UNAVAILABLE"

@pytest.mark.asyncio
async def test_unsupported_media_scan(auth_user):
    """Tests rejection of unsupported media file types."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        fake_binary = b"random_binary_executable_data_here"
        files = {"file": ("program.exe", fake_binary, "application/octet-stream")}

        res = await client.post("/api/media/scan-media", files=files)
        assert res.status_code == 200
        data = res.json()

        assert data["is_supported"] is False
        assert data["scan_status"] == "UNSUPPORTED_FORMAT"
        assert data["media_kind"] == "unsupported"
        assert len(data["findings"]) > 0
        assert data["findings"][0]["detection_type"] == "UNSUPPORTED"

# ==========================================
# STAGE 2 TESTS: METADATA INTELLIGENCE
# ==========================================

@pytest.mark.asyncio
async def test_image_metadata_extraction_with_gps(auth_user):
    """Tests EXIF and GPS geolocation metadata extraction and risk rating."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        jpeg_bytes = create_sample_jpeg_with_exif_gps()
        files = {"file": ("vacation_photo.jpg", jpeg_bytes, "image/jpeg")}

        res = await client.post("/api/media/metadata", files=files)
        assert res.status_code == 200
        data = res.json()

        assert data["file_name"] == "vacation_photo.jpg"
        assert data["has_exif"] is True
        assert data["has_gps"] is True
        assert data["overall_metadata_risk"] == "CRITICAL"
        assert data["gps_coordinates"] is not None
        assert abs(data["gps_coordinates"]["latitude"] - 37.7749) < 0.01
        assert abs(data["gps_coordinates"]["longitude"] - (-122.4194)) < 0.01
        assert "maps.google.com" in data["gps_coordinates"]["maps_url"] or "google.com/maps" in data["gps_coordinates"]["maps_url"]

        # Verify fields include make/model and significance
        fields_by_key = {f["key"]: f for f in data["metadata_fields"]}
        assert "make" in fields_by_key
        assert fields_by_key["make"]["value"] == "CyberCamera"
        assert fields_by_key["make"]["category"] == "Device & Hardware"
        assert "gps_coordinates" in fields_by_key
        assert fields_by_key["gps_coordinates"]["privacy_risk_level"] == "CRITICAL"

@pytest.mark.asyncio
async def test_image_sanitization(auth_user):
    """Tests stripping of EXIF, GPS, and hardware tags without image corruption."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        jpeg_bytes = create_sample_jpeg_with_exif_gps()
        files = {"file": ("tagged_photo.jpg", jpeg_bytes, "image/jpeg")}

        res = await client.post("/api/media/sanitize", files=files)
        assert res.status_code == 200
        assert res.headers["content-type"] == "image/jpeg"
        assert "attachment; filename=\"sanitized_tagged_photo.jpg\"" in res.headers["content-disposition"]

        sanitized_bytes = res.content
        assert len(sanitized_bytes) > 0

        # Verify that opening sanitized image yields ZERO EXIF tags
        sanitized_img = Image.open(io.BytesIO(sanitized_bytes))
        clean_exif = sanitized_img.getexif()
        assert len(clean_exif) == 0
        assert sanitized_img.size == (120, 120)

@pytest.mark.asyncio
async def test_audio_metadata_extraction(auth_user):
    """Tests audio structural metadata extraction."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        wav_bytes = create_sample_wav()
        files = {"file": ("audio_sample.wav", wav_bytes, "audio/wav")}

        res = await client.post("/api/media/metadata", files=files)
        assert res.status_code == 200
        data = res.json()

        assert data["media_kind"] == "audio"
        assert data["sanitization_available"] is True
        assert len(data["metadata_fields"]) > 0

# ==========================================
# STAGE 3 TESTS: SENSITIVE INFORMATION DETECTION
# ==========================================

@pytest.mark.asyncio
async def test_document_scanner_credit_cards_and_secrets(auth_user):
    """Tests Luhn credit card validation, AWS API key detection, and SSN detection."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        # Document containing:
        # Line 1: Real test Visa (Luhn valid: 4532 0151 1283 0366)
        # Line 2: Fake invalid number (Luhn invalid: 4532 0151 1283 0367)
        # Line 3: AWS Access Key
        # Line 4: US SSN
        # Line 5: Email address
        doc_content = (
            "Payment details for customer John Doe:\n"
            "Valid Visa: 4532 0151 1283 0366\n"
            "Invalid Number: 4532 0151 1283 0367\n"
            "Server AWS credentials: AKIAIOSFODNN7EXAMPLE\n"
            "Identity SSN: 123-45-6789\n"
            "Direct contact: security-officer@traceguard-cyber.com\n"
        ).encode("utf-8")

        files = {"file": ("confidential_report.txt", doc_content, "text/plain")}

        res = await client.post("/api/media/scan-document", files=files)
        assert res.status_code == 200
        data = res.json()

        assert data["is_supported"] is True
        assert data["scan_status"] == "COMPLETED"
        assert data["overall_privacy_risk"] == "CRITICAL"
        assert data["findings_count_by_severity"]["CRITICAL"] >= 3  # Visa + AWS Key + SSN

        categories = [f["category"] for f in data["findings"]]
        assert "Credit Card Number" in categories
        assert "API / Secret Key" in categories
        assert "Social Security Number (SSN)" in categories
        assert "Email Address" in categories

        # Verify Credit Card finding details
        cc_findings = [f for f in data["findings"] if f["category"] == "Credit Card Number"]
        assert len(cc_findings) == 1  # ONLY the Luhn-valid card, NOT the invalid card!
        assert "Visa" in cc_findings[0]["masked_value"]
        assert "0366" in cc_findings[0]["masked_value"]
        assert cc_findings[0]["line_number"] == 2

        # Verify AWS key masked properly
        aws_findings = [f for f in data["findings"] if "AWS Access Key ID" in f["risk_explanation"]]
        assert len(aws_findings) == 1
        assert "AKIA" in aws_findings[0]["masked_value"]
        assert "EXAMPLE" not in aws_findings[0]["masked_value"]
        assert aws_findings[0]["line_number"] == 4

        # Verify SSN masked properly
        ssn_findings = [f for f in data["findings"] if f["category"] == "Social Security Number (SSN)"]
        assert len(ssn_findings) == 1
        assert "***-**-6789" in ssn_findings[0]["masked_value"]
        assert ssn_findings[0]["line_number"] == 5

        # Verify Email masked properly
        email_findings = [f for f in data["findings"] if f["category"] == "Email Address"]
        assert len(email_findings) == 1
        assert "se****@traceguard-cyber.com" in email_findings[0]["masked_value"]
        assert email_findings[0]["line_number"] == 6

@pytest.mark.asyncio
async def test_document_scanner_clean_document(auth_user):
    """Tests that a clean document reports 0 findings and CLEAN status."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        clean_doc = (
            "System Architecture Overview\n"
            "This microservice runs on standard Kubernetes clusters.\n"
            "Internal health checks run every sixty seconds.\n"
        ).encode("utf-8")

        files = {"file": ("architecture.md", clean_doc, "text/markdown")}

        res = await client.post("/api/media/scan-document", files=files)
        assert res.status_code == 200
        data = res.json()

        assert data["is_supported"] is True
        assert data["overall_privacy_risk"] == "CLEAN"
        assert len(data["findings"]) == 0
        assert data["findings_count_by_severity"]["CRITICAL"] == 0
