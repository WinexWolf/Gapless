# Gapless

Gapless closes a small business's payroll gap and then buys its materials through an agent that never breaks cash flow; this doc covers what is live, how the buying agent reads a materials list, and what to build next.

Live site: <https://bay-remodel-cash.emergent.host/>

---

## What is live today

The public landing page is live at `bay-remodel-cash.preview.emergentagent.com`, and it already sells both halves of the product: the payroll gap and the buying agent. I read the landing page only. The interactive app sits behind a sign-in, and I did not create an account, so the screens inside it are unchecked here.

**Two things to fix before judging:**

- The "monthly demo access" paywall can block a judge who clicks **Explore the demo**, so make the demo open without payment.
- The page also shows a testimonial from Rosa Marquez; it is labeled fictional, which is correct, so keep that label.

---

## How the buying agent understands what you want

The agent turns a loose line like "nails, planks" into a complete item spec, and it never asks a supplier for a quote until every required field is filled or confirmed by Maria. The AI reads and phrases; plain rules check completeness, so a guess can never reach a supplier.

### Step 1: Extract a structured line item

Every line in the email becomes one record with these fields. A field is either **filled**, **defaulted** from Maria's past orders (and shown for her to confirm), or **marked missing**.

### Step 2: Required fields per category

### Example: "nails, planks"

Maria writes: *"I need nails and planks for the Nguyen deck by Thursday."* Two lines come back with gaps, so the agent replies to Maria, not to a supplier:

**Planks.** "Planks for what? Decking, fence or flooring?" She says decking, so the agent asks: species or composite, nominal size (5/4x6 or 2x6), length, treated or cedar, and how many boards. It can offer her last order as a default: "5/4x6x12 ft pressure-treated, 80 boards?"

**Nails.** "Which nails? Deck screws, framing nails or ring-shank?" For a deck: exterior-rated fasteners, so galvanized or stainless is required and bright nails are blocked. The agent asks length, diameter or gauge, coating, and box weight or count.

Only after Maria confirms does the agent send the final spec:

> "80 pressure-treated deck boards, 5/4x6 nominal, 12 ft, #2 grade; 10 boxes of 5 lb hot-dip galvanized 3 in deck screws, #9."

### Rules that keep it correct

- **Nominal versus actual.** A 2x4 is 1.5 x 3.5 in; the agent stores both and tells suppliers the nominal name.
- **Safety checks.** Outdoor use blocks uncoated fasteners and untreated lumber in ground contact. Structural use requires a stated grade.
- **No silent substitutions.** A supplier counter-offering a different species, size or grade is shown to Maria as a substitution with the price difference, never accepted automatically.
- **Memory.** Past confirmed specs become defaults, so the second request is shorter.
- **Ambiguous words** such as "planks", "studs" and "screws" always trigger a clarifying question; a missing quantity or length blocks sending.

---

## The buy flow, step by step

1. **Request.** Maria emails the agent's inbox or pastes a list: items, quantities, a delivery deadline and a spending limit.
2. **Spec check.** The agent builds the structured line items above and asks Maria about anything missing. Nothing goes to a supplier before this passes.
3. **Mandate.** Maria's limits are fixed in code: maximum total, latest delivery, preferred payment terms, which suppliers it may contact, and that she gives final approval.
4. **Sealed sourcing.** Each supplier gets its own isolated thread. It sees only its own conversation, never other quotes or Maria's limit. Suppliers with an agent trade structured offers (agent to agent); others get plain email (agent to human); no reply after a set time means the supplier is dropped.
5. **Negotiation inside limits.** The agent counters on price, terms or delivery. Rules check every number against the mandate, and a counter above the limit is rejected in code.
6. **Quote comparison.** Maria sees quotes side by side: price, terms, delivery time, on-time record and the cash impact on Friday. The agent recommends one, and Maria approves, picks another, or denies all.
7. **Early-pay check.** If the supplier offers a discount for paying early, a rule pays only if the projected Friday balance stays at or above zero after the payment.
8. **Payment.** Maria approves a one-time spend request (Stripe test mode). The agent never holds card details.
9. **Delivery.** The agent asks the supplier for carrier, reference and driver contact, shows the truck on a map, alerts Maria to delays, and offers backup stock if the deadline will be missed.
10. **Receipt match.** Maria confirms what arrived and the agent matches quantities and the invoice to the approved quote.

> **Design rule behind every step:** the AI writes words and reads messages; plain code decides every number, date and approval.

---

## Next steps and features

Finish the demo path first (steps 1 to 4), then add what makes the buying agent credible to a judge. Effort is a rough guess.

**Open question for Maria's persona:** which three suppliers are in the demo network, and what do they sell? The catalog needs real product names with sizes.

---

## Submission answers and demo script

### Your customer and how they handle the problem today

Owners of small trade businesses, like a six-person remodeling company, who must cover payroll while customers pay late, and who today chase invoices by text, ask suppliers for more time and guess from a spreadsheet, with no tool that shows the exact gap or the cheapest way to close it.

### What you built

Gapless shows a small business exactly how short it will be on payroll day and ranks the cheapest fixes (reminders, early-pay discounts, payment splits, supplier extensions), which the owner approves while AI agents negotiate with customers and suppliers inside code-enforced guardrails. The same agent then buys materials through sealed supplier quotes, pays with a Stripe test-mode spend request, and tracks the delivery on a map, so a purchase never reopens the payroll gap.

### Research and data

- The median small business holds 27 days of cash buffer, and the median construction business holds 20 (JPMorgan Chase Institute, 597,000 businesses, 2015 data).
- 64% of small businesses are affected by late payments, and half of net-30 invoices are paid late (Fundbox analysis, 2015).
- A widely cited U.S. Bank study, quoted in the same article, says 82% of small business failures involve poor cash flow management. I saw this secondhand only.
- The demo's numbers are synthetic, and the app says so.
- Both main sources are several years old, so present them as the long-standing pattern.

### Demo script (about 1:50)

Three animated clips (about 24 seconds), then the live app.

1. Maria runs a six-person remodeling company. Friday is payroll, and she's $9,800 short.
2. Her customers are weeks late. Her lumber supplier wants paying. Her crew is counting on Friday.
3. Tonight she'd spend the night guessing. Instead, she opens Gapless.
4. Gapless shows the gap before it hits, short $9,800 on Friday, and builds the cheapest plan to close it.
5. Four moves, ranked by cost: a reminder to Lee, a 1.5% early-pay offer to Patel, a split for Johnson, an extension from Pacific Lumber. Plain rules rank them, not AI. Discounts and fees are capped, and nothing sends without Maria's approval.
6. Counterparties respond. Pacific has its own agent. It asks for a 1% fee, our guardrail checks it in code, and the agents settle at 0.75%. Payments land and the gap closes.
7. Then the same agent buys. Maria emails a materials list. It asks suppliers separately, negotiates inside her limit, and brings back two quotes. Pacific costs $20 more but keeps $3,370 out of Friday. She approves, pays through a Stripe spend request, and tracks the truck.
8. AI writes and negotiates. Rules decide the money. Maria approves. **Gapless: never be short on Friday again.**

---

## Sources

- JPMorgan Chase Institute: cash flows, balances and buffer days, opened 2026-10-25
- Fundbox data analysis, via Construction Business Owner, opened 2026-10-25
- Live site (landing page only): `bay-remodel-cash.preview.emergentagent.com`, read 2026-10-25
- Nail and lumber size facts (a 2x4 is 1.5 x 3.5 in actual; 16d = 3.5 in) are standard construction conventions I stated from general knowledge, not from a page I opened.
