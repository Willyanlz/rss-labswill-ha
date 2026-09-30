# Manutenção

[Voltar ao README](../README.md)

## Atualizações nos clientes

Cada tag de versão dispara testes e publica uma **GitHub Release** com o card.
O HACS consulta o repositório e disponibiliza a atualização no Home Assistant;
essa detecção não é instantânea. Instale pela entidade de atualização do HACS.

Para instalação automática de madrugada, adapte
[examples/auto-update.yaml](../examples/auto-update.yaml) em cada cliente usando o
**entity_id real** da atualização do RSS. A automação usa `update.install` somente
quando há atualização disponível. Sem essa automação, a instalação é manual.

Depois da instalação, recarregue o navegador/FreeKiosk para carregar o novo
JavaScript. Abas abertas não passam a executar código novo automaticamente.
O leitor Python e `/config/rss-feeds.json` ficam fora do ciclo de atualização HACS;
mudanças nesses arquivos precisam ser aplicadas separadamente.

Para voltar uma versão, use **Baixar novamente** no HACS, selecione uma release
anterior e recarregue o painel. Desative a automação durante o rollback.

Referências: [distribuição de cards no HACS](https://www.hacs.xyz/docs/publish/plugin/)
e [entidades de atualização](https://www.hacs.xyz/docs/use/entities/update/).

## Desenvolvimento e releases

```sh
npm ci
npx playwright install chromium
npm run build
npm run check
npm test
```

Edite `src/carousel.js` e `src/editor.js`; o bundle da raiz é gerado por
`npm run build` e deve ser commitado. O QR e as traduções existentes estão em
`src/preamble.js`, com os avisos de autoria preservados.

Para publicar: atualize `package.json`, o texto da versão no editor e o changelog,
gere o bundle, rode os testes, faça commit e envie uma tag correspondente:

```sh
git push origin main
git tag v2.1.2
git push origin v2.1.2
```

O workflow só publica se os testes passarem e a tag coincidir com `package.json`.
Mantenha o repositório público e GitHub Actions habilitado.
