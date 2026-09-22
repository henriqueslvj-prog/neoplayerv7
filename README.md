# EsteticPro 1.2 — Evolução + Google Drive

Versão consolidada do projeto com:

- autenticação Supabase;
- clientes;
- agenda diária/mensal;
- financeiro;
- módulo Evolução;
- conexão Google Drive por profissional;
- OAuth com state de uso único;
- refresh token protegido no Supabase Vault;
- upload privado das fotos no Drive da profissional;
- visualização das fotos dentro do EsteticPro;
- seleção robusta de clientes no módulo Evolução;
- retorno do OAuth para o domínio da Vercel.

## Deploy frontend

Substitua `src/App.jsx` e `src/styles.css` no repositório e faça o deploy no Vercel.

## Supabase

O SQL atualizado está em `supabase/evolution.sql`.

As Edge Functions ficam em:

- `google-drive-auth`
- `google-drive-upload`
- `google-drive-media`
- `send-whatsapp`

Para `google-drive-auth`, `google-drive-upload` e `google-drive-media`, o JWT automático deve permanecer desligado porque as funções fazem a validação do usuário de forma explícita.

## Secrets Google

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`

Redirect URI:

`https://siceqyfkqafjrwkcacin.supabase.co/functions/v1/google-drive-auth`
