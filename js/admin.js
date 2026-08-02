// js/admin.js
import { auth } from './firebase-config.js';
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// ============================================================
// 1. DOM Cache & Helpers
// ============================================================

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const addClass = (el, cls) => el.classList.add(cls);
const removeClass = (el, cls) => el.classList.remove(cls);
const toggleClass = (el, cls) => el.classList.toggle(cls);
const hasClass = (el, cls) => el.classList.contains(cls);
function navigate(page) {
    document.querySelectorAll('.page').forEach(section => {
        section.hidden = true;
    });

    const current = document.getElementById(page);

    if (current) {
        current.hidden = false;
    }
}
const isMobile = () => window.innerWidth < 768;

// ============================================================
// 2. Toast / Message Helpers (reusable)
// ============================================================

function showToast(message, type = 'info') {
    // Simple console fallback – can be extended later
    console.log(`[${type.toUpperCase()}] ${message}`);
    // For future UI toast, we could append a div, but not required now.
}

function showSuccess(msg) { showToast(msg, 'success'); }
function showError(msg)   { showToast(msg, 'error'); }
function showInfo(msg)    { showToast(msg, 'info'); }

// ============================================================
// 3. Loading Helpers (future use)
// ============================================================

function showLoading() {
    // Example: could show a global spinner overlay
    document.body.classList.add('loading-active');
}

function hideLoading() {
    document.body.classList.remove('loading-active');
}

// ============================================================
// 4. Authentication Check
// ============================================================

function checkAuth() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, (user) => {
            if (!user) {
                window.location.href = 'login.html';
                return;
            }
            resolve(user);
        });
    });
}

// ============================================================
// 5. User Info Display
// ============================================================

function setUserInfo(user) {
    const greeting = document.querySelector('.admin-header__greeting');
    if (greeting) {
        greeting.textContent = user.email || 'Admin';
    }
}

// ============================================================
// 6. Logout Function
// ============================================================

async function handleLogout() {
    try {
        await signOut(auth);
        window.location.href = 'login.html';
    } catch (error) {
        showError('Logout failed: ' + error.message);
    }
}

// ============================================================
// 7. Sidebar Logic (Desktop Collapse + Mobile Slide)
// ============================================================

const sidebar = document.getElementById('admin-sidebar');
const toggleBtn = document.getElementById('sidebar-toggle');
let isDesktop = window.innerWidth >= 768;

function updateSidebarMode() {
    isDesktop = window.innerWidth >= 768;

    const sidebarState = localStorage.getItem('sidebar');

    // Remove both classes and reapply based on mode
    document.body.classList.remove('sidebar-collapsed', 'sidebar-open');

    if (isDesktop) {

        if (sidebarState === 'collapsed') {
            addClass(document.body, 'sidebar-collapsed');
        }

        removeClass(document.body, 'sidebar-open');

    } else {

        removeClass(document.body, 'sidebar-collapsed');

        if (hasClass(document.body, 'sidebar-open')) {
            removeClass(document.body, 'sidebar-open');
        }
    }
}

function toggleSidebar() {
    if (isDesktop) {
        // Desktop: toggle collapse
        toggleClass(document.body, 'sidebar-collapsed');
        localStorage.setItem(
    'sidebar',
    hasClass(document.body, 'sidebar-collapsed') ? 'collapsed' : 'expanded'
);
        // Ensure aria-expanded
        const isCollapsed = hasClass(document.body, 'sidebar-collapsed');
        toggleBtn.setAttribute('aria-expanded', !isCollapsed);
    } else {
        // Mobile: slide in/out
        toggleClass(document.body, 'sidebar-open');
        const isOpen = hasClass(document.body, 'sidebar-open');
        toggleBtn.setAttribute('aria-expanded', isOpen);
    }
}

function closeSidebar() {
    if (isDesktop) {
        // On desktop, we might not want to auto-close; but we can collapse if desired?
        // We'll only collapse if it's open (not collapsed) => collapse it.
        if (!hasClass(document.body, 'sidebar-collapsed')) {
            addClass(document.body, 'sidebar-collapsed');
            toggleBtn.setAttribute('aria-expanded', 'false');
        }
    } else {
        if (hasClass(document.body, 'sidebar-open')) {
            removeClass(document.body, 'sidebar-open');
            toggleBtn.setAttribute('aria-expanded', 'false');
        }
    }
}

// Click outside (on main content)
function setupOutsideClick() {
    document.addEventListener('click', (e) => {
        const target = e.target;
        const isSidebar = sidebar.contains(target);
        const isToggle = toggleBtn.contains(target);
        if (!isSidebar && !isToggle) {
            if (!isDesktop && hasClass(document.body, 'sidebar-open')) {
                closeSidebar();
            } else if (isDesktop && !hasClass(document.body, 'sidebar-collapsed')) {
                // Optionally, we could collapse on outside click, but we'll leave it as is.
                // For better UX, we might collapse only if clicked outside.
                // But we'll keep it optional: we'll only close on mobile.
                // For desktop, we could collapse, but might be annoying. We'll skip.
            }
        }
    });
}

// ESC key
function setupEscape() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (!isDesktop && hasClass(document.body, 'sidebar-open')) {
                closeSidebar();
            } else if (isDesktop && !hasClass(document.body, 'sidebar-collapsed')) {
                // Optionally collapse on ESC? We'll collapse.
                closeSidebar();
            }
        }
    });
}

// ============================================================
// 8. Active Navigation Highlight
// ============================================================

function setupNavigation() {
    const links = $$('.admin-sidebar__link');
    // Remove active from all
    const removeActive = () => {
        links.forEach(link => {
            removeClass(link, 'admin-sidebar__link--active');
            link.removeAttribute('aria-current');
        });
    };
    // Add active based on current URL hash or click
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            // Prevent default for demo (no actual navigation)
            e.preventDefault();
            removeActive();
            addClass(this, 'admin-sidebar__link--active');
            this.setAttribute('aria-current', 'page');
            // Close sidebar on mobile after click
            if (!isDesktop && hasClass(document.body, 'sidebar-open')) {
                closeSidebar();
            }
        });
    });
    // Set default active (Dashboard) – we'll use the first link or the one with active class already
    const activeLink = document.querySelector('.admin-sidebar__link--active');
    if (activeLink) {
        // keep
    } else {
        const first = links[0];
        if (first) {
            addClass(first, 'admin-sidebar__link--active');
            first.setAttribute('aria-current', 'page');
        }
    }
}

// ============================================================
// 9. Responsive – debounced resize
// ============================================================

let resizeTimer;
function setupResponsive() {
    const handleResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            updateSidebarMode();
        }, 200);
    };
    window.addEventListener('resize', handleResize);
    // Initial call
    updateSidebarMode();
}

// ============================================================
// 10. Accessibility – ARIA for toggle
// ============================================================

function setupAccessibility() {
    // Set initial aria-expanded
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-expanded', 'true');
        // On desktop, expanded means not collapsed, on mobile expanded means sidebar open.
        // We'll handle in toggle/update.
    }
    // Ensure sidebar has aria-label
    if (sidebar) {
        sidebar.setAttribute('aria-label', 'Admin Navigation');
    }
    // Focus management: when sidebar opens, focus first link?
    // Not required, but we can add.
}

// ============================================================
// 11. Logout buttons
// ============================================================

function setupLogout() {
    const logoutLink = document.getElementById('logout-link');
    const logoutCardBtn = document.getElementById('logout-card-btn');
    const logoutHandler = (e) => {
        e.preventDefault();
        handleLogout();
    };
    if (logoutLink) logoutLink.addEventListener('click', logoutHandler);
    if (logoutCardBtn) logoutCardBtn.addEventListener('click', logoutHandler);
}

// ============================================================
// 12. Future Module Placeholders (initialization functions)
// ============================================================

function initGallery() {
        // Gallery Module Initialized
}

function initTrainers() {
    // Trainers Module Initialized
}

function initMembership() {
    // Membership Module Initialized
}

function initReviews() {
     // Reviews Module Initialized
}

function initSettings() {
       // Settings Module Initialized
}

function initDashboardStats() {
    // Dashboard Statistics Initialized
}

// ============================================================
// 13. Main Init
// ============================================================

async function init() {
    try {
        // 1. Check auth – redirect if not logged in
        const user = await checkAuth();
        
        // 2. Display user info
        setUserInfo(user);
        
        // 3. Setup sidebar
        setupSidebar();
        
        // 4. Setup logout
        setupLogout();
        
        // 5. Setup navigation active state
        setupNavigation();
        
        // 6. Setup responsive
        setupResponsive();
        
        // 7. Setup accessibility
        setupAccessibility();
        
        // 8. Setup outside click / ESC
        setupOutsideClick();
        setupEscape();
        
        // 9. Initialize future modules
        initGallery();
        initTrainers();
        initMembership();
        initReviews();
        initSettings();
        initDashboardStats();
        
        // 10. Show success
        showSuccess('Dashboard loaded successfully');
        
    } catch (error) {
        showError('Initialization error: ' + error.message);
    }
}

// ============================================================
// 14. Sidebar setup (toggle event)
// ============================================================

function setupSidebar() {
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleSidebar);
    }
}

// ============================================================
// 15. Start when DOM ready
// ============================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}