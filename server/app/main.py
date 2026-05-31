"""
NeuroShape API v4.1 — Multi-Provider GPT-4o + CLIP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Labeling cascade:
  1. GPT-4o vision (OpenAI or Poe)  → best quality
  2. CLIP (local)                    → base mode, no API needed
  3. Shape geometry                  → always available

Shape v4.1 improvements:
  • Edge trimming (2%)  — removes spike artifacts from ear tips
  • 3-point smoothing   — cleaner silhouettes
  • Hybrid measurement  — preserves leg/branch gaps

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
import numpy as np
from PIL import Image
from rembg import remove
import io
import os
import logging
import time
import base64
import math
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


app = FastAPI(title="NeuroShape API", version="4.1.0")

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

# ── Shape quality settings (NEW in v4.1) ──
EDGE_TRIM_PCT = 0.02   # Trim 2% top/bottom to remove ear-tip spikes
SMOOTH_WINDOW = 3       # Moving average window for layer widths
DENSE_SMOOTH = 5        # Slightly wider smoothing for outline

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
    print("  NeuroShape API v4.1 — Multi-Provider GPT-4o + CLIP")
    print("─" * 62)
    print(f"  CORS Origins    : {', '.join(ALLOWED_ORIGINS)}")
    print(f"  Default Provider: {DEFAULT_PROVIDER}")

    oai = f"✅ ({OPENAI_API_KEY[:8]}...)" if OPENAI_API_KEY else "❌ Not set"
    poe = f"✅ ({POE_API_KEY[:8]}...)" if POE_API_KEY else "❌ Not set"
    print(f"  OpenAI API Key  : {oai}")
    print(f"  Poe API Key     : {poe}")
    print(f"  OpenAI SDK      : {'✅' if _OPENAI_SDK else '❌ pip install openai'}")
    print(f"  Shape Quality   : smooth={SMOOTH_WINDOW}, trim={EDGE_TRIM_PCT:.0%}")

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
    print("=" * 62)


# ═══════════════════════════════════════════════════════
# Health
# ═══════════════════════════════════════════════════════
@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "version": "4.1.0",
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
# GPT-4o Vision (OpenAI or Poe)
# ═══════════════════════════════════════════════════════
def _classify_with_gpt4o(
    img: Image.Image,
    provider: str = "openai",
    custom_key: str | None = None,
) -> tuple[str | None, float, bool]:
    """
    Returns (label, confidence, quota_exceeded).
    Tries the specified provider with GPT-4o vision.
    """
    if not _OPENAI_SDK:
        return None, 0.0, False

    config = PROVIDERS.get(provider)
    if not config:
        logger.warning(f"   ⚠️  Unknown provider '{provider}'")
        return None, 0.0, False

    api_key = custom_key or _get_server_key(provider)
    if not api_key:
        logger.info(f"   ℹ️  No API key for {config['name']} — skipping GPT-4o")
        return None, 0.0, False

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

        logger.info(f"   🤖 Calling GPT-4o via {config['name']}...")
        t0 = time.time()

        response = client.chat.completions.create(
            model=config["model"],
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "What is the single main subject or object in this image? "
                            "Reply with ONLY 1-3 words naming the subject. "
                            "Examples: Cat, Wine Bottle, Electric Guitar, Polar Bear. "
                            "No sentences, no punctuation, no articles — just the name."
                        ),
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64}"},
                    },
                ],
            }],
            max_tokens=20,
            temperature=0,
        )

        dt = time.time() - t0
        raw = (response.choices[0].message.content or "").strip()

        # Clean: remove quotes, periods, extra whitespace
        label = raw.strip('"\'.,!:;()[]{}').title()
        words = label.split()[:4]
        label = " ".join(words)

        if not label or len(label) < 2:
            logger.warning(f"   ⚠️  GPT-4o empty response: '{raw}'")
            return None, 0.0, False

        logger.info(f"   🏷️  GPT-4o ({config['name']}) → \"{label}\" ({dt:.1f}s)")
        return label, 0.95, False

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
        return None, 0.0, quota_hit


# ═══════════════════════════════════════════════════════
# CLIP (local base mode — no API needed)
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
# Shape Classifier (geometry-only last resort)
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
# Width Measurement + Smoothing (NEW in v4.1)
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
    logger.info(f"   {num_layers}L, {max_nodes}N, thr={threshold}, provider={provider}")

    start_time = time.time()

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
        width, height = img.size
        logger.info(f"   Image: {width}×{height}")

        # ── Step 1: AI Segmentation ──
        logger.info("   🧠 rembg segmentation...")
        seg_t = time.time()
        result = remove(img)
        result_rgba = result.convert("RGBA")
        alpha = np.array(result_rgba)[:, :, 3]
        logger.info(f"   ✅ Segmentation: {time.time() - seg_t:.2f}s")

        # ── Step 2: Labeling cascade ──
        model_used = "shape"
        quota_warning = False
        quota_message = ""
        final_conf = 0.0
        label: str | None = None

        # 2a) Try GPT-4o via chosen provider
        gpt_label, gpt_conf, gpt_quota = _classify_with_gpt4o(
            img,
            provider=provider,
            custom_key=custom_api_key if custom_api_key else None,
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

        # ── Step 3: Build mask ──
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

        # ── Step 4: Crop to subject bounds ──
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

        # ── NEW v4.1: Edge trimming ──
        # Removes the very tip of ears/antennae that cause ugly spikes
        ch, cw = cropped_mask.shape
        trim = max(1, int(ch * EDGE_TRIM_PCT))
        if ch > trim * 6:  # Only trim if mask is tall enough
            cropped_mask = cropped_mask[trim : ch - trim, :]
            logger.info(f"   ✂️  Trimmed {trim}px from top/bottom edges")

        cropped_h, cropped_w = cropped_mask.shape
        logger.info(f"   Cropped mask: {cropped_w}×{cropped_h}")

        # ── Step 5: Width measurement + smoothing ──
        sample_rows = np.linspace(0, cropped_h - 1, num_layers, dtype=int)
        raw_widths: list[int] = [
            _measure_row_hybrid(cropped_mask[y, :]) for y in sample_rows
        ]

        # NEW v4.1: Smooth layer widths to remove single-row spikes
        smoothed = _smooth_widths(raw_widths, window=SMOOTH_WINDOW)

        max_w = max(smoothed) if max(smoothed) > 0 else 1
        node_counts = [max(1, round((w / max_w) * max_nodes)) for w in smoothed]

        logger.info(f"   ✨ Layers: {node_counts}")

        # Dense widths (for outline rendering) — also smoothed
        dense_rows = np.linspace(0, cropped_h - 1, DENSE_ROWS, dtype=int)
        dense_raw = [_measure_row_hybrid(cropped_mask[y, :]) for y in dense_rows]
        dense_widths = _smooth_widths(dense_raw, window=DENSE_SMOOTH)
        
        # NEW: Compute dense segments
        # Note: cropped_mask is already binary (0 or 1), so we use threshold=1
        dense_segs = compute_dense_segments(cropped_mask, num_rows=DENSE_ROWS, threshold=1)

        logger.info(f"   📊 Dense: {DENSE_ROWS} rows, "
                     f"max={max(dense_widths)}, min={min(dense_widths)}")

        # ── Step 6: Shape label (always computed, used as fallback) ──
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
            # Core data
            "label": label,
            "shapeLabel": shape_label,
            "confidence": round(float(final_conf), 3),
            "layers": node_counts,
            "dense_widths": dense_widths,
            "dense_segments": dense_segs,      # ← NEW
            "raw_widths": raw_widths,
            "mask": None,
            "originalSize": {"width": width, "height": height},
            "processingTime": round(total_time, 2),
            "subjectCoverage": round(float(subject_ratio), 3),
            "threshold": threshold,
            "mask_width": int(cropped_w),
            "mask_height": int(cropped_h),
            "aspect_ratio": aspect_ratio,
            # Model & provider info
            "model": model_used,
            "provider": provider,
            "quota_warning": quota_warning,
            "quota_message": quota_message,
            # Engine availability
            "clipAvailable": bool(_CLIP_AVAILABLE and clip_model is not None),
            "gpt4oAvailable": bool(
                (custom_api_key or _get_server_key(provider)) and _OPENAI_SDK
            ),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"   ❌ {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")
    

    