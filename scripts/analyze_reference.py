"""Analyze the reference image: per-card position, rotation, aspect, z-order.

Cards may be touching/overlapping, so we split the merged white region using
watershed seeded from local maxima of the distance transform.
"""
import sys
import json

import cv2
import numpy as np


def analyze(image_path: str, debug_dir: str | None = None):
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(image_path)

    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # White cards on yellow background.
    lower_white = np.array([0, 0, 200])
    upper_white = np.array([180, 60, 255])
    mask_white = cv2.inRange(hsv, lower_white, upper_white)

    kernel = np.ones((3, 3), np.uint8)
    mask_white = cv2.morphologyEx(mask_white, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Watershed split.
    dist = cv2.distanceTransform(mask_white, cv2.DIST_L2, 5)
    # Two local maxima → two card centers.
    _, sure_fg = cv2.threshold(dist, 0.55 * dist.max(), 255, 0)
    sure_fg = sure_fg.astype(np.uint8)
    sure_bg = cv2.dilate(mask_white, kernel, iterations=3)
    unknown = cv2.subtract(sure_bg, sure_fg)

    n_labels, markers = cv2.connectedComponents(sure_fg)
    markers = markers + 1
    markers[unknown == 255] = 0
    markers = cv2.watershed(img, markers)

    if debug_dir:
        from pathlib import Path
        Path(debug_dir).mkdir(parents=True, exist_ok=True)
        cv2.imwrite(f"{debug_dir}/mask_white.png", mask_white)
        cv2.imwrite(f"{debug_dir}/sure_fg.png", sure_fg)
        vis = img.copy()
        vis[markers == -1] = (0, 0, 255)
        cv2.imwrite(f"{debug_dir}/watershed.png", vis)

    # Recover one mask per non-background label.
    labels = sorted(set(int(v) for v in np.unique(markers)) - {-1, 1})
    card_masks = []
    for lab in labels:
        m = np.zeros((h, w), np.uint8)
        m[markers == lab] = 255
        if cv2.countNonZero(m) > (h * w) * 0.01:
            card_masks.append(m)

    if len(card_masks) < 2:
        raise RuntimeError(f"watershed split produced {len(card_masks)} cards")

    # Keep the two largest card regions.
    card_masks.sort(key=cv2.countNonZero, reverse=True)
    card_masks = card_masks[:2]

    cards = []
    for m in card_masks:
        contours, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
        c = max(contours, key=cv2.contourArea)
        rot_rect = cv2.minAreaRect(c)
        (cx, cy), (rw, rh), angle = rot_rect

        # Normalize so width is the longer (horizontal-ish) side and angle reads as
        # rotation of a portrait-or-landscape rectangle from horizontal.
        # We want the angle that represents the rectangle's rotation from "upright".
        # Convention: positive angle = clockwise (CSS).
        # OpenCV minAreaRect returns angle in (-90, 0]; width is along that direction.
        # If portrait (rh > rw), the natural "height" is rh; correct angle by ±90.
        if rw < rh:
            angle = angle + 90
            rw, rh = rh, rw
        # Wrap angle to nearest [-45, 45] window so a +88° reads as -2°.
        while angle > 45:
            angle -= 90
        while angle < -45:
            angle += 90

        cards.append({
            "center": (cx, cy),
            "long_side": rw,
            "short_side": rh,
            "angle_long_axis_deg": angle,
            "mask": m,
            "contour": c,
            "area": int(cv2.countNonZero(m)),
        })

    cards.sort(key=lambda c: c["center"][0])
    left, right = cards

    # Z-order: compare each card's visible white inside the bounding box of the
    # other. The card on top has *more* visible white inside the overlap.
    box_l = cv2.boxPoints(cv2.minAreaRect(left["contour"])).astype(np.int32)
    box_r = cv2.boxPoints(cv2.minAreaRect(right["contour"])).astype(np.int32)
    bm_l = np.zeros((h, w), np.uint8)
    cv2.fillPoly(bm_l, [box_l], 255)
    bm_r = np.zeros((h, w), np.uint8)
    cv2.fillPoly(bm_r, [box_r], 255)
    overlap_box = cv2.bitwise_and(bm_l, bm_r)

    visible_l = cv2.countNonZero(cv2.bitwise_and(overlap_box, left["mask"]))
    visible_r = cv2.countNonZero(cv2.bitwise_and(overlap_box, right["mask"]))

    front = "left" if visible_l > visible_r else "right"

    # When the bottom-left of the document is hidden by the image card, the
    # right card's contour is "cut" into the overlap. We can also estimate this
    # by looking at how much of each card's bounding box is filled by its white
    # mask: the back card has lower fill ratio because part is occluded.
    fill_ratio_l = cv2.countNonZero(left["mask"]) / max(cv2.countNonZero(bm_l), 1)
    fill_ratio_r = cv2.countNonZero(right["mask"]) / max(cv2.countNonZero(bm_r), 1)

    def fmt(card, label):
        cx, cy = card["center"]
        long_side = card["long_side"]
        short_side = card["short_side"]
        return {
            "label": label,
            "center_px": [round(cx, 1), round(cy, 1)],
            "center_pct": [round(cx / w * 100, 1), round(cy / h * 100, 1)],
            "long_side_px": round(long_side, 1),
            "short_side_px": round(short_side, 1),
            "long_side_pct_of_image": round(long_side / w * 100, 1),
            "aspect_long_to_short": round(long_side / short_side, 3),
            "rotation_deg_clockwise_positive": round(card["angle_long_axis_deg"], 2),
            "visible_area_px": card["area"],
        }

    return {
        "image_size_px": [w, h],
        "left_card": fmt(left, "left (image icon)"),
        "right_card": fmt(right, "right (document icon)"),
        "z_order_front": front,
        "overlap_box_px": int(cv2.countNonZero(overlap_box)),
        "overlap_pct_of_smaller_box": round(
            cv2.countNonZero(overlap_box) / min(cv2.countNonZero(bm_l), cv2.countNonZero(bm_r)) * 100, 2
        ),
        "fill_ratio_left": round(fill_ratio_l, 3),
        "fill_ratio_right": round(fill_ratio_r, 3),
    }


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "reference.png"
    debug = sys.argv[2] if len(sys.argv) > 2 else None
    result = analyze(path, debug)
    print(json.dumps(result, indent=2, ensure_ascii=False))
