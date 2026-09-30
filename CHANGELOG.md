# Changelog

## 2.1.1 — 2026-09-30

- Removido o texto de status abaixo dos controles; mantidos os rótulos acessíveis do botão play/pause.
- Créditos ao autor original suxlala e link para RSS News Card no README exibido pelo HACS.
- Leitor distribuído sem feeds predefinidos, com instruções em português e inglês.
- Exemplos de configuração genéricos para cada instalação cadastrar suas próprias fontes.

## 2.1.0 — 2026-09-30

- Controles de 44 px com ícones vetoriais, foco visível e feedback de reprodução.
- Retomada por inatividade após toque, setas, swipe, mouse e foco.
- Pausa temporária configurável; `pause_timeout: 0` mantém pausa permanente.
- Play funciona mesmo com `autoplay: false` (início pausado).
- Atualizações dos sensores não adiam indefinidamente a próxima notícia.
- Limpeza de temporizadores ao sair do painel e fallback do leitor após 15 s.
- Distribuição HACS, exemplos de sensores e atualização, testes e releases por tag.

## Origem

Evolução da personalização local LabsWill 2.0.1, mantendo o tipo
`custom:rss-news-card`, o editor e o gerador QR incorporados.
