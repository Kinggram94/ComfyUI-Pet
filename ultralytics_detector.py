# Ported from ComfyUI-Impact-Subpack 1.3.5 (AGPL-3.0, author Dr.Lt.Data).
# Only the UltralyticsDetectorProvider node and its bbox/segm detector runtime are kept.

import os
from collections import namedtuple

import cv2
import folder_paths
import numpy as np
import torch
from PIL import Image


SEG = namedtuple(
    "SEG",
    ["cropped_image", "cropped_mask", "confidence", "crop_region", "bbox", "label", "control_net_wrapper"],
    defaults=[None],
)


def _register_model_folders(model_path):
    for folder_name, sub_dir in (
        ("ultralytics", ""),
        ("ultralytics_bbox", "bbox"),
        ("ultralytics_segm", "segm"),
    ):
        folder = os.path.join(model_path, "ultralytics", sub_dir) if sub_dir else os.path.join(model_path, "ultralytics")
        folder_paths.add_model_folder_path(folder_name, folder)
        paths, extensions = folder_paths.folder_names_and_paths[folder_name]
        folder_paths.folder_names_and_paths[folder_name] = (paths, extensions | folder_paths.supported_pt_extensions)


_register_model_folders(folder_paths.models_dir)
if "download_model_base" in folder_paths.folder_names_and_paths:
    _register_model_folders(folder_paths.get_folder_paths("download_model_base")[0])


def tensor2pil(image):
    return Image.fromarray(np.clip(255.0 * image.cpu().numpy().squeeze(0), 0, 255).astype(np.uint8))


def normalize_region(limit, startp, size):
    if startp < 0:
        new_endp = min(limit, size)
        new_startp = 0
    elif startp + size > limit:
        new_startp = max(0, limit - size)
        new_endp = limit
    else:
        new_startp = startp
        new_endp = min(limit, startp + size)

    return int(new_startp), int(new_endp)


def make_crop_region(w, h, bbox, crop_factor):
    x1, y1, x2, y2 = bbox
    bbox_w = x2 - x1
    bbox_h = y2 - y1

    crop_w = bbox_w * crop_factor
    crop_h = bbox_h * crop_factor

    center_x = x1 + bbox_w / 2
    center_y = y1 + bbox_h / 2

    new_x1, new_x2 = normalize_region(w, int(center_x - crop_w / 2), crop_w)
    new_y1, new_y2 = normalize_region(h, int(center_y - crop_h / 2), crop_h)

    return [new_x1, new_y1, new_x2, new_y2]


def crop_tensor4(image, crop_region):
    x1, y1, x2, y2 = crop_region
    return image[:, y1:y2, x1:x2, :]


def crop_ndarray2(image, crop_region):
    x1, y1, x2, y2 = crop_region
    return image[y1:y2, x1:x2]


def dilate_masks(segmasks, dilation_factor):
    if dilation_factor == 0:
        return segmasks

    kernel = np.ones((abs(dilation_factor), abs(dilation_factor)), np.uint8)
    dilated = []
    for bbox, mask, confidence in segmasks:
        if dilation_factor > 0:
            mask = cv2.dilate(mask, kernel, 1)
        else:
            mask = cv2.erode(mask, kernel, 1)
        dilated.append((bbox, mask, confidence))

    return dilated


def combine_masks(segmasks):
    if len(segmasks) == 0:
        return None

    combined = np.array(segmasks[0][1])
    for _, mask, _ in segmasks[1:]:
        mask = np.array(mask)
        if combined.shape == mask.shape:
            combined = cv2.bitwise_or(combined, mask)

    return torch.from_numpy(combined)


def create_segmasks(results):
    return [(bbox, mask.astype(np.float32), confidence) for bbox, mask, confidence in zip(results[1], results[2], results[3])]


def load_yolo(model_path):
    from ultralytics import YOLO

    return YOLO(model_path)


def inference_bbox(model, image, confidence=0.3, device=""):
    pred = model(image, conf=confidence, device=device)
    bboxes = pred[0].boxes.xyxy.cpu().numpy()
    if len(bboxes) == 0:
        return [[], [], [], []]

    cv2_image = np.array(image)
    if len(cv2_image.shape) == 3:
        cv2_image = cv2_image[:, :, ::-1].copy()
    else:
        cv2_image = cv2.cvtColor(cv2_image, cv2.COLOR_GRAY2BGR)
    cv2_gray = cv2.cvtColor(cv2_image, cv2.COLOR_BGR2GRAY)

    results = [[], [], [], []]
    for i, (x0, y0, x1, y1) in enumerate(bboxes):
        cv2_mask = np.zeros(cv2_gray.shape, np.uint8)
        cv2.rectangle(cv2_mask, (int(x0), int(y0)), (int(x1), int(y1)), 255, -1)
        results[0].append(pred[0].names[int(pred[0].boxes[i].cls.item())])
        results[1].append(bboxes[i])
        results[2].append(cv2_mask.astype(bool))
        results[3].append(pred[0].boxes[i].conf.cpu().numpy())

    return results


def inference_segm(model, image, confidence=0.3, device=""):
    pred = model(image, conf=confidence, device=device)
    bboxes = pred[0].boxes.xyxy.cpu().numpy()
    if len(bboxes) == 0:
        return [[], [], [], []]

    segms = pred[0].masks.data.cpu().numpy()
    h_segms = segms.shape[1]
    w_segms = segms.shape[2]
    h_orig = image.size[1]
    w_orig = image.size[0]
    ratio_segms = h_segms / w_segms
    ratio_orig = h_orig / w_orig

    if ratio_segms == ratio_orig:
        h_gap = 0
        w_gap = 0
    elif ratio_segms > ratio_orig:
        h_gap = int((ratio_segms - ratio_orig) * h_segms)
        w_gap = 0
    else:
        h_gap = 0
        ratio_segms = w_segms / h_segms
        ratio_orig = w_orig / h_orig
        w_gap = int((ratio_segms - ratio_orig) * w_segms)

    results = [[], [], [], []]
    for i in range(len(bboxes)):
        results[0].append(pred[0].names[int(pred[0].boxes[i].cls.item())])
        results[1].append(bboxes[i])

        mask = torch.from_numpy(segms[i])
        mask = mask[h_gap:mask.shape[0] - h_gap, w_gap:mask.shape[1] - w_gap]

        scaled_mask = torch.nn.functional.interpolate(
            mask.unsqueeze(0).unsqueeze(0),
            size=(image.size[1], image.size[0]),
            mode="bilinear",
            align_corners=False,
        ).squeeze()

        results[2].append(scaled_mask.numpy())
        results[3].append(pred[0].boxes[i].conf.cpu().numpy())

    return results


class NO_SEGM_DETECTOR:
    pass


class UltraBBoxDetector:
    def __init__(self, bbox_model):
        self.bbox_model = bbox_model

    def detect(self, image, threshold, dilation, crop_factor, drop_size=1, detailer_hook=None):
        drop_size = max(drop_size, 1)
        detected_results = inference_bbox(self.bbox_model, tensor2pil(image), threshold)
        segmasks = create_segmasks(detected_results)

        if dilation > 0:
            segmasks = dilate_masks(segmasks, dilation)

        items = []
        h = image.shape[1]
        w = image.shape[2]

        for x, label in zip(segmasks, detected_results[0]):
            item_bbox = x[0]
            item_mask = x[1]

            y1, x1, y2, x2 = item_bbox

            if x2 - x1 > drop_size and y2 - y1 > drop_size:
                crop_region = make_crop_region(w, h, item_bbox, crop_factor)

                if detailer_hook is not None:
                    crop_region = detailer_hook.post_crop_region(w, h, item_bbox, crop_region)

                item = SEG(
                    crop_tensor4(image, crop_region),
                    crop_ndarray2(item_mask, crop_region),
                    x[2],
                    crop_region,
                    item_bbox,
                    label,
                    None,
                )
                items.append(item)

        segs = (image.shape[1], image.shape[2]), items
        if detailer_hook is not None and hasattr(detailer_hook, "post_detection"):
            segs = detailer_hook.post_detection(segs)

        return segs

    def detect_combined(self, image, threshold, dilation):
        detected_results = inference_bbox(self.bbox_model, tensor2pil(image), threshold)
        segmasks = create_segmasks(detected_results)
        if dilation > 0:
            segmasks = dilate_masks(segmasks, dilation)

        return combine_masks(segmasks)

    def setAux(self, x):
        pass


class UltraSegmDetector:
    def __init__(self, bbox_model):
        self.bbox_model = bbox_model

    def detect(self, image, threshold, dilation, crop_factor, drop_size=1, detailer_hook=None):
        drop_size = max(drop_size, 1)
        detected_results = inference_segm(self.bbox_model, tensor2pil(image), threshold)
        segmasks = create_segmasks(detected_results)

        if dilation > 0:
            segmasks = dilate_masks(segmasks, dilation)

        items = []
        h = image.shape[1]
        w = image.shape[2]

        for x, label in zip(segmasks, detected_results[0]):
            item_bbox = x[0]
            item_mask = x[1]

            y1, x1, y2, x2 = item_bbox

            if x2 - x1 > drop_size and y2 - y1 > drop_size:
                crop_region = make_crop_region(w, h, item_bbox, crop_factor)

                if detailer_hook is not None:
                    crop_region = detailer_hook.post_crop_region(w, h, item_bbox, crop_region)

                item = SEG(
                    crop_tensor4(image, crop_region),
                    crop_ndarray2(item_mask, crop_region),
                    x[2],
                    crop_region,
                    item_bbox,
                    label,
                    None,
                )
                items.append(item)

        segs = (image.shape[1], image.shape[2]), items
        if detailer_hook is not None and hasattr(detailer_hook, "post_detection"):
            segs = detailer_hook.post_detection(segs)

        return segs

    def detect_combined(self, image, threshold, dilation):
        detected_results = inference_segm(self.bbox_model, tensor2pil(image), threshold)
        segmasks = create_segmasks(detected_results)
        if dilation > 0:
            segmasks = dilate_masks(segmasks, dilation)

        return combine_masks(segmasks)

    def setAux(self, x):
        pass


class UltralyticsDetectorProvider:
    @classmethod
    def INPUT_TYPES(s):
        bboxs = ["bbox/" + x for x in folder_paths.get_filename_list("ultralytics_bbox")]
        segms = ["segm/" + x for x in folder_paths.get_filename_list("ultralytics_segm")]
        return {"required": {"model_name": (bboxs + segms,)}}

    RETURN_TYPES = ("BBOX_DETECTOR", "SEGM_DETECTOR")
    FUNCTION = "doit"
    CATEGORY = "ImpactPack"

    def doit(self, model_name):
        model_path = folder_paths.get_full_path("ultralytics", model_name)

        if model_path is None:
            if model_name.startswith("bbox/"):
                model_path = folder_paths.get_full_path("ultralytics_bbox", model_name[5:])
            elif model_name.startswith("segm/"):
                model_path = folder_paths.get_full_path("ultralytics_segm", model_name[5:])

        if model_path is None:
            raise ValueError(f"[ComfyUI-Pet] model file '{model_name}' is not found in ultralytics model folders.")

        model = load_yolo(model_path)

        if model_name.startswith("bbox"):
            return UltraBBoxDetector(model), NO_SEGM_DETECTOR()
        else:
            return UltraBBoxDetector(model), UltraSegmDetector(model)


NODE_CLASS_MAPPINGS = {
    "UltralyticsDetectorProvider": UltralyticsDetectorProvider,
}

NODE_DISPLAY_NAME_MAPPINGS = {}
