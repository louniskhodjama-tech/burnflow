// Génère docs/social-preview.png (1280x640) — carte affichée quand le lien
// du repo est partagé (à téléverser : Settings -> Social preview sur GitHub).
import sharp from "sharp";
import { writeFileSync } from "node:fs";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640">
  <rect width="1280" height="640" fill="#14202b"/>
  <rect x="0" y="628" width="1280" height="12" fill="#e48a72"/>
  <!-- flamme + croix -->
  <g transform="translate(88 150) scale(0.66)">
    <path d="M256 96c-40 56-104 118-104 190a104 104 0 0 0 208 0c0-72-64-134-104-190z" fill="#e48a72"/>
    <path d="M256 208c-22 30-56 64-56 102a56 56 0 0 0 112 0c0-38-34-72-56-102z" fill="#f6c9be"/>
    <rect x="236" y="336" width="40" height="120" fill="#fff" rx="8"/>
    <rect x="196" y="376" width="120" height="40" fill="#fff" rx="8"/>
  </g>
  <text x="420" y="235" font-family="Segoe UI, Arial, sans-serif" font-size="96" font-weight="bold" fill="#ffffff">BurnFlow</text>
  <text x="424" y="300" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#dde5ea">Triage et orientation des brûlés</text>
  <text x="424" y="345" font-family="Segoe UI, Arial, sans-serif" font-size="34" fill="#dde5ea">en afflux massif</text>
  <text x="424" y="398" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#8fa3b0">Mass-casualty burn triage &amp; hospital routing</text>
  <!-- pastilles des classes d'orientation -->
  <g font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="bold" fill="#ffffff">
    <rect x="424" y="440" rx="10" width="170" height="44" fill="#2e7d5b"/>
    <text x="446" y="470">1 · Chirurgie</text>
    <rect x="610" y="440" rx="10" width="200" height="44" fill="#c77700"/>
    <text x="632" y="470">2 · Réanimation</text>
    <rect x="826" y="440" rx="10" width="240" height="44" fill="#b23a48"/>
    <text x="848" y="470">3 · Centre des brûlés</text>
  </g>
  <text x="424" y="552" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#8fa3b0">Open source · Licence Apache 2.0</text>
  <text x="424" y="588" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#8fa3b0">github.com/louniskhodjama-tech/burnflow</text>
</svg>`;

const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync("docs/social-preview.png", png);
console.log("docs/social-preview.png :", png.length, "octets");
