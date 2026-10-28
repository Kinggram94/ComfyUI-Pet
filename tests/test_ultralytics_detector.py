import importlib
import sys
import types
import unittest
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

MODULE_NAME = "ultralytics_detector"


class FakeFolderPaths(types.ModuleType):
    def __init__(self):
        super().__init__("folder_paths")
        self.models_dir = str(ROOT / "_fake_models")
        self.supported_pt_extensions = {".pt", ".pth"}
        self.folder_names_and_paths = {}
        self.files = {
            "ultralytics_bbox": ["face_yolov8m.pt"],
            "ultralytics_segm": ["person_yolov8m-seg.pt"],
        }

    def add_model_folder_path(self, folder_name, full_folder_path, is_default=False):
        paths, extensions = self.folder_names_and_paths.get(folder_name, ([], set()))
        if full_folder_path not in paths:
            paths.append(full_folder_path)
        self.folder_names_and_paths[folder_name] = (paths, extensions)

    def get_folder_paths(self, folder_name):
        return list(self.folder_names_and_paths[folder_name][0])

    def get_filename_list(self, folder_name):
        return list(self.files.get(folder_name, []))

    def get_full_path(self, folder_name, filename):
        if folder_name == "ultralytics":
            return None
        if filename in self.files.get(folder_name, []):
            return str(ROOT / "_fake_models" / "ultralytics" / folder_name / filename)
        return None


def setUpModule():
    sys.modules["folder_paths"] = FakeFolderPaths()
    sys.modules.pop(MODULE_NAME, None)
    global detector
    detector = importlib.import_module(MODULE_NAME)


def tearDownModule():
    sys.modules.pop(MODULE_NAME, None)
    sys.modules.pop("folder_paths", None)


class ProviderContractTest(unittest.TestCase):
    def test_node_name_and_interface_match_original(self):
        provider = detector.NODE_CLASS_MAPPINGS["UltralyticsDetectorProvider"]
        self.assertEqual(detector.NODE_DISPLAY_NAME_MAPPINGS, {})
        self.assertEqual(provider.RETURN_TYPES, ("BBOX_DETECTOR", "SEGM_DETECTOR"))
        self.assertEqual(provider.FUNCTION, "doit")
        self.assertEqual(provider.CATEGORY, "ImpactPack")

    def test_model_options_are_prefixed_by_folder(self):
        options = detector.UltralyticsDetectorProvider.INPUT_TYPES()["required"]["model_name"][0]
        self.assertEqual(options, ["bbox/face_yolov8m.pt", "segm/person_yolov8m-seg.pt"])

    def test_doit_returns_detectors_for_bbox_and_segm(self):
        original = detector.load_yolo
        detector.load_yolo = lambda path: object()
        try:
            bbox_detector, segm_detector = detector.UltralyticsDetectorProvider().doit("bbox/face_yolov8m.pt")
            self.assertIsInstance(bbox_detector, detector.UltraBBoxDetector)
            self.assertIsInstance(segm_detector, detector.NO_SEGM_DETECTOR)

            bbox_detector, segm_detector = detector.UltralyticsDetectorProvider().doit("segm/person_yolov8m-seg.pt")
            self.assertIsInstance(bbox_detector, detector.UltraBBoxDetector)
            self.assertIsInstance(segm_detector, detector.UltraSegmDetector)
        finally:
            detector.load_yolo = original

    def test_doit_rejects_missing_model(self):
        with self.assertRaises(ValueError):
            detector.UltralyticsDetectorProvider().doit("bbox/missing.pt")


class DetectorRuntimeTest(unittest.TestCase):
    def test_bbox_detect_builds_segs_with_crops(self):
        mask = np.zeros((64, 64), dtype=bool)
        mask[10:30, 10:30] = True

        original = detector.inference_bbox
        detector.inference_bbox = lambda model, image, confidence: (
            ["face"],
            [np.array([10, 10, 30, 30])],
            [mask],
            [0.9],
        )
        try:
            image = torch.zeros(1, 64, 64, 3)
            shape, items = detector.UltraBBoxDetector(object()).detect(image, 0.5, 0, 2.0, 1)
        finally:
            detector.inference_bbox = original

        self.assertEqual(shape, (64, 64))
        self.assertEqual(len(items), 1)
        seg = items[0]
        self.assertEqual(seg.label, "face")
        self.assertEqual(seg.crop_region, [0, 0, 40, 40])
        self.assertEqual(seg.cropped_image.shape, (1, 40, 40, 3))
        self.assertEqual(seg.cropped_mask.shape, (40, 40))

    def test_combined_mask_matches_original_shape(self):
        first = np.zeros((16, 16), dtype=np.float32)
        first[2:8, 2:8] = 1.0
        second = np.zeros((16, 16), dtype=np.float32)
        second[8:14, 8:14] = 1.0

        combined = detector.combine_masks([(None, first, 0.9), (None, second, 0.8)])
        self.assertEqual(tuple(combined.shape), (16, 16))
        self.assertEqual(int(combined.sum()), 72)


if __name__ == "__main__":
    unittest.main()
