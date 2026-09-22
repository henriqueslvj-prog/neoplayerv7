# WhatsApp — EsteticPro

A função `send-whatsapp` envia a confirmação de um agendamento para o número cadastrado na ficha da cliente.

## Secrets de produção

Configure no Supabase > Edge Functions > Secrets:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_VERSION`
- `WHATSAPP_TEMPLATE_NAME` (recomendado para produção)
- `WHATSAPP_TEMPLATE_LANGUAGE` (ex.: `pt_BR`)
- `WHATSAPP_ALLOW_TEXT` (`true` somente para testes compatíveis com a janela de atendimento)

As credenciais da Meta/WhatsApp nunca devem ficar no React ou no Vercel.
