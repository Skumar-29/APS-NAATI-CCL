'use strict';

(() => {
  const CLOUD_VERSION = 'aps-naati-cloud-sync-v11';
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
  const SYNC_DEBOUNCE_MS = 15000;

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
    if (key === storageKeys.vocabSettings) {
      const local = safeParse(localValue, {}) || {};
      const remote = safeParse(remoteValue, {}) || {};
      for (const voiceKey of VOICE_KEYS) delete remote[voiceKey];
      return JSON.stringify({ ...remote, ...local });
    }
    // For onboarding/language, preserve the local device choice on first merge.
    return localValue;
  }

  function localSnapshot(meta = loadMeta()) {
    const keys = {};
    for (const key of SYNC_KEYS) {
      const raw = localStorage.getItem(key);
      if (raw == null) continue;
      keys[key] = {
        value: sanitiseValueForCloud(key, raw),
        updatedAt: Number(meta[key]) || 1,
      };
    }
    return keys;
  }

  function cloudDocument() {
    const user = currentUser();
    if (!user || user.isAnonymous) return null;
    return window.firebase.firestore().collection(COLLECTION).doc(user.uid);
  }

  async function refreshInMemoryState() {
    try {
      const storedSettings = getJSON(storageKeys.vocabSettings, {});
      Object.assign(state.vocabSettings, storedSettings || {});
      normaliseVocabSettings(storedSettings || {});

      const selected = localStorage.getItem(storageKeys.selectedLanguage);
      if (selected && selected !== state.selectedLanguage) {
        await loadLanguagePack(selected);
      }
      render();
    } catch (error) {
      console.warn(`${CLOUD_VERSION}: could not refresh in-memory state`, error);
    }
  }

  async function cloudPush({ reason = 'auto' } = {}) {
    if (!cloudUserReady() || syncState.syncing || syncState.applyingRemote) return false;
    const ref = cloudDocument();
    if (!ref) return false;
    syncState.syncing = true;
    syncState.lastError = '';
    ensureCloudCard();
    try {
      const meta = loadMeta();
      const keys = localSnapshot(meta);
      await ref.set({
        schemaVersion: 1,
        appVersion: 'github-study-ready-2026-08-07-v9',
        projectId: FIREBASE_PROJECT_ID,
        updatedAtClient: nowMs(),
        updatedAt: window.firebase.firestore.FieldValue.serverTimestamp(),
        lastDevice: navigator.userAgent.slice(0, 220),
        reason,
        keys,
      }, { merge: true });
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
    const ref = cloudDocument();
    if (!ref) return false;

    syncState.syncing = true;
    syncState.lastError = '';
    ensureCloudCard();
    let changed = false;
    let needsPush = false;
    try {
      const snapshot = await ref.get({ source: 'server' }).catch(() => ref.get());
      const meta = loadMeta();
      const currentTime = nowMs();

      if (!snapshot.exists) {
        for (const key of SYNC_KEYS) {
          if (localStorage.getItem(key) != null && !Number(meta[key])) meta[key] = currentTime;
        }
        saveMeta(meta);
        syncState.lastPullAt = new Date().toISOString();
        syncState.lastSyncAt = syncState.lastPullAt;
        syncState.initialPullDoneForUid = user.uid;
        rememberStatus();
        syncState.syncing = false;
        await cloudPush({ reason: 'create-cloud-progress' });
        return true;
      }

      const remote = snapshot.data() || {};
      const remoteKeys = remote.keys || {};
      syncState.applyingRemote = true;

      for (const key of SYNC_KEYS) {
        const remoteEntry = remoteKeys[key];
        const localRaw = localStorage.getItem(key);
        const localTs = Number(meta[key]) || 0;
        const remoteTs = Number(remoteEntry?.updatedAt) || 0;
        const remoteRaw = remoteEntry?.value ?? null;

        if (!remoteEntry && localRaw != null) {
          if (!localTs) meta[key] = currentTime;
          needsPush = true;
          continue;
        }
        if (!remoteEntry) continue;

        const alwaysMerge = key === storageKeys.practiceDaily || key === storageKeys.recallProgress;
        if (alwaysMerge && localRaw != null && remoteRaw != null && sanitiseValueForCloud(key, localRaw) !== remoteRaw) {
          const merged = mergeFirstTimeValue(key, localRaw, remoteRaw);
          applyCloudValueLocally(key, merged);
          meta[key] = currentTime;
          changed = changed || merged !== localRaw;
          needsPush = true;
          continue;
        }

        if (firstMerge && localTs === 0 && localRaw != null) {
          const merged = mergeFirstTimeValue(key, localRaw, remoteRaw);
          applyCloudValueLocally(key, merged);
          meta[key] = currentTime;
          changed = changed || merged !== localRaw;
          needsPush = true;
          continue;
        }

        if (remoteTs > localTs) {
          applyCloudValueLocally(key, remoteRaw);
          meta[key] = remoteTs;
          changed = changed || remoteRaw !== sanitiseValueForCloud(key, localRaw);
        } else if (localTs > remoteTs) {
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
          needsPush = true;
        }
      }

      saveMeta(meta);
      syncState.applyingRemote = false;
      syncState.lastPullAt = new Date().toISOString();
      syncState.lastSyncAt = syncState.lastPullAt;
      syncState.initialPullDoneForUid = user.uid;
      rememberStatus();

      if (changed) await refreshInMemoryState();
      if (needsPush) {
        syncState.syncing = false;
        await cloudPush({ reason: `${reason}-merge` });
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
      return 'Cloud sync is connected, but Firestore security rules are not ready. Open Cloud sync Setup in Settings.';
    }
    if (code.includes('unavailable')) return 'Cloud sync is temporarily unavailable. Your progress is still saved on this device.';
    if (code.includes('unauthorized-domain')) return `Add ${location.hostname} to Firebase Authentication → Authorized domains.`;
    return message.replace(/^Firebase:\s*/i, '').slice(0, 260);
  }

  function markLocalChange(key) {
    if (!isSyncKey(key) || syncState.applyingRemote) return;
    const meta = loadMeta();
    meta[key] = nowMs();
    saveMeta(meta);
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
      () => cloudPush({ reason: 'local-change' }),
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
      message: `Last sync: ${formatTime(syncState.lastSyncAt)}`
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
      <p class="aps-cloud-note">Automatic sync runs after progress changes and when you return to the app. The Refresh button manually checks another device. Recordings stay on the device; learning progress and results sync.</p>
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

  const observer = new MutationObserver(() => ensureCloudCard());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.setInterval(ensureCloudCard, 1200);

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
