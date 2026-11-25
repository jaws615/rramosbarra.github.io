document.querySelector("#copyright-year").textContent = new Date().getFullYear();

const themeToggle = document.querySelector("#theme-toggle");
const themeMeta = document.querySelector("#theme-color");

function updateThemeControl(theme) {
    const isDark = theme === "dark";
    const icon = themeToggle.querySelector("i");
    const action = isDark ? "light" : "dark";

    icon.className = `bi ${isDark ? "bi-sun-fill" : "bi-moon-stars-fill"}`;
    themeToggle.setAttribute("aria-label", `Switch to ${action} theme`);
    themeToggle.setAttribute("title", `Switch to ${action} theme`);
    themeMeta.setAttribute("content", isDark ? "#0f172a" : "#f8fafc");
}

const currentTheme = document.documentElement.dataset.theme || "dark";
updateThemeControl(currentTheme);

themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    try {
        localStorage.setItem("theme", nextTheme);
    } catch (error) {
        // The theme still applies for the current page when storage is unavailable.
    }
    updateThemeControl(nextTheme);
});

const navLinks = [...document.querySelectorAll(".navbar .nav-link")];
const sections = [...document.querySelectorAll("main section[id]")];

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
        const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (!visible) return;

        navLinks.forEach((link) => {
            link.classList.toggle("active", link.hash === `#${visible.target.id}`);
        });
    }, {
        rootMargin: "-25% 0px -65%",
        threshold: [0.1, 0.25, 0.5]
    });

    sections.forEach((section) => observer.observe(section));
}

const recruiterAssistant = document.querySelector("#recruiter-assistant");
const assistantLauncher = document.querySelector("#assistant-launcher");
const assistantPanel = document.querySelector("#assistant-panel");
const assistantClose = document.querySelector("#assistant-close");
const assistantMessages = document.querySelector("#assistant-messages");
const assistantStatus = document.querySelector("#assistant-status");
const assistantChatForm = document.querySelector("#assistant-chat-form");
const assistantQuestion = document.querySelector("#assistant-question");
const assistantSend = document.querySelector("#assistant-send");
const assistantContactToggle = document.querySelector("#assistant-contact-toggle");
const assistantContact = document.querySelector("#assistant-contact");
const assistantContactForm = document.querySelector("#assistant-contact-form");
const assistantContactStatus = document.querySelector("#assistant-contact-status");
const assistantContactSubmit = document.querySelector("#assistant-contact-submit");
const turnstileContainer = document.querySelector("#assistant-turnstile");

if (
    recruiterAssistant &&
    assistantLauncher &&
    assistantPanel &&
    assistantClose &&
    assistantMessages &&
    assistantStatus &&
    assistantChatForm &&
    assistantQuestion &&
    assistantSend &&
    assistantContactToggle &&
    assistantContact &&
    assistantContactForm &&
    assistantContactStatus &&
    assistantContactSubmit &&
    turnstileContainer
) {
    const rawApiUrl = recruiterAssistant.dataset.apiBaseUrl.trim();
    const turnstileSiteKey = recruiterAssistant.dataset.turnstileSitekey.trim();
    const chatHistory = [];
    let apiBaseUrl = "";
    let turnstileLoad = null;
    let turnstileWidgetId = null;
    let turnstileToken = "";
    let isSendingChat = false;
    let isSendingContact = false;

    try {
        const parsedApiUrl = new URL(rawApiUrl);
        const isLocalApi = ["localhost", "127.0.0.1"].includes(parsedApiUrl.hostname);
        if (parsedApiUrl.protocol === "https:" || (isLocalApi && parsedApiUrl.protocol === "http:")) {
            apiBaseUrl = parsedApiUrl.href.replace(/\/+$/, "");
        }
    } catch (error) {
        if (rawApiUrl) {
            assistantStatus.textContent = "The resume assistant URL is not configured correctly.";
        }
    }

    if (!apiBaseUrl) {
        assistantQuestion.disabled = true;
        assistantSend.disabled = true;
        if (!assistantStatus.textContent) {
            assistantStatus.textContent = "The resume assistant is not connected yet. Please use the contact links below.";
        }
        assistantContactSubmit.disabled = true;
    }

    if (!turnstileSiteKey) {
        assistantContactSubmit.disabled = true;
    }

    function setAssistantOpen(isOpen) {
        assistantPanel.hidden = !isOpen;
        assistantLauncher.setAttribute("aria-expanded", String(isOpen));
        if (isOpen) {
            assistantQuestion.focus();
        }
    }

    function addAssistantMessage(text, kind) {
        const message = document.createElement("p");
        message.className = `assistant-message assistant-message-${kind}`;
        message.textContent = text;
        assistantMessages.append(message);
        assistantMessages.scrollTop = assistantMessages.scrollHeight;
    }

    async function readApiResponse(response) {
        let payload;
        try {
            payload = await response.json();
        } catch (error) {
            if (error instanceof SyntaxError) {
                throw new Error("The server returned an invalid response. Please try again later.");
            }
            throw error;
        }

        if (!response.ok) {
            throw new Error(typeof payload.error === "string" ? payload.error : "The request could not be completed.");
        }

        return payload;
    }

    function loadTurnstileScript() {
        if (window.turnstile) return Promise.resolve();
        if (turnstileLoad) return turnstileLoad;

        turnstileLoad = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
            script.async = true;
            script.defer = true;
            script.onload = () => {
                if (window.turnstile) {
                    resolve();
                } else {
                    reject(new Error("Bot verification did not initialize."));
                }
            };
            script.onerror = () => reject(new Error("Bot verification could not be loaded."));
            document.head.append(script);
        });

        return turnstileLoad;
    }

    async function initializeTurnstile() {
        if (!turnstileSiteKey) {
            assistantContactStatus.textContent = "The contact form is not configured yet. Please email Renzo directly.";
            return;
        }

        try {
            await loadTurnstileScript();
            if (turnstileWidgetId !== null) {
                window.turnstile.reset(turnstileWidgetId);
                return;
            }

            turnstileWidgetId = window.turnstile.render(turnstileContainer, {
                sitekey: turnstileSiteKey,
                callback: (token) => {
                    turnstileToken = token;
                    assistantContactStatus.textContent = "";
                },
                "expired-callback": () => {
                    turnstileToken = "";
                    assistantContactStatus.textContent = "Bot verification expired. Please complete it again.";
                },
                "error-callback": () => {
                    turnstileToken = "";
                    assistantContactStatus.textContent = "Bot verification failed to load. Please try again.";
                }
            });
        } catch (error) {
            assistantContactStatus.textContent = error instanceof Error ? error.message : "Bot verification could not be loaded.";
        }
    }

    assistantLauncher.addEventListener("click", () => {
        setAssistantOpen(assistantPanel.hidden);
    });

    assistantClose.addEventListener("click", () => {
        setAssistantOpen(false);
        assistantLauncher.focus();
    });

    assistantContactToggle.addEventListener("click", () => {
        const isOpen = assistantContact.hidden;
        assistantContact.hidden = !isOpen;
        assistantContactToggle.setAttribute("aria-expanded", String(isOpen));
        if (isOpen) initializeTurnstile();
    });

    assistantChatForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const question = assistantQuestion.value.trim();
        if (!question || !apiBaseUrl || isSendingChat) return;

        isSendingChat = true;
        assistantSend.disabled = true;
        assistantQuestion.disabled = true;
        assistantStatus.textContent = "Checking the resume...";
        addAssistantMessage(question, "user");

        try {
            const response = await fetch(`${apiBaseUrl}/api/chat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question, history: chatHistory })
            });
            const payload = await readApiResponse(response);
            if (typeof payload.answer !== "string" || !payload.answer.trim()) {
                throw new Error("The assistant returned an empty answer. Please try again.");
            }

            const answer = payload.answer.trim();
            addAssistantMessage(answer, "bot");
            chatHistory.push(
                { role: "user", content: question },
                { role: "assistant", content: answer }
            );
            if (chatHistory.length > 12) chatHistory.splice(0, chatHistory.length - 12);
            assistantQuestion.value = "";
            assistantStatus.textContent = "Answers are based on the information provided on this site.";
        } catch (error) {
            const message = error instanceof Error ? error.message : "The request failed. Please try again.";
            addAssistantMessage(message, "error");
            assistantStatus.textContent = "If you need help, contact Renzo using the links on this page.";
        } finally {
            isSendingChat = false;
            assistantSend.disabled = !apiBaseUrl;
            assistantQuestion.disabled = !apiBaseUrl;
            assistantQuestion.focus();
        }
    });

    assistantContactForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!apiBaseUrl || !turnstileSiteKey || !turnstileToken || isSendingContact) {
            assistantContactStatus.textContent = !turnstileSiteKey
                ? "The contact form is not configured yet. Please email Renzo directly."
                : "Complete the bot verification before sending your message.";
            return;
        }

        const formData = new FormData(assistantContactForm);
        const contact = {
            name: String(formData.get("name") || "").trim(),
            email: String(formData.get("email") || "").trim(),
            message: String(formData.get("message") || "").trim(),
            consent: formData.get("consent") === "on",
            website: String(formData.get("website") || ""),
            turnstileToken
        };

        isSendingContact = true;
        assistantContactSubmit.disabled = true;
        assistantContactStatus.textContent = "Sending your contact request securely...";

        try {
            const response = await fetch(`${apiBaseUrl}/api/contact`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(contact)
            });
            const payload = await readApiResponse(response);
            if (typeof payload.message !== "string") {
                throw new Error("The server returned an invalid confirmation.");
            }

            assistantContactForm.reset();
            assistantContactStatus.textContent = payload.message;
        } catch (error) {
            assistantContactStatus.textContent = error instanceof Error
                ? error.message
                : "Your request could not be sent. Please email Renzo directly.";
        } finally {
            turnstileToken = "";
            if (window.turnstile && turnstileWidgetId !== null) {
                window.turnstile.reset(turnstileWidgetId);
            }
            isSendingContact = false;
            assistantContactSubmit.disabled = !apiBaseUrl || !turnstileSiteKey;
        }
    });
}
