# Launch ceremony as an overlay on the home page

Date: 2026-09-05. Status: approved by Aby, to be implemented.

## Why

The ceremony lives at `/launch` and shows the site inside an `<iframe>`, first
scaled into a stage screen and then zoomed to fill the frame. Two problems:

- The frame is a second document with its own hero video, and compositing it
  under an SVG-filtered curtain stutters.
- The zoom scales a frame's rasterisation. It reads as a video effect, not as
  the site arriving.

The ceremony moves onto the home page itself as an overlay. The site is the
real page underneath; the screen is that page scaled into a box; the finale is
the same transform returning to identity, after which the overlay is gone and
the plain site remains.

## Gate and trigger

- New switch `features.launchCeremony` in `SiteConfig` (default `false`),
  merged in `getConfig()` like the other feature keys, and a switch in
  Settings → Modules labelled "Launch ceremony". It is not a `FeatureKey`
  (it gates no route), so `feature-gate.ts` excludes it alongside
  `maintenanceMode`.
- With the switch off, the home page renders and ships nothing extra.
- With the switch on, the home page listens for **Alt+Shift+L**. On that
  chord the ceremony code is lazy-loaded and the closed curtain fades in over
  the page (about 0.6 s). Alt+Shift+L again while in PRESHOW, or Alt+R from
  PRESHOW, takes the overlay down. No sign-in is required.

## Where it lives

`Ceremony` — a client component in `src/components/launch/ceremony.tsx` —
wraps the page tree in `(public)/layout.tsx`:

```tsx
<Ceremony enabled={config.features.launchCeremony} config={config}>
  <div className="flex flex-col min-h-screen">…navbar, main, footer…</div>
</Ceremony>
```

It renders a plain `div` around its children. When summoned it:

- locks document scrolling and pins the page at the top;
- wraps the children in a fixed, viewport-sized, clipped box and applies one
  transform (`translate(x, y) scale(k)`) that places the page in the screen
  box;
- pauses every `<video>` inside the page while the curtain is closed and
  resumes them when the curtain starts to move;
- renders the overlay (house, curtain, effects, operator panel) in a portal
  above the page.

Removed: the `/launch` route, `browser-reveal.tsx`, `qr-card.tsx`,
`showcase-panel.tsx`, `title-card.tsx`, `launch-screen.ts`,
`ceremony-showcase.ts` and its test, the untracked `.render-*.tsx` helpers.
Reverted: the `frame-ancestors 'self'` / `SAMEORIGIN` headers back to
`'none'` / `DENY`, and the cookie banner's in-a-frame guard. Nothing is
framed any more.

The cookie banner closes itself when the ceremony is summoned (it listens for
a `ksa:ceremony` event) and does not reopen while the overlay is up.

## Beats

| Beat        | Duration      | What happens                                                                 |
|-------------|---------------|------------------------------------------------------------------------------|
| PRESHOW     | waits         | Curtain closed; logo, name, "Beginning shortly". Operator arms with Alt+A.  |
| COUNT_IN    | 3 × 1000 ms   | Numerals over the closed cloth.                                              |
| PARTING     | 5000 ms       | Legs draw to the wings. The page is already scaled into the screen box, under a dark panel. |
| LIGHT_UP    | 1400 + 1300 ms| The dark panel fades; the real page appears on the screen.                   |
| CELEBRATING | 6000 ms       | Fireworks and confetti inside the opening.                                   |
| HOLD        | waits         | The picture held, fireworks quiet, until a person presses.                   |
| GROW        | 2600 ms       | Curtain flies out; the page's transform animates to identity.                |
| OFF         | —             | Overlay unmounted, transform and scroll lock removed. The plain site.        |

Space/Enter: PRESHOW → COUNT_IN (when armed); HOLD → GROW. GROW → OFF fires
on GROW's own timer, which shares its duration with the page transform. Alt+1…7 jump to the seven visible beats; OFF is
not a jump target (Alt+R from PRESHOW or Alt+Shift+L take the overlay down).

The reducer stays pure and keeps its tests, updated for the renamed beats and
the OFF exit.

## The screen

The page is laid out at the viewport's own size and scaled by
`k = screenWidth / viewportWidth`, where `screenWidth = min(84vw, 124vmin,
104vh)` as today. The clip box is the viewport, so the screen shows exactly
the projector's first viewport of the page. The overlay draws the bezel,
shadow, and gloss around the box; it draws nothing over the page except the
dark panel before LIGHT_UP.

## Performance

Two things animate: the curtain (unchanged) and one transform on the page
wrapper, with `will-change: transform` only during GROW. The overlay is
loaded with `next/dynamic` on the chord, so visitors never download it.

## Operator panel

Alt+O as today. Pre-flight: audio, fullscreen, fonts. The QR line is gone.
Shortcut list updated: Alt+Shift+L summon/dismiss, Space unveil then full
screen, Alt+1…7 beats, Alt+R reset.

## Testing

- `tests/launch/ceremony-machine.test.ts`: renamed beats, HOLD → GROW on
  trigger, GROW → OFF on advance, OFF is terminal.
- Config merge: a stored config without `launchCeremony` merges to `false`.
- Visual: dev server, chord and jump keys driven over the DevTools protocol,
  stills at PRESHOW, HOLD, mid-GROW, OFF at 1920×1080 and 1920×1200.
