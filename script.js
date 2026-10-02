/* ================================
   DOM ELEMENTS
================================ */

const galleryView = document.getElementById("galleryView");
const gallery = document.getElementById("gallery");
const galleryStatus = document.getElementById("galleryStatus");
const singleViewer = document.getElementById("singleViewer");
const singleImg = document.getElementById("singleImg");
const positionLabel = document.getElementById("positionLabel");

const artTitle = document.getElementById("artTitle");
const artArtist = document.getElementById("artArtist");
const artYearMedium = document.getElementById("artYearMedium");
const artRole = document.getElementById("artRole");
const artAffiliation = document.getElementById("artAffiliation");
const artBadge = document.getElementById("artBadge");

const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const backBtn = document.getElementById("backBtn");
const playBtn = document.getElementById("playBtn");

const infoBtn = document.getElementById("infoBtn");
const infoModal = document.getElementById("infoModal");
const modalClose = document.getElementById("modalClose");
const artworkCount = document.getElementById("artworkCount");

const searchToggle = document.getElementById("searchToggle");
const searchBar = document.getElementById("searchBar");
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");

const tagToggle = document.getElementById("tagToggle");
const filterBar = document.getElementById("filterBar");
const filterOptions = document.getElementById("filterOptions");

/* ================================
   STATE
================================ */

let images = [];          // all artworks, in the shuffled order for this page load
let visible = [];         // indices into `images` that match the current search + filters
let currentIndex = 0;     // index into `images` of the artwork in the single view
let slideshowInterval = null;
let renderToken = 0;
let galleryScrollY = 0;

let searchTerms = [];
const activeFilters = { affiliation: null, exhibition: null, medium: null };

/* ================================
   UTILITY
================================ */

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function normalize(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function affiliationGroup(affiliation) {
  if (affiliation.startsWith("Dual")) return "Dual Nebraska Medicine/UNMC";
  if (affiliation.startsWith("Nebraska Medicine")) return "Nebraska Medicine";
  if (affiliation.startsWith("UNMC")) return "UNMC";
  return "Other";
}

function isSingleOpen() {
  return !singleViewer.classList.contains("hidden");
}

/* ================================
   LOAD ARTWORK
================================ */

fetch("images.json")
  .then(res => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then(data => {
    images = data.map(item => ({
      ...item,
      affiliationGroup: affiliationGroup(item.affiliation),
      searchText: normalize(
        [item.artist, item.title, item.medium, item.role, item.affiliation, item.year].join(" ")
      ),
    }));
    shuffle(images);

    images.forEach((item, index) => {
      const button = document.createElement("button");
      button.className = "gallery-item";
      button.dataset.index = index;
      button.setAttribute("aria-label", `${item.title} by ${item.artist}`);

      const img = document.createElement("img");
      img.src = item.thumb;
      img.alt = `${item.title} by ${item.artist}`;
      img.width = item.width;
      img.height = item.height;
      img.loading = "lazy";
      img.decoding = "async";

      button.appendChild(img);
      button.addEventListener("click", () => {
        currentIndex = index;
        openSingle();
      });

      gallery.appendChild(button);
    });

    artworkCount.textContent = images.length;
    generateFilters();
    applyFilters();
  })
  .catch(err => {
    console.error("Could not load images.json", err);
    galleryStatus.textContent =
      "The artwork could not be loaded. If you opened this file directly, please view it through a web server.";
  });

/* ================================
   SEARCH + FILTER
================================ */

function matches(item) {
  if (activeFilters.affiliation && item.affiliationGroup !== activeFilters.affiliation) return false;
  if (activeFilters.exhibition && !item.inPhysicalExhibition) return false;
  if (activeFilters.medium && item.mediumCategory !== activeFilters.medium) return false;
  return searchTerms.every(term => item.searchText.includes(term));
}

function applyFilters() {
  visible = [];
  gallery.querySelectorAll(".gallery-item").forEach(el => {
    const index = Number(el.dataset.index);
    const show = matches(images[index]);
    el.hidden = !show;
    if (show) visible.push(index);
  });

  const filtering = searchTerms.length || Object.values(activeFilters).some(Boolean);
  if (!visible.length) {
    galleryStatus.textContent = "No artwork matches your search and filters.";
  } else if (filtering) {
    galleryStatus.textContent = `Showing ${visible.length} of ${images.length} artworks`;
  } else {
    galleryStatus.textContent = `2026 Staff Art Exhibition · ${images.length} artworks`;
  }

  // The result set changed, so the single view's neighbors are no longer valid.
  if (isSingleOpen()) closeSingle();
}

searchToggle.onclick = () => {
  const open = searchBar.classList.toggle("open");
  searchToggle.classList.toggle("active", open);
  searchToggle.setAttribute("aria-expanded", open);
  if (open) searchInput.focus();
};

searchInput.addEventListener("input", e => {
  searchTerms = normalize(e.target.value).split(" ").filter(Boolean);
  applyFilters();
});

searchClear.onclick = () => {
  searchInput.value = "";
  searchTerms = [];
  applyFilters();
  searchInput.focus();
};

tagToggle.onclick = () => {
  const open = filterBar.classList.toggle("open");
  tagToggle.classList.toggle("active", open);
  tagToggle.setAttribute("aria-expanded", open);
};

function generateFilters() {
  const groups = [
    {
      key: "affiliation",
      label: "Affiliation",
      values: ["UNMC", "Nebraska Medicine", "Dual Nebraska Medicine/UNMC"],
      count: value => images.filter(i => i.affiliationGroup === value).length,
    },
    {
      key: "exhibition",
      label: "Exhibition",
      values: ["On view at BCC"],
      count: () => images.filter(i => i.inPhysicalExhibition).length,
    },
    {
      key: "medium",
      label: "Medium",
      values: [
        "Photography", "Painting", "Drawing", "Mixed Media / Collage",
        "Fiber / Textile", "Glass", "Digital", "Sculpture / 3D", "Other",
      ],
      count: value => images.filter(i => i.mediumCategory === value).length,
    },
  ];

  groups.forEach(group => {
    const row = document.createElement("div");
    row.className = "filter-group";

    const label = document.createElement("span");
    label.className = "filter-group-label";
    label.textContent = group.label;
    row.appendChild(label);

    group.values.forEach(value => {
      const count = group.count(value);
      if (!count) return;

      const btn = document.createElement("button");
      btn.className = "filter-btn";
      btn.dataset.group = group.key;
      btn.textContent = `${value} (${count})`;
      btn.setAttribute("aria-pressed", "false");

      btn.onclick = () => {
        const isActive = activeFilters[group.key] === value;
        activeFilters[group.key] = isActive ? null : value;

        row.querySelectorAll(".filter-btn").forEach(b => {
          b.classList.remove("active");
          b.setAttribute("aria-pressed", "false");
        });
        if (!isActive) {
          btn.classList.add("active");
          btn.setAttribute("aria-pressed", "true");
        }
        applyFilters();
      };

      row.appendChild(btn);
    });

    filterOptions.appendChild(row);
  });

  const clearBtn = document.createElement("button");
  clearBtn.className = "filter-clear";
  clearBtn.textContent = "Clear filters";
  clearBtn.onclick = () => {
    Object.keys(activeFilters).forEach(k => (activeFilters[k] = null));
    filterOptions.querySelectorAll(".filter-btn").forEach(b => {
      b.classList.remove("active");
      b.setAttribute("aria-pressed", "false");
    });
    applyFilters();
  };
  filterOptions.appendChild(clearBtn);
}

/* ================================
   VIEW CONTROLS
================================ */

function openSingle() {
  galleryScrollY = window.scrollY;
  galleryView.classList.add("hidden");
  singleViewer.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "instant" });
  showSingle();
}

function closeSingle() {
  stopSlideshow();
  renderToken++;
  singleViewer.classList.add("hidden");
  galleryView.classList.remove("hidden");
  window.scrollTo({ top: galleryScrollY, behavior: "instant" });

  const item = gallery.querySelector(`.gallery-item[data-index="${currentIndex}"]`);
  if (item && !item.hidden) item.focus({ preventScroll: true });
}

function setText(el, text) {
  el.textContent = text || "";
  el.classList.toggle("hidden", !text);
}

function showSingle() {
  const art = images[currentIndex];
  const token = ++renderToken;

  singleImg.classList.add("fade-out");

  setTimeout(() => {
    if (token !== renderToken) return;

    const reveal = () => {
      if (token === renderToken) singleImg.classList.remove("fade-out");
    };

    if (singleImg.getAttribute("src") === art.image) {
      reveal();
    } else {
      singleImg.onload = reveal;
      singleImg.onerror = reveal;
      singleImg.width = art.width;
      singleImg.height = art.height;
      singleImg.src = art.image;
    }
    singleImg.alt = `${art.title} by ${art.artist}`;

    setText(artTitle, art.title);
    setText(artArtist, art.artist);
    setText(artYearMedium, [art.year, art.medium].filter(Boolean).join(" · "));
    setText(artRole, art.role);
    setText(artAffiliation, art.affiliation);
    artBadge.classList.toggle("hidden", !art.inPhysicalExhibition);

    const pos = visible.indexOf(currentIndex);
    positionLabel.textContent = pos >= 0 ? `${pos + 1} of ${visible.length}` : "";
  }, 200);

  const next = neighbor(1);
  if (next !== currentIndex) {
    const preload = new Image();
    preload.src = images[next].image;
  }
}

// Step through the visible (searched/filtered) artworks, wrapping at the ends.
function neighbor(step) {
  if (!visible.length) return currentIndex;
  const pos = visible.indexOf(currentIndex);
  if (pos === -1) return visible[0];
  return visible[(pos + step + visible.length) % visible.length];
}

function showNext() {
  currentIndex = neighbor(1);
  showSingle();
}

function showPrev() {
  currentIndex = neighbor(-1);
  showSingle();
}

backBtn.onclick = closeSingle;
nextBtn.onclick = showNext;
prevBtn.onclick = showPrev;

/* ================================
   KEYBOARD NAVIGATION
================================ */

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (infoModal.classList.contains("open")) {
      infoModal.classList.remove("open");
    } else if (isSingleOpen()) {
      closeSingle();
    }
    return;
  }

  if (!isSingleOpen() || infoModal.classList.contains("open")) return;
  if (e.target.matches("input, textarea")) return;

  if (e.key === "ArrowRight") showNext();
  if (e.key === "ArrowLeft") showPrev();
});

/* ================================
   SLIDESHOW
================================ */

function stopSlideshow() {
  clearInterval(slideshowInterval);
  slideshowInterval = null;
  playBtn.classList.remove("playing");
  playBtn.textContent = "Play Slideshow";
}

playBtn.onclick = () => {
  if (playBtn.classList.contains("playing")) {
    stopSlideshow();
  } else {
    slideshowInterval = setInterval(showNext, 5000);
    playBtn.classList.add("playing");
    playBtn.textContent = "Pause Slideshow";
  }
};

/* ================================
   INFO MODAL
================================ */

infoBtn.onclick = () => infoModal.classList.add("open");

modalClose.onclick = () => infoModal.classList.remove("open");

infoModal.addEventListener("click", e => {
  if (e.target === infoModal) {
    infoModal.classList.remove("open");
  }
});
