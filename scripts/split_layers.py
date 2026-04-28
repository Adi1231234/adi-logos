"""Split the cleaned image-doc PNG into two layers:
  - cards.png:     just the white cards (blue regions filled white too).
  - blue-mask.png: alpha mask of the blue regions only.
"""
import sys
import cv2
import numpy as np


def split(src: str, cards_dst: str, mask_dst: str):
    img = cv2.imread(src, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise FileNotFoundError(src)
    if img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    h, w = img.shape[:2]

    bgra = img.astype(np.int32)
    b, g, r, a = bgra[..., 0], bgra[..., 1], bgra[..., 2], bgra[..., 3]

    # "White" = all channels high and roughly equal.
    is_white = (r > 220) & (g > 220) & (b > 220)
    # Anti-aliased white edge.
    is_light = (r + g + b) / 3 > 200
    # "Blue / colored" = opaque non-white.
    is_colored = (a > 30) & ~is_light

    # Compute blue alpha from how "non-white" the pixel is.
    luminance = (r + g + b) / 3
    color_strength = (255 - luminance).clip(0, 255)
    blue_alpha = np.where(is_colored, np.minimum(color_strength * 1.4, 255), 0).astype(np.uint8)
    blue_alpha = (blue_alpha * (a / 255)).astype(np.uint8)
    blue_alpha = cv2.GaussianBlur(blue_alpha, (3, 3), 0)

    # Cards layer: pure white, alpha = the original pixel's overall opacity.
    # This means card = where the original has any opaque content.
    card_alpha = a.astype(np.uint8).copy()
    card_alpha = cv2.GaussianBlur(card_alpha, (3, 3), 0)
    cards = np.zeros((h, w, 4), dtype=np.uint8)
    cards[..., :3] = 255  # all white pixels
    cards[..., 3] = card_alpha

    # Blue mask layer.
    mask_rgba = np.zeros((h, w, 4), dtype=np.uint8)
    mask_rgba[..., :3] = 255  # white tint; alpha is what matters when used as mask
    mask_rgba[..., 3] = blue_alpha

    cv2.imwrite(cards_dst, cards)
    cv2.imwrite(mask_dst, mask_rgba)
    print(
        "saved",
        cards_dst,
        mask_dst,
        "colored_pixels=",
        int(is_colored.sum()),
        "size=",
        f"{w}x{h}",
    )


if __name__ == "__main__":
    src = sys.argv[1]
    cards_dst = sys.argv[2]
    mask_dst = sys.argv[3]
    split(src, cards_dst, mask_dst)
