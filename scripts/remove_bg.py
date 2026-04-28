"""Remove yellow background from the reference image, save as transparent PNG.

Detects yellow with a generous threshold, removes anti-aliased edge halos,
crops tightly to the content."""
import sys
import cv2
import numpy as np


def remove_yellow_bg(src: str, dst: str):
    img = cv2.imread(src)
    if img is None:
        raise FileNotFoundError(src)
    h, w = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    # Wide yellow threshold to also catch anti-aliased edges of the yellow bg.
    lower_yellow = np.array([10, 50, 100])
    upper_yellow = np.array([50, 255, 255])
    yellow = cv2.inRange(hsv, lower_yellow, upper_yellow)

    # Sample the dominant background color from the corners.
    corner_samples = []
    for (y, x) in [(0, 0), (0, w - 1), (h - 1, 0), (h - 1, w - 1)]:
        corner_samples.append(img[y, x])
    bg_color = np.median(np.array(corner_samples), axis=0).astype(np.int32)

    # Mask any pixel close to the background color (kills yellow halos that
    # the HSV threshold may have missed).
    diff = np.abs(img.astype(np.int32) - bg_color).sum(axis=2)
    near_bg = (diff < 80).astype(np.uint8) * 255

    # Combine masks → final background mask.
    bg_mask = cv2.bitwise_or(yellow, near_bg)

    # Clean it up.
    kernel = np.ones((3, 3), np.uint8)
    bg_mask = cv2.morphologyEx(bg_mask, cv2.MORPH_CLOSE, kernel, iterations=1)

    fg = cv2.bitwise_not(bg_mask)

    # Erode the foreground a bit to chip off any remaining yellow halo on edges.
    fg = cv2.erode(fg, kernel, iterations=1)

    # Now smooth the alpha so edges are not jagged.
    alpha = cv2.GaussianBlur(fg, (3, 3), 0)

    # Compose RGBA.
    rgba = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    rgba[:, :, 3] = alpha

    # Wipe RGB of background pixels so transparency shows clean color.
    rgba[alpha < 10, :3] = 255

    # Crop to bounding box of fully opaque content.
    opaque = (alpha > 200).astype(np.uint8)
    ys, xs = np.where(opaque > 0)
    if len(xs):
        x0, y0, x1, y1 = xs.min(), ys.min(), xs.max(), ys.max()
        rgba = rgba[y0:y1 + 1, x0:x1 + 1]

    cv2.imwrite(dst, rgba)
    print(f"saved {dst}  size={rgba.shape[1]}x{rgba.shape[0]}  bg={bg_color.tolist()}")


if __name__ == "__main__":
    src = sys.argv[1]
    dst = sys.argv[2]
    remove_yellow_bg(src, dst)
