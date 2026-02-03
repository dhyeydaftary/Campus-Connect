// Load event metadata
async function loadEventMeta() {
    const meta = await API.getEventsMeta();

    // Populate event types
    const typeSelect = document.getElementById('event-type');
    meta.eventTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type.toLowerCase();
        option.textContent = type;
        typeSelect.appendChild(option);
    });
    // Populate target entities
    const entitySelect = document.getElementById('target-entity');
    meta.targetEntities.forEach(entity => {
        const option = document.createElement('option');
        option.value = entity.id;
        option.textContent = `${entity.name} (${entity.type})`;
        entitySelect.appendChild(option);
    });
}
// Reset form
window.resetForm = function() {
    document.getElementById('event-form').reset();
    document.getElementById('success-message').style.display = 'none';
}
// Handle form submit
async function handleSubmit(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<div class="spinner" style="width: 18px; height: 18px; border-width: 2px;"></div> Creating...';
    const eventData = {
        title: document.getElementById('event-title').value,
        description: document.getElementById('event-description').value,
        date: document.getElementById('event-date').value,
        type: document.getElementById('event-type').value,
        targetEntity: document.getElementById('target-entity').value
    };
    const result = await API.createEvent(eventData);
    submitBtn.disabled = false;
    submitBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14"/><path d="M5 12h14"/>
        </svg>
        Create Event
    `;
    if (result.success) {
        document.getElementById('success-message').style.display = 'block';
        document.getElementById('event-form').reset();

        // Hide success message after 5 seconds
        setTimeout(() => {
            document.getElementById('success-message').style.display = 'none';
        }, 5000);
    }
}
// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadEventMeta();
    document.getElementById('event-form').addEventListener('submit', handleSubmit);
});