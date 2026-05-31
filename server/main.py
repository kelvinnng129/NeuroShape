"""
NeuroShape API v4.2 — Multi-Provider GPT-4o + CLIP + Structural Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Builds on v4.1's proven pixel pipeline. New in v4.2:
  • Enhanced GPT-4o mode: label + structural regions in ONE call
  • AI regions with importance/depth for 3D rendering
  • /api/layout3d endpoint for 3D node positioning
  • Subtle importance weighting on node distribution (±15%)

All v4.1 features preserved:
  • Edge trimming (2%) — removes ear-tip spike artifacts
  • 3-point smoothing — cleaner silhouettes
  • Hybrid measurement — preserves leg/branch gaps
  • Dense segments for outline rendering
  • CLIP + shape geometry fallback cascade

Labeling cascade:
  1. GPT-4o vision (OpenAI or Poe)  → best quality + structural data
  2. CLIP (local)                    → base mode, no API needed
  3. Shape geometry                  → always available

Supported providers:
  "openai"  → https://api.openai.com/v1   (official, needs billing)
  "poe"     → https://api.poe.com/v1      (needs Poe subscription)

Environment:
  OPENAI_API_KEY  — from platform.openai.com/api-keys
  POE_API_KEY     — from poe.com/api_key
  API_PROVIDER    — default: "openai"
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import numpy as np
from PIL import Image
from rembg import remove
import io
import os
import logging
import time
import base64
import math
import json
import re
from collections import defaultdict

# ── .env file support ──
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# ── CLIP (local base-mode fallback) ──
try:
    from transformers import CLIPProcessor, CLIPModel
    import torch
    _CLIP_AVAILABLE = True
except ImportError:
    _CLIP_AVAILABLE = False

# ── OpenAI SDK (for GPT-4o via any provider) ──
try:
    import openai as _openai
    _OPENAI_SDK = True
except ImportError:
    _OPENAI_SDK = False


app = FastAPI(title="NeuroShape API", version="4.2.0")

# ═══════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

MAX_FILE_SIZE = 10 * 1024 * 1024
ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"]
DENSE_ROWS = 200
RATE_LIMIT = 30
RATE_WINDOW = 60

# ── Shape quality settings (from v4.1) ──
EDGE_TRIM_PCT = 0.02   # Trim 2% top/bottom to remove ear-tip spikes
SMOOTH_WINDOW = 3       # Moving average window for layer widths
DENSE_SMOOTH = 5        # Slightly wider smoothing for outline

# ── NEW v4.2: Importance weighting ──
IMPORTANCE_WEIGHT = 0.25  # ±25% node adjustment for high/low importance regions

# ── API keys from environment — NEVER hardcode ──
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
POE_API_KEY = os.getenv("POE_API_KEY", "")
DEFAULT_PROVIDER = os.getenv("API_PROVIDER", "openai")

# ── Provider configurations ──
PROVIDERS = {
    "openai": {
        "name": "OpenAI",
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o",
    },
    "poe": {
        "name": "Poe",
        "base_url": "https://api.poe.com/v1",
        "model": "gpt-4o",
    },
}

_request_log: dict[str, list[float]] = defaultdict(list)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger = logging.getLogger("neuroshape")
logging.basicConfig(level=logging.INFO)

clip_model = None
clip_processor = None

CLIP_CANDIDATES = [
    "person", "hand", "face",
    "bear", "polar bear", "cat", "dog", "horse", "elephant", "lion",
    "tiger", "deer", "wolf", "fox", "rabbit", "monkey", "gorilla",
    "bird", "eagle", "penguin", "fish", "shark", "whale", "dolphin",
    "snake", "turtle", "frog", "butterfly", "spider", "cow", "pig",
    "sheep", "chicken", "duck", "owl", "parrot",
    "car", "truck", "bicycle", "motorcycle", "airplane", "ship",
    "helicopter", "train", "bus",
    "bottle", "cup", "phone", "laptop", "guitar", "camera", "clock",
    "shoe", "hat", "chair", "table", "lamp", "key", "pen", "book",
    "ball", "bell", "crown", "shield", "sword",
    "tree", "flower", "leaf", "mountain", "cloud", "sun", "moon",
    "building", "house", "bridge", "tower",
    "star", "heart", "arrow", "circle", "triangle", "square",
    "diamond", "cross", "logo", "skull", "robot",
    "rocket", "flame", "lightning bolt", "music note", "egg", "apple",
]


def _get_server_key(provider: str) -> str:
    """Get the server-side API key for the given provider."""
    if provider == "openai":
        return OPENAI_API_KEY
    elif provider == "poe":
        return POE_API_KEY
    return ""


# ═══════════════════════════════════════════════════════
# Startup
# ═══════════════════════════════════════════════════════
@app.on_event("startup")
async def startup():
    global clip_model, clip_processor, _CLIP_AVAILABLE

    print("=" * 62)
    print("  NeuroShape API v4.2 — GPT-4o + CLIP + Structural Analysis")
    print("─" * 62)
    print(f"  CORS Origins    : {', '.join(ALLOWED_ORIGINS)}")
    print(f"  Default Provider: {DEFAULT_PROVIDER}")

    oai = f"✅ ({OPENAI_API_KEY[:8]}...)" if OPENAI_API_KEY else "❌ Not set"
    poe = f"✅ ({POE_API_KEY[:8]}...)" if POE_API_KEY else "❌ Not set"
    print(f"  OpenAI API Key  : {oai}")
    print(f"  Poe API Key     : {poe}")
    print(f"  OpenAI SDK      : {'✅' if _OPENAI_SDK else '❌ pip install openai'}")
    print(f"  Shape Quality   : smooth={SMOOTH_WINDOW}, trim={EDGE_TRIM_PCT:.0%}")
    print(f"  Importance Wt   : ±{IMPORTANCE_WEIGHT:.0%}")

    if _CLIP_AVAILABLE:
        try:
            logger.info("Loading CLIP model (first run downloads ~600 MB)...")
            clip_model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
            clip_processor = CLIPProcessor.from_pretrained(
                "openai/clip-vit-base-patch32"
            )
            clip_model.eval()
            logger.info("✅ CLIP loaded — base-mode labeling enabled")
        except Exception as e:
            logger.warning(f"⚠️  CLIP failed to load: {e}")
            _CLIP_AVAILABLE = False
    else:
        logger.info("ℹ️  CLIP not installed (pip install transformers torch)")

    has_key = bool(OPENAI_API_KEY or POE_API_KEY)
    gpt_ok = has_key and _OPENAI_SDK
    clip_ok = _CLIP_AVAILABLE and clip_model is not None

    print("─" * 62)
    print(f"  Cascade: GPT-4o={'✅' if gpt_ok else '❌'}"
          f"  →  CLIP={'✅' if clip_ok else '❌'}"
          f"  →  Shape=✅")
    print(f"  Enhanced: structural analysis + 3D layout endpoint")
    print("=" * 62)


# ═══════════════════════════════════════════════════════
# Health
# ═══════════════════════════════════════════════════════
@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "version": "4.2.0",
        "engines": {
            "segmentation": "rembg",
            "gpt4o": _OPENAI_SDK and bool(OPENAI_API_KEY or POE_API_KEY),
            "clip": bool(_CLIP_AVAILABLE and clip_model is not None),
        },
        "providers": {
            "openai": bool(OPENAI_API_KEY),
            "poe": bool(POE_API_KEY),
            "default": DEFAULT_PROVIDER,
        },
        "features": [
            "enhanced_structural_analysis",
            "importance_weighting",
            "3d_layout_generation",
            "depth_aware_3d",
        ],
    }


# ═══════════════════════════════════════════════════════
# Rate limiter
# ═══════════════════════════════════════════════════════
def _check_rate_limit(client_ip: str):
    now = time.time()
    timestamps = _request_log[client_ip]
    _request_log[client_ip] = [t for t in timestamps if now - t < RATE_WINDOW]
    if len(_request_log[client_ip]) >= RATE_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded ({RATE_LIMIT} req / {RATE_WINDOW}s).",
        )
    _request_log[client_ip].append(now)


# ═══════════════════════════════════════════════════════
# GPT-4o: Enhanced response parser (NEW v4.2)
# ═══════════════════════════════════════════════════════
def _parse_enhanced_response(raw: str) -> tuple[str | None, dict | None]:
    """
    Parse GPT-4o's enhanced JSON response.
    Returns (label, structure_data).
    Falls back to plain text extraction if JSON fails.
    """
    text = raw.strip()

    # Strip markdown fences if present
    if "```" in text:
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            text = match.group(1).strip()

    # Try JSON parse
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict) and "label" in parsed:
            label = str(parsed["label"]).strip('"\'.,!:;()[]{}').title()
            words = label.split()[:4]
            label = " ".join(words)

            # Extract validated regions
            regions = []
            for r in parsed.get("regions", []):
                if isinstance(r, dict) and "y_start" in r and "y_end" in r:
                    regions.append({
                        "name": r.get("name", "region"),
                        "y_start": max(0.0, min(1.0, float(r.get("y_start", 0)))),
                        "y_end": max(0.0, min(1.0, float(r.get("y_end", 1)))),
                        "relative_width": max(0.0, min(1.0, float(r.get("relative_width", 0.5)))),
                        "importance": r.get("importance", "medium"),
                        "depth": max(0.0, min(1.0, float(r.get("depth", 0.5)))),
                    })

            structure = None
            if regions:
                structure = {
                    "regions": regions,
                    "symmetry": parsed.get("symmetry", "bilateral"),
                    "density_hint": parsed.get("density_hint", parsed.get("suggested_density", "")),
                    "shape_description": parsed.get("shape_description", ""),
                }

            if label and len(label) >= 2:
                return label, structure
    except (json.JSONDecodeError, ValueError, KeyError, TypeError):
        pass

    # JSON failed — try to extract label from raw text
    cleaned = raw.strip('"\'.,!:;()[]{}').strip()
    words = cleaned.split()[:4]
    label = " ".join(w.strip() for w in words if w.strip()).title()
    if label and 2 <= len(label) < 50:
        return label, None

    return None, None


# ═══════════════════════════════════════════════════════
# GPT-4o Vision (OpenAI or Poe) — UPDATED for v4.2
# ═══════════════════════════════════════════════════════

_ENHANCED_PROMPT = """Identify the main subject in this image and analyze its shape structure for a neural network visualization.

Return ONLY valid JSON (no markdown, no code fences, no explanation):
{
  "label": "1-3 word subject name",
  "shape_description": "brief overall silhouette description",
  "regions": [
    {"name": "part name", "y_start": 0.0, "y_end": 0.2, "relative_width": 0.4, "importance": "high", "depth": 0.5}
  ],
  "symmetry": "bilateral",
  "density_hint": "where nodes should be densest"
}

Region rules:
- 4-8 regions from top (0.0) to bottom (1.0) of the subject
- relative_width: 0.0-1.0 (1.0 = widest part)
- importance: "high" (distinctive/detailed), "medium", or "low"
- depth: front-to-back thickness 0.0-1.0 (for 3D rendering)
- symmetry: "bilateral", "radial", or "asymmetric"

Label examples: Cat, Wine Bottle, Electric Guitar, Beagle, Sports Car"""

_SIMPLE_PROMPT = (
    "What is the single main subject or object in this image? "
    "Reply with ONLY 1-3 words naming the subject. "
    "Examples: Cat, Wine Bottle, Electric Guitar, Polar Bear. "
    "No sentences, no punctuation, no articles — just the name."
)


def _classify_with_gpt4o(
    img: Image.Image,
    provider: str = "openai",
    custom_key: str | None = None,
    enhanced: bool = False,
) -> tuple[str | None, float, bool, dict | None]:
    """
    Returns (label, confidence, quota_exceeded, structure_data).

    enhanced=True  → combined prompt (label + regions in one call)
    enhanced=False → fast label-only prompt (identical to v4.1)
    structure_data is None when enhanced=False or on parse failure.
    """
    if not _OPENAI_SDK:
        return None, 0.0, False, None

    config = PROVIDERS.get(provider)
    if not config:
        logger.warning(f"   ⚠️  Unknown provider '{provider}'")
        return None, 0.0, False, None

    api_key = custom_key or _get_server_key(provider)
    if not api_key:
        logger.info(f"   ℹ️  No API key for {config['name']} — skipping GPT-4o")
        return None, 0.0, False, None

    try:
        # Resize to keep the request small & fast
        thumb = img.copy()
        thumb.thumbnail((512, 512), Image.LANCZOS)
        buf = io.BytesIO()
        thumb.save(buf, format="PNG")
        b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        client = _openai.OpenAI(
            api_key=api_key,
            base_url=config["base_url"],
        )

        mode_str = "enhanced" if enhanced else "fast"
        logger.info(f"   🤖 Calling GPT-4o via {config['name']} ({mode_str} mode)...")
        t0 = time.time()

        if enhanced:
            prompt_text = _ENHANCED_PROMPT
            max_tok = 800
        else:
            prompt_text = _SIMPLE_PROMPT
            max_tok = 20

        response = client.chat.completions.create(
            model=config["model"],
            messages=[{
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt_text},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64}"},
                    },
                ],
            }],
            max_tokens=max_tok,
            temperature=0,
        )

        dt = time.time() - t0
        raw = (response.choices[0].message.content or "").strip()

        if enhanced:
            label, structure = _parse_enhanced_response(raw)
            if label:
                region_count = len(structure["regions"]) if structure else 0
                logger.info(
                    f"   🏷️  GPT-4o ({config['name']}) → \"{label}\" "
                    f"+ {region_count} regions ({dt:.1f}s)"
                )
                return label, 0.95, False, structure
            else:
                logger.warning(f"   ⚠️  GPT-4o enhanced parse failed: '{raw[:100]}'")
                return None, 0.0, False, None
        else:
            # Simple mode — identical to v4.1
            label = raw.strip('"\'.,!:;()[]{}').title()
            words = label.split()[:4]
            label = " ".join(words)

            if not label or len(label) < 2:
                logger.warning(f"   ⚠️  GPT-4o empty response: '{raw}'")
                return None, 0.0, False, None

            logger.info(f"   🏷️  GPT-4o ({config['name']}) → \"{label}\" ({dt:.1f}s)")
            return label, 0.95, False, None

    except Exception as e:
        err = str(e).lower()
        quota_hit = any(kw in err for kw in [
            "quota", "rate_limit", "rate limit", "exceeded",
            "429", "402", "too many", "limit", "insufficient",
            "credits", "subscription", "payment", "billing",
            "budget", "allowance",
        ])
        name = config["name"]
        if quota_hit:
            logger.warning(f"   ⚠️  {name}: payment/subscription required — falling back")
        else:
            logger.warning(f"   ⚠️  {name} error: {e}")
        return None, 0.0, quota_hit, None


# ═══════════════════════════════════════════════════════
# CLIP (local base mode — no API needed) — UNCHANGED
# ═══════════════════════════════════════════════════════
def _classify_with_clip(img: Image.Image) -> tuple[str | None, float]:
    if not _CLIP_AVAILABLE or clip_model is None or clip_processor is None:
        return None, 0.0
    try:
        thumb = img.copy()
        thumb.thumbnail((384, 384), Image.LANCZOS)
        prompts = [f"a photo of a {c}" for c in CLIP_CANDIDATES]
        inputs = clip_processor(
            text=prompts, images=thumb, return_tensors="pt", padding=True,
        )
        with torch.no_grad():
            outputs = clip_model(**inputs)
        logits = outputs.logits_per_image[0]
        probs = logits.softmax(dim=-1)
        best_idx = int(probs.argmax().item())
        confidence = float(probs[best_idx].item())
        label = CLIP_CANDIDATES[best_idx].title()
        logger.info(f"   🏷️  CLIP → \"{label}\" ({confidence:.1%})")
        return label, confidence
    except Exception as e:
        logger.warning(f"   ⚠️  CLIP failed: {e}")
        return None, 0.0


# ═══════════════════════════════════════════════════════
# Shape Classifier (geometry-only last resort) — UNCHANGED
# ═══════════════════════════════════════════════════════
def _classify_shape(layers: list[int]) -> str:
    n = len(layers)
    if n < 2:
        return "Point"

    max_val = max(layers)
    min_val = min(layers)
    max_idx = layers.index(max_val)
    total = sum(layers)
    avg = total / n

    rev = layers[::-1]
    is_symmetric = all(abs(layers[i] - rev[i]) <= 2 for i in range(n))

    variation = max_val / max(min_val, 1)
    fill_ratio = avg / max(max_val, 1)

    plateau_count = sum(1 for w in layers if w >= max_val * 0.8)
    plateau_ratio = plateau_count / n

    top_slice = layers[:max(1, n // 3)]
    body_slice = layers[n // 3:]
    top_avg = sum(top_slice) / len(top_slice) if top_slice else 0
    body_avg = sum(body_slice) / len(body_slice) if body_slice else 0
    has_narrow_top = top_avg < body_avg * 0.65 if body_avg > 0 else False

    if variation < 1.5:
        return "Rectangle"
    elif has_narrow_top and plateau_ratio > 0.4:
        return "Bottle"
    elif is_symmetric and 0.3 < max_idx / n < 0.7:
        return "Oval" if fill_ratio > 0.65 else "Diamond"
    elif plateau_ratio > 0.6 and variation < 2.5:
        return "Rectangle"
    elif has_narrow_top:
        return "Vase"
    elif max_idx < n * 0.3:
        return "Mushroom"
    elif max_idx > n * 0.7:
        return "Pyramid"
    elif variation > 3:
        return "Organic Form"
    else:
        return "Abstract Form"


# ═══════════════════════════════════════════════════════
# Width Measurement + Smoothing (v4.1) — UNCHANGED
# ═══════════════════════════════════════════════════════
def _measure_row_hybrid(mask_row: np.ndarray) -> int:
    """Geometric mean of span and pixel count."""
    active = np.where(mask_row > 0)[0]
    if len(active) == 0:
        return 0
    span = int(active[-1] - active[0] + 1)
    count = int(len(active))
    return max(1, int(math.sqrt(span * count)))


def _smooth_widths(widths: list[int], window: int = 3) -> list[int]:
    """
    Moving average smoothing — removes the ugly spikes caused by
    sampling the very tip of ears, antennae, etc.
    """
    if len(widths) <= window:
        return widths
    smoothed = []
    half = window // 2
    for i in range(len(widths)):
        start = max(0, i - half)
        end = min(len(widths), i + half + 1)
        avg = sum(widths[start:end]) / (end - start)
        smoothed.append(max(1, round(avg)))
    return smoothed


def compute_dense_segments(mask_gray, num_rows=200, threshold=128):
    """
    For each scan-line, find all continuous segments where mask >= threshold.
    Returns list of rows; each row is a list of [left_norm, right_norm] in 0–1 coords.
    """
    h, w = mask_gray.shape[:2]

    # Handle multi-channel (use alpha if RGBA, else grayscale average)
    if len(mask_gray.shape) == 3:
        if mask_gray.shape[2] == 4:
            gray = mask_gray[:, :, 3].astype(float)
        else:
            gray = np.mean(mask_gray[:, :, :3], axis=2)
    else:
        gray = mask_gray.astype(float)

    all_segments = []

    for i in range(num_rows):
        y = int(i * (h - 1) / max(1, num_rows - 1))
        row = gray[y]

        # Find continuous runs of mask pixels
        row_segs = []
        in_seg = False
        start = 0

        for x in range(w):
            if row[x] >= threshold and not in_seg:
                start = x
                in_seg = True
            elif row[x] < threshold and in_seg:
                row_segs.append([round(start / w, 4), round(x / w, 4)])
                in_seg = False
        if in_seg:
            row_segs.append([round(start / w, 4), 1.0])

        # Merge tiny gaps < 2% of width (noise)
        merged = []
        for seg in row_segs:
            if merged and seg[0] - merged[-1][1] < 0.02:
                merged[-1][1] = seg[1]
            else:
                merged.append(list(seg))

        # Drop segments narrower than 1.5% (noise specks)
        filtered = [s for s in merged if s[1] - s[0] >= 0.015]

        all_segments.append(filtered)

    return all_segments


# ═══════════════════════════════════════════════════════
# Region helpers (NEW v4.2)
# ═══════════════════════════════════════════════════════
def find_matching_region(y: float, regions: list[dict]) -> dict | None:
    """Find which AI region a given y-position (0.0–1.0) falls into."""
    for r in regions:
        if r["y_start"] <= y <= r["y_end"]:
            return r
    if not regions:
        return None
    return min(regions, key=lambda r: abs((r["y_start"] + r["y_end"]) / 2 - y))


# ═══════════════════════════════════════════════════════
# Main Processing Endpoint
# ═══════════════════════════════════════════════════════
@app.post("/api/process")
async def process_image(
    request: Request,
    file: UploadFile = File(...),
    num_layers: int = Form(default=22),
    max_nodes: int = Form(default=30),
    threshold: int = Form(default=128),
    api_provider: str = Form(default=""),
    custom_api_key: str = Form(default=""),
    enhanced_analysis: bool = Form(default=True),  # NEW v4.2
):
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Allowed: PNG, JPG, WEBP",
        )

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    num_layers = max(2, min(num_layers, 200))
    max_nodes = max(2, min(max_nodes, 200))
    threshold = max(0, min(255, threshold))

    # Resolve provider: frontend override > server default
    provider = api_provider if api_provider in PROVIDERS else DEFAULT_PROVIDER

    logger.info(f"📸 {file.filename} ({len(contents)} bytes)")
    logger.info(f"   {num_layers}L, {max_nodes}N, thr={threshold}, provider={provider}, enhanced={enhanced_analysis}")

    start_time = time.time()

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        width, height = img.size
        logger.info(f"   Image: {width}×{height}")

        # ── Step 1: AI Segmentation (unchanged) ──
        logger.info("   🧠 rembg segmentation...")
        seg_t = time.time()
        result = remove(img)
        result_rgba = result.convert("RGBA")
        alpha = np.array(result_rgba)[:, :, 3]
        logger.info(f"   ✅ Segmentation: {time.time() - seg_t:.2f}s")

        # ── Step 2: Labeling cascade (UPDATED for v4.2) ──
        model_used = "shape"
        quota_warning = False
        quota_message = ""
        final_conf = 0.0
        label: str | None = None
        structure_data: dict | None = None  # NEW v4.2

        # 2a) Try GPT-4o via chosen provider (enhanced or fast mode)
        gpt_label, gpt_conf, gpt_quota, structure_data = _classify_with_gpt4o(
            img,
            provider=provider,
            custom_key=custom_api_key if custom_api_key else None,
            enhanced=enhanced_analysis,
        )

        if gpt_label:
            label = gpt_label
            model_used = "gpt-4o"
            final_conf = gpt_conf
        else:
            if gpt_quota:
                quota_warning = True
                pname = PROVIDERS.get(provider, {}).get("name", provider)
                quota_message = (
                    f"{pname} requires a paid plan for GPT-4o API access. "
                    f"Using CLIP base mode instead. "
                    f"You can switch provider or enter your own OpenAI API key."
                )

            # 2b) Fall back to CLIP (local, free)
            clip_label, clip_conf = _classify_with_clip(img)
            if clip_label:
                label = clip_label
                model_used = "clip"
                final_conf = clip_conf

        # ── Step 3: Build mask (unchanged) ──
        mask = (alpha > threshold).astype(np.uint8)
        subject_pixels = int(np.sum(mask))
        total_pixels = mask.shape[0] * mask.shape[1]
        subject_ratio = subject_pixels / total_pixels

        logger.info(f"   Subject coverage: {subject_ratio:.1%}")

        if subject_ratio < 0.01:
            logger.warning("   ⚠️  Very little subject — using fallback region")
            h_m, w_m = mask.shape
            mask[int(h_m * 0.2):int(h_m * 0.8), int(w_m * 0.2):int(w_m * 0.8)] = 1
            subject_ratio = float(np.sum(mask)) / total_pixels

        # ── Step 4: Crop to subject bounds (unchanged) ──
        rows_with = np.any(mask > 0, axis=1)
        cols_with = np.any(mask > 0, axis=0)

        if np.any(rows_with):
            ri = np.where(rows_with)[0]
            top_row, bottom_row = int(ri[0]), int(ri[-1])
        else:
            top_row, bottom_row = 0, mask.shape[0] - 1

        if np.any(cols_with):
            ci = np.where(cols_with)[0]
            left_col, right_col = int(ci[0]), int(ci[-1])
        else:
            left_col, right_col = 0, mask.shape[1] - 1

        cropped_mask = mask[top_row:bottom_row + 1, left_col:right_col + 1]

        # Edge trimming (v4.1)
        ch, cw = cropped_mask.shape
        trim = max(1, int(ch * EDGE_TRIM_PCT))
        if ch > trim * 6:
            cropped_mask = cropped_mask[trim : ch - trim, :]
            logger.info(f"   ✂️  Trimmed {trim}px from top/bottom edges")

        cropped_h, cropped_w = cropped_mask.shape
        logger.info(f"   Cropped mask: {cropped_w}×{cropped_h}")

        # ── Step 5: Width measurement + smoothing (unchanged) ──
        sample_rows = np.linspace(0, cropped_h - 1, num_layers, dtype=int)
        raw_widths: list[int] = [
            _measure_row_hybrid(cropped_mask[y, :]) for y in sample_rows
        ]

        smoothed = _smooth_widths(raw_widths, window=SMOOTH_WINDOW)

        max_w = max(smoothed) if max(smoothed) > 0 else 1
        node_counts = [max(1, round((w / max_w) * max_nodes)) for w in smoothed]

        logger.info(f"   ✨ Layers (pixel): {node_counts}")

        # ── NEW v4.2: Apply importance weighting from AI regions ──
        if structure_data and structure_data.get("regions"):
            regions = structure_data["regions"]
            for i in range(len(node_counts)):
                y_frac = i / max(1, len(node_counts) - 1)
                region = find_matching_region(y_frac, regions)
                if region:
                    imp = region.get("importance", "medium")
                    if imp == "high":
                        node_counts[i] = min(
                            max_nodes,
                            max(1, round(node_counts[i] * (1 + IMPORTANCE_WEIGHT))),
                        )
                    elif imp == "low":
                        node_counts[i] = max(
                            1,
                            round(node_counts[i] * (1 - IMPORTANCE_WEIGHT)),
                        )
            region_names = [r["name"] for r in regions]
            logger.info(f"   📐 Regions: {', '.join(region_names)}")
            logger.info(f"   ✨ Layers (weighted): {node_counts}")

        # Dense widths (for outline rendering) — unchanged
        dense_rows = np.linspace(0, cropped_h - 1, DENSE_ROWS, dtype=int)
        dense_raw = [_measure_row_hybrid(cropped_mask[y, :]) for y in dense_rows]
        dense_widths = _smooth_widths(dense_raw, window=DENSE_SMOOTH)

        # Dense segments — unchanged
        dense_segs = compute_dense_segments(cropped_mask, num_rows=DENSE_ROWS, threshold=1)

        logger.info(f"   📊 Dense: {DENSE_ROWS} rows, "
                     f"max={max(dense_widths)}, min={min(dense_widths)}")

        # ── Step 6: Shape label (always computed, fallback) ──
        shape_label = _classify_shape(node_counts)

        if label is None:
            label = shape_label
            model_used = "shape"
            final_conf = subject_ratio

        total_time = time.time() - start_time
        aspect_ratio = round(float(cropped_h / max(cropped_w, 1)), 4)

        logger.info(f"   🏷️  \"{label}\" (model: {model_used}, {final_conf:.0%})")
        logger.info(f"   🎉 {total_time:.2f}s total")

        return {
            # ── Core data (ALL v4.1 fields preserved) ──
            "label": label,
            "shapeLabel": shape_label,
            "confidence": round(float(final_conf), 3),
            "layers": node_counts,
            "dense_widths": dense_widths,
            "dense_segments": dense_segs,
            "raw_widths": raw_widths,
            "mask": None,
            "originalSize": {"width": width, "height": height},
            "processingTime": round(total_time, 2),
            "subjectCoverage": round(float(subject_ratio), 3),
            "threshold": threshold,
            "mask_width": int(cropped_w),
            "mask_height": int(cropped_h),
            "aspect_ratio": aspect_ratio,
            # ── Model & provider info (unchanged) ──
            "model": model_used,
            "provider": provider,
            "quota_warning": quota_warning,
            "quota_message": quota_message,
            # ── Engine availability (unchanged) ──
            "clipAvailable": bool(_CLIP_AVAILABLE and clip_model is not None),
            "gpt4oAvailable": bool(
                (custom_api_key or _get_server_key(provider)) and _OPENAI_SDK
            ),
            # ── NEW v4.2 fields (frontend can safely ignore) ──
            "regions": structure_data["regions"] if structure_data else [],
            "symmetry": structure_data["symmetry"] if structure_data else "bilateral",
            "density_hint": structure_data["density_hint"] if structure_data else "",
            "shape_description": structure_data["shape_description"] if structure_data else "",
            "enhanced": enhanced_analysis and structure_data is not None,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"   ❌ {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")


# ═══════════════════════════════════════════════════════
# 3D Layout Generation (NEW v4.2)
# ═══════════════════════════════════════════════════════

class Layout3DRequest(BaseModel):
    layers: list[int]
    shape: str = "3d-sphere"
    regions: list[dict] = []
    provider: str = "openai"
    api_key: str = ""
    model: str = "gpt-4o"


def _local_3d_with_depth(
    layers: list[int],
    shape: str,
    regions: list[dict],
) -> list[list[dict]]:
    """
    Generate 3D positions using depth data from GPT-4o region analysis.
    No API call needed — uses the depth info we already have.
    """
    total = len(layers)
    positions = []

    for li, count in enumerate(layers):
        t = li / max(1, total - 1)
        y = (t - 0.5) * 16

        region = find_matching_region(t, regions)
        depth = region.get("depth", 0.5) if region else 0.5

        layer_nodes = []
        for ni in range(count):
            angle = (ni / max(1, count)) * math.pi * 2

            if shape == "3d-sphere":
                phi = t * math.pi
                r = 8 * math.sin(phi) * (0.5 + depth * 0.5)
                layer_nodes.append({
                    "x": round(r * math.cos(angle), 3),
                    "y": round(8 * math.cos(phi), 3),
                    "z": round(r * math.sin(angle) * depth, 3),
                })
            elif shape == "3d-brain":
                side = 1 if ni % 2 == 0 else -1
                bulge = math.sin(t * math.pi) * 1.2 + 0.3
                r = (3 + bulge * 2 * depth) * (0.5 + 0.5 * math.sin(angle * 0.5 + 0.3))
                layer_nodes.append({
                    "x": round(side * r * bulge, 3),
                    "y": round(r * 0.8 * math.cos(angle * 0.3) + math.sin(t * math.pi) * 2, 3),
                    "z": round((t - 0.5) * 14, 3),
                })
            elif shape == "3d-spiral":
                base_angle = t * math.pi * 4 + (ni / max(1, count)) * math.pi * 2 / total
                r = 5 * (0.3 + depth * 0.7)
                layer_nodes.append({
                    "x": round(r * math.cos(base_angle), 3),
                    "y": round(y, 3),
                    "z": round(r * math.sin(base_angle), 3),
                })
            else:  # tower
                r = (count / max(1, max(layers))) * 5 * (0.3 + depth * 0.7) + 1
                layer_nodes.append({
                    "x": round(r * math.cos(angle), 3),
                    "y": round(y, 3),
                    "z": round(r * math.sin(angle), 3),
                })

        positions.append(layer_nodes)

    return positions


@app.post("/api/layout3d")
async def generate_layout_3d(req: Layout3DRequest, request: Request):
    """
    Generate 3D node positions.
    If AI region depth data is available, generates locally (instant).
    Otherwise, asks GPT-4o to generate positions.
    """
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)

    # ── Fast path: use depth from AI regions (no API call) ──
    if req.regions and len(req.regions) > 0:
        logger.info("   🧊 3D layout using AI region depth data (local)")
        t0 = time.time()
        positions = _local_3d_with_depth(req.layers, req.shape, req.regions)
        dt = time.time() - t0
        return {
            "positions": positions,
            "shape": req.shape,
            "model": "local+depth",
            "provider": "local",
            "generation_time": round(dt, 4),
        }

    # ── Slow path: ask GPT-4o ──
    provider = req.provider if req.provider in PROVIDERS else DEFAULT_PROVIDER
    config = PROVIDERS.get(provider)
    api_key = req.api_key or _get_server_key(provider)

    if not api_key or not _OPENAI_SDK or not config:
        raise HTTPException(
            status_code=400,
            detail="No API key available for 3D layout. Pass regions from /api/process or provide an API key.",
        )

    total_nodes = sum(req.layers)
    layer_desc = " → ".join(str(n) for n in req.layers)

    shape_guides = {
        "3d-sphere":
            "Distribute layers as latitude bands on a sphere (radius ~8). "
            "Each layer's nodes sit in a ring at that latitude.",
        "3d-brain":
            "Form two hemispheres (left/right). Layers flow front-to-back (z-axis). "
            "Middle layers bulge wider. Slight vertical curve like a real brain.",
        "3d-spiral":
            "DNA double-helix / spiral staircase. Layers spiral upward around Y-axis "
            "with 2 full turns. Radius varies with layer size.",
        "3d-tower":
            "Cylindrical tower. Layers stacked vertically (y-axis). "
            "Each layer is a ring; ring radius proportional to node count.",
    }
    guide = shape_guides.get(req.shape, shape_guides["3d-sphere"])

    prompt = f"""You are a 3D neural network layout engine.
Generate 3D coordinates for a neural network visualization.

Architecture: {layer_desc} ({len(req.layers)} layers, {total_nodes} nodes)
Shape: {req.shape}

Shape guide: {guide}

Rules:
- Coordinates in range [-10, 10]
- Nodes within a layer spread out, never overlapping
- Adjacent layers close enough for visible connections
- Aesthetically pleasing from any viewing angle
- Each layer must have EXACTLY the specified number of nodes

Return ONLY a JSON array of arrays.
Outer array = layers. Inner arrays = objects with x, y, z.
Layer 0 has {req.layers[0]} positions, etc.

Example for layers [2, 3]:
[[{{"x":1.0,"y":4.0,"z":0.5}},{{"x":-1.0,"y":4.0,"z":-0.5}}],[{{"x":2.0,"y":-1.0,"z":1.0}},{{"x":0.0,"y":-1.0,"z":0.0}},{{"x":-2.0,"y":-1.0,"z":-1.0}}]]

NO markdown, NO explanation — ONLY the JSON array."""

    try:
        client = _openai.OpenAI(api_key=api_key, base_url=config["base_url"])

        logger.info(f"   🧊 3D layout: {layer_desc} shape={req.shape}")
        t0 = time.time()

        response = client.chat.completions.create(
            model=req.model or config["model"],
            messages=[{"role": "user", "content": prompt}],
            max_tokens=8000,
            temperature=0.2,
        )

        raw = (response.choices[0].message.content or "").strip()
        dt = time.time() - t0
        logger.info(f"   ✅ 3D layout generated in {dt:.1f}s ({len(raw)} chars)")

        # Parse JSON
        json_str = raw
        if "```" in json_str:
            match = re.search(r"```(?:json)?\s*([\s\S]*?)```", json_str)
            if match:
                json_str = match.group(1).strip()

        parsed = json.loads(json_str)

        if not isinstance(parsed, list) or len(parsed) == 0:
            raise ValueError("Response is not a non-empty array")

        # Validate and normalize
        positions = []
        for li, layer_data in enumerate(parsed):
            if not isinstance(layer_data, list):
                raise ValueError(f"Layer {li} is not an array")

            expected = req.layers[li] if li < len(req.layers) else len(layer_data)
            layer_nodes = []

            for node in layer_data:
                if isinstance(node, list) and len(node) >= 3:
                    layer_nodes.append({
                        "x": float(node[0]),
                        "y": float(node[1]),
                        "z": float(node[2]),
                    })
                elif isinstance(node, dict) and "x" in node:
                    layer_nodes.append({
                        "x": float(node["x"]),
                        "y": float(node["y"]),
                        "z": float(node["z"]),
                    })

            # Pad or trim to expected count
            while len(layer_nodes) < expected:
                last = layer_nodes[-1] if layer_nodes else {"x": 0, "y": 0, "z": 0}
                layer_nodes.append({
                    "x": last["x"] + 0.5,
                    "y": last["y"],
                    "z": last["z"] + 0.3,
                })
            layer_nodes = layer_nodes[:expected]
            positions.append(layer_nodes)

        # Fill missing layers
        while len(positions) < len(req.layers):
            li = len(positions)
            count = req.layers[li]
            y_pos = (li / max(1, len(req.layers) - 1) - 0.5) * 16
            layer_nodes = []
            for ni in range(count):
                angle = (ni / max(1, count)) * math.pi * 2
                layer_nodes.append({
                    "x": round(4 * math.cos(angle), 3),
                    "y": round(y_pos, 3),
                    "z": round(4 * math.sin(angle), 3),
                })
            positions.append(layer_nodes)

        logger.info(f"   🧊 Returned {len(positions)} layers, "
                     f"{sum(len(l) for l in positions)} total nodes")

        return {
            "positions": positions,
            "shape": req.shape,
            "model": req.model or config["model"],
            "provider": provider,
            "generation_time": round(dt, 2),
        }

    except _openai.APIError as e:
        logger.error(f"   ❌ AI 3D error: {e}")
        raise HTTPException(status_code=502, detail=f"API error: {str(e)}")
    except json.JSONDecodeError as e:
        logger.error(f"   ❌ JSON parse error: {e}\nRaw: {raw[:500]}")
        raise HTTPException(status_code=502, detail="AI returned invalid JSON — try again")
    except Exception as e:
        logger.error(f"   ❌ 3D layout error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))