# NeoPlayer v7

Versão de reprodução otimizada do NeoPlayer.

## Correção principal
A versão anterior fazia `arrayBuffer()` no proxy para filmes, episódios e segmentos. Isso obrigava a Vercel a baixar o conteúdo inteiro antes de entregá-lo ao navegador, causando falhas e lentidão.

A v7 transmite o corpo da resposta em streaming (`Readable.fromWeb(...).pipe(res)`), preservando `Range`, `Content-Range`, `Content-Length` e `Accept-Ranges` quando fornecidos pelo servidor de origem.

Também mantém a reescrita de manifests HLS e URLs de segmentos pelo proxy.

## Estrutura
- `api/xtream.js` — chamadas à API Xtream
- `api/proxy.js` — proxy de mídia/HLS com streaming
- `src/main.jsx` — interface e player
