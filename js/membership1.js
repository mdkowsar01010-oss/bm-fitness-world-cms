/* ============================================================
   MEMBERSHIP1.JS — The BM Fitness World
   Membership Page | Firebase Firestore v12 | Vanilla JS
   ============================================================ */
import { db } from "./firebase-config.js";
import {
    collection,
    query,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* ============================================================
   CONFIGURATION
   ============================================================ */
const CONFIG = {
    headerOffset: 68,
    skeletonCount: 3,
    animationThreshold: 0.15
};

/* ============================================================
   DOM CACHE
   ============================================================ */
const DOM = {
    // Menu
    menuToggle: document.getElementById('menuToggle'),
    menuOverlay: document.getElementById('menuOverlay'),
    slideMenu: document.getElementById('slideMenu'),
    menuClose: document.getElementById('menuClose'),
    bottomMenuTrigger: document.getElementById('bottomMenuTrigger'),
    menuNavLinks: document.querySelectorAll('.menu-nav a'),

    // Container
    membershipContainer: document.getElementById('firebase-membership-container'),

    // Internal anchors (smooth scroll)
    internalLinks: document.querySelectorAll('a[href^="#"]:not([href="#"])'),

    // Body
    body: document.body,
    html: document.documentElement
};

/* ============================================================
   HELPERS
   ============================================================ */

// Escape HTML to prevent XSS
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Create DOM element with attributes and children
function createElement(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    Object.keys(attrs).forEach(key => {
        if (key === 'className') {
            el.className = attrs[key];
        } else if (key === 'dataset') {
            Object.keys(attrs.dataset).forEach(dataKey => {
                el.dataset[dataKey] = attrs.dataset[dataKey];
            });
        } else {
            el.setAttribute(key, attrs[key]);
        }
    });
    children.forEach(child => {
        if (typeof child === 'string') {
            el.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            el.appendChild(child);
        }
    });
    return el;
}

// Lock/unlock body scroll
function lockBodyScroll() {
    const scrollbarWidth = window.innerWidth - DOM.html.clientWidth;
    DOM.body.style.overflow = 'hidden';
    DOM.body.style.paddingRight = scrollbarWidth + 'px';
}

function unlockBodyScroll() {
    DOM.body.style.overflow = '';
    DOM.body.style.paddingRight = '';
}

// Smooth scroll to target
function scrollToTarget(target) {
    const element = typeof target === 'string' ? document.querySelector(target) : target;
    if (!element) return;
    const top = element.getBoundingClientRect().top + window.pageYOffset - CONFIG.headerOffset;
    window.scrollTo({ top, behavior: 'smooth' });
}

/* ============================================================
   MENU
   ============================================================ */
let isMenuOpen = false;
let lastFocusedElement = null;

function openMenu() {
    if (isMenuOpen) return;
    isMenuOpen = true;
    lastFocusedElement = document.activeElement;
    DOM.menuOverlay.classList.add('active');
    DOM.slideMenu.classList.add('active');
    DOM.menuToggle.setAttribute('aria-expanded', 'true');
    DOM.slideMenu.setAttribute('aria-hidden', 'false');
    lockBodyScroll();
    // Focus trap: focus first menu item
    const firstLink = DOM.slideMenu.querySelector('.menu-nav a');
    if (firstLink) {
        setTimeout(() => firstLink.focus(), 100);
    }
}

function closeMenu() {
    if (!isMenuOpen) return;
    isMenuOpen = false;
    DOM.menuOverlay.classList.remove('active');
    DOM.slideMenu.classList.remove('active');
    DOM.menuToggle.setAttribute('aria-expanded', 'false');
    DOM.slideMenu.setAttribute('aria-hidden', 'true');
    unlockBodyScroll();
    if (lastFocusedElement) {
        lastFocusedElement.focus();
        lastFocusedElement = null;
    } else {
        DOM.menuToggle.focus();
    }
}

function toggleMenu() {
    isMenuOpen ? closeMenu() : openMenu();
}

// Menu event listeners
if (DOM.menuToggle) {
    DOM.menuToggle.addEventListener('click', toggleMenu);
}
if (DOM.bottomMenuTrigger) {
    DOM.bottomMenuTrigger.addEventListener('click', toggleMenu);
}
if (DOM.menuClose) {
    DOM.menuClose.addEventListener('click', closeMenu);
}
if (DOM.menuOverlay) {
    DOM.menuOverlay.addEventListener('click', closeMenu);
}

// ESC key closes menu
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isMenuOpen) {
        closeMenu();
    }
});

// Focus trap inside menu
if (DOM.slideMenu) {
    DOM.slideMenu.addEventListener('keydown', (e) => {
        if (!isMenuOpen) return;
        const focusable = DOM.slideMenu.querySelectorAll('a, button, [tabindex="0"]');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.key === 'Tab') {
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });
}

// Close menu when menu link is clicked
DOM.menuNavLinks.forEach(link => {
    link.addEventListener('click', closeMenu);
});

/* ============================================================
   SMOOTH SCROLL FOR INTERNAL ANCHORS
   ============================================================ */
DOM.internalLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (!href || href === '#') return;
        const targetId = href.substring(1);
        const target = document.getElementById(targetId);
        if (target) {
            e.preventDefault();
            scrollToTarget(target);
            // Close menu if open
            if (isMenuOpen) closeMenu();
            // Update URL without jumping
            history.pushState(null, '', href);
        }
    });
});

// Handle "View Plans" button in hero (it's an anchor to #plans)
// The hero button already has href="#plans", so it's covered by internalLinks.

/* ============================================================
   LOADING / EMPTY / ERROR STATES
   ============================================================ */
function showSkeleton(container) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < CONFIG.skeletonCount; i++) {
        const skeleton = createElement('div', { className: 'plan-card skeleton' }, [
            createElement('div', { className: 'skeleton-badge' }),
            createElement('div', { className: 'skeleton-price' }),
            createElement('div', { className: 'skeleton-duration' }),
            createElement('div', { className: 'skeleton-features' }),
            createElement('div', { className: 'skeleton-btn' })
        ]);
        container.appendChild(skeleton);
    }
}

function showEmpty(container) {
    if (!container) return;
    container.innerHTML = '';
    const empty = createElement('div', { className: 'empty-state' }, [
        createElement('i', { className: 'fas fa-crown' }),
        createElement('h3', {}, ['No Membership Plans Available']),
        createElement('p', {}, ['We\'re currently updating our plans. Please check back soon.'])
    ]);
    container.appendChild(empty);
}

function showError(container, retryFn) {
    if (!container) return;
    container.innerHTML = '';
    const error = createElement('div', { className: 'error-state' }, [
        createElement('i', { className: 'fas fa-exclamation-triangle' }),
        createElement('h3', {}, ['Failed to Load Plans']),
        createElement('p', {}, ['We encountered an error loading membership plans. Please try again later.']),
        createElement('button', { className: 'btn btn-outline btn-sm', className: "btn btn-outline btn-sm retry-btn" }, ['Retry'])
    ]);
    container.appendChild(error);
    const retryBtn = error.querySelector('.retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', retryFn);
    }
}

/* ============================================================
   RENDER MEMBERSHIP CARDS
   ============================================================ */
function createMembershipCard(plan) {

    const card = createElement("div", {
        className: "plan-card"
    });

    /* -----------------------------
       Plan Title
    ----------------------------- */
    const title = createElement("div", {
        className: "plan-badge"
    }, [
        escapeHTML(plan.planType || "Membership Plan")
    ]);

    card.appendChild(title);

    /* -----------------------------
       Description / Features
    ----------------------------- */

    if (plan.description) {

        const featureList = createElement("ul", {
            className: "plan-features"
        });

         const features = String(plan.description)
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);

        features.forEach(feature => {

            const li = createElement("li", {}, [

                createElement("i", {
                    className: "fas fa-check gold-text"
                }),

                " " + escapeHTML(feature)

            ]);

            featureList.appendChild(li);

        });

        card.appendChild(featureList);

    }

    /* -----------------------------
       Price Table
    ----------------------------- */

    const priceBox = createElement("div", {
        className: "plan-price-table"
    });

    const prices = [

        {
            label: "1 Month",
            value: plan.oneMonth
        },

        {
            label: "3 Months",
            value: plan.threeMonth
        },

        {
            label: "6 Months",
            value: plan.sixMonth
        },

        {
            label: "12 Months",
            value: plan.twelveMonth
        }

    ];

    prices.forEach(item => {

        if (item.value !== undefined && item.value !== null && item.value !== "") {

            const row = createElement("div", {
                className: "price-row"
            }, [

                createElement("span", {
                    className: "price-label"
                }, [
                    item.label
                ]),

                createElement("span", {
                    className: "price-value gold-text"
                }, [
                    "৳ " + item.value
                ])

            ]);

            priceBox.appendChild(row);

        }

    });

    card.appendChild(priceBox);

    /* -----------------------------
       Join Button
    ----------------------------- */

    const btn = createElement("a", {

        href: "join1.html",

        className: "btn btn-gold btn-sm"

    }, [

        "Join Now ",

        createElement("i", {
            className: "fas fa-arrow-right"
        })

    ]);

    card.appendChild(btn);

    return card;

}




function renderMemberships(container, plans) {

    container.innerHTML = "";

    plans.forEach(plan => {

        const card = createMembershipCard(plan);

        container.appendChild(card);

    });

}

/* ============================================================
   FIREBASE LOADER
   ============================================================ */

async function loadMemberships() {

    const container = DOM.membershipContainer;

    if (!container) return;

    showSkeleton(container);

    try {

        const q = query(
            collection(db, "membershipPlans")
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            showEmpty(container);
            return;
        }

        const plans = [];

        snapshot.forEach(doc => {

            plans.push({
                id: doc.id,
                ...doc.data()
            });

        });

        renderMemberships(container, plans);

    } catch (error) {

        console.error(error);

        showError(container, loadMemberships);

    }

}

/* ============================================================
   ANIMATIONS (IntersectionObserver for fade-up)
   ============================================================ */
function initCardAnimations() {
    // After cards are rendered, observe them for fade-up
    // We'll rely on the render function to add 'visible' class.
    // But we also want to observe newly added cards.
    // We'll set up an observer on the container to watch for children.
    const container = DOM.membershipContainer;
    if (!container) return;

    const observer = new MutationObserver(() => {
        // Check if any cards are added and not yet visible
        const cards = container.querySelectorAll('.plan-card:not(.visible)');
        cards.forEach((card, index) => {
            // Use IntersectionObserver for each card
            const io = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        card.classList.add('visible');
                        io.unobserve(card);
                    }
                });
            }, { threshold: CONFIG.animationThreshold });
            io.observe(card);
        });
    });

    observer.observe(container, { childList: true, subtree: true });
}

/* ============================================================
   INITIALIZATION
   ============================================================ */
function init() {
    // Load memberships
    loadMemberships();

    // Set up animation observer for cards
    initCardAnimations();

    console.log('Membership page initialized.');
}

// Run when DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}