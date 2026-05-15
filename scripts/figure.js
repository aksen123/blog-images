#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const os = require("os");
const { chromium } = require("playwright");
const sharp = require("sharp");

const THEMES = {
  health: {
    bg1: "#ecfeff",
    bg2: "#f0fdf4",
    panel: "#ffffff",
    text: "#0f172a",
    muted: "#475569",
    accent: "#10b981",
    accentSoft: "#d1fae5",
    border: "#a7f3d0",
  },
  life: {
    bg1: "#f8fafc",
    bg2: "#fefce8",
    panel: "#ffffff",
    text: "#0f172a",
    muted: "#475569",
    accent: "#6366f1",
    accentSoft: "#e0e7ff",
    border: "#c7d2fe",
  },
  cleaning: {
    bg1: "#eff6ff",
    bg2: "#ecfeff",
    panel: "#ffffff",
    text: "#0f172a",
    muted: "#475569",
    accent: "#0ea5e9",
    accentSoft: "#dbeafe",
    border: "#bae6fd",
  },
  tech: {
    bg1: "#0f172a",
    bg2: "#111827",
    panel: "#111827",
    text: "#f8fafc",
    muted: "#cbd5e1",
    accent: "#22c55e",
    accentSoft: "#1e293b",
    border: "#334155",
  },
  finance: {
    bg1: "#f0fdf4",
    bg2: "#ecfccb",
    panel: "#ffffff",
    text: "#0f172a",
    muted: "#475569",
    accent: "#16a34a",
    accentSoft: "#dcfce7",
    border: "#bbf7d0",
  },
  policy: {
    bg1: "#eff6ff",
    bg2: "#f8fafc",
    panel: "#ffffff",
    text: "#0f172a",
    muted: "#475569",
    accent: "#2563eb",
    accentSoft: "#dbeafe",
    border: "#bfdbfe",
  },
  education: {
    bg1: "#faf5ff",
    bg2: "#eff6ff",
    panel: "#ffffff",
    text: "#0f172a",
    muted: "#475569",
    accent: "#7c3aed",
    accentSoft: "#ede9fe",
    border: "#ddd6fe",
  },
};

const SUPPORTED_TYPES = ["steps", "checklist", "compare", "route", "summary"];

function parseArgs(argv) {
  const args = {};

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];

    if (!token.startsWith("--")) continue;

    const key = token.slice(2);
    const next = argv[i + 1];

    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }

  return args;
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function splitItems(raw) {
  if (!raw) return [];

  return raw
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function getTheme(name) {
  return THEMES[name] || THEMES.life;
}

function getCanvasSize(type) {
  switch (type) {
    case "compare":
      return { width: 1400, height: 900 };

    case "route":
      return { width: 1400, height: 900 };

    case "summary":
      return { width: 1200, height: 900 };

    case "steps":
    case "checklist":
    default:
      return { width: 1200, height: 900 };
  }
}

function getCountClass(itemsLength) {
  if (itemsLength >= 7) return "item-count-many";
  if (itemsLength >= 5) return "item-count-5";
  return "item-count-default";
}

function renderItems(type, items) {
  if (!items.length) return "";

  if (type === "steps") {
    return `
      <div class="list steps">
        ${items
          .map(
            (item, idx) => `
              <div class="card step-card">
                <div class="step-num">${idx + 1}</div>
                <div class="step-text">${escapeHtml(item)}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  if (type === "checklist") {
    return `
      <div class="list checklist">
        ${items
          .map(
            (item) => `
              <div class="card checklist-card">
                <div class="checkbox">✓</div>
                <div class="check-text">${escapeHtml(item)}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  if (type === "compare") {
    return `
      <div class="grid compare-grid">
        ${items
          .map(
            (item) => `
              <div class="card compare-card">
                <div class="compare-title">${escapeHtml(item)}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  if (type === "route") {
    return `
      <div class="route-list">
        ${items
          .map(
            (item, idx) => `
              <div class="route-row">
                <div class="route-index">${idx + 1}</div>
                <div class="route-text">${escapeHtml(item)}</div>
              </div>
              ${idx < items.length - 1 ? `<div class="route-down">↓</div>` : ""}
            `,
          )
          .join("")}
      </div>
    `;
  }

  if (type === "summary") {
    return `
      <div class="grid summary-grid">
        ${items
          .map(
            (item) => `
              <div class="card summary-card">
                <div class="summary-bullet"></div>
                <div class="summary-text">${escapeHtml(item)}</div>
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  return "";
}

function buildHtml({ type, title, subtitle, items, themeName, brand }) {
  const theme = getTheme(themeName);
  const countClass = getCountClass(items.length);
  const brandLabel = brand || "NOW · KNOW";

  return `
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --bg1: ${theme.bg1};
        --bg2: ${theme.bg2};
        --panel: ${theme.panel};
        --text: ${theme.text};
        --muted: ${theme.muted};
        --accent: ${theme.accent};
        --accent-soft: ${theme.accentSoft};
        --border: ${theme.border};
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        font-family:
          "Pretendard",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "Noto Sans KR",
          Arial,
          sans-serif;
        background: transparent;
      }

      body {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
      }

      .canvas {
        width: 100%;
        height: 100%;
        background:
          radial-gradient(circle at top left, rgba(255, 255, 255, 0.9), transparent 32%),
          linear-gradient(135deg, var(--bg1), var(--bg2));
        color: var(--text);
        overflow: hidden;
        position: relative;
      }

      .canvas::after {
        content: "";
        position: absolute;
        right: -180px;
        bottom: -180px;
        width: 460px;
        height: 460px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.36);
        pointer-events: none;
      }

      .inner {
        position: relative;
        z-index: 1;
        height: 100%;
        display: flex;
        flex-direction: column;
        gap: 26px;
        padding: 54px 58px;
      }

      .item-count-5 .inner {
        padding: 46px 58px;
        gap: 20px;
      }

      .item-count-many .inner {
        padding: 40px 52px;
        gap: 16px;
      }

      .badge {
        align-self: flex-start;
        font-size: 17px;
        font-weight: 900;
        letter-spacing: 0.08em;
        color: var(--accent);
        background: rgba(255, 255, 255, 0.74);
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 10px 18px;
      }

      .heading {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }

      .title {
        margin: 0;
        font-size: 54px;
        line-height: 1.16;
        font-weight: 900;
        letter-spacing: -0.045em;
        word-break: keep-all;
      }

      .subtitle {
        margin: 0;
        font-size: 24px;
        line-height: 1.5;
        color: var(--muted);
        font-weight: 700;
        word-break: keep-all;
      }

      .item-count-5 .title {
        font-size: 48px;
      }

      .item-count-5 .subtitle {
        font-size: 22px;
      }

      .item-count-many .title {
        font-size: 42px;
      }

      .item-count-many .subtitle {
        font-size: 20px;
      }

      .content {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        padding-top: 10px;
      }

      .list,
      .grid,
      .route-list {
        width: 100%;
        height: 100%;
      }

      .list {
        display: grid;
        gap: 16px;
        align-content: start;
      }

      .item-count-5 .list {
        gap: 13px;
      }

      .item-count-many .list {
        gap: 10px;
      }

      .steps,
      .checklist {
        grid-template-columns: 1fr;
      }

      .grid {
        display: grid;
        gap: 22px;
      }

      .compare-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-auto-rows: minmax(170px, 1fr);
        align-content: stretch;
      }

      .summary-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-auto-rows: minmax(160px, 1fr);
        align-content: stretch;
      }

      .card {
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid var(--border);
        border-radius: 22px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
      }

      .step-card,
      .checklist-card,
      .compare-card,
      .summary-card {
        display: flex;
        align-items: center;
      }

      .step-card {
        gap: 18px;
        padding: 22px 24px;
        min-height: 104px;
      }

      .item-count-5 .step-card {
        padding: 18px 22px;
        min-height: 88px;
      }

      .item-count-many .step-card {
        padding: 14px 18px;
        min-height: 72px;
      }

      .step-num {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: var(--accent);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        font-weight: 900;
        flex-shrink: 0;
      }

      .item-count-5 .step-num {
        width: 48px;
        height: 48px;
        font-size: 24px;
      }

      .item-count-many .step-num {
        width: 42px;
        height: 42px;
        font-size: 21px;
      }

      .step-text,
      .check-text,
      .compare-title,
      .summary-text {
        font-size: 30px;
        line-height: 1.42;
        font-weight: 900;
        letter-spacing: -0.025em;
        word-break: keep-all;
      }

      .item-count-5 .step-text,
      .item-count-5 .check-text {
        font-size: 27px;
        line-height: 1.35;
      }

      .item-count-many .step-text,
      .item-count-many .check-text {
        font-size: 23px;
        line-height: 1.28;
      }

      .checklist-card {
        gap: 18px;
        padding: 22px 24px;
        min-height: 104px;
      }

      .item-count-5 .checklist-card {
        padding: 18px 22px;
        min-height: 88px;
      }

      .item-count-many .checklist-card {
        padding: 14px 18px;
        min-height: 72px;
      }

      .checkbox {
        width: 50px;
        height: 50px;
        border-radius: 14px;
        background: var(--accent-soft);
        border: 1px solid var(--border);
        color: var(--accent);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 28px;
        font-weight: 900;
        flex-shrink: 0;
      }

      .item-count-5 .checkbox {
        width: 46px;
        height: 46px;
        font-size: 24px;
      }

      .item-count-many .checkbox {
        width: 40px;
        height: 40px;
        font-size: 21px;
      }

      .compare-card {
        min-height: 170px;
        padding: 30px 26px;
        justify-content: center;
        text-align: center;
      }

      .compare-title {
        font-size: 32px;
      }

      .route-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        align-content: start;
      }

      .route-row {
        display: flex;
        align-items: center;
        gap: 18px;
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 17px 24px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
      }

      .route-index {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--accent);
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: 900;
        flex-shrink: 0;
      }

      .route-text {
        font-size: 29px;
        line-height: 1.35;
        font-weight: 900;
        letter-spacing: -0.025em;
        word-break: keep-all;
      }

      .route-down {
        margin-left: 72px;
        color: var(--accent);
        font-size: 26px;
        font-weight: 900;
        line-height: 1;
      }

      .item-count-5 .route-row,
      .item-count-many .route-row {
        padding: 14px 20px;
      }

      .item-count-5 .route-text,
      .item-count-many .route-text {
        font-size: 25px;
      }

      .item-count-5 .route-index,
      .item-count-many .route-index {
        width: 42px;
        height: 42px;
        font-size: 21px;
      }

      .summary-card {
        gap: 16px;
        padding: 28px 28px;
        align-items: flex-start;
        min-height: 150px;
      }

      .summary-bullet {
        width: 16px;
        height: 16px;
        margin-top: 14px;
        border-radius: 50%;
        background: var(--accent);
        flex-shrink: 0;
      }

      .summary-text {
        font-size: 27px;
        line-height: 1.38;
      }
    </style>
  </head>
  <body>
    <div class="canvas ${countClass}">
      <div class="inner">
        <div class="badge">${escapeHtml(brandLabel)}</div>

        <div class="heading">
          <h1 class="title">${escapeHtml(title)}</h1>
          ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ""}
        </div>

        <div class="content">
          ${renderItems(type, items)}
        </div>
      </div>
    </div>
  </body>
</html>
  `;
}

async function main() {
  const args = parseArgs(process.argv);

  const type = String(args.type || "").trim();
  const title = String(args.title || "").trim();
  const subtitle = String(args.subtitle || "").trim();
  const theme = String(args.theme || "life").trim();
  const brand = String(args.brand || "NOW · KNOW").trim();
  const out = String(args.out || "").trim();
  const items = splitItems(args.items);

  if (!SUPPORTED_TYPES.includes(type)) {
    console.error(
      `[figure] --type 값이 올바르지 않음. 지원 타입: ${SUPPORTED_TYPES.join(", ")}`,
    );
    process.exit(1);
  }

  if (!title) {
    console.error("[figure] --title 값이 필요함");
    process.exit(1);
  }

  if (!items.length) {
    console.error("[figure] --items 값이 필요함. 구분자는 | 사용");
    process.exit(1);
  }

  if (!out) {
    console.error("[figure] --out 경로가 필요함");
    process.exit(1);
  }

  const { width, height } = getCanvasSize(type);

  const html = buildHtml({
    type,
    title,
    subtitle,
    items,
    themeName: theme,
    brand,
  });

  ensureDir(out);

  const tempPngPath = path.join(
    os.tmpdir(),
    `figure-${Date.now()}-${Math.random().toString(36).slice(2)}.png`,
  );

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 2,
    });

    await page.setContent(html, { waitUntil: "load" });

    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });

    await page.locator(".canvas").screenshot({
      path: tempPngPath,
    });
  } finally {
    await browser.close();
  }

  const outputExt = path.extname(out).toLowerCase();

  if (outputExt === ".webp") {
    await sharp(tempPngPath).webp({ quality: 92 }).toFile(out);
    fs.unlinkSync(tempPngPath);
  } else if (outputExt === ".png") {
    fs.copyFileSync(tempPngPath, out);
    fs.unlinkSync(tempPngPath);
  } else if (outputExt === ".jpg" || outputExt === ".jpeg") {
    await sharp(tempPngPath).jpeg({ quality: 92 }).toFile(out);
    fs.unlinkSync(tempPngPath);
  } else {
    const fallbackOut = `${out}.webp`;
    await sharp(tempPngPath).webp({ quality: 92 }).toFile(fallbackOut);
    fs.unlinkSync(tempPngPath);
    console.log(`[figure] 확장자가 없어 ${fallbackOut} 로 저장함`);
    return;
  }

  console.log(`[figure] 생성 완료: ${out}`);
}

main().catch((error) => {
  console.error("[figure] 생성 실패");
  console.error(error);
  process.exit(1);
});
