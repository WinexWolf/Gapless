# Gapless — Fluid-interface implementation

Context: responsive React web app for Maria, a small-business owner managing a synthetic payroll shortfall. React + Framer Motion, Shadcn/Radix, FastAPI and MongoDB. This iteration focuses on buttons, the monthly-access sheet and a three-step Dashboard tour—not new drag interactions.

## A. Feel audit

Scores describe the inspected baseline → implemented experience (1 weak, 5 strong). They are design assessments, not benchmark measurements.

| Dimension | Score | Evidence |
|---|---:|---|
| Response | 3 → 4 | New MotionButton controls scale on pointer-down with `whileTap`, not after release. Existing controls retain visible press feedback. |
| Directness | 3 → 4 | Monthly access is next to the forecast; the tour highlights real controls; the payday image previews before downloading. No unnecessary drag gesture was added. |
| Interruptibility | 2 → 4 | The paywall uses AnimatePresence and spring transforms. Reopening reverses the same keyed surface; closing aborts a pending checkout request so it cannot unexpectedly redirect. |
| Spring behavior | 2 → 4 | Paywall, tour and new press controls use shared spring presets instead of timed slide keyframes. Older unrelated transitions were preserved. |
| Spatial consistency | 3 → 4 | Desktop access sheet enters/exits on the right; mobile enters/exits at the bottom. Tour cards remain next to the highlighted target. |
| Materials | 3 → 4 | Navigation and focused overlays use translucent materials. Payroll numbers, prices and image previews retain opaque backing. |
| Reduced motion | 3 → 5 | MotionConfig respects the OS setting; new dialogs use instant opacity changes, and CSS animation/transition is disabled under reduced motion. |

## B. Interaction redesign — Monthly demo access

### Happy path
1. Maria presses **Monthly demo access**. The control responds immediately with a 0.98 scale press state.
2. A scrim appears; a sheet enters from the right on desktop or bottom on mobile.
3. Focus moves into the dialog. The underlying application is inert.
4. The sheet explains the editable **$19 USD/month sample price**, test tax, included actions, browser-specific access, and that no real money moves.
5. Continue opens Stripe's hosted TEST subscription checkout. Only a server-confirmed paid checkout with an active subscription unlocks actions.
6. A confirmed subscription exposes its period end and a cancel-renewal action. Cancellation keeps access until the paid test period ends.

### Interrupt / reverse
- Close, Escape or the outside scrim dismisses the sheet and restores focus.
- Reopening during exit reverses the same surface from its current presentation value.
- Closing while checkout creation is pending aborts the browser request and suppresses navigation. The server can reuse the pending session later.
- Canceling Stripe checkout never grants access.

### Edges / rubber-banding
- There is no drag-to-dismiss gesture in this iteration: no invented momentum, velocity handoff or rubber-band behavior.
- Sheet contents scroll inside the viewport with `overscroll-behavior: contain`; the main page does not scroll underneath.
- The mobile surface is capped at 92dvh, with persistent close and checkout controls.

### Reduced-motion fallback
- Sheet positions change instantly rather than slide.
- Press scaling is disabled; color/focus still communicates interaction.
- The animated landing example starts paused for reduced-motion users and always has a pause control.

## C. Motion spec

| Interaction | Properties | Spring |
|---|---|---|
| New button press | scale to 0.98 then 1 | stiffness 600, damping 38, mass 0.6 |
| Paywall / PNG sheet | translateX or translateY; opacity | stiffness 320, damping 34, mass 0.9; deliberately no visible bounce |
| Tour tooltip position | translateX / translateY; opacity | stiffness 260, damping 33, mass 1 |
| Scrim | opacity only | 180 ms; 0 ms for reduced motion |

The spotlight mask follows the DOM target using an SVG rectangle and the same move spring. Scroll and resize remeasure target geometry. UI coordinates are not financial calculations.

There is no user-drag velocity to inherit. No spring pretends to receive finger momentum. If a real draggable surface is added later, it must use pointer capture, preserve grab offset, cross an approximately 10px intent threshold, hand off measured velocity, project a destination before snapping, and allow immediate re-grab.

Do NOT use CSS keyframes for the new sheet, tour movement, or press interactions. Do not use `transition: all`. Financial math, dates, rankings and money decisions remain in Python; animation never invents financial values.

## D. Materials & hierarchy

- **Translucent:** header, landing toolbar, bottom navigation, tour tooltip and sheet header.
- **Solid:** financial figures, tables, quote comparisons, sheet reading area, checkout price, PNG image.
- **Light glass:** white at 72% or 86% opacity, 18px blur, 160% saturation; subtle dark-teal border and white inner highlight.
- **Dark glass:** `#112927` at 62% or 82% opacity; pale neutral border and restrained inner highlight.
- **Light scrim:** `rgba(16,33,31,.42)`; tour uses `.55`. Dark uses black at `.45` / `.62`.
- **Depth:** large overlays use an 18px/50px shadow; cards use 10px/30px. A 1px border separates surfaces without multiplying shadows.
- **Teal actions:** existing Gapless teal `#0E7C74`, with brighter dark-mode accents. Primary dark buttons use dark ink for contrast.
- Do not put a translucent reading card inside another translucent reading card. With no backdrop-filter support, use an opaque surface.

## E. Implementation checklist

- [x] Centralized MotionButton, move/sheet presets and app MotionConfig
- [x] Pointer-down feedback on new buttons; keyboard focus and disabled states
- [x] Radix dialog semantics, Escape, focus trapping/restoration and inert background
- [x] Scrollable bounded mobile sheet; safe-area bottom padding
- [x] Three-step first-visit tour; Back, Skip, Finish, Escape and Replay
- [x] Resize/scroll-aware spotlight geometry and stable target selectors
- [x] EN/ES landing copy, persisted selection and document language
- [x] Global theme sync; light and brighter dark SVG favicons
- [x] Deterministic 1080×1350 PNG with a synthetic-data disclaimer, preview, download and optional native sharing
- [x] HttpOnly browser-bound subscription access, server-side Stripe checks and cancel-at-period-end
- [x] Desktop 1920×800 and mobile 390×844 visual checks; no observed horizontal overflow
- [x] 55 serial backend regressions pass using real Stripe TEST subscriptions
- [ ] Hosted-card checkout completion and success redirect require normal-browser confirmation. Automation filled the actual card fields successfully but Stripe's hCaptcha script raised an EvalError and submission did not complete. No anti-bot bypass was attempted

[NEEDS INPUT] None for the shipped UI. $19 USD/month is a labeled editable sample, not a user-supplied business price. Business data and negotiations remain intentionally synthetic.

## F. Do / Don't

### Do
1. Keep Maria's payroll gap and covered status readable on a solid surface in both themes.
2. Let her close the access sheet immediately, including while checkout is being prepared.
3. Label sample prices, fictional testimonials and synthetic payroll images honestly.
4. Keep customer names and individual invoice details out of the crew share image.
5. Treat paid status as server-owned; a browser flag or success-looking URL must never unlock actions.

### Don't
1. Don't blur, fade or animate financial figures into unreadability.
2. Don't stack pale glass cards on pale glass backgrounds to imitate depth.
3. Don't introduce swipe-to-pay, drag-to-approve or accidental money-changing gestures.
4. Don't bounce a sheet without a gesture that actually supplied momentum.
5. Don't equate reaching Stripe Checkout with a completed payment, or call a demo forecast a payroll receipt.
