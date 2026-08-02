import { auth, db } from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

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
/* ============================================================
   CONFIGURATION
   ============================================================ */
const CLOUDINARY_UPLOAD_PRESET = "bmfitnesstrainer";
const CLOUDINARY_CLOUD_NAME = "g92cbbtl";
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

/* ============================================================
   DOM REFERENCES
   ============================================================ */

// Header
const userDisplay = document.getElementById("user-display-name");

// Grid & states
const grid = document.getElementById("trainer-grid");
const skeleton = document.getElementById("trainer-skeleton");
const emptyState = document.getElementById("trainer-empty");
const btnAdd = document.getElementById("btn-add-trainer");
const btnEmptyAdd = document.getElementById("btn-empty-add");

// Modals
const modalAdd = document.getElementById("modal-add-trainer");
const modalEdit = document.getElementById("modal-edit-trainer");
const modalDelete = document.getElementById("modal-delete");
const modalPreview = document.getElementById("modal-preview");

// Add form
const trainerForm = document.getElementById("trainer-form");
const fileInput = document.getElementById("trainer-file-input");
const dropZone = document.getElementById("drop-zone");
const previewContainer = document.getElementById("trainer-preview-container");
const previewImage = document.getElementById("trainer-preview-image");
const previewFileName = document.getElementById("preview-file-name");
const previewFileSize = document.getElementById("preview-file-size");
const removePreviewBtn = document.getElementById("btn-remove-preview");
const uploadProgressContainer = document.getElementById("upload-progress-container");
const uploadProgressBar = document.getElementById("upload-progress-bar");
const uploadProgressPercent = document.getElementById("upload-progress-percent");
const btnSubmitAdd = document.getElementById("btn-submit-trainer");

// Edit form
const editForm = document.getElementById("edit-trainer-form");
const editFileInput = document.getElementById("edit-trainer-file-input");
const editDropZone = document.getElementById("edit-drop-zone");
const editPreviewContainer = document.getElementById("edit-preview-container");
const editNewPreview = document.getElementById("edit-new-preview-image");
const editPreviewFileName = document.getElementById("edit-preview-file-name");
const editPreviewFileSize = document.getElementById("edit-preview-file-size");
const removeEditPreviewBtn = document.getElementById("btn-edit-remove-preview");
const editUploadProgressContainer = document.getElementById("edit-upload-progress-container");
const editUploadProgressBar = document.getElementById("edit-upload-progress-bar");
const editUploadProgressPercent = document.getElementById("edit-upload-progress-percent");
const btnSubmitEdit = document.getElementById("btn-submit-edit");
const editIdField = document.getElementById("edit-trainer-id");
const editPreviewThumb = document.getElementById("edit-preview-image");
const editName = document.getElementById("edit-trainer-name");
const editDesignation = document.getElementById("edit-trainer-designation");
const editExperience = document.getElementById("edit-trainer-experience");
const editStatus = document.getElementById("edit-trainer-status");
const editBio = document.getElementById("edit-trainer-bio");
const editFacebook = document.getElementById("edit-trainer-facebook");
const editInstagram = document.getElementById("edit-trainer-instagram");
const editWhatsapp = document.getElementById("edit-trainer-whatsapp");

// Delete modal
const deleteIdField = document.getElementById("delete-trainer-id");
const deleteNameSpan = document.getElementById("delete-trainer-name");
const confirmDeleteBtn = document.getElementById("btn-confirm-delete");

// Preview modal
const previewPhoto = document.getElementById("preview-trainer-photo");
const previewStatus = document.getElementById("preview-trainer-status");
const previewName = document.getElementById("preview-trainer-name");
const previewDesignation = document.getElementById("preview-trainer-designation");
const previewExperience = document.getElementById("preview-trainer-experience");
const previewBio = document.getElementById("preview-trainer-bio");
const previewFacebook = document.getElementById("preview-facebook");
const previewInstagram = document.getElementById("preview-instagram");
const previewWhatsapp = document.getElementById("preview-whatsapp");

// Filters & search
const searchInput = document.getElementById("search-input");
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
        deleteNameSpan.textContent = "this trainer";
    }
    // Revoke any object URL previews
    if (modal === modalAdd) {
        if (previewImage.src && previewImage.src.startsWith("blob:")) {
            URL.revokeObjectURL(previewImage.src);
        }
        previewImage.src = "";
    }
    if (modal === modalEdit) {
        if (editNewPreview.src && editNewPreview.src.startsWith("blob:")) {
            URL.revokeObjectURL(editNewPreview.src);
        }
        editNewPreview.src = "";
    }
}

// Reset add form
function resetAddForm() {
    trainerForm.reset();
    previewContainer.classList.add("hidden");
    if (previewImage.src && previewImage.src.startsWith("blob:")) {
        URL.revokeObjectURL(previewImage.src);
    }
    previewImage.src = "";
    previewFileName.textContent = "";
    previewFileSize.textContent = "";
    uploadProgressContainer.classList.add("hidden");
    uploadProgressBar.style.width = "0%";
    uploadProgressPercent.textContent = "0%";
    btnSubmitAdd.disabled = true;
    btnSubmitAdd.textContent = "Save Trainer";
    fileInput.value = "";
}

// Reset edit form
function resetEditForm() {
    editForm.reset();

    editPreviewContainer.classList.add("hidden");

    if (editNewPreview.src && editNewPreview.src.startsWith("blob:")) {
        URL.revokeObjectURL(editNewPreview.src);
    }

    editNewPreview.src = "";

    editPreviewThumb.src = "";
    editPreviewThumb.classList.add("hidden");

    editPreviewFileName.textContent = "";
    editPreviewFileSize.textContent = "";

    editUploadProgressContainer.classList.add("hidden");
    editUploadProgressBar.style.width = "0%";
    editUploadProgressPercent.textContent = "0%";

    editFileInput.value = "";

    btnSubmitEdit.textContent = "Update Trainer";
    btnSubmitEdit.disabled = false;
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
        // Not logged in, redirect to login
        window.location.href = "../login.html";
        return;
    }
    currentUser = user;
    // Display name
    if (user.displayName) {
        userDisplay.textContent = user.displayName;
    } else {
        userDisplay.textContent = "Administrator";
    }
    // Start listening to trainers
    listenTrainers();
});

/* ============================================================
   FIRESTORE LISTENER (Realtime)
   ============================================================ */
let trainersData = [];
let unsubscribe = null;

function listenTrainers() {
    if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
    }
    const trainersRef = collection(db, "trainers");
    const q = query(trainersRef, orderBy("createdAt", "desc"));

    unsubscribe = onSnapshot(q, (snapshot) => {
        trainersData = [];
        snapshot.forEach((doc) => {
            const data = doc.data();
            trainersData.push({
                id: doc.id,
                ...data
            });
        });
        // Apply current filters and render
        applyFiltersAndRender();
        // Hide skeleton, show grid or empty
        skeleton.classList.add("hidden");
        if (trainersData.length === 0) {
            grid.classList.add("hidden");
            emptyState.classList.remove("hidden");
        } else {
            grid.classList.remove("hidden");
            emptyState.classList.add("hidden");
        }
    }, (error) => {
        showToast("Error", "Failed to load trainers: " + error.message, "error");
    });
}

/* ============================================================
   FILTER, SEARCH, SORT
   ============================================================ */
function applyFiltersAndRender() {
    let filtered = [...trainersData];

    // Search
    const searchTerm = searchInput.value.trim().toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(t =>
            (t.name && t.name.toLowerCase().includes(searchTerm)) ||
            (t.designation && t.designation.toLowerCase().includes(searchTerm)) ||
            (t.bio && t.bio.toLowerCase().includes(searchTerm))
        );
    }

    // Status filter
    const status = filterStatus.value;
    if (status !== "all") {
        filtered = filtered.filter(t => t.status === status);
    }

    // Sort (client-side) – we already order by createdAt desc from Firestore,
    // but we also support oldest.
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

    renderTrainers(filtered);
}

// Debounced search
const debouncedSearch = debounce(applyFiltersAndRender, 300);
searchInput.addEventListener("input", debouncedSearch);
filterStatus.addEventListener("change", applyFiltersAndRender);
filterSort.addEventListener("change", applyFiltersAndRender);

/* ============================================================
   RENDER TRAINERS
   ============================================================ */
function renderTrainers(trainers) {
    grid.innerHTML = "";
    if (trainers.length === 0) {
        grid.classList.add("hidden");
        emptyState.classList.remove("hidden");
        return;
    }
    grid.classList.remove("hidden");
    emptyState.classList.add("hidden");

    trainers.forEach((trainer) => {
        const card = document.createElement("div");
        card.className = "trainer-card glass-panel";

        const statusClass = trainer.status === "active" ? "active" : "inactive";
        const statusText = trainer.status === "active" ? "Active" : "Inactive";
        const imageUrl = trainer.imageUrl || "../assets/default-trainer.webp";

        card.innerHTML = `
            <div class="trainer-card-image">
                <img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(trainer.name || 'Trainer')}" loading="lazy" />
                <span class="trainer-card-status ${statusClass}">${escapeHTML(statusText)}</span>
            </div>
            <div class="trainer-card-body">
                <h3 class="trainer-card-name">${escapeHTML(trainer.name || 'Unnamed')}</h3>
                <p class="trainer-card-designation">${escapeHTML(trainer.designation || '')}</p>
                <p class="trainer-card-experience">
                    <i class="fas fa-clock"></i> ${escapeHTML(trainer.experience || 0)} years experience
                </p>
                <p class="trainer-card-bio">${escapeHTML(trainer.bio || '')}</p>
                <div class="trainer-card-actions">
                    <button class="btn btn-outline preview-trainer" data-id="${trainer.id}" aria-label="Preview trainer">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-gold edit-trainer" data-id="${trainer.id}" aria-label="Edit trainer">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-danger delete-trainer" data-id="${trainer.id}" aria-label="Delete trainer">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;

        grid.appendChild(card);

        // Attach event listeners
        const previewBtn = card.querySelector(".preview-trainer");
        const editBtn = card.querySelector(".edit-trainer");
        const deleteBtn = card.querySelector(".delete-trainer");

        previewBtn.addEventListener("click", () => openPreview(trainer));
        editBtn.addEventListener("click", () => openEditModal(trainer.id));
        deleteBtn.addEventListener("click", () => openDeleteModal(trainer.id));
    });
}

/* ============================================================
   PREVIEW MODAL
   ============================================================ */
function openPreview(trainer) {
    const statusClass = trainer.status === "active" ? "active" : "inactive";
    const statusText = trainer.status === "active" ? "Active" : "Inactive";
    const imageUrl = trainer.imageUrl || "https://via.placeholder.com/400x500?text=No+Image";

    previewPhoto.src = imageUrl;
    previewPhoto.alt = escapeHTML(trainer.name || 'Trainer');
    previewStatus.textContent = statusText;
    previewStatus.className = `preview-badge ${statusClass}`;
    previewName.textContent = escapeHTML(trainer.name || 'Unnamed');
    previewDesignation.textContent = escapeHTML(trainer.designation || '');
    const expSpan = previewExperience.querySelector("span");
    if (expSpan) expSpan.textContent = escapeHTML(trainer.experience || 0);
    previewBio.textContent = escapeHTML(trainer.bio || '');

    // Social links
    const facebook = trainer.facebook || '#';
    const instagram = trainer.instagram || '#';
    const whatsapp = trainer.whatsapp || '#';
    previewFacebook.href = facebook;
previewFacebook.target = "_blank";

previewInstagram.href = instagram;
previewInstagram.target = "_blank";

previewWhatsapp.href = whatsapp;
previewWhatsapp.target = "_blank";

    // Show/hide social icons based on presence
    previewFacebook.style.display = facebook !== '#' ? 'inline-flex' : 'none';
    previewInstagram.style.display = instagram !== '#' ? 'inline-flex' : 'none';
    previewWhatsapp.style.display = whatsapp !== '#' ? 'inline-flex' : 'none';

    openModal(modalPreview);
}

/* ============================================================
   ADD TRAINER
   ============================================================ */
btnAdd.addEventListener("click", () => openModal(modalAdd));
btnEmptyAdd.addEventListener("click", () => openModal(modalAdd));

// Drag & Drop for add
dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("dragover");
});
dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        fileInput.files = files;
        handleFilePreview(fileInput, previewImage, previewFileName, previewFileSize, previewContainer);
    }
});

fileInput.addEventListener("change", () => {
    if (fileInput.files.length > 0) {
        handleFilePreview(fileInput, previewImage, previewFileName, previewFileSize, previewContainer);
    } else {
        previewContainer.classList.add("hidden");
        btnSubmitAdd.disabled = true;
    }
});

removePreviewBtn.addEventListener("click", () => {
    fileInput.value = "";
    previewContainer.classList.add("hidden");
    if (previewImage.src && previewImage.src.startsWith("blob:")) {
        URL.revokeObjectURL(previewImage.src);
    }
    previewImage.src = "";
    btnSubmitAdd.disabled = true;
});

function handleFilePreview(input, imgElement, nameSpan, sizeSpan, container) {
    const file = input.files[0];
    if (!file) {
        container.classList.add("hidden");
        return;
    }
    // Validate image
    if (!file.type.startsWith("image/")) {
        showToast("Invalid File", "Please select an image file.", "error");
        input.value = "";
        container.classList.add("hidden");
        btnSubmitAdd.disabled = true;
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast("File Too Large", "Image must be under 10MB.", "error");
        input.value = "";
        container.classList.add("hidden");
        btnSubmitAdd.disabled = true;
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        imgElement.src = e.target.result;
    };
    reader.readAsDataURL(file);
    nameSpan.textContent = file.name;
    sizeSpan.textContent = (file.size / (1024 * 1024)).toFixed(2) + " MB";
    container.classList.remove("hidden");
    btnSubmitAdd.disabled = false;
}

// Add form submit
trainerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const file = fileInput.files[0];
    if (!file) {
        showToast("Error", "Please select a trainer photo.", "error");
        return;
    }

    // Collect form data
    const name = document.getElementById("trainer-name").value.trim();
    const designation = document.getElementById("trainer-designation").value.trim();
    const experience = parseInt(document.getElementById("trainer-experience").value) || 0;
    const status = document.getElementById("trainer-status").value;
    const bio = document.getElementById("trainer-bio").value.trim();
    const facebook = document.getElementById("trainer-facebook").value.trim();
    const instagram = document.getElementById("trainer-instagram").value.trim();
    const whatsapp = document.getElementById("trainer-whatsapp").value.trim();

    if (!name || !designation) {
        showToast("Missing Fields", "Name and Designation are required.", "error");
        return;
    }

    // Upload to Cloudinary
    btnSubmitAdd.disabled = true;
    btnSubmitAdd.textContent = "Uploading...";
    uploadProgressContainer.classList.remove("hidden");
    uploadProgressBar.style.width = "0%";
    uploadProgressPercent.textContent = "0%";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("folder", "trainer");

    const xhr = new XMLHttpRequest();
    xhr.open("POST", CLOUDINARY_UPLOAD_URL, true);

    xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            uploadProgressBar.style.width = percent + "%";
            uploadProgressPercent.textContent = percent + "%";
        }
    });

    try {
        const uploadPromise = new Promise((resolve, reject) => {
            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        resolve(data);
                    } catch (err) {
                        reject(new Error("Invalid response from Cloudinary"));
                    }
                } else {
                    reject(new Error("Upload failed with status: " + xhr.status));
                }
            };
            xhr.onerror = () => reject(new Error("Network error during upload"));
            xhr.send(formData);
        });

        const result = await uploadPromise;
        const imageUrl = result.secure_url;
        const publicId = result.public_id;

        // Save to Firestore
        const trainerData = {
            name,
            designation,
            experience,
            status,
            bio,
            facebook: facebook || "",
            instagram: instagram || "",
            whatsapp: whatsapp || "",
            imageUrl,
            publicId,
            createdAt: serverTimestamp()
        };

        await addDoc(collection(db, "trainers"), trainerData);
        showToast("Success", "Trainer added successfully!", "success");
        closeModal(modalAdd);
    } catch (error) {
        showToast("Upload Error", error.message || "Failed to save trainer.", "error");
        uploadProgressContainer.classList.add("hidden");
        btnSubmitAdd.disabled = false;
        btnSubmitAdd.textContent = "Save Trainer";
    }
});

/* ============================================================
   EDIT TRAINER
   ============================================================ */
let editingTrainerId = null;

async function openEditModal(trainerId) {
    // Find trainer data
    const trainer = trainersData.find(t => t.id === trainerId);
    if (!trainer) {
        showToast("Error", "Trainer not found.", "error");
        return;
    }
    editingTrainerId = trainerId;

    // Populate fields
    editIdField.value = trainerId;
    editName.value = trainer.name || "";
    editDesignation.value = trainer.designation || "";
    editExperience.value = trainer.experience || 0;
    editStatus.value = trainer.status || "active";
    editBio.value = trainer.bio || "";
    editFacebook.value = trainer.facebook || "";
    editInstagram.value = trainer.instagram || "";
    editWhatsapp.value = trainer.whatsapp || "";

    // Show existing image
    if (trainer.imageUrl) {
        editPreviewThumb.src = trainer.imageUrl;
        editPreviewThumb.classList.remove("hidden");
    } else {
        editPreviewThumb.classList.add("hidden");
    }

    // Reset upload previews
    editPreviewContainer.classList.add("hidden");
    editFileInput.value = "";
    if (editNewPreview.src && editNewPreview.src.startsWith("blob:")) {
        URL.revokeObjectURL(editNewPreview.src);
    }
    editNewPreview.src = "";
    editUploadProgressContainer.classList.add("hidden");
    editUploadProgressBar.style.width = "0%";
    editUploadProgressPercent.textContent = "0%";

    openModal(modalEdit);
}

// Edit drag & drop
editDropZone.addEventListener("click", () => editFileInput.click());
editDropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    editDropZone.classList.add("dragover");
});
editDropZone.addEventListener("dragleave", () => {
    editDropZone.classList.remove("dragover");
});
editDropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    editDropZone.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        editFileInput.files = files;
        handleFilePreview(editFileInput, editNewPreview, editPreviewFileName, editPreviewFileSize, editPreviewContainer);
    }
});

editFileInput.addEventListener("change", () => {
    if (editFileInput.files.length > 0) {
        handleFilePreview(editFileInput, editNewPreview, editPreviewFileName, editPreviewFileSize, editPreviewContainer);
    } else {
        editPreviewContainer.classList.add("hidden");
    }
});

removeEditPreviewBtn.addEventListener("click", () => {
    editFileInput.value = "";
    editPreviewContainer.classList.add("hidden");
    if (editNewPreview.src && editNewPreview.src.startsWith("blob:")) {
        URL.revokeObjectURL(editNewPreview.src);
    }
    editNewPreview.src = "";
});

// Edit form submit
editForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const trainerId = editIdField.value;
    if (!trainerId) {
        showToast("Error", "No trainer selected for editing.", "error");
        return;
    }

    // Collect data
    const name = editName.value.trim();
    const designation = editDesignation.value.trim();
    const experience = parseInt(editExperience.value) || 0;
    const status = editStatus.value;
    const bio = editBio.value.trim();
    const facebook = editFacebook.value.trim();
    const instagram = editInstagram.value.trim();
    const whatsapp = editWhatsapp.value.trim();

    if (!name || !designation) {
        showToast("Missing Fields", "Name and Designation are required.", "error");
        return;
    }

    const updateData = {
        name,
        designation,
        experience,
        status,
        bio,
        facebook: facebook || "",
        instagram: instagram || "",
        whatsapp: whatsapp || "",
        updatedAt: serverTimestamp()
    };

    // Check for new image
    const file = editFileInput.files[0];
    if (file) {
        // Upload new image
        btnSubmitEdit.disabled = true;
        btnSubmitEdit.textContent = "Uploading...";
        editUploadProgressContainer.classList.remove("hidden");
        editUploadProgressBar.style.width = "0%";
        editUploadProgressPercent.textContent = "0%";

        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        formData.append("folder", "trainer");

        const xhr = new XMLHttpRequest();
        xhr.open("POST", CLOUDINARY_UPLOAD_URL, true);
        xhr.upload.addEventListener("progress", (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                editUploadProgressBar.style.width = percent + "%";
                editUploadProgressPercent.textContent = percent + "%";
            }
        });

        try {
            const uploadPromise = new Promise((resolve, reject) => {
                xhr.onload = () => {
                    if (xhr.status === 200) {
                        try {
                            const data = JSON.parse(xhr.responseText);
                            resolve(data);
                        } catch (err) {
                            reject(new Error("Invalid response from Cloudinary"));
                        }
                    } else {
                        reject(new Error("Upload failed with status: " + xhr.status));
                    }
                };
                xhr.onerror = () => reject(new Error("Network error during upload"));
                xhr.send(formData);
            });

            const result = await uploadPromise;
            updateData.imageUrl = result.secure_url;
            updateData.publicId = result.public_id;
        } catch (error) {
            showToast("Upload Error", error.message || "Failed to upload image.", "error");
            btnSubmitEdit.disabled = false;
            btnSubmitEdit.textContent = "Update Trainer";
            editUploadProgressContainer.classList.add("hidden");
            return;
        }
    }

    // Update Firestore
    try {
        const docRef = doc(db, "trainers", trainerId);
        await updateDoc(docRef, updateData);
        showToast("Success", "Trainer updated successfully!", "success");
        closeModal(modalEdit);
    } catch (error) {
        showToast("Update Error", error.message || "Failed to update trainer.", "error");
        btnSubmitEdit.disabled = false;
        btnSubmitEdit.textContent = "Update Trainer";
        editUploadProgressContainer.classList.add("hidden");
    }
});

// Reset edit button state when modal closes (done in closeModal)

/* ============================================================
   DELETE TRAINER
   ============================================================ */
function openDeleteModal(trainerId) {
    const trainer = trainersData.find(t => t.id === trainerId);
    if (!trainer) {
        showToast("Error", "Trainer not found.", "error");
        return;
    }
    deleteIdField.value = trainerId;
    deleteNameSpan.textContent = escapeHTML(trainer.name || "this trainer");
    openModal(modalDelete);
}

confirmDeleteBtn.addEventListener("click", async () => {
    const trainerId = deleteIdField.value;
    if (!trainerId) {
        showToast("Error", "No trainer selected for deletion.", "error");
        return;
    }
    try {
        await deleteDoc(doc(db, "trainers", trainerId));
        showToast("Success", "Trainer deleted successfully.", "success");
        closeModal(modalDelete);
    } catch (error) {
        showToast("Delete Error", error.message || "Failed to delete trainer.", "error");
    }
});

/* ============================================================
   INITIALIZATION
   ============================================================ */
// Show skeleton initially, hide grid and empty
grid.classList.add("hidden");
emptyState.classList.add("hidden");
skeleton.classList.remove("hidden");

// Ensure upload buttons are disabled initially
btnSubmitAdd.disabled = true;
btnSubmitEdit.disabled = false; // edit can be submitted without new image

// If auth state triggers listener, it will replace skeleton with content.

// For logout (if needed, but no logout button per spec)
// We could add a logout function if needed later.

console.log("Trainer management initialized.");