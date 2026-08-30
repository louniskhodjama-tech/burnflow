import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 }, // compilations à froid du serveur de dev
  retries: 0,
  workers: 1, // scénario séquentiel : la cascade dépend de l'ordre des actions
  use: {
    actionTimeout: 30_000, // aucun clic/attente ne peut pendre indéfiniment
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    screenshot: "on",
    trace: "retain-on-failure",
    // Taille d'écran mobile (l'app est mobile-first) sans émulation tactile :
    // l'émulation touch de Chromium casse la soumission des formulaires
    // server-actions dans ce contexte de test.
    viewport: { width: 412, height: 915 },
  },
  webServer: {
    // Build de production : pas de recompilation à la volée pendant le scénario
    // (le mode dev de Next relit ses manifestes pendant qu'il les réécrit,
    // ce qui provoque des 500 intermittents sous charge).
    command: "pnpm build && pnpm start",
    url: "http://localhost:3000/api/health",
    reuseExistingServer: true,
    timeout: 300_000,
  },
});
