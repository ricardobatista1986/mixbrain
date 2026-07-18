"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createSetProject(formData: FormData) {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims || typeof claims.sub !== "string") {
    throw new Error("Usuário não autenticado.");
  }

  const rawName = formData.get("name");
  const rawDescription = formData.get("description");
  const rawTargetDuration = formData.get("targetDurationMinutes");

  const name = typeof rawName === "string" ? rawName.trim() : "";
  const description =
    typeof rawDescription === "string" ? rawDescription.trim() : "";
  const targetDurationMinutes =
    typeof rawTargetDuration === "string" && rawTargetDuration.trim() !== ""
      ? Number(rawTargetDuration)
      : null;

  if (!name) {
    throw new Error("O nome do projeto é obrigatório.");
  }

  if (
    targetDurationMinutes !== null &&
    (!Number.isFinite(targetDurationMinutes) || targetDurationMinutes <= 0)
  ) {
    throw new Error("A duração alvo deve ser um número positivo.");
  }

  const { error } = await supabase.from("set_projects").insert({
    user_id: claims.sub,
    name,
    description: description || null,
    target_duration_minutes: targetDurationMinutes,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/app");
}