/* ============================================================
   MEMBERS1.JS — Public Members Page
   The BM Fitness World | Vanilla JS | Firebase Firestore v12
   ============================================================ */

import { db } from "./firebase-config.js";
import {
    collection,
    query,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* ============================================================
   CONFIGURATION
   ============================================================ */
const CONFIG = {
    headerOffset: 68,
    animationThreshold: 0.15,
    toastDuration: 4000
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

    // Internal anchors
    internalLinks: document.querySelectorAll('a[href^="#"]:not([href="#"])'),

    // Members section
    skeleton: document.getElementById('members-skeleton'),
    grid: document.getElementById('members-grid'),
    emptyState: document.getElementById('members-empty'),
    searchInput: document.getElementById('search-input'),
    filterPlan: document.getElementById('filter-plan'),

    // Body
    body: document.body,
    html: document.documentElement
};

/* ============================================================
   STATE
   ============================================================ */
let allMembers = [];
let unsubscribe = null;
let isMenuOpen = false;
let lastFocusedElement = null;

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

// Debounce
function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Format date
function formatDate(timestamp) {
    if (!timestamp) return 'Recently joined';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Format currency (USD style)
function formatCurrency(amount) {
    if (amount === undefined || amount === null || isNaN(amount)) return 'N/A';
    const num = Number(amount);
    return '৳' + num.toLocaleString('en-BD');
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
   TOAST (simple, if needed)
   ============================================================ */
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const iconMap = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle'
    };
    toast.innerHTML = `
        <span class="toast-icon"><i class="fas ${iconMap[type] || iconMap.info}"></i></span>
        <span class="toast-message">${escapeHTML(message)}</span>
        <button class="toast-close" aria-label="Dismiss">&times;</button>
    `;
    container.appendChild(toast);
    const closeBtn = toast.querySelector('.toast-close');
    const dismiss = () => {
        toast.classList.add('toast-hide');
        setTimeout(() => toast.remove(), 300);
    };
    closeBtn.addEventListener('click', dismiss);
    setTimeout(dismiss, CONFIG.toastDuration);
}


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
            if (isMenuOpen) closeMenu();
            history.pushState(null, '', href);
        }
    });
});

/* ============================================================
   FADE-UP ANIMATION (IntersectionObserver)
   ============================================================ */
function initFadeUp() {
    const elements = document.querySelectorAll('.fade-up');
    if (!elements.length) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: CONFIG.animationThreshold, rootMargin: '0px 0px -30px 0px' });
    elements.forEach(el => observer.observe(el));
}

/* ============================================================
   RENDER MEMBERS
   ============================================================ */
function renderMembers(members) {
    DOM.grid.innerHTML = '';

    if (!members || members.length === 0) {
        DOM.grid.classList.add('hidden');
        DOM.emptyState.classList.remove('hidden');
        return;
    }

    DOM.grid.classList.remove('hidden');
    DOM.emptyState.classList.add('hidden');

    // Sort by createdAt descending (newest first)
    const sorted = [...members].sort((a, b) => {
        const da = a.createdAt?.toDate?.() || new Date(0);
        const db = b.createdAt?.toDate?.() || new Date(0);
        return db - da;
    });

    const fragment = document.createDocumentFragment();
    sorted.forEach(member => {
        const card = createMemberCard(member);
        fragment.appendChild(card);
    });
    DOM.grid.appendChild(fragment);

    // Trigger fade animation on cards (CSS class .fade-up already on card?)
    // We'll add a small delay via CSS animation or JS. We'll use CSS class.
}

function createMemberCard(member) {
    const planClass = (member.plan || '').toLowerCase();
    const priceDisplay = formatCurrency(member.price);
    const joinedDate = formatDate(member.createdAt);

    const card = document.createElement('div');
    card.className = 'member-card fade-up';
    card.setAttribute('data-member-id', member.id);

    // Avatar placeholder (icon)
    const avatar = document.createElement('div');
    avatar.className = 'member-avatar';
    avatar.innerHTML = '<i class="fas fa-user"></i>';
    card.appendChild(avatar);

    // Name
    const name = document.createElement('h3');
    name.className = 'member-name';
    name.textContent = member.name || 'Anonymous';
    card.appendChild(name);

    // Plan badge
    const planBadge = document.createElement('span');
    planBadge.className = `member-plan ${planClass}`;
    planBadge.textContent = member.plan || 'No Plan';
    card.appendChild(planBadge);

    // Details
    const details = document.createElement('div');
    details.className = 'member-details';

    // Price
    const priceDetail = document.createElement('span');
    priceDetail.className = 'member-detail';
    priceDetail.innerHTML = `<i class="fas fa-dollar-sign"></i> <span class="value">${escapeHTML(priceDisplay)}</span>`;
    details.appendChild(priceDetail);

    // Duration
    const durationDetail = document.createElement('span');
    durationDetail.className = 'member-detail';
    durationDetail.innerHTML = `<i class="fas fa-clock"></i> <span class="value">${escapeHTML(member.duration || 'N/A')}</span>`;
    details.appendChild(durationDetail);

    // Joined date
    const joinedDetail = document.createElement('span');
    joinedDetail.className = 'member-detail joined';
    joinedDetail.innerHTML = `<i class="fas fa-calendar-alt"></i> ${escapeHTML(joinedDate)}`;
    details.appendChild(joinedDetail);

    card.appendChild(details);

    // Add visible class after a small delay for animation
    // But we'll rely on CSS .fade-up and IntersectionObserver on the container
    // We'll add the card to DOM and then the observer will handle.

    return card;
}

/* ============================================================
   FILTER & SEARCH
   ============================================================ */
function applyFilters() {
    const searchTerm = DOM.searchInput.value.trim().toLowerCase();
    const planFilter = DOM.filterPlan.value;

    let filtered = [...allMembers];

    // Search by name
    if (searchTerm) {
        filtered = filtered.filter(m =>
            m.name && m.name.toLowerCase().includes(searchTerm)
        );
    }

    // Filter by plan
    if (planFilter !== 'all') {
        filtered = filtered.filter(m => m.plan === planFilter);
    }

    renderMembers(filtered);
}

// Debounced search handler
const debouncedApplyFilters = debounce(applyFilters, 300);

// Event listeners
if (DOM.searchInput) {
    DOM.searchInput.addEventListener('input', debouncedApplyFilters);
}
if (DOM.filterPlan) {
    DOM.filterPlan.addEventListener('change', applyFilters);
}

/* ============================================================
   LOADING / EMPTY / ERROR STATES
   ============================================================ */
function showSkeleton() {
    DOM.grid.classList.add('hidden');
    DOM.emptyState.classList.add('hidden');
    DOM.skeleton.classList.remove('hidden');
}

function showEmpty() {
    DOM.grid.classList.add('hidden');
    DOM.emptyState.classList.remove('hidden');
    DOM.skeleton.classList.add('hidden');
}

function showGrid() {
    DOM.grid.classList.remove('hidden');
    DOM.emptyState.classList.add('hidden');
    DOM.skeleton.classList.add('hidden');
}

function showError(message) {
    DOM.grid.innerHTML = '';
    DOM.grid.classList.remove('hidden');
    DOM.emptyState.classList.add('hidden');
    DOM.skeleton.classList.add('hidden');

    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-state';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <h3>Something went wrong</h3>
        <p>${escapeHTML(message || 'Unable to load members.')}</p>
        <button class="btn btn-outline btn-sm" id="retry-btn">Retry</button>
    `;
    DOM.grid.appendChild(errorDiv);

    const retryBtn = errorDiv.querySelector('#retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            loadMembers();
        });
    }
}

/* ============================================================
   FIREBASE LOADER
   ============================================================ */
function loadMembers() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }

    showSkeleton();

    const membersRef = collection(db, 'members');
    const q = query(membersRef, orderBy('createdAt', 'desc'));

    unsubscribe = onSnapshot(q, (snapshot) => {
        allMembers = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            // Ensure we have a name; skip if missing
            if (!data.name) return;
            allMembers.push({
                id: doc.id,
                ...data
            });
        });

        // Apply filters (which will render)
        applyFilters();
        // Ensure skeleton is hidden after data loads
        DOM.skeleton.classList.add('hidden');
        if (allMembers.length === 0) {
            showEmpty();
        } else {
            showGrid();
        }
    }, (error) => {
        console.error('Error loading members:', error);
        showError('Failed to load members. Please try again.');
        showToast('Error loading members.', 'error');
        DOM.skeleton.classList.add('hidden');
    });
}

/* ============================================================
   INITIALIZATION
   ============================================================ */
function init() {
    // Fade-up animations
    initFadeUp();

    // Load members from Firestore
    loadMembers();

    console.log('Public members page initialized.');
}

// Run on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Expose for debugging (optional)
window.BM = window.BM || {};
window.BM.members = {
    reload: loadMembers
};