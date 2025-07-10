// DOM Elements
const currentUsageEl = document.getElementById('currentUsage');
const dailyConsumptionEl = document.getElementById('dailyConsumption');
const costEstimateEl = document.getElementById('costEstimate');
const alertCountEl = document.getElementById('alertCount');
const alertsListEl = document.getElementById('alertsList');
const devicesGridEl = document.getElementById('devicesGrid');
const themeToggle = document.getElementById('themeToggle');
const addDeviceBtn = document.getElementById('addDeviceBtn');
const deviceModal = document.getElementById('deviceModal');
const closeModal = document.querySelector('.close');
const deviceForm = document.getElementById('deviceForm');

// Chart instance
let energyChart;

// Sample data (in a real app, this would come from an API)
let devices = [
    { id: 1, name: 'Living Room AC', type: 'ac', power: 1500, efficiency: 'A++', isOn: false, usage: 0 },
    { id: 2, name: 'Refrigerator', type: 'fridge', power: 200, efficiency: 'A+', isOn: true, usage: 0 },
    { id: 3, name: 'LED Lights', type: 'lighting', power: 50, efficiency: 'A++', isOn: false, usage: 0 },
    { id: 4, name: 'Gaming PC', type: 'computer', power: 500, efficiency: 'B', isOn: false, usage: 0 }
];

let alerts = [];

// Energy cost per kWh (in USD)
const energyCost = 0.14;

// Socket.IO connection
const socket = io('http://' + window.location.hostname + ':5000');

// Initialize the application
function init() {
    // Initialize chart
    initChart();
    
    // Load devices
    renderDevices();
    
    // Load theme preference
    loadTheme();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up WebSocket event listeners
    setupSocketListeners();
    
    // Start monitoring (now handled by WebSocket)
    // startMonitoring(); // Commented out as we're using WebSocket now
    
    // Generate some initial data (will be replaced by real-time data)
    // generateInitialData(); // Commented out as we're using real-time data
}

// Set up event listeners
function setupEventListeners() {
    // Theme toggle
    themeToggle.addEventListener('change', toggleTheme);
    
    // Modal controls
    addDeviceBtn.addEventListener('click', () => deviceModal.style.display = 'flex');
    closeModal.addEventListener('click', () => deviceModal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === deviceModal) {
            deviceModal.style.display = 'none';
        }
    });
    
    // Form submission
    deviceForm.addEventListener('submit', handleAddDevice);
    
    // Use event delegation for device actions
    document.addEventListener('click', (e) => {
        // Handle toggle device
        if (e.target.closest('.toggle-device')) {
            toggleDevice(e);
        }
        // Handle optimize device
        else if (e.target.closest('.optimize-device')) {
            optimizeDevice(e);
        }
        // Handle remove device
        else if (e.target.closest('.remove-device')) {
            removeDevice(e);
        }
    });
}

// Initialize the energy consumption chart
function initChart() {
    const ctx = document.getElementById('energyChart').getContext('2d');
    
    energyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(24).fill().map((_, i) => `${i}:00`),
            datasets: [{
                label: 'Energy Consumption (kWh)',
                data: Array(24).fill(0),
                borderColor: 'rgba(74, 111, 165, 1)',
                backgroundColor: 'rgba(74, 111, 165, 0.2)',
                borderWidth: 2,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'kWh'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            }
        }
    });
}

// Render devices in the grid
function renderDevices() {
    devicesGridEl.innerHTML = '';
    
    if (devices.length === 0) {
        devicesGridEl.innerHTML = '<div class="no-devices">No devices added yet. Click "Add Device" to get started.</div>';
        return;
    }
    
    devices.forEach(device => {
        const deviceEl = document.createElement('div');
        deviceEl.className = `device-card ${device.isOn ? 'device-on' : ''}`;
        deviceEl.innerHTML = `
            <div class="device-header">
                <div class="device-name">${device.name}</div>
                <div class="device-type">${device.type.toUpperCase()}</div>
            </div>
            <div class="device-stats">
                <div class="stat">
                    <div class="stat-label">Power</div>
                    <div class="stat-value">${device.power}W</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Efficiency</div>
                    <div class="stat-value">${device.efficiency}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Status</div>
                    <div class="stat-value">${device.isOn ? 'ON' : 'OFF'}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">Usage</div>
                    <div class="stat-value" id="device-${device.id}-usage">${device.usage.toFixed(2)} kWh</div>
                </div>
            </div>
            <div class="device-actions">
                <div class="action-group">
                    <button class="btn btn-${device.isOn ? 'danger' : 'primary'} btn-sm toggle-device" 
                            data-device-id="${device.id}">
                        ${device.isOn ? 'Turn Off' : 'Turn On'}
                    </button>
                    <button class="btn btn-warning btn-sm optimize-device" 
                            data-device-id="${device.id}">
                        Optimize
                    </button>
                </div>
                <button class="btn btn-outline-danger btn-sm remove-device" 
                        data-device-id="${device.id}" 
                        title="Remove Device">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        devicesGridEl.appendChild(deviceEl);
    });
    
    // Event listeners are now handled through event delegation in setupEventListeners
}

// Toggle device on/off
function toggleDevice(e) {
    const button = e.target.closest('.toggle-device');
    const deviceId = parseInt(button.dataset.deviceId);
    
    console.log('Toggle button clicked - Device ID:', deviceId);
    console.log('Current button classes:', button.className);
    
    // Send toggle request to server via WebSocket
    socket.emit('toggle_device', { device_id: deviceId }, (response) => {
        console.log('Server response:', response);
        if (response && response.error) {
            console.error('Error toggling device:', response.error);
        }
    });
}

// Handle device toggle response from server
function handleDeviceToggled(data) {
    console.log('Received device_toggled event:', data);
    
    // Find the device in our local state
    const device = devices.find(d => d.id === data.device_id);
    if (!device) {
        console.error('Device not found in local state:', data.device_id);
        return;
    }
    
    // Store previous state for comparison
    const wasOn = device.isOn;
    
    // Update device properties from the server response
    device.isOn = data.isOn;
    device.current_power = data.current_power || 0;
    device.status = data.status || (data.isOn ? 'online' : 'offline');
    
    console.log(`Device ${device.id} state changed from ${wasOn ? 'ON' : 'OFF'} to ${device.isOn ? 'ON' : 'OFF'}`);
    
    // Update the UI
    const deviceEl = document.querySelector(`.device-card[data-device-id="${device.id}"]`);
    if (!deviceEl) {
        console.error('Device element not found in DOM for device ID:', device.id);
        // Re-render all devices if we can't find the specific device element
        renderDevices();
        return;
    }
    
    const statusEl = deviceEl.querySelector('.device-status');
    const powerEl = deviceEl.querySelector('.device-power');
    const toggleBtn = deviceEl.querySelector('.toggle-device');
    
    console.log('Updating UI for device:', device.id);
    
    if (statusEl) {
        statusEl.textContent = device.status;
        console.log('Updated status text to:', device.status);
    }
    
    if (powerEl) {
        powerEl.textContent = `${device.current_power.toFixed(1)}W`;
        console.log('Updated power display to:', `${device.current_power.toFixed(1)}W`);
    }
    
    if (toggleBtn) {
        console.log('Toggle button found, current classes:', toggleBtn.className);
        
        // Ensure we have the base classes
        if (!toggleBtn.classList.contains('btn')) {
            toggleBtn.classList.add('btn', 'btn-sm');
        }
        
        // Update button text and classes based on the new state
        if (device.isOn) {
            console.log('Setting button to ON state (red)');
            toggleBtn.textContent = 'Turn Off';
            toggleBtn.classList.remove('btn-primary');
            toggleBtn.classList.add('btn-danger');
        } else {
            console.log('Setting button to OFF state (blue)');
            toggleBtn.textContent = 'Turn On';
            toggleBtn.classList.remove('btn-danger');
            toggleBtn.classList.add('btn-primary');
        }
        
        console.log('Button classes after update:', toggleBtn.className);
        
        // Force a reflow to ensure the transition happens
        void toggleBtn.offsetWidth;
    }
    
    // Add alert when turning on high-power devices
    if (device.isOn && device.power > 1000) {
        addAlert(`High-power device turned on: ${device.name} (${device.power}W)`, 'warning');
    }
    
    // Update the dashboard
    updateDashboard();
}

// Remove a device
async function removeDevice(e) {
    e.stopPropagation();
    
    // Find the closest remove button in case a child element was clicked
    const removeBtn = e.target.closest('.remove-device');
    if (!removeBtn) return;
    
    const deviceId = parseInt(removeBtn.dataset.deviceId);
    const device = devices.find(d => d.id === deviceId);
    
    if (device && confirm(`Are you sure you want to remove ${device.name}?`)) {
        try {
            // Send remove request to server
            const response = await fetch(`/api/devices/${deviceId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Remove device from local state
                devices = devices.filter(d => d.id !== deviceId);
                addAlert(`Device removed: ${device.name}`, 'info');
                renderDevices();
                
                // Update dashboard to reflect changes
                updateDashboard();
            } else {
                const error = await response.json();
                throw new Error(error.message || 'Failed to remove device');
            }
        } catch (error) {
            console.error('Error removing device:', error);
            addAlert(`Failed to remove device: ${error.message}`, 'danger');
        }
    }
}

// Optimize device settings
function optimizeDevice(e) {
    // Find the closest optimize button in case a child element was clicked
    const optimizeBtn = e.target.closest('.optimize-device');
    if (!optimizeBtn) return;
    
    const deviceId = parseInt(optimizeBtn.dataset.deviceId);
    const device = devices.find(d => d.id === deviceId);
    
    if (device) {
        let message = '';
        
        switch(device.type) {
            case 'ac':
                message = `Optimization: Set ${device.name} to 24°C for optimal energy efficiency.`;
                if (device.power > 1500) {
                    message += ' Consider upgrading to a more energy-efficient model.';
                }
                break;
                
            case 'fridge':
                message = `Optimization: Ensure ${device.name} is set between 3-5°C for optimal performance.`;
                break;
                
            case 'lighting':
                message = `Optimization: Consider using natural light during the day for ${device.name}.`;
                if (device.efficiency < 'A+') {
                    message += ' Switch to LED bulbs for better efficiency.';
                }
                break;
                
            case 'computer':
                message = `Optimization: Enable power-saving mode on ${device.name} when not in use.`;
                break;
                
            default:
                message = `Check for firmware updates for ${device.name} to ensure optimal performance.`;
        }
        
        addAlert(message, 'info');
    }
}

// Handle adding a new device
function handleAddDevice(e) {
    e.preventDefault();
    
    const name = document.getElementById('deviceName').value;
    const type = document.getElementById('deviceType').value;
    const power = parseInt(document.getElementById('devicePower').value);
    const efficiency = document.getElementById('deviceEfficiency').value;
    
    const newDevice = {
        id: devices.length > 0 ? Math.max(...devices.map(d => d.id)) + 1 : 1,
        name,
        type,
        power,
        efficiency,
        isOn: false,
        current_power: 0,
        usage: 0,
        efficiency: 'A+',
        status: 'offline',
        last_updated: new Date().toISOString()
    };
    
    devices.push(newDevice);
    
    // Reset form
    deviceForm.reset();
    deviceModal.style.display = 'none';
    
    // Update UI
    renderDevices();
    
    // Add alert
    addAlert(`New device added: ${name}`, 'info');
}

// Set up WebSocket event listeners
function setupSocketListeners() {
    // Handle connection established
    socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        addAlert('Connected to real-time monitoring', 'info');
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
        addAlert('Disconnected from real-time monitoring. Attempting to reconnect...', 'warning');
    });
    
    // Handle connection error
    socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
    });
    
    // Handle energy updates from server
    socket.on('energy_update', (data) => {
        // Update devices with new data
        data.devices.forEach(deviceData => {
            const device = devices.find(d => d.id === deviceData.id);
            if (device) {
                device.current_power = deviceData.current_power;
                device.usage = deviceData.usage;
                device.isOn = deviceData.isOn;
            }
        });
        
        // Update dashboard with new data
        updateDashboardWithData(data);
        
        // Update chart with new data point
        updateChartWithData(data);
    });
    
    // Handle device toggle responses
    socket.on('device_toggled', handleDeviceToggled);
    
    // Handle device removed event
    socket.on('device_removed', (data) => {
        const deviceId = data.device_id;
        const device = devices.find(d => d.id === deviceId);
        
        if (device) {
            devices = devices.filter(d => d.id !== deviceId);
            addAlert(`Device removed: ${device.name}`, 'info');
            renderDevices();
            updateDashboard();
        }
    });
}

// Update energy usage for all devices
function updateEnergyUsage() {
    const now = new Date();
    const hour = now.getHours();
    
    // Update usage for each device
    devices.forEach(device => {
        if (device.isOn) {
            // Add a small random variation to simulate real usage
            const usageIncrement = (device.power / 1000) * (5 / 3600) * (0.9 + Math.random() * 0.2);
            device.usage += usageIncrement;
            
            // Update device usage display
            const usageEl = document.getElementById(`device-${device.id}-usage`);
            if (usageEl) {
                usageEl.textContent = `${device.usage.toFixed(2)} kWh`;
            }
        }
    });
    
    // Update chart with current hour's data
    updateChart(hour);
    
    // Check for alerts
    checkForAlerts();
}

// Update the chart with new data
function updateChartWithData(data) {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Get the chart data
    const chartData = energyChart.data.datasets[0].data;
    
    // Update the current hour's data
    chartData[currentHour] = data.current_power;
    
    // Update the chart
    energyChart.update();
}

// Update the energy chart (fallback)
function updateChart(hour) {
    // This is now a fallback and will only be used if WebSocket is not available
    const data = energyChart.data.datasets[0].data;
    
    // Calculate total current usage from all devices
    const totalCurrentUsage = devices
        .filter(device => device.isOn)
        .reduce((sum, device) => sum + (device.power / 1000), 0);
    
    // Add new data point (scaled to kWh)
    data[hour] = totalCurrentUsage > 0 ? totalCurrentUsage * 0.2 : 0;
    
    // Shift data if we've gone past 24 hours
    if (hour === 0) {
        data.shift();
        data.push(0);
    }
    
    energyChart.update();
}

// Update the dashboard with data from server
function updateDashboardWithData(data) {
    // Update UI with new data
    currentUsageEl.textContent = `${data.current_power.toFixed(2)} kW`;
    dailyConsumptionEl.textContent = `${data.daily_consumption.toFixed(2)} kWh`;
    dailyConsumptionEl.setAttribute('data-value', data.daily_consumption);
    costEstimateEl.textContent = `$${data.daily_cost.toFixed(2)}`;
    
    // Update device usage displays
    data.devices.forEach(deviceData => {
        const usageEl = document.getElementById(`device-${deviceData.id}-usage`);
        if (usageEl) {
            usageEl.textContent = `${deviceData.usage.toFixed(2)} kWh`;
        }
        
        const powerEl = document.getElementById(`device-${deviceData.id}-power`);
        if (powerEl) {
            powerEl.textContent = `${deviceData.current_power.toFixed(2)} kW`;
            
            // Highlight high power usage
            if (deviceData.current_power > 1) { // More than 1kW
                powerEl.classList.add('text-warning');
            } else {
                powerEl.classList.remove('text-warning');
            }
        }
    });
    
    // Highlight high usage
    if (data.current_power > 3) { // Threshold of 3kW
        currentUsageEl.classList.add('text-danger');
        if (Math.random() < 0.1) { // 10% chance to trigger alert each update when over threshold
            addAlert(`High power usage detected: ${data.current_power.toFixed(2)}kW`, 'warning');
        }
    } else {
        currentUsageEl.classList.remove('text-danger');
    }
    
    // Update the dashboard (for any non-WebSocket updates)
    updateDashboard();
}

// Update the dashboard with current stats (fallback)
function updateDashboard() {
    // This is now a fallback and will only be used if WebSocket is not available
    const currentUsage = devices
        .filter(device => device.isOn)
        .reduce((sum, device) => sum + (device.power / 1000), 0);
    
    const dailyConsumption = devices.reduce((sum, device) => sum + (device.usage || 0), 0);
    const costEstimate = dailyConsumption * energyCost;
    
    currentUsageEl.textContent = `${currentUsage.toFixed(2)} kW`;
    dailyConsumptionEl.textContent = `${dailyConsumption.toFixed(2)} kWh`;
    costEstimateEl.textContent = `$${costEstimate.toFixed(2)}`;
    
    const activeAlerts = alerts.filter(alert => !alert.dismissed).length;
    alertCountEl.textContent = activeAlerts;
}

// Add a new alert
function addAlert(message, type = 'info') {
    const now = new Date();
    const timeString = now.toLocaleTimeString();
    
    const alert = {
        id: Date.now(),
        message,
        type,
        time: timeString,
        dismissed: false
    };
    
    alerts.unshift(alert);
    renderAlerts();
    
    // Auto-dismiss after 10 seconds
    setTimeout(() => {
        const alertIndex = alerts.findIndex(a => a.id === alert.id);
        if (alertIndex !== -1) {
            alerts[alertIndex].dismissed = true;
            renderAlerts();
        }
    }, 10000);
    
    return alert;
}

// Render alerts
function renderAlerts() {
    const activeAlerts = alerts.filter(alert => !alert.dismissed);
    
    if (activeAlerts.length === 0) {
        alertsListEl.innerHTML = '<div class="no-alerts">No active alerts</div>';
        return;
    }
    
    alertsListEl.innerHTML = '';
    
    // Only show the 5 most recent alerts
    const recentAlerts = activeAlerts.slice(0, 5);
    
    recentAlerts.forEach(alert => {
        const alertEl = document.createElement('div');
        alertEl.className = `alert-item ${alert.type}`;
        alertEl.innerHTML = `
            <div class="alert-message">${alert.message}</div>
            <div class="alert-time">${alert.time}</div>
        `;
        
        alertsListEl.appendChild(alertEl);
    });
    
    // Update alert count
    alertCountEl.textContent = activeAlerts.length;
}

// Check for potential issues and generate alerts
function checkForAlerts() {
    // Check for devices that have been on for a long time
    devices.forEach(device => {
        if (device.isOn && device.usage > 5 && Math.random() < 0.05) { // 5% chance to trigger per check
            addAlert(`Consider turning off ${device.name} to save energy`, 'warning');
        }
    });
    
    // Check for inefficient devices
    const inefficientDevices = devices.filter(device => 
        ['D', 'E', 'F', 'G'].includes(device.efficiency)
    );
    
    if (inefficientDevices.length > 0 && Math.random() < 0.1) { // 10% chance to trigger per check
        const device = inefficientDevices[0];
        addAlert(`Consider replacing ${device.name} with a more energy-efficient model (current: ${device.efficiency})`, 'warning');
    }
}

// Generate some initial data for the chart
function generateInitialData() {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Generate data for the past 24 hours
    for (let i = 0; i < 24; i++) {
        const hour = (currentHour - i + 24) % 24;
        const baseUsage = 0.3 + Math.sin(hour / 24 * Math.PI * 2) * 0.3;
        const randomFactor = 0.8 + Math.random() * 0.4;
        
        energyChart.data.datasets[0].data[hour] = baseUsage * randomFactor;
    }
    
    energyChart.update();
    
    // Add some initial alerts
    addAlert('Welcome to Energy Optimizer Pro!', 'info');
    addAlert('Monitoring your energy usage...', 'info');
}

// Theme management
function toggleTheme() {
    const isDark = themeToggle.checked;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const isDark = savedTheme === 'dark';
    
    themeToggle.checked = isDark;
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);
