import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * EsteticPro — Google Drive OAuth
 *
 * Fluxo:
 * 1. Frontend chama POST /functions/v1/google-drive-auth com o JWT do usuário.
 * 2. A função valida o JWT e cria um OAuth state de uso único.
 * 3. Retorna a authorization_url do Google.
 * 4. O Google chama esta mesma função no callback.
 * 5. O callback valida o state, troca o code por tokens, cria/reutiliza
 *    as pastas do EsteticPro e grava o refresh token no Supabase Vault.
 * 6. O callback redireciona para o frontend da Vercel.
 *
 * IMPORTANTE:
 * - Não coloque GOOGLE_CLIENT_SECRET no frontend.
 * - Não coloque access_token/refresh_token na URL.
 * - A verificação JWT automática da Edge Function deve estar DESATIVADA
 *   no Dashboard do Supabase, porque o callback do Google não possui JWT.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";

function parseKeyMap(value: string | undefined): Record<string, string> {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.error("Não foi possível interpretar as chaves automáticas do Supabase:", error);
    return {};
  }
}

const SECRET_KEYS = parseKeyMap(Deno.env.get("SUPABASE_SECRET_KEYS"));
const PUBLISHABLE_KEYS = parseKeyMap(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS"));

// Preferência atual: sb_secret_... / sb_publishable_...
// Fallback apenas para as variáveis legadas que o Supabase pode disponibilizar.
const SUPABASE_SECRET_KEY =
  SECRET_KEYS["default"] ||
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
  "";

const SUPABASE_PUBLISHABLE_KEY =
  PUBLISHABLE_KEYS["default"] ||
  Deno.env.get("SUPABASE_ANON_KEY") ||
  "";

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID") ?? "";
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? "";
const GOOGLE_REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI") ?? "";

const FRONTEND_URL = "https://estetipro.vercel.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": FRONTEND_URL,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
};

const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

function generateState() {
  return `${crypto.randomUUID()}-${crypto.randomUUID()}`;
}

function callbackRedirect(
  success: boolean,
  message: string,
  email?: string,
) {
  const redirectUrl = new URL(FRONTEND_URL);

  redirectUrl.searchParams.set(
    "google_drive_callback",
    success ? "success" : "error",
  );

  // Não enviamos tokens ou credenciais por URL.
  redirectUrl.searchParams.set("message", message);

  if (email) {
    redirectUrl.searchParams.set("email", email);
  }

  return Response.redirect(redirectUrl.toString(), 302);
}

function assertConfiguration() {
  const missing: string[] = [];

  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SECRET_KEY) missing.push("SUPABASE_SECRET_KEYS/default");
  if (!SUPABASE_PUBLISHABLE_KEY) missing.push("SUPABASE_PUBLISHABLE_KEYS/default");
  if (!GOOGLE_CLIENT_ID) missing.push("GOOGLE_CLIENT_ID");
  if (!GOOGLE_CLIENT_SECRET) missing.push("GOOGLE_CLIENT_SECRET");
  if (!GOOGLE_REDIRECT_URI) missing.push("GOOGLE_REDIRECT_URI");

  if (missing.length > 0) {
    throw new Error(`Configuração ausente na Edge Function: ${missing.join(", ")}`);
  }
}

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SECRET_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

/**
 * Cria ou reutiliza uma pasta que pertence ao aplicativo.
 *
 * Com drive.file, o EsteticPro consegue trabalhar com os arquivos/pastas
 * que ele próprio criou ou que foram disponibilizados ao aplicativo.
 */
async function getOrCreateFolder(
  accessToken: string,
  name: string,
  parentId?: string,
) {
  // Escape simples para a sintaxe de query do Drive.
  const escapedName = name.replaceAll("'", "\\'");

  const queryParts = [
    `name = '${escapedName}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
  ];

  if (parentId) {
    queryParts.push(`'${parentId}' in parents`);
  }

  const searchUrl = new URL("https://www.googleapis.com/drive/v3/files");
  searchUrl.searchParams.set("q", queryParts.join(" and "));
  searchUrl.searchParams.set("pageSize", "10");
  searchUrl.searchParams.set("spaces", "drive");
  searchUrl.searchParams.set("fields", "files(id,name,mimeType,parents)");

  const searchResponse = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const searchText = await searchResponse.text();
  let searchData: any = {};

  try {
    searchData = searchText ? JSON.parse(searchText) : {};
  } catch {
    searchData = {};
  }

  if (!searchResponse.ok) {
    console.error("Google Drive folder search error:", searchData);
    throw new Error(
      searchData?.error?.message ||
        "Não foi possível verificar as pastas do Google Drive.",
    );
  }

  if (Array.isArray(searchData.files) && searchData.files.length > 0) {
    return searchData.files[0];
  }

  const metadata: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const createResponse = await fetch(
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(metadata),
    },
  );

  const createText = await createResponse.text();
  let createData: any = {};

  try {
    createData = createText ? JSON.parse(createText) : {};
  } catch {
    createData = {};
  }

  if (!createResponse.ok) {
    console.error("Google Drive folder creation error:", createData);
    throw new Error(
      createData?.error?.message ||
        "Não foi possível criar a pasta no Google Drive.",
    );
  }

  return createData;
}

async function exchangeGoogleCode(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const text = await response.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    console.error("Google token exchange error:", data);
    throw new Error(
      data?.error_description ||
        data?.error ||
        "Não foi possível obter os tokens do Google.",
    );
  }

  return data;
}

async function getGoogleUser(accessToken: string) {
  const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const text = await response.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    console.error("Google userinfo error:", data);
    throw new Error(
      data?.error_description ||
        data?.error ||
        "Não foi possível identificar a conta Google.",
    );
  }

  return data;
}

async function validateUserJwt(token: string) {
  // Cliente somente para validar o JWT do usuário.
  // A chave publishable/anon nunca recebe privilégios administrativos.
  const supabaseUser = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const { data, error } = await supabaseUser.auth.getUser(token);

  if (error || !data.user) {
    console.error("Supabase JWT validation error:", error);
    throw new Error("Sessão do usuário inválida ou expirada.");
  }

  return data.user;
}

async function createOAuthState(userId: string) {
  const state = generateState();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin
    .from("google_drive_oauth_states")
    .insert({
      user_id: userId,
      state,
      expires_at: expiresAt,
    });

  if (error) {
    console.error("Erro ao criar OAuth state:", error);
    throw new Error(
      "Não foi possível iniciar a conexão com o Google Drive.",
    );
  }

  return state;
}

function buildGoogleAuthorizationUrl(state: string) {
  const googleUrl = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth",
  );

  googleUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  googleUrl.searchParams.set("redirect_uri", GOOGLE_REDIRECT_URI);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", GOOGLE_SCOPES);
  googleUrl.searchParams.set("access_type", "offline");
  googleUrl.searchParams.set("prompt", "consent");
  googleUrl.searchParams.set("state", state);
  googleUrl.searchParams.set("include_granted_scopes", "true");

  return googleUrl.toString();
}

/**
 * Processa o retorno do Google.
 */
async function handleGoogleCallback(url: URL) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");

  if (oauthError) {
    console.warn("Google OAuth cancelado/negado:", {
      error: oauthError,
      description: oauthErrorDescription,
    });

    return callbackRedirect(
      false,
      oauthErrorDescription || "A autorização do Google Drive foi cancelada.",
    );
  }

  if (!code || !state) {
    return callbackRedirect(false, "Resposta OAuth incompleta.");
  }

  let oauthState: any = null;

  try {
    const { data, error } = await supabaseAdmin
      .from("google_drive_oauth_states")
      .select("id,user_id,state,expires_at")
      .eq("state", state)
      .maybeSingle();

    if (error) {
      console.error("Erro ao consultar OAuth state:", error);
      throw new Error("Não foi possível validar a autorização.");
    }

    oauthState = data;

    if (!oauthState) {
      throw new Error("A autorização expirou ou não é válida.");
    }

    if (new Date(oauthState.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from("google_drive_oauth_states")
        .delete()
        .eq("id", oauthState.id);

      throw new Error("A autorização expirou. Tente conectar novamente.");
    }

    const userId = oauthState.user_id;

    // O state é consumido em qualquer caminho após sua validação.
    // Isso impede reutilização do mesmo callback.
    const consumeState = async () => {
      await supabaseAdmin
        .from("google_drive_oauth_states")
        .delete()
        .eq("id", oauthState.id);
    };

    const googleTokens = await exchangeGoogleCode(code);

    if (!googleTokens.access_token) {
      throw new Error("O Google não retornou um access token.");
    }

    const googleUser = await getGoogleUser(googleTokens.access_token);

    if (!googleUser.sub) {
      throw new Error("O Google não retornou um identificador de conta válido.");
    }

    if (!googleUser.email) {
      throw new Error("Não foi possível obter o e-mail da conta Google.");
    }

    /**
     * Cria/reutiliza a estrutura:
     *
     * EsteticPro/
     *   Clientes/
     *
     * A partir daqui, os arquivos das evoluções poderão ser criados
     * pelo backend dentro dessas pastas.
     */
    const rootFolder = await getOrCreateFolder(
      googleTokens.access_token,
      "EsteticPro",
    );

    if (!rootFolder?.id) {
      throw new Error("O Google não retornou o ID da pasta EsteticPro.");
    }

    const clientsFolder = await getOrCreateFolder(
      googleTokens.access_token,
      "Clientes",
      rootFolder.id,
    );

    if (!clientsFolder?.id) {
      throw new Error("O Google não retornou o ID da pasta Clientes.");
    }

    /**
     * Salva o refresh token somente no Vault.
     *
     * No reconnect, o Google pode não devolver um novo refresh_token.
     * Nesse caso, o token existente permanece no Vault.
     */
    if (googleTokens.refresh_token) {
      const { error: vaultError } = await supabaseAdmin.rpc(
        "store_google_drive_refresh_token_backend",
        {
          p_user_id: userId,
          p_refresh_token: googleTokens.refresh_token,
        },
      );

      if (vaultError) {
        console.error("Erro ao salvar refresh token no Vault:", vaultError);
        throw new Error(
          "Não foi possível proteger a conexão com o Google Drive.",
        );
      }
    }

    const { error: connectionError } = await supabaseAdmin
      .from("google_drive_connections")
      .upsert(
        {
          user_id: userId,
          google_account_email: googleUser.email,
          google_subject_id: googleUser.sub,
          root_folder_id: rootFolder.id,
          root_folder_name: rootFolder.name || "EsteticPro",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

    if (connectionError) {
      console.error("Erro ao salvar conexão:", connectionError);
      throw new Error(
        "A conta foi autorizada, mas não conseguimos salvar a conexão no EsteticPro.",
      );
    }

    await consumeState();

    console.log(
      `Google Drive conectado para usuário ${userId} / conta ${googleUser.email}`,
    );

    return callbackRedirect(
      true,
      `Conta ${googleUser.email} conectada com sucesso.`,
      googleUser.email,
    );
  } catch (error) {
    console.error("Erro no callback Google Drive:", error);

    if (oauthState?.id) {
      await supabaseAdmin
        .from("google_drive_oauth_states")
        .delete()
        .eq("id", oauthState.id);
    }

    return callbackRedirect(
      false,
      errorMessage(error, "Erro inesperado ao conectar o Google Drive."),
    );
  }
}

/**
 * Inicia o OAuth a partir do EsteticPro.
 */
async function handleOAuthStart(req: Request) {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    return json(
      {
        error: "Autenticação necessária para conectar o Google Drive.",
      },
      401,
    );
  }

  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  if (!token) {
    return json(
      { error: "Token de autenticação ausente." },
      401,
    );
  }

  const user = await validateUserJwt(token);
  const state = await createOAuthState(user.id);
  const authorizationUrl = buildGoogleAuthorizationUrl(state);

  return json({
    authorization_url: authorizationUrl,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    assertConfiguration();

    const url = new URL(req.url);

    // O callback do Google sempre chega com code/state ou error.
    const isGoogleCallback =
      url.searchParams.has("code") ||
      url.searchParams.has("state") ||
      url.searchParams.has("error");

    if (isGoogleCallback) {
      return await handleGoogleCallback(url);
    }

    // O frontend usa POST para iniciar a conexão.
    if (req.method !== "POST") {
      return json(
        {
          error: "Método não permitido. Use POST para iniciar a conexão.",
        },
        405,
      );
    }

    return await handleOAuthStart(req);
  } catch (error) {
    console.error("Erro geral na função google-drive-auth:", error);

    return json(
      {
        error: errorMessage(
          error,
          "Erro inesperado na integração com o Google Drive.",
        ),
      },
      500,
    );
  }
});
