import { auth, db } from "./firebase-config.js";

import { onAuthStateChanged }
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
collection,
query,
orderBy,
onSnapshot,
updateDoc,
deleteDoc,
doc,
serverTimestamp
}
from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
/* ============================================================
   REVIEW.JS — BM Fitness World V2 | Admin Review Management
   Architecture identical to membership.js
   ============================================================ */

/* ============================================================
   DOM REFERENCES
   ============================================================ */
// Header
const userDisplay = document.getElementById("user-display-name");

// Grid & states
const grid = document.getElementById("reviews-grid");
const skeleton = document.getElementById("reviews-skeleton");
const emptyState = document.getElementById("reviews-empty");

// Search & filters
const searchInput = document.getElementById("search-input");
const filterStatus = document.getElementById("filter-status");
const filterSort = document.getElementById("filter-sort");

// Preview modal
const modalPreview = document.getElementById("modal-preview");
const previewName = document.getElementById("preview-review-name");
const previewRating = document.getElementById("preview-review-rating");
const previewText = document.getElementById("preview-review-text");
const previewStatus = document.getElementById("preview-review-status");
const previewDate = document.getElementById("preview-review-date");

// Approve modal
const modalApprove = document.getElementById("modal-approve");
const approveIdField = document.getElementById("approve-review-id");
const btnConfirmApprove = document.getElementById("btn-confirm-approve");

// Reject modal
const modalReject = document.getElementById("modal-reject");
const rejectIdField = document.getElementById("reject-review-id");
const btnConfirmReject = document.getElementById("btn-confirm-reject");

// Delete modal
const modalDelete = document.getElementById("modal-delete");
const deleteIdField = document.getElementById("delete-review-id");
const deleteNameSpan = document.getElementById("delete-review-name");
const btnConfirmDelete = document.getElementById("btn-confirm-delete");

// Toast container
const toastContainer = document.getElementById("toast-container");

// Close buttons (data-close)
const closeButtons = document.querySelectorAll("[data-close]");

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

// Debounce
function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Toast system
function showToast(title, message, type = "info", duration = 4000) {
    const icons = {
        success: "fa-check-circle",
        error: "fa-times-circle",
        warning: "fa-exclamation-circle",
        info: "fa-info-circle"
    };
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "alert");
    toast.innerHTML = `
        <span class="toast-icon ${type}"><i class="fas ${icons[type] || icons.info}"></i></span>
        <div class="toast-content">
            <span class="toast-title">${escapeHTML(title)}</span>
            <p class="toast-msg">${escapeHTML(message)}</p>
        </div>
        <button class="toast-close" aria-label="Dismiss notification">&times;</button>
    `;
    toastContainer.appendChild(toast);
    const closeBtn = toast.querySelector(".toast-close");
    const dismiss = () => {
        toast.classList.add("hiding");
        setTimeout(() => toast.remove(), 400);
    };
    closeBtn.addEventListener("click", dismiss);
    setTimeout(dismiss, duration);
    return toast;
}

// Modal management
function openModal(modal) {
    if (!modal) return;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.style.overflow = "";
    // Reset form fields on close
    if (modal === modalApprove) {
        approveIdField.value = "";
    }
    if (modal === modalReject) {
        rejectIdField.value = "";
    }
    if (modal === modalDelete) {
        deleteIdField.value = "";
        deleteNameSpan.textContent = "this review";
    }
}

// Generate star rating HTML
function renderStars(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5 ? 1 : 0;
    const emptyStars = 5 - fullStars - halfStar;
    let html = "";
    for (let i = 0; i < fullStars; i++) {
        html += '<i class="fas fa-star gold-text"></i>';
    }
    if (halfStar) {
        html += '<i class="fas fa-star-half-alt gold-text"></i>';
    }
    for (let i = 0; i < emptyStars; i++) {
        html += '<i class="far fa-star gold-text"></i>';
    }
    return html;
}

// Close modal on ESC key
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        const openModals = document.querySelectorAll(".modal-overlay:not(.hidden)");
        openModals.forEach(modal => closeModal(modal));
    }
});

// Close modal on overlay click
document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
            closeModal(overlay);
        }
    });
});

// Close buttons
closeButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const modal = btn.closest(".modal-overlay");
        if (modal) closeModal(modal);
    });
});

/* ============================================================
   AUTH STATE
   ============================================================ */
let currentUser = null;

onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "../login.html";
        return;
    }
    currentUser = user;
    if (user.displayName) {
        userDisplay.textContent = user.displayName;
    } else {
        userDisplay.textContent = "Administrator";
    }
    // Start listening to reviews
    listenReviews();
});

/* ============================================================
   FIRESTORE LISTENER (Realtime)
   ============================================================ */
let reviewData = [];
let unsubscribe = null;

function listenReviews() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    const reviewsRef = collection(db, "reviews");
    const q = query(reviewsRef, orderBy("createdAt", "desc"));

    unsubscribe = onSnapshot(q, (snapshot) => {
        reviewData = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            reviewData.push({
                id: doc.id,
                ...data
            });
        });
        // Apply current filters and render
        applyFiltersAndRender();
        // Hide skeleton, show grid or empty
        skeleton.classList.add("hidden");
        if (reviewData.length === 0) {
            grid.classList.add("hidden");
            emptyState.classList.remove("hidden");
        } else {
            grid.classList.remove("hidden");
            emptyState.classList.add("hidden");
        }
    }, (error) => {
        showToast("Error", "Failed to load reviews: " + error.message, "error");
    });
}

/* ============================================================
   FILTER, SEARCH, SORT
   ============================================================ */
function applyFiltersAndRender() {
    let filtered = [...reviewData];

    // Search
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(r =>
            (r.name && r.name.toLowerCase().includes(searchTerm)) ||
            (r.review && r.review.toLowerCase().includes(searchTerm))
        );
    }

    // Status filter
    const status = filterStatus.value;
    if (status !== "all") {
        filtered = filtered.filter(r => r.status === status);
    }

    // Sort
    const sort = filterSort.value;
    switch (sort) {
        case "oldest":
            filtered.sort((a, b) => {
                const da = a.createdAt?.seconds || 0;
                const db_ = b.createdAt?.seconds || 0;
                return da - db_;
            });
            break;
        case "highest":
            filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
            break;
        case "lowest":
            filtered.sort((a, b) => (a.rating || 0) - (b.rating || 0));
            break;
        default: // newest
            filtered.sort((a, b) => {
                const da = a.createdAt?.seconds || 0;
                const db_ = b.createdAt?.seconds || 0;
                return db_ - da;
            });
            break;
    }

    renderReviews(filtered);
}

// Debounced search
const debouncedSearch = debounce(applyFiltersAndRender, 300);
searchInput.addEventListener("input", debouncedSearch);
filterStatus.addEventListener("change", applyFiltersAndRender);
filterSort.addEventListener("change", applyFiltersAndRender);

/* ============================================================
   RENDER REVIEWS
   ============================================================ */
function renderReviews(reviews) {
    grid.innerHTML = "";
    if (reviews.length === 0) {
        grid.classList.add("hidden");
        emptyState.classList.remove("hidden");
        return;
    }
    grid.classList.remove("hidden");
    emptyState.classList.add("hidden");

    reviews.forEach((review) => {
        const card = document.createElement("div");
        card.className = "review-card glass-panel";

        const statusClass = review.status || "pending";
        const statusText = statusClass.charAt(0).toUpperCase() + statusClass.slice(1);
        const rating = Number(review.rating) || 0;
        const starHtml = renderStars(rating);
        const reviewText = review.review?.trim() || "No review available.";
        const truncatedText = reviewText.length > 120 ? reviewText.substring(0, 120) + "..." : reviewText;
        const displayName = review.name || "Anonymous";
        const reviewDate = review.createdAt?.toDate?.() || new Date();
        const dateStr = reviewDate.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });

        card.innerHTML = `
            <div class="review-card-header">
                <h3 class="review-card-name">${escapeHTML(displayName)}</h3>
                <span class="review-card-status ${statusClass}">${escapeHTML(statusText)}</span>
            </div>
            <div class="review-card-rating">${starHtml}</div>
            <p class="review-card-text">${escapeHTML(truncatedText)}</p>
            <span class="review-card-date"><i class="fas fa-calendar-alt"></i> ${escapeHTML(dateStr)}</span>
            <div class="review-card-actions">
    <button class="btn btn-outline preview-review" data-id="${review.id}">
        <i class="fas fa-eye"></i>
    </button>

    ${review.status !== "approved" ? `
    <button class="btn btn-success-outline approve-review" data-id="${review.id}">
        <i class="fas fa-check"></i> Approve
    </button>
    ` : ""}

    ${review.status !== "rejected" ? `
    <button class="btn btn-danger-outline reject-review" data-id="${review.id}">
        <i class="fas fa-times"></i> Reject
    </button>
    ` : ""}

    <button class="btn btn-danger delete-review" data-id="${review.id}">
        <i class="fas fa-trash"></i>
    </button>
</div>
        `;

        grid.appendChild(card);

        // Attach event listeners
        const previewBtn = card.querySelector(".preview-review");
        const approveBtn = card.querySelector(".approve-review");
        const rejectBtn = card.querySelector(".reject-review");
        const deleteBtn = card.querySelector(".delete-review");

        previewBtn?.addEventListener("click", () => openPreview(review));
        approveBtn?.addEventListener("click", () => openApproveModal(review.id));
        rejectBtn?.addEventListener("click", () => openRejectModal(review.id));
        deleteBtn?.addEventListener("click", () => openDeleteModal(review));
    });
}

/* ============================================================
   PREVIEW MODAL
   ============================================================ */
function openPreview(review) {
    const displayName = review.name || "Anonymous";
    const rating = Number(review.rating) || 0;
    const starHtml = renderStars(rating);
    const reviewText = review.review?.trim() || "No review available.";
    const statusClass = review.status || "pending";
    const statusText = statusClass.charAt(0).toUpperCase() + statusClass.slice(1);
    const reviewDate = review.createdAt?.toDate?.() || new Date();
    const dateStr = reviewDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });

    previewName.textContent = displayName;
    previewRating.innerHTML = starHtml;
    previewText.textContent = reviewText;
    previewStatus.textContent = statusText;
    previewStatus.className = `preview-badge status-badge ${statusClass}`;
    previewDate.innerHTML = `<i class="fas fa-calendar-alt"></i> ${dateStr}`;

    openModal(modalPreview);
}

/* ============================================================
   APPROVE REVIEW
   ============================================================ */
function openApproveModal(reviewId) {
    approveIdField.value = reviewId;
    openModal(modalApprove);
}

btnConfirmApprove.addEventListener("click", async () => {
    const reviewId = approveIdField.value;
    if (!reviewId) {
        showToast("Error", "No review selected for approval.", "error");
        return;
    }
    try {
        const docRef = doc(db, "reviews", reviewId);
        await updateDoc(docRef, {
            status: "approved",
            updatedAt: serverTimestamp()
        });
        showToast("Success", "Review approved successfully!", "success");
        closeModal(modalApprove);
    } catch (error) {
        showToast("Error", error.message || "Failed to approve review.", "error");
    }
});

/* ============================================================
   REJECT REVIEW
   ============================================================ */
function openRejectModal(reviewId) {
    rejectIdField.value = reviewId;
    openModal(modalReject);
}

btnConfirmReject.addEventListener("click", async () => {
    const reviewId = rejectIdField.value;
    if (!reviewId) {
        showToast("Error", "No review selected for rejection.", "error");
        return;
    }
    try {
        const docRef = doc(db, "reviews", reviewId);
        await updateDoc(docRef, {
            status: "rejected",
            updatedAt: serverTimestamp()
        });
        showToast("Success", "Review rejected successfully!", "success");
        closeModal(modalReject);
    } catch (error) {
        showToast("Error", error.message || "Failed to reject review.", "error");
    }
});

/* ============================================================
   DELETE REVIEW
   ============================================================ */
function openDeleteModal(review) {
    const displayName = review.name || "Anonymous";
    deleteIdField.value = review.id;
    deleteNameSpan.textContent = escapeHTML(displayName) + "'s review";
    openModal(modalDelete);
}

btnConfirmDelete.addEventListener("click", async () => {
    const reviewId = deleteIdField.value;
    if (!reviewId) {
        showToast("Error", "No review selected for deletion.", "error");
        return;
    }
    try {
        await deleteDoc(doc(db, "reviews", reviewId));
        showToast("Success", "Review deleted successfully.", "success");
        closeModal(modalDelete);
    } catch (error) {
        showToast("Error", error.message || "Failed to delete review.", "error");
    }
});

/* ============================================================
   INITIALIZATION
   ============================================================ */
// Show skeleton initially, hide grid and empty
grid.classList.add("hidden");
emptyState.classList.add("hidden");
skeleton.classList.remove("hidden");

console.log("Review Management initialized.");