const yearElement = document.querySelector("#year");

if (yearElement) {
  yearElement.textContent = new Date().getFullYear();
}

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

const betaForms = document.querySelectorAll("[data-beta-form]");

betaForms.forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const formData = new FormData(form);
    const name = formData.get("name");
    const email = formData.get("email");
    const role = formData.get("role");
    const interest = formData.get("interest") || "No notes added.";
    const status = form.querySelector("[data-beta-status]");
    const subject = encodeURIComponent("20Realms beta waitlist request");
    const body = encodeURIComponent([
      "I would like to join the 20Realms beta waitlist.",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Role: ${role}`,
      "",
      "What I want to test:",
      interest
    ].join("\n"));

    if (status) {
      status.textContent = "Opening your email app with a prefilled beta request.";
    }

    window.location.href = `mailto:support@20realms.com?subject=${subject}&body=${body}`;
  });
});

