// Génère les icônes PWA (PNG) à partir du logo — à relancer si le logo change.
import sharp from "sharp";
import { writeFileSync } from "node:fs";

// Version « pleine surface » (fond carré, sans coins arrondis) pour
// maskable et apple-touch-icon : le contenu reste dans la zone sûre (80 %).
const fullBleed = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#14202b"/>
  <g transform="translate(51.2 51.2) scale(0.8)">
    <path d="M256 96c-40 56-104 118-104 190a104 104 0 0 0 208 0c0-72-64-134-104-190z" fill="#e48a72"/>
    <path d="M256 208c-22 30-56 64-56 102a56 56 0 0 0 112 0c0-38-34-72-56-102z" fill="#f6c9be"/>
    <rect x="236" y="336" width="40" height="120" fill="#fff" rx="8"/>
    <rect x="196" y="376" width="120" height="40" fill="#fff" rx="8"/>
  </g>
</svg>`;

const jobs = [
  { src: "public/icon.svg", out: "public/icon-192.png", size: 192 },
  { src: "public/icon.svg", out: "public/icon-512.png", size: 512 },
  { buf: fullBleed, out: "public/icon-maskable-512.png", size: 512 },
  { buf: fullBleed, out: "public/apple-touch-icon.png", size: 180 },
];

for (const j of jobs) {
  const input = j.src ?? Buffer.from(j.buf);
  const png = await sharp(input).resize(j.size, j.size).png().toBuffer();
  writeFileSync(j.out, png);
  console.log(`${j.out} (${j.size}px, ${png.length} o)`);
}
