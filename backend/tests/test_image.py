import io

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app

client = TestClient(app)


def _png_bytes() -> io.BytesIO:
    buf = io.BytesIO()
    Image.new("RGB", (64, 64), (220, 40, 40)).save(buf, "PNG")
    buf.seek(0)
    return buf


def test_png_to_jpg_convert_and_download():
    files = {"files": ("swatch.png", _png_bytes(), "image/png")}
    res = client.post("/api/image/convert", files=files, data={"target": "jpg"})
    assert res.status_code == 200, res.text

    body = res.json()
    assert body["status"] == "completed"
    assert body["output_filename"].endswith(".jpg")
    assert body["download_url"]

    download = client.get(body["download_url"])
    assert download.status_code == 200
    assert download.content[:2] == b"\xff\xd8"  # JPEG magic bytes


def test_unsupported_type_rejected():
    files = {"files": ("note.txt", io.BytesIO(b"hello"), "text/plain")}
    res = client.post("/api/image/convert", files=files, data={"target": "png"})
    assert res.status_code == 415
