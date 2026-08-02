import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";
import { collection, query,  orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

// ==========================================
// CONFIGURATION & GLOBAL STATE
// ==========================================
const CLOUDINARY_URL = 'https://api.cloudinary.com/v1_1/g92cbbtl/auto/upload';
const UPLOAD_PRESET = 'bmfitnessgallery';
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB

let galleryData = [];
let currentUploadFile = null;
let currentDeleteId = null;
let isInitialLoad = true;

// ==========================================
// DOM ELEMENTS
// ==========================================
const DOM = {
    // Auth & Header
    userDisplayName: document.getElementById('user-display-name'),
    btnLogout: document.getElementById('btn-logout'),
    
    // Actions & Toolbar
    btnUploadImage: document.getElementById('btn-trigger-upload-image'),
    btnUploadVideo: document.getElementById('btn-trigger-upload-video'),
    btnEmptyUpload: document.getElementById('btn-empty-upload'),
    searchInput: document.getElementById('search-input'),
    filterType: document.getElementById('filter-type'),
    filterCategory: document.getElementById('filter-category'),
    filterSort: document.getElementById('filter-sort'),
    
    // Containers
    gallerySkeleton: document.getElementById('gallery-skeleton'),
    galleryGrid: document.getElementById('gallery-grid'),
    galleryEmpty: document.getElementById('gallery-empty'),
    toastContainer: document.getElementById('toast-container'),
    
    // Upload Modal
    modalUpload: document.getElementById('modal-upload'),
    uploadTypeLabel: document.getElementById('upload-type-label'),
    uploadForm: document.getElementById('upload-form'),
    uploadMediaType: document.getElementById('upload-media-type'),
    uploadFileInput: document.getElementById('upload-file-input'),
    uploadTitle: document.getElementById('upload-title'),
    uploadCategory: document.getElementById('upload-category'),
    uploadDescription: document.getElementById('upload-description'),
    dropZone: document.getElementById('drop-zone'),
    dropZoneIcon: document.getElementById('drop-zone-icon'),
    dropZoneRestrictions: document.getElementById('drop-zone-restrictions'),
    previewContainer: document.getElementById('upload-file-preview-container'),
    previewMediaWrapper: document.getElementById('preview-media-wrapper'),
    previewFileName: document.getElementById('preview-file-name'),
    previewFileSize: document.getElementById('preview-file-size'),
    btnRemoveFile: document.getElementById('btn-remove-selected-file'),
    btnSubmitUpload: document.getElementById('btn-submit-upload'),
    uploadProgressContainer: document.getElementById('upload-progress-container'),
    uploadProgressBar: document.getElementById('upload-progress-bar'),
    uploadProgressPercent: document.getElementById('upload-progress-percent'),
    
    // Edit Modal
    modalEdit: document.getElementById('modal-edit'),
    editForm: document.getElementById('edit-form'),
    editMediaId: document.getElementById('edit-media-id'),
    editThumbnailImg: document.getElementById('edit-thumbnail-img'),
    editThumbnailVideo: document.getElementById('edit-thumbnail-video'),
    editTitle: document.getElementById('edit-title'),
    editCategory: document.getElementById('edit-category'),
    editDescription: document.getElementById('edit-description'),
    
    // Preview Modal
    modalPreview: document.getElementById('modal-preview'),
    lightboxContentContainer: document.getElementById('lightbox-content-container'),
    lightboxCategory: document.getElementById('lightbox-category'),
    lightboxTitle: document.getElementById('lightbox-title'),
    lightboxDescription: document.getElementById('lightbox-description'),
    
    // Delete Modal
    modalDelete: document.getElementById('modal-delete'),
    deleteItemTitle: document.getElementById('delete-item-title'),
    deleteMediaId: document.getElementById('delete-media-id'),
    btnConfirmDelete: document.getElementById('btn-confirm-delete'),
    
    // Shared
    closeButtons: document.querySelectorAll('[data-close]'),
    modals: document.querySelectorAll('.modal-overlay')
};

// ==========================================
// INITIALIZATION
// ==========================================
function init() {
    setupAuth();
    setupEventListeners();
    setupModals();
    setupDragAndDrop();
}

// ==========================================
// AUTHENTICATION
// ==========================================
function setupAuth() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
           DOM.userDisplayName.textContent =
    user.displayName || "Administrator";
            listenToFirestore();
        } else {
            window.location.href = '../login.html';
        }
    });

 }
// ==========================================
// FIRESTORE LISTENER & DATA MANAGEMENT
// ==========================================
function listenToFirestore() {
    const galleryQuery = query(
    collection(db, "gallery"),
    orderBy("createdAt", "desc")
);

onSnapshot(galleryQuery, (snapshot) => {
        galleryData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        if (isInitialLoad) {
            DOM.gallerySkeleton.classList.add('hidden');
            DOM.galleryGrid.classList.remove('hidden');
            isInitialLoad = false;
        }
        if (galleryData.length === 0) {
    DOM.galleryEmpty.classList.remove("hidden");
    DOM.galleryGrid.classList.add("hidden");
} else {
    DOM.galleryEmpty.classList.add("hidden");
    DOM.galleryGrid.classList.remove("hidden");
}
        renderGallery();
    }, (error) => {
        showToast('Error loading gallery data.', 'error');
        console.error("Firestore Listener Error:", error);
    });
}

function escapeHTML(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}

function applyFilters() {
    let filtered = [...galleryData];
    
    // Search
    const searchTerm = DOM.searchInput.value
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
    if (searchTerm) {
        filtered = filtered.filter(item => 
            (item.title && item.title.toLowerCase().includes(searchTerm)) ||
            (item.description && item.description.toLowerCase().includes(searchTerm)) ||
            (item.category && item.category.toLowerCase().includes(searchTerm))
        );
    }
    
    // Type Filter
    const type = DOM.filterType.value;
    if (type !== 'all') {
        filtered = filtered.filter(item => item.type === type);
    }
    
    // Category Filter
    const category = DOM.filterCategory.value;
    if (category !== 'all') {
        filtered = filtered.filter(item => item.category === category);
    }
    
    // Sort
    const sort = DOM.filterSort.value;
    filtered.sort((a, b) => {
        const timeA = a.createdAt ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt ? b.createdAt.toMillis() : 0;
        return sort === 'newest' ? timeB - timeA : timeA - timeB;
    });
    
    return filtered;
}

// ==========================================
// RENDER UI
// ==========================================
function renderGallery() {
    const filteredData = applyFilters();
    DOM.galleryGrid.innerHTML = '';
    
    if (filteredData.length === 0) {
        DOM.galleryGrid.classList.add('hidden');
        DOM.galleryEmpty.classList.remove('hidden');
    } else {
        DOM.galleryEmpty.classList.add('hidden');
        DOM.galleryGrid.classList.remove('hidden');
        
        filteredData.forEach(item => {
            const card = document.createElement('article');
            card.className = 'gallery-card glass-panel';
            
            let mediaHtml = '';
            if (item.type === 'image') {
                mediaHtml = `<img
src="${item.url}"
alt="${escapeHTML(item.title)}"
class="card-media-element"
loading="lazy"
decoding="async">`;
            } else {
                mediaHtml = `
    <video
        class="card-media-element"
        src="${item.url}"
        preload="metadata"
        playsinline
        muted
    ></video>

    <div class="video-indicator">
        <i class="fas fa-play"></i>
    </div>
`;
            }

            card.innerHTML = `
<div class="gallery-card-media"
     tabindex="0"
     role="button"
     aria-label="Preview ${escapeHTML(item.title)}">

    ${mediaHtml}

    <span class="gallery-card-badge">
        ${escapeHTML(item.category)}
    </span>

</div>

<div class="gallery-card-body">

    <div class="gallery-card-category">
        ${escapeHTML(item.category)}
    </div>

    <h3 class="gallery-card-title">
        ${escapeHTML(item.title)}
    </h3>

    <p class="gallery-card-desc">
        ${escapeHTML(item.description || "No description provided.")}
    </p>

    <div class="gallery-card-actions">

        <button
            type="button"
            class="btn btn-outline btn-edit">

            <i class="fas fa-edit"></i>
            Edit

        </button>

        <button
            type="button"
            class="btn btn-danger btn-delete">

            <i class="fas fa-trash"></i>
            Delete

        </button>

    </div>

</div>
`;
            
            
            
            // Event Listeners for generated buttons
            card.querySelector('.gallery-card-media').addEventListener('click', () => openPreviewModal(item));

card.querySelector('.gallery-card-media').addEventListener('keydown', (e) => {

    if (e.key === 'Enter' || e.key === ' ') {

        e.preventDefault();

        openPreviewModal(item);

    }

});


            card.querySelector('.btn-edit').addEventListener('click', () => openEditModal(item));
            card.querySelector('.btn-delete').addEventListener('click', () => openDeleteModal(item));
            
            DOM.galleryGrid.appendChild(card);
        });
    }
}

// ==========================================
// EVENT LISTENERS SETUP
// ==========================================
function setupEventListeners() {
    // Toolbar
    DOM.searchInput.addEventListener(
    "input",
    debounce(renderGallery,300)
);
    DOM.filterType.addEventListener('change', renderGallery);
    DOM.filterCategory.addEventListener('change', renderGallery);
    DOM.filterSort.addEventListener('change', renderGallery);
    
    // Upload Triggers
    DOM.btnUploadImage.addEventListener('click', () => openUploadModal('image'));
    DOM.btnUploadVideo.addEventListener('click', () => openUploadModal('video'));
    DOM.btnEmptyUpload.addEventListener('click', () => openUploadModal('image'));
    
    // Upload Form
    DOM.uploadFileInput.addEventListener('change', handleFileSelect);
    DOM.btnRemoveFile.addEventListener('click', resetUploadPreview);
    DOM.uploadForm.addEventListener('submit', handleUploadSubmit);
    
    // Edit & Delete Forms
    DOM.editForm.addEventListener('submit', handleEditSubmit);
    DOM.btnConfirmDelete.addEventListener('click', handleConfirmDelete);
}

// ==========================================
// MODAL MANAGEMENT
// ==========================================
function setupModals() {
    // Close via Close buttons or Cancel buttons
    DOM.closeButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const modal = btn.closest('.modal-overlay');
            closeModal(modal);
        });
    });

    // Close via Click Outside
    DOM.modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal(modal);
            }
        });
    });

    // Close via Escape Key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay:not(.hidden)');
            if (activeModal) closeModal(activeModal);
        }
    });
}

function openModal(modal) {
    modal.classList.remove('hidden');
    document.body.style.overflow = "hidden";
    // Basic focus trap or setting focus on first input
    const firstInput = modal.querySelector('input, button, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstInput) firstInput.focus();
}

function closeModal(modal) {
    modal.classList.add('hidden');
    document.body.style.overflow = "";
    if (modal.id === "modal-preview") {

    const video =
    DOM.lightboxContentContainer.querySelector("video");

    if(video){

        video.pause();

        video.removeAttribute("src");

        video.load();

    }

    DOM.lightboxContentContainer.innerHTML="";

}


    if(modal.id==="modal-upload"){

        resetUploadForm();

    }

}
    // Stop video playback 
    
   

// ==========================================
// DRAG & DROP & UPLOAD LOGIC
// ==========================================
function setupDragAndDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        DOM.dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        DOM.dropZone.addEventListener(eventName, () => {
            DOM.dropZone.classList.add('drag-active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        DOM.dropZone.addEventListener(eventName, () => {
            DOM.dropZone.classList.remove('drag-active');
        }, false);
    });

    DOM.dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            processFile(files[0]);
        }
    });

    DOM.dropZone.addEventListener('click', () => DOM.uploadFileInput.click());
    DOM.dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            DOM.uploadFileInput.click();
        }
    });
}

function openUploadModal(type) {
    DOM.uploadMediaType.value = type;
    DOM.uploadTypeLabel.textContent = type.charAt(0).toUpperCase() + type.slice(1);
    
    if (type === 'image') {
        DOM.uploadFileInput.accept = 'image/jpeg, image/png, image/webp, image/gif';
        DOM.dropZoneIcon.className = 'fas fa-image drop-icon';
        DOM.dropZoneRestrictions.textContent = 'Supported formats: JPG, PNG, WEBP, GIF (Max 10MB)';
    } else {
        DOM.uploadFileInput.accept = 'video/mp4, video/webm, video/ogg';
        DOM.dropZoneIcon.className = 'fas fa-video drop-icon';
        DOM.dropZoneRestrictions.textContent = 'Supported formats: MP4 (Max 100MB)';
    }
    
    openModal(DOM.modalUpload);
}

function handleFileSelect(e) {
    if (e.target.files.length > 0) {
        processFile(e.target.files[0]);
    }
}

function processFile(file) {
    const type = DOM.uploadMediaType.value;
    
    // Validate
    if (type === 'image') {
        if (!file.type.startsWith('image/')) {
            showToast('Please select a valid image file.', 'error');
            return;
        }
        if (file.size > MAX_IMAGE_SIZE) {
            showToast('Image exceeds 10MB limit.', 'error');
            return;
        }
    } else if (type === 'video') {
        if (!file.type.startsWith('video/')) {
            showToast('Please select a valid video file.', 'error');
            return;
        }
        if (file.size > MAX_VIDEO_SIZE) {
            showToast('Video exceeds 100MB limit.', 'error');
            return;
        }
    }
    
    currentUploadFile = file;
    generatePreview(file, type);
}

function generatePreview(file, type) {
    DOM.previewFileName.textContent = file.name;
    DOM.previewFileSize.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    DOM.previewMediaWrapper.innerHTML = '';

    const url = URL.createObjectURL(file);

    if (type === 'image') {
        const img = document.createElement('img');
        img.src = url;
        img.alt = file.name;
        img.onload = () => URL.revokeObjectURL(url);
        DOM.previewMediaWrapper.appendChild(img);
    } else {
        const video = document.createElement('video');
        video.src = url;
        video.muted = true;
        video.playsInline = true;
        video.controls = true;
        DOM.previewMediaWrapper.appendChild(video);
    }

    DOM.dropZone.classList.add('hidden');
    DOM.previewContainer.classList.remove('hidden');
    DOM.btnSubmitUpload.disabled = false;
}

function resetUploadPreview() {
    currentUploadFile = null;
    DOM.uploadFileInput.value = '';
    DOM.previewContainer.classList.add('hidden');
    DOM.dropZone.classList.remove('hidden');
    DOM.btnSubmitUpload.disabled = true;
    DOM.previewMediaWrapper.innerHTML = '';
}

function resetUploadForm() {
    DOM.uploadForm.reset();
    resetUploadPreview();
    DOM.uploadProgressContainer.classList.add('hidden');
    DOM.uploadProgressBar.style.width = '0%';
    DOM.uploadProgressPercent.textContent = '0%';
}

// ==========================================
// UPLOAD & FIRESTORE SAVE LOGIC
// ==========================================
function handleUploadSubmit(e) {
    e.preventDefault();
    if (!currentUploadFile) return;

    if (!DOM.uploadForm.checkValidity()) {
        DOM.uploadForm.reportValidity();
        return;
    }

    DOM.btnSubmitUpload.disabled = true;
    DOM.btnRemoveFile.disabled = true;
    DOM.uploadProgressContainer.classList.remove('hidden');
    
    uploadToCloudinary(currentUploadFile)
        .then(async (cloudinaryData) => {
            await saveToFirestore({
                title: DOM.uploadTitle.value.trim(),
                category: DOM.uploadCategory.value,
                description: DOM.uploadDescription.value.trim(),
                type: DOM.uploadMediaType.value,
                url: cloudinaryData.secure_url,
                publicId: cloudinaryData.public_id
            });
            showToast('Media uploaded successfully.', 'success');

            resetUploadForm();

            closeModal(DOM.modalUpload);
        })
        .catch((error) => {
            console.error(error);
            showToast('Upload failed. Please try again.', 'error');
            DOM.btnSubmitUpload.disabled = false;
            DOM.btnRemoveFile.disabled = false;
            DOM.uploadProgressContainer.classList.add('hidden');
            DOM.uploadProgressBar.style.width = '0%';
            DOM.uploadProgressPercent.textContent = '0%';
        });
}

function uploadToCloudinary(file) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const formData = new FormData();
        
        formData.append('file', file);
        formData.append('upload_preset', UPLOAD_PRESET);
        formData.append("folder", "gallery");
        
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                DOM.uploadProgressBar.style.width = `${percent}%`;
                DOM.uploadProgressPercent.textContent = `${percent}%`;
            }
        });
        
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(JSON.parse(xhr.responseText));
            } else {
                reject(new Error(xhr.responseText));
            }
        });
        
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));
        
        xhr.open('POST', CLOUDINARY_URL);
        xhr.send(formData);
    });
}

async function saveToFirestore(data) {

    const galleryCol = collection(db, "gallery");

    await addDoc(galleryCol, {

        ...data,

        createdAt: serverTimestamp()

    });

}

// ==========================================
// EDIT LOGIC
// ==========================================
function openEditModal(item) {
    DOM.editMediaId.value = item.id;
    DOM.editTitle.value = item.title;
    DOM.editCategory.value = item.category;
    DOM.editDescription.value = item.description || '';
    
    DOM.editThumbnailImg.classList.add('hidden');
    DOM.editThumbnailVideo.classList.add('hidden');
    
    if (item.type === 'image') {
        DOM.editThumbnailImg.src = item.url;
        DOM.editThumbnailImg.classList.remove('hidden');
    } else {
    	DOM.editThumbnailVideo.pause();
        DOM.editThumbnailVideo.src = item.url;
        DOM.editThumbnailVideo.classList.remove('hidden');
        DOM.editThumbnailVideo.controls = true;
    }
    
    openModal(DOM.modalEdit);
}

async function handleEditSubmit(e) {
    e.preventDefault();
    if (!DOM.editForm.checkValidity()) {
        DOM.editForm.reportValidity();
        return;
    }

    const id = DOM.editMediaId.value;
    const btnSubmit = document.getElementById('btn-submit-edit');
    btnSubmit.disabled = true;

    try {
        const docRef = doc(db, 'gallery', id);
        await updateDoc(docRef, {
            title: DOM.editTitle.value.trim(),
            category: DOM.editCategory.value,
            description: DOM.editDescription.value.trim()
        });
        
        showToast('Media details updated successfully.', 'success');
        closeModal(DOM.modalEdit);
    } catch (error) {
        console.error("Update Error:", error);
        showToast('Failed to update media details.', 'error');
    } finally {
        btnSubmit.disabled = false;
    }
}

// ==========================================
// DELETE LOGIC
// ==========================================
function openDeleteModal(item) {
    currentDeleteId = item.id;
    DOM.deleteItemTitle.textContent = item.title;
    openModal(DOM.modalDelete);
}

async function handleConfirmDelete() {
    if (!currentDeleteId) return;
    
    DOM.btnConfirmDelete.disabled = true;
    DOM.btnConfirmDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    
    try {
        await deleteDoc(doc(db, 'gallery', currentDeleteId));
        showToast('Media deleted permanently.', 'success');
        currentDeleteId = null;
        closeModal(DOM.modalDelete);
    } catch (error) {
        console.error("Delete Error:", error);
        showToast('Failed to delete media.', 'error');
    } finally {
        currentDeleteId = null;
        DOM.btnConfirmDelete.disabled = false;
        DOM.btnConfirmDelete.innerHTML =
'<i class="fas fa-trash"></i> Confirm Delete';
    }
}

// ==========================================
// PREVIEW (LIGHTBOX) LOGIC
// ==========================================
function openPreviewModal(item) {
    DOM.lightboxContentContainer.innerHTML = "";

    if (item.type === "image") {

        const img = document.createElement("img");
        img.src = item.url;
        img.alt = item.title;
        img.loading = "lazy";

        DOM.lightboxContentContainer.appendChild(img);

    } else {

        const video = document.createElement("video");

video.src = item.url;
video.controls = true;
video.playsInline = true;
video.preload = "metadata";
video.autoplay = false;
video.muted = false;

        // iPhone/Safari compatibility
        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "");

        video.addEventListener("loadedmetadata", () => {
            video.play().catch(err => {
                console.log("Video play failed:", err);
            });
        });

        DOM.lightboxContentContainer.appendChild(video);
    }

    DOM.lightboxCategory.textContent = item.category;
    DOM.lightboxTitle.textContent = item.title;
    DOM.lightboxDescription.textContent =
        item.description || "No description provided.";

    openModal(DOM.modalPreview);
}
// ==========================================
// TOAST NOTIFICATION SYSTEM
// ==========================================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-exclamation-circle';
    if (type === 'warning') iconClass = 'fa-exclamation-triangle';

    toast.innerHTML = `
        <div class="toast-icon"><i class="fas ${iconClass}"></i></div>
        <div class="toast-content">${message}</div>
        <button class="toast-close" aria-label="Close notification">&times;</button>
    `;

    DOM.toastContainer.appendChild(toast);
    
    // Animate in (assuming CSS handles class-based animation)
    requestAnimationFrame(() => toast.classList.add('show'));

    const closeToast = () => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
        // Fallback cleanup
        setTimeout(() => { if(toast.parentNode) toast.remove(); }, 300);
    };

    toast.querySelector('.toast-close').addEventListener('click', closeToast);

    // Auto dismiss
    setTimeout(closeToast, 5000);
}

function debounce(fn, delay = 300) {

    let timer;

    return (...args) => {

        clearTimeout(timer);

        timer = setTimeout(() => fn(...args), delay);

    };

}
// Boot up
document.addEventListener('DOMContentLoaded', init); 