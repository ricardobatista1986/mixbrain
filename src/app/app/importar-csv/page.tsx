import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ImportarCsvClientPage from "./page-client";

export default async function ImportarCsvPage() {
  const supabase = await createClient();

  const { data: authData } = await supabase.auth.getClaims();
  const claims = authData?.claims ?? null;

  if (!claims) {
    redirect("/login");
  }

  const { data: projects, error } = await supabase
    .from("set_projects")
    .select("id, name")
    .eq("user_id", claims.sub)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return <ImportarCsvClientPage projects={projects ?? []} />;
}
