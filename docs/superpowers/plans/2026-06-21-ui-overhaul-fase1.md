# Repaginação de UI — Leva 1 (skin Craftpix: start / HUD / shop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Aplicar ao jogo o estilo "pixel RPG" aprovado no protótipo `ui-lab.html` — fontes pixel + molduras de madeira/pergaminho + cabeçalhos teal + botões "chunky" + slots — começando pelo *skin* reutilizável e pelas telas mais vistas: **start screen, HUD e shop**.

**Architecture:** O jogo usa um único `style.css` com variáveis em `:root` e fontes via `--pixel-font`/`--display-font` (usadas em todo o CSS). Trocar essas duas variáveis propaga as fontes globalmente; adicionamos **tokens `--cp-*`** (paleta Craftpix, prefixados para não colidir com os tokens existentes) e **reskinamos seletores já existentes** (`.screen-inner`, `.btn-pixel`, títulos, HUD, shop) — pouco/nenhum HTML novo. O CSS-fonte é o `ui-lab.html` (protótipo já validado): porte e adapte de lá.

**Tech Stack:** HTML5/CSS vanilla (sem build), Google Fonts (já usado), Playwright MCP + `python -m http.server` para verificação visual.

## Global Constraints

- **Sem novas dependências, sem build.** Só `index.html` + `style.css`. Fontes via Google Fonts.
- **Fontes pixel (decisão do usuário):** `Press Start 2P` (display/títulos curtos) + `Pixelify Sans` (corpo). Como `Press Start 2P` é ~2× mais largo, **reduzir os tamanhos dos títulos** para não estourar.
- **Paleta Craftpix** via tokens **prefixados `--cp-*`** (NÃO sobrescrever tokens existentes como `--wood-dark`, `--gold`, `--parchment`). Valores no doc de referência `docs/superpowers/refs/ui-craftpix-style.md`.
- **Reskinar seletores existentes** (cascata): preferir um bloco de skin no fim do `style.css`. Onde precisar vencer regras existentes de tamanho/cor, usar especificidade adequada ou `!important` **apenas** nos overrides de skin (com parcimônia).
- **Sem regressão funcional:** todos os botões/telas continuam clicáveis; nada de quebra de layout; **responsivo até mobile** e **controles touch** intactos; foco de teclado visível.
- **Fonte de verdade visual:** o protótipo `ui-lab.html` (raiz). As classes lá (`.panel`, `.title`, `.btn`, `.slot`, `.bar`) viram o estilo dos seletores do jogo.
- **Branch:** `feature/ui-overhaul` a partir de `main` (controlador cria antes da Task 1). Commits terminam com `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`. Comentários em inglês.
- **Sem test runner.** Verificação = `node --check` no HTML/JS tocado (CSS não tem) + **screenshot via Playwright** (controlador), navegando com `?cb=<n>` e, se preciso, re-injetando `style.css?v=Date.now()` para furar o cache de `localhost`. Conferir também `browser_console_messages` (sem erros novos).

## Tokens (referência rápida — usar nos passos)
```
--cp-wood-dark:#241a14; --cp-wood-frame:#b07a3a; --cp-wood-hi:#e0b76a;
--cp-panel:#ecdcb0; --cp-panel-edge:#cdb585; --cp-slot-empty:#9c8254;
--cp-header:#3f9d8c; --cp-header-dark:#2a6b60; --cp-header-hi:#5bb8a6;
--cp-btn:#84c96a; --cp-btn-dark:#4a7a3a; --cp-btn-hi:#a6e08a;
--cp-ink-light:#f6ecd2; --cp-ink-dark:#5a4632;
```

## File Structure
- `index.html` — trocar o `<link>` das fontes (Task 1); sem mudança de markup (ou mínima).
- `style.css` — `:root`: trocar `--pixel-font`/`--display-font` + adicionar tokens `--cp-*` (Task 1); um **bloco de skin** no fim com: ajuste de tamanhos de título (Task 1), molduras/botões/overlay compartilhados + start (Task 2), HUD (Task 3), shop (Task 4).

---

## Task 1: Fundação — fontes pixel + tokens + tamanhos de título

**Files:** Modify `index.html`, `style.css`

**Interfaces:** Produces — fontes pixel globais, tokens `--cp-*`, títulos redimensionados (nada estoura).

- [ ] **Step 1: Trocar as fontes no `index.html`**

Old:
```html
  <link href="https://fonts.googleapis.com/css2?family=Pirata+One&family=MedievalSharp&display=swap" rel="stylesheet" />
```
New:
```html
  <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Pixelify+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: `:root` do `style.css` — fontes + tokens**

Old:
```css
  --pixel-font:    'MedievalSharp', serif;
  --display-font:  'Pirata One', serif;
}
```
New:
```css
  --pixel-font:    'Pixelify Sans', system-ui, sans-serif;
  --display-font:  'Press Start 2P', system-ui, monospace;
  /* ── Craftpix pixel-RPG skin tokens (prefixed to avoid clashing) ── */
  --cp-wood-dark:#241a14; --cp-wood-frame:#b07a3a; --cp-wood-hi:#e0b76a;
  --cp-panel:#ecdcb0; --cp-panel-edge:#cdb585; --cp-slot-empty:#9c8254;
  --cp-header:#3f9d8c; --cp-header-dark:#2a6b60; --cp-header-hi:#5bb8a6;
  --cp-btn:#84c96a; --cp-btn-dark:#4a7a3a; --cp-btn-hi:#a6e08a;
  --cp-ink-light:#f6ecd2; --cp-ink-dark:#5a4632;
}
```

- [ ] **Step 3: Bloco de skin no fim do `style.css` — tamanhos de título**

Acrescentar ao FINAL de `style.css`:
```css
/* ═══ Craftpix skin · Task 1: rein in display sizes (Press Start 2P is wide) ═══ */
.title-glow, .title-main { font-size: clamp(20px, 5vw, 38px) !important; line-height: 1.15; }
.title-sub               { font-size: clamp(8px, 1.5vw, 11px) !important; letter-spacing: 2px; }
.shop-title              { font-size: clamp(13px, 2.6vw, 20px) !important; letter-spacing: 1px; }
.gameover-title, .victory-title { font-size: clamp(16px, 3.4vw, 28px) !important; line-height: 1.2; }
.pause-title, .levelup-sub, .shop-gold, .footer-hint, .color-label, .class-name,
.hud-label, .stat-row, .stat-line, .shop-name, .f-name { letter-spacing: 0.5px; }
#wave-display            { font-size: clamp(16px, 3vw, 26px) !important; }
#score-display, #gold-display { font-size: clamp(12px, 2vw, 18px) !important; }
.btn-pixel               { font-size: clamp(11px, 1.8vw, 15px) !important; }
.class-name              { font-size: clamp(9px, 1.5vw, 12px) !important; }
.class-desc, .footer-hint, .inst-row, .cval, .cdesc { font-size: clamp(9px, 1.4vw, 12px) !important; }
```

- [ ] **Step 4: Verificar (controlador, no navegador)**

`node --check` não se aplica a CSS/HTML puro; rode `node --check` em nenhum (sem JS tocado) — pular.
Servir `python -m http.server 8080`. Navegar `http://localhost:8080/index.html?cb=101`. Screenshot da **start screen**; depois `browser_evaluate` para abrir telas e screenshot: `() => { startGame(); }` (HUD), `() => { startGame(); openShop(); gold=200; rollOffers(); renderShop(); }` (shop), `() => { gameOver?.() }` (game over — ou `showScreen('gameover')`).
**Esperado:** fonte pixel em tudo, **nenhum título estourando** a tela/painel (especialmente em larguras médias). Ajustar os clamps do Step 3 se algo transbordar. `browser_console_messages` (error): apenas o `favicon.ico` 404 conhecido.

- [ ] **Step 5: Commit**
```bash
git add index.html style.css
git commit --no-verify -m "feat(ui): pixel fonts + Craftpix skin tokens + title sizing

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Skin compartilhado (molduras, botões, overlay) + start screen

**Files:** Modify `style.css` (append). Modify `index.html` só se um título precisar de wrapper de plaqueta.

**Interfaces:** Consumes tokens `--cp-*` (Task 1). Produces — `.screen-inner` com moldura madeira/pergaminho; `.btn-pixel` chunky verde; títulos como plaqueta teal; start screen (cards de classe, mode-btn, toggles, color picker) no novo estilo.

- [ ] **Step 1: Append no `style.css` — esqueleto compartilhado** (portar do `ui-lab.html`)
```css
/* ═══ Craftpix skin · Task 2: shared shell ═══ */
.screen { background: radial-gradient(circle at 50% -10%, #2a1d12 0%, #0a0a0f 60%); }

/* the signature: double wooden frame + cream interior */
.screen-inner {
  background: var(--cp-panel);
  color: var(--cp-ink-dark);
  border: 3px solid var(--cp-wood-dark);
  box-shadow:
    inset 0 0 0 3px var(--cp-wood-frame),
    inset 0 0 0 6px var(--cp-wood-dark),
    0 6px 0 0 rgba(0,0,0,0.5);
  border-radius: 0;
}

/* titles become teal plates */
.shop-title, .pause-title, .victory-title, .gameover-title, .title-sub {
  display: inline-block;
  background: var(--cp-header); color: var(--cp-ink-light);
  border: 3px solid var(--cp-wood-dark);
  box-shadow: inset 0 3px 0 var(--cp-header-hi), inset 0 -3px 0 var(--cp-header-dark), 0 3px 0 rgba(0,0,0,0.4);
  padding: 8px 16px; margin-bottom: 14px;
  text-shadow: 0 2px 0 rgba(0,0,0,0.35);
}
.gameover-title { background: var(--cp-header); } /* keep readable; color via plate */

/* chunky green button */
.btn-pixel {
  font-family: var(--display-font); color: var(--cp-ink-light);
  background: var(--cp-btn);
  border: 3px solid var(--cp-wood-dark);
  box-shadow: inset 0 3px 0 var(--cp-btn-hi), inset 0 -4px 0 var(--cp-btn-dark), 0 3px 0 rgba(0,0,0,0.4);
  border-radius: 0; padding: 12px 18px; transition: transform .05s;
}
.btn-pixel:hover { filter: brightness(1.06); }
.btn-pixel:active { transform: translateY(3px); box-shadow: inset 0 3px 0 var(--cp-btn-hi), inset 0 -2px 0 var(--cp-btn-dark); }
.btn-pixel.secondary { background: var(--cp-wood-frame);
  box-shadow: inset 0 3px 0 var(--cp-wood-hi), inset 0 -4px 0 #7a5020, 0 3px 0 rgba(0,0,0,0.4); }
```

- [ ] **Step 2: Append — start screen específicos**
```css
/* ═══ Craftpix skin · Task 2: start screen ═══ */
.class-card {
  background: var(--cp-panel-edge); color: var(--cp-ink-dark);
  border: 3px solid var(--cp-wood-dark);
  box-shadow: inset 2px 2px 0 rgba(0,0,0,0.22), inset -2px -2px 0 rgba(255,255,255,0.25);
  border-radius: 0;
}
.class-card.selected { background: var(--cp-btn); color: var(--cp-ink-light);
  box-shadow: inset 0 3px 0 var(--cp-btn-hi), inset 0 -3px 0 var(--cp-btn-dark); }
.class-card.locked { opacity: .55; }
.mode-btn, .aim-toggle {
  font-family: var(--display-font); color: var(--cp-ink-light);
  background: var(--cp-header); border: 3px solid var(--cp-wood-dark);
  box-shadow: inset 0 3px 0 var(--cp-header-hi), inset 0 -3px 0 var(--cp-header-dark), 0 2px 0 rgba(0,0,0,0.4);
  border-radius: 0;
}
.mode-btn.selected, .aim-toggle.on { background: var(--cp-btn);
  box-shadow: inset 0 3px 0 var(--cp-btn-hi), inset 0 -3px 0 var(--cp-btn-dark); }
#hero-name {
  background: var(--cp-panel); color: var(--cp-ink-dark);
  border: 3px solid var(--cp-wood-dark); border-radius: 0; font-family: var(--pixel-font);
}
.cslider input[type="range"] { border-color: var(--cp-wood-dark); }
.cslider input[type="range"]::-webkit-slider-thumb { background: var(--cp-btn); border-color: var(--cp-wood-dark); }
.cslider input[type="range"]::-moz-range-thumb { background: var(--cp-btn); border-color: var(--cp-wood-dark); }
```

- [ ] **Step 3: Verificar (controlador)** — navegar `?cb=102`, screenshot da **start screen** (cards de classe, modos, toggles, color picker, START). Conferir: moldura, plaqueta de título, botões chunky, cards legíveis, **selecionar classe** muda o card (verde), responsivo. Comparar com `ui-lab.html`. Ajustar se preciso.

- [ ] **Step 4: Commit**
```bash
git add style.css index.html
git commit --no-verify -m "feat(ui): Craftpix skin — shared shell + start screen

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: HUD (barras chunky + painéis + labels)

**Files:** Modify `style.css` (append).

**Interfaces:** Produces — HUD com barras chunky (HP/XP/ST/SP), painéis e contadores no estilo Craftpix. Sem mudança de markup/JS.

- [ ] **Step 1: Append — HUD**
```css
/* ═══ Craftpix skin · Task 3: HUD ═══ */
#hud-left, #hud-center, #hud-right {
  background: var(--cp-panel); color: var(--cp-ink-dark);
  border: 3px solid var(--cp-wood-dark);
  box-shadow: inset 0 0 0 2px var(--cp-wood-frame), 0 3px 0 rgba(0,0,0,0.4);
  border-radius: 0; padding: 8px 10px;
}
.hud-label { color: var(--cp-ink-dark); font-family: var(--display-font); }
#hud-name, #wave-display, #score-display, #gold-display, #wave-timer { color: var(--cp-ink-dark); text-shadow: none; }
#wave-display { color: #7a3b1f; }
/* chunky bars */
#hp-bar-wrap, #xp-bar-wrap, #st-bar-wrap, #sp-bar-wrap {
  background: #2a1d12; border: 3px solid var(--cp-wood-dark);
  box-shadow: inset 0 0 0 1px #000; border-radius: 0; overflow: hidden;
}
#hp-bar, #xp-bar, #st-bar, #sp-bar { border-radius: 0; }
#combo-display { color: var(--cp-acc-gold, #e8c34a); }
/* boss bar */
#boss-bar { background: var(--cp-panel); border: 3px solid var(--cp-wood-dark);
  box-shadow: inset 0 0 0 2px var(--cp-wood-frame); border-radius: 0; }
#boss-name { color: var(--cp-ink-dark); }
#boss-hp-wrap { background: #2a1d12; border: 2px solid var(--cp-wood-dark); border-radius: 0; }
```

- [ ] **Step 2: Verificar (controlador)** — `?cb=103`, `() => startGame()`, screenshot in-game do HUD (barras, wave/score/gold). Tomar dano/abrir loja se necessário para ver estados. Conferir legibilidade sobre o canvas escuro e que as barras animam. Ajustar.

- [ ] **Step 3: Commit**
```bash
git add style.css
git commit --no-verify -m "feat(ui): Craftpix skin — HUD bars and panels

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Shop (ofertas, slots, header teal, stats)

**Files:** Modify `style.css` (append).

**Interfaces:** Produces — loja no estilo Craftpix: ofertas/consumíveis como cards, painel de slots (Fase 2/3) recolorido, header teal, stats panel. Sem mudança de markup/JS.

- [ ] **Step 1: Append — shop**
```css
/* ═══ Craftpix skin · Task 4: shop ═══ */
.shop-item.offer, .shop-item.small {
  background: var(--cp-panel-edge); color: var(--cp-ink-dark);
  border: 3px solid var(--cp-wood-dark);
  box-shadow: inset 0 2px 0 rgba(255,255,255,0.25), inset 0 -3px 0 rgba(0,0,0,0.22);
  border-radius: 0;
}
.shop-item.offer:hover:not(:disabled) { filter: brightness(1.05); border-color: var(--cp-wood-dark); transform: translateY(-2px); }
.shop-name { color: var(--cp-ink-dark); }
.shop-price { color: #7a5a1f; font-family: var(--display-font); }
.fx-pos, .cmp-up   { color: #2f7d3a; }
.fx-neg, .cmp-down { color: #b83b30; }
/* equipped-slots panel (from Phase 2/3) */
.slot-chip { background: var(--cp-panel-edge); border: 3px solid var(--cp-wood-dark);
  box-shadow: inset 2px 2px 0 rgba(0,0,0,0.25), inset -2px -2px 0 rgba(255,255,255,0.28); border-radius: 0; }
.slot-chip.empty { background: var(--cp-slot-empty); }
.slot-lbl { color: var(--cp-ink-dark); }
.shop-section-label { color: var(--cp-header-dark); }
/* stats panel */
.shop-stats { background: var(--cp-panel-edge); border: 3px solid var(--cp-wood-dark);
  box-shadow: inset 0 0 0 2px var(--cp-wood-frame); border-radius: 0; color: var(--cp-ink-dark); }
.stat-line { border-bottom: 2px dotted rgba(90,70,50,0.28); }
.stat-line span:last-child { color: #2f7d3a; }
/* heal/reroll already covered by .shop-item.small + .btn-pixel */
```

- [ ] **Step 2: Verificar (controlador)** — `?cb=104`, montar a loja com itens equipados: `() => { startGame(); openShop(); gold=999; equipItem(EQUIPMENT.find(i=>i.id==='o_kite')); equipItem(EQUIPMENT.find(i=>i.id==='h_iron')); rollOffers(); renderShop(); }`. `browser_resize` 1100x860 e `browser_take_screenshot`. Conferir contra `ui-lab.html`: ofertas/consumíveis como cards, slots recoloridos, comparação verde/vermelho, header teal, botões BUY/REROLL/NEXT WAVE chunky. Ajustar.

- [ ] **Step 3: Commit**
```bash
git add style.css
git commit --no-verify -m "feat(ui): Craftpix skin — shop offers, slots and stats

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review
- **Cobertura:** fontes pixel (T1), tokens (T1), molduras/botões/overlay compartilhados + start (T2), HUD (T3), shop (T4) — as 3 telas principais + o esqueleto que beneficia as demais. ✔
- **Placeholders:** nenhum; cada passo tem o CSS concreto (portado do `ui-lab.html`) e a verificação por screenshot. ✔
- **Consistência:** tokens `--cp-*` não colidem com os existentes; `--pixel-font`/`--display-font` trocados uma vez no `:root` e herdados; `!important` só nos overrides de tamanho da T1. ✔
- **Risco conhecido:** Press Start 2P largo → a T1 redimensiona títulos e a verificação por screenshot confirma; ajustar clamps se algo estourar. CSS por cascata (append) — checar que nenhuma regra nova é anulada por especificidade maior anterior.

## Notas / fora desta leva
- **Leva 2 (depois):** pause, forge, stats, level-up, victory, game over (já herdam o esqueleto da T2; afinar específicos), e talvez setas teal nos slots e ícones/sprites.
- Se entrarem **assets de imagem** (molduras 9-slice), adicionar ao `PRECACHE` do `sw.js` (hoje a leva é 100% CSS, então não precisa).
- O canvas do jogo (arena/sprites) **não muda** — só a UI em DOM/CSS.
