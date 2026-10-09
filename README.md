# AprovACS

PWA de estudos para Agente Comunitário de Saúde (ACS), preparada para GitHub Pages.

## Executar localmente
O app usa `fetch()` para carregar os arquivos JSON, então não abra `index.html` diretamente via `file://`.
Na pasta do projeto, execute por exemplo:
- Python: `python -m http.server 8000`
- Acesse `http://localhost:8000`

## Publicar no GitHub Pages
1. Envie todos os arquivos mantendo a estrutura de pastas.
2. Em Settings → Pages, selecione a branch e a pasta raiz (`/`).
3. Acesse a URL HTTPS publicada. O Service Worker da raiz (`service-worker.js`) exige HTTPS (ou localhost) e controla corretamente a página no GitHub Pages.

## Observações
- A data configurada para a prova é 24/01/2027 às 08:00 no fuso UTC−3.
- O progresso fica no `localStorage` do navegador/dispositivo.
- Tailwind via CDN e Google Fonts precisam de internet na primeira carga; os arquivos locais do app são armazenados pelo Service Worker. Para um offline totalmente autossuficiente, remova dependências externas ou faça build local de CSS/fontes.
- Os ícones PNG referenciados no manifest não são incluídos nesta versão. Antes de distribuir como PWA instalável com ícone personalizado, crie `src/assets/icon-192.png` e `src/assets/icon-512.png`, ou substitua os caminhos por ícones existentes.
- Conteúdo educativo inicial, para revisão e expansão. Confirme legislação consolidada, calendário PNI vigente e o edital oficial do município.
