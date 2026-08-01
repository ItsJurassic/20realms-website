const yearElement = document.querySelector("#year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

const socialLinks = document.querySelectorAll('.social-links a[href^="http"], .footer-links a[href^="http"]');

socialLinks.forEach((link) => {
  link.target = "_blank";
  link.rel = "noopener noreferrer";
});

const updateTabs = document.querySelectorAll("[data-update-filter]");
const updateCards = document.querySelectorAll("[data-update-type]");

updateTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const filter = tab.dataset.updateFilter;

    updateTabs.forEach((item) => {
      const isActive = item === tab;
      item.classList.toggle("active", isActive);
      item.setAttribute("aria-pressed", String(isActive));
    });

    updateCards.forEach((card) => {
      const shouldShow = filter === "all" || card.dataset.updateType === filter;
      card.classList.toggle("is-hidden", !shouldShow);
    });
  });
});

