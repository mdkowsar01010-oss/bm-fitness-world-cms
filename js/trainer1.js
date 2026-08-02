/* ============================================================
   TRAINER1.JS — The BM Fitness World
   Loads and displays active trainers from Firebase Firestore
   ============================================================ */

import { db } from "./firebase-config.js";
import {
    collection,
    query,
    where,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* ============================================================
   DOM REFS
   ============================================================ */
const container = document.getElementById("firebase-trainer-container");

/* ============================================================
   STATE
   ============================================================ */
let unsubscribe = null;


/* ============================================================
   HELPERS
   ============================================================ */

// Escape HTML to prevent XSS
function escapeHTML(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Create a DOM element with attributes and children
function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [key, val] of Object.entries(attrs)) {
        if (key === "className") {
            el.className = val;
        } else if (key === "dataset") {
            for (const [dataKey, dataVal] of Object.entries(val)) {
                el.dataset[dataKey] = dataVal;
            }
        } else {
            el.setAttribute(key, val);
        }
    }
    children.forEach(child => {
        if (typeof child === "string") {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    });
    return el;
}

// Lazy load image using IntersectionObserver
function lazyLoadImage(img) {

    if (!img || !img.dataset.lazySrc) {
        return;
    }

    const observer = new IntersectionObserver((entries) => {

        entries.forEach(entry => {

            if (entry.isIntersecting) {

                img.src = img.dataset.lazySrc;

                observer.unobserve(img);

                img.removeAttribute("data-lazy-src");

            }

        });

    }, {
        rootMargin: "0px 0px 100px 0px"
    });

    observer.observe(img);

}


/* ============================================================
   RENDER FUNCTIONS
   ============================================================ */

// Show skeleton loading state
function showSkeleton() {
    if (!container) return;
    container.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "trainers-grid";
    for (let i = 0; i < 3; i++) {
        const card = createElement("article", { className: "trainer-card skeleton fade-up" }, [
            createElement("div", { className: "skeleton-image" }),
            createElement("div", { className: "skeleton-info" }, [
                createElement("div", { className: "skeleton-name" }),
                createElement("div", { className: "skeleton-designation" }),
                createElement("div", { className: "skeleton-experience" }),
                createElement("div", { className: "skeleton-bio" }),
                createElement("div", { className: "skeleton-social" })
            ])
        ]);
        grid.appendChild(card);
    }
    container.appendChild(grid);
}

// Show empty state
function showEmpty() {
    if (!container) return;
    container.innerHTML = "";
    const empty = createElement("div", { className: "empty-state" }, [
        createElement("i", { className: "fas fa-dumbbell" }),
        createElement("h3", {}, ["No Trainers Available"]),
        createElement("p", {}, ["We're currently updating our trainer roster. Please check back soon."])
    ]);
    container.appendChild(empty);
}

// Show error state
function showError(error) {
    if (!container) return;
    container.innerHTML = "";
    const err = createElement("div", { className: "error-state" }, [
        createElement("i", { className: "fas fa-exclamation-triangle" }),
        createElement("h3", {}, ["Failed to Load Trainers"]),
        createElement("p", {}, ["We encountered an error loading trainer profiles. Please try again later."]),
        createElement("button", { className: "btn btn-outline btn-sm", id: "retry-btn" }, ["Retry"])
    ]);
    container.appendChild(err);
    const retryBtn = err.querySelector("#retry-btn");
    if (retryBtn) {
        retryBtn.addEventListener("click", () => {
            initTrainers();
        });
    }
}

// Create a trainer card from data
function createTrainerCard(trainer) {
    // Image
    let imageEl = null;
    if (trainer.imageUrl) {
        const img = createElement("img", {
            className: "trainer-image",
            src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23121212'/%3E%3C/svg%3E",
            alt: escapeHTML(trainer.name || "Trainer"),
            loading: "lazy",
            decoding: "async",
            "data-lazy-src": trainer.imageUrl
        });
        // Handle image error
        img.addEventListener("error", () => {
            img.style.display = "none";
        });
        imageEl = img;
    }

    // Name
    const name = createElement("h3", { className: "trainer-name" }, [escapeHTML(trainer.name || "Unnamed Trainer")]);

    // Designation
    const designation = createElement("p", { className: "trainer-designation" }, [escapeHTML(trainer.designation || "")]);

    // Experience badge
    let experienceEl = null;
    if (trainer.experience) {
        experienceEl = createElement("span", { className: "trainer-experience" }, [
            createElement("i", {
className: "fas fa-award"
}),
" " + escapeHTML(trainer.experience) + " Years Experience"
        ]);
    }

    // Bio
    const bio = createElement("p", { className: "trainer-bio" }, [escapeHTML(trainer.bio || "")]);
    // Button
    const btnText = "Contact Now";
const btnLink = "join1.html";
    const btn = createElement("a", {
        href: btnLink,
        className: "btn btn-gold btn-sm"
    }, [btnText, " ", createElement("i", { className: "fas fa-arrow-right" })]);

    // Build card
    const card = createElement("article", { className: "trainer-card fade-up" });

    if (imageEl) {
        card.appendChild(imageEl);
    }

    const info = createElement("div", { className: "trainer-info" });
    info.appendChild(name);
    info.appendChild(designation);
    if (experienceEl) info.appendChild(experienceEl);
    info.appendChild(bio);

    info.appendChild(btn);

    card.appendChild(info);

    // Lazy load image after appending to DOM
if (imageEl) {
    lazyLoadImage(imageEl);
}

return card;
}

// Render trainers into container
function renderTrainers(trainers) {
    if (!container) return;

    container.innerHTML = "";

    if (!trainers || trainers.length === 0) {
        showEmpty();
        return;
    }

    const grid = document.createElement("div");
    grid.className = "trainers-grid";

    const fragment = document.createDocumentFragment();
    trainers.forEach(trainer => {
        const card = createTrainerCard(trainer);
        fragment.appendChild(card);
    });
    grid.appendChild(fragment);
    container.appendChild(grid);

    // Trigger fade-up animation after a small delay
    requestAnimationFrame(() => {
        const cards = grid.querySelectorAll(".trainer-card.fade-up");
        cards.forEach((card, index) => {
            setTimeout(() => {
                card.classList.add("visible");
            }, index * 100);
        });
    });
}

/* ============================================================
   FIRESTORE LISTENER
   ============================================================ */

function loadTrainersFromFirestore() {
    // Show skeleton initially
    showSkeleton();

    // Clean up previous listener
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }

    const trainersRef = collection(db, "trainers");
    const q = query(
        trainersRef,
        where("status", "==", "active"),
    );

    unsubscribe = onSnapshot(q, (snapshot) => {
        const trainers = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            // Skip if no name (minimum required)
            if (!data.name) return;
            trainers.push({
                id: doc.id,
                ...data
            });
        });
        renderTrainers(trainers);
    }, (error) => {
        console.warn("Error loading trainers:", error);
        showError(error);
    });
}

/* ============================================================
   INITIALIZATION
   ============================================================ */

function initTrainers() {
    // If container does not exist, exit silently
    if (!container) {
    return;
}
    loadTrainersFromFirestore();
}

function reloadTrainers() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    loadTrainersFromFirestore();
}

// Run when DOM ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTrainers);
} else {
    initTrainers();
}

/* ============================================================
   EXPOSE GLOBAL API
   ============================================================ */
window.BM = window.BM || {};
window.BM.trainers = {
    init: initTrainers,
    reload: reloadTrainers
};