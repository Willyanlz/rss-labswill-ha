# RSS LabsWill HA

**Notícias no seu painel. Leitura no seu ritmo.**

Carrossel RSS para Home Assistant, pensado para tablets e painéis de automação:
controles confortáveis ao toque, notícias alternadas entre fontes, leitor integrado
e QR Code para continuar no celular.

Esta é uma personalização do **[RSS News Card for Home Assistant](https://github.com/suxlala/rss-news-card)**,
criado por **[suxlala](https://github.com/suxlala)**. Os créditos pelo projeto original
são de seu autor; a LabsWill mantém as adaptações do carrossel, controles e leitor.

![Prévia do card](docs/preview.png)

[Instalar pelo HACS](https://my.home-assistant.io/redirect/hacs_repository/?owner=Willyanlz&repository=rss-labswill-ha&category=plugin)
 · [Versões](https://github.com/Willyanlz/rss-labswill-ha/releases)
 · [Changelog](CHANGELOG.md)
 · [Reportar problema](https://github.com/Willyanlz/rss-labswill-ha/issues)

## Instalação

Requer Home Assistant com HACS e navegador atualizado. Este repositório é um
**Dashboard / Lovelace card**, não um add-on nem uma integração de sensores.

1. No HACS, abra o menu **⋮ → Repositórios personalizados**.
2. Informe `https://github.com/Willyanlz/rss-labswill-ha` e selecione **Dashboard**
   (em versões antigas, **Lovelace / Plugin**).
3. Localize **RSS LabsWill HA**, baixe a versão e recarregue o painel.
4. Confira em **Configurações → Painéis → Recursos** (modo avançado):
   `/hacsfiles/rss-labswill-ha/rss-labswill-ha.js`, tipo **Módulo JavaScript**.
   Se o HACS já criou o recurso, não o duplique.
5. Configure os sensores abaixo e adicione um cartão manual usando o exemplo.

### Migrando a personalização antiga

O tipo continua sendo `custom:rss-news-card`, preservando o YAML dos dashboards.
Remova o recurso antigo `/local/community/rss-news-card/rss-news-card.js` (ou
equivalente `/hacsfiles/rss-news-card/...`) da lista de recursos e mantenha somente
o novo. Se o card original estiver instalado pelo HACS, remova-o também: os dois
registram o mesmo componente. Guarde uma cópia do antigo antes de migrar.
Recarregue completamente os navegadores dos painéis após a troca.

### Sensores RSS

O HACS instala o JavaScript; **não cria sensores nem instala o leitor Python**.
Se você já tem sensores com o atributo `articles`, pode continuar usando-os.

Em uma instalação nova:

1. Copie [scripts/fetch-rss.py](scripts/fetch-rss.py) para `/config/scripts/fetch-rss.py`.
2. Cadastre seus feeds em `FEEDS` no leitor ou em `/config/rss-feeds.json`, conforme
   o exemplo abaixo. O leitor é distribuído sem fontes predefinidas, com instruções PT-BR/EN.
3. Mescle [examples/sensors.yaml](examples/sensors.yaml) no `configuration.yaml`,
   usando o mesmo identificador de feed que você cadastrou.
4. Verifique a configuração e reinicie o Home Assistant.
5. Confirme os IDs reais dos sensores nas Ferramentas de desenvolvedor. Os IDs
   podem ter sufixos se entidades com esses nomes já existirem.

O leitor usa somente a biblioteca padrão do Python 3, disponível no HAOS.
Para configurar outras fontes sem editar o leitor, crie `/config/rss-feeds.json`:

```json
{
  "minha_fonte": "https://exemplo.com/feed.xml",
  "outra_fonte": "https://example.com/rss.xml"
}
```

Use `python3 /config/scripts/fetch-rss.py minha_fonte` no sensor. Substitua os
endereços ilustrativos acima pelos feeds desejados. O leitor suporta RSS XML
com itens `item`, não Atom; retorna até 20 notícias por fonte. A atualidade
das notícias depende do feed. Os portais podem mudar URLs ou bloquear requisições.

## Seu primeiro card

```yaml
type: custom:rss-news-card
title: Notícias
autoplay: true
slide_interval: 8
interaction_timeout: 20
pause_timeout: 60
max_articles: 20
show_description: false
show_source: true
show_date: true
image_fit: contain
sources:
  - entity: sensor.noticias_minha_fonte
    name: Minha Fonte
  - entity: sensor.noticias_outra_fonte
    name: Outra Fonte
```

O card ordena as notícias dentro de cada fonte, alterna as fontes e remove links
repetidos. Se uma fonte tiver poucos itens, as outras preenchem as vagas.

## Reprodução e interação

| Ação | Comportamento |
| --- | --- |
| Sem interação | Avança a cada `slide_interval` segundos e volta ao primeiro item no fim. |
| Setas, swipe, teclado, movimento do mouse ou foco | Aguarda `interaction_timeout` sem interação e volta a avançar. Foco ou mouse parado não travam a reprodução. |
| Pausa | Retoma após `pause_timeout` sem interação, seguido de um intervalo completo de leitura. |
| Play | Retoma com um intervalo completo antes da próxima notícia. |
| Matéria aberta | Suspende a troca até fechar o leitor; depois aplica a espera de interação. |
| Card fora da tela, aba oculta ou dashboard fechado | Suspende o temporizador; ao retornar, concede novo intervalo. |
| Atualização dos sensores | Preserva a notícia pelo link quando disponível e o prazo da próxima troca. |

`pause_timeout: 0` deixa a pausa permanente até apertar play. `autoplay: false`
inicia pausado; play ainda funciona e a próxima pausa será permanente.

O leitor tenta mostrar o site em iframe. Quando o portal bloqueia a incorporação,
use **Não abriu? Ler no celular**. Após 15 segundos sem carregamento, o QR aparece.
Um evento de carregamento não garante que o navegador exibiu a matéria, portanto
o botão manual permanece disponível. O QR é gerado localmente; o card não contorna
as políticas de cookies ou incorporação dos portais.

## Configuração

| Opção | Padrão | Descrição |
| --- | --- | --- |
| `sources` | obrigatório | Lista de `entity`, `name` e `color` opcional. |
| `title` | vazio | Cabeçalho do card. |
| `max_articles` | `20` | Total máximo entre todas as fontes. |
| `slide_interval` | `8` | Segundos por notícia, mínimo 3. |
| `interaction_timeout` | `20` | Espera sem interação, mínimo 3 segundos. |
| `pause_timeout` | `60` | Retomada após pausa; 0 desativa retomada da pausa. |
| `autoplay` | `true` | Iniciar em reprodução automática. |
| `show_source` / `show_date` | `true` | Exibir fonte / data. |
| `show_description` | `false` | Exibir resumo no carrossel. |
| `image_fit` | `contain` | `contain`: imagem inteira; `cover`: preencher com recorte. |
| `card_height` | automático | Altura total em pixels; conteúdo excedente tem rolagem. |
| `image_width` / `image_height` | automático | Dimensões opcionais em pixels. |
| `title_font_size` / `desc_font_size` | `20` / `14` | Tamanho de texto em pixels. |
| `card_title_color` / `article_title_color` / `desc_color` | tema HA | Cores opcionais. |

## Atualizações nos clientes

Cada tag de versão dispara testes e publica uma **GitHub Release** com o card.
O HACS consulta o repositório e disponibiliza a atualização no Home Assistant;
essa detecção não é instantânea. Instale pela entidade de atualização do HACS.

Para instalação automática de madrugada, adapte
[examples/auto-update.yaml](examples/auto-update.yaml) em cada cliente usando o
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

## Créditos e limites de validação

Projeto original: **[RSS News Card for Home Assistant](https://github.com/suxlala/rss-news-card)**,
por **[suxlala](https://github.com/suxlala)**, distribuído sob licença MIT.
O [aviso original de licença](docs/LICENSE-rss-news-card.txt) também acompanha o bundle.
Esta personalização partiu da versão 1.5.2, preservando partes do editor e traduções.
O gerador QR incorporado é **qrcode-generator 1.4.4**, de Kazuhiko Arase, sob MIT;
seu aviso original permanece no bundle. O editor e as traduções foram preservados
da base existente; não se atribui aqui uma nova licença a código de terceiros.

Os testes de Chromium exercitam o card com estados HA simulados, tempo controlado,
interações e ciclo de vida. Uma instalação real do HACS, o aplicativo iOS e os
portais externos precisam de validação no dispositivo do cliente.
