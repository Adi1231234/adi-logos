"""Build a flat variant of image-doc.svg where the document card has no
folded corner. Approach:
  1. Detect the document card in the source PNG (largest white rotated rect
     in the right half of the image).
  2. Compute the rounded-rectangle SVG path that matches its rotated rect.
  3. Replace the original document-card path in the SVG with this clean
     rounded rect, and remove the fold accent path.

Inputs:
  arg1 = source PNG (the original artwork, transparent background)
  arg2 = traced SVG (with `data-role="card"` paths and accents)
  arg3 = output flat SVG
"""
import re
import sys
from pathlib import Path

import cv2
import numpy as np


def detect_doc_card(img):
    """Return rotated rect of the document (right) card in source PNG coords."""
    if img.shape[2] == 4:
        alpha = img[..., 3]
        bgr = img[..., :3]
        # Composite over magenta to expose white shapes.
        a = (alpha.astype(np.float32) / 255.0)[..., None]
        bg = np.ones_like(bgr, dtype=np.float32) * np.array([255, 0, 255], dtype=np.float32)
        comp = bgr.astype(np.float32) * a + bg * (1 - a)
        rgb = comp.astype(np.uint8)
    else:
        rgb = img

    hsv = cv2.cvtColor(rgb, cv2.COLOR_BGR2HSV)
    white = cv2.inRange(hsv, (0, 0, 220), (180, 40, 255))
    white = cv2.morphologyEx(white, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8), iterations=2)
    contours, _ = cv2.findContours(white, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    contours = [c for c in contours if cv2.contourArea(c) > 5000]
    contours.sort(key=cv2.contourArea, reverse=True)
    if len(contours) < 2:
        return None
    # Pick the rightmost of the top two.
    rects = []
    for c in contours[:2]:
        rect = cv2.minAreaRect(c)
        rects.append(rect)
    rects.sort(key=lambda r: r[0][0])  # sort by center x
    doc_rect = rects[-1]  # rightmost = document
    return doc_rect


def rotated_rounded_rect_path(rect, radius_ratio=0.10, pad=2):
    """Return an SVG `d` string for a rounded rectangle that matches the
    given rotated rect (cv2.minAreaRect format)."""
    (cx, cy), (w, h), angle = rect
    # Add a small pad so the rect fully covers any anti-aliased edges of
    # the original card.
    w = w + pad * 2
    h = h + pad * 2
    r = round(min(w, h) * radius_ratio, 2)
    # Local rectangle corners (top-left, top-right, bottom-right, bottom-left)
    # before rotation.
    hw, hh = w / 2, h / 2

    theta = np.deg2rad(angle)
    cos_t = np.cos(theta)
    sin_t = np.sin(theta)

    def rot(px, py):
        return (cx + px * cos_t - py * sin_t, cy + px * sin_t + py * cos_t)

    # Build a rounded rect path in local coords, then transform.
    # Use a path with 4 arcs (one per corner).
    def fmt(p):
        return f"{p[0]:.2f} {p[1]:.2f}"

    # Path: start at top edge after the top-left rounding.
    p_tl_top = (-hw + r, -hh)
    p_tr_top = (hw - r, -hh)
    p_tr_right = (hw, -hh + r)
    p_br_right = (hw, hh - r)
    p_br_bot = (hw - r, hh)
    p_bl_bot = (-hw + r, hh)
    p_bl_left = (-hw, hh - r)
    p_tl_left = (-hw, -hh + r)

    rt = lambda p: rot(*p)

    d = (
        f"M {fmt(rt(p_tl_top))} "
        f"L {fmt(rt(p_tr_top))} "
        f"A {r:.2f} {r:.2f} {angle:.2f} 0 1 {fmt(rt(p_tr_right))} "
        f"L {fmt(rt(p_br_right))} "
        f"A {r:.2f} {r:.2f} {angle:.2f} 0 1 {fmt(rt(p_br_bot))} "
        f"L {fmt(rt(p_bl_bot))} "
        f"A {r:.2f} {r:.2f} {angle:.2f} 0 1 {fmt(rt(p_bl_left))} "
        f"L {fmt(rt(p_tl_left))} "
        f"A {r:.2f} {r:.2f} {angle:.2f} 0 1 {fmt(rt(p_tl_top))} Z"
    )
    return d


def find_content_bbox(img):
    if img.shape[2] != 4:
        return None
    a = img[..., 3]
    ys, xs = np.where(a > 30)
    if not len(xs):
        return None
    return xs.min(), ys.min(), xs.max(), ys.max()


def make_flat(src_png: str, src_svg: str, dst: str):
    img = cv2.imread(src_png, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise FileNotFoundError(src_png)

    # Crop the source to the same content bbox the trace step uses, so SVG
    # coordinates align with the source coordinates after cropping.
    bbox = find_content_bbox(img)
    if bbox:
        pad = 6
        x0 = max(0, bbox[0] - pad)
        y0 = max(0, bbox[1] - pad)
        x1 = min(img.shape[1], bbox[2] + pad)
        y1 = min(img.shape[0], bbox[3] + pad)
        img = img[y0:y1, x0:x1]

    doc_rect = detect_doc_card(img)
    if doc_rect is None:
        raise RuntimeError("could not detect document card in source")
    print(f"detected doc rect: center={doc_rect[0]}, size={doc_rect[1]}, angle={doc_rect[2]}")

    rounded_d = rotated_rounded_rect_path(doc_rect)

    svg = Path(src_svg).read_text(encoding="utf-8")

    # Find both card paths and identify the rightmost one (document card).
    card_matches = list(
        re.finditer(
            r'<path([^>]*?)data-role="card"([^>]*?)transform="translate\(([0-9.\-]+),\s*([0-9.\-]+)\)"([^>]*)/>',
            svg,
        )
    )
    if len(card_matches) < 2:
        raise RuntimeError(f"expected 2 card paths, found {len(card_matches)}")
    card_matches.sort(key=lambda m: float(m.group(3)))
    doc_match = card_matches[-1]

    # Replace the document card with our clean rounded rect at translate(0,0).
    new_card_tag = (
        f'<path d="{rounded_d}" fill="card" data-role="card" transform="translate(0,0)"/>'
    )
    svg = svg[: doc_match.start()] + new_card_tag + svg[doc_match.end():]

    # Remove the fold accent: small accent inside the doc card's bbox in the
    # upper-right of the world bbox of the rotated rect.
    accent_re = re.compile(
        r'<path([^>]*?)d="([^"]+)"([^>]*?)data-role="accent"([^>]*?)transform="translate\(([0-9.\-]+),\s*([0-9.\-]+)\)"([^>]*)/>'
    )
    box = cv2.boxPoints(doc_rect)
    bx0, by0 = box.min(axis=0)
    bx1, by1 = box.max(axis=0)
    bw = bx1 - bx0
    bh = by1 - by0

    to_remove = []
    for m in accent_re.finditer(svg):
        d = m.group(2)
        tx, ty = float(m.group(5)), float(m.group(6))
        nums = [float(x) for x in re.findall(r"-?\d+\.?\d*", d)]
        xs, ys = nums[0::2], nums[1::2]
        if not xs:
            continue
        ax = (min(xs) + max(xs)) / 2 + tx
        ay = (min(ys) + max(ys)) / 2 + ty
        # Inside doc world bbox?
        if ax < bx0 - 8 or ax > bx1 + 8 or ay < by0 - 8 or ay > by1 + 8:
            continue
        # Top-right quadrant of the world bbox (small but not tiny).
        in_top_right = (
            ax > bx0 + bw * 0.55 and ay < by0 + bh * 0.45
        )
        if not in_top_right:
            continue
        bb_w = max(xs) - min(xs)
        bb_h = max(ys) - min(ys)
        rel = (bb_w * bb_h) / max(bw * bh, 1)
        if rel > 0.2 or rel < 0.003:
            continue
        ratio = max(bb_w, bb_h) / max(min(bb_w, bb_h), 1)
        if ratio > 3.5:
            continue
        to_remove.append((m.start(), m.end()))
        print(f"removing fold accent at ({ax:.0f}, {ay:.0f}), rel_area={rel:.3f}")

    for s, e in sorted(to_remove, reverse=True):
        svg = svg[:s] + svg[e:]

    svg = re.sub(r"\n\s*\n", "\n", svg)
    Path(dst).write_text(svg, encoding="utf-8")
    print(f"saved {dst}")


if __name__ == "__main__":
    src_png = sys.argv[1]
    src_svg = sys.argv[2]
    dst = sys.argv[3]
    make_flat(src_png, src_svg, dst)
