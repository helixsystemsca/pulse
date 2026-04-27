# Fix Blueprint Toolbar Border Lines — integration.md

## CURSOR PROMPT
"Read handoffs/integration.md. Execute the fix. Commit when done."

---

## ROOT CAUSE
BlueprintToolRail.tsx buttons have `border-b-2` class applied either
directly or inherited from a shared button style. This shows as
underline marks on every tool button in the toolbar.

---

=== MODIFY: frontend/components/zones-devices/BlueprintToolRail.tsx ===

Step 1 — Find every button or motion.button in the file that has:
  `border-b-2`
Remove that class from all tool rail buttons.

Step 2 — Find the bp-tool-rail__btn CSS class definition.
Check if it inherits from any tab button class that adds border-b.
Remove any `border-bottom` or `border-b` rules from:
  `.bp-tool-rail__btn`
  `.bp-tool-rail__btn.is-active`

Step 3 — Check blueprint-designer.css for:
```css
.bp-tool-rail__btn {
```
Remove any `border-bottom` property from this rule.
The active state should use background-color only, not a border indicator.

---

## EXECUTION STEPS
1. Remove border-b-2 from tool rail button classes in BlueprintToolRail.tsx
2. Remove border-bottom from .bp-tool-rail__btn in blueprint-designer.css
3. git add -A && git commit -m "fix: remove border-b artifact from blueprint toolbar buttons"
4. git push origin main

---

## VALIDATION
- [ ] Blueprint toolbar shows no underline marks under icons
- [ ] Active tool still has visible highlight (background, not border)
- [ ] Module tab navs elsewhere unaffected
- [ ] Vercel build passes

---

## UPDATE architecture/current_state.md
- Add to Known Issues resolved: blueprint toolbar border artifact fixed
- Update Last Updated date
git add architecture/current_state.md
git commit -m "chore: update current_state after blueprint toolbar fix"
