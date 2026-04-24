// ==========================================
// BỌC TOÀN BỘ TRONG DOMContentLoaded
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. KHỞI TẠO BẢN ĐỒ VÀ BẢN ĐỒ NỀN CARTODB
    // ==========================================
    const map = L.map('map').setView([13.7563, 100.5018], 12);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Mẹo chống lỗi hiển thị với Flexbox
    setTimeout(() => { map.invalidateSize(); }, 100);

    // ==========================================
    // 2. KHAI BÁO BIẾN TOÀN CỤC 
    // ==========================================
    window.startStation = null;
    window.endStation = null;
    window.startMarker = null;
    window.endMarker = null;
    window.globalStops = []; // Để pathfinding.js dùng vẽ đường

    // ==========================================
    // 3. TẢI VÀ XỬ LÝ DỮ LIỆU (Đã sửa đường dẫn Data)
    // ==========================================
    
    Promise.all([
        fetch('../Data/stops_raw.json').then(res => {
            if (!res.ok) throw new Error("Không tìm thấy file stops_raw.json");
            return res.json();
        }),
        fetch('../Data/lines_clean.json').then(res => {
            if (!res.ok) throw new Error("Không tìm thấy file lines_clean.json");
            return res.json();
        }),
        fetch('../Data/station_line_clean.json').then(res => {
            if (!res.ok) throw new Error("Không tìm thấy file station_line_clean.json");
            return res.json();
        })
    ]).then(([stopsData, linesData, sequenceData]) => {
        
        function getVal(obj, possibleNames) {
            if (!obj) return null;
            const keys = Object.keys(obj);
            for (let name of possibleNames) {
                const foundKey = keys.find(k => k.toUpperCase().includes(name.toUpperCase()));
                if (foundKey) return obj[foundKey];
            }
            return null;
        }

        const arrStops = Array.isArray(stopsData) ? stopsData : Object.values(stopsData)[0];
        const arrLines = Array.isArray(linesData) ? linesData : Object.values(linesData)[0];
        const arrSeq = Array.isArray(sequenceData) ? sequenceData : Object.values(sequenceData)[0];

        // LỌC DỮ LIỆU (Chỉ lấy tàu MRT)
        const validLines = arrLines.filter(line => {
            const type = String(getVal(line, ["TYPEE", "TYPE"]) || "").trim().toUpperCase();
            return ["MRT"].includes(type);
        });
        const validLineIds = validLines.map(line => String(getVal(line, ["LINE_ID", "ID"])).trim()); 

        const validSequences = arrSeq.filter(seq => {
            const seqLineId = String(getVal(seq, ["LINE_ID", "LINE"])).trim();
            return validLineIds.includes(seqLineId);
        });
        const validStationIds = validSequences.map(seq => String(getVal(seq, ["STATION_ID", "STATION"])).trim());

        const validStops = arrStops.filter(stop => {
            const stopId = String(getVal(stop, ["stop_id", "ID"])).trim();
            return validStationIds.includes(stopId);
        });
        
        window.globalStops = validStops;
        console.log(`Đã load thành công ${validStops.length} trạm tàu điện.`);

        // ==========================================
        // 4. VẼ TUYẾN CÁP (EDGES)
        // ==========================================
        const linesGroup = {};
        validSequences.forEach(item => {
            const lId = String(getVal(item, ["LINE_ID", "LINE"])).trim();
            if (!linesGroup[lId]) linesGroup[lId] = [];
            linesGroup[lId].push(item);
        });

        for (const lineId in linesGroup) {
            const sortedStations = linesGroup[lineId].sort((a, b) => {
                return Number(getVal(a, ["STOP_SEQUENCE", "SEQUENCE"])) - Number(getVal(b, ["STOP_SEQUENCE", "SEQUENCE"]));
            });
            
            const lineInfo = validLines.find(l => String(getVal(l, ["LINE_ID", "ID"])).trim() === lineId);
            const colorValue = getVal(lineInfo, ["COLOR"]);
            const lineColor = colorValue ? `#${colorValue}` : '#333333';

            const pathCoords = [];
            sortedStations.forEach(seq => {
                const stId = String(getVal(seq, ["STATION_ID", "STATION"])).trim();
                const station = validStops.find(s => String(getVal(s, ["stop_id", "ID"])).trim() === stId);
                
                if (station) {
                    const lat = parseFloat(getVal(station, ["stop_lat", "LAT"]));
                    const lon = parseFloat(getVal(station, ["stop_lon", "LON"]));
                    if (lat && lon) pathCoords.push([lat, lon]);
                }
            });

            if (pathCoords.length > 0) {
                L.polyline(pathCoords, { color: lineColor, weight: 5, opacity: 0.8 }).addTo(map);
            }
        }

        // ==========================================
        // 5. VẼ TRẠM TÀU (NODES) & CẢM BIẾN CLICK
        // ==========================================
        validStops.forEach(station => {
            const lat = parseFloat(getVal(station, ["stop_lat", "LAT"]));
            const lon = parseFloat(getVal(station, ["stop_lon", "LON"]));
            const stationName = getVal(station, ["stop_name", "NAME"]);

            if (lat && lon) {
                const marker = L.circleMarker([lat, lon], {
                    radius: 4, 
                    fillColor: "#ffffff",
                    color: "#000000",
                    weight: 2, 
                    fillOpacity: 1
                }).addTo(map);

                marker.bindTooltip(`<b>${stationName}</b>`);

                marker.on('click', function() {
                    // Chặn nếu đã đủ 2 điểm
                    if (window.startStation && window.endStation) {
                        alert("Đã đủ 2 điểm. Bấm Clear Route bên trái để chọn lại!");
                        return;
                    }

                    // Click lần 1: Gán Điểm Đi (Xanh lá)
                    if (!window.startStation) {
                        window.startStation = station;
                        window.startMarker = marker; 
                        
                        marker.setStyle({ fillColor: "#10b981", radius: 8, color: "#047857", weight: 3 }); 
                        document.getElementById('start-station').value = stationName;
                        document.getElementById('route-text').innerText = "Đã chọn điểm đi. Hãy chọn điểm đến.";
                    } 
                    // Click lần 2: Gán Điểm Đến (Đỏ)
                    else if (!window.endStation && station !== window.startStation) {
                        window.endStation = station;
                        window.endMarker = marker;
                        
                        marker.setStyle({ fillColor: "#ef4444", radius: 8, color: "#b91c1c", weight: 3 }); 
                        document.getElementById('end-station').value = stationName;
                        document.getElementById('route-text').innerText = "Sẵn sàng! Hãy bấm nút Find Route.";
                    }
                });
            }
        });

    }).catch(error => {
        console.error("LỖI NẠP DỮ LIỆU:", error);
    });

    // ==========================================
    // 6. LOGIC NÚT CLEAR ROUTE
    // ==========================================
    document.getElementById('clear-btn').addEventListener('click', () => {
        // Trả lại màu trắng cho 2 marker
        if (window.startMarker) {
            window.startMarker.setStyle({ fillColor: "#ffffff", radius: 4, color: "#000000", weight: 2 });
        }
        if (window.endMarker) {
            window.endMarker.setStyle({ fillColor: "#ffffff", radius: 4, color: "#000000", weight: 2 });
        }

        // Reset biến toàn cục
        window.startStation = null;
        window.endStation = null;
        window.startMarker = null;
        window.endMarker = null;

        // Xóa text ở Sidebar
        document.getElementById('start-station').value = "";
        document.getElementById('end-station').value = "";
        document.getElementById('route-text').innerText = "Select two stations on the map to find route.";
    });

});