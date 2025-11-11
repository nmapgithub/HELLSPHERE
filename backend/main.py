"""
FastAPI backend for the GeoIntel Next.js user interface.

Exposes image analysis capabilities via REST endpoints and serves uploaded
images so that SerpAPI can access them when required.
"""

from __future__ import annotations

import configparser
import re
import os
import secrets
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from geointel import GeoIntel

UPLOADS_DIR = Path("/root/geointel/uploads")
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_PUBLIC_IP = os.getenv("GEOINTEL_PUBLIC_IP", "31.97.227.80")
DEFAULT_HTTP_PORT = int(os.getenv("GEOINTEL_HTTP_PORT", "1339"))
CONFIG_FILE = Path("/root/geointel/api_config.ini")

app = FastAPI(
    title="GeoIntel API",
    description="REST API that powers the GeoIntel satellite-themed UI.",
    version="1.0.0",
)

# Allow local development clients as well as production environments.
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("GEOINTEL_ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


def _sanitize_config_value(value: str) -> str:
    if not value:
        return ""
    cleaned = re.sub(r"^(\s*[A-Za-z0-9_]+\s*=\s*)+", "", value).strip()
    return cleaned or ""


def _load_config() -> dict[str, str]:
    if not CONFIG_FILE.exists():
        return {"gemini_key": "", "serpapi_key": "", "imgur_client_id": ""}

    config = configparser.ConfigParser()
    config.read(CONFIG_FILE)

    raw_gemini = config.get("API_KEYS", "gemini_key", fallback="")
    raw_serp = config.get("API_KEYS", "serpapi_key", fallback="")
    raw_imgur = config.get("API_KEYS", "imgur_client_id", fallback="")

    clean_gemini = _sanitize_config_value(raw_gemini)
    clean_serp = _sanitize_config_value(raw_serp)
    clean_imgur = _sanitize_config_value(raw_imgur)

    if (
        clean_gemini != raw_gemini
        or clean_serp != raw_serp
        or clean_imgur != raw_imgur
    ):
        _save_config(clean_gemini, clean_serp, clean_imgur)

    return {
        "gemini_key": clean_gemini,
        "serpapi_key": clean_serp,
        "imgur_client_id": clean_imgur,
    }


def _save_config(gemini_key: str, serpapi_key: str, imgur_client_id: str) -> None:
    config = configparser.ConfigParser()
    config["API_KEYS"] = {
        "gemini_key": _sanitize_config_value(gemini_key),
        "serpapi_key": _sanitize_config_value(serpapi_key),
        "imgur_client_id": _sanitize_config_value(imgur_client_id),
    }
    with CONFIG_FILE.open("w") as fp:
        config.write(fp)


@app.get("/api/keys")
async def get_api_keys() -> dict[str, str]:
    return _load_config()


@app.post("/api/keys")
async def save_api_keys(
    gemini_key: Optional[str] = Form(None),
    serpapi_key: Optional[str] = Form(None),
    imgur_client_id: Optional[str] = Form(None),
) -> dict[str, str]:
    current = _load_config()
    _save_config(
        gemini_key if gemini_key is not None else current["gemini_key"],
        serpapi_key if serpapi_key is not None else current["serpapi_key"],
        imgur_client_id
        if imgur_client_id is not None
        else current["imgur_client_id"],
    )
    return _load_config()


def _persist_upload(upload: UploadFile) -> Path:
    """
    Persist the uploaded file to disk with a collision-resistant filename.
    """
    suffix = Path(upload.filename or "image").suffix or ".jpg"
    safe_name = f"{secrets.token_hex(8)}{suffix}"
    destination = UPLOADS_DIR / safe_name

    with destination.open("wb") as out_file:
        total_written = 0
        while True:
            chunk = upload.file.read(1 << 20)  # 1 MiB chunks
            if not chunk:
                break
            out_file.write(chunk)
            total_written += len(chunk)

    upload.file.close()

    if total_written == 0:
        destination.unlink(missing_ok=True)
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    return destination


def _build_image_url(filename: str) -> str:
    """
    Public URL (served by this FastAPI instance) for the uploaded image.
    """
    return f"/uploads/{filename}"


@app.get("/healthz")
async def healthcheck() -> dict[str, str]:
    """
    Lightweight endpoint for uptime probes.
    """
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze_image(
    image: UploadFile = File(...),
    context_info: Optional[str] = Form(None),
    location_guess: Optional[str] = Form(None),
    use_serpapi: bool = Form(False),
    use_imgur: bool = Form(False),
    gemini_key: Optional[str] = Form(None),
    serpapi_key: Optional[str] = Form(None),
    imgur_client_id: Optional[str] = Form(None),
    public_ip: Optional[str] = Form(None),
    http_port: Optional[int] = Form(None),
):
    """
    Analyze an uploaded image with GeoIntel and return the AI-assisted
    geolocation results.
    """
    try:
        saved_path = _persist_upload(image)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {exc}") from exc

    response = {
        "image": {
            "filename": saved_path.name,
            "path": str(saved_path),
            "url": _build_image_url(saved_path.name),
        },
        "analysis": None,
    }

    stored_keys = _load_config()
    effective_gemini = gemini_key or stored_keys.get("gemini_key", "")
    effective_serpapi = serpapi_key or stored_keys.get("serpapi_key", "")
    effective_imgur = imgur_client_id or stored_keys.get("imgur_client_id", "")

    if not effective_gemini:
        raise HTTPException(
            status_code=400,
            detail="Gemini API key not configured. Save an API key before running analysis.",
        )

    os.environ["GEMINI_API_KEY"] = effective_gemini

    serpapi_enabled = bool(use_serpapi and effective_serpapi)
    if serpapi_enabled:
        os.environ["SERPAPI_KEY"] = effective_serpapi

    if use_imgur and effective_imgur:
        os.environ["IMGUR_CLIENT_ID"] = effective_imgur

    geointel_client = GeoIntel(api_key=effective_gemini)

    effective_public_ip = public_ip or DEFAULT_PUBLIC_IP
    effective_http_port = int(http_port or DEFAULT_HTTP_PORT)

    try:
        analysis_result = await run_in_threadpool(
            geointel_client.locate,
            image_path=str(saved_path),
            context_info=context_info,
            location_guess=location_guess,
            serpapi_key=effective_serpapi if serpapi_enabled else None,
            public_ip=effective_public_ip,
            http_port=effective_http_port,
        )
    except Exception as exc:  # pragma: no cover - defensive
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    response["analysis"] = analysis_result
    return JSONResponse(response)


# Utility for local debugging with `uvicorn backend.main:app --reload`
if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(
        "backend.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )

