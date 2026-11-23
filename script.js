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
