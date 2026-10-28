import logging
import os

from aiohttp import web
from server import PromptServer

from .easy_qwen_edit_2509 import NODE_CLASS_MAPPINGS as _QWEN_NODES
from .easy_qwen_edit_2509 import NODE_DISPLAY_NAME_MAPPINGS as _QWEN_NAMES
from .memory_cleanup import NODE_CLASS_MAPPINGS as _CLEANUP_NODES
from .memory_cleanup import NODE_DISPLAY_NAME_MAPPINGS as _CLEANUP_NAMES
from .pet_stats import get_stats

WEB_DIRECTORY = "web"

_SUBPACK_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ComfyUI-Impact-Subpack")
if os.path.isdir(_SUBPACK_DIR):
    logging.info("[ComfyUI-Pet] ComfyUI-Impact-Subpack detected, UltralyticsDetectorProvider stays with it.")
    _DETECTOR_NODES = {}
    _DETECTOR_NAMES = {}
else:
    from .ultralytics_detector import NODE_CLASS_MAPPINGS as _DETECTOR_NODES
    from .ultralytics_detector import NODE_DISPLAY_NAME_MAPPINGS as _DETECTOR_NAMES

NODE_CLASS_MAPPINGS = {**_CLEANUP_NODES, **_QWEN_NODES, **_DETECTOR_NODES}
NODE_DISPLAY_NAME_MAPPINGS = {**_CLEANUP_NAMES, **_QWEN_NAMES, **_DETECTOR_NAMES}


@PromptServer.instance.routes.get("/comfyui-pet/stats")
async def pet_stats_route(request):
    try:
        return web.json_response(get_stats())
    except Exception as exc:
        return web.json_response({"error": str(exc)}, status=500)
