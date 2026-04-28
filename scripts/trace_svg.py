"""Trace the image-doc PNG into a clean SVG with two color groups:
   - WHITE (cards) -> kept as-is so we can recolor via fill on path[fill="white"]
   - BLUE (icons)  -> kept as-is so we can recolor via fill on path[fill="blue"]
The output SVG is written with stable fill colors that the React component
can override at runtime by setting CSS fill on the matching paths.
"""
import sys
import re
from pathlib import Path

import vtracer
import cv2
import numpy as np


def trace(src: str, dst: str):
    img = cv2.imread(src, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise FileNotFoundError(src)
    h, w = img.shape[:2]

    # Crop to the content bbox so the SVG viewBox is tight to the artwork.
    if img.shape[2] == 4:
        ys, xs = np.where(img[..., 3] > 30)
        if len(xs):
            pad = 6
            x0 = max(0, xs.min() - pad)
            y0 = max(0, ys.min() - pad)
            x1 = min(img.shape[1], xs.max() + pad)
            y1 = min(img.shape[0], ys.max() + pad)
            img = img[y0:y1, x0:x1]
            h, w = img.shape[:2]
            print(f"cropped to {w}x{h}")

    # Composite onto a sentinel color (magenta) so white cards trace cleanly
    # and we can drop the background later by color.
    SENTINEL = np.array([255, 0, 255], dtype=np.float32)  # BGR magenta
    if img.shape[2] == 4:
        bgr = img[..., :3].astype(np.float32)
        a = (img[..., 3:4].astype(np.float32)) / 255.0
        bg = np.ones_like(bgr) * SENTINEL
        comp = bgr * a + bg * (1 - a)
        rgb_input = comp.astype(np.uint8)
    else:
        rgb_input = img

    tmp_in = Path(dst).with_suffix(".trace_in.png")
    cv2.imwrite(str(tmp_in), rgb_input)

    vtracer.convert_image_to_svg_py(
        str(tmp_in),
        dst,
        colormode="color",
        hierarchical="cutout",
        mode="spline",
        filter_speckle=4,
        color_precision=6,
        layer_difference=16,
        corner_threshold=60,
        length_threshold=4.0,
        max_iterations=10,
        splice_threshold=45,
        path_precision=3,
    )

    tmp_in.unlink(missing_ok=True)

    # Post-process the SVG: collapse all paths to two roles ("card" and
    # "accent") so we can recolor at runtime via CSS.
    svg_text = Path(dst).read_text(encoding="utf-8")

    def parse_color(c):
        c = c.strip().lower()
        if c.startswith("#"):
            if len(c) == 4:
                return tuple(int(ch * 2, 16) for ch in c[1:])
            if len(c) == 7:
                return (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16))
        m = re.match(r"rgb\(([^)]+)\)", c)
        if m:
            nums = [int(x) for x in re.findall(r"\d+", m.group(1))]
            if len(nums) == 3:
                return tuple(nums)
        return None

    def classify(rgb):
        r, g, b = rgb
        # Magenta-ish (sentinel and its anti-aliased halos): r ≈ b, both >> g.
        if abs(r - b) < 40 and r > g + 40 and b > g + 40:
            return None
        # Strong blue (accent).
        if b > 150 and (b - max(r, g)) > 40:
            return "accent"
        # Whiteish (cards).
        if r > 200 and g > 200 and b > 200:
            return "card"
        # Mid tones: bluish → accent, otherwise card.
        if b > r and b > g and (b - r) > 20:
            return "accent"
        if r > b and r > g + 40:
            return None
        return "card"

    def path_bbox(d, tx=0.0, ty=0.0):
        nums = [float(x) for x in re.findall(r"-?\d+\.?\d*", d)]
        if not nums:
            return None
        xs, ys = nums[0::2], nums[1::2]
        return (min(xs) + tx, min(ys) + ty, max(xs) + tx, max(ys) + ty)

    canvas_area = w * h

    def repl(m):
        full = m.group(0)
        before, color, after = m.group(1), m.group(2), m.group(3)
        rgb = parse_color(color)
        if rgb is None:
            return full
        role = classify(rgb)
        if role is None:
            return ""
        # Drop any path whose bbox covers ≥90% of the canvas (vtracer often
        # emits a near-white full-canvas rect under the actual artwork in
        # stacked hierarchical mode).
        d_match = re.search(r'd="([^"]+)"', full)
        tx_match = re.search(r'translate\(([0-9.\-]+),\s*([0-9.\-]+)\)', full)
        tx = float(tx_match.group(1)) if tx_match else 0.0
        ty = float(tx_match.group(2)) if tx_match else 0.0
        if d_match:
            bb = path_bbox(d_match.group(1), tx, ty)
            if bb:
                bw_, bh_ = bb[2] - bb[0], bb[3] - bb[1]
                if bw_ * bh_ > canvas_area * 0.9:
                    return ""
        return f'<path{before}fill="{role}" data-role="{role}"{after}/>'

    svg_text = re.sub(r'<path([^>]*)fill="([^"]+)"([^/]*)/>', repl, svg_text)

    # Strip empty lines.
    svg_text = re.sub(r"\n\s*\n", "\n", svg_text)

    Path(dst).write_text(svg_text, encoding="utf-8")
    print(f"saved {dst}, size={w}x{h}, bytes={len(svg_text)}")


if __name__ == "__main__":
    src = sys.argv[1]
    dst = sys.argv[2]
    trace(src, dst)
