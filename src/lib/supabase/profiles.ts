import type { User } from "@supabase/supabase-js";
import { supabaseClient } from "./client";
import type { Profile } from "./types";

export type EnsureProfileResult = {
  profile: Profile;
  source: "id" | "created";
};

type ProfileRow = {
  id: string;
  email: string;
};

function logSupabaseError(context: string, error: unknown) {
  const details =
    error && typeof error === "object"
      ? {
          message: "message" in error ? error.message : undefined,
          code: "code" in error ? error.code : undefined,
          details: "details" in error ? error.details : undefined,
          hint: "hint" in error ? error.hint : undefined,
        }
      : { message: String(error) };

  console.error(`[Supabase][profiles] ${context}`, details);
}

async function selectProfileById(userId: string) {
  const requestDescription = {
    table: "profiles",
    action: "select",
    columns: ["id", "email"],
    filter: {
      id: `eq.${userId}`,
    },
    userId,
    userIdType: typeof userId,
  };

  console.info("[Supabase][profiles] Avant SELECT par id", requestDescription);

  const result = await supabaseClient
    .from("profiles")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();

  console.info("[Supabase][profiles] Resultat SELECT par id", {
    request: requestDescription,
    hasData: Boolean(result.data),
    error: result.error
      ? {
          message: result.error.message,
          code: result.error.code,
          details: result.error.details,
          hint: result.error.hint,
        }
      : null,
  });

  return result;
}

async function insertProfile(user: User) {
  const payload = {
    id: user.id,
    email: user.email ?? "",
  };

  console.info("[Supabase][profiles] Avant INSERT", payload);

  const result = await supabaseClient.from("profiles").insert(payload);

  if (result.error) {
    logSupabaseError("Erreur INSERT profiles", result.error);
  } else {
    console.info("[Supabase][profiles] INSERT reussi", payload);
  }

  return {
    result,
    payload,
  };
}

function mapProfileRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
  };
}

export async function ensureCurrentUserProfile(user: User): Promise<EnsureProfileResult> {
  console.info("[Supabase][profiles] Synchronisation profile demarree", {
    userId: user.id,
    email: user.email ?? null,
  });

  const initialSelect = await selectProfileById(user.id);

  if (initialSelect.error) {
    logSupabaseError("SELECT initial par id echoue", initialSelect.error);
    throw initialSelect.error;
  }

  if (initialSelect.data) {
    const profile = mapProfileRow(initialSelect.data as ProfileRow);

    console.info("[Supabase][profiles] Resultat final: profile existant", {
      userId: user.id,
      profileId: profile.id,
      email: profile.email,
    });

    return {
      profile,
      source: "id",
    };
  }

  const { result: insertResult, payload } = await insertProfile(user);

  if (insertResult.error) {
    throw insertResult.error;
  }

  const finalSelect = await selectProfileById(user.id);

  if (finalSelect.error) {
    logSupabaseError("SELECT final apres INSERT echoue", finalSelect.error);
    throw finalSelect.error;
  }

  if (!finalSelect.data) {
    const error = new Error("Le profile n'a pas ete retrouve apres l'insertion.");
    logSupabaseError("Resultat final vide apres INSERT", error);
    throw error;
  }

  const profile = mapProfileRow(finalSelect.data as ProfileRow);

  console.info("[Supabase][profiles] Resultat final: profile cree", {
    userId: user.id,
    profileId: profile.id,
    email: profile.email,
    insertedEmail: payload.email,
  });

  return {
    profile,
    source: "created",
  };
}
