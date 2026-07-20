# Kubrow Companion Genetics Engine (KCGE)

## Specification version KCGE-1.0

KCGE classifies modern Kubrow and Helminth Charger variants using two visible inputs:

1. Breed
2. Build

The hidden body family is derived internally and is not presented as an extra question to users.

## Decision matrix

| Rule | Breed family | Build family | Classification | Pattern | Fourth colour |
|---|---|---|---|---|---|
| KCGE-001 | Standard Kubrow | Athletic, Skinny or Bulky | Pure Kubrow | Kubrow pattern selectable | None |
| KCGE-002 | Standard Kubrow | Infested | Kubrow × Charger hybrid | Helminth, locked | Energy palette |
| KCGE-003 | Helminth Charger | Infested | Pure Helminth Charger | Helminth, locked | Fur-palette accent |
| KCGE-004 | Helminth Charger | Athletic, Skinny or Bulky | Charger × Kubrow hybrid | Kubrow pattern selectable | Fur-palette fourth colour |

## Scope

KCGE-1.0 covers the complete modern, tradeable Kubrow/Charger breeding model described by experienced breeders.

Historic Kubrow–Kavat abominations and other glitched legacy pets are deliberately excluded. They are extremely rare, do not fit the modern four-branch model, and their imprints are not treated as normal market genetics.

## Evidence policy

Rules may be labelled:

- Official
- Community verified
- Experimental
- Legacy
- Deprecated

The hybrid and fourth-slot rules are community verified through long-term breeding experience, EE.log analysis, controlled breeding chains and specimen observation. Figgy is credited as a genetics research contributor to KCGE-1.0.

## Safety contract

KCGE-1.0 is read-only. It does not:

- write to Supabase;
- change existing records;
- alter scanner save payloads;
- alter marketplace listings;
- force corrections to legacy data.
