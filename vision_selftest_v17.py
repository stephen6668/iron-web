import json, py_compile
from pathlib import Path
root = Path(__file__).resolve().parent
errors = []
for f in ("iron_assistant.py", "jarvis_screen.py"):
    try:
        py_compile.compile(str(root/f), doraise=True)
    except Exception as e:
        errors.append(f"{f}: {e}")
h = (root/"jarvis_screen.py").read_text(encoding="utf-8")
a = (root/"iron_assistant.py").read_text(encoding="utf-8")
checks = {
    "dedicated_vision_screen": "def draw_vision_screen" in h,
    "no_per_frame_zoom_reset": "Zoom wird im Vision-Modus nur bei NEUEM Status" in h,
    "mouse_zoom": "pygame.MOUSEWHEEL" in h and "vision_zoom(event.y * 0.25)" in h,
    "keyboard_zoom": "pygame.K_KP_PLUS" in h and "pygame.K_KP_MINUS" in h,
    "keyboard_description": 'sende_vision_befehl("beschreib das bild")' in h,
    "keyboard_command_line": "vision_befehl_puffer" in h,
    "api_command_from_hud": '"/api/command"' in h,
    "backend_zoom_sync": '"/api/vision/view"' in a and '"/api/vision/view"' in h,
    "voice_vision_router": "bearbeite_bildbefehl(command)" in a,
}
print(json.dumps({"ok": not errors and all(checks.values()), "checks": checks, "errors": errors},
                 indent=2, ensure_ascii=False))
