from flask import Flask, request, jsonify, send_from_directory
import os

# Tự động xác định đường dẫn thư mục gốc của dự án
base_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.join(base_dir, '..', 'Frontend')

app = Flask(__name__, static_folder=frontend_dir)

# 1. Trả về file index.html khi truy cập http://127.0.0.1:5000/
@app.route('/')
def index():
    return send_from_directory(os.path.join(frontend_dir, 'HTML'), 'index.html')

# 2. Tự động phục vụ các file tĩnh (JS, CSS, Data)
@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(frontend_dir, path)

# 3. API xử lý tìm đường
@app.route('/api/find_route', methods=['POST'])
def find_route():
    data = request.get_json()
    start_id = data.get('start')
    end_id = data.get('end')
    
    print(f"Nhận yêu cầu từ Frontend: Đi từ {start_id} đến {end_id}")

    # Giả lập kết quả (Bạn sẽ thay bằng thuật toán AI sau)
    return jsonify({
        "status": "success",
        "path": [start_id, end_id], 
        "estimated_time": 10
    })

if __name__ == '__main__':
    print("\n" + "="*50)
    print(" SERVER ĐANG CHẠY TẠI: http://127.0.0.1:5000")
    print("="*50 + "\n")
    app.run(port=5000, debug=True)