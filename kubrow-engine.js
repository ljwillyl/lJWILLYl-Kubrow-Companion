'use strict';

/**
 * Kubrow Companion Genetics Engine (KCGE)
 * Engine version: 1.0.0
 * Specification: KCGE-1.0
 *
 * Compatibility guarantee:
 * - Read-only: never writes to Supabase or mutates input records.
 * - Preserves the existing window.KubrowEngine.analyse(record) API.
 * - Unknown and legacy records remain unresolved rather than being coerced.
 */
(() => {
  const ENGINE_VERSION = '1.0.0';
  const SPECIFICATION_VERSION = 'KCGE-1.0';

  const STANDARD_BREEDS = Object.freeze(['Chesa', 'Huras', 'Raksa', 'Sahasa', 'Sunika']);
  const STANDARD_BUILDS = Object.freeze(['Athletic', 'Skinny', 'Bulky']);

  const RULES = Object.freeze([
    Object.freeze({
      id: 'KCGE-001',
      title: 'Pure Kubrow',
      breedFamily: 'kubrow',
      buildFamily: 'kubrow',
      classification: 'pure-kubrow',
      label: 'Pure Kubrow',
      isHybrid: false,
      bodyFamily: 'kubrow',
      pattern: Object.freeze({ mode: 'selectable', family: 'kubrow', locked: false }),
      colours: Object.freeze({
        furSlots: 3,
        additionalSlot: Object.freeze({ visible: false, role: 'none', palette: null }),
        eye: Object.freeze({ visible: true, palette: 'energy' })
      }),
      evidence: Object.freeze({ level: 'community-verified', confidence: 'high', verifier: 'breeding-community' })
    }),
    Object.freeze({
      id: 'KCGE-002',
      title: 'Kubrow-breed Charger hybrid',
      breedFamily: 'kubrow',
      buildFamily: 'infested',
      classification: 'kubrow-breed-hybrid',
      label: 'Kubrow × Charger Hybrid',
      isHybrid: true,
      bodyFamily: 'infested',
      pattern: Object.freeze({ mode: 'forced', family: 'helminth', value: 'Helminth', locked: true }),
      colours: Object.freeze({
        furSlots: 3,
        additionalSlot: Object.freeze({ visible: true, role: 'inherited-energy', palette: 'energy' }),
        eye: Object.freeze({ visible: true, palette: 'energy' })
      }),
      evidence: Object.freeze({ level: 'community-verified', confidence: 'high', verifier: 'Figgy / breeding community' })
    }),
    Object.freeze({
      id: 'KCGE-003',
      title: 'Pure Helminth Charger',
      breedFamily: 'helminth',
      buildFamily: 'infested',
      classification: 'pure-helminth-charger',
      label: 'Pure Helminth Charger',
      isHybrid: false,
      bodyFamily: 'infested',
      pattern: Object.freeze({ mode: 'forced', family: 'helminth', value: 'Helminth', locked: true }),
      colours: Object.freeze({
        furSlots: 3,
        additionalSlot: Object.freeze({ visible: true, role: 'accent', palette: 'fur' }),
        eye: Object.freeze({ visible: true, palette: 'energy' })
      }),
      evidence: Object.freeze({ level: 'community-verified', confidence: 'high', verifier: 'Figgy / breeding community' })
    }),
    Object.freeze({
      id: 'KCGE-004',
      title: 'Charger-breed Kubrow hybrid',
      breedFamily: 'helminth',
      buildFamily: 'kubrow',
      classification: 'charger-breed-hybrid',
      label: 'Charger × Kubrow Hybrid',
      isHybrid: true,
      bodyFamily: 'kubrow',
      pattern: Object.freeze({ mode: 'selectable', family: 'kubrow', locked: false }),
      colours: Object.freeze({
        furSlots: 3,
        additionalSlot: Object.freeze({ visible: true, role: 'accent-fourth-colour', palette: 'fur' }),
        eye: Object.freeze({ visible: true, palette: 'energy' })
      }),
      evidence: Object.freeze({ level: 'community-verified', confidence: 'high', verifier: 'Figgy / breeding community' })
    })
  ]);

  const clean = value => String(value ?? '').trim();
  const normalise = value => clean(value)
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const STANDARD_BREED_KEYS = new Set(STANDARD_BREEDS.map(normalise));
  const STANDARD_BUILD_KEYS = new Set(STANDARD_BUILDS.map(normalise));

  function detectLegacy(record) {
    const values = [record?.breed, record?.companion_type, record?.build_type, record?.body_form, record?.notes]
      .map(normalise)
      .join(' ');
    return /kavat|abomination|glitch|glitched|legacy/.test(values);
  }

  function resolveBreedFamily(record) {
    const breed = normalise(record?.breed);
    const companion = normalise(record?.companion_type);

    if (breed === 'helminth charger' || companion === 'helminth charger' || companion === 'helminth') return 'helminth';
    if (STANDARD_BREED_KEYS.has(breed) || companion === 'kubrow') return 'kubrow';
    return 'unknown';
  }

  function resolveBuildFamily(record) {
    const build = normalise(record?.build_type || record?.body_form || record?.build);

    if (STANDARD_BUILD_KEYS.has(build) || build.includes('kubrow body')) return 'kubrow';
    if (build === 'helminth' || build === 'infested' || build.includes('charger body') || build.includes('infested body')) return 'infested';
    return 'unknown';
  }

  function immutableCopy(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function unresolved(record, reason, warnings = []) {
    return {
      engineVersion: ENGINE_VERSION,
      specificationVersion: SPECIFICATION_VERSION,
      mode: 'read-only',
      ruleId: 'KCGE-000',
      classification: 'unresolved',
      label: 'Needs review',
      isHybrid: null,
      breedFamily: resolveBreedFamily(record),
      bodyFamily: resolveBuildFamily(record),
      patternMode: 'unchanged',
      additionalColourRole: 'unchanged',
      additionalColourPalette: 'unknown',
      confidenceScore: 0,
      inputs: {
        breed: clean(record?.breed) || null,
        build: clean(record?.build_type || record?.body_form || record?.build) || null,
        companionType: clean(record?.companion_type) || null
      },
      evidence: { level: 'unresolved', confidence: 'none' },
      reason,
      warnings
    };
  }

  function analyse(record = {}) {
    if (!record || typeof record !== 'object') {
      return unresolved({}, 'Input must be a Kubrow record object.');
    }

    if (detectLegacy(record)) {
      return unresolved(record, 'Legacy or glitched companion detected.', [
        'Legacy Kubrow–Kavat abominations are intentionally outside KCGE v1.0.',
        'Their imprints are not part of the modern tradeable breeding model.'
      ]);
    }

    const breedFamily = resolveBreedFamily(record);
    const buildFamily = resolveBuildFamily(record);

    if (breedFamily === 'unknown' || buildFamily === 'unknown') {
      return unresolved(record, 'A recognised breed and build are required for classification.', [
        'KCGE never guesses missing or unrecognised genetics.'
      ]);
    }

    const rule = RULES.find(candidate => candidate.breedFamily === breedFamily && candidate.buildFamily === buildFamily);
    if (!rule) return unresolved(record, 'No KCGE rule matched this combination.');

    const result = immutableCopy(rule);
    return {
      engineVersion: ENGINE_VERSION,
      specificationVersion: SPECIFICATION_VERSION,
      mode: 'read-only',
      ruleId: result.id,
      classification: result.classification,
      label: result.label,
      isHybrid: result.isHybrid,
      breedFamily,
      bodyFamily: result.bodyFamily,
      pattern: result.pattern,
      colours: result.colours,
      // Backwards-compatible fields consumed by the v6.2.4 Kennel preview.
      patternMode: result.pattern.mode === 'forced' ? 'helminth-expected' : 'kubrow-selectable',
      additionalColourRole: result.colours.additionalSlot.role,
      additionalColourPalette: result.colours.additionalSlot.palette || 'none',
      confidenceScore: result.evidence.confidence === 'high' ? 0.95 : 0.75,
      inputs: {
        breed: clean(record?.breed) || null,
        build: clean(record?.build_type || record?.body_form || record?.build) || null,
        companionType: clean(record?.companion_type) || null
      },
      evidence: result.evidence,
      warnings: []
    };
  }

  function validate(record = {}) {
    const analysis = analyse(record);
    const issues = [];
    const pattern = normalise(record?.pattern);

    if (analysis.classification === 'unresolved') {
      issues.push({ severity: 'warning', code: 'KCGE-V001', message: analysis.reason });
      return { valid: false, analysis, issues };
    }

    if (analysis.pattern?.locked && pattern && pattern !== 'helminth') {
      issues.push({
        severity: 'warning',
        code: 'KCGE-V002',
        message: `${analysis.label} is expected to use the Helminth pattern.`
      });
    }

    return { valid: issues.length === 0, analysis, issues };
  }

  function getRule(ruleId) {
    const rule = RULES.find(item => item.id === ruleId);
    return rule ? immutableCopy(rule) : null;
  }

  function listRules() {
    return immutableCopy(RULES);
  }

  function enabled() {
    return window.KUBROW_ENGINE_ENABLED !== false && localStorage.getItem('kubrowEngineDisabled') !== 'true';
  }

  window.KubrowEngine = Object.freeze({
    version: ENGINE_VERSION,
    specificationVersion: SPECIFICATION_VERSION,
    analyse,
    validate,
    getRule,
    listRules,
    enabled,
    constants: Object.freeze({
      standardBreeds: [...STANDARD_BREEDS],
      standardBuilds: [...STANDARD_BUILDS]
    })
  });
})();
