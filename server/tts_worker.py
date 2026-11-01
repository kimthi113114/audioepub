import os
import gc
import threading
import io
import time
import logging
from typing import Optional, Dict, Any
from pathlib import Path
import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, HTTPException, Response
from pydantic import BaseModel
import uvicorn

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("TTSWorker")

app = FastAPI(title="AudioEpub Local TTS Worker", version="1.0.0")

# Globals for Kokoro
kokoro_session = None
kokoro_config = None
kokoro_voicepacks: Dict[str, Any] = {}
kokoro_context_length = 512

# Globals for VieNeu: engines are loaded on demand and only one is kept in memory at a time
vieneu_engine = None
vieneu_engine_mode: Optional[str] = None
vieneu_lock = threading.Lock()

KOKORO_AVAILABLE_VOICES = [
    "diem_trinh", "mai_linh", "hung_thinh", "ngoc_huyen",
    "duc_an", "duc_duy", "mai_loan", "manh_dung",
    "my_yen", "phat_tai", "storyvert", "thanh_dat",
    "thuc_trinh", "tuan_ngoc"
]

# VieNeu-TTS models: "v3turbo" (48 kHz, higher quality, heavier) or "v3nano" (24 kHz, for weak CPUs).
VIENEU_MODES = ("v3turbo", "v3nano")
VIENEU_DEFAULT_MODE = os.environ.get("VIENEU_MODE", "v3nano")
if VIENEU_DEFAULT_MODE not in VIENEU_MODES:
    VIENEU_DEFAULT_MODE = "v3nano"

# mode -> {slug ("thien_minh") -> engine voice name}, filled from list_preset_voices() when a model loads
VIENEU_VOICE_MAPS: Dict[str, Dict[str, str]] = {}
VIENEU_DEFAULT_VOICES = {"v3turbo": "Thiện Minh", "v3nano": "Minh Quân"}

# Voice ids saved by the previous (nano-only) version -> closest Turbo voice
VIENEU_LEGACY_ALIASES = {
    "minh_quan": "Phạm Tuyên",
    "ai_han": "Thùy Dung",
    "huu_quan": "Minh Đức",
    "xuan_tien": "Mai Anh",
    "anh_khoi": "Thiện Minh",
    "manh_dung": "Hải Đăng",
    "phuong_trang": "Đoan Trang",
    "bao_ngoc": "Kim Thanh",
    "tuan_kiet": "Quốc Tuấn",
}
# ...and Turbo-only voices -> closest Nano voice
VIENEU_TURBO_TO_NANO = {
    "thien_minh": "Anh Khôi",
    "pham_tuyen": "Minh Quân",
    "minh_duc": "Hữu Quân",
    "hai_dang": "Mạnh Dũng",
    "thuy_dung": "Ái Hân",
    "doan_trang": "Xuân Tiên",
    "kim_thanh": "Mỹ Duyên",
    "quoc_tuan": "Minh Quân",
}


def slugify_voice(name: str) -> str:
    import re
    import unicodedata

    base = unicodedata.normalize("NFD", name.replace("đ", "d").replace("Đ", "D"))
    base = "".join(c for c in base if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "_", base).strip("_")


def init_kokoro():
    global kokoro_session, kokoro_config, kokoro_context_length, kokoro_voicepacks
    try:
        import onnxruntime as ort
        from kokoro_vietnamese import DEFAULT_HF_REPO_ID, DEFAULT_ONNX_FILE, DEFAULT_CONFIG_FILE
        from kokoro_vietnamese.onnx_cli import _download_or_resolve, choose_providers
        from kokoro_vietnamese.onnx_utils import load_config
        from huggingface_hub import hf_hub_download

        logger.info("Initializing Kokoro Vietnamese ONNX session...")
        onnx_path = _download_or_resolve(DEFAULT_HF_REPO_ID, DEFAULT_ONNX_FILE, None)
        config_path = _download_or_resolve(DEFAULT_HF_REPO_ID, DEFAULT_CONFIG_FILE, None)

        kokoro_config = load_config(config_path)
        kokoro_context_length = kokoro_config['plbert']['max_position_embeddings']
        kokoro_session = ort.InferenceSession(str(onnx_path), providers=choose_providers('cpu'))

        # Preload key voicepacks
        for v in ["diem_trinh", "mai_linh", "hung_thinh", "ngoc_huyen"]:
            try:
                vp_file = f"voicepacks/{v}.pt"
                vp_path = hf_hub_download(repo_id=DEFAULT_HF_REPO_ID, filename=vp_file)
                kokoro_voicepacks[v] = torch.load(vp_path, map_location='cpu', weights_only=True)
                logger.info(f"Loaded Kokoro voicepack: {v}")
            except Exception as e:
                logger.warning(f"Could not preload voicepack {v}: {e}")

        logger.info("Kokoro Vietnamese initialized successfully!")
    except Exception as e:
        logger.error(f"Failed to initialize Kokoro: {e}", exc_info=True)

def load_vieneu(mode: str):
    """Return the engine for `mode`, loading it on first use and unloading the other model."""
    global vieneu_engine, vieneu_engine_mode
    with vieneu_lock:
        if vieneu_engine is not None and vieneu_engine_mode == mode:
            return vieneu_engine
        if vieneu_engine is not None:
            logger.info("Unloading VieNeu %s to switch to %s", vieneu_engine_mode, mode)
            vieneu_engine = None
            vieneu_engine_mode = None
            gc.collect()
        try:
            import vieneu

            logger.info("Loading VieNeu-TTS (%s)...", mode)
            t0 = time.time()
            engine = vieneu.Vieneu(mode)
            VIENEU_VOICE_MAPS[mode] = {
                slugify_voice(name): name for _label, name in engine.list_preset_voices()
            }
            vieneu_engine, vieneu_engine_mode = engine, mode
            logger.info(
                "VieNeu-TTS %s ready in %.1fs: %d voices, %s Hz",
                mode,
                time.time() - t0,
                len(VIENEU_VOICE_MAPS[mode]),
                getattr(engine, "sample_rate", "?"),
            )
            return engine
        except Exception as e:
            logger.error(f"Failed to initialize VieNeu {mode}: {e}", exc_info=True)
            raise HTTPException(status_code=503, detail=f"VieNeu {mode} could not be loaded")


@app.on_event("startup")
def startup_event():
    init_kokoro()
    # VieNeu is loaded lazily on the first request (see load_vieneu)

class TTSRequest(BaseModel):
    text: str
    engine: str = "kokoro"  # "kokoro" or "vieneu"
    voice: str = "diem_trinh"
    speed: float = 1.0
    mode: Optional[str] = None  # VieNeu model: "v3turbo" | "v3nano"

def get_kokoro_voicepack(voice: str):
    global kokoro_voicepacks
    v_clean = voice.lower().strip()
    if v_clean.startswith("kokoro:"):
        v_clean = v_clean.replace("kokoro:", "")

    if v_clean not in KOKORO_AVAILABLE_VOICES:
        v_clean = "diem_trinh"

    if v_clean in kokoro_voicepacks:
        return kokoro_voicepacks[v_clean]

    try:
        from huggingface_hub import hf_hub_download
        from kokoro_vietnamese import DEFAULT_HF_REPO_ID
        vp_file = f"voicepacks/{v_clean}.pt"
        vp_path = hf_hub_download(repo_id=DEFAULT_HF_REPO_ID, filename=vp_file)
        vp = torch.load(vp_path, map_location='cpu', weights_only=True)
        kokoro_voicepacks[v_clean] = vp
        return vp
    except Exception as e:
        logger.error(f"Error loading voicepack {v_clean}: {e}")
        if "diem_trinh" in kokoro_voicepacks:
            return kokoro_voicepacks["diem_trinh"]
        raise

def synthesize_kokoro(text: str, voice: str, speed: float = 1.0) -> bytes:
    if kokoro_session is None or kokoro_config is None:
        raise HTTPException(status_code=503, detail="Kokoro engine not initialized")

    from kokoro_vietnamese import SAMPLE_RATE, DEFAULT_CROSSFADE_MS
    from kokoro_vietnamese.core import split_text, phonemize, merge_audio_chunks
    from kokoro_vietnamese.onnx_utils import phonemes_to_input_ids, select_voice_style, speed_input

    voicepack = get_kokoro_voicepack(voice)
    audio_chunks = []
    speed_value = speed_input(speed)

    for text_chunk in split_text(text):
        ps = phonemize(text_chunk)
        if not ps:
            continue
        input_ids = phonemes_to_input_ids(
            ps,
            kokoro_config['vocab'],
            context_length=kokoro_context_length,
        )
        ref_s = select_voice_style(voicepack, len(ps))
        waveform, _ = kokoro_session.run(
            None,
            {
                'input_ids': input_ids,
                'ref_s': ref_s,
                'speed': speed_value,
            },
        )
        audio_chunks.append(np.asarray(waveform, dtype=np.float32).reshape(-1))

    if not audio_chunks:
        raise HTTPException(status_code=400, detail="No audio produced from text")

    crossfade_samples = round(SAMPLE_RATE * int(DEFAULT_CROSSFADE_MS) / 1000)
    merged = merge_audio_chunks(audio_chunks, crossfade_samples)

    buf = io.BytesIO()
    sf.write(buf, merged, SAMPLE_RATE, format='WAV')
    return buf.getvalue()

def resolve_vieneu_voice(voice: str, mode: str) -> str:
    voices = VIENEU_VOICE_MAPS.get(mode, {})
    v_clean = voice.strip()
    if v_clean.lower().startswith("vieneu:"):
        v_clean = v_clean[len("vieneu:"):]
    key = slugify_voice(v_clean)

    if key in voices:
        return voices[key]
    legacy = (VIENEU_LEGACY_ALIASES if mode == "v3turbo" else VIENEU_TURBO_TO_NANO).get(key)
    if legacy and slugify_voice(legacy) in voices:
        return legacy
    default = VIENEU_DEFAULT_VOICES.get(mode, "")
    if default in voices.values():
        return default
    return next(iter(voices.values()), default)


def synthesize_vieneu(text: str, voice: str, speed: float = 1.0, mode: Optional[str] = None) -> bytes:
    mode = mode if mode in VIENEU_MODES else VIENEU_DEFAULT_MODE
    engine = load_vieneu(mode)

    target_voice = resolve_vieneu_voice(voice, mode)
    sr = getattr(engine, "sample_rate", 24000)

    try:
        wav = engine.infer(text, voice=target_voice)
    except Exception as e:
        logger.error(f"VieNeu infer error with voice {target_voice}: {e}")
        # fallback to the default voice of this model
        wav = engine.infer(text, voice=resolve_vieneu_voice(VIENEU_DEFAULT_VOICES[mode], mode))

    buf = io.BytesIO()
    sf.write(buf, wav, sr, format='WAV')
    return buf.getvalue()

@app.get("/health")
def health():
    return {
        "status": "ready",
        "kokoro_ready": kokoro_session is not None,
        "vieneu_ready": vieneu_engine is not None,
        "kokoro_voices": KOKORO_AVAILABLE_VOICES,
        "vieneu_loaded_mode": vieneu_engine_mode,
        "vieneu_modes": list(VIENEU_MODES),
        "vieneu_voices": list(VIENEU_VOICE_MAPS.get(vieneu_engine_mode or "", {}).values()),
    }

@app.post("/tts")
def tts_endpoint(req: TTSRequest):
    t0 = time.time()
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text cannot be empty")

    engine = req.engine.lower().strip()
    if engine.startswith("kokoro") or req.voice.startswith("kokoro:"):
        wav_bytes = synthesize_kokoro(text, req.voice, req.speed)
    elif engine.startswith("vieneu") or req.voice.startswith("vieneu:"):
        wav_bytes = synthesize_vieneu(text, req.voice, req.speed, req.mode)
    else:
        # Default to Kokoro
        wav_bytes = synthesize_kokoro(text, req.voice, req.speed)

    duration = time.time() - t0
    logger.info(f"Synthesized ({req.engine}{'/' + req.mode if req.mode else ''}/{req.voice}) in {duration:.2f}s, {len(wav_bytes)} bytes")
    return Response(content=wav_bytes, media_type="audio/wav")

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5055, log_level="info")
