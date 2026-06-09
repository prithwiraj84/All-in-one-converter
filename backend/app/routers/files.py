"""Download endpoint for processed files."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import FileResponse

from app.core.storage import resolve_download

router = APIRouter(prefix="/api/files", tags=["files"])


@router.get("/download/{job_id}/{filename}")
def download(job_id: str, filename: str) -> FileResponse:
    path = resolve_download(job_id, filename)
    if path is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "File not found or it has expired. Files are deleted automatically after processing.",
        )
    return FileResponse(
        path,
        filename=filename,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
