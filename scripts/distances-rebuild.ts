import "./_env";
import { rebuildAllDistances } from "../src/lib/distance";

/**
 * Recalcule la table de distances (point médical → hôpital et hôpital → hôpital).
 * Usage :
 *   pnpm distances:rebuild                  # tout recalculer
 *   pnpm distances:rebuild --only-estimates # ne recalculer que les estimations
 *                                             (à lancer quand OSRM devient disponible)
 */
async function main() {
  const onlyEstimates = process.argv.includes("--only-estimates");
  console.log(
    `Recalcul des distances${onlyEstimates ? " (estimations uniquement)" : ""}…`,
  );
  console.log(`OSRM_URL = ${process.env.OSRM_URL || "(vide → estimation haversine)"}`);
  const res = await rebuildAllDistances({
    onlyEstimates,
    log: (m) => console.log("  " + m),
  });
  console.log(
    `Terminé : ${res.computed} couples calculés (${res.osrm} via OSRM, ${res.estimates} estimés).`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
