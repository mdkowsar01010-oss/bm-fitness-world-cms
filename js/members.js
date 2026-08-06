/* ============================================================
   MEMBERS.JS — Admin Members Management
   BM Fitness World V2 | Full CRUD | Firebase Firestore v12
   ============================================================ */

import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

/* ============================================================
   DOM REFERENCES
   ============================================================ */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// Auth
const userDisplay = document.getElementById("user-display-name");
const btnLogout = document.getElementById("btn-logout");

// Grid & states
const grid = document.getElementById("members-grid");
const skeleton = document.getElementById("members-skeleton");
const emptyState = document.getElementById("members-empty");
const btnAdd = document.getElementById("btn-add-member");
const btnEmptyAdd = document.getElementById("btn-empty-add");

// Search & filter
const searchInput = document.getElementById("search-input");
const filterPlan = document.getElementById("filter-plan");

// Add/Edit Modal
const modalMember = document.getElementById("modal-member");
const modalMemberTitle = document.getElementById("modal-member-title");
const memberForm = document.getElementById("member-form");
const memberId = document.getElementById("member-id");
const memberName = document.getElementById("member-name");
const memberPlan = document.getElementById("member-plan");
const memberPrice = document.getElementById("member-price");
const memberDuration = document.getElementById("member-duration");
const btnSubmitMember = document.getElementById("btn-submit-member");

// Delete Modal
const modalDelete = document.getElementById("modal-delete");
const deleteMemberName = document.getElementById("delete-member-name");
const deleteMemberId = document.getElementById("delete-member-id");
const btnConfirmDelete = document.getElementById("btn-confirm-delete");

// Toast
const toastContainer = document.getElementById("toast-container");

// Close buttons
const closeButtons = document.querySelectorAll("[data-close]");

/* ============================================================
   STATE
   ============================================================ */
let allMembers = [];
let unsubscribe = null;
let currentUser = null;
let isEditing = false;

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

// Format date
function formatDate(timestamp) {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric"
    });
}

// Debounce
function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/* ============================================================
   TOAST SYSTEM
   ============================================================ */
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

/* ============================================================
   MODAL MANAGEMENT
   ============================================================ */
function openModal(modal) {
    if (!modal) return;
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.add("hidden");
    document.body.style.overflow = "";

    // Reset forms when closing member modal
    if (modal === modalMember) {
        resetMemberForm();
    }
    if (modal === modalDelete) {
        deleteMemberId.value = "";
        deleteMemberName.textContent = "this member";
    }
}

// Close modal on ESC
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
   MEMBER FORM
   ============================================================ */
function resetMemberForm() {
    memberForm.reset();
    memberId.value = "";
    isEditing = false;
    btnSubmitMember.textContent = "Save Member";
    modalMemberTitle.innerHTML = 'Add <span class="gold-text">Member</span>';
    memberPlan.value = "";
    memberDuration.value = "";
}

function fillMemberForm(data) {
    memberId.value = data.id;
    memberName.value = data.name || "";
    memberPlan.value = data.plan || "";
    memberPrice.value = data.price || "";
    memberDuration.value = data.duration || "";
    isEditing = true;
    btnSubmitMember.textContent = "Update Member";
    modalMemberTitle.innerHTML = 'Edit <span class="gold-text">Member</span>';
}

function openAddModal() {
    resetMemberForm();
    openModal(modalMember);
    setTimeout(() => memberName.focus(), 150);
}

function openEditModal(member) {
    fillMemberForm(member);
    openModal(modalMember);
    setTimeout(() => memberName.focus(), 150);
}

/* ============================================================
   DELETE MODAL
   ============================================================ */
function openDeleteModal(member) {
    deleteMemberId.value = member.id;
    deleteMemberName.textContent = escapeHTML(member.name || "this member");
    openModal(modalDelete);
}

/* ============================================================
   RENDER MEMBERS
   ============================================================ */
function renderMembers(members) {
    grid.innerHTML = "";

    if (!members || members.length === 0) {
        grid.classList.add("hidden");
        emptyState.classList.remove("hidden");
        return;
    }

    grid.classList.remove("hidden");
    emptyState.classList.add("hidden");

    // Sort by createdAt descending (newest first)
    const sorted = [...members].sort((a, b) => {
        const da = a.createdAt?.toDate?.() || new Date(0);
        const db = b.createdAt?.toDate?.() || new Date(0);
        return db - da;
    });

    sorted.forEach((member) => {
        const card = document.createElement("div");
        card.className = "member-card glass-panel";

        const planClass = (member.plan || "").toLowerCase();
        const createdDate = formatDate(member.createdAt);

        card.innerHTML = `
            <div class="member-card-header">
                <h3 class="member-card-name">${escapeHTML(member.name || "Unnamed")}</h3>
                <span class="member-card-plan ${planClass}">${escapeHTML(member.plan || "No Plan")}</span>
            </div>
            <div class="member-card-details">
                <span class="member-card-detail">
                    <i class="fas fa-dollar-sign"></i>
                    <span class="value">$${escapeHTML(member.price || "0.00")}</span>
                </span>
                <span class="member-card-detail">
                    <i class="fas fa-clock"></i>
                    <span class="value">${escapeHTML(member.duration || "N/A")}</span>
                </span>
                <span class="member-card-detail" style="grid-column: 1 / -1;">
                    <i class="fas fa-calendar-alt"></i>
                    <span class="value">Joined: ${escapeHTML(createdDate)}</span>
                </span>
            </div>
            <div class="member-card-actions">
                <button class="btn btn-gold btn-edit-member" data-id="${member.id}" aria-label="Edit member">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-danger btn-delete-member" data-id="${member.id}" aria-label="Delete member">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        grid.appendChild(card);

        // Attach event listeners
        const editBtn = card.querySelector(".btn-edit-member");
        const deleteBtn = card.querySelector(".btn-delete-member");

        editBtn.addEventListener("click", () => {
            const memberData = allMembers.find(m => m.id === member.id);
            if (memberData) openEditModal(memberData);
        });

        deleteBtn.addEventListener("click", () => {
            const memberData = allMembers.find(m => m.id === member.id);
            if (memberData) openDeleteModal(memberData);
        });
    });
}

/* ============================================================
   FILTER & SEARCH
   ============================================================ */
function applyFilters() {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const planFilter = filterPlan.value;

    let filtered = [...allMembers];

    // Search by name
    if (searchTerm) {
        filtered = filtered.filter(m =>
            m.name && m.name.toLowerCase().includes(searchTerm)
        );
    }

    // Filter by plan
    if (planFilter !== "all") {
        filtered = filtered.filter(m => m.plan === planFilter);
    }

    renderMembers(filtered);
}

// Debounced search
const debouncedSearch = debounce(applyFilters, 300);

// Event listeners for search and filter
searchInput.addEventListener("input", debouncedSearch);
filterPlan.addEventListener("change", applyFilters);

/* ============================================================
   FIRESTORE CRUD
   ============================================================ */

// Load members from Firestore
function listenMembers() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }

    // Show skeleton
    grid.classList.add("hidden");
    emptyState.classList.add("hidden");
    skeleton.classList.remove("hidden");

    const membersRef = collection(db, "members");
    const q = query(membersRef, orderBy("createdAt", "desc"));

    unsubscribe = onSnapshot(q, (snapshot) => {
        allMembers = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            allMembers.push({
                id: doc.id,
                ...data
            });
        });

        // Hide skeleton
        skeleton.classList.add("hidden");

        // Apply filters and render
        applyFilters();
    }, (error) => {
        console.error("Error loading members:", error);
        skeleton.classList.add("hidden");
        showToast("Error", "Failed to load members: " + error.message, "error");
    });
}

// Add member
async function addMember(data) {
    try {
        await addDoc(collection(db, "members"), {
            name: data.name,
            plan: data.plan,
            price: data.price,
            duration: data.duration,
            createdAt: serverTimestamp(),
            updatedAt: null
        });
        showToast("Success", "Member added successfully!", "success");
        return true;
    } catch (error) {
        console.error("Error adding member:", error);
        showToast("Error", "Failed to add member: " + error.message, "error");
        return false;
    }
}

// Update member
async function updateMember(id, data) {
    try {
        const docRef = doc(db, "members", id);
        await updateDoc(docRef, {
            name: data.name,
            plan: data.plan,
            price: data.price,
            duration: data.duration,
            updatedAt: serverTimestamp()
        });
        showToast("Success", "Member updated successfully!", "success");
        return true;
    } catch (error) {
        console.error("Error updating member:", error);
        showToast("Error", "Failed to update member: " + error.message, "error");
        return false;
    }
}

// Delete member
async function deleteMember(id) {
    try {
        await deleteDoc(doc(db, "members", id));
        showToast("Success", "Member deleted successfully!", "success");
        return true;
    } catch (error) {
        console.error("Error deleting member:", error);
        showToast("Error", "Failed to delete member: " + error.message, "error");
        return false;
    }
}

/* ============================================================
   FORM SUBMISSION
   ============================================================ */
memberForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate
    const name = memberName.value.trim();
    const plan = memberPlan.value;
    const price = parseFloat(memberPrice.value);
    const duration = memberDuration.value;

    if (!name) {
        showToast("Validation Error", "Please enter a member name.", "error");
        memberName.focus();
        return;
    }

    if (!plan) {
        showToast("Validation Error", "Please select a plan.", "error");
        memberPlan.focus();
        return;
    }

    if (isNaN(price) || price < 0) {
        showToast("Validation Error", "Please enter a valid price.", "error");
        memberPrice.focus();
        return;
    }

    if (!duration) {
        showToast("Validation Error", "Please select a duration.", "error");
        memberDuration.focus();
        return;
    }

    // Disable submit button
    btnSubmitMember.disabled = true;
    const originalText = btnSubmitMember.textContent;
    btnSubmitMember.textContent = "Saving...";

    const memberData = {
        name,
        plan,
        price,
        duration
    };

    let success = false;
    const id = memberId.value;

    if (id) {
        // Update existing member
        success = await updateMember(id, memberData);
    } else {
        // Add new member
        success = await addMember(memberData);
    }

    // Re-enable submit button
    btnSubmitMember.disabled = false;
    btnSubmitMember.textContent = originalText;

    if (success) {
        closeModal(modalMember);
        // Reset form after close (handled by closeModal)
    }
});

/* ============================================================
   AUTHENTICATION
   ============================================================ */
onAuthStateChanged(auth, (user) => {
    if (!user) {
        // Redirect to login
        window.location.href = "../login.html";
        return;
    }

    currentUser = user;

    // Display user name
    if (user.displayName) {
        userDisplay.textContent = user.displayName;
    } else {
        userDisplay.textContent = "Administrator";
    }

    // Load members
    listenMembers();
});

// Logout
btnLogout.addEventListener("click", async () => {
    try {
        await signOut(auth);
        window.location.href = "../login.html";
    } catch (error) {
        console.error("Logout error:", error);
        showToast("Error", "Failed to logout: " + error.message, "error");
    }
});

/* ============================================================
   EVENT LISTENERS — Add Buttons
   ============================================================ */
btnAdd.addEventListener("click", openAddModal);
btnEmptyAdd.addEventListener("click", openAddModal);

/* ============================================================
   DELETE CONFIRMATION
   ============================================================ */
btnConfirmDelete.addEventListener("click", async () => {
    const id = deleteMemberId.value;
    if (!id) {
        showToast("Error", "No member selected for deletion.", "error");
        return;
    }

    btnConfirmDelete.disabled = true;
    btnConfirmDelete.textContent = "Deleting...";

    const success = await deleteMember(id);

    btnConfirmDelete.disabled = false;
    btnConfirmDelete.textContent = "Delete";

    if (success) {
        closeModal(modalDelete);
    }
});

/* ============================================================
   INITIALIZATION
   ============================================================ */
// Show skeleton initially
grid.classList.add("hidden");
emptyState.classList.add("hidden");
skeleton.classList.remove("hidden");

console.log("Members Management initialized.");