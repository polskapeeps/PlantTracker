document.addEventListener('DOMContentLoaded', () => {
  // ... (keep all the existing DOM element references and constants)
  const plantDisplayArea = document.getElementById('plantDisplayArea');
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
  const noResultsState = document.getElementById('noResultsState');
  const confirmModal = document.getElementById('confirmModal');
  const confirmMessage = document.getElementById('confirmMessage');
  const confirmCancelBtn = document.getElementById('confirmCancelBtn');
  const confirmOkBtn = document.getElementById('confirmOkBtn');
  const formError = document.getElementById('formError');
  const imageError = document.getElementById('imageError');

  // Filter and search elements
  const searchInput = document.getElementById('searchInput');
  const typeFilter = document.getElementById('typeFilter');
  const wateringFilter = document.getElementById('wateringFilter');
  const sortSelect = document.getElementById('sortSelect');
  const groupByType = document.getElementById('groupByType');
  const gridViewBtn = document.getElementById('gridViewBtn');
  const listViewBtn = document.getElementById('listViewBtn');

  const STORAGE_KEY = 'myPlantCollection';
  let currentView = 'grid';
  let allPlants = [];
  let filteredPlants = [];

  // --- Image Compression Functions ---

  /**
   * Compresses an image file to reduce storage size
   * @param {File} file - The image file to compress
   * @param {number} maxWidth - Maximum width for the compressed image
   * @param {number} maxHeight - Maximum height for the compressed image
   * @param {number} quality - Compression quality (0-1)
   * @returns {Promise<string>} Base64 string of compressed image
   */
  const compressImage = (
    file,
    maxWidth = 800,
    maxHeight = 600,
    quality = 0.8
  ) => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to base64 with compression
        try {
          const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedBase64);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  /**
   * Estimates storage usage and shows warning if approaching limit
   */
  const checkStorageUsage = () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY) || '';
      const sizeInBytes = new Blob([data]).size;
      const sizeInMB = (sizeInBytes / (1024 * 1024)).toFixed(2);

      // Warn if approaching 4MB (most browsers have 5-10MB limit)
      if (sizeInMB > 4) {
        console.warn(`Storage usage: ${sizeInMB}MB - approaching limit`);
        showModalError(
          formError,
          `Storage usage high (${sizeInMB}MB). Consider removing old plants or images.`
        );
      }

      return { sizeInMB, isHigh: sizeInMB > 4 };
    } catch (error) {
      console.error('Error checking storage:', error);
      return { sizeInMB: 0, isHigh: false };
    }
  };

  // --- Core Functions (keep existing functions but update fileToBase64) ---

  /**
   * Loads plants from Local Storage.
   */
  const getPlants = () => {
    const plantsJSON = localStorage.getItem(STORAGE_KEY);
    try {
      const plants = plantsJSON ? JSON.parse(plantsJSON) : [];
      return plants.map((plant) => ({
        ...plant,
        dateAdded: plant.dateAdded || Date.now(),
        type: plant.type || 'Other',
      }));
    } catch (e) {
      console.error('Error parsing plants from localStorage', e);
      return [];
    }
  };

  /**
   * Saves plants with storage quota handling
   */
  const savePlants = (plants) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plants));
      checkStorageUsage();
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        throw new Error(
          'Storage quota exceeded. Try removing some plants or images to free up space.'
        );
      }
      throw error;
    }
  };

  /**
   * Converts and compresses a file to Base64 string
   */
  const fileToBase64 = async (file) => {
    try {
      // Check file size and compress accordingly
      if (file.size > 1024 * 1024) {
        // If larger than 1MB
        console.log('Compressing large image...');
        return await compressImage(file, 800, 600, 0.7); // More compression
      } else if (file.size > 500 * 1024) {
        // If larger than 500KB
        console.log('Compressing medium image...');
        return await compressImage(file, 800, 600, 0.8); // Light compression
      } else {
        // Small files, compress lightly to maintain quality
        return await compressImage(file, 800, 600, 0.9);
      }
    } catch (error) {
      console.error('Error compressing image:', error);
      // Fallback to original method if compression fails
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
      });
    }
  };

  // --- Keep all other existing functions unchanged ---
  // (getWateringStatus, getFilteredPlants, createPlantCard, groupPlantsByType,
  //  getTypeIcon, renderPlants, markAsWatered, showModalError, toggleModal, etc.)

  const getWateringStatus = (plant) => {
    if (!plant.nextWatering) return 'none';

    const nextWateringDate = new Date(plant.nextWatering).setHours(0, 0, 0, 0);
    const today = new Date().setHours(0, 0, 0, 0);
    const threeDaysFromNow = today + 3 * 24 * 60 * 60 * 1000;

    if (nextWateringDate < today) return 'overdue';
    if (nextWateringDate <= threeDaysFromNow) return 'due-soon';
    return 'good';
  };

  const getFilteredPlants = () => {
    let plants = [...allPlants];

    const searchTerm = searchInput.value.toLowerCase().trim();
    if (searchTerm) {
      plants = plants.filter(
        (plant) =>
          plant.name.toLowerCase().includes(searchTerm) ||
          (plant.species && plant.species.toLowerCase().includes(searchTerm)) ||
          (plant.notes && plant.notes.toLowerCase().includes(searchTerm)) ||
          (plant.type && plant.type.toLowerCase().includes(searchTerm))
      );
    }

    const typeFilterValue = typeFilter.value;
    if (typeFilterValue) {
      plants = plants.filter((plant) => plant.type === typeFilterValue);
    }

    const wateringFilterValue = wateringFilter.value;
    if (wateringFilterValue) {
      plants = plants.filter((plant) => {
        const status = getWateringStatus(plant);
        switch (wateringFilterValue) {
          case 'overdue':
            return status === 'overdue';
          case 'upcoming':
            return status === 'due-soon';
          case 'watered':
            return status === 'good';
          default:
            return true;
        }
      });
    }

    const sortValue = sortSelect.value;
    plants.sort((a, b) => {
      switch (sortValue) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'type':
          return (a.type || 'Other').localeCompare(b.type || 'Other');
        case 'nextWatering':
          if (!a.nextWatering && !b.nextWatering) return 0;
          if (!a.nextWatering) return 1;
          if (!b.nextWatering) return -1;
          return new Date(a.nextWatering) - new Date(b.nextWatering);
        case 'dateAdded':
          return new Date(b.dateAdded || 0) - new Date(a.dateAdded || 0);
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return plants;
  };

  const createPlantCard = (plant, isListView = false) => {
    const wateringStatus = getWateringStatus(plant);
    const statusClass =
      wateringStatus === 'overdue'
        ? 'watering-overdue'
        : wateringStatus === 'due-soon'
        ? 'watering-due-soon'
        : 'watering-good';

    const typeClass = plant.type
      ? `type-${plant.type.toLowerCase().replace(/[^a-z]/g, '')}`
      : 'type-other';

    if (isListView) {
      return `
        <div class="list-item ${statusClass}">
          <img src="${
            plant.imageUrl ||
            'https://placehold.co/80x80/a0d2a0/333333?text=Plant'
          }" 
               alt="${plant.name}" />
          <div class="list-item-content">
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div class="flex-1">
                <h3 class="text-lg font-bold">${plant.name}</h3>
                <p class="text-sm text-gray-600">${plant.species || 'N/A'}</p>
                <span class="type-badge ${typeClass}">${
        plant.type || 'Other'
      }</span>
              </div>
              <div class="text-sm mt-2 sm:mt-0 sm:text-right">
                <div class="text-blue-600 font-semibold ${
                  wateringStatus === 'overdue'
                    ? 'text-red-600 animate-pulse'
                    : ''
                }">
                  <i class="fas fa-tint mr-1"></i>
                  ${
                    plant.nextWatering
                      ? new Date(plant.nextWatering).toLocaleDateString()
                      : 'Not set'
                  }
                </div>
              </div>
            </div>
            ${
              plant.notes
                ? `<p class="text-sm text-gray-700 mt-2 line-clamp-2">${plant.notes}</p>`
                : ''
            }
          </div>
          <div class="list-item-actions">
            ${
              wateringStatus === 'overdue'
                ? `<button data-id="${plant.id}" class="water-btn quick-action-btn">
                <i class="fas fa-tint"></i> Water
              </button>`
                : ''
            }
            <button data-id="${
              plant.id
            }" class="edit-btn quick-action-btn secondary">
              <i class="fas fa-edit"></i>
            </button>
            <button data-id="${
              plant.id
            }" class="delete-btn quick-action-btn secondary">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    } else {
      return `
        <div class="bg-white rounded-lg shadow-md overflow-hidden transition-transform transform hover:-translate-y-1 ${statusClass}">
          <img src="${
            plant.imageUrl ||
            'https://placehold.co/600x400/a0d2a0/333333?text=My+Plant'
          }" 
               alt="${plant.name}" class="w-full h-48 object-cover">
          <div class="p-4">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-xl font-bold flex-1 truncate">${plant.name}</h3>
              <span class="type-badge ${typeClass} ml-2">${
        plant.type || 'Other'
      }</span>
            </div>
            <p class="text-gray-600 text-sm mb-2">${plant.species || 'N/A'}</p>
            <p class="text-gray-700 text-sm mb-4 h-12 overflow-y-auto">${
              plant.notes || 'No notes.'
            }</p>
            <div class="text-sm text-blue-600 font-semibold ${
              wateringStatus === 'overdue' ? 'text-red-600 animate-pulse' : ''
            }">
              <i class="fas fa-tint mr-1"></i>
              Next Watering: ${
                plant.nextWatering
                  ? new Date(plant.nextWatering).toLocaleDateString()
                  : 'Not set'
              }
            </div>
          </div>
          <div class="px-4 py-2 bg-gray-50 flex justify-between items-center">
            <div class="flex space-x-2">
              ${
                wateringStatus === 'overdue'
                  ? `<button data-id="${plant.id}" class="water-btn text-green-600 hover:text-green-800">
                  <i class="fas fa-tint"></i>
                </button>`
                  : ''
              }
            </div>
            <div class="flex space-x-2">
              <button data-id="${
                plant.id
              }" class="edit-btn text-gray-500 hover:text-blue-600">
                <i class="fas fa-edit"></i>
              </button>
              <button data-id="${
                plant.id
              }" class="delete-btn text-gray-500 hover:text-red-600">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }
  };

  const groupPlantsByType = (plants) => {
    const groups = {};
    plants.forEach((plant) => {
      const type = plant.type || 'Other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(plant);
    });
    return groups;
  };

  const getTypeIcon = (type) => {
    const icons = {
      Cactus: 'fas fa-cactus',
      Succulent: 'fas fa-leaf',
      Houseplant: 'fas fa-seedling',
      Herb: 'fas fa-herbs',
      'Tropical Plant': 'fas fa-palm-tree',
      'Flowering Plant': 'fas fa-flower',
      Fern: 'fas fa-fern',
      'Tree/Shrub': 'fas fa-tree',
      Other: 'fas fa-leaf',
    };
    return icons[type] || 'fas fa-leaf';
  };

  const renderPlants = () => {
    loadingState.classList.add('hidden');
    allPlants = getPlants();
    filteredPlants = getFilteredPlants();

    plantDisplayArea.innerHTML = '';

    emptyState.classList.toggle('hidden', allPlants.length > 0);
    noResultsState.classList.toggle(
      'hidden',
      allPlants.length === 0 || filteredPlants.length > 0
    );

    if (filteredPlants.length === 0) return;

    const isListView = currentView === 'list';
    const shouldGroup = groupByType.checked;

    if (shouldGroup) {
      const groups = groupPlantsByType(filteredPlants);
      Object.keys(groups)
        .sort()
        .forEach((type) => {
          const groupDiv = document.createElement('div');
          groupDiv.className = 'group-section';

          const headerDiv = document.createElement('div');
          headerDiv.className = 'group-header';
          headerDiv.innerHTML = `
          <i class="${getTypeIcon(type)}"></i>
          <span>${type}</span>
          <span class="text-sm opacity-80">(${groups[type].length})</span>
        `;

          const contentDiv = document.createElement('div');
          contentDiv.className = isListView ? 'list-view' : 'grid-view';
          contentDiv.innerHTML = groups[type]
            .map((plant) => createPlantCard(plant, isListView))
            .join('');

          groupDiv.appendChild(headerDiv);
          groupDiv.appendChild(contentDiv);
          plantDisplayArea.appendChild(groupDiv);
        });
    } else {
      const contentDiv = document.createElement('div');
      contentDiv.className = isListView ? 'list-view' : 'grid-view';
      contentDiv.innerHTML = filteredPlants
        .map((plant) => createPlantCard(plant, isListView))
        .join('');
      plantDisplayArea.appendChild(contentDiv);
    }
  };

  const markAsWatered = (plantId) => {
    let plants = getPlants();
    const plantIndex = plants.findIndex((p) => p.id === plantId);
    if (plantIndex !== -1) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      plants[plantIndex].nextWatering = nextWeek.toISOString().split('T')[0];
      savePlants(plants);
      renderPlants();
    }
  };

  const showModalError = (element, message) => {
    element.textContent = message;
    element.style.display = message ? 'block' : 'none';
  };

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
        document.getElementById('plantType').value = plant.type || '';
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

  /** Updated handleSavePlant with better error handling */
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
      type: document.getElementById('plantType').value,
      species: document.getElementById('plantSpecies').value,
      notes: document.getElementById('plantNotes').value,
      nextWatering: document.getElementById('nextWatering').value,
      imageUrl: existingPlant?.imageUrl || null,
      dateAdded: existingPlant?.dateAdded || Date.now(),
    };

    try {
      if (file) {
        saveButton.textContent = 'Compressing image...';
        plantData.imageUrl = await fileToBase64(file);
      }

      if (existingPlant) {
        plants = plants.map((p) => (p.id === plantId ? plantData : p));
      } else {
        plants.push(plantData);
      }

      savePlants(plants);
      renderPlants();
      toggleModal(false);
    } catch (error) {
      console.error('Error saving plant:', error);
      if (error.message.includes('Storage quota exceeded')) {
        showModalError(
          formError,
          'Storage full! Try removing some plants or use smaller images.'
        );
      } else {
        showModalError(
          formError,
          'Could not save plant. Try using a smaller image.'
        );
      }
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save Plant';
    }
  };

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

  const switchView = (viewType) => {
    currentView = viewType;

    gridViewBtn.classList.toggle('active', viewType === 'grid');
    listViewBtn.classList.toggle('active', viewType === 'list');

    renderPlants();
  };

  // --- Event Listeners ---

  addPlantBtn.addEventListener('click', () => toggleModal(true));
  closeModalBtn.addEventListener('click', () => toggleModal(false));
  cancelBtn.addEventListener('click', () => toggleModal(false));
  plantForm.addEventListener('submit', handleSavePlant);

  gridViewBtn.addEventListener('click', () => switchView('grid'));
  listViewBtn.addEventListener('click', () => switchView('list'));

  searchInput.addEventListener('input', renderPlants);
  typeFilter.addEventListener('change', renderPlants);
  wateringFilter.addEventListener('change', renderPlants);
  sortSelect.addEventListener('change', renderPlants);
  groupByType.addEventListener('change', renderPlants);

  plantImageFileInput.addEventListener('change', () => {
    showModalError(imageError, null);
    if (plantImageFileInput.files.length > 0) {
      const file = plantImageFileInput.files[0];
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

  plantDisplayArea.addEventListener('click', (e) => {
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

    if (button.classList.contains('water-btn')) {
      markAsWatered(id);
    }
  });

  // --- Initial Load ---
  renderPlants();

  // Check storage usage on load
  setTimeout(checkStorageUsage, 1000);
});
