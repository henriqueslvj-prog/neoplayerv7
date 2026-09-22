import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Usuário não autenticado." }, 401);

    const jwt = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const graphVersion = Deno.env.get("WHATSAPP_GRAPH_VERSION");
    const templateName = Deno.env.get("WHATSAPP_TEMPLATE_NAME");
    const templateLanguage = Deno.env.get("WHATSAPP_TEMPLATE_LANGUAGE") || "pt_BR";
    const allowText = Deno.env.get("WHATSAPP_ALLOW_TEXT") === "true";

    if (!supabaseUrl || !publishableKey) return json({ error: "Configuração do Supabase da Edge Function não encontrada." }, 500);
    if (!accessToken || !phoneNumberId || !graphVersion) {
      return json({ error: "WhatsApp ainda não configurado. Cadastre WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID e WHATSAPP_GRAPH_VERSION nos Secrets da Edge Function." }, 503);
    }

    const supabase = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

    const body = await req.json();
    const appointmentId = body?.appointment_id;
    if (!appointmentId) return json({ error: "appointment_id é obrigatório." }, 400);

    const { data: appointment, error: appointmentError } = await supabase
      .from("appointments")
      .select("id, user_id, client_id, appointment_date, start_time, procedure_name, status")
      .eq("id", appointmentId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (appointmentError) return json({ error: appointmentError.message }, 400);
    if (!appointment) return json({ error: "Agendamento não encontrado." }, 404);

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("id, full_name, phone")
      .eq("id", appointment.client_id)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (clientError) return json({ error: clientError.message }, 400);
    if (!client) return json({ error: "Cliente não encontrada." }, 404);
    if (!client.phone) return json({ error: "A cliente não possui telefone cadastrado." }, 400);

    const to = normalizeBrazilPhone(client.phone);
    if (!to) return json({ error: "O telefone cadastrado não parece ser um número brasileiro válido." }, 400);

    const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(`${appointment.appointment_date}T12:00:00-03:00`));
    const time = String(appointment.start_time).slice(0, 5);
    const procedure = appointment.procedure_name || "atendimento";
    const firstName = String(client.full_name).trim().split(/\s+/)[0] || "Olá";
    const text = `Olá, ${firstName}! Tudo bem? Seu ${procedure} está marcado para ${date} às ${time}. Se precisar remarcar, fale conosco por aqui.`;

    let payload: Record<string, unknown>;
    if (templateName) {
      payload = {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: templateLanguage },
          components: [{ type: "body", parameters: [
            { type: "text", text: firstName },
            { type: "text", text: date },
            { type: "text", text: time },
            { type: "text", text: procedure },
          ] }],
        },
      };
    } else if (allowText) {
      payload = { messaging_product: "whatsapp", to, type: "text", text: { preview_url: false, body: text } };
    } else {
      return json({ error: "Defina WHATSAPP_TEMPLATE_NAME para mensagens de confirmação em produção, ou WHATSAPP_ALLOW_TEXT=true apenas para testes compatíveis com a janela de atendimento do WhatsApp." }, 503);
    }

    const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      await supabase.from("appointments").update({ whatsapp_status: "erro" }).eq("id", appointment.id).eq("user_id", userData.user.id);
      return json({ error: result?.error?.message || "A API do WhatsApp recusou o envio." }, 502);
    }

    const messageId = result?.messages?.[0]?.id || null;
    await supabase.from("appointments").update({ whatsapp_status: "enviado", whatsapp_sent_at: new Date().toISOString(), whatsapp_message_id: messageId }).eq("id", appointment.id).eq("user_id", userData.user.id);
    return json({ ok: true, message_id: messageId });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Erro inesperado ao enviar WhatsApp." }, 500);
  }
});

function normalizeBrazilPhone(value: string) {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
