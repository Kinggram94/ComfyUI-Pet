import time

import psutil

_CACHE_TTL = 1.0
_cache = {"ts": 0.0, "data": None}
_nvml_state = {"tried": False, "module": None}

psutil.cpu_percent(interval=None)


def _get_nvml():
    if _nvml_state["tried"]:
        return _nvml_state["module"]
    _nvml_state["tried"] = True
    try:
        import pynvml

        pynvml.nvmlInit()
        _nvml_state["module"] = pynvml
    except Exception:
        _nvml_state["module"] = None
    return _nvml_state["module"]


def _gpu_stats():
    nvml = _get_nvml()
    if nvml is not None:
        try:
            gpus = []
            for index in range(nvml.nvmlDeviceGetCount()):
                handle = nvml.nvmlDeviceGetHandleByIndex(index)
                name = nvml.nvmlDeviceGetName(handle)
                if isinstance(name, bytes):
                    name = name.decode("utf-8", "replace")
                mem = nvml.nvmlDeviceGetMemoryInfo(handle)
                try:
                    util = int(nvml.nvmlDeviceGetUtilizationRates(handle).gpu)
                except Exception:
                    util = None
                try:
                    temp = int(
                        nvml.nvmlDeviceGetTemperature(
                            handle, nvml.NVML_TEMPERATURE_GPU
                        )
                    )
                except Exception:
                    temp = None
                gpus.append(
                    {
                        "index": index,
                        "name": str(name),
                        "util": util,
                        "vram_used": int(mem.used),
                        "vram_total": int(mem.total),
                        "temp": temp,
                    }
                )
            return gpus
        except Exception:
            pass

    try:
        import torch

        if torch.cuda.is_available():
            free, total = torch.cuda.mem_get_info()
            return [
                {
                    "index": 0,
                    "name": torch.cuda.get_device_name(0),
                    "util": None,
                    "vram_used": int(total - free),
                    "vram_total": int(total),
                    "temp": None,
                }
            ]
    except Exception:
        pass

    return []


def get_stats():
    now = time.monotonic()
    cached = _cache["data"]
    if cached is not None and now - _cache["ts"] < _CACHE_TTL:
        return cached

    vm = psutil.virtual_memory()
    data = {
        "ts": int(time.time() * 1000),
        "cpu": round(float(psutil.cpu_percent(interval=None)), 1),
        "cpu_count": psutil.cpu_count(logical=True) or 0,
        "ram": {
            "used": int(vm.total - vm.available),
            "total": int(vm.total),
            "percent": round(float(vm.percent), 1),
        },
        "gpus": _gpu_stats(),
    }
    _cache["ts"] = now
    _cache["data"] = data
    return data
