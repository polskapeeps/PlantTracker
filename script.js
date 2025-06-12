// --- Firebase SDK Imports ---
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import {
  getFirestore,
  collection,
  onSnapshot,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  setLogLevel,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js';

// --- App State ---
let db, auth, storage;
let userId;
let currentPlants = [];
let isAuthReady = false;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'cacti-app-default';

// --- Firebase Configuration ---
// This will be populated by the environment you are in.
// For local development, you will need to replace this with your own Firebase config object.
const firebaseConfig = {
  apiKey: 'AIzaSyBltatQTniTVY0Fj-seLuc3bpO7JhB5sIs',
  authDomain: 'planttracker-355e2.firebaseapp.com',
  projectId: 'planttracker-355e2',
  storageBucket: 'planttracker-355e2.appspot.com',
  messagingSenderId: '696840995334',
  appId: '1:696840995334:web:ca06037643511a20c8b987',
  measurementId: 'G-WH7NWE0RM2',
};

// --- DOM Element References ---
let plantGrid,
  plantModal,
  addPlantBtn,
  closeModalBtn,
  cancelBtn,
  plantForm,
  imagePreview,
  plantImageFileInput,
  fileNameSpan,
  userIdDisplay,
  loadingState,
  emptyState,
  confirmModal,
  confirmMessage,
  confirmCancelBtn,
  confirmOkBtn,
  formError,
  imageError,
  uploadProgress,
  progressBarFill;

// --- Core Functions ---

/** Renders the plant cards in the grid */
function renderPlants(plants) {
  if (!plantGrid) return;
  plantGrid.innerHTML = '';

  loadingState.classList.add('hidden');
  emptyState.classList.toggle('hidden', plants.length > 0);

  plants.forEach((plant) => {
    const isWateringDue =
      plant.nextWatering &&
      new Date(plant.nextWatering).setHours(0, 0, 0, 0) <=
        new Date().setHours(0, 0, 0, 0);
    const card = document.createElement('div');
    card.className = `bg-white rounded-lg shadow-md overflow-hidden transition-transform transform hover:-translate-y-1 ${
      isWateringDue ? 'border-2 border-red-500' : ''
    }`;
    card.innerHTML = `
            <img src="${
              plant.imageUrl ||
              'https://placehold.co/600x400/a0d2a0/333333?text=My+Plant'
            }" alt="${
      plant.name
    }" class="w-full h-48 object-cover" onerror="this.onerror=null;this.src='https://placehold.co/600x400/a0d2a0/FF0000?text=Image+Error';">
            <div class="p-4">
                <h3 class="text-xl font-bold">${plant.name}</h3>
                <p class="text-gray-600 text-sm mb-2">${
                  plant.species || 'N/A'
                }</p>
                <p class="text-gray-700 text-sm mb-4 h-12 overflow-y-auto">${
                  plant.notes || 'No notes.'
                }</p>
                <div class="text-sm text-blue-600 font-semibold ${
                  isWateringDue ? 'text-red-600 animate-pulse' : ''
                }">
                   <i class="fas fa-tint mr-1"></i>
                   Next Watering: ${
                     plant.nextWatering
                       ? new Date(plant.nextWatering).toLocaleDateString()
                       : 'Not set'
                   }
                </div>
            </div>
            <div class="px-4 py-2 bg-gray-50 flex justify-end space-x-2">
                <button data-id="${
                  plant.id
                }" class="edit-btn text-gray-500 hover:text-blue-600"><i class="fas fa-edit"></i></button>
                <button data-id="${
                  plant.id
                }" class="delete-btn text-gray-500 hover:text-red-600"><i class="fas fa-trash"></i></button>
            </div>
        `;
    plantGrid.appendChild(card);
  });
}

/** Shows or hides an error message in the main modal */
function showModalError(element, message) {
  if (!element) return;
  element.textContent = message;
  element.style.display = message ? 'block' : 'none';
}

/** Toggles the visibility of the main modal and resets the form */
function toggleModal(show, plant = null) {
  if (!plantForm || !plantModal) return;
  plantForm.reset();
  imagePreview.src = '';
  imagePreview.classList.add('hidden');
  fileNameSpan.textContent = 'No file chosen';
  document.getElementById('plantId').value = '';
  document.getElementById('existingImagePath').value = '';
  showModalError(formError, null);
  showModalError(imageError, null);
  uploadProgress.style.display = 'none';
  progressBarFill.style.width = '0%';

  document.body.classList.toggle('modal-open', show);

  if (show) {
    document.getElementById('modalTitle').textContent = plant
      ? 'Edit Plant'
      : 'Add a New Plant';
    if (plant) {
      document.getElementById('plantId').value = plant.id;
      document.getElementById('plantName').value = plant.name || '';
      document.getElementById('plantSpecies').value = plant.species || '';
      document.getElementById('plantNotes').value = plant.notes || '';
      document.getElementById('nextWatering').value = plant.nextWatering || '';
      document.getElementById('existingImagePath').value =
        plant.imagePath || '';
      if (plant.imageUrl) {
        imagePreview.src = plant.imageUrl;
        imagePreview.classList.remove('hidden');
        fileNameSpan.textContent = 'Current image';
      }
    }
    plantModal.classList.remove('hidden');
  } else {
    plantModal.classList.add('hidden');
  }
}

/** Shows a confirmation dialog */
function showConfirmation(message, onConfirm) {
  confirmMessage.textContent = message;
  confirmModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  confirmOkBtn.onclick = () => {
    confirmModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    onConfirm();
  };
  confirmCancelBtn.onclick = () => {
    confirmModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  };
}

/** Uploads a file to Firebase Storage and returns the URL and path */
function uploadFile(file) {
  return new Promise((resolve, reject) => {
    if (!storage || !userId)
      return reject(new Error('Storage or User not initialized.'));

    const imagePath = `images/${userId}/${Date.now()}-${file.name}`;
    const storageRef = ref(storage, imagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        uploadProgress.style.display = 'block';
        progressBarFill.style.width = progress + '%';
      },
      (error) => {
        console.error('Upload failed:', error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({ downloadURL, imagePath });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

// --- Firestore & Storage Interaction ---

/** Fetches plants from Firestore in real-time */
function fetchPlants() {
  if (!db || !userId) {
    console.log('Firestore or user not ready, skipping fetch.');
    return;
  }
  console.log(`Setting up listener for user: ${userId}`);
  const plantsCollection = collection(
    db,
    'artifacts',
    appId,
    'users',
    userId,
    'plants'
  );
  const q = query(plantsCollection);

  onSnapshot(
    q,
    (snapshot) => {
      currentPlants = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      currentPlants.sort((a, b) => a.name.localeCompare(b.name));
      renderPlants(currentPlants);
    },
    (error) => {
      console.error('Error fetching plants: ', error);
      loadingState.textContent =
        'Error loading collection. Check Firestore rules.';
    }
  );
}

/** Saves or updates a plant in Firestore */
async function handleSavePlant(e) {
  e.preventDefault();
  if (!db || !userId) {
    console.error('Save aborted: DB or user not ready.');
    showModalError(formError, 'Error: App not connected to database.');
    return;
  }

  showModalError(formError, null);
  const saveButton = document.getElementById('saveBtn');
  saveButton.disabled = true;
  saveButton.textContent = 'Saving...';

  const plantId = document.getElementById('plantId').value;
  const file = plantImageFileInput.files[0];
  const existingPlant = plantId
    ? currentPlants.find((p) => p.id === plantId)
    : null;

  let plantData = {
    name: document.getElementById('plantName').value,
    species: document.getElementById('plantSpecies').value,
    notes: document.getElementById('plantNotes').value,
    nextWatering: document.getElementById('nextWatering').value,
    imageUrl: existingPlant?.imageUrl || null,
    imagePath: existingPlant?.imagePath || null,
  };
  let uploadedImageRef = null;
  try {
    console.log('Step 1: Checking for image file...');
    if (file) {
      console.log('Step 2: Uploading image to Storage...');
      const { downloadURL, imagePath } = await uploadFile(file);
      plantData.imageUrl = downloadURL;
      plantData.imagePath = imagePath;
      uploadedImageRef = ref(storage, imagePath);
      console.log('Step 3: Image upload successful.');
    } else {
      console.log('Step 1a: No new image file found.');
    }

    const plantsCollection = collection(
      db,
      'artifacts',
      appId,
      'users',
      userId,
      'plants'
    );

    if (plantId) {
      console.log('Step 4: Updating existing document in Firestore...');
      const plantRef = doc(
        db,
        'artifacts',
        appId,
        'users',
        userId,
        'plants',
        plantId
      );
      await updateDoc(plantRef, plantData);
      console.log('Step 5: Firestore document updated successfully.');
    } else {
      console.log('Step 4: Creating new document in Firestore...');
      await addDoc(plantsCollection, plantData);
      console.log('Step 5: Firestore document created successfully.');
    }
    toggleModal(false);
  } catch (error) {
    console.error('CRITICAL ERROR during save process: ', error);
    if (uploadedImageRef) {
      try {
        await deleteObject(uploadedImageRef);
        showModalError(formError, 'Save failed. Uploaded file removed.');
      } catch (cleanupError) {
        console.error('Failed to delete uploaded file:', cleanupError);
        showModalError(formError, `Error: ${error.message}`);
      }
    } else {
      showModalError(formError, `Error: ${error.message}`);
    }
  } finally {
    saveButton.disabled = false;
    saveButton.textContent = 'Save Plant';
  }
}

/** Deletes a plant and its image */
async function deletePlant(id) {
  if (!db || !userId || !id) return;

  const plantToDelete = currentPlants.find((p) => p.id === id);
  if (!plantToDelete) return;

  showConfirmation('Are you sure you want to delete this plant?', async () => {
    try {
      // 1. Delete the image from Storage if it exists
      if (plantToDelete.imagePath) {
        const imageRef = ref(storage, plantToDelete.imagePath);
        try {
          await deleteObject(imageRef);
        } catch (storageError) {
          // Ignore "object-not-found" error, as it means the file is already gone.
          if (storageError.code !== 'storage/object-not-found') {
            throw storageError;
          }
        }
      }

      // 2. Delete the document from Firestore
      const plantRef = doc(
        db,
        'artifacts',
        appId,
        'users',
        userId,
        'plants',
        id
      );
      await deleteDoc(plantRef);
    } catch (error) {
      console.error('Error deleting plant: ', error);
    }
  });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  // Assign DOM Elements now that the DOM is loaded
  plantGrid = document.getElementById('plantGrid');
  plantModal = document.getElementById('plantModal');
  addPlantBtn = document.getElementById('addPlantBtn');
  closeModalBtn = document.getElementById('closeModalBtn');
  cancelBtn = document.getElementById('cancelBtn');
  plantForm = document.getElementById('plantForm');
  imagePreview = document.getElementById('imagePreview');
  plantImageFileInput = document.getElementById('plantImageFile');
  fileNameSpan = document.getElementById('fileName');
  userIdDisplay = document.getElementById('userIdDisplay');
  loadingState = document.getElementById('loadingState');
  emptyState = document.getElementById('emptyState');
  confirmModal = document.getElementById('confirmModal');
  confirmMessage = document.getElementById('confirmMessage');
  confirmCancelBtn = document.getElementById('confirmCancelBtn');
  confirmOkBtn = document.getElementById('confirmOkBtn');
  formError = document.getElementById('formError');
  imageError = document.getElementById('imageError');
  uploadProgress = document.getElementById('uploadProgress');
  progressBarFill = uploadProgress.querySelector('.progress-bar-fill');

  // --- Event Listeners ---
  addPlantBtn.addEventListener('click', () => toggleModal(true));
  closeModalBtn.addEventListener('click', () => toggleModal(false));
  cancelBtn.addEventListener('click', () => toggleModal(false));
  plantForm.addEventListener('submit', handleSavePlant);

  plantImageFileInput.addEventListener('change', () => {
    showModalError(imageError, null);
    if (plantImageFileInput.files.length > 0) {
      const file = plantImageFileInput.files[0];
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
        showModalError(imageError, 'File is too large (max 5MB).');
        plantImageFileInput.value = '';
        return;
      }
      fileNameSpan.textContent = file.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview.src = e.target.result;
        imagePreview.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    } else {
      fileNameSpan.textContent = 'No file chosen';
      imagePreview.src = '';
      imagePreview.classList.add('hidden');
    }
  });

  plantGrid.addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const id = button.dataset.id;
    if (button.classList.contains('delete-btn')) {
      deletePlant(id);
    }
    if (button.classList.contains('edit-btn')) {
      const plantToEdit = currentPlants.find((p) => p.id === id);
      if (plantToEdit) {
        toggleModal(true, plantToEdit);
      }
    }
  });

  // --- Firebase Initialization ---
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    await setPersistence(auth, browserLocalPersistence);
    storage = getStorage(app); // Initialize Storage
    setLogLevel('debug');

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        userId = user.uid;
        isAuthReady = true;
        userIdDisplay.textContent = `User ID: ${userId}`;
        fetchPlants();
      } else {
        try {
          if (
            typeof __initial_auth_token !== 'undefined' &&
            __initial_auth_token
          ) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (authError) {
          console.error('Authentication failed:', authError);
          loadingState.textContent = 'Could not authenticate. Please refresh.';
        }
      }
    });
  } catch (e) {
    console.error('Firebase initialization failed', e);
    loadingState.textContent = 'Error initializing application. Check console.';
  }
});
