from . import util
from .nodes.configpad.config_pads import comfy_entrypoint

def API():
    return util

if API():
    print("[A1RWorkshop] API loaded successfully.")

WEB_DIRECTORY = "./web"

__all__ = [
    comfy_entrypoint
]