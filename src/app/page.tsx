import { redirect } from "next/navigation";
import { getActor, homeForRole } from "@/lib/auth";

export default async function Home() {
  const actor = await getActor();
  if (!actor) redirect("/login");
  redirect(homeForRole(actor.role));
}
