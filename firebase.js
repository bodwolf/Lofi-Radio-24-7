const FIREBASE_SDK_VERSION = "12.7.0";
const FIREBASE_CONFIG_PATH = "./firebase-config.js";

export let app = null;
export let database = null;
export let auth = null;

let databaseRef = null;
let databasePush = null;
let databaseSet = null;
let databaseUpdate = null;
let databaseRemove = null;
let databaseOnValue = null;
let databaseGet = null;
let databaseQuery = null;
let databaseOrderByChild = null;
let databaseEqualTo = null;
let databaseLimitToLast = null;
let firebaseSignInAnonymously = null;
let firebaseGoogleAuthProvider = null;
let firebaseSignInWithPopup = null;
let firebaseSignInWithRedirect = null;
let firebaseGetRedirectResult = null;
let firebaseSignOut = null;
let firebaseOnAuthStateChanged = null;
let firebaseSetPersistence = null;
let firebaseBrowserLocalPersistence = null;

const state = {
    configured: false,
    ready: false,
    error: null,
    userId: null,
    databaseRootRef: null
};

window.BODWOLF_FIREBASE = {
    ready: initializeFirebase(),
    get app() {
        return app;
    },
    get database() {
        return database;
    },
    get auth() {
        return auth;
    },
    get databaseRootRef() {
        return state.databaseRootRef;
    },
    getState() {
        return { ...state };
    },
    signInAnonymousUser,
    getCurrentUserId,
    getDatabaseRootRef,
    runFirebaseSmokeTest,
    signInWithGoogleUser,
    signInWithGoogleRedirect,
    getGoogleRedirectResult,
    setFirebaseAuthLocalPersistence,
    signOutFirebaseUser,
    onFirebaseAuthStateChanged,
    createPlaylistItem,
    watchPlaylistItems,
    markPlaylistItemRemoved,
    createTemporaryStation,
    createTemporaryStationWithFirstTrack,
    getCurrentUserTemporaryStation,
    addTrackToTemporaryStation,
    watchTemporaryStations,
    markTemporaryStationRemoved,
    markTemporaryStationTrackRemoved,
    watchAdminStations,
    watchActiveAdminStations,
    saveAdminStation,
    disableAdminStation,
    markAdminStationRemoved,
    deleteAdminStation,
    getSiteSettings,
    saveSiteSettings,
    createOrUpdateUserProfile,
    listenToChatMessages,
    sendChatMessage
};

async function initializeFirebase() {
    const firebaseConfig = await loadFirebaseConfig();

    if (!firebaseConfig) {
        console.info("Firebase config missing. Static mode enabled.");
        dispatchFirebaseState("bodwolf:firebase-unavailable");
        return state;
    }

    if (!hasRequiredConfig(firebaseConfig) || hasPlaceholderConfig(firebaseConfig)) {
        state.error = "Firebase config is incomplete or still contains placeholder values.";
        state.configured = true;
        console.warn("Firebase error: firebase-config.js is incomplete or still contains placeholder values.");
        console.warn("Renner Radio: paste the real Firebase Web App values into firebase-config.js, then restart the local server.");
        dispatchFirebaseState("bodwolf:firebase-unavailable");
        return state;
    }

    try {
        const [{ initializeApp }, databaseModule, authModule] = await Promise.all([
            import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
            import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-database.js`),
            import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-auth.js`)
        ]);

        app = initializeApp(firebaseConfig);
        console.info("Firebase initialized.");

        database = databaseModule.getDatabase(app);
        auth = authModule.getAuth(app);
        databaseRef = databaseModule.ref;
        databasePush = databaseModule.push;
        databaseSet = databaseModule.set;
        databaseUpdate = databaseModule.update;
        databaseRemove = databaseModule.remove;
        databaseOnValue = databaseModule.onValue;
        databaseGet = databaseModule.get;
        databaseQuery = databaseModule.query;
        databaseOrderByChild = databaseModule.orderByChild;
        databaseEqualTo = databaseModule.equalTo;
        databaseLimitToLast = databaseModule.limitToLast;
        firebaseSignInAnonymously = authModule.signInAnonymously;
        firebaseGoogleAuthProvider = authModule.GoogleAuthProvider;
        firebaseSignInWithPopup = authModule.signInWithPopup;
        firebaseSignInWithRedirect = authModule.signInWithRedirect;
        firebaseGetRedirectResult = authModule.getRedirectResult;
        firebaseSignOut = authModule.signOut;
        firebaseOnAuthStateChanged = authModule.onAuthStateChanged;
        firebaseSetPersistence = authModule.setPersistence;
        firebaseBrowserLocalPersistence = authModule.browserLocalPersistence;

        state.configured = true;
        state.databaseRootRef = getDatabaseRootRef();

        const isAdminPage = isStudioAdminPage();
        const user = isAdminPage ? auth.currentUser : await signInAnonymousUser();
        state.userId = user ? user.uid : null;
        state.ready = Boolean(app && database && auth && state.databaseRootRef && (isAdminPage || state.userId));

        if (!isAdminPage && state.userId) {
            console.info("Anonymous auth ready.");
        }

        if (isAdminPage) {
            console.info("Admin Firebase ready. Google sign-in is available.");
        }

        if (state.databaseRootRef) {
            console.info("Realtime Database reference ready.");
        }

        dispatchFirebaseState(state.ready ? "bodwolf:firebase-ready" : "bodwolf:firebase-unavailable");
        return state;
    } catch (error) {
        state.error = error;
        console.warn(`Firebase error: ${getFirebaseErrorMessage(error)}`, error);
        console.warn("Renner Radio: Firebase setup failed. Static preview continues and the radio is not blocked.");
        dispatchFirebaseState("bodwolf:firebase-unavailable");
        return state;
    }
}

async function loadFirebaseConfig() {
    if (window.location.protocol === "file:") {
        console.warn("Renner Radio: open http://127.0.0.1:4173/ instead of file:// so Firebase modules and config load like deployment.");
    }

    if (!(await configFileExists())) {
        console.info("Renner Radio: firebase-config.js not found beside index.html.");
        return null;
    }

    try {
        const configModule = await import(FIREBASE_CONFIG_PATH);
        const firebaseConfig = configModule.firebaseConfig || configModule.default || null;
        console.info("Renner Radio: firebase-config.js loaded.");
        return firebaseConfig;
    } catch (error) {
        state.error = error;
        console.warn(`Firebase error: firebase-config.js could not be loaded. ${getFirebaseErrorMessage(error)}`, error);
        console.warn("Renner Radio: static preview continues.");
        return null;
    }
}

async function configFileExists() {
    if (window.location.protocol === "file:") {
        return true;
    }

    try {
        const response = await fetch(FIREBASE_CONFIG_PATH, {
            method: "HEAD",
            cache: "no-store"
        });

        return response.ok;
    } catch (error) {
        return false;
    }
}

function hasRequiredConfig(firebaseConfig) {
    return [
        "apiKey",
        "authDomain",
        "databaseURL",
        "projectId",
        "storageBucket",
        "messagingSenderId",
        "appId"
    ].every((key) => typeof firebaseConfig[key] === "string" && firebaseConfig[key].trim().length > 0);
}

function hasPlaceholderConfig(firebaseConfig) {
    return Object.values(firebaseConfig).some((value) => {
        if (typeof value !== "string") return false;
        return value.includes("YOUR_") || value.includes("PASTE_") || value.endsWith("_HERE");
    });
}

export async function signInAnonymousUser() {
    if (!auth || !firebaseSignInAnonymously) return null;
    if (auth.currentUser) {
        state.userId = auth.currentUser.uid;
        return auth.currentUser;
    }

    const credential = await firebaseSignInAnonymously(auth);
    state.userId = credential.user ? credential.user.uid : null;
    return credential.user || null;
}

export function getCurrentUserId() {
    return auth && auth.currentUser ? auth.currentUser.uid : state.userId;
}

export function getDatabaseRootRef() {
    if (!database || !databaseRef) return null;
    return databaseRef(database);
}

export async function signInWithGoogleUser(options = {}) {
    if (!auth || !firebaseGoogleAuthProvider || !firebaseSignInWithPopup) {
        throw new Error("Google sign-in requested before Firebase Auth was ready.");
    }

    const provider = createGoogleProvider();

    try {
        const credential = await firebaseSignInWithPopup(auth, provider);
        state.userId = credential.user ? credential.user.uid : null;
        return {
            method: "popup",
            redirectStarted: false,
            user: credential.user || null
        };
    } catch (error) {
        if (options.redirectFallback === true && shouldUseRedirectFallback(error)) {
            await signInWithGoogleRedirect();
            return {
                method: "redirect",
                redirectStarted: true,
                popupError: getFirebaseErrorDetails(error),
                user: null
            };
        }

        throw error;
    }
}

export async function setFirebaseAuthLocalPersistence() {
    if (!auth || !firebaseSetPersistence || !firebaseBrowserLocalPersistence) {
        throw new Error("Firebase Auth persistence requested before Auth was ready.");
    }

    await firebaseSetPersistence(auth, firebaseBrowserLocalPersistence);
}

export async function signInWithGoogleRedirect() {
    if (!auth || !firebaseGoogleAuthProvider || !firebaseSignInWithRedirect) {
        throw new Error("Google redirect sign-in requested before Firebase Auth was ready.");
    }

    await firebaseSignInWithRedirect(auth, createGoogleProvider());
}

export async function getGoogleRedirectResult() {
    if (!auth || !firebaseGetRedirectResult) {
        throw new Error("Google redirect result requested before Firebase Auth was ready.");
    }

    const credential = await firebaseGetRedirectResult(auth);
    if (credential && credential.user) {
        state.userId = credential.user.uid;
    }

    return credential
        ? {
            method: "redirect",
            user: credential.user || null
        }
        : null;
}

export async function signOutFirebaseUser() {
    if (!auth || !firebaseSignOut) {
        throw new Error("Firebase sign-out requested before Firebase Auth was ready.");
    }

    await firebaseSignOut(auth);
    state.userId = null;
}

export function onFirebaseAuthStateChanged(callback) {
    if (!auth || !firebaseOnAuthStateChanged) return null;
    return firebaseOnAuthStateChanged(auth, (user) => {
        state.userId = user ? user.uid : null;
        callback(user);
    });
}

export async function createPlaylistItem(item) {
    if (!state.ready || !database || !databaseRef || !databasePush || !databaseSet) {
        throw new Error("Firebase playlist write requested before Firebase was ready.");
    }

    const itemRef = databasePush(databaseRef(database, "playlistItems"));
    await databaseSet(itemRef, item);
    return {
        ...item,
        id: itemRef.key
    };
}

export function watchPlaylistItems(onItems, onError) {
    if (!state.ready || !database || !databaseRef || !databaseOnValue || !databaseQuery || !databaseOrderByChild || !databaseEqualTo) {
        return null;
    }

    const activeItemsQuery = databaseQuery(
        databaseRef(database, "playlistItems"),
        databaseOrderByChild("status"),
        databaseEqualTo("active")
    );

    return databaseOnValue(activeItemsQuery, (snapshot) => {
        onItems(snapshot.val() || {});
    }, (error) => {
        if (onError) onError(error);
    });
}

export async function markPlaylistItemRemoved(itemId) {
    if (!state.ready || !database || !databaseRef || !databaseUpdate) {
        throw new Error("Firebase playlist update requested before Firebase was ready.");
    }

    if (!isSafeFirebaseKey(itemId)) {
        throw new Error("Invalid playlist item key.");
    }

    await databaseUpdate(databaseRef(database, `playlistItems/${itemId}`), {
        status: "removed"
    });
}

export async function createTemporaryStation(station) {
    if (!state.ready || !database || !databaseRef || !databasePush || !databaseSet) {
        throw new Error("Firebase temporary channel write requested before Firebase was ready.");
    }

    const stationRef = databasePush(databaseRef(database, "temporaryStations"));
    await databaseSet(stationRef, station);
    return {
        ...station,
        stationId: stationRef.key
    };
}

export async function createTemporaryStationWithFirstTrack(station, track) {
    if (!state.ready || !database || !databaseRef || !databasePush || !databaseSet) {
        throw new Error("Firebase temporary channel write requested before Firebase was ready.");
    }

    const user = await signInAnonymousUser();
    if (!user || !user.uid) {
        throw new Error("Anonymous user is required before creating a temporary channel.");
    }

    const safeStation = {
        ...station,
        createdBy: user.uid
    };
    const stationRef = databasePush(databaseRef(database, "temporaryStations"));
    await databaseSet(stationRef, safeStation);

    const trackRef = databasePush(databaseRef(database, `temporaryStations/${stationRef.key}/tracks`));
    await databaseSet(trackRef, track);

    return {
        ...safeStation,
        stationId: stationRef.key,
        tracks: [{
            ...track,
            trackId: trackRef.key
        }]
    };
}

export async function getCurrentUserTemporaryStation() {
    if (!state.ready || !database || !databaseRef || !databaseGet || !databaseQuery || !databaseOrderByChild || !databaseEqualTo) {
        return null;
    }

    const user = await signInAnonymousUser();
    if (!user || !user.uid) return null;

    const activeStationsQuery = databaseQuery(
        databaseRef(database, "temporaryStations"),
        databaseOrderByChild("status"),
        databaseEqualTo("active")
    );
    const snapshot = await databaseGet(activeStationsQuery);
    const stations = snapshot.val() || {};
    const entry = Object.entries(stations).find(([, station]) => station && station.createdBy === user.uid);

    if (!entry) return null;
    return {
        stationId: entry[0],
        ...entry[1]
    };
}

export async function addTrackToTemporaryStation(stationId, track) {
    if (!state.ready || !database || !databaseRef || !databasePush || !databaseSet) {
        throw new Error("Firebase temporary channel track write requested before Firebase was ready.");
    }

    if (!isSafeFirebaseKey(stationId)) {
        throw new Error("Invalid temporary channel key.");
    }

    await signInAnonymousUser();
    const trackRef = databasePush(databaseRef(database, `temporaryStations/${stationId}/tracks`));
    await databaseSet(trackRef, track);

    return {
        ...track,
        trackId: trackRef.key
    };
}

export function watchTemporaryStations(onStations, onError) {
    if (!state.ready || !database || !databaseRef || !databaseOnValue || !databaseQuery || !databaseOrderByChild || !databaseEqualTo) {
        return null;
    }

    const activeStationsQuery = databaseQuery(
        databaseRef(database, "temporaryStations"),
        databaseOrderByChild("status"),
        databaseEqualTo("active")
    );

    return databaseOnValue(activeStationsQuery, (snapshot) => {
        onStations(snapshot.val() || {});
    }, (error) => {
        if (onError) onError(error);
    });
}

export async function markTemporaryStationRemoved(stationId) {
    if (!state.ready || !database || !databaseRef || !databaseUpdate) {
        throw new Error("Firebase temporary channel update requested before Firebase was ready.");
    }

    if (!isSafeFirebaseKey(stationId)) {
        throw new Error("Invalid temporary channel key.");
    }

    await databaseUpdate(databaseRef(database, `temporaryStations/${stationId}`), {
        status: "removed"
    });
}

export async function markTemporaryStationTrackRemoved(stationId, trackId) {
    if (!state.ready || !database || !databaseRef || !databaseUpdate) {
        throw new Error("Firebase temporary channel track update requested before Firebase was ready.");
    }

    if (!isSafeFirebaseKey(stationId) || !isSafeFirebaseKey(trackId)) {
        throw new Error("Invalid temporary channel or track key.");
    }

    await signInAnonymousUser();
    await databaseUpdate(databaseRef(database, `temporaryStations/${stationId}/tracks/${trackId}`), {
        status: "removed"
    });
}

export function watchAdminStations(onStations, onError) {
    if (!state.ready || !database || !databaseRef || !databaseOnValue) {
        return null;
    }

    return databaseOnValue(databaseRef(database, "adminStations"), (snapshot) => {
        onStations(snapshot.val() || {});
    }, (error) => {
        if (onError) onError(error);
    });
}

export function watchActiveAdminStations(onStations, onError) {
    if (!state.ready || !database || !databaseRef || !databaseOnValue || !databaseQuery || !databaseOrderByChild || !databaseEqualTo) {
        return null;
    }

    const activeStationsQuery = databaseQuery(
        databaseRef(database, "adminStations"),
        databaseOrderByChild("status"),
        databaseEqualTo("active")
    );

    return databaseOnValue(activeStationsQuery, (snapshot) => {
        onStations(snapshot.val() || {});
    }, (error) => {
        if (onError) onError(error);
    });
}

export async function saveAdminStation(stationId, station) {
    if (!state.ready || !database || !databaseRef || !databasePush || !databaseSet) {
        throw new Error("Firebase admin station write requested before Firebase was ready.");
    }

    const stationRef = stationId && isSafeFirebaseKey(stationId)
        ? databaseRef(database, `adminStations/${stationId}`)
        : databasePush(databaseRef(database, "adminStations"));

    await databaseSet(stationRef, station);
    return {
        ...station,
        stationId: stationRef.key || stationId
    };
}

export async function disableAdminStation(stationId, userId) {
    if (!state.ready || !database || !databaseRef || !databaseUpdate) {
        throw new Error("Firebase admin station update requested before Firebase was ready.");
    }

    if (!isSafeFirebaseKey(stationId)) {
        throw new Error("Invalid admin station key.");
    }

    await databaseUpdate(databaseRef(database, `adminStations/${stationId}`), {
        isActive: false,
        status: "disabled",
        updatedAt: Date.now(),
        updatedBy: userId || getCurrentUserId() || ""
    });
}

export async function markAdminStationRemoved(stationId, userId) {
    if (!state.ready || !database || !databaseRef || !databaseUpdate) {
        throw new Error("Firebase admin station remove requested before Firebase was ready.");
    }

    if (!isSafeFirebaseKey(stationId)) {
        throw new Error("Invalid admin station key.");
    }

    await databaseUpdate(databaseRef(database, `adminStations/${stationId}`), {
        isActive: false,
        status: "removed",
        removedAt: Date.now(),
        removedBy: userId || getCurrentUserId() || "",
        updatedAt: Date.now(),
        updatedBy: userId || getCurrentUserId() || ""
    });
}

export async function deleteAdminStation(stationId) {
    if (!state.ready || !database || !databaseRef || !databaseRemove) {
        throw new Error("Firebase admin station delete requested before Firebase was ready.");
    }

    if (!isSafeFirebaseKey(stationId)) {
        throw new Error("Invalid admin station key.");
    }

    await databaseRemove(databaseRef(database, `adminStations/${stationId}`));
}

export async function getSiteSettings() {
    if (!state.ready || !database || !databaseRef || !databaseGet) {
        return null;
    }

    const snapshot = await databaseGet(databaseRef(database, "siteSettings"));
    return snapshot.val() || null;
}

export async function saveSiteSettings(settings) {
    if (!state.ready || !database || !databaseRef || !databaseSet) {
        throw new Error("Firebase site settings write requested before Firebase was ready.");
    }

    await databaseSet(databaseRef(database, "siteSettings"), settings);
    return settings;
}

export async function createOrUpdateUserProfile(profile) {
    if (!state.ready || !database || !databaseRef || !databaseSet) {
        throw new Error("Firebase profile write requested before Firebase was ready.");
    }

    const user = await signInAnonymousUser();
    if (!user || !user.uid) {
        throw new Error("Anonymous user is required before saving a chat profile.");
    }

    const safeProfile = {
        displayName: profile.displayName,
        userColor: profile.userColor,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt || Date.now()
    };

    await databaseSet(databaseRef(database, `userProfiles/${user.uid}`), safeProfile);
    return {
        ...safeProfile,
        uid: user.uid
    };
}

export function listenToChatMessages(onMessages, onError) {
    if (!state.ready || !database || !databaseRef || !databaseOnValue || !databaseQuery || !databaseOrderByChild || !databaseLimitToLast) {
        return null;
    }

    const recentMessagesQuery = databaseQuery(
        databaseRef(database, "chatMessages"),
        databaseOrderByChild("createdAt"),
        databaseLimitToLast(50)
    );

    return databaseOnValue(recentMessagesQuery, (snapshot) => {
        onMessages(snapshot.val() || {});
    }, (error) => {
        if (onError) onError(error);
    });
}

export async function sendChatMessage(message) {
    if (!state.ready || !database || !databaseRef || !databasePush || !databaseSet) {
        throw new Error("Firebase chat write requested before Firebase was ready.");
    }

    const user = await signInAnonymousUser();
    if (!user || !user.uid) {
        throw new Error("Anonymous user is required before sending chat messages.");
    }

    const messageRef = databasePush(databaseRef(database, "chatMessages"));
    const safeMessage = {
        text: message.text,
        displayName: message.displayName,
        userColor: message.userColor,
        uid: user.uid,
        createdAt: message.createdAt
    };

    await databaseSet(messageRef, safeMessage);
    return {
        ...safeMessage,
        id: messageRef.key
    };
}

export async function runFirebaseSmokeTest() {
    if (!state.configured) {
        return {
            ok: false,
            skipped: true,
            reason: "Firebase config is missing."
        };
    }

    if (!app || !database || !auth || !databaseRef) {
        return {
            ok: false,
            skipped: false,
            reason: "Firebase is not initialized."
        };
    }

    const user = await signInAnonymousUser();
    if (!user || !user.uid || !user.isAnonymous) {
        return {
            ok: false,
            skipped: false,
            reason: "Anonymous auth is not active."
        };
    }

    const statusRef = databaseRef(database, "system/status");
    if (!statusRef) {
        return {
            ok: false,
            skipped: false,
            reason: "Database reference could not be created.",
            userId: user.uid
        };
    }

    return {
        ok: true,
        skipped: false,
        reason: "Firebase app, anonymous auth, and database reference are available.",
        userId: user.uid,
        isAnonymous: user.isAnonymous,
        databasePath: "/system/status",
        wroteData: false,
        readData: false
    };
}

function dispatchFirebaseState(eventName) {
    window.dispatchEvent(new CustomEvent(eventName, {
        detail: { ...state }
    }));
}

function isStudioAdminPage() {
    return window.location.pathname.toLowerCase().endsWith("/admin.html") || window.location.pathname.toLowerCase().endsWith("admin.html");
}

function isSafeFirebaseKey(itemId) {
    return typeof itemId === "string" && itemId.length > 0 && !/[.#$/\[\]]/.test(itemId);
}

function createGoogleProvider() {
    const provider = new firebaseGoogleAuthProvider();
    provider.setCustomParameters({
        prompt: "select_account"
    });
    return provider;
}

function shouldUseRedirectFallback(error) {
    const code = error && error.code ? error.code : "";
    return [
        "auth/popup-blocked",
        "auth/cancelled-popup-request",
        "auth/operation-not-supported-in-this-environment",
        "auth/web-storage-unsupported"
    ].includes(code);
}

function getFirebaseErrorDetails(error) {
    return {
        code: error && error.code ? error.code : "unknown",
        message: getFirebaseErrorMessage(error)
    };
}

function getFirebaseErrorMessage(error) {
    if (!error) return "Unknown Firebase error.";
    return error.message || String(error);
}
