# DungeonGuys — Próximos Passos (handoff)

> Documento para retomar o desenvolvimento numa nova sessão do Claude sem contexto prévio.
> Última atualização: 2026-06-21 · branch principal: `main` (tudo abaixo já está publicado em `origin/main`).

## O que é o projeto

DungeonGuys é um **pixel shooter survival roguelite** em HTML5 canvas, **JavaScript vanilla** (scripts globais carregados por `<script>` em `index.html`, **sem bundler/build**), PWA com service worker. Código em módulos por responsabilidade: `engine.js`, `combat.js`, `entities.js`, `items.js`, `render.js`, `ui.js`, `config.js`, `audio.js`, `save.js`, `equipment.js`, `equipment-catalog.js`.

## Estado atual (concluído)

- **7 classes**, 2 modos (campanha 16 waves / endless), bosses + mini-bosses, mutadores de wave, inimigos elite, combo de score, forge (meta permanente em soul gold), loja entre waves, level-up, efeitos elementais (burn/chill), PWA, controles touch.
- **Sistema de equipamentos por-run completo (3 fases, já na `main`):**
  - **Fase 1** — slots (`player.equipment`: weapon, offhand, helm, armor, boots, ring1, ring2, amulet), camada de stats efetivos (`permStats`/`permMaxHp` → `recalcStats()`), arma inicial por classe (substituiu o drop de tier).
  - **Fase 2** — regras puras de equipar (`equipment.js`), catálogo (`equipment-catalog.js`), `equipItem()`, loja com seção de equipamentos + painel de slots + comparação (delta).
  - **Fase 3** — block do escudo (stat `block`, % de anular hit, cap 75%, após dodge em `damagePlayer`), catálogo curado (32 itens, nomes únicos, escudos com block) + teste de integridade, ícones por slot, fix de comparação de dano.
- **Specs/planos** (referência) em `docs/superpowers/specs/` e `docs/superpowers/plans/`.

## Como rodar e testar (não há test runner configurado)

- **Servir localmente:** `python -m http.server 8080` na raiz do projeto → abrir `http://localhost:8080/index.html`.
- **Sintaxe:** `node --check <arquivo>.js` em cada JS alterado.
- **Testes de módulos/dados puros (Node):** `node tests/equipment.test.js`, `node tests/equipment-equip.test.js`, `node tests/equipment-catalog.test.js`. Esses arquivos rodam em Node graças ao guard UMD no fim de `equipment.js`/`equipment-catalog.js`.
- **Integração no navegador:** usar o MCP do Playwright/Chrome. As funções/estado do jogo são globais — dá para chamar `startGame()`, `openShop()`, `equipItem(...)`, ler `player.*`, etc. via `browser_evaluate`.
  - ⚠️ **Cache nos testes:** ao re-testar após editar `.js`/`.css`, o Chrome/Playwright em `localhost` cacheia os subrecursos mesmo navegando com `?cb=N` no documento. Para garantir código fresco, re-injete o script/CSS com query string (`script.src = 'items.js?v=' + Date.now()`) ou confie nos testes Node. **Em produção isso NÃO é problema:** o `sw.js` usa **network-first** para html/js/css (deploys são pegos na hora).

## Como retomar o fluxo de trabalho

O desenvolvimento usou os skills do plugin **superpowers**, em sequência:
1. `brainstorming` → refina a ideia e grava um spec em `docs/superpowers/specs/AAAA-MM-DD-<tópico>-design.md`.
2. `writing-plans` → gera um plano TDD em `docs/superpowers/plans/AAAA-MM-DD-<tópico>.md`.
3. `subagent-driven-development` → executa o plano (implementador + revisor por task, review final do branch, ledger em `.git/sdd/progress.md`).
4. `finishing-a-development-branch` → merge fast-forward na `main` + push.

Convenções: trabalhar numa branch `feature/<nome>`; commits terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`; comentários de código em inglês.

---

## Próximos passos (priorizados)

### 1. Meta-progressão — feature grande ainda NÃO feita (maior valor)
Foi proposta no início e ficou de fora (o usuário priorizou outros pacotes). Sugestão de escopo:
- **Conquistas** com recompensa em **soul gold** (engata no forge existente, `Save.data.progress`).
- **Desafio diário com seed fixa** (mesma arena/spawns no dia) + record local.
- Possível tela de **estatísticas** já existe (`STATS`); conquistas podem viver perto dela.
- **Começar por:** `brainstorming` (definir conquistas, gatilhos, recompensas; formato do daily) → spec → plano → execução.
- Arquivos prováveis: `save.js` (persistência de conquistas/daily), `ui.js` (tela), `entities.js`/`combat.js` (gatilhos), `engine.js` (seed do daily).

### 2. Especializações / sub-classes (ramos por classe) — rework do special (feature; pedido pelo usuário)

**Visão:** cada classe ganha um **ramo de especialização** (sub-classe temática) que define/transforma o special — e possivelmente o sabor do ataque e passivos. Exemplo: **Mago → Criomante** (gelo/congelamento) ou **Sábio dos Trovões** (raio/corrente). Cada uma das 7 classes teria 2 (ou mais) ramos com identidade própria. É a evolução da ideia de "special escolhível": em vez de um pool genérico, são caminhos de build por classe.

**Estado atual:** o special é **fixo por classe** (`CLASS_DEFS[cls].special` + `specialCd`), acionado por **E / botão direito / botão touch**; cooldown em `player.specialTimer` (decrementado em `updatePlayer`, combat.js), barra `sp-bar` no HUD + anel no botão mobile. `castSpecial()` (combat.js) é um `switch`: `fireball`, `volley`, `whirlwind`, `dash`, `nova`, `emp`, `hex`. Já há efeitos elementais reusáveis: `burn` (fogo), `chill` (gelo/slow), `poison`.

**Perguntas de design para o brainstorming (decisão de design → começar por `brainstorming`):**
- **Quando se escolhe o ramo?** Tela inicial · um marco na run (ex.: ao chegar na wave 4 / nível X) · desbloqueio meta no forge. (Um marco na run dá uma decisão significativa por partida; alinhado com o roguelite.)
- **O que o ramo muda?** Só o special · special + sabor do ataque (efeito elemental no tiro/golpe) · special + passivos/stats. Sugestão: trocar o special **e** aplicar um efeito temático ao ataque básico (ex.: Criomante aplica `chill`; Trovões aplica um efeito novo "shock"/corrente).
- **Quantos ramos por classe?** 2 (como o exemplo) ou 3.
- **Por-run ou permanente?** Escolha a cada run (roguelite) vs. desbloqueio/fixo (meta). Recomendação inicial: **por-run**, coerente com o resto (equipamentos são por-run).
- **Como integra com o resto:** reusar `burn`/`chill`/`poison` (+ talvez um efeito "shock" novo); manter o **arquétipo** de equipamentos (a sub-classe é sabor, não muda melee/ranged/elemental); decidir se há **progressão** do ramo (níveis que melhoram o special), **CDR** (stat `cdr` reduzindo `specialCd`, encaixa em anéis/amuletos/blessings/forge) e/ou **cargas** (acumular usos).

**Esboço de ramos por classe — RASCUNHO a validar no brainstorming, não definitivo:**
- Mago: Criomante (gelo) · Sábio dos Trovões (raio)
- Bruxa: Pestilenta (poison) · Hexer (maldições/slow)
- Arqueiro: Caçador (multishot) · Franco-atirador (crit/perfuração)
- CopRobô: Engenheiro (torretas/EMP) · Sobrecarga (rajada)
- Guerreiro: Berserker (fúria/lifesteal) · Guardião (block/provocar)
- Ninja: Assassino (crit/dash) · Espectro (clones/veneno)
- Sacerdotisa: Cruzada (dano sagrado) · Oráculo (cura/suporte)

**Arquivos prováveis:** `config.js` (ramos por classe + specials), `combat.js` (`castSpecial`, efeito de ataque por ramo, cooldown/CDR), `ui.js` (`baseStats` p/ `cdr`, HUD, UI de escolha do ramo), `index.html` (UI de escolha), `entities.js`/`items.js` (efeito "shock" novo, itens/blessings de CDR). Refletir o CDR também na `sp-bar` e no anel do botão touch.

### 3. Repaginação visual da UI — LEVA 1 FEITA ✅; leva 2 pendente (feature)

**Concluído (leva 1, já na `main`):** UI repaginada no estilo "pixel RPG" (conceito Craftpix) com **tema escuro de dungeon**, a partir de uma paleta DawnBringer fornecida pelo usuário — GUI em índigo/violeta (`#222034`/`#45283C`/`#3F3F74`) + acentos **vermelho `#AC3232`** (alerta: wave/HP/deltas) e **oliva `#49662F`** (CTA/seleção). Fontes pixel (`Press Start 2P` títulos + `Pixelify Sans` corpo). Telas repaginadas: **start screen, HUD, shop**. Plano: `docs/superpowers/plans/2026-06-21-ui-overhaul-fase1.md`.

**Como o skin funciona (importante):** todo o visual usa tokens **`--cp-*`** no `:root` do `style.css` + um bloco "Craftpix skin" no FIM do `style.css` que reskina os seletores existentes (`.screen-inner`, `.btn-pixel`, títulos, HUD, shop). **Trocar a paleta = trocar os valores dos tokens.** Referência de estilo: `docs/superpowers/refs/ui-craftpix-style.md`. Protótipo visual: `ui-lab.html` (na raiz). ⚠️ ao testar no navegador, o cache de `localhost` segura `style.css`; re-injete `style.css?v=Date.now()` ou confie no que está no disco.

Tokens atuais (tema escuro): `--cp-wood-dark #14121e` · `--cp-wood-frame #3f3f74` · `--cp-wood-hi #6a6ab0` · `--cp-panel #222034` · `--cp-panel-edge #2c2a46` · `--cp-slot-empty #191726` · `--cp-header #45283c` · `--cp-btn #49662f` · `--cp-ink-light #ece9f7` · `--cp-ink-dark #c7c3e0` (claro!) · `--cp-accent #ac3232`. Título do jogo: `#9a9af0`.

**Pendente (leva 2):** afinar as telas secundárias — **pause, forge, stats, level-up, victory, game over**. Já herdam o "esqueleto" do skin (moldura/painel/botões/plaqueta via seletores compartilhados — o LEVEL UP, por ex., já ficou bom), mas podem pedir ajustes específicos (paddings, contraste de elementos próprios de cada tela). Verificar cada uma por screenshot (Playwright) e ajustar. Extras opcionais: setas de acento nos slots; sprites de elmo/armadura no boneco (exige pixel art nova).

**Ajuste de cor é trivial:** mande `N → #HEX` (posição) que é só editar o token correspondente no `:root`.

### 4. Balance pass do sistema de equipamentos (médio)
Agora que a arma vira loot e fica fixa até a loja, vale revisar a curva:
- **Curva da campanha:** a arma inicial (tier 0) é mantida até a primeira compra na loja — verificar se as waves 1-3 não ficaram fáceis/difíceis demais.
- **Catálogo** (`equipment-catalog.js`): revisar preços e poder relativo. Nota concreta: `STORM ROD` (`fireRate 130`) atira mais rápido que armas que deveriam ser mais lentas — alinhar cadências por arquétipo.
- **Block vs dodge vs armor:** confirmar que o block do escudo (cap 75%) não trivializa o dano recebido em conjunto com dodge/armor.
- Sem spec novo necessário; é ajuste de números + playtest no navegador.

### 5. Polish menor (pequeno, oportunístico)
Itens registrados nos reviews, não-bloqueantes:
- **Som dedicado de block:** hoje `damagePlayer` reusa o SFX `'dodge'` para o block. Adicionar um som próprio em `audio.js` (`Sfx`) e usá-lo.
- **Teste de integridade do catálogo:** `tests/equipment-catalog.test.js` não valida o formato de `weapon.poison` (`{ dps, dur }`). Adicionar uma checagem opcional.
- **Loja:** o rótulo "NEEDS 1-HAND" aparece num botão já desabilitado (redundante) e há um espaçamento duplo cosmético em `renderShop` (`items.js`).
- **Sprites no boneco:** elmo/armadura/bota/anel/colar só têm ícone na UI (sem arte no personagem). Dar arte a esses slots exigiria pixel art nova — fora do escopo curado, mas é um possível upgrade visual.

### Já resolvido (não refazer)
- Cache de assets em produção → o `sw.js` já é network-first para código.
- Ícone da arma inicial / slots vazios no painel → resolvido na Fase 3 (ícones por slot).
- Nomes do catálogo colidindo com tiers/consumíveis e `min-height` do grid → resolvidos na Fase 3.

---

## Como começar a próxima sessão (prompt sugerido)

> "Leia `docs/NEXT-STEPS.md`. Quero trabalhar no item **<1 / 2 / 3 / 4 / 5>**. Se for feature nova (itens 1, 2 ou 3), comece pelo brainstorming; senão, vá direto ao plano/implementação. Teste com node + Playwright como descrito, e ao final faça merge na main + push."
