import ctypes
import gc
import platform
import time

try:
    from ctypes import wintypes
except ImportError:
    wintypes = None

import comfy.model_management
import psutil
from server import PromptServer


class AnyType(str):
    def __eq__(self, _):
        return True

    def __ne__(self, _):
        return False


ANY = AnyType("*")


class VRAMCleanup:
    DESCRIPTION = "清理显存：卸载已加载的模型、回收 Python 内存并清空显存缓存，可选把任意数据原样透传。"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "卸载模型": (
                    "BOOLEAN",
                    {"default": True, "tooltip": "清理前先卸载当前已加载的模型，释放其占用的显存"},
                ),
                "清空缓存": (
                    "BOOLEAN",
                    {"default": True, "tooltip": "回收 Python 垃圾并清空 PyTorch 的显存缓存"},
                ),
            },
            "optional": {
                "任意输入": (ANY, {"tooltip": "可选：接入任意数据，原样传给输出"}),
            },
        }

    RETURN_TYPES = (ANY,)
    RETURN_NAMES = ("输出",)
    OUTPUT_TOOLTIPS = ("原样透传「任意输入」的数据",)
    OUTPUT_NODE = True
    FUNCTION = "empty_cache"
    CATEGORY = "内存管理"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float(time.time())

    def empty_cache(self, 卸载模型, 清空缓存, 任意输入=None):
        try:
            if 卸载模型:
                comfy.model_management.unload_all_models()

            if 清空缓存:
                gc.collect()
                comfy.model_management.soft_empty_cache()
                PromptServer.instance.prompt_queue.set_flag("free_memory", True)

            print(
                f"清理显存完成 [卸载模型: {'是' if 卸载模型 else '否'}, "
                f"清空缓存: {'是' if 清空缓存 else '否'}]"
            )
        except Exception as exc:
            print(f"清理显存失败: {exc}")

        return (任意输入,)


class RAMCleanup:
    DESCRIPTION = "清理内存：释放系统文件缓存、其他进程的工作集与未使用的 DLL 内存，可设置重试次数。"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "清理文件缓存": (
                    "BOOLEAN",
                    {"default": True, "tooltip": "释放系统文件缓存（Windows 调用 SetSystemFileCacheSize，Linux 调用 malloc_trim）"},
                ),
                "清理进程内存": (
                    "BOOLEAN",
                    {"default": True, "tooltip": "清空其他进程的工作集，把闲置内存归还系统（仅 Windows）"},
                ),
                "清理未使用DLL": (
                    "BOOLEAN",
                    {"default": True, "tooltip": "缩小当前进程工作集，把未使用的 DLL 页移出物理内存（仅 Windows）"},
                ),
                "重试次数": (
                    "INT",
                    {
                        "default": 3,
                        "min": 1,
                        "max": 10,
                        "step": 1,
                        "tooltip": "清理循环执行次数，每次间隔 1 秒",
                    },
                ),
            },
            "optional": {
                "任意输入": (ANY, {"tooltip": "可选：接入任意数据，原样传给输出"}),
            },
        }

    RETURN_TYPES = (ANY,)
    RETURN_NAMES = ("输出",)
    OUTPUT_TOOLTIPS = ("原样透传「任意输入」的数据",)
    OUTPUT_NODE = True
    FUNCTION = "clean_ram"
    CATEGORY = "内存管理"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float(time.time())

    @staticmethod
    def get_ram_usage():
        memory = psutil.virtual_memory()
        return memory.percent, memory.available / (1024 * 1024)

    def clean_ram(
        self,
        清理文件缓存,
        清理进程内存,
        清理未使用DLL,
        重试次数,
        任意输入=None,
    ):
        try:
            before_usage, before_available = self.get_ram_usage()
            system = platform.system()

            for _ in range(重试次数):
                if 清理文件缓存:
                    try:
                        if system == "Windows":
                            ctypes.windll.kernel32.SetSystemFileCacheSize(-1, -1, 0)
                        elif system == "Linux":
                            libc = ctypes.CDLL("libc.so.6")
                            libc.malloc_trim(0)
                    except Exception:
                        pass

                if 清理进程内存 and system == "Windows" and wintypes is not None:
                    for process in psutil.process_iter(["pid", "name"]):
                        handle = None
                        try:
                            handle = ctypes.windll.kernel32.OpenProcess(
                                wintypes.DWORD(0x001F0FFF),
                                wintypes.BOOL(False),
                                wintypes.DWORD(process.info["pid"]),
                            )
                            if handle:
                                ctypes.windll.psapi.EmptyWorkingSet(handle)
                        except Exception:
                            continue
                        finally:
                            if handle:
                                try:
                                    ctypes.windll.kernel32.CloseHandle(handle)
                                except Exception:
                                    pass

                if 清理未使用DLL:
                    try:
                        if system == "Windows":
                            ctypes.windll.kernel32.SetProcessWorkingSetSize(-1, -1, -1)
                    except Exception:
                        pass

                time.sleep(1)

            after_usage, after_available = self.get_ram_usage()
            freed_mb = after_available - before_available
            print(
                f"清理内存完成 [占用: {before_usage:.1f}% → {after_usage:.1f}%, "
                f"释放: {freed_mb:.0f}MB]"
            )
        except Exception as exc:
            print(f"清理内存失败: {exc}")

        return (任意输入,)


NODE_CLASS_MAPPINGS = {
    "PetVRAMCleanup": VRAMCleanup,
    "PetRAMCleanup": RAMCleanup,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "PetVRAMCleanup": "清理显存",
    "PetRAMCleanup": "清理内存",
}
