# KCGE 1.0 Testing

## Automated checks

1. `Huras + Bulky` returns `KCGE-001`.
2. `Huras + Infested` returns `KCGE-002`.
3. `Helminth Charger + Infested` returns `KCGE-003`.
4. `Helminth Charger + Athletic` returns `KCGE-004`.
5. Missing breed/build returns `KCGE-000` and never guesses.
6. Legacy/glitched/Kavat records return `KCGE-000`.
7. The existing `KubrowEngine.analyse(record)` interface remains available.

## Browser test

Open `kcge-diagnostics.html` and confirm the four-branch test shows four green ticks.

## Regression test

After replacing `kubrow-engine.js`:

- My Kennel loads normally.
- Existing cards still show their classification label.
- Editing and saving records still works.
- No new Supabase columns or SQL are required.
