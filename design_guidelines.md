{
  "meta": {
    "product": "Gapless",
    "scope": "Incremental, binding UI/UX guidelines for: shareable Payroll Covered PNG, theme-aware favicon, first-time 3-step dashboard tour, Spanish landing toggle, Stripe subscription paywall. Preserve existing teal brand; increase glassmorphism + Apple-like fluid motion. React (.js), Tailwind, shadcn/ui, Framer Motion 11.",
    "last_updated": "2026-10-25",
    "non_goals": [
      "Do not redesign IA or core flows",
      "Do not introduce new gesture-heavy paradigms beyond one primary transition (paywall sheet OR tour)",
      "Do not use purple in AI/chat contexts (not applicable here, but keep teal-forward)"
    ]
  },
  "brand_attributes": [
    "Trustworthy + calm (numbers-first)",
    "Physical + interruptible (Apple-like directness)",
    "Crafted glass (translucent chrome, not neon gradients)",
    "Mobile-first for owner-operators on phones"
  ],
  "design_tokens": {
    "notes": [
      "Keep existing CSS variables in App.css as source-of-truth for brand colors; extend with glass/material tokens below.",
      "Avoid stacking glass-on-glass: at most ONE translucent layer between content and background. Nested cards inside glass surfaces must be solid/near-opaque.",
      "Gradients: only for large section backgrounds (hero) and decorative overlays; never on dense reading surfaces; never exceed 20% viewport."
    ],
    "css_custom_properties_to_add_in_App_css_root": {
      "--glass-bg": "rgba(255,255,255,.72)",
      "--glass-bg-strong": "rgba(255,255,255,.86)",
      "--glass-brd": "rgba(16,33,31,.10)",
      "--glass-hi": "rgba(255,255,255,.70)",
      "--glass-shadow": "0 18px 50px rgba(15,61,58,.10), 0 2px 10px rgba(15,61,58,.06)",
      "--glass-blur": "18px",
      "--glass-sat": "160%",
      "--scrim": "rgba(16,33,31,.42)",
      "--scrim-strong": "rgba(16,33,31,.55)",
      "--radius-card": "20px",
      "--radius-pill": "999px",
      "--shadow-float": "0 10px 30px rgba(15,61,58,.10)",
      "--shadow-press": "0 6px 18px rgba(15,61,58,.12)",
      "--ring": "0 0 0 3px rgba(14,124,116,.22)",
      "--ring-dark": "0 0 0 3px rgba(43,166,157,.22)",
      "--noise-opacity": "0.06"
    },
    "css_custom_properties_to_add_in_App_css_dark_theme_block": {
      "--glass-bg": "rgba(17,41,39,.62)",
      "--glass-bg-strong": "rgba(17,41,39,.82)",
      "--glass-brd": "rgba(232,241,239,.10)",
      "--glass-hi": "rgba(255,255,255,.10)",
      "--glass-shadow": "0 18px 50px rgba(0,0,0,.45), 0 2px 10px rgba(0,0,0,.25)",
      "--scrim": "rgba(0,0,0,.45)",
      "--scrim-strong": "rgba(0,0,0,.62)"
    },
    "utility_classes_to_define_in_App_css": {
      ".g-glass": "background: linear-gradient(135deg, var(--glass-bg-strong), var(--glass-bg)); border: 1px solid var(--glass-brd); border-radius: var(--radius-card); box-shadow: var(--glass-shadow), inset 0 1px 0 var(--glass-hi); backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat)); -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-sat));",
      ".g-glass-solid": "background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius-card); box-shadow: 0 1px 2px rgba(15,61,58,.03), 0 4px 14px rgba(15,61,58,.03);",
      ".g-noise": "position: relative;",
      ".g-noise::before": "content: \"\"; position: absolute; inset: 0; pointer-events: none; opacity: var(--noise-opacity); background-image: url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Cfilter id=%22n%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.35%22/%3E%3C/svg%3E'); mix-blend-mode: multiply; border-radius: inherit;",
      ".g-pressable": "transition: background .15s, border-color .15s, box-shadow .15s, opacity .15s;",
      ".g-pressable:active": "transform: translateY(1px);"
    }
  },
  "typography": {
    "font_pairing": {
      "headings": "Bricolage Grotesque (already in App.css)",
      "body": "DM Sans (already in App.css)",
      "numbers": "tabular-nums via .num (already present)"
    },
    "scale": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl (keep existing clamp-based .h1/.lp-h1 where used)",
      "h2": "text-base md:text-lg (for subheading copy blocks; keep .h2 for section titles)",
      "body": "text-sm md:text-base",
      "small": "text-xs to text-sm"
    },
    "rules": [
      "All money/time/quantities must use .num for tabular alignment.",
      "Avoid ultra-light weights on glass; minimum 500 for body on translucent surfaces.",
      "Spanish strings tend to be longer: allow 10–20% more width; avoid fixed-width buttons; prefer padding-based sizing."
    ]
  },
  "layout_and_grid": {
    "container": {
      "max_width": "1160px (existing)",
      "page_padding": "mobile 14–16px, desktop 20–24px (existing patterns)"
    },
    "dashboard": {
      "pattern": "Bento-ish cards but keep current grid2/actions-list; upgrade surfaces to glass where appropriate.",
      "glass_usage": [
        "Top nav already uses backdrop-filter in landing; extend to app top bar in both themes.",
        "Use glass for: top chrome, paywall sheet header, tour tooltip, lightweight summary cards.",
        "Use solid/near-opaque for: tables, dense lists, editable forms, payroll line items (readability)."
      ]
    }
  },
  "components": {
    "component_path": {
      "buttons": "/app/frontend/src/components/ui/button.jsx",
      "dialog": "/app/frontend/src/components/ui/dialog.jsx",
      "sheet_drawer": "/app/frontend/src/components/ui/sheet.jsx and /app/frontend/src/components/ui/drawer.jsx",
      "tooltip": "/app/frontend/src/components/ui/tooltip.jsx",
      "popover": "/app/frontend/src/components/ui/popover.jsx",
      "tabs": "/app/frontend/src/components/ui/tabs.jsx",
      "switch": "/app/frontend/src/components/ui/switch.jsx",
      "sonner_toast": "/app/frontend/src/components/ui/sonner.jsx",
      "card": "/app/frontend/src/components/ui/card.jsx",
      "badge": "/app/frontend/src/components/ui/badge.jsx"
    },
    "binding_component_rules": [
      "Do not use raw HTML dropdowns/calendars/toasts; use shadcn components only.",
      "All interactive elements and key info must include data-testid (kebab-case, role-based).",
      "Buttons: keep min-height 44px; add pointer-down feedback (scale 0.99 + shadow tighten) via Framer Motion or :active (already present).",
      "Focus: keep :focus-visible outline; for glass surfaces also add box-shadow ring token (--ring/--ring-dark)."
    ],
    "glassmorphic_variants": {
      "glass_card": {
        "use_for": ["tour tooltip", "paywall sheet header", "landing language toggle container", "small KPI cards"],
        "class": "g-glass g-noise",
        "avoid_for": ["tables", "dense payroll rows", "long paragraphs"]
      },
      "solid_card": {
        "use_for": ["payroll summary details", "stripe plan comparison", "settings forms"],
        "class": "card (existing) or g-glass-solid"
      }
    }
  },
  "feature_guidelines": {
    "payday_share_image_png": {
      "ux": [
        "Add a clear 'Share' affordance near the 'Payroll covered' summary card: primary button 'Download PNG' + secondary 'Copy link' only if implemented.",
        "The exported PNG must match on-screen hierarchy: title, covered badge, totals, and 3–6 key rows max. Avoid exporting the entire page.",
        "Use a dedicated export-only layout wrapper with solid background (no glass blur) to avoid raster artifacts; simulate glass with subtle gradient + border instead of backdrop-filter in the PNG.",
        "Include timestamp + business name in footer line (small, muted) for context when texted." 
      ],
      "visual_spec": {
        "png_canvas": "1080×1350 (portrait) default; also allow 1080×1080 square if quick toggle.",
        "background": "solid #FFFFFF (light) or #04120F (dark) with subtle noise; no large gradients.",
        "badge": "Use existing covered-badge-pill styling; ensure contrast in dark export."
      },
      "data_testids": [
        "payroll-covered-share-button",
        "payroll-covered-download-png-button",
        "payroll-covered-share-preview"
      ]
    },
    "theme_aware_favicon": {
      "ux": [
        "Provide two favicon assets: default + brighter/high-contrast for dark theme.",
        "Swap on theme toggle immediately; no page reload."
      ],
      "visual_spec": {
        "light": "current mark ok",
        "dark": "brighter teal + mint highlight; avoid pure white-only mark to reduce glare"
      },
      "data_testids": ["theme-toggle-button"]
    },
    "first_time_tour_dashboard": {
      "tour_structure": {
        "steps": [
          {
            "id": "tour-step-1",
            "target": "Payroll covered summary card",
            "message": "This is your 'Payroll covered' snapshot — the one you can share with your crew."
          },
          {
            "id": "tour-step-2",
            "target": "Plan / Next actions area",
            "message": "These are the next moves Gapless recommends to keep payroll covered."
          },
          {
            "id": "tour-step-3",
            "target": "Buy / Paywall entry point",
            "message": "Unlock monthly demo access here — cancel anytime."
          }
        ]
      },
      "overlay_spec": {
        "spotlight": "Use an SVG mask spotlight with rounded rect hole; animate between targets using Framer Motion layoutId for liquid morph.",
        "scrim": "Use --scrim (not full black).",
        "tooltip": "Glass tooltip (g-glass) with solid inner content block for text readability.",
        "pointer_behavior": "Overlay captures clicks; provide 'Next', 'Back', 'Skip' buttons. Do not allow interacting with underlying UI during tour (use inert on app root)."
      },
      "accessibility": [
        "Treat tour as modal dialog: role=dialog, aria-modal=true.",
        "Trap focus inside tooltip; restore focus to previously focused element on close.",
        "Announce step changes via aria-live=polite region.",
        "Reduced motion: disable spotlight morph transforms; crossfade spotlight + tooltip only."
      ],
      "data_testids": [
        "dashboard-tour-overlay",
        "dashboard-tour-next-button",
        "dashboard-tour-back-button",
        "dashboard-tour-skip-button",
        "dashboard-tour-step-indicator"
      ]
    },
    "spanish_landing_toggle": {
      "ux": [
        "Language toggle lives in landing top bar (right side) as segmented control (EN/ES).",
        "Persist choice in localStorage; default to browser language if Spanish (es-*) and first visit.",
        "Do not auto-translate numbers/currency formatting unless explicitly localized; keep numeric formatting consistent." 
      ],
      "visual_spec": {
        "control": "Use existing .seg styling but upgrade container to glass (g-glass) on landing top bar.",
        "copy": "Spanish copy should be concise; avoid idioms; keep CTA verbs short."
      },
      "data_testids": ["landing-language-toggle", "landing-language-en", "landing-language-es"]
    },
    "stripe_subscription_paywall": {
      "flow": {
        "recommended": "Stripe Checkout (hosted) for fastest, most reliable conversion.",
        "entry_points": ["Landing primary CTA", "Dashboard locked action", "Buy page"],
        "states": ["locked", "checkout_redirecting", "return_success", "return_cancel"],
        "return_routes": "Provide a dedicated return/status screen with clear next action back to Dashboard."
      },
      "ui_pattern": {
        "primary": "Use a right-side Sheet (existing .sheet) but restyle to glass header + solid body.",
        "content": [
          "Plan name + price (monthly demo access)",
          "3 bullet benefits max",
          "Trust row: 'Secure checkout by Stripe' + small lock icon",
          "Primary CTA: 'Continue to Stripe'",
          "Secondary: 'Not now'"
        ]
      },
      "visual_spec": {
        "sheet_header": "g-glass with subtle noise; keep title large and price prominent.",
        "sheet_body": "solid surface for readability; avoid glass behind long text.",
        "cta": "Primary teal button; on pointer-down immediate feedback; show spinner state."
      },
      "data_testids": [
        "paywall-open-button",
        "paywall-sheet",
        "paywall-continue-to-stripe-button",
        "paywall-close-button",
        "billing-return-status"
      ]
    }
  },
  "motion_and_microinteractions": {
    "global_rules": [
      "Feedback on pointer-down (not only click).",
      "Prefer Framer Motion springs for sheets/tour spotlight; avoid CSS keyframes for gesture-driven motion.",
      "No transition: all. Only transition background/border/shadow/opacity (already mostly compliant)."
    ],
    "spring_defaults": {
      "move_reposition": {"type": "spring", "damping": 30, "stiffness": 260, "mass": 1},
      "drawer_sheet": {"type": "spring", "damping": 28, "stiffness": 320, "mass": 0.9},
      "press": {"type": "spring", "damping": 35, "stiffness": 600, "mass": 0.6}
    },
    "reduced_motion": {
      "strategy": "Use MotionConfig reducedMotion='user' and/or useReducedMotion() to swap transforms for opacity-only transitions.",
      "css": "prefers-reduced-motion already disables animations/transitions in App.css; ensure Motion respects it too."
    }
  },
  "accessibility": {
    "requirements": [
      "WCAG AA contrast for text on glass: if glass reduces contrast, increase opacity (use --glass-bg-strong) or switch to solid.",
      "Min tap target 44px (already used).",
      "Keyboard: focus-visible ring must be visible on both themes.",
      "Tour/paywall are modal: trap focus; inert background; ESC closes."
    ]
  },
  "image_urls": {
    "notes": "No new photography required; rely on existing brand mark + subtle CSS noise. If a hero illustration is desired later, use abstract teal glass shapes.",
    "categories": []
  },
  "libraries_and_integrations": {
    "framer_motion": {
      "use": ["tour spotlight morph", "paywall sheet entrance/exit", "press feedback"],
      "notes": ["Project already has Framer Motion 11 per brief."]
    },
    "stripe": {
      "use": ["Checkout for subscription paywall"],
      "notes": [
        "Use Stripe Checkout hosted page for conversion and speed.",
        "shipbysundown.dev page is a general Stripe tools primer; actual implementation should follow Stripe Checkout + Billing docs."
      ]
    }
  },
  "instructions_to_main_agent": [
    "Create /app/design_guidelines.md (this file) and /app/interaction_spec.md (separate) — do not implement code in this task.",
    "Preserve existing teal palette and current layout; apply glass tokens to top chrome, sheets, and tour tooltip only.",
    "Ensure all new buttons/inputs/links and key status text include data-testid attributes.",
    "For PNG export: render a dedicated export component with solid background; do not rely on backdrop-filter in the rasterized output.",
    "For favicon: provide light + dark assets and swap based on theme state.",
    "For tour: implement as accessible modal with spotlight mask; use layoutId morph; reduced-motion crossfade.",
    "For Stripe paywall: use Sheet pattern; CTA redirects to Stripe Checkout; add return status page." 
  ],
  "appendix_general_ui_ux_design_guidelines": "<General UI UX Design Guidelines>\n    - You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n    - You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n\t- Prioritize using pre-existing components from src/components/ui when applicable\n\t- Create new components that match the style and conventions of existing components when needed\n\t- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n\t- Use Shadcn/UI as the primary component library for consistency and accessibility\n\t- Import path: ./components/[component-name]\n\n**Export Conventions:**\n\t- Components MUST use named exports (export const ComponentName = ...)\n\t- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals.\n</General UI UX Design Guidelines>"
}
