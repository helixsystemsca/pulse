# Design System Strategy: Industrial Empathy

## 1. Overview & Creative North Star
This design system is built on the philosophy of **"Industrial Empathy."** Traditional industrial SaaS is often cold, rigid, and intimidating. We are breaking that mold by blending the high-contrast utility required for field work with an approachable, human-centric aesthetic. 

The Creative North Star is **The Friendly Toolbelt**. Like a high-quality piece of equipment that feels good in the hand, this system prioritizes tactile softness (large radii) and absolute clarity (high-contrast navy on white). We move beyond the "template" look by utilizing intentional asymmetry—heavy left-aligned typography paired with generous, breathing white space—to create an editorial feel that suggests precision without the clinical coldness.

---

## 2. Colors: High-Contrast Depth
The palette is anchored by a sophisticated, soft navy (`primary: #30568b`) that maintains professional authority while remaining accessible.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to define sections. Borders create visual noise that distracts from the content. Instead, define boundaries through background shifts. A `surface-container-low` section sitting on a `surface` background provides all the separation a user needs without the "boxed-in" feel of a legacy spreadsheet.

### Surface Hierarchy & Nesting
Treat the UI as a physical stack of materials. 
- **Base Level:** `surface (#f8f9fa)`
- **Secondary Content:** `surface-container-low (#f3f4f5)`
- **Actionable Cards:** `surface-container-lowest (#ffffff)`
This nesting creates a natural "lift" that guides the eye toward interaction points.

### The "Glass & Gradient" Rule
To elevate the experience, use Glassmorphism for floating elements (like sticky headers or mobile navigation). Apply `surface` colors at 80% opacity with a `backdrop-blur` of 12px. For primary CTAs, use a subtle linear gradient from `primary (#30568b)` to `primary_container (#4a6fa5)` at a 135-degree angle to give the buttons a "machined" 3D soul.

---

## 3. Typography: Approachable Authority
We pair the geometric friendliness of rounded typefaces with an editorial hierarchy to ensure information is scannable in high-glare outdoor environments.

*   **Display & Headlines (`plusJakartaSans`):** These are your "statement" levels. Use `display-lg` (3.5rem) with tight letter-spacing (-0.02em) to create a bold, modern industrial masthead. The rounded nature of the font prevents these large sizes from feeling aggressive.
*   **Body & Labels (`beVietnamPro`):** While headlines are "fun," the body text is the workhorse. We use `beVietnamPro` for its exceptional legibility. Use `body-lg` (1rem) for primary data points to ensure visibility in the field.
*   **Tonal Hierarchy:** Always use `on_surface_variant (#43474f)` for secondary descriptions to maintain a clear visual distinction from primary `on_surface (#191c1d)` headers.

---

## 4. Elevation & Depth: Tonal Layering
In this design system, shadows and lines are secondary to color-blocking. 

*   **The Layering Principle:** Depth is achieved by stacking. Place a `surface-container-lowest` card on a `surface-container` background. This creates a "soft-edge" elevation that feels integrated into the environment.
*   **Ambient Shadows:** When a floating state is required (e.g., a Modal or a FAB), use a custom shadow: `0 12px 32px rgba(48, 86, 139, 0.08)`. Note the use of the primary navy tint in the shadow—this prevents the UI from looking "dirty" or gray.
*   **The "Ghost Border" Fallback:** If accessibility requirements demand a container border, use `outline_variant (#c3c6d1)` at **20% opacity**. It should be felt, not seen.

---

## 5. Components: Tactile Precision

### Buttons
- **Primary:** High-contrast `primary (#30568b)` with `on_primary (#ffffff)` text. Radius set to `xl (1.5rem)` or `full`.
- **Secondary:** Use `secondary_container (#d2e1f2)` with `on_secondary_container (#556472)`. This provides a "soft" alternative that doesn't compete for the user's main attention.
- **Interactions:** On hover, shift the background to `primary_container`. On press, add a 2px inner "glow" using the `primary_fixed` color.

### Cards & Lists
- **Rule:** Absolute prohibition of horizontal divider lines. 
- **Execution:** Separate list items using `8 (2rem)` of vertical spacing or alternating subtle background tints (`surface` vs `surface-container-low`).
- **Cards:** Use `lg (1rem)` corner radius. If the card contains critical industrial data, use a 4px left-accent bar in `tertiary (#705000)` to signify importance without cluttering the layout.

### Input Fields
- **State:** Avoid the traditional 4-sided box. Use a "Heavy Underline" style or a fully rounded `surface-container-high` pill.
- **Focus:** When active, the background should shift to `surface_container_lowest` with a 2px `primary` outline.

### Signature Industrial Component: The "Status Pill"
For SaaS monitoring, use oversized chips. A "Running" state should use `primary_fixed` background with `on_primary_fixed` text, using the `full` roundedness scale for a friendly, lozenge-like appearance.

---

## 6. Do’s and Don'ts

### Do
- **Do** use asymmetrical margins. Larger left-hand padding (Scale `16` or `20`) creates a high-end editorial rhythm.
- **Do** lean into the "Rounded" aesthetic. If a component can be rounded, it should be at least `md (0.75rem)`.
- **Do** prioritize the `primary` navy for all interactive elements to build a strong mental model for the user.

### Don't
- **Don't** use pure black `#000000`. It is too harsh for the "Industrial Empathy" vibe; use `on_surface (#191c1d)` instead.
- **Don't** use standard 1px gray dividers. They represent "old-school" data-heavy design. We use white space to separate thoughts.
- **Don't** mix more than two corner radii on a single screen. Keep the "tactile" feel consistent.