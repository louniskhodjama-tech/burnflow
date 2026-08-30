import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export async function POST() {
  await destroySession();
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return NextResponse.redirect(`${base}/login`, 303);
}
