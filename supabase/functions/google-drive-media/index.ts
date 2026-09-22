import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SECRET_KEYS = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const SUPABASE_SECRET_KEY = SECRET_KEYS["default"] || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "Content-Type, Content-Length, Content-Disposition, Cache-Control",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function getUser(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) {
    console.error("google-drive-media: erro ao validar usuário:", error);
    return null;
  }

  return data.user || null;
}

async function getAccessToken(refreshToken: string) {
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

  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }

  if (!response.ok || !data.access_token) {
    console.error("google-drive-media: erro ao renovar token:", data);
    throw new Error(data.error_description || data.error || "A conexão com o Google Drive precisa ser refeita.");
  }

  return data.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
    if (!SUPABASE_URL || !SUPABASE_SECRET_KEY || !GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error("Configuração da integração com Google Drive incompleta na Edge Function.");
    }

    const user = await getUser(req);
    if (!user) return json({ error: "Sessão inválida ou expirada." }, 401);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Requisição inválida." }, 400);
    }

    const fileId = String(body?.file_id || "").trim();
    if (!fileId) return json({ error: "Arquivo ausente." }, 400);

    // Confirma que o arquivo pertence a uma evolução do usuário autenticado.
    const { data: photo, error: photoError } = await supabaseAdmin
      .from("evolution_photos")
      .select("id, drive_file_id, file_name, mime_type")
      .eq("user_id", user.id)
      .eq("drive_file_id", fileId)
      .maybeSingle();

    if (photoError) {
      console.error("google-drive-media: erro ao consultar foto:", photoError);
      return json({ error: "Não foi possível validar a foto no EsteticPro." }, 500);
    }

    if (!photo) return json({ error: "Arquivo não pertence ao usuário autenticado." }, 403);

    const { data: connection, error: connectionError } = await supabaseAdmin
      .from("google_drive_connections")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (connectionError) {
      console.error("google-drive-media: erro ao consultar conexão:", connectionError);
      return json({ error: "Não foi possível verificar a conexão com o Google Drive." }, 500);
    }

    if (!connection) return json({ error: "Google Drive não conectado." }, 400);

    const { data: refreshToken, error: tokenError } = await supabaseAdmin.rpc(
      "get_google_drive_refresh_token",
      { p_user_id: user.id },
    );

    if (tokenError) {
      console.error("google-drive-media: erro ao obter refresh token:", tokenError);
      return json({ error: "Não foi possível acessar a conexão segura do Google Drive." }, 500);
    }

    if (!refreshToken) return json({ error: "A conexão com o Google Drive precisa ser refeita." }, 400);

    const accessToken = await getAccessToken(refreshToken);

    const driveResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );

    if (!driveResponse.ok) {
      const text = await driveResponse.text();
      let detail: any = {};
      try { detail = text ? JSON.parse(text) : {}; } catch { detail = {}; }

      console.error("google-drive-media: erro Google Drive:", {
        status: driveResponse.status,
        detail,
        fileId,
      });

      if (driveResponse.status === 401 || driveResponse.status === 403) {
        return json({ error: "O Google Drive recusou o acesso a esta imagem. Reconecte o Google Drive." }, driveResponse.status);
      }

      if (driveResponse.status === 404) {
        return json({ error: "Esta imagem não foi encontrada no Google Drive." }, 404);
      }

      return json({ error: detail?.error?.message || "Não foi possível carregar a imagem do Google Drive." }, 502);
    }

    const contentType =
      driveResponse.headers.get("Content-Type") ||
      photo.mime_type ||
      "application/octet-stream";

    const headers = new Headers(corsHeaders);
    // application/octet-stream é intencional: o supabase-js interpreta essa resposta como Blob.
    headers.set("Content-Type", "application/octet-stream");
    headers.set("X-EsteticPro-Mime-Type", contentType);
    headers.set("Cache-Control", "private, max-age=300");
    headers.set("Content-Disposition", `inline; filename="${(photo.file_name || "imagem").replace(/["\\\r\n]/g, "_")}"`);

    const contentLength = driveResponse.headers.get("Content-Length");
    if (contentLength) headers.set("Content-Length", contentLength);

    return new Response(driveResponse.body, { status: 200, headers });
  } catch (error) {
    console.error("google-drive-media: erro inesperado:", error);
    return json({
      error: error instanceof Error ? error.message : "Erro ao carregar imagem.",
    }, 500);
  }
});
