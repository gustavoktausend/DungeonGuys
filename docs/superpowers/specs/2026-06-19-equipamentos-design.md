# Sistema de Equipamentos — Design

> Data: 2026-06-19 · Projeto: DungeonGuys (pixel shooter survival roguelite, HTML5 canvas / vanilla JS)

## Contexto

O jogo hoje tem, por run:

- **Armas**: cada classe tem 3 *tiers* fixos (`CLASS_DEFS[cls].tiers`); `player.weapon` aponta para o tier atual e um upgrade dropa a cada 2 waves (`spawnUpgrade` / `updateUpgrades`).
- **Stats**: `player.stats` (objeto plano de `baseStats()`); `applyMods(mods)` soma direto. Fontes: level-up (`LEVELUP_POOL`) e loja de consumíveis (`ITEM_POOL`). Tudo permanente dentro da run.
- **Combate/Render**: `combat.js` lê `player.weapon`; `render.js` desenha a arma na mão via `WEAPON_SPRITES` (exceto CopRobô, cuja arma é parte do sprite).
- **Meta permanente**: Forge (soul gold) e unlocks de classe, em `localStorage` via `Save`. Não muda neste projeto.

## Objetivo

Adicionar um sistema de **equipamentos por-run** com slots dedicados, em que as **armas viram loot** comprado na loja (substituindo os tiers fixos) e os demais slots dão stats/efeitos.

## Decisões (resumo do brainstorming)

| Eixo | Decisão |
|---|---|
| Persistência | **Por-run** — zera ao morrer/recomeçar; nada novo no `Save` |
| Armas vs tiers | **Arma vira loot** e substitui os 3 tiers fixos |
| Identidade | **Por arquétipo de dano** (melee / ranged / elemental); classes do mesmo arquétipo compartilham o pool; a arma traz o tipo de ataque dentro do arquétipo |
| Modelo de item | **Fixo curado** (tabela, estilo `ITEM_POOL`); sem raridade/afixos aleatórios |
| Fonte | **Loja entre waves**; gerenciado no momento pausado |
| Loja | **2 seções**: consumíveis (atual) + equipamentos |
| Aquisição | **Compra-e-equipa-direto**; sem inventário de reserva; item anterior é descartado |

## 1. Slots (9)

| Slot | Aceita | Regra |
|---|---|---|
| `weapon` (mão principal) | arma 1H **ou** 2H | — |
| `offhand` | escudo | só com 1H equipada; equipar 2H libera/descarta o off-hand |
| `helm` | elmo | — |
| `armor` | peitoral | — |
| `boots` | bota | — |
| `ring1` / `ring2` | anel | dois slots independentes |
| `amulet` | colar | — |

Uma arma 2H ocupa logicamente `weapon` e bloqueia `offhand`. Equipar um escudo exige uma arma 1H na principal: enquanto houver uma 2H equipada, as ofertas de escudo ficam **indisponíveis** (o jogador equipa uma 1H primeiro). Inversamente, equipar uma 2H com um escudo no `offhand` descarta o escudo.

## 2. Modelo de item (tabela fixa)

```js
{
  id: 'staff_fire',
  name: 'CAJADO DE FOGO',
  icon: '🔥',                 // emoji/símbolo (mesmo padrão do ITEM_POOL)
  slot: 'weapon',             // weapon|offhand|helm|armor|boots|ring|amulet
  archetype: 'elemental',     // 'melee'|'ranged'|'elemental'|null (null = qualquer, p/ não-armas)
  classReq: null,             // null = genérico; ou ['mage','witch'] = restrito a classes
  twoHanded: false,           // só relevante para slot 'weapon'
  mods: { dmgPct: 8, crit: 5 },   // bônus de stat enquanto equipado
  price: 40,
  // presente apenas quando slot === 'weapon':
  weapon: {
    attack: 'bolt',           // 'melee'|'bolt'|'arrow'|'bullet'
    sprite: 'staff_green',    // chave em WEAPON_SPRITES (ou null p/ classes sem held weapon)
    fireRate: 180, damage: [32, 44], range: 460,
    bulletSpeed: 9, pierce: 2, count: 1,
    arc: undefined, knockback: undefined,   // p/ melee
    effect: { burn: { dps: 8, dur: 3000 } } // opcional: burn|poison|chill
  }
}
```

- A variedade vem de **bases curadas à mão** (ex.: `ESPADA DE FERRO` → `LÂMINA RÚNICA`), não de geração procedural.
- `classReq` cobre o pedido "específicos por classe ou genéricos": `null` = qualquer classe do arquétipo compatível; lista = restrito.
- Itens não-arma (`helm`/`armor`/`boots`/`ring`/`amulet`) normalmente têm `archetype: null` e definem só `mods` (e `price`).

## 3. Armas & combate

- A arma equipada **vira `player.weapon`** com a mesma forma dos tiers atuais → `combat.js` (`attack`, `fireProjectile`, `meleeAttack`) e `render.js` (`drawHeldWeapon`) seguem quase intactos.
- O **tipo de ataque vem da arma**, sempre dentro do arquétipo da classe (mago só equipa cajados → continua `bolt`).
- O **special continua da classe** (`player.def.special` / `specialCd`).
- Cada classe **começa com uma arma inicial** (a `tier 0` atual vira o item de arma de partida da classe).
- Os **`tier 1` e `tier 2`** existentes de cada classe são **reaproveitados como bases do catálogo** de armas da loja (Fase 3), evitando recriar do zero.
- O **drop de upgrade a cada 2 waves sai**; a progressão de arma passa a ser comprada na loja.
- **Escudo**: concede `armor` e/ou *block* (chance de anular um hit). Reusa a pipeline de dano em `damagePlayer`.

### Arquétipo `ranged` (archer × coprobô)

Ambos caem em `ranged`, mas archer usa `attack:'arrow'` (com sprite de flecha) e CopRobô usa `attack:'bullet'` (tracer, sem held weapon). Tratamento:

- Cada arma ranged declara seu `attack` e `sprite` próprios.
- Quando o **visual importa**, o catálogo restringe via `classReq` (ex.: arcos com `classReq:['archer']`, armas de energia com `classReq:['coprobo']`).
- Classes sem held weapon (CopRobô) **não desenham** o sprite da arma — só aplicam stats/efeito (comportamento já existente). Decidir o equilíbrio genérico/restrito é trabalho de catálogo (Fase 3), não de arquitetura.

## 4. Stats efetivos (camada de recálculo)

Hoje `applyMods` soma direto em `player.stats`. Como equipamento é trocável, separar em camadas:

- `player.permStats` = base (`baseStats()`) + blessings + consumíveis (somados direto, como hoje).
- `player.stats` (efetivo, lido pelo combate) = **recalculado** sempre que equipa/desequipa: `permStats` + soma dos `mods` de todos os itens equipados.
- `maxHp`: recalculado junto; ao mudar, fazer *clamp* do `hp` atual ao novo `maxHp` (sem curar de graça).
- `recalcStats()` central: percorre os slots, soma mods, escreve `player.stats`.

**Alternativa descartada**: aplicar/remover mods incrementalmente a cada troca — propenso a dessincronia. O recálculo total é mais robusto.

## 5. Loja & UI

A loja atual (`shop-screen`): ofertas · heal/reroll · painel de stats · next wave. Acréscimos:

- **Painel do set equipado**: os 9 slots com o ícone do item atual (vazio = silhueta); toque mostra detalhe.
- **Ofertas em 2 seções**: `CONSUMÍVEIS` (atual) e `EQUIPAMENTOS`.
- **Comparação**: a oferta de equip mostra o *delta* vs. o item no slot (ex.: `+5 DANO · −2 ARMOR`).
- **Filtro de elegibilidade**: só aparecem itens compatíveis com a classe/arquétipo (reusa a lógica de `playerDmgKind`/filtro do `ITEM_POOL`).
- `reroll` cobre as duas seções; layout cabe em mobile (PWA/touch), reusando o estilo atual.

## 6. Visual no jogo (canvas)

- **Arma**: já desenhada na mão via `WEAPON_SPRITES` (cajados/espadas/arcos). CopRobô segue sem held weapon.
- **Elmo/armadura/bota/anel/colar**: o atlas **não tem** sprites desses no boneco → representados **só por ícones na UI**, sem alterar o sprite do personagem (mudar o boneco exigiria pixel art nova, fora do escopo curado).
- **Escudo**: sem sprite conhecido no atlas (não há `shield` em `WEAPON_SPRITES`). Fica como ícone + efeito (block/armor); visual na mão é *nice-to-have* opcional.

## 7. Persistência & escopo

- **Por-run**: nada novo no `Save`. `startGame` reseta os slots e equipa a arma inicial da classe; ao morrer/recomeçar, zera. Records/forge inalterados.

## 8. Mapa de mudanças no código

- `config.js` — `CLASS_DEFS`: `tiers` → arma inicial (`startWeapon`); nova tabela `EQUIPMENT` (catálogo por slot).
- `ui.js` — `baseStats` mantém; adicionar `player.equipment` (slots) e `recalcStats()`; ajustar `applyMods` para alimentar `permStats`; filtros de elegibilidade.
- `items.js` — render/compra da loja com 2 seções, painel de slots, lógica de equipar + comparação; remover `spawnUpgrade`/`updateUpgrades` de tier.
- `combat.js` — `player.weapon` passa a vir do slot; bloco de procs/efeito já existe (burn/poison/chill).
- `entities.js` — remover o gancho de drop de tier a cada 2 waves.
- `engine.js` — `startGame` inicializa `player.equipment` e equipa a arma inicial; `checkWaveComplete` sem o drop de tier.
- `render.js` — sem mudança relevante (held weapon já lê `player.weapon`).
- `index.html` / `style.css` — marcação e estilo das seções/slots da loja.
- `save.js` — sem mudança.

## 9. Faseamento

1. **Fundação** — `player.equipment` (slots), `recalcStats()`/camada de stats efetivos, arma inicial por classe no lugar do `tier 0`, remover drop de tier. *(jogo roda igual, mas já "equipável" por dentro.)*
2. **Loja de equipamentos** — modelo de item, seção de equip na loja, comprar→equipar, comparação. *(já jogável.)*
3. **Catálogo & polish** — conjunto curado de equipamentos por arquétipo/slot, escudo + block, ícones e balanceamento.

## 10. Fora de escopo (YAGNI)

- Raridade / afixos aleatórios / loot procedural.
- Inventário de reserva (compra-e-equipa-direto).
- Drops de equipamento no chão.
- Equipamento permanente entre runs.
- Sprites de armadura/elmo/etc no boneco.

## 11. Riscos & questões abertas

- **Balanceamento de 3 fontes de stat** (blessings + consumíveis + equipamento): equipamentos devem pender para efeitos/identidade para não inflar números.
- **Catálogo ranged genérico vs restrito** (flecha × bala): resolver por `classReq` ao montar o catálogo (Fase 3).
- **Escudo sem sprite**: confirmar no atlas; senão, ícone + efeito.
- **Arma inicial = `tier 0`**: garantir paridade de poder com o início atual para não mudar a curva das primeiras waves.

## 12. Critérios de sucesso

- O personagem equipa armas compradas na loja; o tipo de ataque respeita o arquétipo da classe.
- Os 9 slots funcionam com as regras 1H/2H/escudo; equipar/desequipar recalcula stats corretamente (sem dessincronia, com clamp de HP).
- A loja mostra set equipado, ofertas em 2 seções e comparação; só itens elegíveis aparecem.
- Tudo é por-run e zera corretamente; nenhuma regressão no combate, na loja de consumíveis ou no save.
