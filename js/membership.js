import { auth, db } from "./firebase-config.js";

import { onAuthStateChanged } from
"https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

import {
collection,
query,
orderBy,
onSnapshot,
addDoc,
updateDoc,
deleteDoc,
doc,
serverTimestamp
}
from
"https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* ============================================================
   CONFIGURATION
   ============================================================ */

/* ============================================================
   DOM REFERENCES
   ============================================================ */

// Header
const userDisplay = document.getElementById("user-display-name");

// Grid & states
const grid = document.getElementById("plans-grid");
const skeleton = document.getElementById("plans-skeleton");
const emptyState = document.getElementById("plans-empty");
const btnAdd = document.getElementById("btn-add-plan");
const btnEmptyAdd = document.getElementById("btn-empty-add");

// Modals
const modalAdd = document.getElementById("modal-add-plan");
const modalEdit = document.getElementById("modal-edit-plan");
const modalDelete = document.getElementById("modal-delete");
const modalPreview = document.getElementById("modal-preview");

// Add form
const planForm = document.getElementById("plan-form");
const planType = document.getElementById("plan-type");
const planDescription = document.getElementById("plan-description");
const plan1Month = document.getElementById("plan-1month");
const plan3Month = document.getElementById("plan-3month");
const plan6Month = document.getElementById("plan-6month");
const plan12Month = document.getElementById("plan-12month");
const planStatus = document.getElementById("plan-status");
const btnSubmitAdd = document.getElementById("btn-submit-add");

// Edit form
const editForm = document.getElementById("edit-plan-form");
const editIdField = document.getElementById("edit-plan-id");
const editPlanType = document.getElementById("edit-plan-type");
const editPlanDescription = document.getElementById("edit-plan-description");
const editPlan1Month = document.getElementById("edit-plan-1month");
const editPlan3Month = document.getElementById("edit-plan-3month");
const editPlan6Month = document.getElementById("edit-plan-6month");
const editPlan12Month = document.getElementById("edit-plan-12month");
const editPlanStatus = document.getElementById("edit-plan-status");
const btnSubmitEdit = document.getElementById("btn-submit-edit");

// Delete modal
const deleteIdField = document.getElementById("delete-plan-id");
const deleteNameSpan = document.getElementById("delete-plan-name");
const confirmDeleteBtn = document.getElementById("btn-confirm-delete");

// Preview modal
const previewPlanBadge = document.getElementById("preview-plan-badge");
const previewPlanStatus = document.getElementById("preview-plan-status");
const previewPlanName = document.getElementById("preview-plan-name");
const preview1Month = document.getElementById("preview-1month");
const preview3Month = document.getElementById("preview-3month");
const preview6Month = document.getElementById("preview-6month");
const preview12Month = document.getElementById("preview-12month");
const previewDescription = document.getElementById("preview-description");

// Filters & search
const searchInput = document.getElementById("search-input");
const filterType = document.getElementById("filter-type");
const filterStatus = document.getElementById("filter-status");
const filterSort = document.getElementById("filter-sort");

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
    // Reset forms when closing add/edit modals
    if (modal === modalAdd) {
        resetAddForm();
    }
    if (modal === modalEdit) {
        resetEditForm();
    }
    if (modal === modalDelete) {
        deleteIdField.value = "";
        deleteNameSpan.textContent = "this plan";
    }
}

// Reset add form
function resetAddForm() {
    planForm.reset();
    planType.value = "";
    plan1Month.value = "";
    plan3Month.value = "";
    plan6Month.value = "";
    plan12Month.value = "";
    planDescription.value = "";
    planStatus.value = "active";
    btnSubmitAdd.disabled = false;
    btnSubmitAdd.textContent = "Save Plan";
}

// Reset edit form
function resetEditForm() {
    editForm.reset();
    editIdField.value = "";
    editPlanType.value = "";
    editPlan1Month.value = "";
    editPlan3Month.value = "";
    editPlan6Month.value = "";
    editPlan12Month.value = "";
    editPlanDescription.value = "";
    editPlanStatus.value = "active";
    btnSubmitEdit.disabled = false;
    btnSubmitEdit.textContent = "Update Plan";
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
    // Start listening to membership plans
    listenMembershipPlans();
});

/* ============================================================
   FIRESTORE LISTENER (Realtime)
   ============================================================ */
let membershipData = [];
let unsubscribe = null;

function listenMembershipPlans() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    const plansRef = collection(db, "membershipPlans");
    const q = query(plansRef, orderBy("createdAt", "desc"));

    unsubscribe = onSnapshot(q, (snapshot) => {
        membershipData = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            membershipData.push({
                id: doc.id,
                ...data
            });
        });
        // Apply current filters and render
        applyFiltersAndRender();
        // Hide skeleton, show grid or empty
        skeleton.classList.add("hidden");
        if (membershipData.length === 0) {
            grid.classList.add("hidden");
            emptyState.classList.remove("hidden");
        } else {
            grid.classList.remove("hidden");
            emptyState.classList.add("hidden");
        }
    }, (error) => {
        showToast("Error", "Failed to load membership plans: " + error.message, "error");
    });
}

/* ============================================================
   FILTER, SEARCH, SORT
   ============================================================ */
function applyFiltersAndRender() {
    let filtered = [...membershipData];

    // Search
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(p =>
            (p.planType && p.planType.toLowerCase().includes(searchTerm)) ||
            (p.description && p.description.toLowerCase().includes(searchTerm))
        );
    }

    // Plan type filter
    const type = filterType.value;
    if (type !== "all") {
        filtered = filtered.filter(p => p.planType === type);
    }

    // Status filter
    const status = filterStatus.value;
    if (status !== "all") {
        filtered = filtered.filter(p => p.status === status);
    }

    // Sort
    const sort = filterSort.value;
    if (sort === "oldest") {
        filtered.sort((a, b) => {
            const da = a.createdAt?.seconds || 0;
            const db_ = b.createdAt?.seconds || 0;
            return da - db_;
        });
    } else {
        // newest first (default)
        filtered.sort((a, b) => {
            const da = a.createdAt?.seconds || 0;
            const db_ = b.createdAt?.seconds || 0;
            return db_ - da;
        });
    }

    renderPlans(filtered);
}

// Debounced search
const debouncedSearch = debounce(applyFiltersAndRender, 300);
searchInput.addEventListener("input", debouncedSearch);
filterType.addEventListener("change", applyFiltersAndRender);
filterStatus.addEventListener("change", applyFiltersAndRender);
filterSort.addEventListener("change", applyFiltersAndRender);

/* ============================================================
   RENDER PLANS
   ============================================================ */
function renderPlans(plans) {
    grid.innerHTML = "";
    if (plans.length === 0) {
        grid.classList.add("hidden");
        emptyState.classList.remove("hidden");
        return;
    }
    grid.classList.remove("hidden");
    emptyState.classList.add("hidden");

    plans.forEach((plan) => {
        const card = document.createElement("div");
        card.className = "plan-card glass-panel";

        const statusClass = plan.status === "active" ? "active" : "inactive";
        const statusText = plan.status === "active" ? "Active" : "Inactive";
        const planTypeDisplay = escapeHTML(plan.planType || "Unnamed");
        

        const oneMonth = Number(plan.oneMonth ?? 0);
        const threeMonth = Number(plan.threeMonth ?? 0);
        const sixMonth = Number(plan.sixMonth ?? 0);
        const twelveMonth = Number(plan.twelveMonth ?? 0);
    

        card.innerHTML = `
            <div class="plan-card-header">
                <span class="plan-badge">${escapeHTML(planTypeDisplay)}</span>
                <span class="plan-status ${statusClass}">${escapeHTML(statusText)}</span>
            </div>
            <div class="plan-prices">
                <div class="plan-price-item">
                    <span class="plan-price-label">1 Month</span>
                    <span class="plan-price-value">৳${escapeHTML(oneMonth)}</span>
                </div>
                <div class="plan-price-item">
                    <span class="plan-price-label">3 Months</span>
                    <span class="plan-price-value">৳${escapeHTML(threeMonth)}</span>
                </div>
                <div class="plan-price-item">
                    <span class="plan-price-label">6 Months</span>
                    <span class="plan-price-value">৳${escapeHTML(sixMonth)}</span>
                </div>
                <div class="plan-price-item">
                    <span class="plan-price-label">12 Months</span>
                    <span class="plan-price-value">৳${escapeHTML(twelveMonth)}</span>
                </div>
            </div>
            <p class="plan-description">${escapeHTML(plan.description || '')}</p>
            <div class="plan-actions">
                <button class="btn btn-outline preview-plan" data-id="${plan.id}" aria-label="Preview plan">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-gold edit-plan" data-id="${plan.id}" aria-label="Edit plan">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger delete-plan" data-id="${plan.id}" aria-label="Delete plan">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        grid.appendChild(card);

        // Attach event listeners
        const previewBtn = card.querySelector(".preview-plan");
        const editBtn = card.querySelector(".edit-plan");
        const deleteBtn = card.querySelector(".delete-plan");

        previewBtn.addEventListener("click", () => openPreview(plan));
        editBtn.addEventListener("click", () => openEditModal(plan.id));
        deleteBtn.addEventListener("click", () => openDeleteModal(plan.id));
    });
}

/* ============================================================
   PREVIEW MODAL
   ============================================================ */
function openPreview(plan) {
    const statusClass = plan.status === "active" ? "active" : "inactive";
    const statusText = plan.status === "active" ? "Active" : "Inactive";
    const planTypeDisplay = escapeHTML(plan.planType || "Unnamed");
 const oneMonth = plan.oneMonth ?? 0;
const threeMonth = plan.threeMonth ?? 0;
const sixMonth = plan.sixMonth ?? 0;
const twelveMonth = plan.twelveMonth ?? 0;

    previewPlanBadge.textContent = planTypeDisplay;
    previewPlanBadge.className = `preview-badge gold-badge`;
    previewPlanStatus.textContent = statusText;
    previewPlanStatus.className = `preview-badge status-badge ${statusClass}`;
    previewPlanName.textContent = planTypeDisplay + " Plan";
    preview1Month.textContent = "৳" + oneMonth;
    preview3Month.textContent = "৳" + threeMonth;
    preview6Month.textContent = "৳" + sixMonth;
    preview12Month.textContent = "৳" + twelveMonth;
    previewDescription.textContent = plan.description || "No description provided.";

    openModal(modalPreview);
}

/* ============================================================
   ADD PLAN
   ============================================================ */
btnAdd.addEventListener("click", () => openModal(modalAdd));
btnEmptyAdd.addEventListener("click", () => openModal(modalAdd));

planForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const type = planType.value.trim();

    // Validation
    if (!type) {
        showToast(
            "Validation Error",
            "Please select a plan type.",
            "error"
        );
        return;
    }

    // Duplicate Check
    const exists = membershipData.some(
        p => p.planType.toLowerCase() === type.toLowerCase()
    );

    if (exists) {
        showToast(
            "Already Exists",
            "This membership plan already exists.",
            "warning"
        );
        return;
    }

    const description = planDescription.value.trim();
    const oneMonth = parseFloat(plan1Month.value);
    const threeMonth = parseFloat(plan3Month.value);
    const sixMonth = parseFloat(plan6Month.value);
    const twelveMonth = parseFloat(plan12Month.value);
    const status = planStatus.value;


    // Validation
    if (!type) {
        showToast("Validation Error", "Please select a plan type.", "error");
        return;
    }
    if (isNaN(oneMonth) || oneMonth < 0) {
        showToast("Validation Error", "Please enter a valid 1 Month price.", "error");
        return;
    }
    if (isNaN(threeMonth) || threeMonth < 0) {
        showToast("Validation Error", "Please enter a valid 3 Months price.", "error");
        return;
    }
    if (isNaN(sixMonth) || sixMonth < 0) {
        showToast("Validation Error", "Please enter a valid 6 Months price.", "error");
        return;
    }
    if (isNaN(twelveMonth) || twelveMonth < 0) {
        showToast("Validation Error", "Please enter a valid 12 Months price.", "error");
        return;
    }

    btnSubmitAdd.disabled = true;
    btnSubmitAdd.textContent = "Saving...";

    try {
        const planData = {
            planType: type,
            oneMonth: oneMonth,
            threeMonth: threeMonth,
            sixMonth: sixMonth,
            twelveMonth: twelveMonth,
            description: description || "",
            status: status,
            createdAt: serverTimestamp(),
            updatedAt: null
        };

        await addDoc(collection(db, "membershipPlans"), planData);
        showToast("Success", "Membership plan added successfully!", "success");
        btnSubmitAdd.textContent="Save Plan";
        btnSubmitAdd.disabled=false;
        closeModal(modalAdd);
    } catch (error) {
        showToast("Error", error.message || "Failed to save membership plan.", "error");
        btnSubmitAdd.disabled = false;
        btnSubmitAdd.textContent = "Save Plan";
    }
});

/* ============================================================
   EDIT PLAN
   ============================================================ */
let editingPlanId = null;

async function openEditModal(planId) {
    const plan = membershipData.find(p => p.id === planId);
    if (!plan) {
        showToast("Error", "Plan not found.", "error");
        return;
    }
    editingPlanId = planId;

    editIdField.value = planId;
    editPlanType.value = plan.planType || "";
    editPlanDescription.value = plan.description || "";
    editPlan1Month.value = plan.oneMonth !== undefined ? plan.oneMonth : "";
    editPlan3Month.value = plan.threeMonth !== undefined ? plan.threeMonth : "";
    editPlan6Month.value = plan.sixMonth !== undefined ? plan.sixMonth : "";
    editPlan12Month.value = plan.twelveMonth !== undefined ? plan.twelveMonth : "";
    editPlanStatus.value = plan.status || "active";

    openModal(modalEdit);
}

editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const planId = editIdField.value;
    if (!planId) {
        showToast("Error", "No plan selected for editing.", "error");
        return;
    }

    const type = editPlanType.value.trim();
    const description = editPlanDescription.value.trim();
    const oneMonth = parseFloat(editPlan1Month.value);
    const threeMonth = parseFloat(editPlan3Month.value);
    const sixMonth = parseFloat(editPlan6Month.value);
    const twelveMonth = parseFloat(editPlan12Month.value);
    const status = editPlanStatus.value;

    // Validation
    if (!type) {
        showToast("Validation Error", "Please select a plan type.", "error");
        return;
    }
    if (isNaN(oneMonth) || oneMonth < 0) {
        showToast("Validation Error", "Please enter a valid 1 Month price.", "error");
        return;
    }
    if (isNaN(threeMonth) || threeMonth < 0) {
        showToast("Validation Error", "Please enter a valid 3 Months price.", "error");
        return;
    }
    if (isNaN(sixMonth) || sixMonth < 0) {
        showToast("Validation Error", "Please enter a valid 6 Months price.", "error");
        return;
    }
    if (isNaN(twelveMonth) || twelveMonth < 0) {
        showToast("Validation Error", "Please enter a valid 12 Months price.", "error");
        return;
    }

    btnSubmitEdit.disabled = true;
    btnSubmitEdit.textContent = "Updating...";

    try {
        const updateData = {
            planType: type,
            oneMonth: oneMonth,
            threeMonth: threeMonth,
            sixMonth: sixMonth,
            twelveMonth: twelveMonth,
            description: description || "",
            status: status,
            updatedAt: serverTimestamp()
        };

        const docRef = doc(db, "membershipPlans", planId);
        await updateDoc(docRef, updateData);
        showToast("Success", "Membership plan updated successfully!", "success");
        btnSubmitEdit.textContent="Update Plan";
        btnSubmitEdit.disabled=false;
        closeModal(modalEdit);
    } catch (error) {
        showToast("Error", error.message || "Failed to update membership plan.", "error");
        btnSubmitEdit.disabled = false;
        btnSubmitEdit.textContent = "Update Plan";
    }
});

/* ============================================================
   DELETE PLAN
   ============================================================ */
function openDeleteModal(planId) {
    const plan = membershipData.find(p => p.id === planId);
    if (!plan) {
        showToast("Error", "Plan not found.", "error");
        return;
    }
    deleteIdField.value = planId;
    deleteNameSpan.textContent = escapeHTML(plan.planType || "this plan");
    openModal(modalDelete);
}

confirmDeleteBtn.addEventListener("click", async () => {
    const planId = deleteIdField.value;
    if (!planId) {
        showToast("Error", "No plan selected for deletion.", "error");
        return;
    }
    try {
        await deleteDoc(doc(db, "membershipPlans", planId));
        showToast("Success", "Membership plan deleted successfully.", "success");
        closeModal(modalDelete);
    } catch (error) {
        showToast("Error", error.message || "Failed to delete membership plan.", "error");
    }
});

/* ============================================================
   INITIALIZATION
   ============================================================ */
// Show skeleton initially, hide grid and empty
grid.classList.add("hidden");
emptyState.classList.add("hidden");
skeleton.classList.remove("hidden");

console.log("Membership Plans management initialized.");