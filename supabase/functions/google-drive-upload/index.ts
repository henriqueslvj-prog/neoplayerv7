import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SUPABASE_SECRET_KEY =
  SECRET_KEYS["default"] ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function bearer(req: Request) {
  return (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
}

async function getUser(req: Request) {
  const token = bearer(req);
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) {
    console.error("auth error:", error);
    return null;
  }
  return data.user ?? null;
}

async function googleAccessToken(userId: string) {
  const { data: refreshToken, error } = await supabaseAdmin.rpc(
    "get_google_drive_refresh_token",
    { p_user_id: userId },
  );

  if (error) throw new Error(`Vault/Google token: ${error.message}`);
  if (!refreshToken) throw new Error("A conexão com o Google Drive precisa ser refeita.");

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}

  if (!response.ok || !data.access_token) {
    console.error("Google token response:", response.status, data);
    throw new Error(
      data.error_description ||
      data.error ||
      `Google recusou o token (${response.status}). Reconecte o Google Drive.`,
    );
  }

  return data.access_token as string;
}

function q(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

async function driveRequest(
  accessToken: string,
  url: string,
  init: RequestInit = {},
) {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(url, { ...init, headers });
}

async function getOrCreateFolder(
  accessToken: string,
  name: string,
  parentId?: string,
) {
  const clauses = [
    `name = '${q(name)}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
  ];
  if (parentId) clauses.push(`'${parentId}' in parents`);

  const url = new URL("https://www.googleapis.com/drive/v3/files");
  url.searchParams.set("q", clauses.join(" and "));
  url.searchParams.set("pageSize", "10");
  url.searchParams.set("spaces", "drive");
  url.searchParams.set("fields", "files(id,name,mimeType,parents)");

  const response = await driveRequest(accessToken, url.toString());
  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch {}

  if (!response.ok) {
    console.error("Drive folder search:", response.status, data);
    throw new Error(
      data?.error?.message ||
      `Google Drive não permitiu acessar as pastas (${response.status}).`,
    );
  }

  if (data.files?.[0]) return data.files[0];

  const createResponse = await driveRequest(
    accessToken,
    "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,parents",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        ...(parentId ? { parents: [parentId] } : {}),
      }),
    },
  );

  const createRaw = await createResponse.text();
  let created: any = {};
  try { created = createRaw ? JSON.parse(createRaw) : {}; } catch {}

  if (!createResponse.ok) {
    console.error("Drive folder create:", createResponse.status, created);
    throw new Error(
      created?.error?.message ||
      `Google Drive não permitiu criar a pasta (${createResponse.status}).`,
    );
  }

  return created;
}

/**
 * Usa upload resumable em vez de multipart/related.
 * É mais tolerante a imagens e permite diagnosticar
 * exatamente a resposta do Google.
 */
async function uploadResumable(
  accessToken: string,
  file: File,
  name: string,
  parentId: string,
) {
  const metadata = {
    name,
    parents: [parentId],
  };

  const initResponse = await driveRequest(
    accessToken,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType,size",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.type,
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify(metadata),
    },
  );

  const initRaw = await initResponse.text();

  if (!initResponse.ok) {
    let detail: any = {};
    try { detail = initRaw ? JSON.parse(initRaw) : {}; } catch {}
    console.error("Drive resumable init:", initResponse.status, detail);
    throw new Error(
      detail?.error?.message ||
      `Google Drive recusou o início do upload (${initResponse.status}).`,
    );
  }

  const uploadUrl = initResponse.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("Google Drive não retornou a URL de upload.");
  }

  const bytes = await file.arrayBuffer();

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
      "Content-Length": String(file.size),
    },
    body: bytes,
  });

  const uploadRaw = await uploadResponse.text();
  let result: any = {};
  try { result = uploadRaw ? JSON.parse(uploadRaw) : {}; } catch {}

  if (!uploadResponse.ok) {
    console.error("Drive resumable upload:", uploadResponse.status, result, uploadRaw);
    throw new Error(
      result?.error?.message ||
      `Google Drive recusou a imagem (${uploadResponse.status}).`,
    );
  }

  if (!result.id) throw new Error("Google Drive concluiu o upload sem retornar o ID do arquivo.");
  return result;
}

async function deleteDriveFile(accessToken: string, fileId: string) {
  try {
    await driveRequest(
      accessToken,
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
      { method: "DELETE" },
    );
  } catch (e) {
    console.error("delete orphan:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) throw new Error("Configuração do Supabase incompleta.");
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_SECRET não configurado na Edge Function.");
    }

    const user = await getUser(req);
    if (!user) return json({ error: "Sessão inválida ou expirada. Faça login novamente." }, 401);

    const contentType = req.headers.get("Content-Type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return json({ error: "O upload precisa usar multipart/form-data." }, 400);
    }

    const form = await req.formData();
    const evolutionId = String(form.get("evolution_id") || "").trim();
    const photoType = String(form.get("photo_type") || "adicional").trim();
    const file = form.get("file");

    if (!evolutionId) return json({ error: "ID da evolução não informado." }, 400);
    if (!["antes", "depois", "adicional"].includes(photoType)) {
      return json({ error: "Tipo de foto inválido." }, 400);
    }
    if (!(file instanceof File)) return json({ error: "Nenhuma imagem foi enviada." }, 400);

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      return json({ error: "Formato não permitido. Use JPG, PNG ou WEBP." }, 400);
    }
    if (file.size > 15 * 1024 * 1024) {
      return json({ error: "Cada imagem deve ter no máximo 15 MB." }, 400);
    }

    const { data: evolution, error: evoError } = await supabaseAdmin
      .from("client_evolutions")
      .select("id,user_id,client_id")
      .eq("id", evolutionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (evoError) throw new Error(`Erro ao validar evolução: ${evoError.message}`);
    if (!evolution) return json({ error: "A evolução não pertence ao usuário autenticado." }, 403);

    const { data: connection, error: connError } = await supabaseAdmin
      .from("google_drive_connections")
      .select("root_folder_id,google_account_email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connError) throw new Error(`Erro ao consultar Google Drive: ${connError.message}`);
    if (!connection?.root_folder_id) {
      return json({
        error: "A conexão do Google Drive não possui a pasta EsteticPro. Clique em Reconectar para recriar a conexão.",
      }, 400);
    }

    const accessToken = await googleAccessToken(user.id);

    const clientsFolder = await getOrCreateFolder(accessToken, "Clientes", connection.root_folder_id);
    const clientFolder = await getOrCreateFolder(
      accessToken,
      `Cliente-${evolution.client_id}`,
      clientsFolder.id,
    );
    const evolutionFolder = await getOrCreateFolder(
      accessToken,
      `Evolucao-${evolution.id}`,
      clientFolder.id,
    );

    const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const base = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9À-ÿ_-]+/g, "-")
      .slice(0, 70) || "foto";

    const fileName = `${photoType.toUpperCase()}-${Date.now()}-${base}.${ext}`;

    const driveFile = await uploadResumable(
      accessToken,
      file,
      fileName,
      evolutionFolder.id,
    );

    const { data: photo, error: photoError } = await supabaseAdmin
      .from("evolution_photos")
      .insert({
        evolution_id: evolution.id,
        user_id: user.id,
        photo_type: photoType,
        drive_file_id: driveFile.id,
        file_name: fileName,
        mime_type: file.type,
        file_size: file.size,
      })
      .select()
      .single();

    if (photoError) {
      await deleteDriveFile(accessToken, driveFile.id);
      throw new Error(`A imagem foi enviada ao Drive, mas não foi registrada no EsteticPro: ${photoError.message}`);
    }

    return json({
      success: true,
      photo: {
        id: photo.id,
        drive_file_id: driveFile.id,
        file_name: fileName,
        mime_type: file.type,
        file_size: file.size,
        photo_type: photoType,
      },
    });
  } catch (error) {
    console.error("google-drive-upload:", error);
    return json({
      error: error instanceof Error ? error.message : "Não foi possível enviar a imagem para o Google Drive.",
    }, 500);
  }
});
