/* ============================================================
   SCRIPT.JS — The BM Fitness World
   Global JavaScript | Vanilla ES Modules | Firebase v12
   ============================================================ */

import { db } from "./firebase-config.js";
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    addDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* ============================================================
   CONFIGURATION
   ============================================================ */
const CONFIG = {
    headerOffset: 68,
    animationThreshold: 0.15,
    skeletonCount: 3,
    galleryLimit: 1000,
    reviewLimit: 1000,

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

    // Sections & anchors
    internalLinks: document.querySelectorAll('a[href^="#"]:not([href="#"])'),

    // Animations
    fadeElements: document.querySelectorAll('.fade-up'),
    statNumbers: document.querySelectorAll('.stat-number'),

    // Firebase containers
    galleryContainer: document.getElementById('firebase-gallery-home'),
    reviewContainer: document.getElementById('firebase-review-home'),

    // Review form
    reviewForm: document.getElementById('review-form'),
    reviewName: document.getElementById('review-name'),
    reviewText: document.getElementById('review-text'),
    reviewSubmit: document.getElementById('review-submit'),
    ratingStars: document.querySelectorAll('.star-input'),

    // Body
    body: document.body,
    html: document.documentElement,
    
    popup: document.getElementById("galleryPopup"),
popupImage: document.getElementById("popupImage"),
popupVideo: document.getElementById("popupVideo"),
popupTitle: document.getElementById("popupTitle"),
popupDescription: document.getElementById("popupDescription"),
popupClose: document.getElementById("galleryClose"),

};

/* ============================================================
   HELPERS
   ============================================================ */

// Debounce
function debounce(fn, delay = 250) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

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

function closeGalleryPopup() {

    if (!DOM.popup) return;

    DOM.popup.classList.remove("active");

    if (DOM.popupImage) {
        DOM.popupImage.src = "";
        DOM.popupImage.style.display = "none";
    }

    if (DOM.popupVideo) {
        DOM.popupVideo.pause();
        DOM.popupVideo.currentTime = 0;
        DOM.popupVideo.removeAttribute("src");
        DOM.popupVideo.load();
        DOM.popupVideo.style.display = "none";
    }

    if (DOM.popupTitle) DOM.popupTitle.textContent = "";
    if (DOM.popupDescription) DOM.popupDescription.textContent = "";

    unlockBodyScroll();
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
    if (
    e.key === "Escape" &&
    DOM.popup &&
    DOM.popup.classList.contains("active")
) {
    closeGalleryPopup();
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

/* ============================================================
   FADE-UP ANIMATION
   ============================================================ */
function initFadeUp() {
    if (!DOM.fadeElements.length) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: CONFIG.animationThreshold, rootMargin: '0px 0px -30px 0px' });
    DOM.fadeElements.forEach(el => observer.observe(el));
}

/* ============================================================
   COUNTER ANIMATION
   ============================================================ */
function initCounters() {
    if (!DOM.statNumbers.length) return;
    let animated = false;
    const observer = new IntersectionObserver((entries) => {
        if (animated) {
            observer.disconnect();
            return;
        }
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animated = true;
                animateCounters();
                observer.disconnect();
            }
        });
    }, { threshold: 0.5 });
    DOM.statNumbers.forEach(counter => observer.observe(counter));
}

function animateCounters() {
    DOM.statNumbers.forEach(counter => {
        const target = parseInt(counter.getAttribute('data-count'), 10);
        if (isNaN(target) || target <= 0) return;
        animateCounter(counter, target);
    });
}

function animateCounter(element, target) {
    const duration = 1500;
    const startTime = performance.now();
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(eased * target);
        element.textContent = current + (target > 100 ? '+' : '');
        if (progress < 1) {
            requestAnimationFrame(update);
        } else {
            element.textContent = target + (target > 100 ? '+' : '');
        }
    }
    requestAnimationFrame(update);
}

/* ============================================================
   FIREBASE LOADERS (Homepage)
   ============================================================ */

// Helper: Show skeleton inside container
function showSkeleton(container, count = CONFIG.skeletonCount) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const skeleton = createElement('div', { className: 'skeleton-card' });
        // Add skeleton child elements based on container type? We'll just add generic skeleton.
        // For membership/trainer/gallery we have different skeleton shapes.
        // We'll use generic class and let CSS handle.
        skeleton.innerHTML = `
            <div class="skeleton-image"></div>
            <div class="skeleton-content">
                <div class="skeleton-title"></div>
                <div class="skeleton-text"></div>
                <div class="skeleton-text"></div>
            </div>
        `;
        container.appendChild(skeleton);
    }
}

// Helper: Show empty state
function showEmpty(container, message = 'No items found.') {
    if (!container) return;
    container.innerHTML = '';
    const empty = createElement('div', { className: 'empty-state' }, [
        createElement('i', { className: 'fas fa-inbox' }),
        createElement('h3', {}, ['Nothing to show']),
        createElement('p', {}, [message])
    ]);
    container.appendChild(empty);
}

// Helper: Show error state with retry
function showError(container, retryFn) {
    if (!container) return;
    container.innerHTML = '';

    const error = createElement('div', { className: 'error-state' }, [
        createElement('i', { className: 'fas fa-exclamation-triangle' }),
        createElement('h3', {}, ['Something went wrong']),
        createElement('p', {}, ['Failed to load content.']),
        createElement('button', { className: 'btn btn-outline btn-sm retry-btn' }, ['Retry'])
    ]);

    container.appendChild(error);

    const retryBtn = error.querySelector('.retry-btn');
    if (retryBtn && retryFn) {
        retryBtn.addEventListener('click', retryFn);
    }
}

// ---------- GALLERY ----------
async function loadGallery() {
    const container = DOM.galleryContainer;
    if (!container) return;
    showSkeleton(container);
    try {
        const q = query(
    collection(db, 'gallery'),
    limit(CONFIG.galleryLimit)
);
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            showEmpty(container, 'No gallery images available.');
            return;
        }
        const galleryItems = [];
        snapshot.forEach(doc => {
            galleryItems.push({ id: doc.id, ...doc.data() });
        });
        renderGallery(container, galleryItems);

    } catch (error) {
        console.warn('Gallery load error:', error);
        showError(container, loadGallery);
    }
}



function renderGallery(container, items) {

    container.innerHTML = "";

    items.forEach(item => {

        const div = createElement("div", {
            className: "gallery-item"
        });

        if (!item.url) return;

        // Thumbnail
        if (item.type === "video") {

            const video = createElement("video", {
                src: item.url,
                preload: "metadata",
                muted: true,
                playsinline: true
            });

            video.controls = false;

            div.appendChild(video);

        } else {

            const img = createElement("img", {
                src: item.url,
                alt: escapeHTML(item.title || "Gallery Image"),
                loading: "lazy"
            });

            div.appendChild(img);
        }

        // Info
        const info = createElement("div", {
            className: "gallery-info"
        });

        info.appendChild(
            createElement("h3", {}, [
                item.title || ""
            ])
        );

        if (item.description) {

            info.appendChild(
                createElement("p", {}, [
                    item.description
                ])
            );

        }

        div.appendChild(info);

        // Popup
        div.addEventListener("click", () => {

            DOM.popupTitle.textContent = item.title || "";
            DOM.popupDescription.textContent = item.description || "";

            if (item.type === "video") {

                DOM.popupImage.style.display = "none";

                DOM.popupVideo.style.display = "block";

                DOM.popupVideo.src = item.url;

                DOM.popupVideo.load();

                DOM.popupVideo.play().catch(()=>{});

            } else {

                DOM.popupVideo.pause();

                DOM.popupVideo.removeAttribute("src");

                DOM.popupVideo.load();

                DOM.popupVideo.style.display = "none";

                DOM.popupImage.style.display = "block";

                DOM.popupImage.src = item.url;

            }

            DOM.popup.classList.add("active");

            lockBodyScroll();

        });

        container.appendChild(div);

    });

    initFadeUp();

}

// ---------- REVIEWS ----------
async function loadReviews() {
    const container = DOM.reviewContainer;
    if (!container) return;
    showSkeleton(container);
    try {
        const q = query(
            collection(db, 'reviews'),
            where('status', '==', 'approved'),
            orderBy('createdAt', 'desc'),
            limit(CONFIG.reviewLimit)
        );
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            showEmpty(container, 'No reviews yet.');
            return;
        }
        const reviews = [];
        snapshot.forEach(doc => {
            reviews.push({ id: doc.id, ...doc.data() });
        });
        renderReviews(container, reviews);
    } catch (error) {
        console.warn('Review load error:', error);
        showError(container, loadReviews);
    }
}

function renderReviews(container, reviews) {
    container.innerHTML = '';

    reviews.forEach(review => {
        container.appendChild(createReviewCard(review));
    });

    initFadeUp();
}

function createReviewCard(review) {
    const card = createElement('div', { className: 'review-card' });

    // Rating stars
    const rating = review.rating || 0;
    const stars = createElement('div', { className: 'review-stars' });
    for (let i = 1; i <= 5; i++) {
        const star = createElement('i', {
            className: i <= rating ? 'fas fa-star gold-text' : 'far fa-star gold-text'
        });
        stars.appendChild(star);
    }
    card.appendChild(stars);

    // Review text
    const text = createElement('p', { className: 'review-text' }, [escapeHTML(review.review || '')]);
    card.appendChild(text);

    // Author
    const author = createElement('p', { className: 'review-author' }, [
        '— ' + escapeHTML(review.name || 'Anonymous')
    ]);
    card.appendChild(author);

    return card;
}


/* ============================================================
   REVIEW FORM SUBMISSION
   ============================================================ */
async function handleReviewSubmit(e) {
    e.preventDefault();

    const name = DOM.reviewName ? DOM.reviewName.value.trim() : '';
    const text = DOM.reviewText ? DOM.reviewText.value.trim() : '';
    let rating = 0;
    if (DOM.ratingStars) {
        for (const radio of DOM.ratingStars) {
            if (radio.checked) {
                rating = parseInt(radio.value, 10);
                break;
            }
        }
    }

    // Validation
    if (!name) {
        alert('Please enter your name.');
        return;
    }
    if (!rating) {
        alert('Please select a rating.');
        return;
    }
    if (!text) {
        alert('Please write your review.');
        return;
    }

    // Disable submit
    if (DOM.reviewSubmit) {
        DOM.reviewSubmit.disabled = true;
        DOM.reviewSubmit.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
    }

    try {
        await addDoc(collection(db, 'reviews'), {
            name: name,
            rating: rating,
            review: text,
            status: 'pending',
            createdAt: serverTimestamp()
        });
        alert('Thank you! Your review has been submitted for approval.');
        // Reset form
        if (DOM.reviewForm) DOM.reviewForm.reset();
    } catch (error) {
        console.warn('Review submission error:', error);
        alert('Failed to submit review. Please try again.');
    } finally {
        if (DOM.reviewSubmit) {
            DOM.reviewSubmit.disabled = false;
            DOM.reviewSubmit.innerHTML = 'Submit Review <i class="fas fa-paper-plane"></i>';
        }
    }
}

// Attach review form listener
if (DOM.reviewForm) {
    DOM.reviewForm.addEventListener('submit', handleReviewSubmit);
}


/* ============================================================
   INITIALIZATION
   ============================================================ */
function init() {
    // Menu is already initialized

    // Fade-up animation
    initFadeUp();

    // Counters
    initCounters();

    // Load Firebase content for homepage
    
    loadGallery();
    loadReviews();

    // Handle window resize for any adjustments
    const debouncedResize = debounce(() => {
        // Any responsive adjustments
    }, 200);
    window.addEventListener('resize', debouncedResize, { passive: true });

    console.log('The BM Fitness World — script initialized.');
}

// Run on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Expose some functions globally for debugging (optional)
window.BM = {
    loadGallery,
    loadReviews,
};

if(DOM.popupClose){
    DOM.popupClose.addEventListener(
        "click",
        closeGalleryPopup
    );
}

if(DOM.popup){
    DOM.popup.addEventListener(
        "click",
        e=>{
            if(e.target===DOM.popup){
                closeGalleryPopup();
            }
        }
    );
}