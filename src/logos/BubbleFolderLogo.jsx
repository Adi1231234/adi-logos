import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  BiSolidMessageSquare,
  BiSolidMessageRounded,
  BiSolidChat,
  BiSolidComment,
  BiSolidMessage,
  BiSolidMessageAlt,
} from "react-icons/bi";
import { FaMessage, FaComment } from "react-icons/fa6";
import { BsChatSquareFill, BsChatFill, BsChatLeftFill, BsChatRightFill } from "react-icons/bs";
import {
  IoChatbubble,
  IoChatbubbleSharp,
  IoChatbubbles,
} from "react-icons/io5";
import {
  PiChatFill,
  PiChatCircleFill,
  PiChatTeardropFill,
  PiChatCenteredFill,
  PiChatsFill,
  PiChatsCircleFill,
  PiChatsTeardropFill,
} from "react-icons/pi";
import { RiMessageFill } from "react-icons/ri";
import { TbMessageFilled, TbMessageCircleFilled, TbBubbleFilled } from "react-icons/tb";
import {
  HiChatBubbleBottomCenter,
  HiChatBubbleLeft,
  HiChatBubbleOvalLeft,
  HiChatBubbleLeftRight,
} from "react-icons/hi2";
import { LiaCommentSolid, LiaCommentAltSolid, LiaCommentsSolid } from "react-icons/lia";
import imageDocSvgRaw from "../assets/image-doc.svg?raw";
import imageDocFlatSvgRaw from "../assets/image-doc-flat.svg?raw";
import "./BubbleFolderLogo.css";

// Exported for the editor controls in App.jsx.
// eslint-disable-next-line react-refresh/only-export-components
export const bubbleIcons = {
  "bi-solid-square": { label: "Bi · Square", Icon: BiSolidMessageSquare },
  "bi-solid-rounded": { label: "Bi · Rounded", Icon: BiSolidMessageRounded },
  "bi-solid-chat": { label: "Bi · Chat", Icon: BiSolidChat },
  "bi-solid-comment": { label: "Bi · Comment", Icon: BiSolidComment },
  "bi-solid-message": { label: "Bi · Message", Icon: BiSolidMessage },
  "bi-solid-message-alt": { label: "Bi · Message Alt", Icon: BiSolidMessageAlt },
  "fa-message": { label: "Fa · Message", Icon: FaMessage },
  "fa-comment": { label: "Fa · Comment", Icon: FaComment },
  "bs-chat-square-fill": { label: "Bs · Chat Square", Icon: BsChatSquareFill },
  "bs-chat-fill": { label: "Bs · Chat", Icon: BsChatFill },
  "bs-chat-left-fill": { label: "Bs · Chat Left", Icon: BsChatLeftFill },
  "bs-chat-right-fill": { label: "Bs · Chat Right", Icon: BsChatRightFill },
  "io-chatbubble": { label: "Io · Chatbubble", Icon: IoChatbubble },
  "io-chatbubble-sharp": { label: "Io · Chatbubble Sharp", Icon: IoChatbubbleSharp },
  "pi-chat-fill": { label: "Pi · Chat", Icon: PiChatFill },
  "pi-chat-circle-fill": { label: "Pi · Chat Circle", Icon: PiChatCircleFill },
  "pi-chat-teardrop-fill": { label: "Pi · Chat Teardrop", Icon: PiChatTeardropFill },
  "pi-chat-centered-fill": { label: "Pi · Chat Centered", Icon: PiChatCenteredFill },
  "ri-message-fill": { label: "Ri · Message", Icon: RiMessageFill },
  "tb-message-filled": { label: "Tb · Message", Icon: TbMessageFilled },
  "tb-message-circle-filled": { label: "Tb · Message Circle", Icon: TbMessageCircleFilled },
  "tb-bubble-filled": { label: "Tb · Bubble", Icon: TbBubbleFilled },
  "io-chatbubbles": { label: "Io · Chatbubbles", Icon: IoChatbubbles },
  "hi2-bubble-bottom-center": { label: "Hi2 · Bottom Center", Icon: HiChatBubbleBottomCenter },
  "hi2-bubble-left": { label: "Hi2 · Left", Icon: HiChatBubbleLeft },
  "hi2-bubble-oval-left": { label: "Hi2 · Oval Left", Icon: HiChatBubbleOvalLeft },
  "hi2-bubble-left-right": { label: "Hi2 · Left + Right", Icon: HiChatBubbleLeftRight },
  "lia-comment-solid": { label: "Lia · Comment", Icon: LiaCommentSolid },
  "lia-comment-alt-solid": { label: "Lia · Comment Alt", Icon: LiaCommentAltSolid },
  "lia-comments-solid": { label: "Lia · Comments", Icon: LiaCommentsSolid },
  "pi-chats-fill": { label: "Pi · Chats", Icon: PiChatsFill },
  "pi-chats-circle-fill": { label: "Pi · Chats Circle", Icon: PiChatsCircleFill },
  "pi-chats-teardrop-fill": { label: "Pi · Chats Teardrop", Icon: PiChatsTeardropFill },
};

function darkenColor(hex, amount = 0.18) {
  if (!hex || hex[0] !== "#") return hex;
  const v = hex.length === 4
    ? hex.slice(1).split("").map((c) => parseInt(c + c, 16))
    : [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
      ];
  const factor = 1 - amount;
  const [r, g, b] = v.map((c) => Math.max(0, Math.min(255, Math.round(c * factor))));
  return `rgb(${r}, ${g}, ${b})`;
}

export const FOLDER_ORIGINAL_LIGHT = "#FFCA28";
export const FOLDER_ORIGINAL_DARK = "#FFA000";

function FolderInner({ folderColor = "#ffffff", folderDarkColor }) {
  const darker = folderDarkColor || darkenColor(folderColor, 0.18);
  return (
    <svg
      className="inner-icon-svg folder-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        fill={darker}
        d="M40,12H22l-4-4H8c-2.2,0-4,1.8-4,4v8h40v-4C44,13.8,42.2,12,40,12z"
      />
      <path
        fill={folderColor}
        d="M40,12H8c-2.2,0-4,1.8-4,4v20c0,2.2,1.8,4,4,4h32c2.2,0,4-1.8,4-4V16C44,13.8,42.2,12,40,12z"
      />
    </svg>
  );
}

function prepareSvg(raw) {
  const widthMatch = raw.match(/width="(\d+)"/);
  const heightMatch = raw.match(/height="(\d+)"/);
  const w = widthMatch ? widthMatch[1] : "1024";
  const h = heightMatch ? heightMatch[1] : "1024";
  return raw
    .replace(/<\?xml[^>]*>/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/fill="card"/g, 'fill="var(--card-color, #ffffff)"')
    .replace(/fill="accent"/g, 'fill="var(--accent-color, #1d4ed8)"')
    .replace(
      /<svg([^>]*)>/,
      `<svg$1 viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet">`
    );
}

const imageDocSvgColored = prepareSvg(imageDocSvgRaw);
const imageDocFlatSvgColored = prepareSvg(imageDocFlatSvgRaw);

function ImageDocInner({ accentColor, cardColor, imageDocVariant = "fold" }) {
  const html = imageDocVariant === "flat" ? imageDocFlatSvgColored : imageDocSvgColored;
  return (
    <div
      className="image-doc-stack"
      style={{
        "--accent-color": accentColor,
        "--card-color": cardColor,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// Exported for the editor controls in App.jsx.
// eslint-disable-next-line react-refresh/only-export-components
export const innerIcons = {
  folder: { label: "תיקייה", Component: FolderInner, supportsAccent: false },
  "image-doc": { label: "תמונה + מסמך", Component: ImageDocInner, supportsAccent: true },
};

const SAMPLE_SIZE = 120;

function computeBodyCenter(svg) {
  return new Promise((resolve) => {
    const cloned = svg.cloneNode(true);
    cloned.setAttribute("fill", "#000");
    cloned.setAttribute("stroke", "#000");
    cloned.setAttribute("stroke-width", "2");
    cloned.querySelectorAll("*").forEach((el) => {
      el.setAttribute("fill", "#000");
      el.setAttribute("stroke", "#000");
    });
    if (!cloned.getAttribute("xmlns")) {
      cloned.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    const svgString = new XMLSerializer().serializeToString(cloned);
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = SAMPLE_SIZE;
      canvas.height = SAMPLE_SIZE;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
      const data = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
      URL.revokeObjectURL(url);

      const rowWidths = new Array(SAMPLE_SIZE).fill(0);
      const rowLefts = new Array(SAMPLE_SIZE).fill(-1);
      const rowRights = new Array(SAMPLE_SIZE).fill(-1);
      let maxWidth = 0;

      for (let y = 0; y < SAMPLE_SIZE; y++) {
        let left = -1, right = -1;
        for (let x = 0; x < SAMPLE_SIZE; x++) {
          if (data[(y * SAMPLE_SIZE + x) * 4 + 3] > 128) {
            if (left === -1) left = x;
            right = x;
          }
        }
        if (left !== -1) {
          rowLefts[y] = left;
          rowRights[y] = right;
          const w = right - left + 1;
          rowWidths[y] = w;
          if (w > maxWidth) maxWidth = w;
        }
      }

      if (maxWidth === 0) return resolve(null);

      const threshold = maxWidth * 0.85;
      let bodyTop = -1, bodyBottom = -1;
      for (let y = 0; y < SAMPLE_SIZE; y++) {
        if (rowWidths[y] >= threshold) {
          if (bodyTop === -1) bodyTop = y;
          bodyBottom = y;
        }
      }
      if (bodyTop === -1) return resolve(null);

      let sumMid = 0, n = 0;
      for (let y = bodyTop; y <= bodyBottom; y++) {
        if (rowLefts[y] !== -1) {
          sumMid += (rowLefts[y] + rowRights[y]) / 2;
          n++;
        }
      }
      const cx = (sumMid / n / SAMPLE_SIZE) * 100;
      const cy = ((bodyTop + bodyBottom) / 2 / SAMPLE_SIZE) * 100;

      resolve({ cx, cy });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

export function BubbleFolderThumbnail({
  size = 36,
  color = "#1ea54a",
  bubbleIconKey = "bi-solid-square",
  innerLayers = [{ key: "folder", ratio: 0.5 }],
  positions = {},
  accentColor = "#1d4ed8",
  folderColor = "#ffffff",
  folderDarkColor,
  cardColor = "#ffffff",
  imageDocVariant = "fold",
  borderColor = "#ffffff",
  borderWidth = 12,
  bubbleFlipped = false,
}) {
  const config = bubbleIcons[bubbleIconKey] ?? bubbleIcons["bi-solid-square"];
  const { Icon: Bubble } = config;
  const scaledBorder = borderWidth === 0 ? 0 : Math.max(0.5, borderWidth * (size / 260));
  return (
    <div
      className={`bubble-folder-logo thumbnail ${bubbleFlipped ? "bubble-flipped" : ""}`}
      style={{
        fontSize: size,
        "--bubble-color": color,
        "--border-color": borderColor,
        "--border-width": `${scaledBorder}px`,
        pointerEvents: "none",
      }}
    >
      <Bubble className="bubble" />
      {innerLayers.map(({ key, ratio }) => {
        const layer = innerIcons[key];
        if (!layer) return null;
        const { Component } = layer;
        const pos = positions[key] ?? { cx: 50, cy: 50 };
        return (
          <div
            key={key}
            className="inner-icon"
            style={{
              top: `${pos.cy}%`,
              left: `${pos.cx}%`,
              width: `${ratio}em`,
              height: `${ratio}em`,
              cursor: "default",
            }}
          >
            <Component
              accentColor={accentColor}
              folderColor={folderColor}
              folderDarkColor={folderDarkColor}
              cardColor={cardColor}
              imageDocVariant={imageDocVariant}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function BubbleFolderLogo({
  size = 260,
  color = "#1ea54a",
  bubbleIconKey = "bi-solid-square",
  resetSignal = 0,
  innerLayers = [{ key: "folder", ratio: 0.5 }],
  onPositionChange,
  positions = {},
  accentColor = "#1d4ed8",
  folderColor = "#ffffff",
  folderDarkColor,
  cardColor = "#ffffff",
  imageDocVariant = "fold",
  borderColor = "#ffffff",
  borderWidth = 12,
  interactive = true,
  bubbleFlipped = false,
}) {
  const config = bubbleIcons[bubbleIconKey] ?? bubbleIcons["bi-solid-square"];
  const { Icon: Bubble } = config;

  const wrapperRef = useRef(null);
  const [autoCenter, setAutoCenter] = useState({ cx: 50, cy: 50 });
  const [draggingKey, setDraggingKey] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const positionsRef = useRef(positions);
  const autoCenterRef = useRef(autoCenter);
  const selectedLayerKey = innerLayers.some((l) => l.key === selectedKey) ? selectedKey : null;

  useEffect(() => {
    positionsRef.current = positions;
  }, [positions]);

  useEffect(() => {
    autoCenterRef.current = autoCenter;
  }, [autoCenter]);

  useLayoutEffect(() => {
    let cancelled = false;
    const svg = wrapperRef.current?.querySelector(".bubble");
    if (!svg) return;
    computeBodyCenter(svg).then((c) => {
      if (cancelled || !c) return;
      setAutoCenter({ cx: c.cx, cy: c.cy });
    });
    return () => {
      cancelled = true;
    };
  }, [bubbleIconKey, resetSignal]);

  useEffect(() => {
    if (!interactive || !draggingKey) return;

    const handleMove = (e) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const cx = ((e.clientX - rect.left) / rect.width) * 100;
      const cy = ((e.clientY - rect.top) / rect.height) * 100;
      onPositionChange?.(draggingKey, {
        cx: Math.max(0, Math.min(100, cx)),
        cy: Math.max(0, Math.min(100, cy)),
      });
    };
    const handleUp = () => setDraggingKey(null);

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [draggingKey, onPositionChange, interactive]);

  useEffect(() => {
    if (!interactive || !selectedLayerKey) return;
    const handleKey = (e) => {
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) return;
      const target = e.target;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      const step = e.shiftKey ? 5 : 1;
      const current = positionsRef.current[selectedLayerKey] ?? autoCenterRef.current;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      onPositionChange?.(selectedLayerKey, {
        cx: Math.max(0, Math.min(100, current.cx + dx)),
        cy: Math.max(0, Math.min(100, current.cy + dy)),
      });
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedLayerKey, onPositionChange, interactive]);

  useEffect(() => {
    if (!interactive) return;
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setSelectedKey(null);
      }
    };
    window.addEventListener("mousedown", handleClick);
    return () => window.removeEventListener("mousedown", handleClick);
  }, [interactive]);

  return (
    <div
      ref={wrapperRef}
      className={`bubble-folder-logo ${bubbleFlipped ? "bubble-flipped" : ""}`}
      style={{
        fontSize: size,
        "--bubble-color": color,
        "--border-color": borderColor,
        "--border-width": `${borderWidth}px`,
      }}
    >
      <Bubble className="bubble" />
      {innerLayers.map(({ key, ratio }) => {
        const layer = innerIcons[key];
        if (!layer) return null;
        const { Component } = layer;
        const pos = positions[key] ?? autoCenter;
        return (
          <div
            key={key}
            className={`inner-icon ${interactive && draggingKey === key ? "dragging" : ""} ${interactive && selectedLayerKey === key ? "selected" : ""}`}
            style={{
              top: `${pos.cy}%`,
              left: `${pos.cx}%`,
              width: `${ratio}em`,
              height: `${ratio}em`,
            }}
            onMouseDown={(e) => {
              if (!interactive) return;
              e.preventDefault();
              e.stopPropagation();
              setSelectedKey(key);
              setDraggingKey(key);
            }}
          >
            <Component
              accentColor={accentColor}
              folderColor={folderColor}
              folderDarkColor={folderDarkColor}
              cardColor={cardColor}
              imageDocVariant={imageDocVariant}
            />
          </div>
        );
      })}
    </div>
  );
}
