// Biến toàn cục để lưu trữ đường nét đứt (Polyline) trên bản đồ
// Giúp ta có thể xóa nó đi khi người dùng bấm "Clear Route"
let currentRouteLine = null;

document.addEventListener('DOMContentLoaded', () => {
    const findRouteBtn = document.getElementById('find-route-btn');
    const routeText = document.getElementById('route-text');
    const clearBtn = document.getElementById('clear-btn');

    // --- 1. LẮNG NGHE NÚT TÌM ĐƯỜNG ---
    findRouteBtn.addEventListener('click', async () => {
        // Kiểm tra xem sỹ phu đã chọn đủ 2 điểm trên map chưa (dữ liệu lấy từ window do map.js truyền sang)
        if (!window.startStation || !window.endStation) {
            alert("Vui lòng click chọn điểm đi và điểm đến trên bản đồ!");
            return;
        }

        const startId = window.startStation.stop_id;
        const endId = window.endStation.stop_id;

        routeText.innerText = "Đang nhờ AI tìm đường ngắn nhất...";
        findRouteBtn.disabled = true;
        findRouteBtn.innerText = "Calculating...";

        try {
            // Gọi điện cho Backend (Flask) đang chạy ở cổng 5000
            const response = await fetch('http://127.0.0.1:5000/api/find_route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start: startId, end: endId })
            });

            if (!response.ok) throw new Error("Máy chủ AI từ chối trả lời");

            const resultData = await response.json();
            
            // In kết quả ra Sidebar
            routeText.innerHTML = `
                <strong>Đã tìm thấy đường!</strong><br>
                Trạm đi qua: ${resultData.path.length} trạm.<br>
                Thời gian dự kiến: ${resultData.estimated_time} phút.
            `;

            // Gọi hàm vẽ đường lên bản đồ
            drawRouteOnMap(resultData.path);

        } catch (error) {
            console.error("Lỗi:", error);
            routeText.innerText = "Lỗi kết nối. Hãy chắc chắn server Python (Flask) đang chạy ngầm!";
        } finally {
            findRouteBtn.disabled = false;
            findRouteBtn.innerText = "Find Route";
        }
    });

    // --- 2. BỔ SUNG LỆNH XÓA ĐƯỜNG VẼ CHO NÚT CLEAR ---
    clearBtn.addEventListener('click', () => {
        if (currentRouteLine) {
            // Yêu cầu Leaflet gỡ đường kẻ ra khỏi bản đồ
            map.removeLayer(currentRouteLine);
            currentRouteLine = null;
        }
        // Ghi chú: Logic xóa marker (chấm màu) đã được viết ở map.js
    });
});

// --- 3. HÀM VẼ ĐƯỜNG (CORE UI LOGIC) ---
function drawRouteOnMap(pathNodeIds) {
    // Xóa đường cũ nếu người dùng tìm đường mới
    if (currentRouteLine) {
        map.removeLayer(currentRouteLine);
    }

    const routeCoords = [];
    
    // Dò từng ID trạm mà AI trả về, lấy tọa độ của nó từ window.globalStops
    pathNodeIds.forEach(nodeId => {
        const station = window.globalStops.find(s => s.stop_id === nodeId);
        if (station) {
            // Leaflet yêu cầu tọa độ là số thập phân, định dạng [Lat, Lng]
            routeCoords.push([parseFloat(station.stop_lat), parseFloat(station.stop_lon)]);
        }
    });

    if (routeCoords.length > 0) {
        // Vẽ một đường Polyline nối các điểm lại với nhau
        currentRouteLine = L.polyline(routeCoords, {
            color: '#f97316',    // Màu cam đậm cho nổi bật
            weight: 6,           // Độ dày của đường kẻ
            dashArray: '10, 10', // Tạo hiệu ứng nét đứt (Tùy chọn)
            opacity: 0.8,
            lineJoin: 'round'    // Bo tròn các khúc cua
        }).addTo(map);

        // Ra lệnh cho bản đồ tự động Zoom / Di chuyển để nhìn trọn vẹn toàn bộ đường đi này
        map.fitBounds(currentRouteLine.getBounds(), { padding: [50, 50] });
    }
}