# Referência de estilo de UI — "Pixel Art RPG GUI" (conceito Craftpix)

> Guardado para o **item 3 do roadmap (overhaul de UI)**. Referência visual:
> https://img.craftpix.net/2025/10/Free-Basic-Pixel-Art-UI-for-RPG-720x480.webp
> Protótipo isolado que aplica este estilo: **`ui-lab.html`** (raiz; não altera o jogo).
>
> **✅ Aplicado (leva 1, junho/2026):** o jogo já usa este padrão, porém com **tema escuro de dungeon** — não a paleta clara da tabela abaixo. Paleta/tokens atuais ficam em `style.css` (`:root`, prefixo `--cp-*`) e estão resumidos em `docs/NEXT-STEPS.md` (item 3). A tabela de cores abaixo é o **conceito Craftpix original** (claro), mantida como referência histórica do padrão estrutural.

## ⚠️ Licença
Este doc captura o **estilo/conceito** (cores, padrões), que será **replicado em CSS nativo** — não há problema de licença em replicar um estilo. **Não** commitar nem usar os PNGs/assets da Craftpix sem seguir a licença Craftpix Free. Se quiser arte real, preferir packs **CC0**.

## Os 4 padrões a replicar
1. **Moldura dupla (madeira + pergaminho):** contorno escuro por fora → faixa âmbar/dourada → miolo creme. Cantos levemente "pixelados". Sombra dura (sem blur) embaixo/à direita.
2. **Cabeçalho teal:** barra de título verde-azulada sobreposta ao topo do painel, texto creme, botão **✕** de fechar no canto.
3. **Botão "chunky" verde:** verde claro no topo, borda escura, sombra interna inferior (volume), afunda ao clicar.
4. **Grid de slots:** células bege com borda escura e leve sombra interna; ícones coloridos; setas teal de navegação opcionais nas laterais.

## Tokens de cor (hex aproximados da imagem)
| Token | Hex | Uso |
|---|---|---|
| `--wood-dark`    | `#241a14` | contorno externo / bordas pixel |
| `--wood-frame`   | `#b07a3a` | faixa de moldura (madeira/âmbar) |
| `--wood-hi`      | `#e0b76a` | luz no topo da moldura |
| `--panel`        | `#ecdcb0` | miolo creme/pergaminho |
| `--panel-edge`   | `#cdb585` | célula de slot / sombra interna do painel |
| `--slot-empty`   | `#9c8254` | slot vazio |
| `--header`       | `#3f9d8c` | barra de título (teal) |
| `--header-dark`  | `#2a6b60` | borda do teal |
| `--header-hi`    | `#5bb8a6` | luz do teal |
| `--btn`          | `#84c96a` | botão verde |
| `--btn-dark`     | `#4a7a3a` | borda/sombra do botão |
| `--btn-hi`       | `#a6e08a` | luz do botão |
| `--ink-light`    | `#f6ecd2` | texto sobre teal/verde/madeira |
| `--ink-dark`     | `#5a4632` | texto sobre creme |
| acentos | `#4a90d9` azul · `#d9534a` vermelho · `#6fbf4f` verde · `#e8c34a` ouro · `#9b59b6` roxo | ícones / deltas |

## Tipografia
- **Display:** `Press Start 2P` (Google Fonts) — só títulos curtos / labels, tamanho pequeno (pixel chunky).
- **Corpo:** `Pixelify Sans` (Google Fonts) — nomes, descrições, números.
- Tudo tende a **MAIÚSCULAS** com leve `letter-spacing`. `image-rendering: pixelated` em sprites/ícones de imagem.

## Como mapear no DungeonGuys
- Reaproveitar as variáveis CSS existentes (`--gold`, `--bronze`, `--parchment`) ou introduzir estes tokens.
- O **painel de slots da loja** (Fase 3) já é o padrão #4 — ganharia o header teal + moldura.
- Telas a priorizar: **start, HUD, shop**.
- Implementação **CSS nativo** (sombras duras + `border-image`/camadas), sem assets — coerente com "vanilla, sem build". `sw.js` PRECACHE só se entrarem assets novos.
- Decisão em aberto: trocar as fontes atuais (`MedievalSharp`/`Pirata One`, medievais serifadas) por pixel (`Press Start 2P`/`Pixelify Sans`) é uma mudança de identidade — validar no brainstorming do item 3.
