# Mock TV2 Translation Service
from flask import Flask, request, jsonify
import time

app = Flask(__name__)

@app.route('/translate', methods=['POST'])
def translate():
    # Simulate processing time
    time.sleep(1)

    # Mock response
    return jsonify({
        "raw": "xin chao the gioi",
        "refined": "Xin chào",
        "warnings": [],
        "duration": 1.0,
        "status": "success"
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8002, debug=True)
