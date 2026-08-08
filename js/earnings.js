/* ============================================================
   EARNINGS.JS — Admin Earnings Management
   BM Fitness World V2 | Firebase Firestore v12 | Vanilla JS
   ============================================================ */

import { auth, db } from "./firebase-config.js";
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
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

/* ============================================================
   CONFIG
   ============================================================ */
const MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
];

const MONTH_LABELS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
];

const CONFIG = {
    headerOffset: 68,
    toastDuration: 4000,
    animationThreshold: 0.15
};

/* ============================================================
   DOM REFERENCES
   ============================================================ */
const DOM = {
    // Header / auth
    userDisplay: document.getElementById("user-display-name"),
    btnLogout: document.getElementById("btn-logout"),
    btnBackDashboard: document.getElementById("btn-back-dashboard"),

    // Page controls
    btnAddTable: document.getElementById("btn-add-table"),
    btnEmptyAdd: document.getElementById("btn-empty-add"),
    container: document.getElementById("earnings-container"),
    skeleton: document.getElementById("earnings-skeleton"),
    emptyState: document.getElementById("earnings-empty"),

    // Template
    template: document.getElementById("earnings-table-template"),

    // Delete modal
    modalDelete: document.getElementById("modal-delete"),
    deleteTableId: document.getElementById("delete-table-id"),
    deleteTableYear: document.getElementById("delete-table-year"),
    btnConfirmDelete: document.getElementById("btn-confirm-delete"),
    btnCancelDelete: document.getElementById("btn-cancel-delete"),

    // Toast
    toastContainer: document.getElementById("toast-container"),

    // Optional sidebar elements
    sidebarToggle: document.getElementById("sidebar-toggle"),
    adminSidebar: document.getElementById("admin-sidebar"),
    logoutLink: document.getElementById("logout-link"),
    userMenuBtn: document.getElementById("user-menu-btn")
};

/* ============================================================
   STATE
   ============================================================ */
let allDocs = [];
let drafts = [];
let unsubscribe = null;
let currentUser = null;
let isDeleting = false;
let lastFocusedElement = null;

/* ============================================================
   HELPERS
   ============================================================ */
function escapeHTML(str) {
    if (str === undefined || str === null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function formatNumber(num) {
    if (num === undefined || num === null || num === "") return "";
    const n = Number(num);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString("en-US");
}

function parseNumber(str) {
    const cleaned = String(str ?? "").replace(/,/g, "").trim();
    if (cleaned === "") return 0;
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : NaN;
}

function generateDraftId() {
    return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getCurrentYear() {
    return String(new Date().getFullYear());
}

function scrollToTop(offset = CONFIG.headerOffset) {
    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}

function lockBodyScroll() {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
    }
}

function unlockBodyScroll() {
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";
}

/* ============================================================
   TOAST SYSTEM
   ============================================================ */
function showToast(title, message, type = "info", duration = CONFIG.toastDuration) {
    if (!DOM.toastContainer) return;

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
        <span class="toast-icon ${type}">
            <i class="fas ${icons[type] || icons.info}"></i>
        </span>
        <div class="toast-content">
            <span class="toast-title">${escapeHTML(title)}</span>
            <p class="toast-msg">${escapeHTML(message)}</p>
        </div>
        <button class="toast-close" aria-label="Dismiss notification">&times;</button>
    `;

    DOM.toastContainer.appendChild(toast);

    const dismiss = () => {
        toast.classList.add("hiding");
        setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector(".toast-close")?.addEventListener("click", dismiss);
    setTimeout(dismiss, duration);

    return toast;
}

/* ============================================================
   MODAL MANAGEMENT
   ============================================================ */
function openModal(modal) {
    if (!modal) return;
    lastFocusedElement = document.activeElement;
    modal.classList.remove("hidden");
    lockBodyScroll();

    const firstFocusable = modal.querySelector(
        "button, input, select, textarea, [tabindex]:not([tabindex='-1'])"
    );
    if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 100);
    }
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.add("hidden");
    unlockBodyScroll();

    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
        lastFocusedElement.focus();
        lastFocusedElement = null;
    }
}

function setupModalHandlers() {
    if (DOM.modalDelete) {
        DOM.modalDelete.addEventListener("click", (e) => {
            if (e.target === DOM.modalDelete) {
                closeModal(DOM.modalDelete);
            }
        });
    }

    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (DOM.modalDelete && !DOM.modalDelete.classList.contains("hidden")) {
            closeModal(DOM.modalDelete);
        }
    });

    DOM.btnCancelDelete?.addEventListener("click", () => closeModal(DOM.modalDelete));
}

/* ============================================================
   AUTH
   ============================================================ */
function setupAuth() {
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = "../login.html";
            return;
        }

        currentUser = user;

        if (DOM.userDisplay) {
            DOM.userDisplay.textContent = user.displayName || "Administrator";
        }

        loadEarnings();
    });
}

function handleLogout() {
    signOut(auth)
        .then(() => {
            window.location.href = "../login.html";
        })
        .catch((error) => {
            console.error("Logout error:", error);
            showToast("Error", "Failed to logout.", "error");
        });
}

/* ============================================================
   BASIC PAGE ACTIONS
   ============================================================ */
function setupBasicActions() {
    DOM.btnBackDashboard?.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "../admin.html";
    });

    DOM.btnLogout?.addEventListener("click", handleLogout);
    DOM.logoutLink?.addEventListener("click", (e) => {
        e.preventDefault();
        handleLogout();
    });

    DOM.btnAddTable?.addEventListener("click", () => {
        if (typeof window.BM?.earnings?.addDraft === "function") {
            window.BM.earnings.addDraft();
        }
    });

    DOM.btnEmptyAdd?.addEventListener("click", () => {
        if (typeof window.BM?.earnings?.addDraft === "function") {
            window.BM.earnings.addDraft();
        }
    });
}

/* ============================================================
   INITIALIZATION
   ============================================================ */
function init() {
    setupAuth();
    setupModalHandlers();
    setupBasicActions();

    console.log("Earnings Management part 1 initialized.");
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

window.BM = window.BM || {};
window.BM.earnings = window.BM.earnings || {};

/* ============================================================
   EARNINGS.JS — PART 2
   Render + Drafts + Save + Load
   ============================================================ */

/* ============================================================
   VIEW STATE HELPERS
   ============================================================ */
function showSkeleton() {
    if (!DOM.skeleton || !DOM.container || !DOM.emptyState) return;
    DOM.skeleton.classList.remove("hidden");
    DOM.container.classList.add("hidden");
    DOM.emptyState.classList.add("hidden");
}

function showEmpty(messageTitle = "No Earnings Records Found", messageBody = "Create your first yearly earnings table.") {
    if (!DOM.skeleton || !DOM.container || !DOM.emptyState) return;

    DOM.skeleton.classList.add("hidden");
    DOM.container.classList.add("hidden");
    DOM.emptyState.classList.remove("hidden");

    const titleEl = DOM.emptyState.querySelector("h2");
    const bodyEl = DOM.emptyState.querySelector("p");

    if (titleEl) titleEl.textContent = messageTitle;
    if (bodyEl) bodyEl.textContent = messageBody;
}

function showContainer() {
    if (!DOM.skeleton || !DOM.container || !DOM.emptyState) return;
    DOM.skeleton.classList.add("hidden");
    DOM.container.classList.remove("hidden");
    DOM.emptyState.classList.add("hidden");
}

function showError(message = "Failed to load earnings tables.") {
    if (!DOM.container) return;

    DOM.skeleton?.classList.add("hidden");
    DOM.emptyState?.classList.add("hidden");
    DOM.container.classList.remove("hidden");
    DOM.container.innerHTML = `
        <div class="earnings-error-card glass-panel">
            <div class="earnings-error-icon">
                <i class="fas fa-exclamation-triangle" aria-hidden="true"></i>
            </div>
            <h2>Something went wrong</h2>
            <p>${escapeHTML(message)}</p>
            <button type="button" class="btn btn-gold btn-sm" id="btn-retry-load">
                Retry
            </button>
        </div>
    `;

    document.getElementById("btn-retry-load")?.addEventListener("click", loadEarnings);
}

/* ============================================================
   TABLE TEMPLATE / CARD BUILDING
   ============================================================ */
function createCardFromTemplate(tableData, isDraft = false) {
    if (!DOM.template) return null;

    const fragment = document.importNode(DOM.template.content, true);
    const card = fragment.querySelector(".earnings-card");
    if (!card) return null;

    const tableId = tableData.id || generateDraftId();
    const yearValue = tableData.year !== undefined && tableData.year !== null ? String(tableData.year) : "";

    card.dataset.id = tableId;
    card.dataset.year = yearValue;
    card.dataset.draft = isDraft ? "true" : "false";
    card.dataset.draftCreatedAt = tableData.draftCreatedAt ? String(tableData.draftCreatedAt) : "";

    const yearInput = card.querySelector(".earning-year");
    const monthInputs = card.querySelectorAll(".month-input");
    const editBtn = card.querySelector(".btn-edit-table");
    const saveBtn = card.querySelector(".btn-save-table");
    const deleteBtn = card.querySelector(".btn-delete-table");

    if (!yearInput || !monthInputs.length || !editBtn || !saveBtn || !deleteBtn) {
        return null;
    }

    // Accessibility / input behavior
    yearInput.setAttribute("inputmode", "numeric");
    yearInput.setAttribute("autocomplete", "off");
    yearInput.setAttribute("pattern", "\\d{4}");

    monthInputs.forEach((inp) => {
        inp.setAttribute("inputmode", "numeric");
        inp.setAttribute("autocomplete", "off");
        inp.setAttribute("pattern", "[0-9,]*");
    });

    // Default render values
    yearInput.value = yearValue;
    yearInput.disabled = true;

    MONTHS.forEach((monthKey, index) => {
        const input = monthInputs[index];
        const raw = tableData[monthKey];

        if (raw === undefined || raw === null || raw === "") {
            input.value = isDraft ? "" : "";
        } else {
            input.value = formatNumber(raw);
        }

        input.disabled = true;
    });

    // Store refs for later
    card._yearInput = yearInput;
    card._monthInputs = monthInputs;
    card._editBtn = editBtn;
    card._saveBtn = saveBtn;
    card._deleteBtn = deleteBtn;
    card._isDraft = isDraft;

    // Initial button states
    editBtn.disabled = false;
    saveBtn.disabled = true;

    // Preserve original markup for loading text restore
    editBtn.dataset.originalHtml = editBtn.innerHTML;
    saveBtn.dataset.originalHtml = saveBtn.innerHTML;
    deleteBtn.dataset.originalHtml = deleteBtn.innerHTML;

    // Edit
    editBtn.addEventListener("click", () => enableEditing(card));

    // Save
    saveBtn.addEventListener("click", () => saveTable(card));

    // Delete
    deleteBtn.addEventListener("click", () => {
        if (card._isDraft) {
            removeDraft(card.dataset.id);
            showToast("Info", "Draft removed.", "info");
            return;
        }

        openDeleteModal(card.dataset.id, card.dataset.year);
    });

    return card;
}

function enableEditing(card) {
    if (!card) return;

    const yearInput = card._yearInput;
    const monthInputs = card._monthInputs;
    const editBtn = card._editBtn;
    const saveBtn = card._saveBtn;

    yearInput.disabled = false;
    monthInputs.forEach((inp) => (inp.disabled = false));
    editBtn.disabled = true;
    saveBtn.disabled = false;

    setTimeout(() => {
        yearInput.focus();
        yearInput.select();
    }, 80);
}

function disableEditing(card) {
    if (!card) return;

    const yearInput = card._yearInput;
    const monthInputs = card._monthInputs;
    const editBtn = card._editBtn;
    const saveBtn = card._saveBtn;

    yearInput.disabled = true;
    monthInputs.forEach((inp) => (inp.disabled = true));
    editBtn.disabled = false;
    saveBtn.disabled = true;
}

function restoreButtons(card) {
    if (!card) return;
    if (card._editBtn?.dataset.originalHtml) card._editBtn.innerHTML = card._editBtn.dataset.originalHtml;
    if (card._saveBtn?.dataset.originalHtml) card._saveBtn.innerHTML = card._saveBtn.dataset.originalHtml;
    if (card._deleteBtn?.dataset.originalHtml) card._deleteBtn.innerHTML = card._deleteBtn.dataset.originalHtml;
}

/* ============================================================
   VALIDATION
   ============================================================ */
function isDuplicateYear(yearValue, currentId = "") {
    const target = String(yearValue).trim();

    if (!target) return false;

    return [...allDocs, ...drafts].some((item) => {
        const itemYear = String(item.year ?? "").trim();
        const sameId = String(item.id || "") === String(currentId || "");
        return !sameId && itemYear === target;
    });
}

function validateTableData(card) {
    const errors = [];
    const yearInput = card._yearInput;
    const yearValue = String(yearInput.value ?? "").trim();

    if (!yearValue) {
        errors.push("Year is required.");
    } else if (!/^\d{4}$/.test(yearValue)) {
        errors.push("Year must be exactly 4 digits.");
    } else if (Number(yearValue) < 2000 || Number(yearValue) > 2100) {
        errors.push("Year must be between 2000 and 2100.");
    } else if (isDuplicateYear(yearValue, card.dataset.id)) {
        errors.push(`Year ${yearValue} already exists.`);
    }

    card._monthInputs.forEach((inp) => {
        const raw = String(inp.value ?? "").trim();
        if (raw === "") return;

        const num = parseNumber(raw);
        if (Number.isNaN(num)) {
            errors.push(`Invalid number for ${inp.dataset.month}.`);
        } else if (num < 0) {
            errors.push(`Negative values are not allowed for ${inp.dataset.month}.`);
        }
    });

    return errors;
}

/* ============================================================
   DATA MAPPING
   ============================================================ */
function extractTableData(card) {
    const yearValue = String(card._yearInput.value ?? "").trim();
    const data = {
        year: Number(yearValue)
    };

    card._monthInputs.forEach((inp) => {
        const key = inp.dataset.month;
        const val = parseNumber(inp.value);
        data[key] = Number.isNaN(val) ? 0 : val;
    });

    return data;
}

/* ============================================================
   DRAFT MANAGEMENT
   ============================================================ */
function addTableDraft() {
    const draft = {
        id: generateDraftId(),
        year: "",
        draftCreatedAt: Date.now()
    };

    MONTHS.forEach((m) => {
        draft[m] = "";
    });

    drafts.unshift(draft);
    renderAll();

    setTimeout(() => {
        const card = DOM.container?.querySelector(`[data-id="${draft.id}"]`);
        if (card?._yearInput) {
            card._yearInput.focus();
        }
    }, 100);

    showToast("Info", "New table draft created. Click Edit to begin.", "info");
}

function removeDraft(draftId) {
    drafts = drafts.filter((d) => String(d.id) !== String(draftId));
    renderAll();
}

/* ============================================================
   FIRESTORE SAVE
   ============================================================ */
async function saveTable(card) {
    if (!card) return;

    const errors = validateTableData(card);
    if (errors.length > 0) {
        showToast("Validation Error", errors.join(" "), "error");
        return;
    }

    const yearValue = String(card._yearInput.value ?? "").trim();
    const tableData = extractTableData(card);
    const isDraft = card.dataset.draft === "true";
    const saveBtn = card._saveBtn;

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    try {
        if (isDraft) {
            await addDoc(collection(db, "earnings"), {
                ...tableData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });

            removeDraft(card.dataset.id);
            showToast("Success", `Earnings table for ${yearValue} created.`, "success");
        } else {
            await updateDoc(doc(db, "earnings", card.dataset.id), {
                ...tableData,
                updatedAt: serverTimestamp()
            });

            disableEditing(card);
            restoreButtons(card);
            showToast("Success", `Earnings table for ${yearValue} updated.`, "success");
        }
    } catch (error) {
        console.error("Save error:", error);
        showToast("Error", "Failed to save table. Please try again.", "error");

        saveBtn.disabled = false;
        saveBtn.innerHTML = saveBtn.dataset.originalHtml || '<i class="fas fa-save"></i> Save';
        if (!isDraft) {
            enableEditing(card);
        }
    }
}

/* ============================================================
   DELETE MODAL
   ============================================================ */
function openDeleteModal(id, year) {
    if (!DOM.modalDelete) return;

    DOM.deleteTableId.value = id;
    DOM.deleteTableYear.textContent = year || "this table";
    openModal(DOM.modalDelete);
}

/* ============================================================
   RENDER
   ============================================================ */
function sortTables(a, b) {
    const aIsDraft = String(a.id || "").startsWith("draft-");
    const bIsDraft = String(b.id || "").startsWith("draft-");

    if (aIsDraft && !bIsDraft) return -1;
    if (!aIsDraft && bIsDraft) return 1;

    if (aIsDraft && bIsDraft) {
        return (b.draftCreatedAt || 0) - (a.draftCreatedAt || 0);
    }

    const yearA = Number(a.year) || 0;
    const yearB = Number(b.year) || 0;
    return yearB - yearA;
}

function renderAll() {
    if (!DOM.container) return;

    const allTables = [...drafts, ...allDocs].sort(sortTables);

    if (allTables.length === 0) {
        showEmpty();
        DOM.container.innerHTML = "";
        return;
    }

    showContainer();
    DOM.container.innerHTML = "";

    const fragment = document.createDocumentFragment();

    allTables.forEach((table) => {
        const isDraft = String(table.id || "").startsWith("draft-");
        const card = createCardFromTemplate(table, isDraft);
        if (card) fragment.appendChild(card);
    });

    DOM.container.appendChild(fragment);
}

/* ============================================================
   FIRESTORE LISTENER
   ============================================================ */
function loadEarnings() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }

    showSkeleton();

    const q = query(collection(db, "earnings"), orderBy("year", "desc"));

    unsubscribe = onSnapshot(
        q,
        (snapshot) => {
            allDocs = [];

            snapshot.forEach((snapDoc) => {
                const data = snapDoc.data();
                if (data.year === undefined || data.year === null || data.year === "") return;

                allDocs.push({
                    id: snapDoc.id,
                    ...data
                });
            });

            // Keep drafts that are not already represented by a saved table.
            drafts = drafts.filter((draft) => {
                if (!String(draft.year || "").trim()) return true;
                return !allDocs.some((docItem) => String(docItem.year) === String(draft.year));
            });

            renderAll();
            DOM.skeleton?.classList.add("hidden");
        },
        (error) => {
            console.error("Firestore listen error:", error);
            DOM.skeleton?.classList.add("hidden");
            showError("Failed to load earnings tables.");
            showToast("Error", "Failed to load earnings tables.", "error");
        }
    );
}

/* ============================================================
   WINDOW HOOKS
   ============================================================ */
window.BM = window.BM || {};
window.BM.earnings = {
    addDraft: addTableDraft,
    reload: loadEarnings,
    renderAll
};


/* ============================================================
   EARNINGS.JS — PART 3
   Final Auth Patch + Delete Flow
   ============================================================ */

/* ============================================================
   AUTH PATCH
   ============================================================ */
/* 
   This overrides the earlier setupAuth from Part 1 so that:
   - logged-in user loads earnings automatically
   - guest users redirect to login

/* ============================================================
   DELETE CONFIRMATION
   ============================================================ */
if (DOM.btnConfirmDelete) {
    DOM.btnConfirmDelete.addEventListener("click", async () => {
        const id = String(DOM.deleteTableId?.value || "").trim();

        if (!id) {
            showToast("Error", "No table selected for deletion.", "error");
            return;
        }

        if (isDeleting) return;

        isDeleting = true;
        DOM.btnConfirmDelete.disabled = true;
        DOM.btnConfirmDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';

        try {
            await deleteDoc(doc(db, "earnings", id));
            showToast("Success", "Table deleted successfully.", "success");
            closeModal(DOM.modalDelete);
        } catch (error) {
            console.error("Delete error:", error);
            showToast("Error", "Failed to delete table.", "error");
        } finally {
            isDeleting = false;
            DOM.btnConfirmDelete.disabled = false;
            DOM.btnConfirmDelete.innerHTML = 'Delete';
        }
    });
}

/* ============================================================
   OPTIONAL SAFETY CLEANUP
   ============================================================ */
window.addEventListener("beforeunload", () => {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
});