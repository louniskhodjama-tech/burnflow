/**
 * Point d'entrée d'instrumentation Next. Le corps réel (migrations au boot,
 * jobs périodiques) vit dans instrumentation-node.ts, importé uniquement dans
 * le runtime Node — la condition sur NEXT_RUNTIME est résolue à la compilation,
 * ce qui évite d'entraîner web-push/pg dans le bundle edge.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
