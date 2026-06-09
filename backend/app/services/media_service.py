"""Audio and video conversion via FFmpeg."""
from __future__ import annotations

from pathlib import Path

from app.config import settings
from app.core.errors import ProcessingError
from app.schemas.jobs import JobResult
from app.services.base import ensure_binary, file_result, run_command, stem

AUDIO_TARGETS = {"mp3", "wav", "ogg", "flac", "aac", "m4a"}
VIDEO_TARGETS = {"mp4", "webm", "mov", "avi", "mkv", "gif"}


def audio_convert(job_id: str, src: Path, out_dir: Path, *, target: str = "mp3") -> JobResult:
    target = target.lower()
    if target not in AUDIO_TARGETS:
        raise ProcessingError(f"Unsupported audio format '{target}'.")
    ffmpeg = ensure_binary(settings.ffmpeg_cmd)
    out = out_dir / f"{stem(src.name)}.{target}"

    cmd = [ffmpeg, "-y", "-i", str(src)]
    if target == "mp3":
        cmd += ["-codec:a", "libmp3lame", "-q:a", "2"]
    elif target == "aac" or target == "m4a":
        cmd += ["-codec:a", "aac", "-b:a", "192k"]
    elif target == "ogg":
        cmd += ["-codec:a", "libvorbis", "-q:a", "5"]
    cmd.append(str(out))

    run_command(cmd, timeout=420)
    return file_result(job_id, "audio-converter", out, meta={"format": target})


def video_convert(job_id: str, src: Path, out_dir: Path, *, target: str = "mp4") -> JobResult:
    target = target.lower()
    if target not in VIDEO_TARGETS:
        raise ProcessingError(f"Unsupported video format '{target}'.")
    ffmpeg = ensure_binary(settings.ffmpeg_cmd)
    out = out_dir / f"{stem(src.name)}.{target}"

    if target == "gif":
        cmd = [ffmpeg, "-y", "-i", str(src), "-vf", "fps=12,scale=480:-1:flags=lanczos", str(out)]
    elif target == "mp4":
        cmd = [
            ffmpeg, "-y", "-i", str(src),
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(out),
        ]
    elif target == "webm":
        cmd = [ffmpeg, "-y", "-i", str(src), "-c:v", "libvpx-vp9", "-crf", "32", "-b:v", "0", "-c:a", "libopus", str(out)]
    else:
        cmd = [ffmpeg, "-y", "-i", str(src), str(out)]

    run_command(cmd, timeout=900)
    return file_result(job_id, "video-converter", out, meta={"format": target})
