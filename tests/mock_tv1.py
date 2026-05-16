# Mock TV1 Feature Extraction Service
from flask import Flask, request, jsonify
import time

app = Flask(__name__)

@app.route('/features', methods=['POST'])
def extract_features():
    # Simulate processing time
    time.sleep(2)

    # Mock response
    return jsonify({
        "features": [0.1, 0.2, 0.3] * 100,  # Mock feature vector
        "duration": 2.0,
        "status": "success"
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8001, debug=True)
