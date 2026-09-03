'use strict';

(() => {
  const CLOUD_VERSION = 'aps-naati-cloud-sync-v19-5';
  const FIREBASE_SDK_VERSION = '12.16.0';
  const FIREBASE_PROJECT_ID = 'aps-naati-ccl-practice';
  const BUNDLED_FIREBASE_CONFIG = Object.freeze({
    apiKey: 'AIzaSyBZJE_IRngKyWdHt_a4wJ42rmvbl7SF5Kw',
    authDomain: 'aps-naati-ccl-practice.firebaseapp.com',
    projectId: 'aps-naati-ccl-practice',
    storageBucket: 'aps-naati-ccl-practice.firebasestorage.app',
    messagingSenderId: '307665336989',
    appId: '1:307665336989:web:7505c82e8282a574b0b274',
    measurementId: 'G-XPY3T9J090'
  });
  const CONFIG_KEY = 'apsFirebaseWebConfigV1';
  const META_KEY = 'apsCloudSyncMetaV1';
  const STATUS_KEY = 'apsCloudSyncStatusV1';
  const COLLECTION = 'apsUserProgress';
  const SYNC_DEBOUNCE_MS = 8000;
  const CLOUD_SCHEMA_VERSION = 2;
  const PUSHED_META_KEY = 'apsCloudPushedMetaV195';
  const MY_VOCAB_SYNC_META_KEY = 'apsCloudMyVocabSyncMetaV195';
  const AUTO_PULL_MIN_MS = 60000;
  const SECTION_CHUNK_CHARS = 180000;

  const syncState = {
    firebaseReady: false,
    firestoreReady: false,
    syncing: false,
    lastSyncAt: '',
    lastPullAt: '',
    lastPushAt: '',
    lastError: '',
    mode: 'local',
    setupNeeded: false,
    applyingRemote: false,
    pendingTimer: 0,
    authObserverInstalled: false,
    firebasePromise: null,
    lastCardSignature: '',
    initialPullDoneForUid: '',
    lastAutoPullAtMs: 0,
    dirtyKeys: new Set(),
    migrationCheckedForUid: '',
  };

  const originalStorageSetItem = Storage.prototype.setItem;
  const originalStorageRemoveItem = Storage.prototype.removeItem;
  const originalInitAuth = initAuth;
  const originalRunAuth = runAuth;
  const originalCompleteAuth = completeAuth;
  const originalNormaliseAuthUser = normaliseAuthUser;
  const originalRenderModal = renderModal;
  const originalAuthWelcome = authWelcome;

  const SYNC_KEYS = [
    storageKeys.onboard,
    storageKeys.vocabStatus,
    storageKeys.vocabSettings,
    storageKeys.vocabResume,
    storageKeys.attempts,
    storageKeys.lesson,
    storageKeys.mistakes,
    storageKeys.phraseStats,
    storageKeys.dialogueVocabProgress,
    storageKeys.selectedLanguage,
    storageKeys.practiceDaily,
    storageKeys.recallProgress,
    storageKeys.recallSettings,
    storageKeys.myVocabs,
  ].filter(Boolean);

  const VOICE_KEYS = new Set([
    'voiceEn', 'voiceHi',
    'dialogueVoiceEnS1', 'dialogueVoiceEnS2',
    'dialogueVoiceHiS1', 'dialogueVoiceHiS2'
  ]);

  function safeParse(raw, fallback = null) {
    try { return JSON.parse(raw); } catch { return fallback; }
  }

  function nowMs() { return Date.now(); }

  function loadMeta() {
    return safeParse(localStorage.getItem(META_KEY), {}) || {};
  }

  function saveMeta(meta) {
    originalStorageSetItem.call(localStorage, META_KEY, JSON.stringify(meta || {}));
  }

  function rememberStatus() {
    const payload = {
      lastSyncAt: syncState.lastSyncAt,
      lastPullAt: syncState.lastPullAt,
      lastPushAt: syncState.lastPushAt,
      lastError: syncState.lastError,
    };
    originalStorageSetItem.call(localStorage, STATUS_KEY, JSON.stringify(payload));
  }

  function restoreStatus() {
    const saved = safeParse(localStorage.getItem(STATUS_KEY), {}) || {};
    syncState.lastSyncAt = saved.lastSyncAt || '';
    syncState.lastPullAt = saved.lastPullAt || '';
    syncState.lastPushAt = saved.lastPushAt || '';
  }

  function isSyncKey(key) {
    return SYNC_KEYS.includes(String(key));
  }

  function currentUser() {
    try {
      return window.firebase?.apps?.length
        ? window.firebase.auth().currentUser
        : null;
    } catch { return null; }
  }

  function cloudUserReady() {
    const user = currentUser();
    return Boolean(
      syncState.firebaseReady &&
      syncState.firestoreReady &&
      user &&
      !user.isAnonymous &&
      isEmailVerifiedForCloud(user)
    );
  }

  function providerIdForUser(user) {
    const providers = Array.isArray(user?.providerData)
      ? user.providerData.map(item => item?.providerId).filter(Boolean)
      : [];
    return providers.join(',') || user?.providerId || '';
  }

  function isPasswordUser(user = currentUser()) {
    const providers = Array.isArray(user?.providerData)
      ? user.providerData.map(item => item?.providerId).filter(Boolean)
      : [];
    return providers.includes('password') || user?.providerId === 'password';
  }

  function isEmailVerifiedForCloud(user = currentUser()) {
    if (!user || user.isAnonymous) return false;
    if (!isPasswordUser(user)) return true;
    return user.emailVerified === true;
  }

  function friendlyAuthMessage(error, fallback = 'Account action could not be completed.') {
    const code = String(error?.code || '').toLowerCase();
    const raw = String(error?.message || '');
    if (code.includes('email-already-in-use')) return 'An account already exists for this email. Sign in instead or use Forgot password.';
    if (code.includes('invalid-email')) return 'Enter a valid email address.';
    if (code.includes('weak-password')) return 'Choose a stronger password with at least 8 characters.';
    if (code.includes('wrong-password') || code.includes('invalid-credential') || code.includes('invalid-login-credentials')) return 'The email or password is incorrect. Try again or reset your password.';
    if (code.includes('user-disabled')) return 'This account has been disabled. Contact support.';
    if (code.includes('too-many-requests')) return 'Too many attempts. Wait a little and try again.';
    if (code.includes('network-request-failed')) return 'Internet connection was interrupted. Check your connection and try again.';
    if (code.includes('popup-closed-by-user')) return 'The sign-in window was closed before sign-in finished.';
    if (code.includes('popup-blocked')) return 'The browser blocked the sign-in window. Allow pop-ups for this site and try again.';
    if (code.includes('unauthorized-domain')) return 'This website is not yet authorised in Firebase Authentication.';
    if (code.includes('requires-recent-login')) return 'For security, sign in again before completing this account action.';
    if (raw && !raw.toLowerCase().includes('firebase')) return raw;
    return fallback;
  }

  function verificationReturnUrl() {
    const url = new URL(location.href);
    url.search = '';
    url.hash = '';
    return url.toString();
  }

  async function sendCurrentUserVerificationEmail() {
    const user = currentUser();
    if (!user?.email) throw new Error('No email account is signed in.');
    if (user.emailVerified) return true;
    try {
      await user.sendEmailVerification({ url: verificationReturnUrl() });
    } catch (error) {
      // Some Firebase projects do not accept continue URLs until they are configured.
      // Fall back to Firebase's default action handler rather than failing registration.
      await user.sendEmailVerification();
    }
    return true;
  }

  async function refreshCurrentUserVerification() {
    const user = currentUser();
    if (!user) return false;
    await user.reload();
    const refreshed = currentUser();
    state.auth.user = normaliseAuthUser(refreshed);
    saveAuthProfile();
    return isEmailVerifiedForCloud(refreshed);
  }

  async function activateVerifiedCloudAccount(reason = 'email-verified') {
    const user = currentUser();
    if (!isEmailVerifiedForCloud(user)) return false;
    state.auth.user = normaliseAuthUser(user);
    localStorage.setItem(storageKeys.authChoice, '1');
    saveAuthProfile();
    state.auth.error = '';
    state.modal = null;
    await cloudPull({ reason, manual: false, firstMerge: true });
    await cloudPush({ reason: `${reason}-merge` });
    render();
    return true;
  }

  normaliseAuthUser = function patchedNormaliseAuthUser(user) {
    const normalised = originalNormaliseAuthUser(user);
    if (!normalised || !user) return normalised;
    normalised.providerId = providerIdForUser(user) || normalised.providerId;
    normalised.photoUrl = user.photoURL || user.photoUrl || normalised.photoUrl || '';
    normalised.emailVerified = user.emailVerified === true;
    return normalised;
  };

  function loadScript(src, timeoutMs = 9000) {
    return new Promise((resolve, reject) => {
      const existing = [...document.scripts].find(script => script.src === src);
      if (existing?.dataset?.apsLoaded === '1') return resolve();

      const script = existing || document.createElement('script');
      let settled = false;
      const finish = (ok, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        if (ok) {
          script.dataset.apsLoaded = '1';
          resolve(value);
        } else reject(value);
      };
      const timer = window.setTimeout(
        () => finish(false, new Error(`Timed out loading ${src}`)),
        timeoutMs
      );
      script.addEventListener('load', () => finish(true), { once: true });
      script.addEventListener('error', () => finish(false, new Error(`Could not load ${src}`)), { once: true });
      if (!existing) {
        script.src = src;
        script.async = true;
        document.head.append(script);
      }
    });
  }

  async function loadFirebaseSdk() {
    if (window.firebase?.auth && window.firebase?.firestore && window.firebase?.apps) return;
    const base = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
    await loadScript(`${base}/firebase-app-compat.js`);
    await loadScript(`${base}/firebase-auth-compat.js`);
    await loadScript(`${base}/firebase-firestore-compat.js`);
  }

  function saveDiscoveredFirebaseConfig() {
    try {
      const options = window.firebase?.app?.()?.options;
      if (options?.apiKey && options?.projectId) {
        originalStorageSetItem.call(localStorage, CONFIG_KEY, JSON.stringify(options));
      }
    } catch {}
  }

  async function tryBundledFirebaseConfig() {
    const config = BUNDLED_FIREBASE_CONFIG;
    if (!config?.apiKey || config?.projectId !== FIREBASE_PROJECT_ID) return false;
    if (!window.firebase.apps.length) window.firebase.initializeApp(config);
    originalStorageSetItem.call(localStorage, CONFIG_KEY, JSON.stringify(config));
    return true;
  }

  async function trySavedFirebaseConfig() {
    const config = safeParse(localStorage.getItem(CONFIG_KEY), null);
    if (!config?.apiKey || !config?.projectId) return false;
    if (!window.firebase.apps.length) window.firebase.initializeApp(config);
    return true;
  }

  async function tryFirebaseHostingAutoConfig() {
    const candidates = [
      `https://${FIREBASE_PROJECT_ID}.web.app/__/firebase/init.js`,
      `https://${FIREBASE_PROJECT_ID}.firebaseapp.com/__/firebase/init.js`,
    ];
    for (const src of candidates) {
      try {
        await loadScript(src, 4500);
        if (window.firebase?.apps?.length) {
          saveDiscoveredFirebaseConfig();
          return true;
        }
      } catch {}
    }
    return false;
  }

  async function ensureFirebase({ allowAutoConfig = false } = {}) {
    if (syncState.firebaseReady && window.firebase?.apps?.length) return true;
    if (syncState.firebasePromise) return syncState.firebasePromise;

    syncState.firebasePromise = (async () => {
      try {
        await loadFirebaseSdk();
        let configured = await tryBundledFirebaseConfig();
        if (!configured) configured = await trySavedFirebaseConfig();
        if (!configured && allowAutoConfig) {
          configured = await tryFirebaseHostingAutoConfig();
        }
        if (!configured || !window.firebase?.apps?.length) {
          syncState.setupNeeded = true;
          syncState.firebaseReady = false;
          return false;
        }

        const appOptions = window.firebase.app().options || {};
        if (appOptions.projectId && appOptions.projectId !== FIREBASE_PROJECT_ID) {
          throw new Error(`Firebase project must be ${FIREBASE_PROJECT_ID}.`);
        }

        const auth = window.firebase.auth();
        await auth.setPersistence(window.firebase.auth.Auth.Persistence.LOCAL);
        syncState.firebaseReady = true;
        syncState.setupNeeded = false;
        syncState.mode = 'cloud';
        saveDiscoveredFirebaseConfig();

        try {
          window.firebase.firestore();
          syncState.firestoreReady = true;
        } catch (error) {
          syncState.firestoreReady = false;
          syncState.lastError = error?.message || 'Cloud Firestore is unavailable.';
        }
        installAuthObserver();
        return true;
      } catch (error) {
        syncState.firebaseReady = false;
        syncState.firestoreReady = false;
        syncState.setupNeeded = true;
        syncState.lastError = error?.message || 'Firebase web setup is unavailable.';
        return false;
      } finally {
        syncState.firebasePromise = null;
        ensureCloudCard();
      }
    })();
    return syncState.firebasePromise;
  }

  async function waitForAuthState(auth) {
    return new Promise(resolve => {
      let settled = false;
      let unsubscribe = () => {};
      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        try { unsubscribe(); } catch {}
        resolve(auth.currentUser || null);
      }, 3000);
      unsubscribe = auth.onAuthStateChanged(user => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        try { unsubscribe(); } catch {}
        resolve(user || null);
      }, () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(auth.currentUser || null);
      });
    });
  }

  function installAuthObserver() {
    if (syncState.authObserverInstalled || !window.firebase?.apps?.length) return;
    syncState.authObserverInstalled = true;
    window.firebase.auth().onAuthStateChanged(async user => {
      if (user) {
        state.auth.user = normaliseAuthUser(user);
        localStorage.setItem(storageKeys.authChoice, '1');
        saveAuthProfile();
        if (!user.isAnonymous && state.auth.initialized && isEmailVerifiedForCloud(user)) {
          await cloudPull({ reason: 'auth-change', manual: false, firstMerge: true });
        }
      } else if (state.auth.user && !state.auth.user.isAnonymous) {
        state.auth.user = null;
        saveAuthProfile();
      }
      ensureCloudCard();
    });
  }

  initAuth = async function patchedInitAuth() {
    if (firebaseAuthPlugin()) {
      await originalInitAuth();
      return;
    }

    const ready = await ensureFirebase({ allowAutoConfig: false });
    if (!ready) {
      state.auth.initialized = true;
      state.auth.user = null;
      return;
    }

    try {
      const user = await waitForAuthState(window.firebase.auth());
      state.auth.user = normaliseAuthUser(user);
      if (user) {
        localStorage.setItem(storageKeys.authChoice, '1');
        saveAuthProfile();
        if (!user.isAnonymous && isEmailVerifiedForCloud(user)) {
          await cloudPull({ reason: 'startup', manual: false, firstMerge: true });
        } else if (!user.isAnonymous && isPasswordUser(user) && !user.emailVerified) {
          state.modal = { type: 'verify-email' };
        }
      }
    } catch (error) {
      state.auth.error = error?.message || 'Cloud sign-in could not be restored.';
      state.auth.user = null;
    }
    state.auth.initialized = true;
    saveAuthProfile();
  };

  async function webRunAuth(action, payload = {}) {
    const ready = await ensureFirebase({ allowAutoConfig: true });
    if (!ready) {
      throw new Error(
        'Cloud sign-in could not connect to Firebase. Check your internet connection and reload the app.'
      );
    }

    const auth = window.firebase.auth();
    auth.useDeviceLanguage?.();

    try {
      if (action === 'google') {
        const provider = new window.firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        return await auth.signInWithPopup(provider);
      }
      if (action === 'apple') {
        const provider = new window.firebase.auth.OAuthProvider('apple.com');
        provider.addScope('email');
        provider.addScope('name');
        return await auth.signInWithPopup(provider);
      }
      if (action === 'email-signin') {
        return await auth.signInWithEmailAndPassword(payload.email, payload.password);
      }
      if (action === 'email-create') {
        const credential = await auth.createUserWithEmailAndPassword(payload.email, payload.password);
        if (payload.displayName?.trim()) {
          await credential.user.updateProfile({ displayName: payload.displayName.trim() });
        }
        await sendCurrentUserVerificationEmail();
        return credential;
      }
      if (action === 'email-resend-verification') {
        await sendCurrentUserVerificationEmail();
        return { user: auth.currentUser };
      }
      if (action === 'email-check-verification') {
        await refreshCurrentUserVerification();
        return { user: auth.currentUser };
      }
      if (action === 'password-reset') {
        try {
          await auth.sendPasswordResetEmail(payload.email, { url: verificationReturnUrl() });
        } catch (error) {
          if (String(error?.code || '').toLowerCase().includes('user-not-found')) return { ok: true };
          throw error;
        }
        return { ok: true };
      }
      if (action === 'signout') return await auth.signOut();
      if (action === 'delete') {
        if (!auth.currentUser) throw new Error('No cloud account is signed in.');
        return await auth.currentUser.delete();
      }
      if (action === 'phone-start' || action === 'phone-confirm') {
        throw new Error('For the GitHub version, use Google or Email for cross-device sync. Phone sign-in remains available for the installed app.');
      }
      throw new Error('Unsupported web sign-in action.');
    } catch (error) {
      throw new Error(friendlyAuthMessage(error));
    }
  }

  runAuth = async function patchedRunAuth(action, payload = {}) {
    if (firebaseAuthPlugin()) return originalRunAuth(action, payload);
    if (action === 'guest') {
      return { user: { uid: 'local-guest', isAnonymous: true, providerId: 'anonymous' } };
    }
    return webRunAuth(action, payload);
  };

  completeAuth = async function patchedCompleteAuth(action, payload = {}) {
    await originalCompleteAuth(action, payload);

    if (state.auth.error || !state.auth.user || state.auth.user.isAnonymous || firebaseAuthPlugin()) {
      return;
    }

    const user = currentUser();
    state.auth.user = normaliseAuthUser(user) || state.auth.user;
    saveAuthProfile();

    if (isPasswordUser(user) && !user?.emailVerified) {
      state.auth.error = '';
      state.modal = { type: 'verify-email' };
      render();
      return;
    }

    if (isEmailVerifiedForCloud(user)) {
      await cloudPull({ reason: 'signed-in', manual: false, firstMerge: true });
      await cloudPush({ reason: 'signed-in-merge' });
      render();
    }
  };


  authWelcome = function v11AuthWelcome() {
    return `<div class="auth-screen"><div class="auth-card"><div class="brand big">APS</div><small>MULTILINGUAL CCL PREPARATION</small><h1>APS NAATI CCL Practice</h1><p>Create one account and continue your learning progress across your Windows PC, Mac, iPhone and other supported browsers.</p>${state.auth.error?`<div class="auth-error">${esc(state.auth.error)}</div>`:''}<div class="auth-actions"><button class="auth-google" data-action="auth-google">G Continue with Google</button><button data-action="auth-email">Continue with Email</button><button class="auth-guest" data-action="auth-guest">Continue as Guest</button></div><div class="auth-note"><b>No Firebase setup is required for learners.</b><br>Google and Email accounts can sync progress across devices. Guest progress stays on this device. Recordings remain local.</div>${state.auth.busy?'<div class="auth-busy">Please wait…</div>':''}</div>${renderModal()}</div>`;
  };

  renderModal = function v11RenderModal() {
    if (!state.modal) return '';

    if (state.modal.type === 'email-auth') {
      const creating = state.auth.emailMode === 'create';
      return `<div class="modal-backdrop"><div class="modal auth-modal aps-account-modal"><button class="modal-close" data-action="close-modal">×</button><small>${creating?'CREATE ACCOUNT':'WELCOME BACK'}</small><h2>${creating?'Create your APS account':'Sign in with email'}</h2><p>${creating?'Your verified account will keep learning progress available across your devices.':'Sign in to restore and continue your cloud learning progress.'}</p>${state.auth.error?`<div class="auth-error">${esc(state.auth.error)}</div>`:''}${creating?`<label>Name <span class="optional">optional</span><input id="authDisplayName" type="text" autocomplete="name" placeholder="Your name"></label>`:''}<label>Email address<input id="authEmail" type="email" autocomplete="email" placeholder="name@example.com"></label><label>Password<input id="authPassword" type="password" autocomplete="${creating?'new-password':'current-password'}" placeholder="${creating?'At least 8 characters':'Your password'}"></label>${creating?`<label>Confirm password<input id="authPasswordConfirm" type="password" autocomplete="new-password" placeholder="Enter the same password again"></label><div class="aps-password-help">Use at least 8 characters. A verification email will be sent after account creation.</div>`:''}<button class="primary wide" data-action="auth-email-submit">${state.auth.busy?'Please wait…':creating?'Create account':'Sign in'}</button>${creating?'':`<button class="text-button aps-forgot-button" data-action="auth-forgot-password">Forgot password?</button>`}<button class="text-button" data-action="auth-email-switch">${creating?'Already have an account? Sign in':'New student? Create an account'}</button></div></div>`;
    }

    if (state.modal.type === 'verify-email') {
      const email = currentUser()?.email || state.auth.user?.email || '';
      return `<div class="modal-backdrop"><div class="modal auth-modal aps-account-modal aps-verify-modal"><div class="aps-auth-icon">✉</div><small>VERIFY YOUR EMAIL</small><h2>Check your inbox</h2><p>We sent a verification link to <b>${esc(email)}</b>. Open the email and tap the verification link, then return here.</p>${state.auth.error?`<div class="auth-error">${esc(state.auth.error)}</div>`:''}<div class="aps-verify-note">Your local practice remains safe. Cloud progress sync starts only after this email address is verified.</div><button class="primary wide" data-action="auth-check-verification">I’ve verified — Continue</button><button class="secondary wide" data-action="auth-resend-verification">Resend verification email</button><button class="text-button" data-action="auth-verify-signout">Use another account</button></div></div>`;
    }

    if (state.modal.type === 'forgot-password') {
      const email = esc(state.modal.email || '');
      return `<div class="modal-backdrop"><div class="modal auth-modal aps-account-modal"><button class="modal-close" data-action="close-modal">×</button><small>PASSWORD HELP</small><h2>Reset your password</h2><p>Enter your account email. Firebase will send a secure password-reset link.</p>${state.auth.error?`<div class="auth-error">${esc(state.auth.error)}</div>`:''}<label>Email address<input id="authResetEmail" type="email" autocomplete="email" value="${email}" placeholder="name@example.com"></label><button class="primary wide" data-action="auth-reset-password-submit">Send reset email</button><button class="text-button" data-action="auth-back-to-signin">Back to sign in</button></div></div>`;
    }

    if (state.modal.type === 'password-reset-sent') {
      const email = esc(state.modal.email || '');
      return `<div class="modal-backdrop"><div class="modal auth-modal aps-account-modal"><div class="aps-auth-icon">✓</div><small>EMAIL SENT</small><h2>Check your email</h2><p>If an Email/Password account exists for <b>${email}</b>, a password-reset link has been sent.</p><button class="primary wide" data-action="auth-back-to-signin">Return to sign in</button></div></div>`;
    }

    return originalRenderModal();
  };

  function sanitiseValueForCloud(key, raw) {
    if (raw == null) return null;
    if (key !== storageKeys.vocabSettings) return raw;
    const parsed = safeParse(raw, {});
    for (const voiceKey of VOICE_KEYS) delete parsed[voiceKey];
    return JSON.stringify(parsed);
  }

  function applyCloudValueLocally(key, raw) {
    if (raw == null) {
      originalStorageRemoveItem.call(localStorage, key);
      return;
    }
    if (key === storageKeys.vocabSettings) {
      const local = safeParse(localStorage.getItem(key), {}) || {};
      const incoming = safeParse(raw, {}) || {};
      const voices = {};
      for (const voiceKey of VOICE_KEYS) {
        if (Object.prototype.hasOwnProperty.call(local, voiceKey)) voices[voiceKey] = local[voiceKey];
      }
      originalStorageSetItem.call(localStorage, key, JSON.stringify({ ...local, ...incoming, ...voices }));
      return;
    }
    originalStorageSetItem.call(localStorage, key, raw);
  }

  function dateValue(value) {
    const ms = Date.parse(value || '');
    return Number.isFinite(ms) ? ms : 0;
  }

  function mergeVocabStatus(localValue, remoteValue) {
    const local = safeParse(localValue, {}) || {};
    const remote = safeParse(remoteValue, {}) || {};
    const rank = { new: 0, again: 1, learning: 2, known: 3 };
    const merged = { ...remote };
    for (const [id, status] of Object.entries(local)) {
      const current = merged[id] || 'new';
      merged[id] = (rank[status] ?? 0) >= (rank[current] ?? 0) ? status : current;
    }
    return JSON.stringify(merged);
  }

  function mergePhraseStats(localValue, remoteValue) {
    const local = safeParse(localValue, {}) || {};
    const remote = safeParse(remoteValue, {}) || {};
    const merged = { ...remote };
    for (const [id, item] of Object.entries(local)) {
      const r = merged[id] || {};
      const latestLocal = dateValue(item?.lastPractisedAt);
      const latestRemote = dateValue(r?.lastPractisedAt);
      merged[id] = {
        ...r,
        ...item,
        practiceCount: Math.max(Number(item?.practiceCount) || 0, Number(r?.practiceCount) || 0),
        completed: Boolean(item?.completed || r?.completed),
        firstCompletedAt: [item?.firstCompletedAt, r?.firstCompletedAt]
          .filter(Boolean)
          .sort((a, b) => dateValue(a) - dateValue(b))[0] || '',
        lastPractisedAt: latestLocal >= latestRemote
          ? (item?.lastPractisedAt || r?.lastPractisedAt || '')
          : (r?.lastPractisedAt || item?.lastPractisedAt || ''),
      };
    }
    return JSON.stringify(merged);
  }

  function attemptIdentity(item) {
    return item?.id || [
      item?.dialogueId || '',
      item?.mode || '',
      item?.finishedAt || item?.startedAt || '',
      item?.title || ''
    ].join('|');
  }

  function mergeAttempts(localValue, remoteValue) {
    const local = safeParse(localValue, []) || [];
    const remote = safeParse(remoteValue, []) || [];
    const map = new Map();
    for (const item of [...remote, ...local]) map.set(attemptIdentity(item), item);
    return JSON.stringify([...map.values()]
      .sort((a, b) => dateValue(a?.finishedAt || a?.startedAt) - dateValue(b?.finishedAt || b?.startedAt))
      .slice(-150));
  }

  function mergeArrayRecords(localValue, remoteValue) {
    const local = safeParse(localValue, []) || [];
    const remote = safeParse(remoteValue, []) || [];
    const seen = new Set();
    const merged = [];
    for (const item of [...remote, ...local]) {
      const identity = item?.id || JSON.stringify(item);
      if (seen.has(identity)) continue;
      seen.add(identity);
      merged.push(item);
    }
    return JSON.stringify(merged.slice(-250));
  }

  function mergeLesson(localValue, remoteValue) {
    const local = safeParse(localValue, {}) || {};
    const remote = safeParse(remoteValue, {}) || {};
    if (local.completed && !remote.completed) return JSON.stringify(local);
    if (remote.completed && !local.completed) return JSON.stringify(remote);
    const localPosition = (Number(local.chapter) || 0) * 1000 + (Number(local.slide) || 0);
    const remotePosition = (Number(remote.chapter) || 0) * 1000 + (Number(remote.slide) || 0);
    const winner = localPosition >= remotePosition ? local : remote;
    return JSON.stringify({ ...remote, ...local, ...winner, completed: Boolean(local.completed || remote.completed) });
  }

  function mergeResume(localValue, remoteValue) {
    const local = safeParse(localValue, {}) || {};
    const remote = safeParse(remoteValue, {}) || {};
    return dateValue(local.updatedAt) >= dateValue(remote.updatedAt)
      ? JSON.stringify(local)
      : JSON.stringify(remote);
  }

  function mergePracticeDaily(localValue, remoteValue) {
    const local = safeParse(localValue, []) || [];
    const remote = safeParse(remoteValue, []) || [];
    const map = new Map();
    for (const item of [...remote, ...local]) {
      if (!item?.id) continue;
      const current = map.get(item.id);
      if (!current || dateValue(item.updatedAt) >= dateValue(current.updatedAt)) {
        map.set(item.id, item);
      }
    }
    return JSON.stringify([...map.values()]
      .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))
      .slice(-500));
  }

  function mergeRecallProgress(localValue, remoteValue) {
    const local = safeParse(localValue, {}) || {};
    const remote = safeParse(remoteValue, {}) || {};
    const merged = { ...remote };
    for (const [key, item] of Object.entries(local)) {
      const current = merged[key];
      if (!current || dateValue(item?.updatedAt) >= dateValue(current?.updatedAt)) {
        merged[key] = item;
      }
    }
    return JSON.stringify(merged);
  }

  function mergeRecallSettings(localValue, remoteValue) {
    const local = safeParse(localValue, {}) || {};
    const remote = safeParse(remoteValue, {}) || {};
    return dateValue(local.updatedAt) >= dateValue(remote.updatedAt)
      ? JSON.stringify(local)
      : JSON.stringify(remote);
  }

  function mergeMyVocabs(localValue, remoteValue) {
    const local = safeParse(localValue, {}) || {};
    const remote = safeParse(remoteValue, {}) || {};
    const localItems = local.items && typeof local.items === 'object' ? local.items : {};
    const remoteItems = remote.items && typeof remote.items === 'object' ? remote.items : {};
    const items = { ...remoteItems };
    for (const [id, item] of Object.entries(localItems)) {
      const current = items[id];
      if (!current || dateValue(item?.updatedAt) >= dateValue(current?.updatedAt)) items[id] = item;
    }
    return JSON.stringify({
      schemaVersion: Math.max(Number(local.schemaVersion)||1, Number(remote.schemaVersion)||1),
      updatedAt: dateValue(local.updatedAt) >= dateValue(remote.updatedAt) ? (local.updatedAt||remote.updatedAt||'') : (remote.updatedAt||local.updatedAt||''),
      items
    });
  }

  function mergeFirstTimeValue(key, localValue, remoteValue) {
    if (localValue == null) return remoteValue;
    if (remoteValue == null) return sanitiseValueForCloud(key, localValue);
    if (key === storageKeys.vocabStatus) return mergeVocabStatus(localValue, remoteValue);
    if (key === storageKeys.phraseStats) return mergePhraseStats(localValue, remoteValue);
    if (key === storageKeys.attempts) return mergeAttempts(localValue, remoteValue);
    if (key === storageKeys.mistakes) return mergeArrayRecords(localValue, remoteValue);
    if (key === storageKeys.lesson) return mergeLesson(localValue, remoteValue);
    if (key === storageKeys.vocabResume) return mergeResume(localValue, remoteValue);
    if (key === storageKeys.practiceDaily) return mergePracticeDaily(localValue, remoteValue);
    if (key === storageKeys.dialogueVocabProgress) return mergeRecallProgress(localValue, remoteValue);
    if (key === storageKeys.recallProgress) return mergeRecallProgress(localValue, remoteValue);
    if (key === storageKeys.recallSettings) return mergeRecallSettings(localValue, remoteValue);
    if (key === storageKeys.myVocabs) return mergeMyVocabs(localValue, remoteValue);
    if (key === storageKeys.vocabSettings) {
      const local = safeParse(localValue, {}) || {};
      const remote = safeParse(remoteValue, {}) || {};
      for (const voiceKey of VOICE_KEYS) delete remote[voiceKey];
      return JSON.stringify({ ...remote, ...local });
    }
    // For onboarding/language, preserve the local device choice on first merge.
    return localValue;
  }

  function loadPushedMeta() {
    return safeParse(localStorage.getItem(PUSHED_META_KEY), {}) || {};
  }

  function savePushedMeta(meta) {
    originalStorageSetItem.call(localStorage, PUSHED_META_KEY, JSON.stringify(meta || {}));
  }

  function loadMyVocabSyncMeta() {
    return safeParse(localStorage.getItem(MY_VOCAB_SYNC_META_KEY), {}) || {};
  }

  function saveMyVocabSyncMeta(meta) {
    originalStorageSetItem.call(localStorage, MY_VOCAB_SYNC_META_KEY, JSON.stringify(meta || {}));
  }

  function cloudDocument() {
    const user = currentUser();
    if (!user || user.isAnonymous) return null;
    return window.firebase.firestore().collection(COLLECTION).doc(user.uid);
  }

  function cloudSections() {
    const root = cloudDocument();
    return root ? root.collection('sections') : null;
  }

  function cloudMyVocabs() {
    const root = cloudDocument();
    return root ? root.collection('myVocabs') : null;
  }

  function sectionId(key) {
    return encodeURIComponent(String(key)).replace(/\./g, '%2E');
  }

  function myVocabDocId(id) {
    return encodeURIComponent(String(id)).replace(/\./g, '%2E');
  }

  function valueUpdatedAt(item) {
    return dateValue(item?.updatedAt || item?.deletedAt || item?.createdAt || 0);
  }

  function myVocabStore(raw = localStorage.getItem(storageKeys.myVocabs)) {
    const parsed = safeParse(raw, {}) || {};
    if (Array.isArray(parsed)) {
      const items = {};
      for (const item of parsed) if (item?.id) items[item.id] = item;
      return { schemaVersion: 1, updatedAt: '', items };
    }
    return {
      schemaVersion: Number(parsed.schemaVersion) || 1,
      updatedAt: parsed.updatedAt || '',
      items: parsed.items && typeof parsed.items === 'object' ? parsed.items : {},
    };
  }

  async function writeSection(key, raw, updatedAtClient) {
    const collection = cloudSections();
    if (!collection) return;
    const ref = collection.doc(sectionId(key));
    const fieldValue = window.firebase.firestore.FieldValue;
    const common = {
      key,
      updatedAtClient: Number(updatedAtClient) || nowMs(),
      updatedAt: fieldValue.serverTimestamp(),
      lastDevice: navigator.userAgent.slice(0, 160),
    };
    if (raw == null) {
      await ref.set({ ...common, deleted: true, chunked: false, chunkCount: 0, value: null }, { merge: true });
      return;
    }
    const text = String(raw);
    if (text.length <= SECTION_CHUNK_CHARS) {
      await ref.set({ ...common, deleted: false, chunked: false, chunkCount: 0, value: text }, { merge: true });
      return;
    }
    const chunks = [];
    for (let i = 0; i < text.length; i += SECTION_CHUNK_CHARS) chunks.push(text.slice(i, i + SECTION_CHUNK_CHARS));
    // A localStorage progress section is far smaller than Firestore's 500-write
    // batch ceiling. Commit its chunks and parent metadata together so another
    // device never observes a parent that points at only a partially-written set.
    const db = window.firebase.firestore();
    if (chunks.length <= 380) {
      const batch = db.batch();
      chunks.forEach((value, index) => {
        batch.set(ref.collection('chunks').doc(String(index).padStart(4, '0')), { index, value });
      });
      batch.set(ref, { ...common, deleted: false, chunked: true, chunkCount: chunks.length, value: fieldValue.delete() }, { merge: true });
      await batch.commit();
      return;
    }
    // Defensive fallback for an implausibly large local section: write groups,
    // then publish the parent only after every chunk succeeds.
    for (let offset = 0; offset < chunks.length; offset += 380) {
      const batch = db.batch();
      chunks.slice(offset, offset + 380).forEach((value, localIndex) => {
        const index = offset + localIndex;
        batch.set(ref.collection('chunks').doc(String(index).padStart(4, '0')), { index, value });
      });
      await batch.commit();
    }
    await ref.set({ ...common, deleted: false, chunked: true, chunkCount: chunks.length, value: fieldValue.delete() }, { merge: true });
  }

  async function readSectionDoc(doc) {
    const data = doc.data() || {};
    if (data.deleted) return { key: data.key, value: null, updatedAt: Number(data.updatedAtClient) || 0 };
    if (!data.chunked) return { key: data.key, value: data.value ?? null, updatedAt: Number(data.updatedAtClient) || 0 };
    const count = Math.max(0, Number(data.chunkCount) || 0);
    const chunks = await doc.ref.collection('chunks').orderBy('index').limit(count || 1).get();
    const values = [];
    chunks.forEach(chunk => { const d = chunk.data() || {}; values[Number(d.index) || 0] = String(d.value || ''); });
    return { key: data.key, value: values.slice(0, count).join(''), updatedAt: Number(data.updatedAtClient) || 0 };
  }

  function mergeRemoteEntries(remoteEntries, { firstMerge = false } = {}) {
    const meta = loadMeta();
    const currentTime = nowMs();
    let changed = false;
    let needsPush = false;
    syncState.applyingRemote = true;
    try {
      for (const key of SYNC_KEYS) {
        if (key === storageKeys.myVocabs) continue;
        const remoteEntry = remoteEntries[key];
        const localRaw = localStorage.getItem(key);
        const localTs = Number(meta[key]) || 0;
        const remoteTs = Number(remoteEntry?.updatedAt) || 0;
        const remoteRaw = remoteEntry?.value ?? null;

        if (!remoteEntry && localRaw != null) {
          if (!localTs) meta[key] = currentTime;
          syncState.dirtyKeys.add(key);
          needsPush = true;
          continue;
        }
        if (!remoteEntry) continue;

        const alwaysMerge = key === storageKeys.attempts || key === storageKeys.practiceDaily || key === storageKeys.recallProgress || key === storageKeys.dialogueVocabProgress;
        if (alwaysMerge && localRaw != null && remoteRaw != null && sanitiseValueForCloud(key, localRaw) !== remoteRaw) {
          const merged = mergeFirstTimeValue(key, localRaw, remoteRaw);
          applyCloudValueLocally(key, merged);
          meta[key] = currentTime;
          changed = changed || merged !== localRaw;
          syncState.dirtyKeys.add(key);
          needsPush = true;
          continue;
        }

        if (firstMerge && localTs === 0 && localRaw != null && remoteRaw != null) {
          const merged = mergeFirstTimeValue(key, localRaw, remoteRaw);
          applyCloudValueLocally(key, merged);
          meta[key] = currentTime;
          changed = changed || merged !== localRaw;
          syncState.dirtyKeys.add(key);
          needsPush = true;
          continue;
        }

        if (remoteTs > localTs) {
          applyCloudValueLocally(key, remoteRaw);
          meta[key] = remoteTs || currentTime;
          changed = changed || remoteRaw !== sanitiseValueForCloud(key, localRaw);
        } else if (localTs > remoteTs) {
          syncState.dirtyKeys.add(key);
          needsPush = true;
        } else if (localTs === 0 && localRaw == null && remoteRaw != null) {
          applyCloudValueLocally(key, remoteRaw);
          meta[key] = remoteTs || currentTime;
          changed = true;
        } else if (sanitiseValueForCloud(key, localRaw) !== remoteRaw) {
          const merged = mergeFirstTimeValue(key, localRaw, remoteRaw);
          applyCloudValueLocally(key, merged);
          meta[key] = currentTime;
          changed = true;
          syncState.dirtyKeys.add(key);
          needsPush = true;
        }
      }
      saveMeta(meta);
    } finally {
      syncState.applyingRemote = false;
    }
    return { changed, needsPush };
  }

  async function pushSections({ forceAll = false } = {}) {
    const meta = loadMeta();
    const pushed = loadPushedMeta();
    const keys = forceAll ? SYNC_KEYS.filter(key => key !== storageKeys.myVocabs) : [...syncState.dirtyKeys].filter(key => key !== storageKeys.myVocabs);
    let count = 0;
    for (const key of keys) {
      const updatedAtClient = Number(meta[key]) || nowMs();
      if (!forceAll && Number(pushed[key]) >= updatedAtClient) { syncState.dirtyKeys.delete(key); continue; }
      const raw = localStorage.getItem(key);
      await writeSection(key, raw == null ? null : sanitiseValueForCloud(key, raw), updatedAtClient);
      pushed[key] = updatedAtClient;
      syncState.dirtyKeys.delete(key);
      count++;
    }
    savePushedMeta(pushed);
    return count;
  }

  async function pushMyVocabs({ forceAll = false } = {}) {
    window.dispatchEvent(new CustomEvent('aps-my-vocabs-flush-request'));
    const collection = cloudMyVocabs();
    if (!collection || !storageKeys.myVocabs) return 0;
    const local = myVocabStore();
    const pushed = loadMyVocabSyncMeta();
    const changed = Object.values(local.items || {}).filter(item => item?.id && (forceAll || Number(pushed[item.id]) < valueUpdatedAt(item)));
    if (!changed.length) { syncState.dirtyKeys.delete(storageKeys.myVocabs); return 0; }
    const db = window.firebase.firestore();
    let committed = 0;
    for (let offset = 0; offset < changed.length; offset += 380) {
      const batch = db.batch();
      const group = changed.slice(offset, offset + 380);
      group.forEach(item => {
        const updatedAtClient = valueUpdatedAt(item) || nowMs();
        batch.set(collection.doc(myVocabDocId(item.id)), {
          id: item.id,
          updatedAtClient,
          updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
          deleted: Boolean(item.deleted),
          item,
        }, { merge: true });
      });
      await batch.commit();
      group.forEach(item => { pushed[item.id] = valueUpdatedAt(item) || nowMs(); });
      saveMyVocabSyncMeta(pushed);
      committed += group.length;
    }
    if (committed) syncState.dirtyKeys.delete(storageKeys.myVocabs);
    return committed;
  }

  async function pullMyVocabs() {
    window.dispatchEvent(new CustomEvent('aps-my-vocabs-flush-request'));
    const collection = cloudMyVocabs();
    if (!collection || !storageKeys.myVocabs) return { changed: false, needsPush: false };
    const snapshot = await collection.get({ source: 'server' }).catch(() => collection.get());
    const local = myVocabStore();
    const items = { ...local.items };
    const syncMeta = loadMyVocabSyncMeta();
    let changed = false;
    let needsPush = false;
    const remoteIds = new Set();
    snapshot.forEach(doc => {
      const data = doc.data() || {};
      const item = data.item && typeof data.item === 'object' ? data.item : null;
      const id = String(data.id || item?.id || '');
      if (!id || !item) return;
      remoteIds.add(id);
      const remoteTs = Number(data.updatedAtClient) || valueUpdatedAt(item);
      const localItem = items[id];
      const localTs = valueUpdatedAt(localItem);
      if (!localItem || remoteTs > localTs) {
        items[id] = item;
        changed = true;
      } else if (localTs > remoteTs) {
        needsPush = true;
      }
      syncMeta[id] = Math.max(Number(syncMeta[id]) || 0, remoteTs || 0);
    });
    for (const item of Object.values(local.items || {})) {
      if (item?.id && !remoteIds.has(item.id)) needsPush = true;
    }
    if (changed) {
      const merged = { schemaVersion: Math.max(1, Number(local.schemaVersion) || 1), updatedAt: new Date().toISOString(), items };
      syncState.applyingRemote = true;
      try { originalStorageSetItem.call(localStorage, storageKeys.myVocabs, JSON.stringify(merged)); window.dispatchEvent(new CustomEvent('aps-my-vocabs-external-update')); }
      finally { syncState.applyingRemote = false; }
    }
    saveMyVocabSyncMeta(syncMeta);
    return { changed, needsPush };
  }

  async function cloudPush({ reason = 'auto', forceAll = false, pruneLegacy = false } = {}) {
    if (!cloudUserReady() || syncState.syncing || syncState.applyingRemote) return false;
    const ref = cloudDocument();
    if (!ref) return false;
    syncState.syncing = true;
    syncState.lastError = '';
    ensureCloudCard();
    try {
      if (/manual|create-cloud|signed-in|migrate/i.test(reason)) forceAll = true;
      const sectionCount = await pushSections({ forceAll });
      const vocabCount = await pushMyVocabs({ forceAll });
      const payload = {
        schemaVersion: CLOUD_SCHEMA_VERSION,
        appVersion: 'v19.5-scalable-cloud-performance',
        projectId: FIREBASE_PROJECT_ID,
        updatedAtClient: nowMs(),
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        lastDevice: navigator.userAgent.slice(0, 220),
        reason,
        sectionCount,
        myVocabCount: Object.keys(myVocabStore().items || {}).length,
      };
      if (pruneLegacy) payload.keys = window.firebase.firestore.FieldValue.delete();
      await ref.set(payload, { merge: true });
      syncState.lastPushAt = new Date().toISOString();
      syncState.lastSyncAt = syncState.lastPushAt;
      rememberStatus();
      return true;
    } catch (error) {
      syncState.lastError = humanCloudError(error);
      rememberStatus();
      return false;
    } finally {
      syncState.syncing = false;
      ensureCloudCard();
    }
  }

  async function cloudPull({ reason = 'auto', manual = false, firstMerge = false } = {}) {
    if (!syncState.firebaseReady || !syncState.firestoreReady) return false;
    const user = currentUser();
    if (!user || user.isAnonymous) return false;
    if (syncState.syncing && !manual) return false;
    if (!manual && syncState.lastAutoPullAtMs && nowMs() - syncState.lastAutoPullAtMs < AUTO_PULL_MIN_MS) return false;
    const ref = cloudDocument();
    if (!ref) return false;

    syncState.syncing = true;
    syncState.lastError = '';
    ensureCloudCard();
    let changed = false;
    let needsPush = false;
    let migrationNeeded = false;
    try {
      const [rootSnapshot, sectionSnapshot] = await Promise.all([
        ref.get({ source: 'server' }).catch(() => ref.get()),
        cloudSections().get({ source: 'server' }).catch(() => cloudSections().get()),
      ]);
      const rootData = rootSnapshot.exists ? (rootSnapshot.data() || {}) : {};
      const remoteEntries = {};
      const sectionDocs = [];
      sectionSnapshot.forEach(doc => sectionDocs.push(doc));
      for (const doc of sectionDocs) {
        const entry = await readSectionDoc(doc);
        if (entry.key) remoteEntries[entry.key] = entry;
      }

      const legacyKeys = rootData.keys && typeof rootData.keys === 'object' ? rootData.keys : {};
      if (Object.keys(legacyKeys).length) {
        migrationNeeded = true;
        // Prefer already-migrated section documents, but use legacy values for any
        // section that has not been written yet.
        for (const [key, entry] of Object.entries(legacyKeys)) {
          if (key === storageKeys.myVocabs || remoteEntries[key]) continue;
          remoteEntries[key] = { value: entry?.value ?? null, updatedAt: Number(entry?.updatedAt) || 0 };
        }
        const legacyMy = legacyKeys[storageKeys.myVocabs];
        if (legacyMy?.value != null) {
          const localRaw = localStorage.getItem(storageKeys.myVocabs);
          const merged = mergeMyVocabs(localRaw, legacyMy.value);
          if (merged !== localRaw) {
            syncState.applyingRemote = true;
            try { originalStorageSetItem.call(localStorage, storageKeys.myVocabs, merged); window.dispatchEvent(new CustomEvent('aps-my-vocabs-external-update')); }
            finally { syncState.applyingRemote = false; }
            changed = true;
          }
        }
      }

      const sectionResult = mergeRemoteEntries(remoteEntries, { firstMerge: firstMerge || migrationNeeded });
      changed = changed || sectionResult.changed;
      needsPush = needsPush || sectionResult.needsPush || !rootSnapshot.exists || migrationNeeded;

      const myResult = await pullMyVocabs();
      changed = changed || myResult.changed;
      needsPush = needsPush || myResult.needsPush;

      syncState.lastPullAt = new Date().toISOString();
      syncState.lastSyncAt = syncState.lastPullAt;
      syncState.initialPullDoneForUid = user.uid;
      syncState.lastAutoPullAtMs = nowMs();
      rememberStatus();

      if (changed) await refreshInMemoryState();
      if (needsPush) {
        syncState.syncing = false;
        const ok = await cloudPush({ reason: migrationNeeded ? 'migrate-v19-5' : `${reason}-merge`, forceAll: migrationNeeded || !rootSnapshot.exists, pruneLegacy: migrationNeeded });
        if (!ok) return changed;
      }
      if (manual && typeof showToast === 'function') {
        showToast(changed ? 'Cloud progress refreshed from your other device' : 'Cloud progress is already up to date');
      }
      return changed;
    } catch (error) {
      syncState.applyingRemote = false;
      syncState.lastError = humanCloudError(error);
      rememberStatus();
      if (manual && typeof showToast === 'function') showToast(syncState.lastError);
      return false;
    } finally {
      syncState.syncing = false;
      ensureCloudCard();
    }
  }

  function humanCloudError(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || 'Cloud sync could not complete.');
    if (code.includes('permission-denied')) {
      return 'Cloud sync V19.5 needs the updated Firestore rules for progress sections and My Vocabs. Use FIREBASE_CLOUD_SYNC_SETUP.txt once in Firebase Console.';
    }
    if (code.includes('resource-exhausted') || /maximum allowed size|too large/i.test(message)) {
      return 'A legacy cloud progress document is still too large. V19.5 will migrate it after the updated Firestore rules are enabled.';
    }
    if (code.includes('unavailable')) return 'Cloud sync is temporarily unavailable. Your progress is still saved on this device.';
    if (code.includes('unauthorized-domain')) return `Add ${location.hostname} to Firebase Authentication → Authorized domains.`;
    return message.replace(/^Firebase:\s*/i, '').slice(0, 300);
  }

  function markLocalChange(key) {
    if (!isSyncKey(key) || syncState.applyingRemote) return;
    const meta = loadMeta();
    meta[key] = nowMs();
    saveMeta(meta);
    syncState.dirtyKeys.add(key);
    scheduleCloudPush();
    ensureCloudCard();
  }

  Storage.prototype.setItem = function patchedStorageSetItem(key, value) {
    originalStorageSetItem.call(this, key, value);
    if (this === localStorage) markLocalChange(String(key));
  };

  Storage.prototype.removeItem = function patchedStorageRemoveItem(key) {
    originalStorageRemoveItem.call(this, key);
    if (this === localStorage) markLocalChange(String(key));
  };

  function scheduleCloudPush() {
    window.clearTimeout(syncState.pendingTimer);
    if (!cloudUserReady()) return;
    syncState.pendingTimer = window.setTimeout(
      () => cloudPush({ reason: 'local-change', forceAll: false }),
      SYNC_DEBOUNCE_MS
    );
  }

  function formatTime(value) {
    if (!value) return 'Not synced yet';
    try { return new Date(value).toLocaleString(); } catch { return value; }
  }

  function cloudStatus() {
    const user = state.auth?.user;
    if (!user || user.isAnonymous) {
      return {
        label: 'Local only',
        tone: 'local',
        message: 'Sign in with Google or Email to continue your progress on another device.'
      };
    }
    if (isPasswordUser() && !isEmailVerifiedForCloud()) {
      return {
        label: 'Verify email',
        tone: 'warning',
        message: 'Verify your email address to enable cross-device cloud progress sync.'
      };
    }
    if (!syncState.firebaseReady) {
      return {
        label: 'Connection unavailable',
        tone: 'warning',
        message: 'Firebase connection is temporarily unavailable. No learner configuration is required.'
      };
    }
    if (!syncState.firestoreReady || syncState.lastError) {
      return {
        label: 'Needs attention',
        tone: 'warning',
        message: syncState.lastError || 'Cloud Firestore needs to be enabled.'
      };
    }
    if (syncState.syncing) {
      return { label: 'Syncing…', tone: 'syncing', message: 'Saving or checking progress…' };
    }
    return {
      label: 'Cloud connected',
      tone: 'success',
      message: `Last sync: ${formatTime(syncState.lastSyncAt)} · Scalable progress sections + My Vocabs sync` 
    };
  }

  function settingsModal() {
    return document.querySelector('.app-settings-modal');
  }

  function ensureCloudCard() {
    const modal = settingsModal();
    let card = document.querySelector('#apsCloudSyncCard');
    if (!modal) {
      card?.remove();
      return;
    }

    const status = cloudStatus();
    const signature = JSON.stringify({
      status,
      user: state.auth?.user?.uid || '',
      anonymous: Boolean(state.auth?.user?.isAnonymous),
      ready: syncState.firebaseReady,
      firestore: syncState.firestoreReady,
    });

    if (!card) {
      card = document.createElement('section');
      card.id = 'apsCloudSyncCard';
      card.className = 'aps-cloud-sync-card';
      const accountCard = modal.querySelector('.account-settings-card');
      if (accountCard?.nextSibling) {
        accountCard.parentNode.insertBefore(card, accountCard.nextSibling);
      } else {
        modal.insertBefore(card, modal.querySelector('.voice-settings-section'));
      }
    }

    if (signature === syncState.lastCardSignature && card.dataset.ready === '1') return;
    syncState.lastCardSignature = signature;
    card.dataset.ready = '1';

    const signedIn = Boolean(state.auth?.user && !state.auth.user.isAnonymous);
    const canRefresh = signedIn && syncState.firebaseReady && syncState.firestoreReady && !syncState.syncing;
    card.innerHTML = `
      <div class="aps-cloud-sync-head">
        <div>
          <small>CROSS-DEVICE PROGRESS</small>
          <h3>Cloud progress sync</h3>
        </div>
        <span class="aps-cloud-status ${status.tone}">${status.label}</span>
      </div>
      <p class="aps-cloud-message">${escapeCloud(status.message)}</p>
      <div class="aps-cloud-actions">
        <button class="aps-cloud-refresh" data-cloud-action="refresh" ${canRefresh ? '' : 'disabled'} title="Download the newest progress from another device">↻ <b>Refresh</b></button>
        <button data-cloud-action="sync-now" ${canRefresh ? '' : 'disabled'}>Sync now</button>
      </div>
      <p class="aps-cloud-note">Automatic sync saves only changed progress sections. My Vocabs sync separately so large personal sheets do not block your account. Recordings stay on this device.</p>
      ${signedIn && isPasswordUser() ? `<div class="aps-cloud-account-help">${isEmailVerifiedForCloud()?'<span>✓ Email verified</span>':'<button data-cloud-action="verify-email">Verify email</button>'}<button data-cloud-action="reset-password">Reset password</button></div>` : ''}
    `;
  }

  function escapeCloud(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function parseFirebaseConfig(text) {
    const fields = ['apiKey','authDomain','projectId','storageBucket','messagingSenderId','appId','measurementId'];
    const config = {};
    for (const field of fields) {
      const regex = new RegExp(`${field}\\s*:\\s*["']([^"']+)["']`, 'i');
      const match = String(text || '').match(regex);
      if (match) config[field] = match[1].trim();
    }
    if (!config.apiKey || !config.projectId) throw new Error('Paste the Firebase web config containing at least apiKey and projectId.');
    if (config.projectId !== FIREBASE_PROJECT_ID) throw new Error(`Use the Firebase project ${FIREBASE_PROJECT_ID}.`);
    config.authDomain ||= `${FIREBASE_PROJECT_ID}.firebaseapp.com`;
    return config;
  }

  function openSetupDialog() {
    document.querySelector('#apsCloudSetupDialog')?.remove();
    const dialog = document.createElement('div');
    dialog.id = 'apsCloudSetupDialog';
    dialog.className = 'aps-cloud-setup-backdrop';
    dialog.innerHTML = `
      <section class="aps-cloud-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="apsCloudSetupTitle">
        <button class="aps-cloud-setup-close" data-cloud-action="setup-close" aria-label="Close">×</button>
        <small>FIREBASE CONNECTION DIAGNOSTIC</small>
        <h2 id="apsCloudSetupTitle">Reconnect this GitHub app to Firebase</h2>
        <p>The Firebase web configuration is already bundled with this APS NAATI build. Use this only as a fallback diagnostic if the connection cannot initialise.</p>
        <ol>
          <li>Firebase Console → Project settings → Your apps → add/open a Web app.</li>
          <li>Copy the <b>firebaseConfig</b> block and paste it below.</li>
          <li>Authentication → enable <b>Google</b> and <b>Email/Password</b>, then add <code>${escapeCloud(location.hostname)}</code> to Authorized domains.</li>
          <li>Firestore Database → create the database and use the rules supplied in <b>FIREBASE_CLOUD_SYNC_SETUP.txt</b>.</li>
        </ol>
        <textarea id="apsFirebaseConfigInput" spellcheck="false" placeholder="const firebaseConfig = { apiKey: '...', authDomain: '...', projectId: 'aps-naati-ccl-practice', ... };"></textarea>
        <div class="aps-cloud-setup-error" id="apsCloudSetupError"></div>
        <div class="aps-cloud-setup-actions">
          <button data-cloud-action="setup-close">Cancel</button>
          <button class="primary" data-cloud-action="setup-save">Save & reload</button>
        </div>
      </section>`;
    document.body.append(dialog);
  }

  async function saveSetupFromDialog() {
    const input = document.querySelector('#apsFirebaseConfigInput');
    const errorHost = document.querySelector('#apsCloudSetupError');
    try {
      const config = parseFirebaseConfig(input?.value || '');
      originalStorageSetItem.call(localStorage, CONFIG_KEY, JSON.stringify(config));
      location.reload();
    } catch (error) {
      if (errorHost) errorHost.textContent = error?.message || 'Firebase config could not be saved.';
    }
  }

  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;

    if (action === 'auth-email-submit' && state.auth.emailMode === 'create' && !firebaseAuthPlugin()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const displayName = document.querySelector('#authDisplayName')?.value?.trim() || '';
      const email = document.querySelector('#authEmail')?.value?.trim() || '';
      const password = document.querySelector('#authPassword')?.value || '';
      const confirmPassword = document.querySelector('#authPasswordConfirm')?.value || '';
      if (!email || !email.includes('@')) {
        state.auth.error = 'Enter a valid email address.';
        render();
        return;
      }
      if (password.length < 8) {
        state.auth.error = 'Create a password with at least 8 characters.';
        render();
        return;
      }
      if (password !== confirmPassword) {
        state.auth.error = 'The two passwords do not match.';
        render();
        return;
      }
      await completeAuth('email-create', { email, password, displayName });
      return;
    }

    if (action === 'auth-forgot-password') {
      event.preventDefault();
      event.stopImmediatePropagation();
      const email = document.querySelector('#authEmail')?.value?.trim() || '';
      state.auth.error = '';
      state.modal = { type: 'forgot-password', email };
      render();
      return;
    }

    if (action === 'auth-reset-password-submit') {
      event.preventDefault();
      event.stopImmediatePropagation();
      const email = document.querySelector('#authResetEmail')?.value?.trim() || '';
      if (!email || !email.includes('@')) {
        state.auth.error = 'Enter the email address used for your APS account.';
        render();
        return;
      }
      state.auth.busy = true;
      state.auth.error = '';
      render();
      try {
        await webRunAuth('password-reset', { email });
        state.auth.busy = false;
        state.modal = { type: 'password-reset-sent', email };
        render();
      } catch (error) {
        state.auth.busy = false;
        // Avoid account-enumeration clues; the screen gives the same result to legitimate requests.
        const message = friendlyAuthMessage(error, 'Password reset could not be sent. Try again shortly.');
        if (/user-not-found/i.test(String(error?.message || ''))) {
          state.modal = { type: 'password-reset-sent', email };
          state.auth.error = '';
        } else {
          state.auth.error = message;
        }
        render();
      }
      return;
    }

    if (action === 'auth-back-to-signin') {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.auth.emailMode = 'signin';
      state.auth.error = '';
      state.modal = { type: 'email-auth' };
      render();
      return;
    }

    if (action === 'auth-resend-verification') {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.auth.error = '';
      try {
        await webRunAuth('email-resend-verification');
        if (typeof showToast === 'function') showToast('Verification email sent again');
      } catch (error) {
        state.auth.error = friendlyAuthMessage(error, 'Verification email could not be resent.');
        render();
      }
      return;
    }

    if (action === 'auth-check-verification') {
      event.preventDefault();
      event.stopImmediatePropagation();
      state.auth.error = '';
      try {
        const result = await webRunAuth('email-check-verification');
        state.auth.user = normaliseAuthUser(result?.user) || state.auth.user;
        saveAuthProfile();
        if (!result?.user?.emailVerified) {
          state.auth.error = 'The email is not verified yet. Open the verification link in your inbox, then try again.';
          render();
          return;
        }
        await activateVerifiedCloudAccount('email-verified');
        if (typeof showToast === 'function') showToast('Email verified — cloud progress sync is active');
      } catch (error) {
        state.auth.error = friendlyAuthMessage(error, 'Verification status could not be checked.');
        render();
      }
      return;
    }

    if (action === 'auth-verify-signout') {
      event.preventDefault();
      event.stopImmediatePropagation();
      try { await runAuth('signout'); } catch {}
      state.auth.user = null;
      state.auth.error = '';
      state.modal = null;
      saveAuthProfile();
      localStorage.removeItem(storageKeys.authChoice);
      render();
      return;
    }
  }, true);

  document.addEventListener('click', async event => {
    const button = event.target.closest('[data-cloud-action]');
    if (!button) return;
    const action = button.dataset.cloudAction;
    event.preventDefault();
    event.stopPropagation();

    if (action === 'verify-email') {
      state.auth.error = '';
      state.modal = { type: 'verify-email' };
      render();
      return;
    }
    if (action === 'reset-password') {
      const email = currentUser()?.email || state.auth.user?.email || '';
      if (!email) {
        if (typeof showToast === 'function') showToast('No email address is available for this account.');
        return;
      }
      try {
        await webRunAuth('password-reset', { email });
        if (typeof showToast === 'function') showToast('Password reset email sent');
      } catch (error) {
        if (typeof showToast === 'function') showToast(friendlyAuthMessage(error, 'Password reset email could not be sent.'));
      }
      return;
    }
    if (action === 'refresh') {
      button.disabled = true;
      await cloudPull({ reason: 'manual-refresh', manual: true, firstMerge: false });
      ensureCloudCard();
      return;
    }
    if (action === 'sync-now') {
      button.disabled = true;
      const ok = await cloudPush({ reason: 'manual-sync' });
      if (typeof showToast === 'function') showToast(ok ? 'Progress synced to cloud' : (syncState.lastError || 'Cloud sync could not complete'));
      ensureCloudCard();
      return;
    }
    if (action === 'setup') {
      const autoReady = await ensureFirebase({ allowAutoConfig: true });
      if (autoReady) {
        if (typeof showToast === 'function') showToast('Firebase web connection detected. Sign in with Google or Email to enable sync.');
        ensureCloudCard();
      } else openSetupDialog();
      return;
    }
    if (action === 'setup-close') {
      document.querySelector('#apsCloudSetupDialog')?.remove();
      return;
    }
    if (action === 'setup-save') {
      await saveSetupFromDialog();
    }
  }, true);

  window.addEventListener('online', () => {
    if (cloudUserReady()) {
      cloudPull({ reason: 'online', manual: false, firstMerge: false });
      scheduleCloudPush();
    }
  });

  window.addEventListener('focus', () => {
    if (cloudUserReady() && !state.recording && state.playerStatus !== 'playing') {
      cloudPull({ reason: 'focus', manual: false, firstMerge: false });
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && cloudUserReady() && !state.recording) {
      cloudPull({ reason: 'visible', manual: false, firstMerge: false });
    }
  });

  let cloudCardRefreshQueued = false;
  const observer = new MutationObserver(() => {
    if (cloudCardRefreshQueued) return;
    cloudCardRefreshQueued = true;
    requestAnimationFrame(() => {
      cloudCardRefreshQueued = false;
      // My Vocabs and dialogue screens can create hundreds of DOM nodes at once.
      // Only inspect the cloud card when Settings is actually open.
      if (document.querySelector('.app-settings-modal') || document.querySelector('#apsCloudSyncCard')) ensureCloudCard();
    });
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(() => {
    if (document.querySelector('.app-settings-modal') || document.querySelector('#apsCloudSyncCard')) ensureCloudCard();
  }, 5000);

  restoreStatus();
  window.APSCloudSync = {
    version: CLOUD_VERSION,
    status: syncState,
    ensureFirebase,
    refresh: () => cloudPull({ reason: 'manual-api', manual: true, firstMerge: false }),
    syncNow: () => cloudPush({ reason: 'manual-api' }),
  };

  console.info(`${CLOUD_VERSION} loaded`);
})();
