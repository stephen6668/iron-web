import os, re, json, py_compile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
errors = []

for name in ["iron_assistant.py", "jarvis_screen.py"]:
    try:
        py_compile.compile(str(ROOT / name), doraise=True)
    except Exception as e:
        errors.append(f"{name}: {e}")

src = (ROOT / "iron_assistant.py").read_text(encoding="utf-8")
hud = (ROOT / "jarvis_screen.py").read_text(encoding="utf-8")

checks = {
    "screen_capture": "ImageGrab.grab" in src,
    "hud_hide": "FindWindowW" in src,
    "zoom_out": "rauszoomen" in src and "setze_bild_zoom(\"raus\")" in src,
    "percent_zoom": "def setze_prozent_zoom" in src,
    "detail_description": "def beschreibe_bildbereich" in src,
    "hud_cache_mtime": '"mtime"' in hud and "getmtime" in hud,
    "vision_api_selftest": "/api/vision/selftest" in src,
}

print(json.dumps({
    "ok": not errors and all(checks.values()),
    "checks": checks,
    "errors": errors,
}, ensure_ascii=False, indent=2))
