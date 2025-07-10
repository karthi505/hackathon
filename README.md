# Energy Optimizer Pro

A web application for tracking resource usage, optimizing energy consumption, and displaying alerts for overusage.

## Features

- Real-time energy usage monitoring
- Device management (add, remove, toggle devices)
- Energy efficiency recommendations
- Alert system for unusual usage patterns
- Responsive design with light/dark mode
- Interactive charts for data visualization

## Technologies Used

- Frontend: HTML5, CSS3, JavaScript (ES6+), Chart.js
- Backend: Python, Flask
- Styling: Custom CSS with CSS Variables for theming

## Getting Started

### Prerequisites

- Python 3.7+
- pip (Python package manager)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd energy-optimizer-pro
   ```

2. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install the required packages:
   ```bash
   pip install -r requirements.txt
   ```

### Running the Application

1. Start the Flask development server:
   ```bash
   python app.py
   ```

2. Open your web browser and navigate to:
   ```
   http://localhost:5000
   ```

## Usage

1. **Dashboard Overview**: View current energy usage, daily consumption, and cost estimates.
2. **Device Management**: Add, remove, or toggle devices on/off.
3. **Alerts**: Get notified about unusual energy usage patterns.
4. **Optimization**: Receive recommendations for optimizing energy usage.

## Project Structure

```
energy-optimizer-pro/
├── index.html          # Main HTML file
├── styles.css          # CSS styles
├── script.js           # Frontend JavaScript
├── app.py              # Flask backend
├── requirements.txt    # Python dependencies
└── README.md           # This file
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
