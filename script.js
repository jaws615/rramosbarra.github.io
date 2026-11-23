document.querySelector("#copyright-year").textContent = new Date().getFullYear();

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
