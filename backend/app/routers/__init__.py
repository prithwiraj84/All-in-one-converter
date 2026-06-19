from app.routers import (
    admin,
    ai,
    archive,
    audio,
    document,
    files,
    font,
    health,
    image,
    jobs,
    keys,
    ocr,
    payments,
    pdf,
    teams,
    video,
)

# Order here controls OpenAPI tag grouping.
all_routers = [
    health.router,
    files.router,
    jobs.router,
    pdf.router,
    document.router,
    image.router,
    ocr.router,
    archive.router,
    audio.router,
    video.router,
    font.router,
    ai.router,
    payments.router,
    keys.router,
    teams.router,
    admin.router,
]

__all__ = ["all_routers"]
