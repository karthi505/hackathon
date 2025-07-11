from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room, leave_room
from datetime import datetime, timedelta
import json
import os
import random
from threading import Thread, Event, Lock
import time

app = Flask(__name__, static_folder='.', static_url_path='')

# Thread lock for thread-safe operations
device_lock = Lock()
app.config['SECRET_KEY'] = 'your-secret-key-here'
CORS(app)
# Using 'threading' as the async mode for better compatibility
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Thread for background tasks
thread = None
thread_stop_event = Event()

# In-memory data store (in a real app, use a database)
devices = [
    {"id": 1, "name": "Living Room AC", "type": "ac", "power": 1500, "efficiency": "A++", "isOn": False, "usage": 0, "current_power": 0},
    {"id": 2, "name": "Refrigerator", "type": "fridge", "power": 200, "efficiency": "A+", "isOn": True, "usage": 0, "current_power": 0},
    {"id": 3, "name": "LED Lights", "type": "lighting", "power": 50, "efficiency": "A++", "isOn": False, "usage": 0, "current_power": 0},
    {"id": 4, "name": "Gaming PC", "type": "computer", "power": 500, "efficiency": "B", "isOn": False, "usage": 0, "current_power": 0}
]

# Store active clients
active_clients = set()

# Store historical data for the last 24 hours
historical_data = {}
for hour in range(24):
    historical_data[hour] = {
        'hour': hour,
        'consumption': 0,
        'cost': 0,
        'devices': {}
    }

alerts = []

# API Routes
@app.route('/api/devices', methods=['GET'])
def get_devices():
    return jsonify(devices)

@app.route('/api/devices/<int:device_id>', methods=['GET'])
def get_device(device_id):
    device = next((d for d in devices if d['id'] == device_id), None)
    if device is None:
        return jsonify({"error": "Device not found"}), 404
    return jsonify(device)

@app.route('/api/devices', methods=['POST'])
def add_device():
    if not request.json or 'name' not in request.json:
        return jsonify({"error": "Device name is required"}), 400
    
    # Get the next available ID
    with device_lock:
        used_ids = {d['id'] for d in devices}
        next_id = 1
        while next_id in used_ids:
            next_id += 1
    
    # Create the new device with all required fields
    new_device = {
        'id': next_id,
        'name': request.json['name'],
        'type': request.json.get('type', 'other'),
        'power': int(request.json.get('power', 100)),
        'efficiency': request.json.get('efficiency', 'B'),
        'isOn': request.json.get('isOn', False),
        'current_power': 0,
        'usage': 0,
        'status': 'offline',
        'last_updated': datetime.utcnow().isoformat() + 'Z'
    }
    
    with device_lock:
        devices.append(new_device)
    
    print(f"Added new device: {new_device}")
    
    # Emit WebSocket event to all clients
    socketio.emit('device_added', new_device, namespace='/')
    
    return jsonify(new_device), 201

@app.route('/api/devices/<int:device_id>', methods=['PUT'])
def update_device(device_id):
    device = next((d for d in devices if d['id'] == device_id), None)
    if device is None:
        return jsonify({"error": "Device not found"}), 404
    
    data = request.json
    for key, value in data.items():
        if key in device and key != 'id':
            device[key] = value
    
    return jsonify(device)

@app.route('/api/devices/<int:device_id>', methods=['DELETE'])
def delete_device(device_id):
    global devices
    device = next((d for d in devices if d['id'] == device_id), None)
    if device is None:
        return jsonify({"status": "error", "message": "Device not found"}), 404
    
    # Remove the device
    with device_lock:
        devices = [d for d in devices if d['id'] != device_id]
    
    # Emit WebSocket event to all clients
    socketio.emit('device_removed', {'device_id': device_id}, namespace='/')
    
    return jsonify({
        "status": "success",
        "message": f"Device {device_id} removed successfully"
    })

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    return jsonify(alerts)

@app.route('/api/energy/usage', methods=['GET'])
def get_energy_usage():
    # Simulate energy usage data (in a real app, this would come from sensors)
    now = datetime.now()
    hour = now.hour
    
    # Calculate total current usage from all devices
    total_usage = sum(d['power'] / 1000 for d in devices if d['isOn'])
    
    # Add some randomness to simulate real usage
    base_usage = 0.5 + (hour / 24 * 2 * 3.14159) * 0.4
    random_factor = 0.8 + (hash(str(now.minute)) % 100) / 100 * 0.4
    
    return jsonify({
        'current_usage': total_usage,
        'daily_consumption': sum(d['usage'] for d in devices),
        'cost_estimate': sum(d['usage'] for d in devices) * 0.14,  # $0.14 per kWh
        'timestamp': now.isoformat()
    })

# Serve the main HTML file
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

def background_thread():
    """Background task that updates device data and broadcasts to clients"""
    while not thread_stop_event.is_set():
        now = datetime.now()
        current_hour = now.hour
        
        # Update device data
        total_power = 0
        total_consumption = 0
        total_cost = 0
        
        for device in devices:
            if device['isOn']:
                # Add some randomness to simulate real usage
                variation = 0.8 + (random.random() * 0.4)  # 0.8 to 1.2
                device['current_power'] = (device['power'] / 1000) * variation  # Convert to kW
                device['usage'] += (device['current_power'] * 5) / 3600  # Update usage for 5s interval
            else:
                device['current_power'] = 0
                
            total_power += device['current_power']
            total_consumption += device['usage']
            
        # Calculate cost (assuming $0.14 per kWh)
        total_cost = total_consumption * 0.14
        
        # Update historical data
        historical_data[current_hour]['consumption'] = total_consumption
        historical_data[current_hour]['cost'] = total_cost
        historical_data[current_hour]['devices'] = {
            device['id']: {
                'power': device['current_power'],
                'usage': device['usage'],
                'isOn': device['isOn']
            } for device in devices
        }
        
        # Prepare data to send to clients
        data = {
            'timestamp': now.isoformat(),
            'current_power': total_power,
            'daily_consumption': total_consumption,
            'daily_cost': total_cost,
            'devices': [
                {
                    'id': d['id'],
                    'current_power': d['current_power'],
                    'usage': d['usage'],
                    'isOn': d['isOn']
                } for d in devices
            ]
        }
        
        # Broadcast to all connected clients
        socketio.emit('energy_update', data, namespace='/')
        
        # Wait for 5 seconds before next update
        time.sleep(5)

@socketio.on('connect', namespace='/')
def handle_connect():
    global thread
    print('Client connected')
    
    # Start the background thread only if it's not already running
    if thread is None:
        thread = Thread(target=background_thread)
        thread.daemon = True
        thread.start()
    
    # Send initial data to the newly connected client
    emit('connection_response', {'data': 'Connected to Energy Monitor'})

@socketio.on('disconnect', namespace='/')
def handle_disconnect():
    print('Client disconnected')

@socketio.on('toggle_device', namespace='/')
def handle_toggle_device(data):
    device_id = data.get('device_id')
    print(f"Toggling device {device_id}")
    
    # Find the device by ID
    device = next((d for d in devices if d['id'] == device_id), None)
    
    if device:
        # Toggle the device state
        new_state = not device['isOn']
        device['isOn'] = new_state
        
        # Set current power based on the new state
        if new_state:
            # When turning on, set current_power to the device's power rating
            device['current_power'] = device.get('power', 0)
            device['status'] = 'online'
        else:
            # When turning off, set current_power to 0
            device['current_power'] = 0
            device['status'] = 'offline'
        
        print(f"Device {device_id} toggled to {'on' if new_state else 'off'}")
        
        # Broadcast the update to all clients
        emit('device_toggled', 
             {
                 'device_id': device_id, 
                 'isOn': new_state,
                 'current_power': device['current_power'],
                 'status': device['status']
             }, 
             broadcast=True)
        
        return {'status': 'success', 'isOn': new_state}
    
    print(f"Device {device_id} not found")
    return {'status': 'error', 'message': 'Device not found'}

if __name__ == '__main__':
    print('Starting server...')
    socketio.run(app, debug=True, port=5000, use_reloader=False)
