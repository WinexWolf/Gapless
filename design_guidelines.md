{
  "project": {
    "name": "Gapless",
    "scope": "Dashboard hero refinement only (tighten core demo path)",
    "non_negotiables": [
      "Do NOT introduce a new palette or fonts. Reuse tokens/classes from /frontend/src/App.css.",
      "Do NOT break existing layout/components; refine hero area only.",
      "Make 'protects payroll' intelligence unmissable in first 30 seconds.",
      "All interactive + key informational elements MUST include data-testid (kebab-case).",
      "JS files (.jsx/.js), not .tsx."
    ]
  },
  "design_personality": {
    "keywords": [
      "Apple-style calm",
      "glassmorphic chrome",
      "deterministic finance",
      "answer-first hero",
      "safety-first (never breaks payroll)"
    ],
    "north_star": "At a glance: Friday goes from negative to safe-positive after the agent plan, and the agent refuses any move that risks payroll."
  },
  "existing_tokens_and_fonts_do_not_change": {
    "css_file": "/app/frontend/src/App.css",
    "fonts": {
      "head": "var(--head) = Bricolage Grotesque / DM Sans",
      "body": "var(--body) = DM Sans"
    },
    "core_colors": {
      "bg": "var(--bg)",
      "surface": "var(--surface)",
      "ink": "var(--ink)",
      "ink2": "var(--ink2)",
      "line": "var(--line)",
      "teal": "var(--teal)",
      "teal_h": "var(--teal-h)",
      "teal_l": "var(--teal-l)",
      "deep": "var(--deep)",
      "green": "var(--green)",
      "green2": "var(--green2)",
      "red": "var(--red)",
      "amber": "var(--amber)"
    },
    "glass_tokens": {
      "glass_bg": "var(--glass-bg)",
      "glass_bg_strong": "var(--glass-bg-strong)",
      "glass_border": "var(--glass-brd)",
      "glass_shadow": "var(--glass-shadow)",
      "glass_blur": "var(--glass-blur)",
      "glass_sat": "var(--glass-sat)"
    },
    "type_utilities": [".h1", ".h2", ".h3", ".eyebrow", ".big-num", ".num", ".muted", ".tiny", ".t-red", ".t-green"],
    "layout_utilities": [".page", ".card", ".hero", ".hero-top", ".grid2"],
    "cta_utilities": [".btn", ".btn-primary", ".btn-ghost", ".btn-sm", ".btn-row", ".icon-btn"],
    "status_utilities": [".banner", ".banner-red", ".banner-green", ".banner-amber"],
    "data_viz_utilities": [".gapbar", ".planks", ".plank", ".plank-sec", ".plank-pen", ".gap-legend", ".covered-badge-pill"]
  },
  "dashboard_hero_refinement": {
    "goal": "Make the payroll protection story obvious immediately: show Friday before→after number and a safety guarantee line.",
    "information_hierarchy_first_30_seconds": [
      {
        "priority": 1,
        "element": "Friday before→after transformation",
        "copy": "Friday: -$9,800 → +$1,240 after the plan",
        "notes": "Use tabular numerals (.num). Before is current forecast.friday_balance; After is computed preview using plan expected_total (or status.spare when covered)."
      },
      {
        "priority": 2,
        "element": "Safety guarantee",
        "copy": "Agent refuses any move that risks Friday payroll.",
        "notes": "Short, confident, always visible in hero (not buried in explanation)."
      },
      {
        "priority": 3,
        "element": "GapBar progress",
        "notes": "Keep existing GapBar; it already animates and communicates secured/pending/remaining."
      },
      {
        "priority": 4,
        "element": "Primary CTA",
        "copy": "Open the plan",
        "notes": "Keep existing button; ensure it sits adjacent to transformation line on mobile."
      }
    ],
    "layout_spec_mobile_first": {
      "container": {
        "use": "<section className=\"card hero g-glass\">",
        "reason": "Keeps existing hero spacing but upgrades to glass tokens already defined (.g-glass).",
        "do_not": "Do not change .card padding/radius globally."
      },
      "hero_top_restructure": {
        "current": "Left: eyebrow + big-num; Right: CTA row",
        "new": "Two-row stack on mobile: (1) eyebrow + transformation line + safety pill, (2) CTA row full-width",
        "implementation": "Add a new wrapper inside .hero-top: .hero-kpi (left) and .hero-ctas (right). Use flex-wrap already present; add small CSS only for alignment."
      },
      "transformation_block": {
        "structure": [
          "Eyebrow: 'Protect Friday payroll' + friday_label",
          "Main line: 'Friday: {before} → {after}' (big-num)",
          "Subline: 'After the agent plan' + deterministic note",
          "Safety chip row: 'Payroll-safe only' + 'Deterministic math'"
        ],
        "classes": {
          "eyebrow": "eyebrow",
          "main": "big-num num",
          "before": "t-red when negative else muted",
          "arrow": "plain text arrow '→' (no icon needed)",
          "after": "t-green when >=0 else t-red",
          "sub": "muted small",
          "chips": "chips + chip chip-deep (for guarantee) + chip chip-line (for deterministic)"
        },
        "data_testids": {
          "block": "dashboard-payroll-hero",
          "before": "dashboard-friday-before",
          "after": "dashboard-friday-after",
          "delta": "dashboard-friday-delta",
          "safety": "dashboard-payroll-safety-claim"
        }
      },
      "cta_row": {
        "primary": {
          "component": "MotionButton asChild + Link",
          "class": "btn btn-primary",
          "data-testid": "dashboard-open-plan-button"
        },
        "secondary": {
          "component": "Link",
          "class": "btn btn-ghost",
          "data-testid": "dashboard-open-digest-button",
          "note": "Keep Monday digest; on mobile it can wrap under primary."
        },
        "guided": {
          "component": "Existing top-right 'See it work' stays in intro; optionally duplicate as ghost CTA inside hero on desktop only.",
          "data-testid": "dashboard-see-it-work-hero-cta"
        }
      },
      "gapbar_position": "Immediately under transformation block; keep as-is.",
      "explanation_position": {
        "keep": "Keep .expl section but demote visually: smaller, secondary.",
        "change": "Add a one-line lead-in above explanation: 'Why this works (numbers from rules):' using .tiny muted."
      }
    },
    "layout_spec_desktop": {
      "grid": "Keep .hero-top flex row; left KPI block max-width ~60ch; CTAs right aligned.",
      "typography": "Use existing .big-num clamp; do not increase beyond current to avoid layout shift.",
      "spacing": "Use existing hero padding; add only small gap adjustments via new CSS class (no global changes)."
    },
    "computed_numbers_logic_for_ui": {
      "inputs_available": [
        "forecast.friday_balance (before)",
        "status.covered, status.remaining, status.spare",
        "plan.expected_total (from /plan; may need fetch or passed in)",
        "status.gap (gap amount)",
        "payroll (payroll amount)"
      ],
      "recommended_display_logic": [
        "before = forecast.friday_balance",
        "afterPreview = before + (plan.expected_total || (status.covered ? status.spare + status.gap : (status.gap - status.remaining)))",
        "If status.covered: after = forecast.friday_balance (already safe) and show 'Covered ✓' chip; else show afterPreview as 'after the plan' preview.",
        "Always show delta = after - before as a tiny chip: '+$11,040 improvement' (t-green if positive)."
      ],
      "note": "If plan.expected_total is not available on Dashboard today, add a lightweight GET /plan/summary (or reuse existing endpoint) but keep UI resilient: show transformation with 'after' as '—' until loaded."
    }
  },
  "micro_interactions": {
    "principles": [
      "Use existing transitions in App.css (no transition: all).",
      "Animate meaning: number change + bar fill should feel like 'rescue'."
    ],
    "hero_number_reveal": {
      "behavior": "On first load, fade/slide the after number in 120–180ms after before renders.",
      "implementation_hint": "Use CSS keyframes on a new class .kpi-after (opacity/translateY) or Framer Motion if already used by MotionButton; keep minimal to avoid bundle changes.",
      "reduced_motion": "Respect prefers-reduced-motion (already in App.css)."
    },
    "safety_chip": {
      "behavior": "Subtle pulse once when status.covered flips true (reuse existing confetti trigger).",
      "implementation_hint": "Add class toggle when st.covered becomes true; use box-shadow pulse (not transform-heavy)."
    }
  },
  "accessibility": {
    "requirements": [
      "Maintain focus-visible outline (already defined).",
      "Ensure transformation line is readable: avoid low-contrast glass over text; use existing ink colors.",
      "Use aria-label on icon-only buttons (already done for replay tour).",
      "Do not rely on color alone: include '→' and explicit 'after the plan' text; include 'Covered ✓' text when covered."
    ]
  },
  "component_path": {
    "existing_custom_components": {
      "Dashboard": "/app/frontend/src/pages/Dashboard.jsx",
      "GapBar": "/app/frontend/src/components/GapBar.jsx",
      "WeekBars": "/app/frontend/src/components/WeekBars.jsx",
      "DashboardTour": "/app/frontend/src/components/DashboardTour.jsx",
      "MotionButton": "/app/frontend/src/components/MotionButton (imported as @/components/MotionButton)",
      "PaydayCard": "/app/frontend/src/components/PaydayCard"
    },
    "shadcn_available_if_needed": [
      "/app/frontend/src/components/ui/badge.jsx",
      "/app/frontend/src/components/ui/progress.jsx",
      "/app/frontend/src/components/ui/tooltip.jsx",
      "/app/frontend/src/components/ui/separator.jsx"
    ],
    "note": "Prefer existing CSS chips/banners for consistency; only use shadcn if you need tooltip/help affordances."
  },
  "css_additions_allowed_small_and_local": {
    "file": "/app/frontend/src/App.css",
    "new_classes": {
      ".hero-kpi": "display:flex; flex-direction:column; gap:6px; min-width: min(520px, 100%);",
      ".hero-transform": "display:flex; flex-wrap:wrap; align-items:baseline; gap:10px;",
      ".hero-transform .arrow": "color: var(--ink2); font-weight: 700;",
      ".hero-safety": "display:flex; flex-wrap:wrap; gap:6px; align-items:center;",
      ".kpi-after": "animation: kpiIn .22s ease-out both;",
      "@keyframes kpiIn": "from{opacity:0; transform: translateY(4px);} to{opacity:1; transform: translateY(0);}"
    },
    "responsive_notes": [
      "At <=720px, keep CTAs full-width by applying .btn-row { width:100%; justify-content:space-between; } only inside hero scope if needed.",
      "Do not change global .btn behavior; scope any overrides under .hero."
    ]
  },
  "image_urls": {
    "note": "No new imagery required for this refinement; keep dashboard purely typographic + data viz."
  },
  "instructions_to_main_agent": [
    "Update /frontend/src/pages/Dashboard.jsx hero section only: replace current big-num 'Covered ✓ / remaining to go' with a transformation line 'Friday: before → after'.",
    "Keep existing banner above hero; it can remain as status summary.",
    "Add a short safety guarantee line inside hero (chip-deep) that is always visible: 'Payroll-safe only'.",
    "Compute 'after' deterministically using available data; if plan.expected_total not available, add a small fetch to get it (or show placeholder) but do not block rendering.",
    "Add data-testid attributes for before/after numbers, delta chip, safety claim, and hero CTAs (see keys above).",
    "Do not introduce new colors/fonts; use existing classes (.t-red/.t-green, chips, banner, g-glass).",
    "Keep GapBar and explanation; demote explanation visually but keep regenerate button.",
    "Ensure mobile 390px: transformation wraps gracefully; avoid overflow by allowing wrap and using tabular numerals (.num)."
  ],
  "general_ui_ux_design_guidelines_appendix": "<General UI UX Design Guidelines>\n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
