import {
    signInWithGoogleUser,
    signInWithGoogleRedirect,
    getGoogleRedirectResult,
    setFirebaseAuthLocalPersistence,
    signOutFirebaseUser,
    onFirebaseAuthStateChanged,
    watchAdminStations,
    saveAdminStation,
    disableAdminStation,
    markAdminStationRemoved,
    deleteAdminStation,
    getSiteSettings,
    saveSiteSettings
} from "./firebase.js?v=16.2";

const ADMIN_UID = "k2JfANYX7iWVILK3AeSB3MiO7sv1";

const PLACEHOLDER_UID = "PASTE_ADMIN_UID_HERE";
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const ALLOWED_CATEGORIES = [
    "LOFI",
    "SYNTHWAVE",
    "CHILLHOP",
    "JAZZHOP",
    "AMBIENT",
    "DEEP HOUSE",
    "HOUSE",
    "RETRO",
    "STUDY",
    "SLEEP",
    "RELAX",
    "RADIO",
    "SONG",
    "CUSTOM"
];
const STATUS_FILTERS = ["active", "disabled", "removed", "all"];
const FREQUENCY_MIN = 87.5;
const FREQUENCY_MAX = 108.0;
const FREQUENCY_STEP = 0.1;

const dom = {
    adminGoogleSignInButton: document.getElementById("adminGoogleSignInButton"),
    adminGoogleRedirectButton: document.getElementById("adminGoogleRedirectButton"),
    signOutBtn: document.getElementById("signOutBtn"),
    adminEmail: document.getElementById("adminEmail"),
    adminUid: document.getElementById("adminUid"),
    adminState: document.getElementById("adminState"),
    adminMessage: document.getElementById("adminMessage"),
    adminAccessPill: document.getElementById("adminAccessPill"),
    studioTools: document.getElementById("studioTools"),
    stationForm: document.getElementById("stationForm"),
    importDefaultStationsBtn: document.getElementById("importDefaultStationsBtn"),
    stationEditingLabel: document.getElementById("stationEditingLabel"),
    stationIdInput: document.getElementById("stationIdInput"),
    stationNameInput: document.getElementById("stationNameInput"),
    stationFrequencyInput: document.getElementById("stationFrequencyInput"),
    generateFrequencyBtn: document.getElementById("generateFrequencyBtn"),
    stationCategoryInput: document.getElementById("stationCategoryInput"),
    stationYoutubeInput: document.getElementById("stationYoutubeInput"),
    stationThumbnailInput: document.getElementById("stationThumbnailInput"),
    stationBackgroundVideoInput: document.getElementById("stationBackgroundVideoInput"),
    stationBackgroundGifInput: document.getElementById("stationBackgroundGifInput"),
    stationBackgroundImageInput: document.getElementById("stationBackgroundImageInput"),
    stationAccentColorInput: document.getElementById("stationAccentColorInput"),
    stationSortOrderInput: document.getElementById("stationSortOrderInput"),
    stationDescriptionInput: document.getElementById("stationDescriptionInput"),
    stationActiveInput: document.getElementById("stationActiveInput"),
    saveStationBtn: document.getElementById("saveStationBtn"),
    resetStationBtn: document.getElementById("resetStationBtn"),
    cancelEditBtn: document.getElementById("cancelEditBtn"),
    stationFormMessage: document.getElementById("stationFormMessage"),
    stationCountPill: document.getElementById("stationCountPill"),
    stationSearchInput: document.getElementById("stationSearchInput"),
    stationStatusFilter: document.getElementById("stationStatusFilter"),
    stationListCategoryFilter: document.getElementById("stationListCategoryFilter"),
    stationSortFilter: document.getElementById("stationSortFilter"),
    stationStatusSummary: document.getElementById("stationStatusSummary"),
    stationListEmpty: document.getElementById("stationListEmpty"),
    adminStationList: document.getElementById("adminStationList"),
    findDuplicatesBtn: document.getElementById("findDuplicatesBtn"),
    markDuplicatesRemovedBtn: document.getElementById("markDuplicatesRemovedBtn"),
    recalculateSortOrderBtn: document.getElementById("recalculateSortOrderBtn"),
    maintenanceMessage: document.getElementById("maintenanceMessage"),
    duplicatePreviewList: document.getElementById("duplicatePreviewList"),
    siteSettingsForm: document.getElementById("siteSettingsForm"),
    defaultStationIdInput: document.getElementById("defaultStationIdInput"),
    defaultThemeInput: document.getElementById("defaultThemeInput"),
    comfortModeDefaultInput: document.getElementById("comfortModeDefaultInput"),
    staticSoundDefaultInput: document.getElementById("staticSoundDefaultInput"),
    saveSiteSettingsBtn: document.getElementById("saveSiteSettingsBtn"),
    siteSettingsMessage: document.getElementById("siteSettingsMessage")
};

const state = {
    currentUser: null,
    isAdmin: false,
    firebaseReady: false,
    rawStationRecords: {},
    stations: [],
    selectedStation: null,
    duplicateGroups: [],
    listFilters: {
        search: "",
        status: "active",
        category: "ALL",
        sort: "sortOrder"
    },
    unsubscribeAuth: null,
    unsubscribeStations: null,
    settingsLoaded: false,
    authResolved: false,
    lastSignInError: "",
    clearingAnonymousUser: false
};

window.bodwolfAdminSignIn = startGoogleSignIn;
initStudioPanel();

async function initStudioPanel() {
    populateCategoryOptions();
    bindEvents();
    resetStationForm();
    setToolsVisible(false);
    setAccessPill("Checking Firebase", "neutral");
    setAdminMessage("Preparing Studio Panel access...", "neutral");

    try {
        const firebaseState = await window.BODWOLF_FIREBASE.ready;
        state.firebaseReady = Boolean(firebaseState && firebaseState.ready);

        if (!state.firebaseReady) {
            const reason = firebaseState && firebaseState.error
                ? getErrorMessage(firebaseState.error)
                : "Firebase config is missing or Firebase could not initialize.";
            setAccessPill("Firebase unavailable", "denied");
            setAdminState("Static mode");
            setAdminMessage(`${reason} Studio tools require Firebase and Google sign-in.`, "error");
            dom.adminGoogleSignInButton.disabled = true;
            dom.adminGoogleRedirectButton.disabled = true;
            return;
        }

        console.info("Studio Panel: Firebase ready");
        await ensureAuthPersistence(false);
        await handleRedirectResult();

        state.authResolved = false;
        state.unsubscribeAuth = onFirebaseAuthStateChanged(handleAuthState);
        if (!state.unsubscribeAuth) {
            setAccessPill("Auth unavailable", "denied");
            setAdminState("Auth listener failed");
            setAdminMessage("Firebase Auth is not ready. Reopen admin.html after Firebase finishes loading.", "error");
            dom.adminGoogleSignInButton.disabled = true;
            dom.adminGoogleRedirectButton.disabled = true;
            return;
        }

        if (!state.lastSignInError) {
            setSignedOutState();
        }

        window.setTimeout(() => {
            if (!state.authResolved && !state.currentUser) {
                console.info("Studio Panel: auth state still pending; showing signed-out state.");
                setSignedOutState();
            }
        }, 5000);
    } catch (error) {
        setAccessPill("Firebase error", "denied");
        setAdminState("Initialization failed");
        setAdminMessage(`Firebase error: ${getFirebaseAuthErrorText(error)}`, "error");
        dom.adminGoogleSignInButton.disabled = true;
        dom.adminGoogleRedirectButton.disabled = true;
    }
}

function bindEvents() {
    dom.adminGoogleSignInButton.addEventListener("click", startGoogleSignIn);
    dom.adminGoogleRedirectButton.addEventListener("click", startGoogleRedirectSignIn);
    dom.signOutBtn.addEventListener("click", handleSignOut);
    dom.importDefaultStationsBtn.addEventListener("click", importDefaultStations);
    dom.stationForm.addEventListener("submit", handleStationSubmit);
    dom.generateFrequencyBtn.addEventListener("click", handleGenerateFrequency);
    dom.resetStationBtn.addEventListener("click", resetStationForm);
    dom.cancelEditBtn.addEventListener("click", resetStationForm);
    dom.adminStationList.addEventListener("click", handleStationListClick);
    dom.stationSearchInput.addEventListener("input", handleStationFilterChange);
    dom.stationStatusFilter.addEventListener("change", handleStationFilterChange);
    dom.stationListCategoryFilter.addEventListener("change", handleStationFilterChange);
    dom.stationSortFilter.addEventListener("change", handleStationFilterChange);
    dom.findDuplicatesBtn.addEventListener("click", findDuplicateStations);
    dom.markDuplicatesRemovedBtn.addEventListener("click", markDuplicateStationsRemoved);
    dom.recalculateSortOrderBtn.addEventListener("click", recalculateSortOrder);
    dom.siteSettingsForm.addEventListener("submit", handleSiteSettingsSubmit);
}

function populateCategoryOptions() {
    dom.stationCategoryInput.textContent = "";
    dom.stationListCategoryFilter.textContent = "";

    const allOption = document.createElement("option");
    allOption.value = "ALL";
    allOption.textContent = "All categories";
    dom.stationListCategoryFilter.appendChild(allOption);

    ALLOWED_CATEGORIES.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        dom.stationCategoryInput.appendChild(option);

        const filterOption = option.cloneNode(true);
        dom.stationListCategoryFilter.appendChild(filterOption);
    });
}

function handleStationFilterChange() {
    state.listFilters.search = trimValue(dom.stationSearchInput.value).toLowerCase();
    state.listFilters.status = STATUS_FILTERS.includes(dom.stationStatusFilter.value)
        ? dom.stationStatusFilter.value
        : "active";
    state.listFilters.category = dom.stationListCategoryFilter.value || "ALL";
    state.listFilters.sort = dom.stationSortFilter.value || "sortOrder";
    renderStationList();
}

async function startGoogleSignIn() {
    setButtonBusy(dom.adminGoogleSignInButton, true);
    dom.adminGoogleRedirectButton.classList.add("hidden");
    state.lastSignInError = "";
    console.info("Studio Panel: Google sign-in button clicked");
    console.info("Studio Panel: starting Google popup sign-in");
    setAdminMessage("Opening Google popup sign-in...", "neutral");

    try {
        await ensureAuthPersistence(true);
        const result = await signInWithGoogleUser({ redirectFallback: false });
        if (result && result.user) {
            console.info("Studio Panel: signed in UID detected", result.user.uid);
        }
    } catch (error) {
        console.warn("Studio Panel: sign-in error", getFirebaseAuthErrorDetails(error));
        state.lastSignInError = getFirebaseAuthErrorText(error);
        setAdminMessage(`Google popup sign-in failed: ${state.lastSignInError}. Use redirect sign-in if popup login does not work.`, "error");
        dom.adminGoogleRedirectButton.classList.remove("hidden");
    } finally {
        setButtonBusy(dom.adminGoogleSignInButton, false);
    }
}

async function startGoogleRedirectSignIn() {
    setButtonBusy(dom.adminGoogleRedirectButton, true);
    state.lastSignInError = "";
    console.info("Studio Panel: starting Google redirect sign-in");
    setAdminMessage("Redirecting to Google sign-in...", "neutral");

    try {
        await ensureAuthPersistence(true);
        await signInWithGoogleRedirect();
    } catch (error) {
        console.warn("Studio Panel: sign-in error", getFirebaseAuthErrorDetails(error));
        state.lastSignInError = getFirebaseAuthErrorText(error);
        setAdminMessage(`Google redirect sign-in failed: ${state.lastSignInError}`, "error");
    } finally {
        setButtonBusy(dom.adminGoogleRedirectButton, false);
    }
}

async function handleSignOut() {
    setButtonBusy(dom.signOutBtn, true);

    try {
        stopAdminStationListener();
        state.lastSignInError = "";
        dom.adminGoogleRedirectButton.classList.add("hidden");
        await signOutFirebaseUser();
        setAdminMessage("Signed out of Studio Panel.", "neutral");
    } catch (error) {
        setAdminMessage(`Sign-out failed: ${getErrorMessage(error)}`, "error");
    } finally {
        setButtonBusy(dom.signOutBtn, false);
    }
}

function handleAuthState(user) {
    state.authResolved = true;
    state.currentUser = user || null;
    state.isAdmin = false;
    stopAdminStationListener();
    setToolsVisible(false);
    console.info("Studio Panel: auth state changed", user ? "signed-in" : "signed-out");

    if (user && user.isAnonymous) {
        clearAnonymousAdminUser();
        setSignedOutState();
        return;
    }

    if (!user || !isGoogleSignedInUser(user)) {
        setSignedOutState();
        return;
    }

    dom.adminEmail.textContent = user.email || "Google account";
    dom.adminUid.textContent = user.uid;
    console.info("Studio Panel: signed in UID detected", user.uid);
    dom.adminGoogleSignInButton.classList.add("hidden");
    dom.adminGoogleRedirectButton.classList.add("hidden");
    dom.signOutBtn.classList.remove("hidden");

    if (!isAdminUidConfigured()) {
        setAccessPill("Setup required", "neutral");
        setAdminState("Setup required");
        setAdminMessage("Copy this UID into ADMIN_UID and database.rules.json.", "neutral");
        return;
    }

    if (user.uid !== ADMIN_UID.trim()) {
        console.warn("Studio Panel: access denied", { signedInUid: user.uid });
        setAccessPill("Access denied", "denied");
        setAdminState("Access denied");
        setAdminMessage("Access denied. This Google account does not match the Studio Panel admin UID.", "error");
        return;
    }

    state.isAdmin = true;
    console.info("Studio Panel: admin access granted");
    setAccessPill("Admin access granted", "ready");
    setAdminState("Admin access granted");
    setAdminMessage("Studio Panel ready. Changes are written to Firebase Realtime Database.", "success");
    setToolsVisible(true);
    startAdminStationListener();
    loadSiteSettings();
}

function setSignedOutState() {
    state.currentUser = null;
    dom.adminEmail.textContent = "Not signed in";
    dom.adminUid.textContent = "Waiting for Google sign-in";
    dom.adminGoogleSignInButton.disabled = false;
    dom.adminGoogleSignInButton.classList.remove("hidden");
    dom.signOutBtn.classList.add("hidden");

    if (state.lastSignInError) {
        setAdminState("Firebase error");
        setAccessPill("Firebase error", "denied");
        setAdminMessage(`Firebase error: ${state.lastSignInError}`, "error");
        dom.adminGoogleRedirectButton.classList.remove("hidden");
        return;
    }

    dom.adminGoogleRedirectButton.classList.add("hidden");
    setAdminState("Not signed in");
    setAccessPill("Google required", "neutral");
    setAdminMessage("Sign in with Google to access the private Studio Panel.", "neutral");
}

function isGoogleSignedInUser(user) {
    return Boolean(user.providerData && user.providerData.some((provider) => provider.providerId === "google.com"));
}

function isAdminUidConfigured() {
    return typeof ADMIN_UID === "string" && ADMIN_UID.trim().length > 0 && ADMIN_UID.trim() !== PLACEHOLDER_UID;
}

async function handleRedirectResult() {
    try {
        const result = await getGoogleRedirectResult();
        if (result && result.user) {
            console.info("Studio Panel: signed in UID detected", result.user.uid);
            setAdminMessage("Returned from Google redirect. Checking admin access...", "neutral");
        }
    } catch (error) {
        console.warn("Studio Panel: sign-in error", getFirebaseAuthErrorDetails(error));
        state.lastSignInError = getFirebaseAuthErrorText(error);
        setAccessPill("Firebase error", "denied");
        setAdminState("Firebase error");
        setAdminMessage(`Firebase error: ${state.lastSignInError}`, "error");
    }
}

async function clearAnonymousAdminUser() {
    if (state.clearingAnonymousUser) return;

    state.clearingAnonymousUser = true;
    console.info("Studio Panel: anonymous auth ignored on admin page");

    try {
        await signOutFirebaseUser();
    } catch (error) {
        console.warn("Studio Panel: sign-in error", getFirebaseAuthErrorDetails(error));
    } finally {
        state.clearingAnonymousUser = false;
    }
}

async function ensureAuthPersistence(showErrors) {
    try {
        await setFirebaseAuthLocalPersistence();
    } catch (error) {
        const errorText = getFirebaseAuthErrorText(error);
        console.warn("Studio Panel: auth persistence error", getFirebaseAuthErrorDetails(error));
        if (showErrors) {
            setAdminMessage(`Auth persistence warning: ${errorText}. Continuing with default persistence.`, "error");
        }
    }
}

function startAdminStationListener() {
    if (state.unsubscribeStations) return;

    state.unsubscribeStations = watchAdminStations((records) => {
        state.rawStationRecords = records || {};
        state.stations = normalizeStationRecords(records);
        renderStationList();
        if (state.duplicateGroups.length) {
            state.duplicateGroups = getDuplicateStationGroups();
            renderDuplicatePreview();
        }
    }, (error) => {
        setAdminMessage(`Could not read admin stations: ${getErrorMessage(error)}`, "error");
    });

    if (!state.unsubscribeStations) {
        setAdminMessage("Admin station listener could not start. Check Firebase rules and admin UID setup.", "error");
    }
}

function stopAdminStationListener() {
    if (typeof state.unsubscribeStations === "function") {
        state.unsubscribeStations();
    }

    state.unsubscribeStations = null;
    state.rawStationRecords = {};
    state.stations = [];
    state.selectedStation = null;
    renderStationList();
}

function normalizeStationRecords(records) {
    return Object.entries(records || {})
        .map(([stationId, station]) => ({
            stationId,
            ...station,
            status: station.status || (station.isActive === false ? "disabled" : "active"),
            category: normalizeCategory(station.category)
        }));
}

function renderStationList() {
    dom.adminStationList.innerHTML = "";
    const visibleStations = getVisibleAdminStations();
    const counts = getStationCounts();
    dom.stationCountPill.textContent = `${visibleStations.length} shown`;
    dom.stationStatusSummary.textContent = `Active ${counts.active} / Disabled ${counts.disabled} / Removed ${counts.removed}`;
    dom.stationListEmpty.classList.toggle("hidden", visibleStations.length > 0);

    const fragment = document.createDocumentFragment();

    visibleStations.forEach((station) => {
        const item = document.createElement("li");
        item.className = "admin-station-item";
        item.dataset.status = station.status || "active";

        const main = document.createElement("div");
        main.className = "admin-station-main";

        const title = document.createElement("strong");
        title.textContent = station.name || "Untitled station";

        const meta = document.createElement("span");
        meta.textContent = [
            station.frequency || "No frequency",
            `Sort ${Number(station.sortOrder || 0)}`
        ].join(" / ");

        const badges = document.createElement("div");
        badges.className = "station-badges";
        [
            station.category || "CUSTOM",
            station.status || "active",
            isValidYouTubeId(station.youtubeId) ? "Video OK" : "Missing video"
        ].forEach((text) => {
            const badge = document.createElement("span");
            badge.textContent = text;
            badges.appendChild(badge);
        });

        main.append(title, meta, badges);

        const actions = document.createElement("div");
        actions.className = "admin-station-actions";
        const isRemoved = station.status === "removed";
        const isDisabled = station.status === "disabled" || station.isActive === false;
        actions.append(createStationActionButton("Edit", "edit", station.stationId, "primary-card-action"));

        if (!isRemoved) {
            actions.append(
                createStationActionButton(isDisabled ? "Enable" : "Disable", isDisabled ? "enable" : "disable", station.stationId),
                createStationActionButton("Mark Removed", "remove", station.stationId, "danger-action")
            );
        }

        actions.append(
            createStationActionButton("Delete", "delete", station.stationId, "danger-action")
        );

        item.append(main, actions);
        fragment.appendChild(item);
    });

    dom.adminStationList.appendChild(fragment);
}

function getVisibleAdminStations() {
    const search = state.listFilters.search;
    const status = state.listFilters.status;
    const category = state.listFilters.category;

    return [...state.stations]
        .filter((station) => {
            if (!station) return false;
            const stationStatus = station.status || "active";
            if (status !== "all" && stationStatus !== status) return false;
            if (category !== "ALL" && normalizeCategory(station.category) !== category) return false;
            if (!search) return true;

            return [
                station.name,
                station.frequency,
                station.category,
                station.youtubeId
            ].some((value) => String(value || "").toLowerCase().includes(search));
        })
        .sort(compareAdminStations);
}

function compareAdminStations(a, b) {
    switch (state.listFilters.sort) {
        case "name":
            return String(a.name || "").localeCompare(String(b.name || ""));
        case "frequency":
            return Number(a.frequency || 0) - Number(b.frequency || 0);
        case "updatedAt":
            return Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
        case "sortOrder":
        default: {
            const sortDelta = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
            if (sortDelta !== 0) return sortDelta;
            return String(a.name || "").localeCompare(String(b.name || ""));
        }
    }
}

function getStationCounts() {
    return state.stations.reduce((counts, station) => {
        const status = station && station.status ? station.status : "active";
        if (status === "active") counts.active += 1;
        if (status === "disabled") counts.disabled += 1;
        if (status === "removed") counts.removed += 1;
        return counts;
    }, { active: 0, disabled: 0, removed: 0 });
}

function createStationActionButton(label, action, stationId, extraClass = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.action = action;
    button.dataset.stationId = stationId;
    if (extraClass) button.classList.add(extraClass);
    return button;
}

function handleStationListClick(event) {
    const button = event.target.closest("button[data-action][data-station-id]");
    if (!button) return;

    const station = state.stations.find((item) => item.stationId === button.dataset.stationId);
    if (!station) {
        setStationFormMessage("Station record was not found.", "error");
        return;
    }

    if (button.dataset.action === "edit") {
        populateStationForm(station);
        return;
    }

    if (button.dataset.action === "disable") {
        setStationEnabled(station.stationId, false);
        return;
    }

    if (button.dataset.action === "enable") {
        setStationEnabled(station.stationId, true);
        return;
    }

    if (button.dataset.action === "remove") {
        removeStation(station.stationId);
        return;
    }

    if (button.dataset.action === "delete") {
        deleteStation(station.stationId);
    }
}

function populateStationForm(station) {
    state.selectedStation = station;
    dom.stationIdInput.value = station.stationId || "";
    dom.stationNameInput.value = station.name || "";
    dom.stationFrequencyInput.value = station.frequency || "";
    dom.stationCategoryInput.value = normalizeCategory(station.category);
    dom.stationYoutubeInput.value = station.youtubeUrl || station.youtubeId || "";
    dom.stationThumbnailInput.value = station.thumbnailUrl || "";
    dom.stationBackgroundVideoInput.value = station.backgroundVideoUrl || "";
    dom.stationBackgroundGifInput.value = station.backgroundGifUrl || "";
    dom.stationBackgroundImageInput.value = station.backgroundImageUrl || "";
    dom.stationAccentColorInput.value = HEX_COLOR_PATTERN.test(station.accentColor || "") ? station.accentColor : "#4facfe";
    dom.stationSortOrderInput.value = Number.isFinite(Number(station.sortOrder)) ? String(Number(station.sortOrder)) : "0";
    dom.stationDescriptionInput.value = station.description || "";
    dom.stationActiveInput.checked = station.isActive !== false;
    dom.saveStationBtn.textContent = "Save Changes";
    dom.cancelEditBtn.classList.remove("hidden");
    dom.stationEditingLabel.textContent = `Editing: ${station.name || "Untitled station"}`;
    setStationFormMessage("Editing selected station.", "neutral");
    dom.stationNameInput.focus();
}

function resetStationForm() {
    state.selectedStation = null;
    dom.stationForm.reset();
    dom.stationIdInput.value = "";
    dom.stationCategoryInput.value = "LOFI";
    dom.stationFrequencyInput.value = generateUniqueFrequency() || "";
    dom.stationAccentColorInput.value = "#4facfe";
    dom.stationSortOrderInput.value = "0";
    dom.stationActiveInput.checked = true;
    dom.saveStationBtn.textContent = "Save Station";
    dom.cancelEditBtn.classList.add("hidden");
    dom.stationEditingLabel.textContent = "Creating new station";
    setStationFormMessage("", "neutral");
}

function handleGenerateFrequency() {
    const frequency = generateUniqueFrequency();
    if (!frequency) {
        setStationFormMessage("No unused FM frequency is available in the 87.5 to 108.0 range.", "error");
        return;
    }

    dom.stationFrequencyInput.value = frequency;
    setStationFormMessage(`Generated ${frequency} FM.`, "success");
}

async function handleStationSubmit(event) {
    event.preventDefault();

    if (!state.isAdmin || !state.currentUser) {
        setStationFormMessage("Admin access is required before saving stations.", "error");
        return;
    }

    const result = collectStationFormData();
    if (!result.ok) {
        setStationFormMessage(result.message, "error");
        return;
    }

    setButtonBusy(dom.saveStationBtn, true);

    try {
        const now = Date.now();
        const selected = state.selectedStation || null;
        const station = {
            ...result.station,
            createdAt: selected && Number(selected.createdAt) ? Number(selected.createdAt) : now,
            updatedAt: now,
            createdBy: selected && selected.createdBy ? selected.createdBy : state.currentUser.uid,
            updatedBy: state.currentUser.uid,
            source: selected && selected.source ? selected.source : "admin"
        };

        const stationId = dom.stationIdInput.value.trim();
        const saved = await saveAdminStation(stationId, station);
        resetStationForm();
        setStationFormMessage(`${saved.name} saved to /adminStations.`, "success");
    } catch (error) {
        setStationFormMessage(`Station save failed: ${getErrorMessage(error)}`, "error");
    } finally {
        setButtonBusy(dom.saveStationBtn, false);
    }
}

function collectStationFormData() {
    const name = trimValue(dom.stationNameInput.value);
    const frequency = trimValue(dom.stationFrequencyInput.value);
    const category = normalizeCategory(dom.stationCategoryInput.value);
    const youtubeInput = trimValue(dom.stationYoutubeInput.value);
    const youtubeId = youtubeInput ? extractYouTubeVideoId(youtubeInput) : "";
    const accentColor = trimValue(dom.stationAccentColorInput.value) || "#4facfe";
    const sortOrder = Number.parseInt(dom.stationSortOrderInput.value, 10);
    const isActive = dom.stationActiveInput.checked;

    if (!name || name.length > 80) {
        return { ok: false, message: "Station name is required and must be 80 characters or fewer." };
    }

    if (!isValidFrequency(frequency)) {
        return { ok: false, message: "Generate a valid FM frequency between 87.5 and 108.0." };
    }

    if (!ALLOWED_CATEGORIES.includes(category)) {
        return { ok: false, message: "Choose a valid category from the dropdown." };
    }

    if (youtubeInput && !youtubeId) {
        return { ok: false, message: "Enter a valid YouTube URL or 11-character video ID." };
    }

    if (isActive && !youtubeId) {
        return { ok: false, message: "Active stations require a valid YouTube URL or 11-character video ID." };
    }

    if (hasDuplicateFrequency(frequency, dom.stationIdInput.value.trim())) {
        return { ok: false, message: `${frequency} FM is already used by another active or disabled station.` };
    }

    if (!HEX_COLOR_PATTERN.test(accentColor)) {
        return { ok: false, message: "Accent color must be a valid hex color." };
    }

    if (!Number.isFinite(sortOrder) || sortOrder < 0) {
        return { ok: false, message: "Sort order must be zero or a positive number." };
    }

    return {
        ok: true,
        station: {
            name,
            frequency,
            category,
            youtubeUrl: youtubeInput && youtubeId
                ? (youtubeInput.startsWith("http") ? youtubeInput : `https://www.youtube.com/watch?v=${youtubeId}`)
                : "",
            youtubeId,
            thumbnailUrl: trimValue(dom.stationThumbnailInput.value),
            backgroundVideoUrl: trimValue(dom.stationBackgroundVideoInput.value),
            backgroundGifUrl: trimValue(dom.stationBackgroundGifInput.value),
            backgroundImageUrl: trimValue(dom.stationBackgroundImageInput.value),
            accentColor,
            description: trimValue(dom.stationDescriptionInput.value).slice(0, 280),
            isActive,
            status: isActive ? "active" : "disabled",
            sortOrder
        }
    };
}

async function importDefaultStations() {
    if (!state.isAdmin || !state.currentUser) {
        setStationFormMessage("Admin access is required before importing default stations.", "error");
        return;
    }

    const defaultStations = Array.isArray(window.BODWOLF_STATIONS) ? window.BODWOLF_STATIONS : [];
    if (!defaultStations.length) {
        setStationFormMessage("No local fallback stations were found to import.", "error");
        return;
    }

    setButtonBusy(dom.importDefaultStationsBtn, true);

    try {
        const now = Date.now();
        let imported = 0;
        let skipped = 0;

        for (const [index, station] of defaultStations.entries()) {
            const stationId = createSeedStationId(station);
            if (!stationId || state.rawStationRecords[stationId]) {
                skipped += 1;
                continue;
            }

            const seedStation = normalizeSeedStation(station, index, now);
            if (!seedStation) {
                skipped += 1;
                continue;
            }

            await saveAdminStation(stationId, seedStation);
            imported += 1;
        }

        setStationFormMessage(`Imported ${imported} stations. Skipped ${skipped} existing stations.`, "success");
    } catch (error) {
        setStationFormMessage(`Default station import failed: ${getErrorMessage(error)}`, "error");
    } finally {
        setButtonBusy(dom.importDefaultStationsBtn, false);
    }
}

function normalizeSeedStation(station, index, timestamp) {
    const youtubeId = station && isValidYouTubeId(station.id) ? station.id : "";
    const category = normalizeCategory(station.category || station.cat || "RADIO");
    const usedFrequencies = getUsedFrequencies();
    let frequency = isValidFrequency(String(station.freq)) ? normalizeFrequency(station.freq) : "";
    if (!frequency || usedFrequencies.has(frequency)) {
        frequency = generateUniqueFrequency();
    }

    if (!station || !station.name || !frequency || !youtubeId) {
        return null;
    }

    return {
        name: trimValue(station.name).slice(0, 80),
        frequency,
        category,
        youtubeUrl: `https://www.youtube.com/watch?v=${youtubeId}`,
        youtubeId,
        thumbnailUrl: trimValue(station.thumbnailUrl || station.thumbnail || ""),
        backgroundVideoUrl: trimValue(station.backgroundVideoUrl || ""),
        backgroundGifUrl: trimValue(station.backgroundGifUrl || station.fallbackImage || ""),
        backgroundImageUrl: trimValue(station.backgroundImageUrl || station.image || ""),
        accentColor: HEX_COLOR_PATTERN.test(station.accentColor || "") ? station.accentColor : "#4facfe",
        description: trimValue(station.description || `${category} default station`).slice(0, 280),
        isActive: true,
        status: "active",
        sortOrder: Number.isFinite(Number(station.sortOrder)) ? Number(station.sortOrder) : index * 10,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: state.currentUser.uid,
        updatedBy: state.currentUser.uid,
        source: "seed"
    };
}

function createSeedStationId(station) {
    const rawKey = station && (station.id || station.name);
    if (!rawKey) return "";

    const safeKey = String(rawKey)
        .trim()
        .replace(/[.#$/\[\]\s]+/g, "-")
        .replace(/[^A-Za-z0-9_-]/g, "")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

    return safeKey ? `seed-${safeKey}` : "";
}

function generateUniqueFrequency() {
    const used = getUsedFrequencies();
    const options = [];
    const totalSteps = Math.round((FREQUENCY_MAX - FREQUENCY_MIN) / FREQUENCY_STEP);

    for (let step = 0; step <= totalSteps; step += 1) {
        const frequency = (FREQUENCY_MIN + (step * FREQUENCY_STEP)).toFixed(1);
        if (!used.has(frequency)) {
            options.push(frequency);
        }
    }

    if (!options.length) return "";

    return options[Math.floor(Math.random() * options.length)];
}

function getUsedFrequencies() {
    const currentStationId = dom.stationIdInput.value.trim();
    const sourceStations = state.stations.length
        ? state.stations
        : (Array.isArray(window.BODWOLF_STATIONS) ? window.BODWOLF_STATIONS : []);

    return new Set(sourceStations
        .filter((station) => {
            if (!station) return false;
            if (currentStationId && station.stationId === currentStationId) return false;
            if (station.status === "removed") return false;
            return station.status === "active" || station.status === "disabled" || station.isActive !== false || !station.status;
        })
        .map((station) => normalizeFrequency(station.frequency || station.freq))
        .filter(Boolean));
}

function hasDuplicateFrequency(frequency, currentStationId) {
    const normalized = normalizeFrequency(frequency);
    if (!normalized) return false;

    return state.stations.some((station) => {
        if (!station || station.status === "removed") return false;
        if (currentStationId && station.stationId === currentStationId) return false;
        return normalizeFrequency(station.frequency) === normalized;
    });
}

function normalizeFrequency(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return "";
    return numeric.toFixed(1);
}

function isValidFrequency(value) {
    const normalized = normalizeFrequency(value);
    if (!normalized || normalized !== String(value).trim()) return false;

    const numeric = Number(normalized);
    return numeric >= FREQUENCY_MIN && numeric <= FREQUENCY_MAX;
}

function normalizeCategory(value) {
    const normalized = trimValue(value).toUpperCase();
    return ALLOWED_CATEGORIES.includes(normalized) ? normalized : "CUSTOM";
}

function isValidYouTubeId(value) {
    return YOUTUBE_ID_PATTERN.test(String(value || ""));
}

async function setStationEnabled(stationId, shouldEnable) {
    if (!state.isAdmin || !state.currentUser) return;

    const station = state.stations.find((item) => item.stationId === stationId);
    if (!station) {
        setAdminMessage("Station record was not found.", "error");
        return;
    }

    if (shouldEnable && !isValidYouTubeId(station.youtubeId)) {
        setAdminMessage("Cannot enable this station until it has a valid YouTube video ID.", "error");
        return;
    }

    try {
        if (!shouldEnable) {
            await disableAdminStation(stationId, state.currentUser.uid);
            setAdminMessage("Station disabled.", "success");
            return;
        }

        const { stationId: _stationId, ...firebaseStation } = station;
        await saveAdminStation(stationId, {
            ...firebaseStation,
            isActive: true,
            status: "active",
            updatedAt: Date.now(),
            updatedBy: state.currentUser.uid
        });
        setAdminMessage("Station enabled.", "success");
    } catch (error) {
        setAdminMessage(`${shouldEnable ? "Enable" : "Disable"} failed: ${getErrorMessage(error)}`, "error");
    }
}

async function removeStation(stationId) {
    if (!state.isAdmin || !state.currentUser) return;

    try {
        await markAdminStationRemoved(stationId, state.currentUser.uid);
        setAdminMessage("Station marked removed.", "success");
    } catch (error) {
        setAdminMessage(`Remove failed: ${getErrorMessage(error)}`, "error");
    }
}

async function deleteStation(stationId) {
    if (!state.isAdmin || !state.currentUser) return;

    const confirmed = window.confirm("Delete this admin station record? Mark Removed is safer for production.");
    if (!confirmed) return;

    try {
        await deleteAdminStation(stationId);
        setAdminMessage("Station record deleted.", "success");
    } catch (error) {
        setAdminMessage(`Delete failed: ${getErrorMessage(error)}`, "error");
    }
}

function findDuplicateStations() {
    state.duplicateGroups = getDuplicateStationGroups();
    renderDuplicatePreview();

    if (!state.duplicateGroups.length) {
        setMaintenanceMessage("No duplicate active or disabled stations found.", "success");
        return;
    }

    const duplicateCount = state.duplicateGroups.reduce((total, group) => total + group.duplicates.length, 0);
    setMaintenanceMessage(`Found ${state.duplicateGroups.length} duplicate groups with ${duplicateCount} removable duplicate stations.`, "neutral");
}

function getDuplicateStationGroups() {
    const groups = new Map();

    state.stations
        .filter((station) => station && station.status !== "removed")
        .forEach((station) => {
            const key = getDuplicateKey(station);
            if (!key) return;

            if (!groups.has(key)) {
                groups.set(key, []);
            }
            groups.get(key).push(station);
        });

    return Array.from(groups.entries())
        .map(([key, groupStations]) => {
            const sorted = groupStations.sort(compareDuplicateKeepOrder);
            return {
                key,
                label: getDuplicateLabel(sorted[0], key),
                keep: sorted[0],
                duplicates: sorted.slice(1)
            };
        })
        .filter((group) => group.duplicates.length > 0);
}

function getDuplicateKey(station) {
    if (isValidYouTubeId(station.youtubeId)) {
        return `video:${station.youtubeId}`;
    }

    const normalizedName = String(station.name || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

    return normalizedName ? `name:${normalizedName}` : "";
}

function getDuplicateLabel(station, key) {
    if (key.startsWith("video:")) {
        return `Video ${station.youtubeId}`;
    }

    return station.name || "Unnamed station";
}

function compareDuplicateKeepOrder(a, b) {
    const sortDelta = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
    if (sortDelta !== 0) return sortDelta;

    const createdDelta = Number(a.createdAt || 0) - Number(b.createdAt || 0);
    if (createdDelta !== 0) return createdDelta;

    return String(a.name || "").localeCompare(String(b.name || ""));
}

function renderDuplicatePreview() {
    dom.duplicatePreviewList.textContent = "";
    dom.markDuplicatesRemovedBtn.disabled = state.duplicateGroups.length === 0;

    const fragment = document.createDocumentFragment();
    state.duplicateGroups.forEach((group) => {
        const item = document.createElement("li");
        item.textContent = `${group.label}: keep "${group.keep.name || "Untitled"}" (${group.keep.frequency || "--"} FM), mark ${group.duplicates.length} duplicate${group.duplicates.length === 1 ? "" : "s"} removed.`;
        fragment.appendChild(item);
    });

    dom.duplicatePreviewList.appendChild(fragment);
}

async function markDuplicateStationsRemoved() {
    if (!state.isAdmin || !state.currentUser) return;
    if (!state.duplicateGroups.length) {
        setMaintenanceMessage("Run Find Duplicates first.", "error");
        return;
    }

    const duplicateCount = state.duplicateGroups.reduce((total, group) => total + group.duplicates.length, 0);
    const confirmed = window.confirm(`Mark ${duplicateCount} duplicate station records as removed? This will not hard delete data.`);
    if (!confirmed) return;

    setButtonBusy(dom.markDuplicatesRemovedBtn, true);

    try {
        for (const group of state.duplicateGroups) {
            for (const station of group.duplicates) {
                await markAdminStationRemoved(station.stationId, state.currentUser.uid);
            }
        }

        state.duplicateGroups = [];
        renderDuplicatePreview();
        setMaintenanceMessage(`Marked ${duplicateCount} duplicate stations removed.`, "success");
    } catch (error) {
        setMaintenanceMessage(`Duplicate cleanup failed: ${getErrorMessage(error)}`, "error");
    } finally {
        setButtonBusy(dom.markDuplicatesRemovedBtn, false);
        dom.markDuplicatesRemovedBtn.disabled = state.duplicateGroups.length === 0;
    }
}

async function recalculateSortOrder() {
    if (!state.isAdmin || !state.currentUser) return;

    const editableStations = state.stations.filter((station) => station.status !== "removed");
    if (!editableStations.length) {
        setMaintenanceMessage("No active or disabled stations to reorder.", "error");
        return;
    }

    const confirmed = window.confirm("Recalculate sort order for active and disabled stations? Removed stations will keep their current order.");
    if (!confirmed) return;

    setButtonBusy(dom.recalculateSortOrderBtn, true);

    try {
        const sorted = editableStations.sort(compareMaintenanceSortOrder);
        for (const [index, station] of sorted.entries()) {
            const { stationId, ...firebaseStation } = station;
            await saveAdminStation(stationId, {
                ...firebaseStation,
                sortOrder: (index + 1) * 10,
                updatedAt: Date.now(),
                updatedBy: state.currentUser.uid
            });
        }

        setMaintenanceMessage(`Recalculated sort order for ${sorted.length} stations.`, "success");
    } catch (error) {
        setMaintenanceMessage(`Sort order recalculation failed: ${getErrorMessage(error)}`, "error");
    } finally {
        setButtonBusy(dom.recalculateSortOrderBtn, false);
    }
}

function compareMaintenanceSortOrder(a, b) {
    const statusDelta = getStatusSortWeight(a.status) - getStatusSortWeight(b.status);
    if (statusDelta !== 0) return statusDelta;

    const categoryDelta = getCategorySortWeight(a.category) - getCategorySortWeight(b.category);
    if (categoryDelta !== 0) return categoryDelta;

    return String(a.name || "").localeCompare(String(b.name || ""));
}

function getStatusSortWeight(status) {
    if (status === "active") return 0;
    if (status === "disabled") return 1;
    return 2;
}

function getCategorySortWeight(category) {
    const index = ALLOWED_CATEGORIES.indexOf(normalizeCategory(category));
    return index >= 0 ? index : ALLOWED_CATEGORIES.length;
}

async function loadSiteSettings() {
    if (state.settingsLoaded) return;

    try {
        const settings = await getSiteSettings();
        if (settings) {
            dom.defaultStationIdInput.value = settings.defaultStationId || "";
            dom.defaultThemeInput.value = settings.defaultTheme || "";
            dom.comfortModeDefaultInput.checked = settings.comfortModeDefault === true;
            dom.staticSoundDefaultInput.checked = settings.staticSoundDefault === true;
        }
        state.settingsLoaded = true;
    } catch (error) {
        setSiteSettingsMessage(`Could not load site settings: ${getErrorMessage(error)}`, "error");
    }
}

async function handleSiteSettingsSubmit(event) {
    event.preventDefault();

    if (!state.isAdmin || !state.currentUser) {
        setSiteSettingsMessage("Admin access is required before saving settings.", "error");
        return;
    }

    const defaultStationId = trimValue(dom.defaultStationIdInput.value);
    const defaultTheme = trimValue(dom.defaultThemeInput.value);

    if (defaultStationId.length > 120) {
        setSiteSettingsMessage("Default station ID must be 120 characters or fewer.", "error");
        return;
    }

    if (defaultTheme.length > 40) {
        setSiteSettingsMessage("Default theme must be 40 characters or fewer.", "error");
        return;
    }

    setButtonBusy(dom.saveSiteSettingsBtn, true);

    try {
        await saveSiteSettings({
            defaultStationId,
            defaultTheme,
            comfortModeDefault: dom.comfortModeDefaultInput.checked,
            staticSoundDefault: dom.staticSoundDefaultInput.checked,
            updatedAt: Date.now(),
            updatedBy: state.currentUser.uid
        });
        setSiteSettingsMessage("Site settings placeholder saved.", "success");
    } catch (error) {
        setSiteSettingsMessage(`Settings save failed: ${getErrorMessage(error)}`, "error");
    } finally {
        setButtonBusy(dom.saveSiteSettingsBtn, false);
    }
}

function extractYouTubeVideoId(value) {
    const input = trimValue(value);
    if (YOUTUBE_ID_PATTERN.test(input)) return input;

    try {
        const url = new URL(input);
        const host = url.hostname.replace(/^www\./, "");

        if (host === "youtu.be") {
            const id = url.pathname.split("/").filter(Boolean)[0] || "";
            return YOUTUBE_ID_PATTERN.test(id) ? id : null;
        }

        if (host.endsWith("youtube.com")) {
            const watchId = url.searchParams.get("v");
            if (watchId && YOUTUBE_ID_PATTERN.test(watchId)) return watchId;

            const parts = url.pathname.split("/").filter(Boolean);
            if (["embed", "shorts", "live"].includes(parts[0]) && YOUTUBE_ID_PATTERN.test(parts[1] || "")) {
                return parts[1];
            }
        }
    } catch (error) {
        return null;
    }

    return null;
}

function setToolsVisible(isVisible) {
    dom.studioTools.classList.toggle("hidden", !isVisible);
}

function setAccessPill(text, mode) {
    dom.adminAccessPill.textContent = text;
    dom.adminAccessPill.classList.toggle("is-ready", mode === "ready");
    dom.adminAccessPill.classList.toggle("is-denied", mode === "denied");
}

function setAdminState(text) {
    dom.adminState.textContent = text;
}

function setAdminMessage(text, type) {
    setMessage(dom.adminMessage, text, type);
}

function setStationFormMessage(text, type) {
    setMessage(dom.stationFormMessage, text, type);
}

function setSiteSettingsMessage(text, type) {
    setMessage(dom.siteSettingsMessage, text, type);
}

function setMaintenanceMessage(text, type) {
    setMessage(dom.maintenanceMessage, text, type);
}

function setMessage(element, text, type) {
    element.textContent = text;
    element.classList.toggle("is-error", type === "error");
    element.classList.toggle("is-success", type === "success");
}

function setButtonBusy(button, isBusy) {
    button.disabled = isBusy;
    button.dataset.busy = isBusy ? "true" : "false";
}

function trimValue(value) {
    return String(value || "").trim();
}

function getErrorMessage(error) {
    if (!error) return "Unknown error.";
    return error.message || String(error);
}

function getFirebaseAuthErrorText(error) {
    const details = getFirebaseAuthErrorDetails(error);
    return details.code === "unknown"
        ? details.message
        : `${details.code}: ${details.message}`;
}

function getFirebaseAuthErrorDetails(error) {
    return {
        code: error && error.code ? error.code : "unknown",
        message: getErrorMessage(error)
    };
}

// V17 TODO: add deeper Studio Panel polish without changing the V16.2 main station source contract.
