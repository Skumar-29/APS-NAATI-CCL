(function (globalScope) {
  "use strict";

  const BUNDLE_PATH =
    "content/pilot50/batch01-runtime-overlay-v1.json";

  function cloneJson(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function unique(values) {
    return Array.from(
      new Set(
        (values || []).filter(
          value => typeof value === "string" && value.length > 0
        )
      )
    );
  }

  function mergeIds(target, key, values) {
    const incoming = unique(values);

    if (incoming.length === 0) {
      return;
    }

    if (Array.isArray(target[key])) {
      target[key] = unique(target[key].concat(incoming));
    } else {
      target[key] = incoming;
    }
  }

  function mergeExistingIdArrays(target, matcher, values) {
    const matchingKeys = Object.keys(target).filter(
      key => Array.isArray(target[key]) && matcher.test(key)
    );

    if (matchingKeys.length === 0) {
      return false;
    }

    matchingKeys.forEach(
      key => mergeIds(target, key, values)
    );
    return true;
  }

  function patchSegment(target, overlay) {
    const content = overlay.content || {};
    Object.keys(content).forEach(
      key => {
        target[key] = cloneJson(content[key]);
      }
    );

    const aliases = overlay.fieldAliases || {};
    const sourceText = content.sourceText;
    const sampleAnswer = content.sampleAnswer;

    if (typeof sourceText === "string") {
      (aliases.sourceFields || []).forEach(
        key => {
          target[key] = sourceText;
        }
      );
    }

    if (typeof sampleAnswer === "string") {
      (aliases.answerFields || []).forEach(
        key => {
          target[key] = sampleAnswer;
        }
      );
    }

    const vocabMerged = mergeExistingIdArrays(
      target,
      /vocab.*ids?$/i,
      overlay.vocabularyIds
    );
    const phrasesMerged = mergeExistingIdArrays(
      target,
      /phrase.*ids?$/i,
      overlay.phraseIds
    );

    if (!vocabMerged) {
      mergeIds(
        target,
        "vocabularyIds",
        overlay.vocabularyIds
      );
    }

    if (!phrasesMerged) {
      mergeIds(
        target,
        "phraseIds",
        overlay.phraseIds
      );
    }

    mergeIds(
      target,
      "optionalVocabularyIds",
      overlay.optionalVocabularyIds
    );
    mergeIds(
      target,
      "optionalPhraseIds",
      overlay.optionalPhraseIds
    );

    target.pilot50 = {
      approved: true,
      overlayVersion: "pilot50-batch01-runtime-overlay-v1",
      productionApproved: false
    };
  }

  function patchSegments(value, segments, patchedIds) {
    if (Array.isArray(value)) {
      value.forEach(
        item => patchSegments(item, segments, patchedIds)
      );
      return;
    }

    if (!value || typeof value !== "object") {
      return;
    }

    const currentId = value.id || value.segmentId;
    const overlay = segments[currentId];

    if (overlay) {
      patchSegment(value, overlay);
      patchedIds.add(currentId);
    }

    Object.keys(value).forEach(
      key => patchSegments(
        value[key],
        segments,
        patchedIds
      )
    );
  }

  function findRecordArray(payload, kind) {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (!payload || typeof payload !== "object") {
      return null;
    }

    const keys = (
      kind === "vocabulary"
        ? ["items", "vocabulary", "records"]
        : ["items", "phrases", "records"]
    );

    for (const key of keys) {
      if (Array.isArray(payload[key])) {
        return payload[key];
      }
    }

    return null;
  }

  function appendRecords(payload, records, kind) {
    const target = findRecordArray(payload, kind);

    if (!target) {
      throw new Error(
        `Could not find ${kind} record array in content payload.`
      );
    }

    const existingIds = new Set(
      target
        .map(record => record && record.id)
        .filter(Boolean)
    );

    records.forEach(
      record => {
        if (existingIds.has(record.id)) {
          throw new Error(
            `Pilot 50 ${kind} ID collision: ${record.id}`
          );
        }

        target.push(cloneJson(record));
        existingIds.add(record.id);
      }
    );
  }

  function pathName(input) {
    const value = (
      typeof input === "string"
        ? input
        : input && input.url
          ? input.url
          : ""
    );

    try {
      const base = (
        globalScope.location
          ? globalScope.location.href
          : "https://aps.local/"
      );
      return new URL(value, base).pathname;
    } catch (_) {
      return value;
    }
  }

  function isHindiOrStarter(path) {
    return (
      path.includes("/content/packs/hi/")
      || path.endsWith("/content/dialogues.json")
      || path.endsWith("/content/starter_vocab.json")
      || path.endsWith("/content/starter_phrases.json")
    );
  }

  function mergePayload(path, payload, bundle) {
    const result = cloneJson(payload);

    if (!isHindiOrStarter(path)) {
      return result;
    }

    if (path.endsWith("/dialogues.json")) {
      const patchedIds = new Set();
      patchSegments(
        result,
        bundle.segments || {},
        patchedIds
      );
      return result;
    }

    if (
      path.endsWith("/vocabulary.json")
      || path.endsWith("/starter_vocab.json")
    ) {
      appendRecords(
        result,
        bundle.vocabulary || [],
        "vocabulary"
      );
      return result;
    }

    if (
      path.endsWith("/phrases.json")
      || path.endsWith("/starter_phrases.json")
    ) {
      appendRecords(
        result,
        bundle.phrases || [],
        "phrases"
      );
      return result;
    }

    return result;
  }

  function shouldIntercept(input, init) {
    const method = (
      init && init.method
        ? String(init.method).toUpperCase()
        : "GET"
    );

    if (method !== "GET") {
      return false;
    }

    const path = pathName(input);

    if (!path.includes("/content/")) {
      return false;
    }

    if (path.includes("/content/pilot50/")) {
      return false;
    }

    return (
      path.endsWith("/dialogues.json")
      || path.endsWith("/vocabulary.json")
      || path.endsWith("/phrases.json")
      || path.endsWith("/starter_vocab.json")
      || path.endsWith("/starter_phrases.json")
    );
  }

  function resolveProgressKey(recordId, bundle) {
    const aliases = (
      bundle && bundle.progressAliases
        ? bundle.progressAliases
        : {}
    );
    return aliases[recordId] || recordId;
  }

  function installFetchInterceptor(scope) {
    if (
      !scope
      || typeof scope.fetch !== "function"
      || scope.__apsPilot50FetchInstalled
    ) {
      return null;
    }

    const originalFetch = scope.fetch.bind(scope);
    const bundlePromise = originalFetch(
      BUNDLE_PATH,
      { cache: "no-store" }
    ).then(
      response => {
        if (!response.ok) {
          throw new Error(
            `Pilot 50 overlay HTTP ${response.status}`
          );
        }
        return response.json();
      }
    );

    scope.__apsPilot50FetchInstalled = true;

    scope.fetch = async function (
      input,
      init
    ) {
      const response = await originalFetch(input, init);

      if (!shouldIntercept(input, init)) {
        return response;
      }

      try {
        const bundle = await bundlePromise;
        const payload = await response.clone().json();
        const merged = mergePayload(
          pathName(input),
          payload,
          bundle
        );
        const headers = new Headers(response.headers);
        headers.set(
          "content-type",
          "application/json; charset=utf-8"
        );

        return new Response(
          JSON.stringify(merged),
          {
            status: response.status,
            statusText: response.statusText,
            headers
          }
        );
      } catch (error) {
        console.error(
          "APS Pilot 50 runtime overlay failed; "
          + "canonical content will be used.",
          error
        );
        return response;
      }
    };

    return bundlePromise;
  }

  const api = {
    BUNDLE_PATH,
    mergePayload,
    resolveProgressKey,
    installFetchInterceptor
  };

  const isCommonJs = (
    typeof module !== "undefined"
    && module.exports
  );

  if (isCommonJs) {
    module.exports = api;
  }

  if (globalScope) {
    globalScope.APSPilot50Runtime = api;

    /*
     * Install automatically only inside the browser runtime.
     * Node.js 24 exposes a global fetch function, but it does not
     * resolve browser-relative asset URLs such as
     * content/pilot50/batch01-runtime-overlay-v1.json.
     * The validator imports this module through CommonJS and calls
     * mergePayload directly, so auto-installation must remain off
     * in Node.
     */
    if (
      !isCommonJs
      && typeof window !== "undefined"
      && globalScope === window
      && globalScope.document
    ) {
      globalScope.APSPilot50Ready =
        installFetchInterceptor(globalScope);
    }
  }
})(
  typeof window !== "undefined"
    ? window
    : (
        typeof globalThis !== "undefined"
          ? globalThis
          : this
      )
);
