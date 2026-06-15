(function () {
    const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
    const DISPLAY_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]{3,15}$/;
    const STATION_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 -]{0,23}$/;
    const TEMPORARY_STATIONS_PATH = "/temporaryStations";
    const CHANNEL_EXPIRY_MS = 30 * 60 * 1000;
    const ADD_RATE_LIMIT_MS = 30 * 1000;
    const ADD_STORAGE_KEY = "bodwolf:temporaryChannelLastAddAt";
    const MAX_ACTIVE_TRACKS = 10;
    const FALLBACK_TRACK_TITLE = "YouTube Track";

    const state = {
        mode: "local",
        loading: true,
        saving: false,
        channels: [],
        unsubscribe: null,
        userId: null,
        firebaseBridge: null,
        countdownTimer: null
    };

    const form = document.getElementById("playlistForm");
    const urlInput = document.getElementById("playlistUrlInput");
    const nameInput = document.getElementById("temporaryStationNameInput");
    const submitButton = document.getElementById("playlistAddBtn");
    const messageEl = document.getElementById("playlistMessage");
    const loadingEl = document.getElementById("playlistLoading");
    const emptyEl = document.getElementById("playlistEmpty");
    const itemsEl = document.getElementById("playlistItems");
    const modeHintEl = document.getElementById("playlistModeHint");

    window.extractYouTubeVideoId = extractYouTubeVideoId;
    window.BODWOLF_PLAYLIST = {
        extractYouTubeVideoId,
        getItems() {
            return [...state.channels];
        }
    };

    document.addEventListener("DOMContentLoaded", initTemporaryChannels);
    window.addEventListener("beforeunload", cleanupTemporaryChannelListener);

    function initTemporaryChannels() {
        if (!form || !urlInput || !submitButton || !itemsEl) return;

        form.addEventListener("submit", handleSubmit);
        urlInput.addEventListener("keydown", handleInputKeydown);
        if (nameInput) {
            nameInput.addEventListener("keydown", handleInputKeydown);
        }
        itemsEl.addEventListener("click", handleChannelAction);
        connectTemporaryChannelDataSource();
    }

    function handleInputKeydown(event) {
        if (event.key !== "Enter") return;

        event.preventDefault();
        if (state.loading || state.saving) return;

        if (typeof form.requestSubmit === "function") {
            form.requestSubmit(submitButton);
        } else {
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        }
    }

    function connectTemporaryChannelDataSource() {
        setLoading(true);
        setModeHint("local");

        const firebaseBridge = window.BODWOLF_FIREBASE;
        if (firebaseBridge && firebaseBridge.ready) {
            firebaseBridge.ready
                .then((firebaseState) => setupFirebaseTemporaryChannels(firebaseBridge, firebaseState))
                .catch((error) => {
                    console.warn("Renner Radio: temporary channel Firebase setup failed. Local preview continues.", error);
                    setupLocalTemporaryChannels("Local preview channel only. Firebase not connected.");
                });
            return;
        }

        const onReady = (event) => setupFirebaseTemporaryChannels(window.BODWOLF_FIREBASE, event.detail);
        const onUnavailable = () => setupLocalTemporaryChannels("Local preview channel only. Firebase not connected.");

        window.addEventListener("bodwolf:firebase-ready", onReady, { once: true });
        window.addEventListener("bodwolf:firebase-unavailable", onUnavailable, { once: true });

        window.setTimeout(() => {
            if (state.loading) {
                setupLocalTemporaryChannels("Local preview channel only. Firebase not connected.");
            }
        }, 2800);
    }

    async function setupFirebaseTemporaryChannels(firebaseBridge, firebaseState) {
        if (!firebaseBridge || !firebaseState || !firebaseState.ready) {
            setupLocalTemporaryChannels("Local preview channel only. Firebase not connected.");
            return;
        }

        try {
            const user = await firebaseBridge.signInAnonymousUser();
            if (!user || !user.uid) {
                setupLocalTemporaryChannels("Local preview channel only. Firebase not connected.");
                return;
            }

            cleanupTemporaryChannelListener();
            state.mode = "firebase";
            state.firebaseBridge = firebaseBridge;
            state.userId = user.uid;

            const unsubscribe = firebaseBridge.watchTemporaryStations(handleFirebaseChannels, (error) => {
                console.warn("Renner Radio: temporary channel listener failed.", error);
                setupLocalTemporaryChannels("Temporary channel is in local preview. Deploy V15.3 database rules for live sync.");
                showMessage("Could not load live channels. Deploy the V15.3 database rules.", "error");
            });

            if (!unsubscribe) {
                setupLocalTemporaryChannels("Local preview channel only. Firebase not connected.");
                return;
            }

            state.unsubscribe = unsubscribe;
            setModeHint("firebase");
        } catch (error) {
            console.warn("Renner Radio: temporary channel Firebase setup failed. Local preview continues.", error);
            setupLocalTemporaryChannels("Local preview channel only. Firebase not connected.");
        }
    }

    function setupLocalTemporaryChannels(message) {
        cleanupTemporaryChannelListener();
        state.mode = "local";
        state.firebaseBridge = null;
        state.userId = null;
        state.loading = false;
        setModeHint("local", message);
        publishChannelsToRadio();
        renderChannelManager();
        syncCountdownTimer();
    }

    function handleFirebaseChannels(channelsById) {
        state.channels = Object.entries(channelsById || {})
            .map(([id, channel]) => normalizeChannel({ stationId: id, ...channel }))
            .filter(isVisibleChannel)
            .sort((a, b) => b.createdAt - a.createdAt);

        state.loading = false;
        publishChannelsToRadio();
        renderChannelManager();
        syncCountdownTimer();
    }

    async function handleSubmit(event) {
        event.preventDefault();
        clearMessage();

        const profile = getCurrentProfile();
        if (!profile) {
            showMessage("Choose a valid radio name before creating or updating your channel.", "error");
            return;
        }

        const rawUrl = urlInput.value.trim();
        if (!rawUrl) {
            showMessage("Add a YouTube link first.", "error");
            return;
        }

        const videoId = extractYouTubeVideoId(rawUrl);
        if (!videoId) {
            showMessage("Enter a valid YouTube link.", "error");
            return;
        }

        const ownerChannel = getOwnerChannel();
        if (ownerChannel && hasDuplicateTrack(ownerChannel, videoId)) {
            showMessage("This video is already active inside your channel.", "error");
            return;
        }

        if (ownerChannel && getActiveTracks(ownerChannel).length >= MAX_ACTIVE_TRACKS) {
            showMessage(`Your channel can hold up to ${MAX_ACTIVE_TRACKS} active tracks.`, "error");
            return;
        }

        const rateLimitRemaining = getAddRateLimitRemaining();
        if (rateLimitRemaining > 0) {
            showMessage(`Please wait ${Math.ceil(rateLimitRemaining / 1000)}s before adding another track.`, "error");
            return;
        }

        setSaving(true);

        try {
            if (ownerChannel) {
                await addTrack(ownerChannel, rawUrl, videoId);
            } else {
                await createChannelWithFirstTrack(profile, rawUrl, videoId);
            }

            rememberAddTime(Date.now());
            urlInput.value = "";
            if (nameInput) nameInput.value = "";
            clearMessage();
            showMessage(ownerChannel ? "Track added to your channel." : "Temporary channel created.", "success");
        } catch (error) {
            console.warn("Renner Radio: temporary channel save failed.", error);
            showMessage("Could not save this channel update. Check Firebase rules and try again.", "error");
        } finally {
            setSaving(false);
        }
    }

    async function createChannelWithFirstTrack(profile, rawUrl, videoId) {
        const rawName = nameInput ? nameInput.value.trim() : "";
        const channelName = rawName ? sanitizeStationName(rawName) : `${profile.displayName} FM`;
        if (!channelName) {
            throw new Error("Invalid station name.");
        }

        const now = Date.now();
        const channel = {
            name: channelName,
            frequency: generateFrequency(),
            createdBy: state.userId || "local-preview",
            displayName: profile.displayName,
            createdAt: now,
            expiresAt: now + CHANNEL_EXPIRY_MS,
            status: "active",
            type: "community",
            accentColor: profile.userColor || "#7dd3fc"
        };
        const track = createTrack(rawUrl, videoId, now, 1);

        if (state.mode === "firebase" && state.firebaseBridge) {
            await state.firebaseBridge.createTemporaryStationWithFirstTrack(channel, track);
            return;
        }

        state.channels = [{
            ...channel,
            stationId: `local-${now}`,
            tracks: [{
                ...track,
                trackId: `local-track-${now}`
            }]
        }];
        publishChannelsToRadio();
        renderChannelManager();
        syncCountdownTimer();
    }

    async function addTrack(channel, rawUrl, videoId) {
        const now = Date.now();
        const nextOrder = getNextTrackOrder(channel);
        const track = createTrack(rawUrl, videoId, now, nextOrder);

        if (state.mode === "firebase" && state.firebaseBridge) {
            await state.firebaseBridge.addTrackToTemporaryStation(channel.stationId, track);
            return;
        }

        channel.tracks = [...getAllTracks(channel), {
            ...track,
            trackId: `local-track-${now}`
        }];
        publishChannelsToRadio();
        renderChannelManager();
        syncCountdownTimer();
    }

    function createTrack(rawUrl, videoId, createdAt, order) {
        return {
            videoId,
            url: rawUrl,
            title: FALLBACK_TRACK_TITLE,
            order,
            createdAt,
            status: "active"
        };
    }

    async function handleChannelAction(event) {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const ownerChannel = getOwnerChannel();
        if (!ownerChannel) return;

        if (button.dataset.action === "remove-track") {
            await removeTrack(ownerChannel, button.dataset.trackId);
        }

        if (button.dataset.action === "remove-channel") {
            await removeChannel(ownerChannel);
        }
    }

    async function removeTrack(channel, trackId) {
        clearMessage();
        const track = getAllTracks(channel).find((item) => item.trackId === trackId);
        if (!track) return;

        try {
            if (state.mode === "firebase" && state.firebaseBridge) {
                await state.firebaseBridge.markTemporaryStationTrackRemoved(channel.stationId, trackId);
            } else {
                track.status = "removed";
                channel.tracks = getAllTracks(channel);
                publishChannelsToRadio();
                renderChannelManager();
            }
            showMessage("Track removed.", "success");
        } catch (error) {
            console.warn("Renner Radio: temporary track remove failed.", error);
            showMessage("Only the owner can remove tracks from this channel.", "error");
        }
    }

    async function removeChannel(channel) {
        clearMessage();

        try {
            if (state.mode === "firebase" && state.firebaseBridge) {
                await state.firebaseBridge.markTemporaryStationRemoved(channel.stationId);
            } else {
                state.channels = state.channels.filter((item) => item.stationId !== channel.stationId);
                publishChannelsToRadio();
                renderChannelManager();
            }
            showMessage("Temporary channel removed.", "success");
        } catch (error) {
            console.warn("Renner Radio: temporary channel remove failed.", error);
            showMessage("Only the owner can remove this channel.", "error");
        }
    }

    function renderChannelManager() {
        pruneExpiredChannels();
        setLoading(state.loading);
        itemsEl.textContent = "";

        const ownerChannel = getOwnerChannel();
        updateFormMode(ownerChannel);
        emptyEl.classList.toggle("hidden", state.loading || Boolean(ownerChannel));

        if (ownerChannel) {
            itemsEl.appendChild(createOwnerChannelElement(ownerChannel));
        }
    }

    function createOwnerChannelElement(channel) {
        const row = document.createElement("li");
        row.className = "playlist-item temporary-channel-item";

        const meta = document.createElement("div");
        meta.className = "playlist-item-meta";

        const title = document.createElement("strong");
        title.textContent = channel.name;
        title.title = channel.name;

        const frequency = document.createElement("span");
        frequency.className = "playlist-item-id";
        frequency.textContent = `${channel.frequency} FM`;

        const countdown = document.createElement("span");
        countdown.className = "playlist-item-countdown";
        countdown.textContent = `${formatRemainingTime(channel.expiresAt - Date.now())} left`;

        const trackCount = document.createElement("span");
        trackCount.className = "playlist-item-owner";
        trackCount.textContent = `${getActiveTracks(channel).length}/${MAX_ACTIVE_TRACKS} active tracks`;

        meta.append(title, frequency, countdown, trackCount);

        const actions = document.createElement("div");
        actions.className = "playlist-item-actions";

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "playlist-action-btn playlist-action-remove";
        removeButton.dataset.action = "remove-channel";
        removeButton.textContent = "Remove Channel";
        actions.append(removeButton);

        row.append(meta, actions, createTrackList(channel));
        return row;
    }

    function createTrackList(channel) {
        const list = document.createElement("ol");
        list.className = "temporary-track-list";

        getActiveTracks(channel).forEach((track) => {
            const item = document.createElement("li");
            item.className = "temporary-track-item";

            const label = document.createElement("span");
            label.textContent = `${track.order}. ${track.title || FALLBACK_TRACK_TITLE} / ${shortVideoId(track.videoId)}`;

            const removeButton = document.createElement("button");
            removeButton.type = "button";
            removeButton.className = "playlist-action-btn playlist-action-remove";
            removeButton.dataset.action = "remove-track";
            removeButton.dataset.trackId = track.trackId;
            removeButton.textContent = "Remove Track";

            item.append(label, removeButton);
            list.appendChild(item);
        });

        return list;
    }

    function updateFormMode(ownerChannel) {
        if (nameInput) {
            nameInput.disabled = Boolean(ownerChannel);
            nameInput.placeholder = ownerChannel ? ownerChannel.name : "Renner FM";
        }

        submitButton.textContent = state.saving
            ? (ownerChannel ? "Adding..." : "Creating...")
            : (ownerChannel ? "Add Track" : "Create Channel");
    }

    function publishChannelsToRadio() {
        const radioStations = state.channels
            .filter(isVisibleChannel)
            .map((channel) => ({
                category: "COMMUNITY FM",
                freq: channel.frequency,
                name: channel.name,
                id: getActiveTracks(channel)[0]?.videoId || "",
                type: "community",
                status: channel.status,
                stationId: channel.stationId,
                displayName: channel.displayName,
                createdAt: channel.createdAt,
                expiresAt: channel.expiresAt,
                accentColor: channel.accentColor,
                tracks: getActiveTracks(channel)
            }));

        if (window.BODWOLF_RADIO && window.BODWOLF_RADIO.setTemporaryStations) {
            window.BODWOLF_RADIO.setTemporaryStations(radioStations);
        }
    }

    function extractYouTubeVideoId(url) {
        if (typeof url !== "string") return null;

        const value = url.trim();
        if (!value) return null;

        let parsedUrl;
        try {
            parsedUrl = new URL(value);
        } catch (error) {
            return null;
        }

        if (parsedUrl.protocol !== "https:") return null;

        const hostname = parsedUrl.hostname.toLowerCase();
        let candidate = null;

        if (hostname === "youtu.be") {
            candidate = parsedUrl.pathname.split("/").filter(Boolean)[0];
        }

        if (hostname === "youtube.com" || hostname === "www.youtube.com" || hostname === "m.youtube.com") {
            if (parsedUrl.pathname === "/watch") {
                candidate = parsedUrl.searchParams.get("v");
            } else {
                const parts = parsedUrl.pathname.split("/").filter(Boolean);
                if ((parts[0] === "embed" || parts[0] === "shorts") && parts[1]) {
                    candidate = parts[1];
                }
            }
        }

        if (!candidate || !VIDEO_ID_PATTERN.test(candidate)) return null;
        return candidate;
    }

    function normalizeChannel(channel) {
        const createdAt = toSafeNumber(channel.createdAt, Date.now());
        return {
            ...channel,
            name: sanitizeStationName(channel.name) || `${getSafeDisplayName(channel.displayName)} FM`,
            frequency: sanitizeFrequency(channel.frequency),
            displayName: getSafeDisplayName(channel.displayName),
            createdAt,
            expiresAt: toSafeNumber(channel.expiresAt, createdAt + CHANNEL_EXPIRY_MS),
            type: "community",
            tracks: normalizeTracks(channel.tracks)
        };
    }

    function normalizeTracks(tracks) {
        return Object.entries(tracks || {})
            .map(([trackId, track]) => ({
                trackId,
                ...track,
                title: track.title || FALLBACK_TRACK_TITLE,
                order: toSafeNumber(track.order, 0),
                createdAt: toSafeNumber(track.createdAt, Date.now())
            }))
            .filter((track) => track.status === "active" || track.status === "removed")
            .sort((a, b) => a.order - b.order);
    }

    function isVisibleChannel(channel) {
        return Boolean(
            channel &&
            channel.status === "active" &&
            channel.type === "community" &&
            channel.expiresAt > Date.now() &&
            getActiveTracks(channel).length > 0
        );
    }

    function pruneExpiredChannels() {
        const visibleChannels = state.channels.filter((channel) => channel.status === "active" && channel.expiresAt > Date.now());
        if (visibleChannels.length !== state.channels.length) {
            state.channels = visibleChannels;
            publishChannelsToRadio();
        }
    }

    function syncCountdownTimer() {
        if (state.countdownTimer) {
            window.clearInterval(state.countdownTimer);
            state.countdownTimer = null;
        }

        if (!state.channels.some((channel) => channel.status === "active" && channel.expiresAt > Date.now())) return;

        state.countdownTimer = window.setInterval(() => {
            renderChannelManager();
            publishChannelsToRadio();
            syncCountdownTimer();
        }, 30000);
    }

    function getOwnerChannel() {
        return state.channels.find((channel) => {
            if (channel.status !== "active" || channel.expiresAt <= Date.now()) return false;
            if (state.mode === "firebase") return channel.createdBy === state.userId;
            return channel.createdBy === "local-preview";
        }) || null;
    }

    function getCurrentProfile() {
        const chatProfile = window.BODWOLF_CHAT && window.BODWOLF_CHAT.getProfile && window.BODWOLF_CHAT.getProfile();
        if (!chatProfile || !DISPLAY_NAME_PATTERN.test(String(chatProfile.displayName || "").trim())) {
            return null;
        }

        return {
            displayName: chatProfile.displayName.trim(),
            userColor: chatProfile.userColor || "#7dd3fc"
        };
    }

    function getSafeDisplayName(displayName) {
        if (typeof displayName !== "string") return "RadioGuest";
        const trimmed = displayName.trim();
        return DISPLAY_NAME_PATTERN.test(trimmed) ? trimmed : "RadioGuest";
    }

    function sanitizeStationName(name) {
        if (typeof name !== "string") return "";
        const cleaned = name.trim().replace(/\s+/g, " ").slice(0, 24);
        if (!cleaned || !STATION_NAME_PATTERN.test(cleaned)) return "";
        return cleaned;
    }

    function sanitizeFrequency(frequency) {
        if (typeof frequency === "string" && /^\d{3}\.\d$/.test(frequency)) return frequency;
        return generateFrequency();
    }

    function generateFrequency() {
        const used = new Set(state.channels.map((channel) => channel.frequency));
        const pool = [];
        for (let value = 1011; value <= 1079; value += 2) {
            pool.push((value / 10).toFixed(1));
        }

        const available = pool.filter((frequency) => !used.has(frequency));
        const choices = available.length ? available : pool;
        return choices[Math.floor(Math.random() * choices.length)];
    }

    function hasDuplicateTrack(channel, videoId) {
        return getActiveTracks(channel).some((track) => track.videoId === videoId);
    }

    function getAllTracks(channel) {
        return Array.isArray(channel.tracks) ? channel.tracks : [];
    }

    function getActiveTracks(channel) {
        return getAllTracks(channel)
            .filter((track) => track.status === "active" && VIDEO_ID_PATTERN.test(track.videoId || ""))
            .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    }

    function getNextTrackOrder(channel) {
        const orders = getAllTracks(channel).map((track) => Number(track.order || 0));
        return orders.length ? Math.max(...orders) + 1 : 1;
    }

    function getAddRateLimitRemaining() {
        const lastAddAt = Number(getStoredValue(ADD_STORAGE_KEY) || "0");
        if (!Number.isFinite(lastAddAt) || lastAddAt <= 0) return 0;
        return Math.max(0, ADD_RATE_LIMIT_MS - (Date.now() - lastAddAt));
    }

    function rememberAddTime(timestamp) {
        setStoredValue(ADD_STORAGE_KEY, String(timestamp));
    }

    function getStoredValue(key) {
        try {
            return window.localStorage ? window.localStorage.getItem(key) : null;
        } catch (error) {
            return null;
        }
    }

    function setStoredValue(key, value) {
        try {
            if (window.localStorage) {
                window.localStorage.setItem(key, value);
            }
        } catch (error) {
            console.warn("Renner Radio: temporary channel localStorage persistence is unavailable.", error);
        }
    }

    function toSafeNumber(value, fallback) {
        return Number.isFinite(Number(value)) ? Number(value) : fallback;
    }

    function formatRemainingTime(milliseconds) {
        const safeMs = Math.max(0, milliseconds);
        const totalSeconds = Math.ceil(safeMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        if (minutes <= 0) return `${seconds}s`;
        return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
    }

    function shortVideoId(videoId) {
        if (!videoId) return "unknown";
        return `${videoId.slice(0, 4)}...${videoId.slice(-3)}`;
    }

    function setSaving(isSaving) {
        state.saving = isSaving;
        submitButton.disabled = isSaving || state.loading;
        updateFormMode(getOwnerChannel());
    }

    function setLoading(isLoading) {
        state.loading = isLoading;
        loadingEl.classList.toggle("hidden", !isLoading);
        submitButton.disabled = isLoading || state.saving;
    }

    function setModeHint(mode, customText) {
        if (mode === "firebase") {
            modeHintEl.textContent = `Firebase temporary channels connected (${TEMPORARY_STATIONS_PATH}). Channels expire after 30 minutes.`;
            modeHintEl.classList.add("is-ready");
            return;
        }

        modeHintEl.textContent = customText || "Local preview channel only. Firebase not connected.";
        modeHintEl.classList.remove("is-ready");
    }

    function showMessage(text, type) {
        messageEl.textContent = text;
        messageEl.classList.toggle("is-error", type === "error");
        messageEl.classList.toggle("is-success", type === "success");
    }

    function clearMessage() {
        messageEl.textContent = "";
        messageEl.classList.remove("is-error", "is-success");
    }

    function cleanupTemporaryChannelListener() {
        if (state.unsubscribe) {
            state.unsubscribe();
            state.unsubscribe = null;
        }

        if (state.countdownTimer) {
            window.clearInterval(state.countdownTimer);
            state.countdownTimer = null;
        }
    }

    // V16: Studio Panel can moderate channels/tracks without changing this public schema.
})();
