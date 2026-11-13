import io
import pytest
from PIL import Image
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.user import User
from app.core.security import hash_password
from app.services.media_detector import detect_single_image
from tests.conftest import TestSessionLocal

@pytest.fixture
def auth_user():
    db = TestSessionLocal()
    user = User(
        email="ai_tester@example.com",
        full_name="AI Tester",
        hashed_password=hash_password("Password123!"),
        is_email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    uid = user.id
    db.close()
    return uid

async def login_client(client: AsyncClient, email: str = "ai_tester@example.com"):
    resp = await client.post(
        "/api/auth/login",
        json={"email": email, "password": "Password123!", "remember_me": True},
    )
    assert resp.status_code == 200

def create_image_bytes(format_name: str = "JPEG", size=(200, 200), color=(120, 180, 240)):
    """Creates a valid in-memory image byte stream."""
    img = Image.new("RGB", size, color=color)
    buf = io.BytesIO()
    img.save(buf, format=format_name)
    return buf.getvalue()

# ==========================================
# 1. AUTHENTICATION PROTECTION
# ==========================================

@pytest.mark.asyncio
async def test_ai_media_auth_protection():
    """Verifies that unauthenticated requests to AI media detection are rejected."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        img_bytes = create_image_bytes("JPEG")
        files = {"file": ("test.jpg", img_bytes, "image/jpeg")}

        # Single detection
        res = await client.post("/api/media/detect-image", files=files)
        assert res.status_code in (401, 403)

        # Batch detection
        res2 = await client.post("/api/media/detect-images", files=[("files", ("test.jpg", img_bytes, "image/jpeg"))])
        assert res2.status_code in (401, 403)

        # Model status
        res3 = await client.get("/api/media/model-status")
        assert res3.status_code in (401, 403)

# ==========================================
# 2. VALID JPG, PNG, WEBP INFERENCE
# ==========================================

@pytest.mark.asyncio
async def test_ai_media_valid_jpg_png_webp(auth_user):
    """Tests successful local ONNX inference on valid JPG, PNG, and WEBP images."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        formats = [
            ("sample.jpg", "JPEG", "image/jpeg"),
            ("sample.png", "PNG", "image/png"),
            ("sample.webp", "WEBP", "image/webp"),
        ]

        for fname, fmt, mime in formats:
            img_bytes = create_image_bytes(fmt)
            files = {"file": (fname, img_bytes, mime)}

            res = await client.post("/api/media/detect-image", files=files)
            assert res.status_code == 200
            data = res.json()

            assert data["file_name"] == fname
            assert data["status"] in ("NO_SENSITIVE_DETECTED", "SENSITIVE_DETECTED")
            assert data["status_display"] in (
                "No supported sensitive category detected",
                "Potentially sensitive content detected",
            )
            assert data["primary_label"] in ("normal", "nsfw")
            assert 0.0 <= data["confidence"] <= 1.0
            assert 0.0 <= data["confidence_percent"] <= 100.0
            assert "normal" in data["probabilities"]
            assert "nsfw" in data["probabilities"]
            assert data["model_info"]["is_local"] is True
            assert data["model_info"]["license"] == "Apache-2.0"
            assert "probabilistic" in data["interpretation"].lower()
            assert "does not guarantee" in data["interpretation"].lower()

# ==========================================
# 3. MULTIPLE IMAGE UPLOADS (BATCH)
# ==========================================

@pytest.mark.asyncio
async def test_ai_media_multiple_image_uploads(auth_user):
    """Tests batch scanning of multiple images in a single request."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        b1 = create_image_bytes("JPEG", color=(50, 100, 150))
        b2 = create_image_bytes("PNG", color=(200, 220, 240))
        b3 = create_image_bytes("WEBP", color=(80, 160, 240))

        upload_files = [
            ("files", ("batch_img1.jpg", b1, "image/jpeg")),
            ("files", ("batch_img2.png", b2, "image/png")),
            ("files", ("batch_img3.webp", b3, "image/webp")),
        ]

        res = await client.post("/api/media/detect-images", files=upload_files)
        assert res.status_code == 200
        data = res.json()

        assert data["total_files"] == 3
        assert data["processed_files"] == 3
        assert len(data["results"]) == 3
        assert data["model_status"] == "AVAILABLE"
        assert data["overall_risk"] in ("LOW", "HIGH")

        file_names = [r["file_name"] for r in data["results"]]
        assert "batch_img1.jpg" in file_names
        assert "batch_img2.png" in file_names
        assert "batch_img3.webp" in file_names

# ==========================================
# 4. INVALID FILE EXTENSIONS
# ==========================================

@pytest.mark.asyncio
async def test_ai_media_invalid_file_extension(auth_user):
    """Tests rejection of files with unsupported extensions."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        dummy_bytes = b"fake payload"
        files = {"file": ("malicious.exe", dummy_bytes, "application/octet-stream")}

        res = await client.post("/api/media/detect-image", files=files)
        assert res.status_code == 200
        data = res.json()

        assert data["status"] == "UNSUPPORTED_FILE"
        assert data["status_display"] == "Unsupported file"
        assert "Unsupported format" in data["interpretation"]

# ==========================================
# 5. NON-IMAGE RENAMED AS IMAGE
# ==========================================

@pytest.mark.asyncio
async def test_ai_media_non_image_renamed_as_image(auth_user):
    """Tests file verification when a non-image file is renamed with a .jpg extension."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        text_content = b"This is a plaintext secret configuration file, not a real image."
        files = {"file": ("disguised_script.jpg", text_content, "image/jpeg")}

        res = await client.post("/api/media/detect-image", files=files)
        assert res.status_code == 200
        data = res.json()

        assert data["status"] == "SCAN_FAILED"
        assert data["status_display"] == "Scan failed"
        assert "decoding failed" in data["interpretation"].lower() or "corrupted" in data["interpretation"].lower()

# ==========================================
# 6. OVERSIZED FILES
# ==========================================

@pytest.mark.asyncio
async def test_ai_media_oversized_file(auth_user):
    """Tests handling of files that exceed the 25 MB limit."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        # Create simulated oversized byte stream (26 MB)
        oversized_bytes = b"0" * (26 * 1024 * 1024)
        files = {"file": ("huge_photo.jpg", oversized_bytes, "image/jpeg")}

        res = await client.post("/api/media/detect-image", files=files)
        assert res.status_code == 200
        data = res.json()

        assert data["status"] == "UNSUPPORTED_FILE"
        assert data["status_display"] == "Unsupported file"
        assert "exceeds" in data["interpretation"].lower()

# ==========================================
# 7. CORRUPTED IMAGES
# ==========================================

@pytest.mark.asyncio
async def test_ai_media_corrupted_image(auth_user):
    """Tests handling of truncated/corrupted image header bytes."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        corrupted_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + b"\x00" * 20
        files = {"file": ("corrupted.jpg", corrupted_jpeg, "image/jpeg")}

        res = await client.post("/api/media/detect-image", files=files)
        assert res.status_code == 200
        data = res.json()

        assert data["status"] == "SCAN_FAILED"
        assert data["status_display"] == "Scan failed"

# ==========================================
# 8. MODEL MISSING / UNAVAILABLE STATE
# ==========================================

def test_ai_media_model_missing_behavior():
    """Verifies that missing model path returns MODEL_UNAVAILABLE with zero fake scores."""
    valid_bytes = create_image_bytes("JPEG")
    res = detect_single_image(
        file_bytes=valid_bytes,
        file_name="test.jpg",
        model_path="non_existent_folder/missing_model.onnx",
    )

    assert res.status == "MODEL_UNAVAILABLE"
    assert res.status_display == "Model unavailable"
    assert res.confidence is None
    assert res.confidence_percent is None
    assert res.is_sensitive is False
    assert "not installed or available" in res.interpretation
    assert res.model_info.get("status") == "UNAVAILABLE"

# ==========================================
# 9. MODEL STATUS ENDPOINT
# ==========================================

@pytest.mark.asyncio
async def test_ai_media_model_status_endpoint(auth_user):
    """Tests model status reporting endpoint."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await login_client(client)

        res = await client.get("/api/media/model-status")
        assert res.status_code == 200
        data = res.json()

        assert data["model_name"] == "Falconsai/nsfw_image_detection (ONNX ViT)"
        assert data["license"] == "Apache-2.0"
        assert data["status"] == "AVAILABLE"
        assert data["is_local"] is True
        assert data["execution_provider"] == "CPUExecutionProvider"
        assert "normal" in data["supported_labels"]
        assert "nsfw" in data["supported_labels"]

