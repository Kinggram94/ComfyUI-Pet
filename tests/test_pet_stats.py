import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pet_stats


class PetStatsTest(unittest.TestCase):
    def test_stats_shape_and_ranges(self):
        stats = pet_stats.get_stats()
        self.assertIsInstance(stats, dict)
        self.assertIsInstance(stats.get("cpu"), (int, float))
        self.assertGreaterEqual(stats["cpu"], 0)
        self.assertLessEqual(stats["cpu"], 100)

        ram = stats.get("ram") or {}
        for key in ("used", "total", "percent"):
            self.assertIn(key, ram)
        self.assertGreater(ram["total"], 0)
        self.assertGreaterEqual(ram["percent"], 0)
        self.assertLessEqual(ram["percent"], 100)

        self.assertIsInstance(stats.get("gpus"), list)
        for gpu in stats["gpus"]:
            self.assertIsInstance(gpu.get("name"), str)
            self.assertIn("vram_used", gpu)
            self.assertIn("vram_total", gpu)
            self.assertGreater(gpu["vram_total"], 0)
            if gpu.get("util") is not None:
                self.assertGreaterEqual(gpu["util"], 0)
                self.assertLessEqual(gpu["util"], 100)

    def test_stats_are_cached_between_fast_calls(self):
        first = pet_stats.get_stats()
        second = pet_stats.get_stats()
        self.assertIs(first, second)


if __name__ == "__main__":
    unittest.main()
