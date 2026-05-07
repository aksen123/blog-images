const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const DEFAULT_SIZE = 1024;
const DEFAULT_OUTPUT = "./output/thumbnail.webp";

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;

  const value = process.argv[index + 1];

  if (!value || value.startsWith("--")) {
    return fallback;
  }

  return value;
}

function escapeXml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getThemeColor(theme) {
  const colors = {
    health: "#2E8B57",
    food: "#2E8B57",
    life: "#178CA4",
    cleaning: "#178CA4",
    tech: "#3F51B5",
    finance: "#243B6B",
    policy: "#1F6FEB",
    education: "#2E7D32",
    purple: "#6A4C93",
    green: "#2E8B57",
    blue: "#178CA4",
    navy: "#243B6B",
  };

  return colors[theme] || colors.health;
}

function splitByManualLines(text) {
  return String(text)
    .split("|")
    .map((line) => line.trim())
    .filter(Boolean);
}

function autoWrapKorean(text, maxLength = 12) {
  const cleanText = String(text).trim();

  if (!cleanText) return [];

  // 사용자가 | 로 줄바꿈 직접 지정한 경우
  if (cleanText.includes("|")) {
    return splitByManualLines(cleanText);
  }

  const words = cleanText.split(/\s+/);
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (next.length <= maxLength) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);

  // 띄어쓰기 없는 긴 한글 대응
  const finalLines = [];

  for (const line of lines) {
    if (line.length <= maxLength) {
      finalLines.push(line);
      continue;
    }

    let chunk = "";

    for (const char of line) {
      if ((chunk + char).length <= maxLength) {
        chunk += char;
      } else {
        finalLines.push(chunk);
        chunk = char;
      }
    }

    if (chunk) finalLines.push(chunk);
  }

  return finalLines;
}

function getTextLines({ title, subtitle }) {
  const titleLines = autoWrapKorean(title, 12);
  const subtitleLines = autoWrapKorean(subtitle, 12);

  const lines = [...titleLines, ...subtitleLines].filter(Boolean);

  if (lines.length === 0) {
    return ["썸네일 문구"];
  }

  return lines.slice(0, 4);
}

function getFontSize(lines) {
  const longest = Math.max(...lines.map((line) => line.length));

  if (lines.length >= 4) return 66;
  if (lines.length === 3) return longest >= 13 ? 68 : 76;
  if (lines.length === 2) return longest >= 15 ? 72 : 86;
  if (longest >= 15) return 72;
  if (longest >= 11) return 84;

  return 96;
}

function buildSvg({ title, subtitle, theme }) {
  const size = DEFAULT_SIZE;

  const outerMargin = 28;
  const borderWidth = 36;
  const borderRadius = 60;
  const borderColor = getThemeColor(theme);

  const lines = getTextLines({ title, subtitle });
  const fontSize = getFontSize(lines);
  const lineHeight = Math.round(fontSize * 1.28);

  const centerX = size / 2;
  const centerY = size / 2;

  const totalHeight = lineHeight * (lines.length - 1);
  const startY = centerY - totalHeight / 2;

  const rectX = outerMargin + borderWidth / 2;
  const rectY = outerMargin + borderWidth / 2;
  const rectSize = size - rectX * 2;

  const textElements = lines
    .map((line, index) => {
      const y = startY + index * lineHeight;

      return `
        <text
          x="${centerX}"
          y="${y}"
          text-anchor="middle"
          dominant-baseline="middle"
          font-family="Pretendard, Noto Sans KR, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
          font-size="${fontSize}"
          font-weight="900"
          fill="#111111"
          letter-spacing="-1.8"
        >${escapeXml(line)}</text>
      `;
    })
    .join("");

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#FFFFFF" />

      <rect
        x="${rectX}"
        y="${rectY}"
        width="${rectSize}"
        height="${rectSize}"
        rx="${borderRadius}"
        ry="${borderRadius}"
        fill="none"
        stroke="${borderColor}"
        stroke-width="${borderWidth}"
      />

      ${textElements}
    </svg>
  `;
}

async function createThumbnail() {
  const title = getArg("--title", "");
  const subtitle = getArg("--subtitle", "");
  const theme = getArg("--theme", "health");
  const out = getArg("--out", DEFAULT_OUTPUT);

  if (!title && !subtitle) {
    console.error("❌ --title 또는 --subtitle 중 하나는 필수다.");
    console.error(
      '예시: yarn thumb --title "콜레스테롤 낮추는 음식" --subtitle "7가지 정리"'
    );
    process.exit(1);
  }

  const outputPath = path.resolve(out);
  const outputDir = path.dirname(outputPath);
  const ext = path.extname(outputPath).toLowerCase();

  fs.mkdirSync(outputDir, { recursive: true });

  const svg = buildSvg({
    title,
    subtitle,
    theme,
  });

  const image = sharp(Buffer.from(svg));

  if (ext === ".webp") {
    await image.webp({ quality: 85 }).toFile(outputPath);
  } else if (ext === ".png") {
    await image.png().toFile(outputPath);
  } else if (ext === ".jpg" || ext === ".jpeg") {
    await image.jpeg({ quality: 90 }).toFile(outputPath);
  } else {
    console.error("❌ 지원 확장자는 .webp / .png / .jpg / .jpeg 만 가능하다.");
    process.exit(1);
  }

  console.log("✅ 썸네일 생성 완료");
  console.log(`📁 저장 위치: ${outputPath}`);
  console.log(`🎨 테마: ${theme}`);
}

createThumbnail().catch((error) => {
  console.error("❌ 썸네일 생성 실패");
  console.error(error);
  process.exit(1);
});
