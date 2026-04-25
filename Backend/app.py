from flask import Flask, request, jsonify, send_from_directory
import os
import json
import networkx as nx
import heapq  
from math import radians, cos, sin, asin, sqrt

# --- CẤU HÌNH ĐƯỜNG DẪN ---
base_dir = os.path.dirname(os.path.abspath(__file__))
frontend_dir = os.path.abspath(os.path.join(base_dir, '..', 'Frontend'))
data_dir = os.path.join(frontend_dir, 'Data')

app = Flask(__name__, static_folder=frontend_dir)
G = nx.Graph()

def haversine(lon1, lat1, lon2, lat2):
    """Tính khoảng cách thực giữa 2 trạm (km)"""
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon, dlat = lon2 - lon1, lat2 - lat1 
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    return 2 * asin(sqrt(a)) * 6371

# --- THUẬT TOÁN DIJKSTRA ---
def manual_dijkstra(graph, start_node, end_node):
    # 1. Khởi tạo khoảng cách vô cực cho tất cả các trạm
    distances = {node: float('infinity') for node in graph.nodes()}
    distances[start_node] = 0
    
    # 2. Hàng đợi ưu tiên để luôn chọn trạm có khoảng cách ngắn nhất (distance, node)
    pq = [(0, start_node)]
    
    # 3. Lưu vết đường đi
    previous_nodes = {node: None for node in graph.nodes()}
    
    while pq:
        current_distance, current_node = heapq.heappop(pq)
        
        # Nếu đã đến đích, dừng lại và dựng lại đường đi
        if current_node == end_node:
            path = []
            while current_node is not None:
                path.append(current_node)
                current_node = previous_nodes[current_node]
            return path[::-1], distances[end_node]
            
        # Nếu khoảng cách lấy ra lớn hơn khoảng cách đã biết, bỏ qua
        if current_distance > distances[current_node]:
            continue
            
        # Xét các trạm kề
        for neighbor in graph.neighbors(current_node):
            weight = graph[current_node][neighbor]['weight']
            distance = current_distance + weight
            
            # Nếu tìm thấy đường đi ngắn hơn đến trạm kề
            if distance < distances[neighbor]:
                distances[neighbor] = distance
                previous_nodes[neighbor] = current_node
                heapq.heappush(pq, (distance, neighbor))
                
    return None, float('infinity')

def build_subway_graph():
    global G
    G.clear()
    try:
        # 1. Lọc các tuyến là "MRT" từ lines_clean.json
        lines_file = os.path.join(data_dir, 'lines_clean.json')
        with open(lines_file, 'r', encoding='utf-8') as f:
            lines_data = json.load(f)
            lines_list = lines_data if isinstance(lines_data, list) else list(lines_data.values())[0]
            valid_line_ids = {str(l.get('LINE_ID') or l.get('ID')).strip() 
                              for l in lines_list 
                              if str(l.get('TYPEE') or l.get('TYPE')).strip().upper() == 'MRT'}

        # 2. Lọc trình tự trạm thuộc các tuyến MRT từ station_line_clean.json
        seq_file = os.path.join(data_dir, 'station_line_clean.json')
        with open(seq_file, 'r', encoding='utf-8') as f:
            seq_data = json.load(f)
            seq_list = seq_data if isinstance(seq_data, list) else list(seq_data.values())[0]

        valid_station_ids = set()
        mrt_sequences = {}
        for item in seq_list:
            l_id = str(item.get('LINE_ID') or item.get('LINE')).strip()
            if l_id in valid_line_ids:
                s_id = str(item.get('STATION_ID') or item.get('STATION')).strip()
                valid_station_ids.add(s_id)
                if l_id not in mrt_sequences: mrt_sequences[l_id] = []
                mrt_sequences[l_id].append(item)

        # 3. Nạp thông tin chi tiết trạm từ stops_raw.json
        stops_file = os.path.join(data_dir, 'stops_raw.json')
        with open(stops_file, 'r', encoding='utf-8') as f:
            stops_data = json.load(f)
            stops_list = stops_data if isinstance(stops_data, list) else list(stops_data.values())[0]
            
            for stop in stops_list:
                s_id = str(stop.get('stop_id') or stop.get('ID')).strip()
                if s_id in valid_station_ids:
                    G.add_node(s_id, 
                               name=stop.get('stop_name') or stop.get('NAME'),
                               lat=float(stop.get('stop_lat') or stop.get('LAT')),
                               lon=float(stop.get('stop_lon') or stop.get('LON')))

        # 4. Thiết lập các cạnh nối (Edges) và trọng số
        for line_id, stations in mrt_sequences.items():
            stations.sort(key=lambda x: int(x.get('STOP_SEQUENCE') or x.get('SEQUENCE') or 0))
            for i in range(len(stations) - 1):
                u = str(stations[i].get('STATION_ID') or stations[i].get('STATION')).strip()
                v = str(stations[i+1].get('STATION_ID') or stations[i+1].get('STATION')).strip()
                if G.has_node(u) and G.has_node(v):
                    dist = haversine(G.nodes[u]['lon'], G.nodes[u]['lat'], 
                                     G.nodes[v]['lon'], G.nodes[v]['lat'])
                    G.add_edge(u, v, weight=round(dist, 3), line=line_id)
        
        print("\n" + "="*50)
        print(f"✅ ĐỒ THỊ MRT ĐÃ SẴN SÀNG")
        print(f"📊 Số lượng trạm (Nodes): {G.number_of_nodes()}")
        print(f"📊 Số lượng liên kết (Edges): {G.number_of_edges()}")
        print("="*50 + "\n")
        
    except Exception as e:
        print(f"❌ Lỗi xây dựng đồ thị: {str(e)}")

build_subway_graph()

# --- API ROUTES ---

@app.route('/api/debug_graph', methods=['GET'])
def debug_graph():
    edges = [{"from": G.nodes[u]['name'], "to": G.nodes[v]['name'], "dist": d['weight']} 
             for u, v, d in G.edges(data=True)]
    return jsonify({
        "total_nodes": G.number_of_nodes(),
        "total_edges": G.number_of_edges(),
        "sample_connections": edges[:10]
    })

@app.route('/api/find_route', methods=['POST'])
def find_route():
    data = request.get_json()
    start_id = str(data.get('start')).strip()
    end_id = str(data.get('end')).strip()
    
    # --- KHÔI PHỤC LOG CONSOLE (DEBUG) ---
    print("\n" + "-"*40)
    print(f"📡 NHẬN YÊU CẦU TỪ FRONTEND:")
    print(f"📍 Điểm đi (ID): {start_id}")
    print(f"📍 Điểm đến (ID): {end_id}")
    
    if start_id not in G or end_id not in G:
        print(f"❌ LỖI: ID trạm không tồn tại trong đồ thị MRT!")
        print("-"*40 + "\n")
        return jsonify({"status": "error", "message": "Trạm không thuộc hệ thống MRT"}), 400
    
    start_name = G.nodes[start_id]['name']
    end_name = G.nodes[end_id]['name']
    print(f"✅ ÁNH XẠ THÀNH CÔNG: {start_name} -> {end_name}")
    
    # Gọi hàm Dijkstra
    path, total_distance = manual_dijkstra(G, start_id, end_id)
    
    if not path:
        print(f"❌ LỖI: Không tìm thấy đường đi giữa 2 trạm!")
        print("-"*40 + "\n")
        return jsonify({"status": "error", "message": "Không tìm thấy đường đi"}), 404

    # Tính thời gian dự kiến (Vận tốc 40km/h + 1 phút dừng mỗi trạm trung gian)
    estimated_time = round((total_distance / 40) * 60 + (len(path) - 1))
    
    print(f"🚀 AI (MANUAL DIJKSTRA) ĐÃ TÌM THẤY ĐƯỜNG!")
    print(f"📏 Tổng quãng đường: {round(total_distance, 2)} km")
    print(f"⏱ Thời gian: {estimated_time} phút")
    print("-"*40 + "\n")

    return jsonify({
        "status": "success",
        "start": start_name,
        "end": end_name,
        "path": path,
        "distance": round(total_distance, 2),
        "estimated_time": estimated_time
    })

@app.route('/')
def index():
    return send_from_directory(os.path.join(frontend_dir, 'HTML'), 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(frontend_dir, path)

if __name__ == '__main__':
    print("\n" + "="*50)
    print(" SERVER ĐANG CHẠY TẠI: http://127.0.0.1:5000")
    print("="*50 + "\n")
    app.run(port=5000, debug=True)