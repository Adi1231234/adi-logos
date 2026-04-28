"""Remove black background from a PNG, save as transparent PNG, crop tight."""
import sys
import cv2
import numpy as np


def remove_black_bg(src: str, dst: str):
    img = cv2.imread(src)
    if img is None:
        raise FileNotFoundError(src)

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    # Foreground = anything not near-black.
    fg = (gray > 30).astype(np.uint8) * 255

    # Clean up any speckle.
    kernel = np.ones((3, 3), np.uint8)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, kernel, iterations=1)

    # Smooth alpha edges.
    alpha = cv2.GaussianBlur(fg, (3, 3), 0)

    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = alpha
    # Wipe background pixels' RGB so transparent regions are clean white.
    rgba[alpha < 10, :3] = 255

    opaque = (alpha > 200).astype(np.uint8)
    ys, xs = np.where(opaque > 0)
    if len(xs):
        pad = 16
        x0 = max(0, xs.min() - pad)
        y0 = max(0, ys.min() - pad)
        x1 = min(rgba.shape[1], xs.max() + pad + 1)
        y1 = min(rgba.shape[0], ys.max() + pad + 1)
        rgba = rgba[y0:y1, x0:x1]

    cv2.imwrite(dst, rgba)
    print(f"saved {dst}  size={rgba.shape[1]}x{rgba.shape[0]}")


if __name__ == "__main__":
    remove_black_bg(sys.argv[1], sys.argv[2])
