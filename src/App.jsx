import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import { HexColorInput, HexColorPicker } from "react-colorful";
import BubbleFolderLogo, {
  BubbleFolderThumbnail,
  bubbleIcons,
  innerIcons,
  FOLDER_ORIGINAL_LIGHT,
  FOLDER_ORIGINAL_DARK,
} from "./logos/BubbleFolderLogo";
import "./App.css";

const STORAGE_KEY = "logo-studio-presets";
const STORAGE_IMPORT_HASH_PREFIX = "#importLocalStorage=";

function importLocalStorageFromHash() {
  if (typeof window === "undefined") return;
  if (!window.location.hash.startsWith(STORAGE_IMPORT_HASH_PREFIX)) return;

  try {
    const encoded = window.location.hash.slice(STORAGE_IMPORT_HASH_PREFIX.length);
    const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const entries = JSON.parse(new TextDecoder().decode(bytes));
    Object.entries(entries).forEach(([key, value]) => {
      localStorage.setItem(key, String(value));
    });
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  } catch (error) {
    console.error("Failed to import localStorage", error);
  }
}

importLocalStorageFromHash();

function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePresets(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Presets are optional; ignore storage failures from private mode or quota limits.
  }
}

const presetColors = ["#1ea54a", "#25d366", "#16a34a", "#0ea5e9", "#8b5cf6", "#f59e0b", "#ef4444"];

const DEFAULTS = {
  bubbleColor: "#1ea54a",
  bubbleIconKey: "bi-solid-square",
  bubbleFlipped: false,
  borderColor: "#ffffff",
  borderWidth: 12,
  folderColor: "#ffffff",
  folderDarkColor: null,
  cardColor: "#ffffff",
  imageDocVariant: "fold",
  layers: {
    folder: { enabled: true, ratio: 0.5 },
    "image-doc": { enabled: false, ratio: 0.5 },
  },
  layerRatio: 0.5,
};

const DEFAULT_LAYERS = DEFAULTS.layers;
const BASE_ZOOM_SCALE = 1.5;

function normalizeHex(value, fallback = DEFAULTS.bubbleColor) {
  const clean = String(value || "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(clean)) {
    return `#${clean.split("").map((char) => char + char).join("").toLowerCase()}`;
  }
  if (/^[0-9a-f]{6}$/i.test(clean)) {
    return `#${clean.toLowerCase()}`;
  }
  return fallback;
}

function hexToRgb(value) {
  const hex = normalizeHex(value).slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, Math.round(channel))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbToHsv({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let h = 0;
  if (delta !== 0) {
    if (max === rn) h = ((gn - bn) / delta) % 6;
    else if (max === gn) h = (bn - rn) / delta + 2;
    else h = (rn - gn) / delta + 4;
  }
  h = Math.round(h * 60);
  if (h < 0) h += 360;
  return {
    h,
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100,
  };
}

function hsvToRgb({ h, s, v }) {
  const sn = s / 100;
  const vn = v / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vn - c;
  let channels;
  if (h < 60) channels = [c, x, 0];
  else if (h < 120) channels = [x, c, 0];
  else if (h < 180) channels = [0, c, x];
  else if (h < 240) channels = [0, x, c];
  else if (h < 300) channels = [x, 0, c];
  else channels = [c, 0, x];
  const [rn, gn, bn] = channels;
  return {
    r: (rn + m) * 255,
    g: (gn + m) * 255,
    b: (bn + m) * 255,
  };
}

function getColorDarkness(value) {
  return Math.round(100 - rgbToHsv(hexToRgb(value)).v);
}

function setColorDarkness(value, darkness) {
  const hsv = rgbToHsv(hexToRgb(value));
  return rgbToHex(hsvToRgb({ ...hsv, v: 100 - Number(darkness) }));
}

function getActiveLogoLayers(layersData = DEFAULT_LAYERS) {
  return Object.entries(layersData || DEFAULT_LAYERS)
    .filter(([, value]) => value.enabled)
    .map(([key, value]) => ({ key, ratio: value.ratio }));
}

function getLogoPropsFromSnapshot(data = {}, size = 260) {
  const color = data.color ?? data.bubbleColor ?? DEFAULTS.bubbleColor;
  return {
    size,
    color,
    bubbleIconKey: data.bubbleIconKey ?? DEFAULTS.bubbleIconKey,
    bubbleFlipped: Boolean(data.bubbleFlipped),
    innerLayers: getActiveLogoLayers(data.layers),
    positions: data.positions ?? {},
    accentColor: data.accentColor ?? color,
    folderColor: data.folderColor ?? DEFAULTS.folderColor,
    folderDarkColor: data.folderDarkColor ?? DEFAULTS.folderDarkColor,
    cardColor: data.cardColor ?? DEFAULTS.cardColor,
    imageDocVariant: data.imageDocVariant ?? DEFAULTS.imageDocVariant,
    borderColor: data.borderColor ?? DEFAULTS.borderColor,
    borderWidth: data.borderWidth ?? DEFAULTS.borderWidth,
  };
}

function ColorPickerPanel({ value, onChange, presets = [] }) {
  const color = normalizeHex(value);
  const darkness = getColorDarkness(color);
  const handleChange = (nextColor) => onChange(normalizeHex(nextColor, color));
  const eyedropperSupported = typeof window !== "undefined" && "EyeDropper" in window;

  const pickFromScreen = async () => {
    try {
      const dropper = new window.EyeDropper();
      const result = await dropper.open();
      if (result?.sRGBHex) {
        handleChange(result.sRGBHex);
      }
    } catch {
      // User cancelled or API failed; nothing to do.
    }
  };

  return (
    <div className="color-picker-panel">
      <HexColorPicker color={color} onChange={handleChange} />
      <div className="color-picker-line">
        <span>HEX</span>
        <HexColorInput
          className="color-hex-input"
          color={color}
          onChange={handleChange}
          prefixed
        />
        {eyedropperSupported && (
          <button
            type="button"
            className="eyedropper-btn"
            onClick={pickFromScreen}
            title="דגום צבע מהמסך"
            aria-label="דגום צבע מהמסך"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m2 22 1-1h3l9-9" />
              <path d="M3 21v-3l9-9" />
              <path d="m15 6 3.4-3.4a2.1 2.1 0 1 1 3 3L18 9l.4.4a2.1 2.1 0 1 1-3 3l-3.8-3.8a2.1 2.1 0 1 1 3-3l.4.4Z" />
            </svg>
          </button>
        )}
      </div>
      <label className="color-picker-line">
        <span>כהות</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={darkness}
          onChange={(e) => onChange(setColorDarkness(color, e.currentTarget.value))}
          className="color-darkness-slider"
          style={{ "--darkness-color": color }}
        />
        <code className="color-darkness-value">{darkness}%</code>
      </label>
      {presets.length > 0 && (
        <div className="color-picker-presets">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              className={`color-preset ${normalizeHex(preset) === color ? "active" : ""}`}
              style={{ backgroundColor: preset }}
              onClick={() => onChange(normalizeHex(preset))}
              aria-label={preset}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ColorPickerControl({ value, onChange, title, presets = [] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const color = normalizeHex(value);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="color-control" ref={rootRef}>
      <button
        type="button"
        className="color-swatch-button"
        onClick={() => setOpen((value) => !value)}
        title={title}
        aria-label={title}
      >
        <span className="color-swatch" style={{ backgroundColor: color }} />
      </button>
      <HexColorInput
        className="color-inline-input"
        color={color}
        onChange={(nextColor) => onChange(normalizeHex(nextColor, color))}
        prefixed
        aria-label={`${title} HEX`}
      />
      {open && (
        <div className="color-popover">
          <ColorPickerPanel value={color} onChange={onChange} presets={presets} />
        </div>
      )}
    </div>
  );
}

function PresetList({ presets, onLoad, onRename, onDelete, onReorder }) {
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [dropAt, setDropAt] = useState(null);

  const computeInsertIndex = (target, e) => {
    const rect = target.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    return e.clientY < mid ? "before" : "after";
  };

  return (
    <div className="preset-list">
      {presets.map((p, i) => (
        <PresetRow
          key={p.name}
          index={i}
          preset={p}
          isDragging={draggingIndex === i}
          dropPosition={
            draggingIndex !== null && dropAt && dropAt.index === i ? dropAt.position : null
          }
          onLoad={onLoad}
          onRename={onRename}
          onDelete={onDelete}
          onDragStart={() => setDraggingIndex(i)}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggingIndex === null) return;
            const position = computeInsertIndex(e.currentTarget, e);
            setDropAt({ index: i, position });
          }}
          onDragLeave={() => {
            if (dropAt && dropAt.index === i) setDropAt(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (draggingIndex !== null && dropAt) {
              let targetIndex = dropAt.position === "before" ? dropAt.index : dropAt.index + 1;
              if (draggingIndex < targetIndex) targetIndex -= 1;
              if (targetIndex !== draggingIndex) onReorder(draggingIndex, targetIndex);
            }
            setDraggingIndex(null);
            setDropAt(null);
          }}
          onDragEnd={() => {
            setDraggingIndex(null);
            setDropAt(null);
          }}
        />
      ))}
    </div>
  );
}

function PresetRow({
  preset,
  index,
  isDragging,
  dropPosition,
  onLoad,
  onRename,
  onDelete,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(preset.name);
  const [error, setError] = useState("");

  const startEditing = () => {
    setDraft(preset.name);
    setError("");
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft(preset.name);
    setError("");
    setEditing(false);
  };

  const commit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === preset.name) {
      cancelEditing();
      return;
    }
    const result = onRename(preset.name, trimmed);
    if (result === false) {
      setError("שם כבר קיים");
      return;
    }
    setError("");
    setEditing(false);
  };

  const data = preset.data || {};

  return (
    <div
      className={`preset-item ${isDragging ? "dragging" : ""} ${dropPosition ? `drop-${dropPosition}` : ""}`}
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
        onDragStart?.();
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      <span className="drag-handle" title="גרור לשינוי סדר">⋮⋮</span>
      <button
        className="preset-thumb"
        onClick={() => onLoad(preset.name)}
        title="טען גרסה"
      >
        <BubbleFolderThumbnail
          {...getLogoPropsFromSnapshot(data, 40)}
        />
      </button>
      {editing ? (
        <input
          className={`preset-name-input ${error ? "has-error" : ""}`}
          value={draft}
          autoFocus
          onFocus={(e) => e.target.select()}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError("");
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") cancelEditing();
          }}
          title={error || "Enter לשמירה, Esc לביטול"}
        />
      ) : (
        <button
          className="preset-load"
          onClick={() => onLoad(preset.name)}
          onDoubleClick={(e) => {
            e.preventDefault();
            startEditing();
          }}
          title="טען (לחיצה כפולה לשינוי שם)"
        >
          {preset.name}
        </button>
      )}
      <button
        className="reset-icon"
        onClick={() => (editing ? commit() : startEditing())}
        title={editing ? "שמור שם" : "שנה שם"}
      >
        ✎
      </button>
      <button
        className="reset-icon"
        onClick={() => onDelete(preset.name)}
        title="מחק גרסה"
      >
        ✕
      </button>
    </div>
  );
}

function ResetIcon({ onClick, title = "איפוס" }) {
  return (
    <button className="reset-icon" onClick={onClick} title={title} aria-label={title}>
      ↺
    </button>
  );
}

export default function App() {
  const [bubbleColor, setBubbleColor] = useState(DEFAULTS.bubbleColor);
  const [bubbleIconKey, setBubbleIconKey] = useState(DEFAULTS.bubbleIconKey);
  const [bubbleFlipped, setBubbleFlipped] = useState(DEFAULTS.bubbleFlipped);
  const [layers, setLayers] = useState(DEFAULTS.layers);
  const [positions, setPositions] = useState({});
  const [accentColor, setAccentColor] = useState(DEFAULTS.bubbleColor);
  const [folderColor, setFolderColor] = useState(DEFAULTS.folderColor);
  const [folderDarkColor, setFolderDarkColor] = useState(DEFAULTS.folderDarkColor);
  const [cardColor, setCardColor] = useState(DEFAULTS.cardColor);
  const [imageDocVariant, setImageDocVariant] = useState(DEFAULTS.imageDocVariant);
  const [borderColor, setBorderColor] = useState(DEFAULTS.borderColor);
  const [borderWidth, setBorderWidth] = useState(DEFAULTS.borderWidth);
  const [resetSignal, setResetSignal] = useState(0);
  const [presets, setPresets] = useState(() => loadPresets());
  const [presetName, setPresetName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportSize, setExportSize] = useState(512);
  const [exportBackgroundTransparent, setExportBackgroundTransparent] = useState(true);
  const [exportBackgroundColor, setExportBackgroundColor] = useState(DEFAULTS.bubbleColor);
  const [exportBgOpen, setExportBgOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [batchFormat, setBatchFormat] = useState("png");
  const [batchSize, setBatchSize] = useState(512);
  const [batchOpen, setBatchOpen] = useState(false);
  const exportBackgroundRef = useRef({ transparent: true, color: DEFAULTS.bubbleColor });
  const exportBackgroundColorTouchedRef = useRef(false);

  const syncDefaultExportBackgroundColor = (color) => {
    if (exportBackgroundColorTouchedRef.current) return;
    exportBackgroundRef.current = {
      ...exportBackgroundRef.current,
      color,
    };
    setExportBackgroundColor(color);
  };

  const setBubbleColorValue = (color) => {
    setBubbleColor(color);
    syncDefaultExportBackgroundColor(color);
  };

  const buildSnapshot = () => ({
    bubbleColor,
    bubbleIconKey,
    bubbleFlipped,
    layers,
    positions,
    accentColor,
    folderColor,
    folderDarkColor,
    cardColor,
    imageDocVariant,
    borderColor,
    borderWidth,
  });

  const applySnapshot = (snap) => {
    if (!snap) return;
    const nextBubbleColor = snap.bubbleColor ?? DEFAULTS.bubbleColor;
    setBubbleColor(nextBubbleColor);
    setBubbleIconKey(snap.bubbleIconKey ?? DEFAULTS.bubbleIconKey);
    setBubbleFlipped(Boolean(snap.bubbleFlipped));
    setLayers(snap.layers ?? DEFAULTS.layers);
    setPositions(snap.positions ?? {});
    setAccentColor(snap.accentColor ?? DEFAULTS.bubbleColor);
    setFolderColor(snap.folderColor ?? DEFAULTS.folderColor);
    setFolderDarkColor(snap.folderDarkColor ?? DEFAULTS.folderDarkColor);
    setCardColor(snap.cardColor ?? DEFAULTS.cardColor);
    setImageDocVariant(snap.imageDocVariant ?? DEFAULTS.imageDocVariant);
    setBorderColor(snap.borderColor ?? DEFAULTS.borderColor);
    setBorderWidth(snap.borderWidth ?? DEFAULTS.borderWidth);
    syncDefaultExportBackgroundColor(nextBubbleColor);
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    const snap = buildSnapshot();
    const existingIndex = presets.findIndex((p) => p.name === name);
    let next;
    if (existingIndex >= 0) {
      next = presets.map((p, i) =>
        i === existingIndex ? { ...p, data: snap, savedAt: Date.now() } : p
      );
    } else {
      next = [...presets, { name, data: snap, savedAt: Date.now() }];
    }
    setPresets(next);
    savePresets(next);
    setPresetName("");
  };

  const handleLoadPreset = (name) => {
    const p = presets.find((x) => x.name === name);
    if (p) applySnapshot(p.data);
  };

  const handleDeletePreset = (name) => {
    const next = presets.filter((p) => p.name !== name);
    setPresets(next);
    savePresets(next);
  };

  const handleRenamePreset = (oldName, newName) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return true;
    if (presets.some((p) => p.name === trimmed)) return false;
    const next = presets.map((p) =>
      p.name === oldName ? { ...p, name: trimmed } : p
    );
    setPresets(next);
    savePresets(next);
    return true;
  };

  const handleReorderPresets = (fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    const next = [...presets];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setPresets(next);
    savePresets(next);
  };

  const setExportBackgroundTransparentValue = (transparent) => {
    exportBackgroundRef.current = {
      ...exportBackgroundRef.current,
      transparent,
    };
    setExportBackgroundTransparent(transparent);
  };

  const setExportBackgroundColorValue = (color) => {
    exportBackgroundColorTouchedRef.current = true;
    exportBackgroundRef.current = {
      transparent: false,
      color,
    };
    setExportBackgroundColor(color);
    setExportBackgroundTransparent(false);
  };

  const getExportBackground = () =>
    exportBackgroundRef.current.transparent ? "transparent" : exportBackgroundRef.current.color;

  const renderCurrentLogo = (renderSize = 260) => (
    <BubbleFolderLogo
      {...getLogoPropsFromSnapshot(buildSnapshot(), renderSize)}
      onPositionChange={setLayerPosition}
      resetSignal={resetSignal}
    />
  );

  const toggleLayer = (key) => {
    setLayers((prev) => {
      const wasEnabled = prev[key].enabled;
      const next = { ...prev, [key]: { ...prev[key], enabled: !wasEnabled } };
      const enabledCount = Object.values(next).filter((l) => l.enabled).length;
      if (enabledCount === 0) return prev;
      if (!wasEnabled) {
        setPositions((p) => {
          const np = { ...p };
          delete np[key];
          return np;
        });
        setResetSignal((n) => n + 1);
      }
      return next;
    });
  };

  const setLayerRatio = (key, ratio) => {
    setLayers((prev) => ({ ...prev, [key]: { ...prev[key], ratio } }));
  };

  const setLayerPosition = (key, pos) => {
    setPositions((prev) => ({ ...prev, [key]: pos }));
  };

  const resetLayerRatio = (key) => setLayerRatio(key, DEFAULTS.layerRatio);

  const resetLayerPosition = (key) => {
    setPositions((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setResetSignal((n) => n + 1);
  };

  const resetBubbleColor = () => setBubbleColorValue(DEFAULTS.bubbleColor);
  const resetBubbleShape = () => {
    setBubbleIconKey(DEFAULTS.bubbleIconKey);
    setBubbleFlipped(DEFAULTS.bubbleFlipped);
  };
  const resetBorderColor = () => setBorderColor(DEFAULTS.borderColor);
  const resetBorderWidth = () => setBorderWidth(DEFAULTS.borderWidth);
  const resetAccent = () => setAccentColor(bubbleColor);
  const resetFolderColor = () => {
    setFolderColor(DEFAULTS.folderColor);
    setFolderDarkColor(DEFAULTS.folderDarkColor);
  };
  const useOriginalFolderColors = () => {
    setFolderColor(FOLDER_ORIGINAL_LIGHT);
    setFolderDarkColor(FOLDER_ORIGINAL_DARK);
  };
  const resetCardColor = () => setCardColor(DEFAULTS.cardColor);

  const resetBorderSection = () => {
    resetBorderColor();
    resetBorderWidth();
  };

  const resetInnerSection = () => {
    setLayers(DEFAULTS.layers);
    setPositions({});
    setAccentColor(bubbleColor);
    setFolderColor(DEFAULTS.folderColor);
    setFolderDarkColor(DEFAULTS.folderDarkColor);
    setCardColor(DEFAULTS.cardColor);
    setImageDocVariant(DEFAULTS.imageDocVariant);
    setResetSignal((n) => n + 1);
  };

  const downloadFile = (dataUrl, filename) => {
    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    downloadFile(url, filename);
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const svgElementToImage = (svgElement) =>
    new Promise((resolve, reject) => {
      const svg = svgElement.cloneNode(true);
      if (!svg.getAttribute("xmlns")) {
        svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      }
      const serialized = new XMLSerializer().serializeToString(svg);
      const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Could not load serialized SVG image"));
      img.src = url;
    });

  const prepareBubbleSvgClone = (
    bubbleSvg,
    sourceSize,
    renderedBubbleColor,
    borderColor,
    borderWidth,
    bubbleFlipped
  ) => {
    const bubbleClone = bubbleSvg.cloneNode(true);
    bubbleClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    bubbleClone.setAttribute("x", "0");
    bubbleClone.setAttribute("y", "0");
    bubbleClone.setAttribute("width", String(sourceSize));
    bubbleClone.setAttribute("height", String(sourceSize));
    if (bubbleFlipped) {
      bubbleClone.setAttribute("transform", `translate(${sourceSize} 0) scale(-1 1)`);
    } else {
      bubbleClone.removeAttribute("transform");
    }
    bubbleClone.style.width = `${sourceSize}px`;
    bubbleClone.style.height = `${sourceSize}px`;
    bubbleClone.style.color = renderedBubbleColor;
    bubbleClone.style.fill = renderedBubbleColor;
    bubbleClone.style.stroke = borderColor;
    bubbleClone.style.strokeWidth = `${borderWidth}px`;
    bubbleClone.style.strokeLinejoin = "round";
    bubbleClone.style.paintOrder = "stroke fill";
    bubbleClone.style.overflow = "visible";
    bubbleClone.querySelectorAll("*").forEach((el) => {
      el.style.fill = renderedBubbleColor;
      el.style.stroke = borderColor;
      el.style.strokeWidth = `${borderWidth}px`;
      el.style.strokeLinejoin = "round";
      el.style.paintOrder = "stroke fill";
      el.style.vectorEffect = "non-scaling-stroke";
    });
    return bubbleClone;
  };

  const getLogoExportParts = (node, sourceSize) => {
    const logoNode = node.matches?.(".bubble-folder-logo")
      ? node
      : node.querySelector?.(".bubble-folder-logo");
    if (!logoNode) {
      throw new Error("Could not find logo node for export");
    }

    const logoRect = logoNode.getBoundingClientRect();
    const coordinateScale = sourceSize / logoRect.width;
    const logoStyle = window.getComputedStyle(logoNode);
    const bubbleSvg = logoNode.querySelector(".bubble");
    const renderedBubbleColor =
      logoStyle.getPropertyValue("--bubble-color").trim() ||
      window.getComputedStyle(bubbleSvg || logoNode).color ||
      "#1ea54a";
    const borderColor = logoStyle.getPropertyValue("--border-color").trim() || "#ffffff";
    const borderWidth =
      parseFloat(logoStyle.getPropertyValue("--border-width")) ||
      parseFloat(logoStyle.strokeWidth) ||
      0;
    const bubbleFlipped = logoNode.classList.contains("bubble-flipped");

    return {
      logoNode,
      logoRect,
      coordinateScale,
      bubbleSvg,
      renderedBubbleColor,
      borderColor,
      borderWidth,
      bubbleFlipped,
      innerIconNodes: [...logoNode.querySelectorAll(".inner-icon")],
    };
  };

  const prepareInnerSvgClone = (innerIcon) => {
    const innerSvg = innerIcon.querySelector("svg");
    if (!innerSvg) return null;
    const innerClone = innerSvg.cloneNode(true);
    innerClone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const stack = innerIcon.querySelector(".image-doc-stack");
    if (stack) {
      innerClone.style.setProperty(
        "--accent-color",
        stack.style.getPropertyValue("--accent-color") || "#1d4ed8"
      );
      innerClone.style.setProperty(
        "--card-color",
        stack.style.getPropertyValue("--card-color") || "#ffffff"
      );
    }
    return innerClone;
  };

  const serializeSvgNode = (svgNode) => new XMLSerializer().serializeToString(svgNode);

  const drawLogoNodeToSvgMarkup = (node, sourceSize, targetSize, backgroundColor = "transparent") => {
    const {
      logoRect,
      coordinateScale,
      bubbleSvg,
      renderedBubbleColor,
      borderColor,
      borderWidth,
      bubbleFlipped,
      innerIconNodes,
    } = getLogoExportParts(node, sourceSize);

    const bg = backgroundColor === "transparent" ? "transparent" : backgroundColor;
    const parts = [];
    if (bg !== "transparent") {
      parts.push(`<rect x="0" y="0" width="${sourceSize}" height="${sourceSize}" fill="${bg}"/>`);
    }
    if (bubbleSvg) {
      parts.push(
        serializeSvgNode(
          prepareBubbleSvgClone(
            bubbleSvg,
            sourceSize,
            renderedBubbleColor,
            borderColor,
            borderWidth,
            bubbleFlipped
          )
        )
      );
    }

    for (const innerIcon of innerIconNodes) {
      const innerClone = prepareInnerSvgClone(innerIcon);
      if (!innerClone) continue;
      const innerRect = innerIcon.getBoundingClientRect();
      const x = (innerRect.left - logoRect.left) * coordinateScale;
      const y = (innerRect.top - logoRect.top) * coordinateScale;
      const width = innerRect.width * coordinateScale;
      const height = innerRect.height * coordinateScale;
      innerClone.setAttribute("x", String(x));
      innerClone.setAttribute("y", String(y));
      innerClone.setAttribute("width", String(width));
      innerClone.setAttribute("height", String(height));
      innerClone.style.width = `${width}px`;
      innerClone.style.height = `${height}px`;
      parts.push(serializeSvgNode(innerClone));
    }

    return [
      `<svg xmlns="http://www.w3.org/2000/svg" width="${targetSize}" height="${targetSize}" viewBox="0 0 ${sourceSize} ${sourceSize}">`,
      ...parts,
      "</svg>",
    ].join("");
  };

  const exportNodeToSvg = (node, sourceSize, targetSize, backgroundColor = "transparent") =>
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
      drawLogoNodeToSvgMarkup(node, sourceSize, targetSize, backgroundColor)
    )}`;

  const drawLogoNodeToPng = async (node, sourceSize, targetSize, backgroundColor) => {
    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not create manual PNG canvas context");
    }

    const bg = backgroundColor === "transparent" ? "transparent" : backgroundColor;
    if (bg !== "transparent") {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, targetSize, targetSize);
    }

    const scale = targetSize / sourceSize;
    ctx.save();
    ctx.scale(scale, scale);

    const {
      logoRect,
      coordinateScale,
      bubbleSvg,
      renderedBubbleColor,
      borderColor,
      borderWidth,
      bubbleFlipped,
      innerIconNodes,
    } = getLogoExportParts(node, sourceSize);

    if (bubbleSvg) {
      const bubbleImage = await svgElementToImage(
        prepareBubbleSvgClone(
          bubbleSvg,
          sourceSize,
          renderedBubbleColor,
          borderColor,
          borderWidth,
          bubbleFlipped
        )
      );
      ctx.drawImage(bubbleImage, 0, 0, sourceSize, sourceSize);
    }

    for (const innerIcon of innerIconNodes) {
      const innerClone = prepareInnerSvgClone(innerIcon);
      if (!innerClone) continue;
      const innerRect = innerIcon.getBoundingClientRect();
      const x = (innerRect.left - logoRect.left) * coordinateScale;
      const y = (innerRect.top - logoRect.top) * coordinateScale;
      const width = innerRect.width * coordinateScale;
      const height = innerRect.height * coordinateScale;
      innerClone.setAttribute("width", String(width));
      innerClone.setAttribute("height", String(height));
      innerClone.style.width = `${width}px`;
      innerClone.style.height = `${height}px`;
      const innerImage = await svgElementToImage(innerClone);
      ctx.drawImage(innerImage, x, y, width, height);
    }

    ctx.restore();
    return canvas.toDataURL("image/png");
  };

  const exportNodeToPng = async (node, sourceSize, targetSize, backgroundColor) => {
    const bg = backgroundColor === "transparent" ? "transparent" : backgroundColor;
    const previousBackground = node.style.background;
    const previousBackgroundColor = node.style.backgroundColor;
    const previousOverflow = node.style.overflow;
    const logoNode = node.querySelector(".bubble-folder-logo") || node;
    const previousLogoBackground = logoNode.style.background;
    const previousLogoBackgroundColor = logoNode.style.backgroundColor;
    const previousLogoWidth = logoNode.style.width;
    const previousLogoHeight = logoNode.style.height;
    const previousLogoFlexShrink = logoNode.style.flexShrink;
    node.style.background = bg;
    node.style.backgroundColor = bg;
    node.style.overflow = "hidden";
    logoNode.style.background = bg;
    logoNode.style.backgroundColor = bg;
    logoNode.style.width = `${sourceSize}px`;
    logoNode.style.height = `${sourceSize}px`;
    logoNode.style.flexShrink = "0";

    try {
      return await drawLogoNodeToPng(node, sourceSize, targetSize, bg);
    } finally {
      node.style.background = previousBackground;
      node.style.backgroundColor = previousBackgroundColor;
      node.style.overflow = previousOverflow;
      logoNode.style.background = previousLogoBackground;
      logoNode.style.backgroundColor = previousLogoBackgroundColor;
      logoNode.style.width = previousLogoWidth;
      logoNode.style.height = previousLogoHeight;
      logoNode.style.flexShrink = previousLogoFlexShrink;
    }
  };

  const getExportSourceSize = (node) => {
    const logoNode = node.matches?.(".bubble-folder-logo")
      ? node
      : node.querySelector?.(".bubble-folder-logo");
    const rect = (logoNode || node).getBoundingClientRect();
    return Math.max(1, Math.ceil(rect.width || 260));
  };

  const exportRenderedLogo = async (node, format, targetSize, backgroundColor) => {
    const sourceSize = getExportSourceSize(node);
    if (format === "png") {
      return await exportNodeToPng(node, sourceSize, targetSize, backgroundColor);
    }
    return exportNodeToSvg(node, sourceSize, targetSize, backgroundColor);
  };

  const exportAllPresets = async () => {
    if (presets.length === 0) return;
    setExporting(true);
    try {
      const target = Math.max(16, batchSize);
      const zip = new JSZip();
      const wantPng = batchFormat === "png" || batchFormat === "both";
      const wantSvg = batchFormat === "svg" || batchFormat === "both";
      const exportBackground = getExportBackground();

      let fileCount = 0;
      for (const [index, preset] of presets.entries()) {
        const node = document.querySelector(`[data-preset-render="${index}"]`);
        if (!node) continue;
        const safeName = preset.name.replace(/[^\w֐-׿\s.-]/g, "_");
        const zipName =
          preset.name
            .trim()
            .replace(/[<>:"/\\|?*]/g, "_")
            .split("")
            .map((char) => (char.charCodeAt(0) < 32 ? "_" : char))
            .join("")
            .replace(/\s+/g, " ") ||
          safeName ||
          `preset-${index + 1}`;
        try {
          if (wantPng) {
            const finalPngUrl = await exportRenderedLogo(node, "png", target, exportBackground);
            zip.file(`${zipName}.png`, finalPngUrl.split(",")[1], { base64: true });
            fileCount += 1;
          }
          if (wantSvg) {
            const svgUrl = await exportRenderedLogo(node, "svg", target, exportBackground);
            zip.file(
              `${zipName}.svg`,
              decodeURIComponent(svgUrl.split(",")[1])
            );
            fileCount += 1;
          }
        } catch (err) {
          console.error(`failed to export ${preset.name}`, err);
        }
      }
      if (fileCount === 0) {
        throw new Error("No preset files were exported");
      }
      const blob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });
      const zipBlob = new Blob([blob], { type: "application/zip" });
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
      const tag = batchFormat === "both" ? "all" : batchFormat;
      downloadBlob(zipBlob, `logos-${tag}-${target}-${stamp}.zip`);
      setBatchOpen(false);
    } catch (err) {
      console.error("export all failed", err);
    } finally {
      setExporting(false);
    }
  };

  const exportLogo = async (format) => {
    const node = document.querySelector('[data-export-render="current"]');
    if (!node) return;
    setExporting(true);
    try {
      const target = Math.max(16, exportSize);
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, "-");
      const dataUrl = await exportRenderedLogo(node, format, target, getExportBackground());
      downloadFile(dataUrl, `logo-${target}-${stamp}.${format}`);
    } catch (err) {
      console.error("export failed", err);
    } finally {
      setExporting(false);
    }
  };

  const handleResetAll = () => {
    setBubbleColor(DEFAULTS.bubbleColor);
    setBubbleIconKey(DEFAULTS.bubbleIconKey);
    setBubbleFlipped(DEFAULTS.bubbleFlipped);
    setLayers(DEFAULTS.layers);
    setPositions({});
    setAccentColor(DEFAULTS.bubbleColor);
    setFolderColor(DEFAULTS.folderColor);
    setFolderDarkColor(DEFAULTS.folderDarkColor);
    setCardColor(DEFAULTS.cardColor);
    setImageDocVariant(DEFAULTS.imageDocVariant);
    setBorderColor(DEFAULTS.borderColor);
    setBorderWidth(DEFAULTS.borderWidth);
    exportBackgroundColorTouchedRef.current = false;
    exportBackgroundRef.current = {
      transparent: true,
      color: DEFAULTS.bubbleColor,
    };
    setExportBackgroundTransparent(true);
    setExportBackgroundColor(DEFAULTS.bubbleColor);
    setResetSignal((n) => n + 1);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Logo Studio</h1>
        <button className="reset-btn primary" onClick={handleResetAll}>
          איפוס הכל ↺
        </button>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">צבע הבועית</h2>
              <ResetIcon onClick={resetBubbleColor} />
            </div>
            <div className="row">
              <ColorPickerControl
                value={bubbleColor}
                onChange={setBubbleColorValue}
                title="צבע הבועית"
                presets={presetColors}
              />
              <ResetIcon onClick={resetBubbleColor} title="איפוס צבע" />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">צורת הבועית</h2>
              <ResetIcon onClick={resetBubbleShape} />
            </div>
            <div className="row">
              <span className="row-label">Mirror</span>
              <button
                className={`mirror-toggle ${bubbleFlipped ? "active" : ""}`}
                onClick={() => setBubbleFlipped((value) => !value)}
                title="הפוך את הבועית אופקית"
              >
                ⇄
              </button>
            </div>
            <div className="bubble-grid">
              {Object.entries(bubbleIcons).map(([key, { label, Icon }]) => (
                <button
                  key={key}
                  className={`bubble-option ${key === bubbleIconKey ? "active" : ""}`}
                  onClick={() => setBubbleIconKey(key)}
                  title={label}
                >
                  <Icon
                    className={bubbleFlipped ? "mirrored-preview" : ""}
                    style={{ color: bubbleColor }}
                  />
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">מסגרת</h2>
              <ResetIcon onClick={resetBorderSection} title="איפוס מסגרת" />
            </div>
            <div className="row">
              <span className="row-label">צבע</span>
              <ColorPickerControl
                value={borderColor}
                onChange={setBorderColor}
                title="צבע מסגרת"
              />
              <ResetIcon onClick={resetBorderColor} title="איפוס צבע" />
            </div>
            <div className="row">
              <span className="row-label">עובי</span>
              <input
                type="range"
                min="0"
                max="40"
                step="1"
                value={borderWidth}
                onChange={(e) => setBorderWidth(Number(e.target.value))}
                className="grow"
              />
              <code className="hex">{borderWidth}px</code>
              <ResetIcon onClick={resetBorderWidth} title="איפוס עובי" />
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">תוכן הבועית</h2>
              <ResetIcon onClick={resetInnerSection} title="איפוס תוכן" />
            </div>
            <div className="row toggles">
              {Object.entries(innerIcons).map(([key, { label }]) => (
                <button
                  key={key}
                  className={`inner-tab ${layers[key].enabled ? "active" : ""}`}
                  onClick={() => toggleLayer(key)}
                >
                  {layers[key].enabled ? "✓ " : ""}
                  {label}
                </button>
              ))}
            </div>

            {layers.folder.enabled && (
              <div className="layer-group">
                <div className="layer-group-head">
                  <span className="layer-group-title">תיקייה</span>
                  <div className="layer-group-actions">
                    <button
                      className="reset-btn small"
                      onClick={() => resetLayerPosition("folder")}
                    >
                      ⊕ מרכז
                    </button>
                  </div>
                </div>
                <div className="row">
                  <span className="row-label">גודל</span>
                  <input
                    type="range"
                    min="0.15"
                    max="0.9"
                    step="0.01"
                    value={layers.folder.ratio}
                    onChange={(e) => setLayerRatio("folder", Number(e.target.value))}
                    className="grow"
                  />
                  <code className="hex">{Math.round(layers.folder.ratio * 100)}%</code>
                  <ResetIcon onClick={() => resetLayerRatio("folder")} title="איפוס גודל" />
                </div>
                <div className="row">
                  <span className="row-label">צבע</span>
                  <ColorPickerControl
                    value={folderColor}
                    onChange={(color) => {
                      setFolderColor(color);
                      setFolderDarkColor(null);
                    }}
                    title="צבע תיקייה"
                  />
                  <button
                    className="reset-btn small"
                    onClick={useOriginalFolderColors}
                    title="צבע צהוב מקורי של FcFolder"
                  >
                    מקורי
                  </button>
                  <ResetIcon onClick={resetFolderColor} title="איפוס לבן" />
                </div>
              </div>
            )}

            {layers["image-doc"].enabled && (
              <div className="layer-group">
                <div className="layer-group-head">
                  <span className="layer-group-title">תמונה + מסמך</span>
                  <div className="layer-group-actions">
                    <button
                      className="reset-btn small"
                      onClick={() => resetLayerPosition("image-doc")}
                    >
                      ⊕ מרכז
                    </button>
                  </div>
                </div>
                <div className="row">
                  <span className="row-label">גודל</span>
                  <input
                    type="range"
                    min="0.15"
                    max="0.9"
                    step="0.01"
                    value={layers["image-doc"].ratio}
                    onChange={(e) => setLayerRatio("image-doc", Number(e.target.value))}
                    className="grow"
                  />
                  <code className="hex">{Math.round(layers["image-doc"].ratio * 100)}%</code>
                  <ResetIcon onClick={() => resetLayerRatio("image-doc")} title="איפוס גודל" />
                </div>
                <div className="row">
                  <span className="row-label">צבע אייקון</span>
                  <ColorPickerControl
                    value={accentColor}
                    onChange={setAccentColor}
                    title="צבע אייקון"
                  />
                  <ResetIcon onClick={resetAccent} title="איפוס לצבע הבועית" />
                </div>
                <div className="row">
                  <span className="row-label">צבע קלפים</span>
                  <ColorPickerControl
                    value={cardColor}
                    onChange={setCardColor}
                    title="צבע קלפים"
                  />
                  <ResetIcon onClick={resetCardColor} title="איפוס לבן" />
                </div>
                <div className="row">
                  <span className="row-label">סגנון מסמך</span>
                  <div className="batch-format">
                    <button
                      className={`batch-format-btn ${imageDocVariant === "fold" ? "active" : ""}`}
                      onClick={() => setImageDocVariant("fold")}
                    >
                      עם קצה מקופל
                    </button>
                    <button
                      className={`batch-format-btn ${imageDocVariant === "flat" ? "active" : ""}`}
                      onClick={() => setImageDocVariant("flat")}
                    >
                      ללא קיפול
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </aside>

        <main
          className="logo-stage"
          onWheel={(e) => {
            if (!e.ctrlKey && !e.shiftKey) return;
            e.preventDefault();
            const dir = e.deltaY > 0 ? -1 : 1;
            setZoom((z) => Math.max(0.2, Math.min(4, +(z + dir * 0.1).toFixed(2))));
          }}
        >
          <div className="zoom-controls">
            <button
              className="zoom-btn"
              onClick={() => setZoom((z) => Math.max(0.2, z - 0.1))}
              title="הקטן"
            >
              −
            </button>
            <button
              className="zoom-value"
              onClick={() => setZoom(1)}
              title="איפוס ל-100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              className="zoom-btn"
              onClick={() => setZoom((z) => Math.min(4, z + 0.1))}
              title="הגדל"
            >
              +
            </button>
          </div>
          <div className="export-buttons">
            <div className="export-size">
              <span className="export-size-label">SIZE</span>
              <input
                type="number"
                className="export-size-input"
                min="32"
                max="4096"
                step="1"
                value={exportSize}
                onChange={(e) => setExportSize(Number(e.target.value) || 0)}
              />
              <span className="export-size-unit">px</span>
            </div>
            <div className="export-presets">
              {[128, 256, 512, 1024, 2048].map((s) => (
                <button
                  key={s}
                  className={`export-preset ${exportSize === s ? "active" : ""}`}
                  onClick={() => setExportSize(s)}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="export-bg">
              <button
                className="export-bg-button"
                onClick={() => setExportBgOpen((v) => !v)}
                title="רקע לייצוא"
              >
                <span>רקע</span>
                <span
                  className={`export-bg-swatch ${exportBackgroundTransparent ? "transparent" : ""}`}
                  style={{ backgroundColor: exportBackgroundTransparent ? undefined : exportBackgroundColor }}
                />
              </button>
              {exportBgOpen && (
                <div className="export-bg-popover">
                  <div className="export-bg-title">רקע</div>
                  <div className="export-bg-options">
                    <button
                      className={`export-bg-toggle ${exportBackgroundTransparent ? "active" : ""}`}
                      onClick={() => setExportBackgroundTransparentValue(true)}
                    >
                      שקוף
                    </button>
                    <button
                      className={`export-bg-toggle ${!exportBackgroundTransparent ? "active" : ""}`}
                      onClick={() => setExportBackgroundTransparentValue(false)}
                    >
                      צבע
                    </button>
                  </div>
                  <div className="export-bg-color-row">
                    <ColorPickerPanel
                      value={exportBackgroundColor}
                      onChange={setExportBackgroundColorValue}
                      presets={presetColors}
                    />
                  </div>
                </div>
              )}
            </div>
            <button
              className="export-btn"
              onClick={() => exportLogo("svg")}
              disabled={exporting}
              title="הורד SVG"
            >
              <span className="export-icon">⬇</span> SVG
            </button>
            <button
              className="export-btn"
              onClick={() => exportLogo("png")}
              disabled={exporting}
              title="הורד PNG"
            >
              <span className="export-icon">⬇</span> PNG
            </button>
          </div>
          <div className="zoom-wrapper" style={{ transform: `scale(${zoom * BASE_ZOOM_SCALE})` }}>
            <div
              className="preview-bg"
              style={{
                backgroundColor: exportBackgroundTransparent ? "transparent" : exportBackgroundColor,
              }}
            >
              {renderCurrentLogo()}
            </div>
          </div>
        </main>

        <aside className="presets-pane">
          <section className="panel">
            <div className="panel-head">
              <h2 className="panel-title">גרסאות שמורות</h2>
              <span className="hex">{presets.length}</span>
            </div>
            <div className="row">
              <input
                type="text"
                className="text-input grow"
                placeholder="שם הגרסה..."
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSavePreset();
                }}
              />
              <button
                className="reset-btn primary"
                onClick={handleSavePreset}
                disabled={!presetName.trim()}
              >
                שמור 💾
              </button>
            </div>
            {presets.length > 0 && (
              <button
                className="reset-btn primary"
                onClick={() => setBatchOpen(true)}
              >
                הורד הכל כ-ZIP ({presets.length}) 📦
              </button>
            )}
            {presets.length > 0 && (
              <PresetList
                presets={presets}
                onLoad={handleLoadPreset}
                onRename={handleRenamePreset}
                onDelete={handleDeletePreset}
                onReorder={handleReorderPresets}
              />
            )}
          </section>
        </aside>
      </div>

      {batchOpen && (
        <div className="dialog-backdrop" onClick={() => !exporting && setBatchOpen(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-head">
              <h3>הורדת כל הגרסאות</h3>
              <button
                className="reset-icon"
                onClick={() => setBatchOpen(false)}
                disabled={exporting}
                title="סגור"
              >
                ✕
              </button>
            </div>
            <div className="dialog-body">
              <div className="dialog-row">
                <span className="dialog-label">פורמט</span>
                <div className="batch-format">
                  {[
                    { id: "png", label: "PNG" },
                    { id: "svg", label: "SVG" },
                    { id: "both", label: "שניהם" },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      className={`batch-format-btn ${batchFormat === opt.id ? "active" : ""}`}
                      onClick={() => setBatchFormat(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="dialog-row">
                <span className="dialog-label">גודל</span>
                <input
                  type="number"
                  className="text-input dialog-size-input"
                  min="32"
                  max="4096"
                  step="1"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value) || 0)}
                />
                <code className="hex">px</code>
                <div className="batch-presets">
                  {[128, 256, 512, 1024, 2048].map((s) => (
                    <button
                      key={s}
                      className={`batch-preset-btn ${batchSize === s ? "active" : ""}`}
                      onClick={() => setBatchSize(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              {(batchFormat === "png" || batchFormat === "svg" || batchFormat === "both") && (
                <div className="dialog-row">
                  <span className="dialog-label">רקע</span>
                  <button
                    className={`batch-format-btn standalone ${exportBackgroundTransparent ? "active" : ""}`}
                    onClick={() => setExportBackgroundTransparentValue(true)}
                  >
                    שקוף
                  </button>
                  <button
                    className={`batch-format-btn standalone ${!exportBackgroundTransparent ? "active" : ""}`}
                    onClick={() => setExportBackgroundTransparentValue(false)}
                  >
                    צבע
                  </button>
                  <div className="dialog-color-picker">
                    <ColorPickerPanel
                      value={exportBackgroundColor}
                      onChange={setExportBackgroundColorValue}
                      presets={presetColors}
                    />
                  </div>
                </div>
              )}
              <div className="dialog-summary">
                {presets.length} גרסאות •{" "}
                {batchFormat === "both" ? "PNG + SVG" : batchFormat.toUpperCase()} •{" "}
                {batchSize}px
                {(batchFormat === "png" || batchFormat === "svg" || batchFormat === "both") && (
                  <>
                    {" | רקע: "}
                    {exportBackgroundTransparent ? "שקוף" : exportBackgroundColor.toUpperCase()}
                  </>
                )}
              </div>
            </div>
            <div className="dialog-actions">
              <button
                className="reset-btn"
                onClick={() => setBatchOpen(false)}
                disabled={exporting}
              >
                ביטול
              </button>
              <button
                className="reset-btn primary"
                onClick={exportAllPresets}
                disabled={exporting}
              >
                {exporting ? "מייצא..." : "הורד ZIP"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden-render-stage" aria-hidden="true">
        <div data-export-render="current" className="hidden-render-item">
          <BubbleFolderLogo
            {...getLogoPropsFromSnapshot(buildSnapshot(), 260)}
            interactive={false}
          />
        </div>
        {presets.map((p, i) => {
          const data = p.data || {};
          return (
            <div key={p.name} data-preset-render={i} className="hidden-render-item">
              <BubbleFolderLogo
                {...getLogoPropsFromSnapshot(data, 260)}
                interactive={false}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
