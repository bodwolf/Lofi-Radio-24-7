(function () {
    const CHAT_PATH = "/chatMessages";
    const PROFILE_KEYS = {
        name: "bodwolf:chatName",
        color: "bodwolf:chatColor",
        createdAt: "bodwolf:chatCreatedAt",
        updatedAt: "bodwolf:chatUpdatedAt"
    };
    const COLOR_PALETTE = ["#7dd3fc", "#a78bfa", "#fb7185", "#fbbf24", "#34d399", "#f472b6"];
    const BLOCKED_WORDS = ["spamword", "fake-giveaway", "crypto-scam"];
    const MAX_MESSAGE_LENGTH = 160;
    const RATE_LIMIT_MS = 2000;
    const DISPLAY_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9]{3,15}$/;

    const state = {
        mode: "local",
        loading: true,
        sending: false,
        savingName: false,
        editingName: false,
        messages: [],
        unsubscribe: null,
        userId: null,
        firebaseBridge: null,
        lastSentAt: 0,
        userColor: loadSavedColor(),
        profile: loadStoredProfile()
    };

    const form = document.getElementById("chatForm");
    const input = document.getElementById("chatInput");
    const sendButton = document.getElementById("chatSendBtn");
    const messageEl = document.getElementById("chatMessage");
    const loadingEl = document.getElementById("chatLoading");
    const emptyEl = document.getElementById("chatEmpty");
    const itemsEl = document.getElementById("chatItems");
    const modeHintEl = document.getElementById("chatModeHint");
    const profileNameEl = document.getElementById("chatProfileName");
    const colorSwatchEl = document.getElementById("chatColorSwatch");
    const nameSetupEl = document.getElementById("chatNameSetup");
    const nameForm = document.getElementById("chatNameForm");
    const nameInput = document.getElementById("chatNameInput");
    const nameSaveButton = document.getElementById("chatNameSaveBtn");
    const nameEditButton = document.getElementById("chatNameEditBtn");

    window.BODWOLF_CHAT = {
        getProfile() {
            return state.profile ? { ...state.profile } : null;
        },
        getMessages() {
            return [...state.messages];
        }
    };

    document.addEventListener("DOMContentLoaded", initChat);
    window.addEventListener("beforeunload", cleanupChatListener);

    function initChat() {
        if (!form || !input || !sendButton || !itemsEl) return;

        updateProfileUi();
        form.addEventListener("submit", handleSubmit);
        input.addEventListener("keydown", handleInputKeydown);

        if (nameForm) {
            nameForm.addEventListener("submit", handleNameSubmit);
        }

        if (nameEditButton) {
            nameEditButton.addEventListener("click", startEditingName);
        }

        connectChatDataSource();
    }

    function connectChatDataSource() {
        setLoading(true);
        setModeHint("local");

        const firebaseBridge = window.BODWOLF_FIREBASE;
        if (firebaseBridge && firebaseBridge.ready) {
            firebaseBridge.ready
                .then((firebaseState) => setupFirebaseChat(firebaseBridge, firebaseState))
                .catch((error) => {
                    console.warn("Renner Radio: chat Firebase setup failed. Local preview continues.", error);
                    setupLocalChat("Local preview only. Firebase not connected.");
                });
            return;
        }

        const onReady = (event) => setupFirebaseChat(window.BODWOLF_FIREBASE, event.detail);
        const onUnavailable = () => setupLocalChat("Local preview only. Firebase not connected.");

        window.addEventListener("bodwolf:firebase-ready", onReady, { once: true });
        window.addEventListener("bodwolf:firebase-unavailable", onUnavailable, { once: true });

        window.setTimeout(() => {
            if (state.loading) {
                setupLocalChat("Local preview only. Firebase not connected.");
            }
        }, 2800);
    }

    async function setupFirebaseChat(firebaseBridge, firebaseState) {
        if (!firebaseBridge || !firebaseState || !firebaseState.ready) {
            setupLocalChat("Local preview only. Firebase not connected.");
            return;
        }

        try {
            const user = await firebaseBridge.signInAnonymousUser();
            if (!user || !user.uid) {
                setupLocalChat("Local preview only. Firebase not connected.");
                return;
            }

            const unsubscribe = firebaseBridge.listenToChatMessages(handleFirebaseMessages, (error) => {
                showMessage("Could not load Firebase chat.", "error");
                console.warn("Renner Radio: chat listener failed.", error);
            });

            if (!unsubscribe) {
                setupLocalChat("Local preview only. Firebase not connected.");
                return;
            }

            cleanupChatListener();
            state.mode = "firebase";
            state.firebaseBridge = firebaseBridge;
            state.userId = user.uid;
            state.unsubscribe = unsubscribe;

            if (hasValidProfile()) {
                await persistProfileToFirebase();
            }

            setModeHint("firebase");
            updateProfileUi();
        } catch (error) {
            console.warn("Renner Radio: chat Firebase setup failed. Local preview continues.", error);
            setupLocalChat("Local preview only. Firebase not connected.");
        }
    }

    function setupLocalChat(message) {
        cleanupChatListener();
        state.mode = "local";
        state.firebaseBridge = null;
        state.userId = null;
        state.loading = false;
        setModeHint("local", message);
        renderChat();
        updateProfileUi();
    }

    function handleFirebaseMessages(messagesById) {
        state.messages = Object.entries(messagesById || {})
            .map(([id, message]) => ({
                id,
                ...message
            }))
            .filter(isRenderableMessage)
            .sort((a, b) => a.createdAt - b.createdAt)
            .slice(-50);

        state.loading = false;
        renderChat();
    }

    function handleInputKeydown(event) {
        if (event.key !== "Enter" || event.shiftKey) return;

        event.preventDefault();
        if (state.loading || state.sending) return;

        if (typeof form.requestSubmit === "function") {
            form.requestSubmit(sendButton);
        } else {
            form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        }
    }

    async function handleNameSubmit(event) {
        event.preventDefault();
        clearMessage();

        const validation = validateDisplayName(nameInput ? nameInput.value : "");
        if (!validation.ok) {
            showMessage(validation.message, "error");
            return;
        }

        const now = Date.now();
        const createdAt = state.profile && Number.isFinite(Number(state.profile.createdAt)) ? Number(state.profile.createdAt) : now;

        state.profile = {
            displayName: validation.displayName,
            userColor: state.userColor,
            createdAt,
            updatedAt: now
        };

        state.editingName = false;
        saveProfile(state.profile);
        updateProfileUi();
        state.savingName = true;
        updateSendDisabledState();

        try {
            await persistProfileToFirebase();
            showMessage("Name saved.", "success");
        } catch (error) {
            console.warn("Renner Radio: profile Firebase update failed. Local name is saved.", error);
            showMessage("Name saved locally. Firebase profile update failed.", "error");
        } finally {
            state.savingName = false;
            updateSendDisabledState();
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        clearMessage();

        if (!hasValidProfile()) {
            state.editingName = true;
            updateProfileUi();
            showMessage("Choose a name before chatting.", "error");
            if (nameInput) nameInput.focus();
            return;
        }

        const validation = validateMessage(input.value);
        if (!validation.ok) {
            showMessage(validation.message, "error");
            return;
        }

        const now = Date.now();
        if (now - state.lastSentAt < RATE_LIMIT_MS) {
            showMessage("Slow down a little before sending again.", "error");
            return;
        }

        const chatMessage = {
            text: validation.text,
            displayName: state.profile.displayName,
            userColor: state.profile.userColor,
            uid: state.userId || "local-preview",
            createdAt: now
        };

        setSending(true);

        try {
            if (state.mode === "firebase" && state.firebaseBridge) {
                await state.firebaseBridge.sendChatMessage(chatMessage);
                showMessage("Sent.", "success");
            } else {
                state.messages = [
                    ...state.messages,
                    {
                        ...chatMessage,
                        id: `local-${now}`
                    }
                ].slice(-50);
                renderChat();
                showMessage("Sent locally for this session.", "success");
            }

            state.lastSentAt = now;
            input.value = "";
        } catch (error) {
            console.warn("Renner Radio: chat send failed.", error);
            showMessage("Could not send this message. Try again.", "error");
        } finally {
            setSending(false);
        }
    }

    function validateMessage(rawText) {
        const text = typeof rawText === "string" ? rawText.trim() : "";

        if (!text) {
            return {
                ok: false,
                message: "Message is empty."
            };
        }

        if (text.length > MAX_MESSAGE_LENGTH) {
            return {
                ok: false,
                message: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer.`
            };
        }

        if (containsBlockedWord(text)) {
            return {
                ok: false,
                message: "This message is blocked by the local filter."
            };
        }

        return {
            ok: true,
            text
        };
    }

    function validateDisplayName(rawName) {
        const displayName = typeof rawName === "string" ? rawName.trim() : "";

        if (!displayName) {
            return {
                ok: false,
                message: "Choose a name before chatting."
            };
        }

        if (displayName.length < 4) {
            return {
                ok: false,
                message: "Name must be at least 4 characters."
            };
        }

        if (displayName.length > 16) {
            return {
                ok: false,
                message: "Name must be 16 characters or fewer."
            };
        }

        if (!DISPLAY_NAME_PATTERN.test(displayName)) {
            return {
                ok: false,
                message: "Use English letters and optional numbers only. No spaces or symbols."
            };
        }

        return {
            ok: true,
            displayName
        };
    }

    function containsBlockedWord(text) {
        const normalized = text.toLowerCase();
        return BLOCKED_WORDS.some((word) => word && normalized.includes(word));
    }

    function renderChat() {
        setLoading(state.loading);
        itemsEl.textContent = "";
        emptyEl.classList.toggle("hidden", state.loading || state.messages.length > 0);

        state.messages.forEach((chatMessage) => {
            itemsEl.appendChild(createChatMessageElement(chatMessage));
        });

        window.requestAnimationFrame(() => {
            itemsEl.scrollTop = itemsEl.scrollHeight;
        });
    }

    function createChatMessageElement(chatMessage) {
        const row = document.createElement("li");
        row.className = "chat-item";
        row.classList.toggle("is-own-message", chatMessage.uid === state.userId || chatMessage.uid === "local-preview");

        const header = document.createElement("div");
        header.className = "chat-item-header";

        const identity = document.createElement("div");
        identity.className = "chat-item-identity";

        const colorDot = document.createElement("span");
        colorDot.className = "chat-item-color";
        colorDot.style.backgroundColor = isValidColor(chatMessage.userColor) ? chatMessage.userColor : state.userColor;
        colorDot.setAttribute("aria-hidden", "true");

        const name = document.createElement("strong");
        name.textContent = chatMessage.displayName || "Wolf";
        name.style.color = isValidColor(chatMessage.userColor) ? chatMessage.userColor : state.userColor;

        const time = document.createElement("span");
        time.textContent = formatTime(chatMessage.createdAt);

        const text = document.createElement("p");
        text.textContent = chatMessage.text || "";

        identity.append(colorDot, name);
        header.append(identity, time);
        row.append(header, text);
        return row;
    }

    function loadStoredProfile() {
        const savedName = getStoredValue(PROFILE_KEYS.name);
        const savedColor = getStoredValue(PROFILE_KEYS.color);
        const savedCreatedAt = Number(getStoredValue(PROFILE_KEYS.createdAt));
        const savedUpdatedAt = Number(getStoredValue(PROFILE_KEYS.updatedAt));

        if (isValidDisplayName(savedName) && isValidColor(savedColor) && Number.isFinite(savedCreatedAt)) {
            return {
                displayName: savedName.trim(),
                userColor: savedColor,
                createdAt: savedCreatedAt,
                updatedAt: Number.isFinite(savedUpdatedAt) ? savedUpdatedAt : savedCreatedAt
            };
        }

        return null;
    }

    function loadSavedColor() {
        const savedColor = getStoredValue(PROFILE_KEYS.color);
        return isValidColor(savedColor) ? savedColor : pickUserColor();
    }

    function pickUserColor() {
        return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    }

    function saveProfile(profile) {
        setStoredValue(PROFILE_KEYS.name, profile.displayName);
        setStoredValue(PROFILE_KEYS.color, profile.userColor);
        setStoredValue(PROFILE_KEYS.createdAt, profile.createdAt);
        setStoredValue(PROFILE_KEYS.updatedAt, profile.updatedAt);
    }

    async function persistProfileToFirebase() {
        if (!hasValidProfile() || state.mode !== "firebase" || !state.firebaseBridge) return null;
        return state.firebaseBridge.createOrUpdateUserProfile(state.profile);
    }

    function updateProfileUi() {
        const hasProfile = hasValidProfile();
        const showNameSetup = !hasProfile || state.editingName;

        if (nameSetupEl) {
            nameSetupEl.classList.toggle("hidden", !showNameSetup);
        }

        if (nameInput && showNameSetup) {
            nameInput.value = hasProfile ? state.profile.displayName : "";
        }

        if (profileNameEl) {
            profileNameEl.textContent = hasProfile ? state.profile.displayName : "Choose a name";
        }

        if (colorSwatchEl) {
            colorSwatchEl.style.backgroundColor = hasProfile ? state.profile.userColor : state.userColor;
        }

        if (nameEditButton) {
            nameEditButton.classList.toggle("hidden", !hasProfile || state.editingName);
        }

        setModeHint(state.mode);
        updateSendDisabledState();
    }

    function startEditingName() {
        state.editingName = true;
        clearMessage();
        updateProfileUi();
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }

    function setSending(isSending) {
        state.sending = isSending;
        updateSendDisabledState();
        sendButton.textContent = isSending ? "Sending..." : "Send";
    }

    function setLoading(isLoading) {
        state.loading = isLoading;
        loadingEl.classList.toggle("hidden", !isLoading);
        updateSendDisabledState();
    }

    function updateSendDisabledState() {
        sendButton.disabled = state.loading || state.sending;
        if (nameSaveButton) {
            nameSaveButton.disabled = state.savingName;
            nameSaveButton.textContent = state.savingName ? "Saving..." : "Save";
        }
    }

    function setModeHint(mode, customText) {
        const hasProfile = hasValidProfile();

        if (mode === "firebase") {
            modeHintEl.textContent = hasProfile
                ? `Firebase chat connected (${CHAT_PATH}). You are ${state.profile.displayName}.`
                : `Firebase chat connected (${CHAT_PATH}). Choose a name to chat.`;
            modeHintEl.classList.add("is-ready");
            return;
        }

        const baseText = customText || "Local preview only. Firebase not connected.";
        modeHintEl.textContent = hasProfile ? `${baseText} You are ${state.profile.displayName}.` : `${baseText} Choose a name to chat.`;
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

    function cleanupChatListener() {
        if (state.unsubscribe) {
            state.unsubscribe();
            state.unsubscribe = null;
        }
    }

    function hasValidProfile() {
        return Boolean(
            state.profile &&
            isValidDisplayName(state.profile.displayName) &&
            isValidColor(state.profile.userColor) &&
            Number.isFinite(Number(state.profile.createdAt))
        );
    }

    function isRenderableMessage(chatMessage) {
        return Boolean(
            chatMessage &&
            typeof chatMessage.text === "string" &&
            chatMessage.text.trim().length > 0 &&
            chatMessage.text.length <= MAX_MESSAGE_LENGTH &&
            isValidDisplayName(chatMessage.displayName) &&
            isValidColor(chatMessage.userColor) &&
            Number.isFinite(Number(chatMessage.createdAt))
        );
    }

    function isValidDisplayName(displayName) {
        return typeof displayName === "string" && DISPLAY_NAME_PATTERN.test(displayName.trim());
    }

    function isValidColor(color) {
        return typeof color === "string" && /^#[0-9A-Fa-f]{6}$/.test(color);
    }

    function formatTime(timestamp) {
        const date = new Date(Number(timestamp));
        if (Number.isNaN(date.getTime())) return "";

        return date.toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function getStoredValue(key) {
        try {
            if (!window.localStorage) return null;
            return window.localStorage.getItem(key);
        } catch (error) {
            console.warn(`Renner Radio: could not read chat setting "${key}".`, error);
            return null;
        }
    }

    function setStoredValue(key, value) {
        try {
            if (!window.localStorage) return;
            window.localStorage.setItem(key, String(value));
        } catch (error) {
            console.warn(`Renner Radio: could not save chat setting "${key}".`, error);
        }
    }

    // V13.1: custom English display names stay local-first and sync to /userProfiles/{uid} when Firebase is ready.
    // V14+ should not depend on chat identity beyond the public displayName and userColor fields.
})();
