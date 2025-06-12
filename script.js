document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Element References ---
  const plantGrid = document.getElementById('plantGrid');
  const plantModal = document.getElementById('plantModal');
  const addPlantBtn = document.getElementById('addPlantBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const plantForm = document.getElementById('plantForm');
  const imagePreview = document.getElementById('imagePreview');
  const plantImageFileInput = document.getElementById('plantImageFile');
  const fileNameSpan = document.getElementById('fileName');
  const loadingState = document.getElementById('loadingState');
  const emptyState = document.getElementById('emptyState');
  const confirmModal = document.getElementById('confirmModal');
  const confirmMessage = document.getElementById('confirmMessage');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const confirmOkBtn = document.getElementById('confirmOkBtn');
  const formError = document.getElementById('formError');
  const imageError = document.getElementById('imageError');

  const STORAGE_KEY = 'myPlantCollection';

  // --- Core Functions ---

  /**
   * Loads plants from Local Storage.
   * @returns {Array} An array of plant objects.
   */
  const getPlants = () => {
    const plantsJSON = localStorage.getItem(STORAGE_KEY);
    try {
      return plantsJSON ? JSON.parse(plantsJSON) : [];
    } catch (e) {
      console.error('Error parsing plants from localStorage', e);
      return [];
    }
  };

  /**
   * Saves the entire plant array to Local Storage.
   * @param {Array} plants - The array of plant objects to save.
   */
  const savePlants = (plants) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
  };

  /**
   * Renders the plant cards in the grid.
   */
  const renderPlants = () => {
    loadingState.classList.add('hidden');
    const plants = getPlants();
    plantGrid.innerHTML = '';

    emptyState.classList.toggle('hidden', plants.length > 0);

    plants.sort((a, b) => a.name.localeCompare(b.name));

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
                }" alt="${plant.name}" class="w-full h-48 object-cover">
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
  };

  /** Shows or hides an error message in the main modal */
  const showModalError = (element, message) => {
    element.textContent = message;
    element.style.display = message ? 'block' : 'none';
  };

  /** Converts a file to a Base64 string for storage */
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  /** Toggles the visibility of the main modal and resets the form */
  const toggleModal = (show, plant = null) => {
    plantForm.reset();
    imagePreview.src = '';
    imagePreview.classList.add('hidden');
    fileNameSpan.textContent = 'No file chosen';
    document.getElementById('plantId').value = '';
    showModalError(formError, null);
    showModalError(imageError, null);

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
        document.getElementById('nextWatering').value =
          plant.nextWatering || '';
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
  };

  /** Saves or updates a plant */
  const handleSavePlant = async (e) => {
    e.preventDefault();

    const saveButton = document.getElementById('saveBtn');
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    const plantId = document.getElementById('plantId').value;
    const file = plantImageFileInput.files[0];
    let plants = getPlants();
    let existingPlant = plantId ? plants.find((p) => p.id === plantId) : null;

    let plantData = {
      id: existingPlant ? existingPlant.id : Date.now().toString(),
      name: document.getElementById('plantName').value,
      species: document.getElementById('plantSpecies').value,
      notes: document.getElementById('plantNotes').value,
      nextWatering: document.getElementById('nextWatering').value,
      imageUrl: existingPlant?.imageUrl || null,
    };

    try {
      if (file) {
        plantData.imageUrl = await fileToBase64(file);
      }

      if (existingPlant) {
        // Update existing plant
        plants = plants.map((p) => (p.id === plantId ? plantData : p));
      } else {
        // Add new plant
        plants.push(plantData);
      }

      savePlants(plants);
      renderPlants();
      toggleModal(false);
    } catch (error) {
      console.error('Error saving plant:', error);
      showModalError(
        formError,
        'Could not save plant. Check console for details.'
      );
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save Plant';
    }
  };

  /** Shows a confirmation dialog */
  const showConfirmation = (message, onConfirm) => {
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
  };

  // --- Event Listeners ---
  addPlantBtn.addEventListener('click', () => toggleModal(true));
  closeModalBtn.addEventListener('click', () => toggleModal(false));
  cancelBtn.addEventListener('click', () => toggleModal(false));
  plantForm.addEventListener('submit', handleSavePlant);

  plantImageFileInput.addEventListener('change', () => {
    showModalError(imageError, null);
    if (plantImageFileInput.files.length > 0) {
      const file = plantImageFileInput.files[0];
      // Generous 4MB limit for Base64 string
      if (file.size > 4 * 1024 * 1024) {
        showModalError(imageError, 'File is too large (max 4MB).');
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
      showConfirmation('Are you sure you want to delete this plant?', () => {
        let plants = getPlants();
        plants = plants.filter((p) => p.id !== id);
        savePlants(plants);
        renderPlants();
      });
    }
    if (button.classList.contains('edit-btn')) {
      const plants = getPlants();
      const plantToEdit = plants.find((p) => p.id === id);
      if (plantToEdit) {
        toggleModal(true, plantToEdit);
      }
    }
  });

  // --- Initial Load ---
  renderPlants();
});
