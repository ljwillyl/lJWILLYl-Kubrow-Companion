'use strict';

/**
 * Kubrow Companion Genetics Engine — compatibility preview
 * Version 0.1.0
 *
 * Read-only by design. This module never writes to Supabase or mutates records.
 */
(() => {
  const VERSION = '0.1.0';
  const SPECIFICATION_VERSION = 'community-draft-1.0';
  const STANDARD_BREEDS = new Set(['chesa', 'huras', 'raksa', 'sahasa', 'sunika']);
  const STANDARD_BUILDS = new Set(['bulky', 'athletic', 'skinny']);

  const clean = (value) => String(value ?? '').trim();
  const normalise = (value) => clean(value).toLowerCase().replaceAll('_', ' ').replace(/\s+/g, ' ');

  function breedFamily(record) {
    const breed = normalise(record?.breed);
    const companion = normalise(record?.companion_type);
    if (breed === 'helminth charger' || companion === 'helminth charger') return 'helminth';
    if (STANDARD_BREEDS.has(breed)) return 'kubrow';
    if (companion === 'kubrow') return 'kubrow';
    if (companion.includes('hybrid') || breed.includes('hybrid')) return 'unknown-hybrid';
    return 'unknown';
  }

  function buildFamily(record) {
    const build = normalise(record?.build_type || record?.body_form);
    if (STANDARD_BUILDS.has(build)) return 'kubrow';
    if (build === 'helminth' || build === 'infested' || build.includes('charger body')) return 'infested';
    if (build.includes('kubrow body')) return 'kubrow';
    return 'unknown';
  }

  function resultBase(record) {
    return {
      engineVersion: VERSION,
      specificationVersion: SPECIFICATION_VERSION,
      mode: 'read-only',
      inputs: {
        breed: clean(record?.breed) || null,
        build: clean(record?.build_type || record?.body_form) || null,
        companionType: clean(record?.companion_type) || null
      },
      evidence: {
        level: 'community-draft',
        confidence: 'provisional'
      },
      warnings: []
    };
  }

  function analyse(record) {
    const output = resultBase(record);
    const breed = breedFamily(record);
    const body = buildFamily(record);

    output.breedFamily = breed;
    output.bodyFamily = body;

    if (breed === 'kubrow' && body === 'kubrow') {
      Object.assign(output, {
        ruleId: 'KC-KUBROW-PURE-001',
        classification: 'pure-kubrow',
        label: 'Standard Kubrow',
        isHybrid: false,
        patternMode: 'kubrow-selectable',
        additionalColourRole: 'eye-energy',
        additionalColourPalette: 'energy',
        confidenceScore: 0.98
      });
      output.evidence = { level: 'documented-and-community', confidence: 'high' };
      return output;
    }

    if (breed === 'kubrow' && body === 'infested') {
      Object.assign(output, {
        ruleId: 'KC-KUBROW-INFESTED-001',
        classification: 'kubrow-breed-hybrid',
        label: 'Kubrow × Charger Hybrid',
        isHybrid: true,
        patternMode: 'helminth-expected',
        additionalColourRole: 'inherited-energy',
        additionalColourPalette: 'energy',
        confidenceScore: 0.76
      });
      output.warnings.push('Hybrid rules are community-derived and remain under specimen validation.');
      return output;
    }

    if (breed === 'helminth' && body === 'infested') {
      Object.assign(output, {
        ruleId: 'KC-CHARGER-PURE-001',
        classification: 'pure-helminth-charger',
        label: 'Helminth Charger',
        isHybrid: false,
        patternMode: 'helminth-expected',
        additionalColourRole: 'accent',
        additionalColourPalette: 'fur',
        confidenceScore: 0.86
      });
      output.warnings.push('Fourth-channel palette behaviour is community-derived and remains under validation.');
      return output;
    }

    if (breed === 'helminth' && body === 'kubrow') {
      Object.assign(output, {
        ruleId: 'KC-CHARGER-KUBROW-001',
        classification: 'charger-breed-hybrid',
        label: 'Charger × Kubrow Hybrid',
        isHybrid: true,
        patternMode: 'kubrow-selectable',
        additionalColourRole: 'accent-fourth-colour',
        additionalColourPalette: 'fur',
        confidenceScore: 0.74
      });
      output.warnings.push('Hybrid rules are community-derived and remain under specimen validation.');
      return output;
    }

    Object.assign(output, {
      ruleId: 'KC-UNRESOLVED-001',
      classification: 'unresolved',
      label: 'Needs breed and build',
      isHybrid: null,
      patternMode: 'unchanged',
      additionalColourRole: 'unchanged',
      additionalColourPalette: 'unknown',
      confidenceScore: 0
    });
    output.warnings.push('The current record does not contain enough recognised information to classify safely.');
    return output;
  }

  function enabled() {
    return window.KUBROW_ENGINE_ENABLED !== false && localStorage.getItem('kubrowEngineDisabled') !== 'true';
  }

  window.KubrowEngine = Object.freeze({
    version: VERSION,
    specificationVersion: SPECIFICATION_VERSION,
    analyse,
    enabled
  });
})();
