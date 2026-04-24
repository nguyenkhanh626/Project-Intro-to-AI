import osmnx as ox
import matplotlib.pyplot as plt

# 1. Định nghĩa khu vực và loại hình (chỉ lấy subway)
place_name = "Bangkok, Thailand"
# Chúng ta sử dụng custom_filter để lấy các đường ray tàu điện ngầm
cf = '["railway"~"subway"]'

# 2. Tải dữ liệu từ OSM và chuyển thành đồ thị
# ox.graph_from_place sẽ tự động kết nối các trạm thành các cạnh (edges)
graph = ox.graph_from_place(place_name, custom_filter=cf, retain_all=True)

# 3. Hiển thị bản đồ để kiểm tra
ox.plot_graph(graph, node_color='red', node_size=30, edge_color='blue')

# 4. Lưu dữ liệu trạm để dùng cho bài tập
# Bạn có thể xuất ra file GeoJSON hoặc dùng trực tiếp các nodes trong graph
nodes, edges = ox.graph_to_gdfs(graph)
print(nodes[['y', 'x']].head()) # In ra tọa độ thực của các trạm