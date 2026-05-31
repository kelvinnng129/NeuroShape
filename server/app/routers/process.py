import io
import math
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from PIL import Image
from app.config import settings

router = APIRouter()


def generate_placeholder_layers(num_layers: int, max_nodes: int) -> list[int]:
    """
    Temporary: generates a pyramid-shaped network.
    Will be replaced with real AI density mapping in Phase 3.
    """
    layers = []
    for i in range(num_layers):
        # Create a diamond/lens shape as placeholder
        progress = i / (num_layers - 1) if num_layers > 1 else 0.5
        # Bell curve shape
        value = math.sin(progress * math.pi)
        nodes = max(1, round(1 + value * (max_nodes - 1)))
        layers.append(nodes)
    return layers


@router.post("/process")
async def process_image(
    file: UploadFile = File(...),
    num_layers: int = Form(default=12),
    max_nodes: int = Form(default=16),
):
    """
    Process an uploaded image and return neural network layer data.
    Phase 1: Returns placeholder shape data.
    Phase 3: Will use real AI segmentation.
    """

    # ── Validate file type ──
    allowed_types = ["image/png", "image/jpeg", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type '{file.content_type}'. Allowed: PNG, JPG, WEBP",
        )

    # ── Validate file size ──
    contents = await file.read()
    if len(contents) > settings.MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Max size: {settings.MAX_FILE_SIZE // 1024 // 1024}MB",
        )

    # ── Validate it's a real image ──
    try:
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Could not read the image. File may be corrupted.",
        )

    # ── Clamp parameters ──
    num_layers = max(3, min(50, num_layers))
    max_nodes = max(1, min(50, max_nodes))

    # ── Generate placeholder layers (Phase 1) ──
    layers = generate_placeholder_layers(num_layers, max_nodes)

    # ── Placeholder label (Phase 3: real AI classification) ──
    label = "Shape"
    confidence = 0.85

    return {
        "label": label,
        "confidence": confidence,
        "layers": layers,
        "mask": None,  # Phase 3: will return base64 mask
        "originalSize": {
            "width": image.width,
            "height": image.height,
        },
    }


@router.post("/remap")
async def remap_density(
    num_layers: int = Form(default=12),
    max_nodes: int = Form(default=16),
):
    """
    Re-run density mapping with new parameters.
    Phase 1: Returns placeholder data.
    Phase 3: Will use cached mask for real re-mapping.
    """
    num_layers = max(3, min(50, num_layers))
    max_nodes = max(1, min(50, max_nodes))

    layers = generate_placeholder_layers(num_layers, max_nodes)

    return {"layers": layers}