(function () {
    const fallbackStations = window.BODWOLF_STATIONS || [];
    let managedStations = [];
    let communityStations = [];
    let stations = [...fallbackStations];
    const config = window.BODWOLF_CONFIG || {};
    const storageKeys = {
        station: "bodwolf:lastStationIndex",
        volume: "bodwolf:volume",
        theme: "bodwolf:theme",
        background: "bodwolf:background",
        effect: "bodwolf:effect",
        staticSound: "bodwolf:staticSound",
        comfortMode: "bodwolf:comfortMode"
    };
    const STATIC_AUDIO_PATH = "assets/audio/radio-static.mp3";
    const STATIC_AUDIO_VOLUME = 0.12;
    const COMFORT_STATIC_AUDIO_VOLUME = 0.04;
    const PUBLIC_STATION_CATEGORIES = [
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

    let currentStationIndex = config.defaultStationIndex || 0;
    let currentBgIndex = 0;
    let currentThemeIndex = 0;
    let currentEffectIndex = 0;
    let player;
    let tuningTimer;
    let pendingPlaylistItem = null;
    let currentPlaybackSource = "station";
    let currentCommunityTrackIndex = 0;
    let staticSoundEnabled = false;
    let comfortModeEnabled = false;
    let hasUserInteracted = false;
    let tuningVisualTimer;
    let signalLockTimer;
    let tuningStatusClearTimer;
    let staticAudio = null;
    let staticAudioWarningShown = false;
    let staticAudioProbeStarted = false;
    const reducedMotionQuery = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

    const radioDevice = document.querySelector(".radio-device");
    const vinylRecord = document.querySelector(".vinyl-record");
    const stationNameEl = document.getElementById("stationName");
    const stationMetaEl = document.getElementById("stationMeta");
    const barStationNameEl = document.getElementById("barStationName");
    const barStationMetaEl = document.getElementById("barStationMeta");
    const barThumbEl = document.getElementById("barThumb");
    const freqValueEl = document.getElementById("freqValue");
    const heroStatusPillEl = document.getElementById("heroStatusPill");
    const meterBars = document.querySelectorAll(".meter-bar");
    const playBtn = document.getElementById("playBtn");
    const pauseBtn = document.getElementById("pauseBtn");
    const volumeSlider = document.getElementById("volumeSlider");
    const mobileVolumeSlider = document.getElementById("mobileVolumeSlider");
    const tuningStatusEl = document.getElementById("tuningStatus");
    const firebaseStatusEl = document.getElementById("firebaseStatus");
    const listBtn = document.getElementById("listBtn");
    const randomBtn = document.getElementById("randomBtn");
    const channelMenu = document.getElementById("channelMenu");
    const closeMenu = document.getElementById("closeMenu");
    const channelsContainer = document.getElementById("channelsListContainer");
    const bgBtn = document.getElementById("bgBtn");
    const themeBtn = document.getElementById("themeBtn");
    const effectBtn = document.getElementById("effectBtn");
    const weatherOverlay = document.getElementById("weatherOverlay");
    const tuningOverlay = document.getElementById("tuningOverlay");
    const minimizeBtn = document.getElementById("minimizeBtn");
    const staticSoundBtn = document.getElementById("staticSoundBtn");
    const comfortModeBtn = document.getElementById("comfortModeBtn");
    const mobileStaticSoundBtn = document.getElementById("mobileStaticSoundBtn");
    const mobileComfortModeBtn = document.getElementById("mobileComfortModeBtn");
    const panelButtons = document.querySelectorAll(".panel-toggle");
    const proxyButtons = document.querySelectorAll(".mobile-proxy-control");
    const futurePanels = document.querySelectorAll(".future-panel");

    window.BODWOLF_RADIO = {
        playPlaylistItem,
        setMainStations,
        setStudioStations: setMainStations,
        setTemporaryStations,
        loadStationByIndex: loadStation,
        getCurrentStation() {
            return stations[currentStationIndex] || null;
        }
    };

    function init() {
        if (!stations.length) {
            stationNameEl.textContent = "No stations found";
            return;
        }

        restoreSavedSettings();
        currentStationIndex = findValidStationIndex(currentStationIndex, 1);
        initChannelList();
        updateDisplayInfo();
        bindControls();
        updateClock();
        setInterval(updateClock, 1000);
        checkFirebaseReadiness();
    }

    function initChannelList() {
        channelsContainer.textContent = "";
        let currentCategory = "";

        getSortedMainStationRows().forEach(({ station, index }) => {
            const category = getSafeStationCategory(station.category);

            if (category !== currentCategory) {
                appendStationGroupHeader(category);
                currentCategory = category;
            }

            appendStationListItem(station, index);
        });

        const communityRows = getCommunityStationRows();
        if (communityRows.length) {
            appendStationGroupHeader("COMMUNITY FM");
            communityRows.forEach(({ station, index }) => appendStationListItem(station, index));
        }
    }

    function appendStationGroupHeader(label) {
        const header = document.createElement("div");
        header.className = "category-header";
        header.textContent = `>>> ${label} <<<`;
        channelsContainer.appendChild(header);
    }

    function appendStationListItem(station, index) {
        const item = document.createElement("button");
        item.className = "channel-item";
        if (station.type === "community") {
            item.classList.add("community-channel");
        }
        item.type = "button";
        item.dataset.stationIndex = String(index);
        item.style.setProperty("--station-accent", getStationAccent(station));

        const thumbnail = document.createElement("span");
        thumbnail.className = "ch-thumb";
        applyStationArtwork(thumbnail, station, getStationGlyph(getSafeStationCategory(station.category)));

        const textWrap = document.createElement("span");
        textWrap.className = "ch-copy";

        const meta = document.createElement("span");
        meta.className = "ch-meta";
        meta.textContent = getStationListMeta(station);

        const freq = document.createElement("span");
        freq.className = "ch-freq";
        freq.textContent = `${station.freq || "--"} FM`;

        const badge = document.createElement("span");
        badge.className = "ch-badge";
        badge.textContent = station.type === "community" ? "COMMUNITY" : "LIVE";

        const signal = document.createElement("span");
        signal.className = "ch-signal";
        signal.setAttribute("aria-hidden", "true");
        for (let barIndex = 0; barIndex < 3; barIndex += 1) {
            signal.appendChild(document.createElement("span"));
        }

        const side = document.createElement("span");
        side.className = "ch-side";
        side.append(freq, badge, signal);

        const name = document.createElement("span");
        name.className = "ch-name";
        name.textContent = station.name;

        textWrap.append(name, meta);
        item.append(thumbnail, textWrap, side);
        item.addEventListener("click", () => {
            loadStation(index);
            toggleMenu(false);
        });

        channelsContainer.appendChild(item);
    }

    function getSortedMainStationRows() {
        return stations
            .map((station, index) => ({ station, index }))
            .filter(({ station }) => station && station.type !== "community")
            .sort(compareStationRows);
    }

    function getCommunityStationRows() {
        return stations
            .map((station, index) => ({ station, index }))
            .filter(({ station }) => station && station.type === "community");
    }

    function compareStationRows(a, b) {
        const categoryDelta = getStationCategoryRank(a.station.category) - getStationCategoryRank(b.station.category);
        if (categoryDelta !== 0) return categoryDelta;

        const sortDelta = Number(a.station.sortOrder || 0) - Number(b.station.sortOrder || 0);
        if (sortDelta !== 0) return sortDelta;

        const frequencyDelta = getStationFrequencyNumber(a.station.freq) - getStationFrequencyNumber(b.station.freq);
        if (frequencyDelta !== 0) return frequencyDelta;

        return String(a.station.name || "").localeCompare(String(b.station.name || ""));
    }

    function getStationCategoryRank(category) {
        const index = PUBLIC_STATION_CATEGORIES.indexOf(getSafeStationCategory(category));
        return index >= 0 ? index : PUBLIC_STATION_CATEGORIES.length;
    }

    function getStationFrequencyNumber(frequency) {
        const match = String(frequency || "").match(/\d+(?:\.\d+)?/);
        return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
    }

    function setTemporaryStations(nextStations) {
        const currentStation = stations[currentStationIndex];
        const currentKey = getStationKey(currentStation);
        communityStations = Array.isArray(nextStations) ? nextStations.filter(isVisibleCommunityStation) : [];
        rebuildStationCatalog(currentStation, currentKey, "community");
    }

    function setMainStations(nextStations) {
        const currentStation = stations[currentStationIndex];
        const currentKey = getStationKey(currentStation);
        managedStations = Array.isArray(nextStations) ? nextStations.filter(isVisibleManagedStation) : [];
        rebuildStationCatalog(currentStation, currentKey, "main");
    }

    function rebuildStationCatalog(currentStation, currentKey, removedType) {
        stations = [...getMainStations(), ...communityStations];

        const nextIndex = stations.findIndex((station) => getStationKey(station) === currentKey);
        currentStationIndex = nextIndex >= 0 ? nextIndex : findValidStationIndex(currentStationIndex, 1);
        initChannelList();

        if (currentStationIndex === -1) {
            currentStationIndex = 0;
        }

        const removedCurrentStation =
            (removedType === "community" && currentStation && currentStation.type === "community") ||
            (removedType === "main" && currentStation && currentStation.source === "admin");

        if (removedCurrentStation && nextIndex === -1) {
            loadStation(currentStationIndex, 1);
            return;
        }

        updateDisplayInfo();
    }

    function bindControls() {
        listBtn.addEventListener("click", () => toggleMenu(true));
        closeMenu.addEventListener("click", () => toggleMenu(false));

        playBtn.addEventListener("click", () => {
            if (player && player.playVideo) {
                player.playVideo();
                togglePlayState(true);
            }
        });

        pauseBtn.addEventListener("click", () => {
            if (player && player.pauseVideo) {
                player.pauseVideo();
                togglePlayState(false);
            }
        });

        document.getElementById("nextBtn").addEventListener("click", () => loadStation(currentStationIndex + 1, 1));
        document.getElementById("prevBtn").addEventListener("click", () => loadStation(currentStationIndex - 1, -1));
        randomBtn.addEventListener("click", loadRandomStation);

        volumeSlider.addEventListener("input", (event) => {
            if (player && player.setVolume) {
                player.setVolume(event.target.value);
            }
            if (mobileVolumeSlider) {
                mobileVolumeSlider.value = event.target.value;
            }
            saveSetting(storageKeys.volume, event.target.value);
        });

        if (mobileVolumeSlider) {
            mobileVolumeSlider.addEventListener("input", (event) => {
                volumeSlider.value = event.target.value;
                volumeSlider.dispatchEvent(new Event("input", { bubbles: true }));
            });
        }

        bgBtn.addEventListener("click", cycleBackground);
        themeBtn.addEventListener("click", cycleTheme);
        effectBtn.addEventListener("click", cycleEffect);
        staticSoundBtn.addEventListener("click", toggleStaticSound);
        comfortModeBtn.addEventListener("click", toggleComfortMode);
        minimizeBtn.addEventListener("click", toggleMinimized);

        panelButtons.forEach((button) => {
            button.addEventListener("click", () => showFuturePanel(button.dataset.panelTarget));
        });

        proxyButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const target = document.getElementById(button.dataset.proxyControl);
                if (target) target.click();
            });
        });

        document.addEventListener("pointerdown", markUserInteracted, { once: true });
        document.addEventListener("click", markUserInteracted, { once: true, capture: true });
        document.addEventListener("keydown", markUserInteracted, { once: true });

        if (reducedMotionQuery && reducedMotionQuery.addEventListener) {
            reducedMotionQuery.addEventListener("change", applyMotionPreference);
        } else if (reducedMotionQuery && reducedMotionQuery.addListener) {
            reducedMotionQuery.addListener(applyMotionPreference);
        }
    }

    function toggleMenu(show) {
        channelMenu.classList.toggle("hidden-menu", !show);
        channelMenu.classList.toggle("active-panel", show);
    }

    window.onYouTubeIframeAPIReady = function () {
        player = new YT.Player("player", {
            height: "200",
            width: "200",
            videoId: stations[currentStationIndex].id,
            playerVars: {
                playsinline: 1,
                controls: 0,
                disablekb: 1
            },
            events: {
                onReady: onPlayerReady,
                onStateChange: onPlayerStateChange,
                onError: onPlayerError
            }
        });
    };

    function onPlayerReady() {
        const volume = getSavedNumber(storageKeys.volume, config.defaultVolume || 50, 0, 100);
        player.setVolume(volume);
        volumeSlider.value = String(volume);
        if (mobileVolumeSlider) {
            mobileVolumeSlider.value = String(volume);
        }

        if (pendingPlaylistItem) {
            const item = pendingPlaylistItem;
            pendingPlaylistItem = null;
            playPlaylistItem(item);
        } else {
            updateDisplayInfo();
        }

        hideTuningStatus();

        if ("mediaSession" in navigator) {
            updateMediaSession();
        }
    }

    function onPlayerStateChange(event) {
        if (!window.YT || !YT.PlayerState) return;

        if (event.data === YT.PlayerState.PLAYING || event.data === YT.PlayerState.CUED) {
            hideTuningStatus();
        }

        if (event.data === YT.PlayerState.ENDED && currentPlaybackSource === "station") {
            playNextCommunityTrack();
        }
    }

    function onPlayerError(event) {
        if (currentPlaybackSource === "station" && stations[currentStationIndex]?.type === "community" && playNextCommunityTrack()) {
            return;
        }

        if (currentPlaybackSource === "playlist") {
            hideTuningStatus();
            console.warn("Renner Radio: YouTube could not load this queue item.", event.data);
            return;
        }

        console.warn(`Renner Radio: YouTube could not load station "${stations[currentStationIndex]?.name || "Unknown"}". Skipping to the next valid station.`, event.data);
        loadStation(currentStationIndex + 1, 1);
    }

    function loadStation(index, direction = 1) {
        const validIndex = findValidStationIndex(index, direction);
        if (validIndex === -1) {
            console.warn("Renner Radio: no valid stations are available.");
            stationNameEl.textContent = "No valid stations found";
            return;
        }

        currentStationIndex = validIndex;
        pendingPlaylistItem = null;
        currentPlaybackSource = "station";
        currentCommunityTrackIndex = 0;
        showTuningStatus();

        if (player && player.loadVideoById) {
            loadStationVideo(stations[currentStationIndex]);
        }

        updateDisplayInfo();
        if (stations[currentStationIndex] && stations[currentStationIndex].type !== "community") {
            saveSetting(storageKeys.station, currentStationIndex);
        }

        if ("mediaSession" in navigator) {
            updateMediaSession();
        }

        if (playBtn.classList.contains("hidden")) {
            togglePlayState(true);
        }

        window.clearTimeout(tuningTimer);
        tuningTimer = window.setTimeout(hideTuningStatus, getTuningDuration() + 900);
    }

    function playPlaylistItem(item) {
        if (!item || !isValidVideoId(item.videoId)) {
            console.warn("Renner Radio: queue item has an invalid YouTube video ID.", item);
            return false;
        }

        pendingPlaylistItem = item;
        currentPlaybackSource = "playlist";
        showTuningStatus();
        stationNameEl.textContent = item.title || "YouTube Track";
        updateStationMeta("QUEUE / Temporary community item");
        updateBottomNowPlaying(item.title || "YouTube Track", "Community Queue");
        freqValueEl.textContent = "V15";
        document.querySelectorAll(".channel-item").forEach((channelItem) => {
            channelItem.classList.remove("active-channel");
        });

        if (!player || !player.loadVideoById) {
            return true;
        }

        pendingPlaylistItem = null;
        player.loadVideoById(item.videoId);
        togglePlayState(true);

        if ("mediaSession" in navigator) {
            updatePlaylistMediaSession(item);
        }

        window.clearTimeout(tuningTimer);
        tuningTimer = window.setTimeout(hideTuningStatus, getTuningDuration() + 900);
        return true;
    }

    function loadStationVideo(station) {
        if (!player || !player.loadVideoById || !station) return;

        if (station.type === "community") {
            const track = getActiveCommunityTracks(station)[0];
            if (!track) return;
            currentCommunityTrackIndex = 0;
            updateCommunityTrackDisplay(station, track);
            try {
                // TODO V15.5: use known track durations to sync visitors to the same channel position.
                player.loadVideoById({
                    videoId: track.videoId,
                    startSeconds: 0
                });
                return;
            } catch (error) {
                console.warn("Renner Radio: community station sync seek failed. Starting normally.", error);
            }
        }

        player.loadVideoById(station.id);
    }

    function playNextCommunityTrack() {
        const station = stations[currentStationIndex];
        if (!station || station.type !== "community" || !player || !player.loadVideoById) return false;

        const tracks = getActiveCommunityTracks(station);
        if (!tracks.length) return false;

        currentCommunityTrackIndex = (currentCommunityTrackIndex + 1) % tracks.length;
        const track = tracks[currentCommunityTrackIndex];
        updateCommunityTrackDisplay(station, track);
        player.loadVideoById(track.videoId);
        togglePlayState(true);
        return true;
    }

    function getActiveCommunityTracks(station) {
        return Array.isArray(station.tracks)
            ? station.tracks
                .filter((track) => track && track.status === "active" && isValidVideoId(track.videoId))
                .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
            : [];
    }

    function updateCommunityTrackDisplay(station, track) {
        if (!station || station.type !== "community") return;

        const title = track && track.title ? track.title : "YouTube Track";
        updateStationMeta(`Now playing: ${title}`);
        updateBottomNowPlaying(station.name, `${title} / ${station.freq || "--"} FM`);

        if ("mediaSession" in navigator) {
            updateCommunityMediaSession(station, track);
        }
    }

    function loadRandomStation() {
        const validIndexes = stations
            .map((station, index) => (isValidStation(station) ? index : -1))
            .filter((index) => index !== -1);

        if (!validIndexes.length) {
            console.warn("Renner Radio: random station failed because no valid stations are available.");
            return;
        }

        const pool = validIndexes.length > 1 ? validIndexes.filter((index) => index !== currentStationIndex) : validIndexes;
        const randomIndex = pool[Math.floor(Math.random() * pool.length)];
        loadStation(randomIndex, 1);
    }

    function updateDisplayInfo() {
        const station = stations[currentStationIndex];
        stationNameEl.textContent = station.name;
        freqValueEl.textContent = station.freq;
        if (station.type === "community") {
            const remaining = formatRemainingTime(station.expiresAt - Date.now());
            const tracks = getActiveCommunityTracks(station);
            const trackTitle = tracks[currentCommunityTrackIndex]?.title || tracks[0]?.title || "Waiting for tracks";
            updateStationMeta(`${trackTitle} / ${remaining} left`);
            updateBottomNowPlaying(station.name, `${tracks.length} tracks / ${station.freq || "--"} FM`);
        } else {
            const category = getSafeStationCategory(station.category);
            updateStationMeta(`${category} mood / ${station.freq || "--"} FM`);
            updateBottomNowPlaying(station.name, `${category} / ${station.freq || "--"} FM`);
        }

        document.querySelectorAll(".channel-item").forEach((item) => {
            item.classList.toggle("active-channel", Number(item.dataset.stationIndex) === currentStationIndex);
        });
        updateStationVisualHooks(station);
    }

    function getStationListMeta(station) {
        if (station.type === "community") {
            const remaining = formatRemainingTime(station.expiresAt - Date.now());
            const trackCount = getActiveCommunityTracks(station).length;
            return `${station.displayName || "RadioGuest"} / ${trackCount} tracks / ${remaining}`;
        }

        return getSafeStationCategory(station.category);
    }

    function getStationKey(station) {
        if (!station) return "";
        if (station.type === "community") return `community:${station.stationId || station.id}`;
        if (station.source === "admin") return `admin:${station.stationId || station.id}`;
        return `fallback:${station.id}`;
    }

    function getMainStations() {
        return managedStations.length ? managedStations : fallbackStations;
    }

    function isVisibleManagedStation(station) {
        return Boolean(
            station &&
            station.status === "active" &&
            station.isActive !== false &&
            isValidVideoId(station.id)
        );
    }

    function getSafeStationCategory(category) {
        const normalized = String(category || "CUSTOM").trim().toUpperCase();
        return PUBLIC_STATION_CATEGORIES.includes(normalized)
            ? normalized
            : "CUSTOM";
    }

    function isVisibleCommunityStation(station) {
        return Boolean(
            station &&
            station.type === "community" &&
            station.status === "active" &&
            Number(station.expiresAt) > Date.now() &&
            getActiveCommunityTracks(station).length > 0
        );
    }

    function formatRemainingTime(milliseconds) {
        const safeMs = Math.max(0, Number(milliseconds) || 0);
        const totalSeconds = Math.ceil(safeMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        if (minutes <= 0) return `${seconds}s`;
        return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
    }

    function updateStationMeta(text) {
        if (stationMetaEl) stationMetaEl.textContent = text;
    }

    function updateBottomNowPlaying(name, meta) {
        if (barStationNameEl) barStationNameEl.textContent = name;
        if (barStationMetaEl) barStationMetaEl.textContent = meta;
    }

    function updateStationVisualHooks(station) {
        if (!station) return;

        const accent = getStationAccent(station);
        radioDevice.style.setProperty("--station-accent", accent);
        applyStationArtwork(barThumbEl, station, getStationGlyph(getSafeStationCategory(station.category)));

        if (heroStatusPillEl) {
            heroStatusPillEl.textContent = station.type === "community" ? "COMMUNITY FM" : "STEREO LIVE";
            heroStatusPillEl.style.setProperty("--station-accent", accent);
        }
    }

    function applyStationArtwork(element, station, fallbackText) {
        if (!element || !station) return;

        const artworkUrl = getStationArtwork(station);
        element.style.setProperty("--station-accent", getStationAccent(station));
        element.classList.toggle("has-media", Boolean(artworkUrl));
        element.style.backgroundImage = artworkUrl ? `url("${artworkUrl}")` : "";

        const label = element.querySelector("span") || element;
        label.textContent = artworkUrl ? "" : fallbackText;
    }

    function getStationArtwork(station) {
        if (!station) return "";
        return [station.thumbnail, station.image, station.fallbackImage]
            .find((value) => typeof value === "string" && value.trim().length > 0) || "";
    }

    function getStationAccent(station) {
        return station && typeof station.accentColor === "string" && /^#[0-9A-Fa-f]{6}$/.test(station.accentColor)
            ? station.accentColor
            : "var(--accent-color)";
    }

    function getStationGlyph(category) {
        const glyphs = {
            LOFI: "LO",
            SONG: "SO",
            "COMMUNITY FM": "CM"
        };

        return glyphs[category] || "ON";
    }

    function togglePlayState(isPlaying) {
        playBtn.classList.toggle("hidden", isPlaying);
        pauseBtn.classList.toggle("hidden", !isPlaying);
        radioDevice.classList.toggle("playing", isPlaying);
        vinylRecord.classList.toggle("spinning", isPlaying);
        meterBars.forEach((bar) => bar.classList.toggle("active", isPlaying));
    }

    function cycleBackground() {
        const backgrounds = config.backgrounds || [];
        if (!backgrounds.length) return;

        currentBgIndex = (currentBgIndex + 1) % backgrounds.length;
        applyBackground(currentBgIndex);
        saveSetting(storageKeys.background, currentBgIndex);
    }

    function cycleTheme() {
        const themes = config.themes || [];
        if (!themes.length) return;

        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        applyTheme(currentThemeIndex);
        saveSetting(storageKeys.theme, currentThemeIndex);
    }

    function cycleEffect() {
        const effects = config.effects || [];
        if (!effects.length) return;

        currentEffectIndex = (currentEffectIndex + 1) % effects.length;
        applyEffect(currentEffectIndex);
        saveSetting(storageKeys.effect, currentEffectIndex);
    }

    function toggleStaticSound() {
        staticSoundEnabled = !staticSoundEnabled;
        saveSetting(storageKeys.staticSound, staticSoundEnabled ? "1" : "0");
        updateTuningControlUi();
        if (staticSoundEnabled) {
            probeStaticAudioFile();
        }
    }

    function toggleComfortMode() {
        comfortModeEnabled = !comfortModeEnabled;
        if (comfortModeEnabled && staticSoundEnabled) {
            staticSoundEnabled = false;
            saveSetting(storageKeys.staticSound, "0");
        }
        saveSetting(storageKeys.comfortMode, comfortModeEnabled ? "1" : "0");
        applyComfortMode();
        updateTuningControlUi();
    }

    function toggleMinimized() {
        radioDevice.classList.toggle("minimized");
        const iconClass = radioDevice.classList.contains("minimized") ? "fas fa-expand-alt" : "fas fa-compress-alt";
        minimizeBtn.innerHTML = `<i class="${iconClass}"></i>`;
    }

    function showFuturePanel(panelId) {
        // V15.3: playlist.js owns temporary community channels and nested tracks.
        // V15.4: station cards expose thumbnail/image/fallback/accent hooks for managed station assets.
        // V11: chat.js owns anonymous realtime messages and local preview chat.
        // V13.1: custom English names can use this same panel system for profile UI.
        // V14/V14.1: animated backgrounds and glitch transitions should stay separate from panel state.
        // V16.2: /adminStations can replace stations.js as the main station source.
        if (panelId === "channelMenu") {
            channelMenu.classList.remove("hidden-menu");
        } else {
            channelMenu.classList.add("hidden-menu");
        }

        futurePanels.forEach((panel) => {
            panel.classList.toggle("active-panel", panel.id === panelId);
        });

        panelButtons.forEach((button) => {
            button.classList.toggle("active-toggle", button.dataset.panelTarget === panelId);
        });
    }

    function updateClock() {
        const now = new Date();
        const timeString = now.toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit"
        });

        document.getElementById("clock").textContent = timeString;
    }

    function updateMediaSession() {
        if (!("mediaSession" in navigator)) return;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: stations[currentStationIndex].name,
            artist: "Renner Radio Station",
            album: "Live 24/7",
            artwork: [
                {
                    src: (config.backgrounds || [])[0] || "",
                    sizes: "96x96",
                    type: "image/gif"
                }
            ]
        });

        navigator.mediaSession.setActionHandler("play", () => {
            togglePlayState(true);
            player.playVideo();
        });

        navigator.mediaSession.setActionHandler("pause", () => {
            togglePlayState(false);
            player.pauseVideo();
        });

        navigator.mediaSession.setActionHandler("previoustrack", () => loadStation(currentStationIndex - 1, -1));
        navigator.mediaSession.setActionHandler("nexttrack", () => loadStation(currentStationIndex + 1, 1));
    }

    function updatePlaylistMediaSession(item) {
        if (!("mediaSession" in navigator)) return;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: item.title || "YouTube Track",
            artist: "Renner Queue",
            album: "Community YouTube Queue",
            artwork: [
                {
                    src: (config.backgrounds || [])[0] || "",
                    sizes: "96x96",
                    type: "image/gif"
                }
            ]
        });
    }

    function updateCommunityMediaSession(station, track) {
        if (!("mediaSession" in navigator)) return;

        navigator.mediaSession.metadata = new MediaMetadata({
            title: station.name,
            artist: track?.title || "Community Track",
            album: "Renner Community FM",
            artwork: [
                {
                    src: (config.backgrounds || [])[0] || "",
                    sizes: "96x96",
                    type: "image/gif"
                }
            ]
        });
    }

    function checkFirebaseReadiness() {
        let handled = false;

        const handleFirebaseState = async (state) => {
            if (handled) return;
            handled = true;

            if (!state || !state.configured) {
                if (state && state.error) {
                    setFirebaseStatus("Firebase error", "error");
                    console.warn("Renner Radio: Firebase error. Static radio continues.", state.error);
                    console.warn("Firebase smoke test failed.", state.error);
                } else {
                    setFirebaseStatus("Static mode", "static");
                    console.info("Renner Radio: Firebase config missing. Static mode continues.");
                    console.info("Firebase smoke test skipped.");
                }
                return;
            }

            const firebaseBridge = window.BODWOLF_FIREBASE;
            const user = firebaseBridge ? await firebaseBridge.signInAnonymousUser() : null;
            const databaseRootRef = firebaseBridge ? firebaseBridge.getDatabaseRootRef() : null;

            if (user && databaseRootRef) {
                setFirebaseStatus("Firebase ready", "ready");
                console.log("Firebase ready.");
                await runFirebaseSmokeTest(firebaseBridge);
                setupManagedStations(firebaseBridge);
                return;
            }

            setFirebaseStatus("Firebase error", "error");
            console.warn("Renner Radio: Firebase configured, but readiness check did not complete. Static radio continues.");
            console.warn("Firebase smoke test skipped.");
        };

        const firebaseBridge = window.BODWOLF_FIREBASE;
        if (firebaseBridge && firebaseBridge.ready) {
            firebaseBridge.ready.then(handleFirebaseState).catch((error) => {
                setFirebaseStatus("Firebase error", "error");
                console.warn("Renner Radio: Firebase readiness check failed. Static radio continues.", error);
                console.warn("Firebase smoke test failed.", error);
            });
            return;
        }

        window.addEventListener("bodwolf:firebase-ready", (event) => handleFirebaseState(event.detail), { once: true });
        window.addEventListener("bodwolf:firebase-unavailable", (event) => handleFirebaseState(event.detail), { once: true });

        window.setTimeout(() => {
            if (handled) return;

            handled = true;
            setFirebaseStatus("Static mode", "static");
            console.info("Renner Radio: Firebase module did not report status. Static mode continues.");
            console.info("Firebase smoke test skipped.");
        }, 2500);
    }

    async function runFirebaseSmokeTest(firebaseBridge) {
        if (!firebaseBridge || !firebaseBridge.runFirebaseSmokeTest) {
            console.info("Firebase smoke test skipped.");
            return;
        }

        try {
            const result = await firebaseBridge.runFirebaseSmokeTest();

            if (result.skipped) {
                console.info("Firebase smoke test skipped.", result);
                return;
            }

            if (result.ok) {
                console.log("Firebase smoke test passed.", result);
                return;
            }

            console.warn("Firebase smoke test failed.", result);
        } catch (error) {
            console.warn("Firebase smoke test failed.", error);
        }
    }

    function setupManagedStations(firebaseBridge) {
        if (!firebaseBridge || typeof firebaseBridge.watchActiveAdminStations !== "function") {
            return;
        }

        const unsubscribe = firebaseBridge.watchActiveAdminStations((records) => {
            const managed = normalizeAdminStations(records);
            if (!managed.length) {
                console.info("Renner Radio: no active admin stations found. Using stations.js fallback.");
            }
            setMainStations(managed);
        }, (error) => {
            console.warn("Renner Radio: admin station read failed. Using stations.js fallback.", error);
            setMainStations([]);
        });

        if (!unsubscribe) {
            console.warn("Renner Radio: admin station listener could not start. Using stations.js fallback.");
        }
    }

    function normalizeAdminStations(records) {
        return Object.entries(records || {})
            .map(([stationId, station]) => normalizeAdminStation(stationId, station))
            .filter(Boolean)
            .sort((a, b) => {
                const sortDelta = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
                if (sortDelta !== 0) return sortDelta;
                return String(a.name || "").localeCompare(String(b.name || ""));
            });
    }

    function normalizeAdminStation(stationId, station) {
        if (!station || station.status !== "active" || station.isActive === false || !isValidVideoId(station.youtubeId)) {
            return null;
        }

        return {
            source: "admin",
            stationId,
            category: getSafeStationCategory(station.category),
            mood: getSafeStationCategory(station.category),
            freq: station.frequency || "--",
            name: station.name || "Managed Station",
            id: station.youtubeId,
            youtubeUrl: station.youtubeUrl || "",
            thumbnail: station.thumbnailUrl || "",
            image: station.backgroundImageUrl || "",
            fallbackImage: station.backgroundGifUrl || "",
            backgroundVideoUrl: station.backgroundVideoUrl || "",
            backgroundGifUrl: station.backgroundGifUrl || "",
            backgroundImageUrl: station.backgroundImageUrl || "",
            accentColor: station.accentColor || "",
            description: station.description || station.category || "Admin managed station",
            sortOrder: Number(station.sortOrder || 0),
            status: station.status,
            isActive: station.isActive !== false
        };
    }

    function setFirebaseStatus(text, mode) {
        if (!firebaseStatusEl) return;

        firebaseStatusEl.textContent = text;
        firebaseStatusEl.classList.toggle("is-ready", mode === "ready");
        firebaseStatusEl.classList.toggle("is-error", mode === "error");
    }

    function restoreSavedSettings() {
        currentStationIndex = getSavedNumber(storageKeys.station, config.defaultStationIndex || 0, 0, stations.length - 1);
        currentBgIndex = getSavedNumber(storageKeys.background, 0, 0, (config.backgrounds || []).length - 1);
        currentThemeIndex = getSavedNumber(storageKeys.theme, 0, 0, (config.themes || []).length - 1);
        currentEffectIndex = getSavedNumber(storageKeys.effect, 0, 0, (config.effects || []).length - 1);
        staticSoundEnabled = getSavedBoolean(storageKeys.staticSound, false);
        comfortModeEnabled = getSavedBoolean(storageKeys.comfortMode, false);

        applyBackground(currentBgIndex);
        applyTheme(currentThemeIndex);
        applyEffect(currentEffectIndex);
        applyComfortMode();
        applyMotionPreference();
        updateTuningControlUi();
        if (staticSoundEnabled) {
            probeStaticAudioFile();
        }
        volumeSlider.value = String(getSavedNumber(storageKeys.volume, config.defaultVolume || 50, 0, 100));
    }

    function applyBackground(index) {
        const backgrounds = config.backgrounds || [];
        if (backgrounds[index]) {
            document.body.style.backgroundImage = `url("${backgrounds[index]}")`;
        }
    }

    function applyTheme(index) {
        (config.themes || []).forEach((theme) => {
            if (theme.className) {
                document.body.classList.remove(theme.className);
            }
        });

        const selectedTheme = (config.themes || [])[index];
        if (selectedTheme && selectedTheme.className) {
            document.body.classList.add(selectedTheme.className);
        }
    }

    function applyEffect(index) {
        (config.effects || []).forEach((effect) => {
            if (effect.className) {
                weatherOverlay.classList.remove(effect.className);
            }
        });

        const selectedEffect = (config.effects || [])[index] || (config.effects || [])[0];
        if (selectedEffect && selectedEffect.className) {
            weatherOverlay.classList.add(selectedEffect.className);
        }

        if (selectedEffect) {
            effectBtn.innerHTML = `<i class="${selectedEffect.icon}"></i>`;
        }
    }

    function findValidStationIndex(startIndex, direction) {
        if (!stations.length) return -1;

        const normalizedDirection = direction < 0 ? -1 : 1;
        let index = normalizeIndex(startIndex);

        for (let attempts = 0; attempts < stations.length; attempts += 1) {
            if (isValidStation(stations[index])) {
                return index;
            }

            console.warn(`Renner Radio: station "${stations[index]?.name || "Unknown"}" has a missing or invalid YouTube ID. Skipping it.`);
            index = normalizeIndex(index + normalizedDirection);
        }

        return -1;
    }

    function isValidStation(station) {
        if (!station) return false;
        if (station.type === "community") {
            return isVisibleCommunityStation(station);
        }

        return isValidVideoId(station.id);
    }

    function isValidVideoId(videoId) {
        return typeof videoId === "string" && /^[A-Za-z0-9_-]{11}$/.test(videoId);
    }

    function normalizeIndex(index) {
        return (index + stations.length) % stations.length;
    }

    function showTuningStatus() {
        tuningStatusEl.textContent = "Tuning...";
        radioDevice.classList.add("is-tuning");
        triggerTuningTransition();
    }

    function hideTuningStatus() {
        tuningStatusEl.textContent = "Signal locked";
        radioDevice.classList.remove("is-tuning");
        window.clearTimeout(tuningTimer);
        window.clearTimeout(tuningStatusClearTimer);
        tuningStatusClearTimer = window.setTimeout(() => {
            if (tuningStatusEl.textContent === "Signal locked") {
                tuningStatusEl.textContent = "";
            }
        }, 900);
    }

    function triggerTuningTransition() {
        const duration = getTuningDuration();

        window.clearTimeout(tuningVisualTimer);
        window.clearTimeout(signalLockTimer);
        window.clearTimeout(tuningStatusClearTimer);

        if (tuningOverlay) {
            tuningOverlay.classList.remove("is-active");
            void tuningOverlay.offsetWidth;
            tuningOverlay.classList.add("is-active");
        }

        document.body.classList.add("is-tuning-visual");
        playStaticSound();

        signalLockTimer = window.setTimeout(() => {
            if (tuningStatusEl.textContent === "Tuning...") {
                tuningStatusEl.textContent = "Signal locked";
            }
        }, Math.max(260, duration - 170));

        tuningVisualTimer = window.setTimeout(() => {
            if (tuningOverlay) {
                tuningOverlay.classList.remove("is-active");
            }
            document.body.classList.remove("is-tuning-visual");
        }, duration + 80);
    }

    function getTuningDuration() {
        if (prefersReducedMotion()) return 360;
        if (comfortModeEnabled) return 460;
        return 720;
    }

    function playStaticSound() {
        if (!staticSoundEnabled || !hasUserInteracted) return;

        probeStaticAudioFile();

        const audio = getStaticAudio();
        if (!audio) return;

        try {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = comfortModeEnabled ? COMFORT_STATIC_AUDIO_VOLUME : STATIC_AUDIO_VOLUME;
            const playPromise = audio.play();

            if (playPromise && typeof playPromise.catch === "function") {
                playPromise.catch((error) => {
                    warnStaticAudioOnce(`Renner Radio: optional radio static sound could not play. ${error.message || error}`);
                });
            }
        } catch (error) {
            warnStaticAudioOnce(`Renner Radio: optional radio static sound failed. ${error.message || error}`);
        }
    }

    function probeStaticAudioFile() {
        if (staticAudioProbeStarted) return;
        if (!window.location.protocol.startsWith("http")) return;

        if (typeof fetch === "function") {
            staticAudioProbeStarted = true;
            fetch(STATIC_AUDIO_PATH, { method: "HEAD", cache: "no-store" })
                .then((response) => {
                    if (!response.ok) {
                        warnStaticAudioOnce(`Renner Radio: optional radio static file was not found at ${STATIC_AUDIO_PATH}.`);
                    }
                })
                .catch((error) => {
                    warnStaticAudioOnce(`Renner Radio: optional radio static file could not be checked. ${error.message || error}`);
                });
            return;
        }

        if (typeof XMLHttpRequest === "undefined") return;

        staticAudioProbeStarted = true;
        const request = new XMLHttpRequest();
        request.open("HEAD", STATIC_AUDIO_PATH, true);
        request.onload = () => {
            if (request.status < 200 || request.status >= 400) {
                warnStaticAudioOnce(`Renner Radio: optional radio static file was not found at ${STATIC_AUDIO_PATH}.`);
            }
        };
        request.onerror = () => {
            warnStaticAudioOnce(`Renner Radio: optional radio static file could not be checked.`);
        };
        request.send();
    }

    function getStaticAudio() {
        if (staticAudio) return staticAudio;
        if (typeof Audio === "undefined") return null;

        staticAudio = new Audio(STATIC_AUDIO_PATH);
        staticAudio.preload = "none";
        staticAudio.volume = STATIC_AUDIO_VOLUME;
        staticAudio.addEventListener("error", () => {
            warnStaticAudioOnce(`Renner Radio: optional radio static file was not found or could not load at ${STATIC_AUDIO_PATH}.`);
        });
        return staticAudio;
    }

    function warnStaticAudioOnce(message) {
        if (staticAudioWarningShown) return;
        staticAudioWarningShown = true;
        console.warn(message);
    }

    function markUserInteracted() {
        hasUserInteracted = true;
    }

    function applyComfortMode() {
        document.body.classList.toggle("comfort-mode", comfortModeEnabled);
    }

    function applyMotionPreference() {
        document.body.classList.toggle("reduced-motion", prefersReducedMotion());
    }

    function prefersReducedMotion() {
        return Boolean(reducedMotionQuery && reducedMotionQuery.matches);
    }

    function updateTuningControlUi() {
        updateToggleButton(staticSoundBtn, mobileStaticSoundBtn, staticSoundEnabled, "Static Sound", "broadcast-tower");
        updateToggleButton(comfortModeBtn, mobileComfortModeBtn, comfortModeEnabled, "Comfort Mode", "eye");
    }

    function updateToggleButton(button, mobileButton, isEnabled, label, iconName) {
        const stateText = isEnabled ? "On" : "Off";
        const title = `${label} ${stateText}`;
        const iconClass = iconName === "eye" && isEnabled ? "fas fa-eye-slash" : `fas fa-${iconName}`;

        if (button) {
            button.classList.toggle("is-enabled", isEnabled);
            button.title = title;
            button.setAttribute("aria-label", title);
            button.innerHTML = `<i class="${iconClass}"></i>`;
        }

        if (mobileButton) {
            mobileButton.classList.toggle("is-enabled", isEnabled);
            mobileButton.innerHTML = `<i class="${iconClass}"></i><span>${label.replace(" Sound", "")} ${stateText}</span>`;
        }
    }

    function getSavedNumber(key, fallback, min, max) {
        let rawValue;
        try {
            if (!window.localStorage) return fallback;
            rawValue = window.localStorage.getItem(key);
        } catch (error) {
            console.warn(`Renner Radio: could not read setting "${key}".`, error);
            return fallback;
        }

        if (rawValue === null) return fallback;
        const value = Number(rawValue);
        if (!Number.isFinite(value)) return fallback;

        return Math.min(Math.max(value, min), max);
    }

    function getSavedBoolean(key, fallback) {
        try {
            if (!window.localStorage) return fallback;
            const value = window.localStorage.getItem(key);
            if (value === null) return fallback;
            return value === "1" || value === "true";
        } catch (error) {
            console.warn(`Renner Radio: could not read setting "${key}".`, error);
            return fallback;
        }
    }

    function saveSetting(key, value) {
        try {
            if (!window.localStorage) return;
            window.localStorage.setItem(key, String(value));
        } catch (error) {
            console.warn(`Renner Radio: could not save setting "${key}".`, error);
        }
    }

    // V9: Firebase config is loaded by firebase.js; app.js only checks readiness.
    // V15.3: playlist.js owns temporary community channels, tracks, expiry, and Firebase sync.
    // V15.4: UI reads optional station thumbnail/image/fallbackImage/accentColor hooks only.
    // V11: chat.js owns anonymous names, validation, local preview, and Firebase chat sync.
    document.addEventListener("DOMContentLoaded", init);
})();
