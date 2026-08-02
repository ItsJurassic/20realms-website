const yearElement = document.querySelector("#year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

const socialLinks = document.querySelectorAll('.social-links a[href^="http"], .footer-links a[href^="http"]');
const NEW_INSTAGRAM_URL = "https://www.instagram.com/20realmsocials?igsh=NWd5NDNjMnJ6aDRl";
const YOUTUBE_URL = "https://www.youtube.com/@20Realms-r6k";

socialLinks.forEach((link) => {
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  if (link.getAttribute("aria-label") === "Instagram" || link.href.includes("instagram.com/20_realms")) {
    link.href = NEW_INSTAGRAM_URL;
  }
});

document.querySelectorAll(".social-links").forEach((socialList) => {
  const hasYoutube = socialList.querySelector('a[aria-label="YouTube"]');
  if (hasYoutube) {
    return;
  }

  const youtubeLink = document.createElement("a");
  youtubeLink.href = YOUTUBE_URL;
  youtubeLink.setAttribute("target", "_blank");
  youtubeLink.setAttribute("rel", "noopener noreferrer");
  youtubeLink.setAttribute("aria-label", "YouTube");
  youtubeLink.innerHTML = '<span class="sr-only">YouTube</span><svg class="social-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 7.2c-.3-1.2-1.2-2.1-2.4-2.4C18.9 4.2 12 4.2 12 4.2s-6.9 0-9.1.6C1.7 5.1.8 6 .5 7.2 0 9.4 0 12 0 12s0 2.6.5 4.8c.3 1.2 1.2 2.1 2.4 2.4 2.2.6 9.1.6 9.1.6s6.9 0 9.1-.6c1.2-.3 2.1-1.2 2.4-2.4.5-2.2.5-4.8.5-4.8s0-2.6-.5-4.8zM9.8 15.3V8.7L15.8 12l-6 3.3z"/></svg>';
  socialList.appendChild(youtubeLink);
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

