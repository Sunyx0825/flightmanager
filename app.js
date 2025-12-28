class FlightMapper {
    constructor() {
        this.currentRoute = [];
        this.flownSegments = this.loadFromStorage('flownSegments') || [];
        this.plannedSegments = this.loadFromStorage('plannedSegments') || [];
        this.showingAllFlown = this.loadFromStorage('showingAllFlown') || false;
        this.showingAllPlanned = this.loadFromStorage('showingAllPlanned') || false;
        this.map = null;
        this.mapLayers = {
            current: [],
            flown: [],
            planned: []
        };

        this.initMap();
        this.initEventListeners();
        this.updateStats();
        this.renderFlownList();
        this.renderPlannedList();
        this.initDisplayState();
    }

    initMap() {
        this.map = L.map('map').setView([30, 110], 3);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19,
            detectRetina: true,
            tileSize: 512,
            zoomOffset: -1
        }).addTo(this.map);
    }

    initDisplayState() {
        // 初始化显示状态：默认都不显示，按钮状态也相应设置
        document.getElementById('show-all-flown').style.display = 'inline-block';
        document.getElementById('hide-all-flown').style.display = 'none';
        document.getElementById('show-all-planned').style.display = 'inline-block';
        document.getElementById('hide-all-planned').style.display = 'none';
    }

    initEventListeners() {
        const departureInput = document.getElementById('departure');
        const arrivalInput = document.getElementById('arrival');
        const departureSuggestions = document.getElementById('departure-suggestions');
        const arrivalSuggestions = document.getElementById('arrival-suggestions');

        departureInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value, departureSuggestions);
        });

        arrivalInput.addEventListener('input', (e) => {
            this.handleSearch(e.target.value, arrivalSuggestions);
        });

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.input-group')) {
                departureSuggestions.classList.remove('active');
                arrivalSuggestions.classList.remove('active');
            }
        });

        document.getElementById('add-segment').addEventListener('click', () => {
            this.addSegment();
        });

        document.getElementById('calculate').addEventListener('click', () => {
            this.calculateRoute();
        });

        document.getElementById('clear-route').addEventListener('click', () => {
            this.clearRoute();
        });

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 批量显示/隐藏按钮
        document.getElementById('show-all-flown').addEventListener('click', () => {
            this.showAllFlown();
        });

        document.getElementById('hide-all-flown').addEventListener('click', () => {
            this.hideAllFlown();
        });

        document.getElementById('show-all-planned').addEventListener('click', () => {
            this.showAllPlanned();
        });

        document.getElementById('hide-all-planned').addEventListener('click', () => {
            this.hideAllPlanned();
        });
    }

    handleSearch(query, suggestionsEl) {
        if (query.length < 1) {
            suggestionsEl.classList.remove('active');
            return;
        }

        const results = searchAirports(query);

        if (results.length === 0) {
            suggestionsEl.classList.remove('active');
            return;
        }

        suggestionsEl.innerHTML = results.map(airport => `
            <div class="suggestion-item" data-code="${airport.code}">
                <div class="airport-code">${airport.code}</div>
                <div class="airport-name">${airport.name}</div>
                <div class="airport-city">${airport.city}, ${airport.country}</div>
            </div>
        `).join('');

        suggestionsEl.querySelectorAll('.suggestion-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const code = e.currentTarget.dataset.code;
                const inputId = suggestionsEl.id.replace('-suggestions', '');
                document.getElementById(inputId).value = code;
                suggestionsEl.classList.remove('active');
            });
        });

        suggestionsEl.classList.add('active');
    }

    addSegment() {
        const departureCode = document.getElementById('departure').value.trim().toUpperCase();
        const arrivalCode = document.getElementById('arrival').value.trim().toUpperCase();

        const departure = getAirportByCode(departureCode);
        const arrival = getAirportByCode(arrivalCode);

        if (!departure || !arrival) {
            alert('请输入有效的机场代码');
            return;
        }

        if (departureCode === arrivalCode) {
            alert('出发和到达机场不能相同');
            return;
        }

        const distance = this.calculateDistance(departure, arrival);

        const segment = {
            departure,
            arrival,
            distance
        };

        this.currentRoute.push(segment);
        this.renderCurrentRoute();
        this.drawCurrentRoute();

        document.getElementById('arrival').value = '';
        document.getElementById('departure').value = arrivalCode;
    }

    calculateRoute() {
        if (this.currentRoute.length === 0) {
            alert('请先添加航段');
            return;
        }

        const totalDistance = this.currentRoute.reduce((sum, seg) => sum + seg.distance, 0);

        const distanceDisplay = document.getElementById('route-distance');
        distanceDisplay.innerHTML = `
            总距离: <strong>${totalDistance.toFixed(0)} km</strong>
            (${(totalDistance * 0.621371).toFixed(0)} miles)
        `;

        const bounds = L.latLngBounds(
            this.currentRoute.flatMap(seg => [
                [seg.departure.lat, seg.departure.lng],
                [seg.arrival.lat, seg.arrival.lng]
            ])
        );
        this.map.fitBounds(bounds, { padding: [50, 50] });
    }

    clearRoute() {
        this.currentRoute = [];
        this.renderCurrentRoute();
        this.clearMapLayers('current');
        document.getElementById('route-distance').innerHTML = '';
        document.getElementById('departure').value = '';
        document.getElementById('arrival').value = '';
    }

    renderCurrentRoute() {
        const container = document.getElementById('current-route');

        if (this.currentRoute.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无航段，请添加航线</p>';
            return;
        }

        container.innerHTML = this.currentRoute.map((segment, index) => `
            <div class="route-item">
                <div class="route-info">
                    <div class="route-airports">
                        ${segment.departure.code} → ${segment.arrival.code}
                    </div>
                    <div class="route-names">
                        ${segment.departure.city} → ${segment.arrival.city}
                    </div>
                </div>
                <span class="route-distance-value">${segment.distance.toFixed(0)} km</span>
                <button class="remove-btn" onclick="flightMapper.removeSegment(${index})">删除</button>
                <button class="btn btn-primary" style="padding: 6px 12px; font-size: 12px; margin-left: 6px;" onclick="flightMapper.addToFlown(${index})">已飞</button>
                <button class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px; margin-left: 6px;" onclick="flightMapper.addToPlanned(${index})">待飞</button>
            </div>
        `).join('');
    }

    removeSegment(index) {
        this.currentRoute.splice(index, 1);
        this.renderCurrentRoute();
        this.drawCurrentRoute();

        if (this.currentRoute.length === 0) {
            document.getElementById('route-distance').innerHTML = '';
        }
    }

    addToFlown(index) {
        const segment = this.currentRoute[index];
        this.flownSegments.push(segment);
        this.saveToStorage('flownSegments', this.flownSegments);
        this.updateStats();
        this.renderFlownList();

        // 自动从当前航线删除
        this.removeSegment(index);

        // 显示通知（使用更友好的提示）
        this.showNotification(`已添加到已飞航段: ${segment.departure.code} → ${segment.arrival.code}`, 'success');
    }

    addToPlanned(index) {
        const segment = this.currentRoute[index];
        this.plannedSegments.push(segment);
        this.saveToStorage('plannedSegments', this.plannedSegments);
        this.updateStats();
        this.renderPlannedList();

        // 自动从当前航线删除
        this.removeSegment(index);

        // 显示通知
        this.showNotification(`已添加到待飞航段: ${segment.departure.code} → ${segment.arrival.code}`, 'success');
    }

    renderFlownList() {
        const container = document.getElementById('flown-list');

        if (this.flownSegments.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无已飞航段</p>';
            return;
        }

        container.innerHTML = this.flownSegments.map((segment, index) => `
            <div class="flight-item" draggable="true" data-index="${index}" data-type="flown">
                <div class="drag-handle">⋮⋮</div>
                <div class="flight-route">
                    <div class="flight-airports">
                        ${segment.departure.code} → ${segment.arrival.code}
                    </div>
                    <div class="flight-distance-value">${segment.distance.toFixed(0)} km</div>
                </div>
                <div class="flight-actions">
                    <button class="action-btn show-btn" onclick="flightMapper.showSegment('${segment.departure.code}', '${segment.arrival.code}')">显示</button>
                    <button class="action-btn convert-btn" onclick="flightMapper.moveToPlanned(${index})">→待飞</button>
                    <button class="action-btn delete-btn" onclick="flightMapper.deleteFlown(${index})">删除</button>
                </div>
            </div>
        `).join('');

        // 添加拖放事件监听
        this.setupDragAndDrop(container, 'flown');
    }

    renderPlannedList() {
        const container = document.getElementById('planned-list');

        if (this.plannedSegments.length === 0) {
            container.innerHTML = '<p class="empty-state">暂无待飞航段</p>';
            return;
        }

        container.innerHTML = this.plannedSegments.map((segment, index) => `
            <div class="flight-item" draggable="true" data-index="${index}" data-type="planned">
                <div class="drag-handle">⋮⋮</div>
                <div class="flight-route">
                    <div class="flight-airports">
                        ${segment.departure.code} → ${segment.arrival.code}
                    </div>
                    <div class="flight-distance-value">${segment.distance.toFixed(0)} km</div>
                </div>
                <div class="flight-actions">
                    <button class="action-btn show-btn" onclick="flightMapper.showSegment('${segment.departure.code}', '${segment.arrival.code}')">显示</button>
                    <button class="action-btn convert-btn" onclick="flightMapper.moveToFlown(${index})">→已飞</button>
                    <button class="action-btn delete-btn" onclick="flightMapper.deletePlanned(${index})">删除</button>
                </div>
            </div>
        `).join('');

        // 添加拖放事件监听
        this.setupDragAndDrop(container, 'planned');
    }

    deleteFlown(index) {
        if (confirm('确定要删除这个已飞航段吗？')) {
            this.flownSegments.splice(index, 1);
            this.saveToStorage('flownSegments', this.flownSegments);
            this.updateStats();
            this.renderFlownList();
        }
    }

    deletePlanned(index) {
        if (confirm('确定要删除这个待飞航段吗？')) {
            this.plannedSegments.splice(index, 1);
            this.saveToStorage('plannedSegments', this.plannedSegments);
            this.updateStats();
            this.renderPlannedList();
        }
    }

    moveToPlanned(index) {
        // 从已飞转到待飞
        const segment = this.flownSegments[index];
        this.flownSegments.splice(index, 1);
        this.plannedSegments.push(segment);

        this.saveToStorage('flownSegments', this.flownSegments);
        this.saveToStorage('plannedSegments', this.plannedSegments);

        this.updateStats();
        this.renderFlownList();
        this.renderPlannedList();

        this.showNotification(`已转移到待飞: ${segment.departure.code} → ${segment.arrival.code}`, 'info');
    }

    moveToFlown(index) {
        // 从待飞转到已飞
        const segment = this.plannedSegments[index];
        this.plannedSegments.splice(index, 1);
        this.flownSegments.push(segment);

        this.saveToStorage('plannedSegments', this.plannedSegments);
        this.saveToStorage('flownSegments', this.flownSegments);

        this.updateStats();
        this.renderPlannedList();
        this.renderFlownList();

        this.showNotification(`已转移到已飞: ${segment.departure.code} → ${segment.arrival.code}`, 'info');
    }

    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // 显示动画
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // 3秒后隐藏并删除
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    showSegment(departureCode, arrivalCode) {
        const departure = getAirportByCode(departureCode);
        const arrival = getAirportByCode(arrivalCode);

        if (!departure || !arrival) return;

        this.clearMapLayers('current');

        const line = L.polyline(
            [[departure.lat, departure.lng], [arrival.lat, arrival.lng]],
            { color: '#667eea', weight: 3, opacity: 0.7 }
        ).addTo(this.map);

        const departureMarker = L.marker([departure.lat, departure.lng])
            .bindPopup(`<b>${departure.code}</b><br>${departure.name}<br>${departure.city}`)
            .addTo(this.map);

        const arrivalMarker = L.marker([arrival.lat, arrival.lng])
            .bindPopup(`<b>${arrival.code}</b><br>${arrival.name}<br>${arrival.city}`)
            .addTo(this.map);

        this.mapLayers.current = [line, departureMarker, arrivalMarker];

        const bounds = L.latLngBounds([
            [departure.lat, departure.lng],
            [arrival.lat, arrival.lng]
        ]);
        this.map.fitBounds(bounds, { padding: [50, 50] });
    }

    showAllFlown(silent = false) {
        if (this.flownSegments.length === 0) {
            if (!silent) {
                this.showNotification('暂无已飞航段可显示', 'info');
            }
            return;
        }

        this.clearMapLayers('flown');

        const allPoints = [];

        this.flownSegments.forEach(segment => {
            const line = L.polyline(
                [[segment.departure.lat, segment.departure.lng], [segment.arrival.lat, segment.arrival.lng]],
                { color: '#48bb78', weight: 3, opacity: 0.6 }
            ).addTo(this.map);

            const departureMarker = L.circleMarker([segment.departure.lat, segment.departure.lng], {
                radius: 5,
                fillColor: '#48bb78',
                color: '#fff',
                weight: 1,
                fillOpacity: 0.8
            }).bindPopup(`<b>${segment.departure.code}</b><br>${segment.departure.name}`)
              .addTo(this.map);

            const arrivalMarker = L.circleMarker([segment.arrival.lat, segment.arrival.lng], {
                radius: 5,
                fillColor: '#48bb78',
                color: '#fff',
                weight: 1,
                fillOpacity: 0.8
            }).bindPopup(`<b>${segment.arrival.code}</b><br>${segment.arrival.name}`)
              .addTo(this.map);

            this.mapLayers.flown.push(line, departureMarker, arrivalMarker);

            allPoints.push([segment.departure.lat, segment.departure.lng]);
            allPoints.push([segment.arrival.lat, segment.arrival.lng]);
        });

        if (allPoints.length > 0) {
            const bounds = L.latLngBounds(allPoints);
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }

        // 显示隐藏按钮，隐藏显示按钮
        document.getElementById('show-all-flown').style.display = 'none';
        document.getElementById('hide-all-flown').style.display = 'inline-block';

        // 保存状态
        this.showingAllFlown = true;
        this.saveToStorage('showingAllFlown', this.showingAllFlown);

        if (!silent) {
            this.showNotification(`已在地图上显示 ${this.flownSegments.length} 个已飞航段`, 'success');
        }
    }

    hideAllFlown(silent = false) {
        this.clearMapLayers('flown');

        // 隐藏隐藏按钮，显示显示按钮
        document.getElementById('show-all-flown').style.display = 'inline-block';
        document.getElementById('hide-all-flown').style.display = 'none';

        // 保存状态
        this.showingAllFlown = false;
        this.saveToStorage('showingAllFlown', this.showingAllFlown);

        if (!silent) {
            this.showNotification('已清除已飞航段显示', 'info');
        }
    }

    showAllPlanned(silent = false) {
        if (this.plannedSegments.length === 0) {
            if (!silent) {
                this.showNotification('暂无待飞航段可显示', 'info');
            }
            return;
        }

        this.clearMapLayers('planned');

        const allPoints = [];

        this.plannedSegments.forEach(segment => {
            const line = L.polyline(
                [[segment.departure.lat, segment.departure.lng], [segment.arrival.lat, segment.arrival.lng]],
                { color: '#ed8936', weight: 3, opacity: 0.6 }
            ).addTo(this.map);

            const departureMarker = L.circleMarker([segment.departure.lat, segment.departure.lng], {
                radius: 5,
                fillColor: '#ed8936',
                color: '#fff',
                weight: 1,
                fillOpacity: 0.8
            }).bindPopup(`<b>${segment.departure.code}</b><br>${segment.departure.name}`)
              .addTo(this.map);

            const arrivalMarker = L.circleMarker([segment.arrival.lat, segment.arrival.lng], {
                radius: 5,
                fillColor: '#ed8936',
                color: '#fff',
                weight: 1,
                fillOpacity: 0.8
            }).bindPopup(`<b>${segment.arrival.code}</b><br>${segment.arrival.name}`)
              .addTo(this.map);

            this.mapLayers.planned.push(line, departureMarker, arrivalMarker);

            allPoints.push([segment.departure.lat, segment.departure.lng]);
            allPoints.push([segment.arrival.lat, segment.arrival.lng]);
        });

        if (allPoints.length > 0) {
            const bounds = L.latLngBounds(allPoints);
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }

        // 显示隐藏按钮，隐藏显示按钮
        document.getElementById('show-all-planned').style.display = 'none';
        document.getElementById('hide-all-planned').style.display = 'inline-block';

        // 保存状态
        this.showingAllPlanned = true;
        this.saveToStorage('showingAllPlanned', this.showingAllPlanned);

        if (!silent) {
            this.showNotification(`已在地图上显示 ${this.plannedSegments.length} 个待飞航段`, 'success');
        }
    }

    hideAllPlanned(silent = false) {
        this.clearMapLayers('planned');

        // 隐藏隐藏按钮，显示显示按钮
        document.getElementById('show-all-planned').style.display = 'inline-block';
        document.getElementById('hide-all-planned').style.display = 'none';

        // 保存状态
        this.showingAllPlanned = false;
        this.saveToStorage('showingAllPlanned', this.showingAllPlanned);

        if (!silent) {
            this.showNotification('已清除待飞航段显示', 'info');
        }
    }

    setupDragAndDrop(container, type) {
        const items = container.querySelectorAll('.flight-item');
        let draggedItem = null;
        let draggedIndex = null;

        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedItem = e.currentTarget;
                draggedIndex = parseInt(draggedItem.dataset.index);
                e.currentTarget.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });

            item.addEventListener('dragend', (e) => {
                e.currentTarget.classList.remove('dragging');
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';

                const draggingItem = container.querySelector('.dragging');
                if (!draggingItem || draggingItem === e.currentTarget) return;

                // 获取拖动项和目标项的位置
                const rect = e.currentTarget.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;

                // 根据鼠标位置决定插入位置
                if (e.clientY < midpoint) {
                    e.currentTarget.parentNode.insertBefore(draggingItem, e.currentTarget);
                } else {
                    e.currentTarget.parentNode.insertBefore(draggingItem, e.currentTarget.nextSibling);
                }
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                const dropIndex = parseInt(e.currentTarget.dataset.index);

                if (draggedIndex === dropIndex) return;

                // 重新排序数组
                const segments = type === 'flown' ? this.flownSegments : this.plannedSegments;
                const draggedSegment = segments[draggedIndex];

                // 从原位置删除
                segments.splice(draggedIndex, 1);

                // 计算新的插入位置
                const newIndex = draggedIndex < dropIndex ? dropIndex - 1 : dropIndex;

                // 插入到新位置
                segments.splice(newIndex, 0, draggedSegment);

                // 保存并重新渲染
                if (type === 'flown') {
                    this.saveToStorage('flownSegments', this.flownSegments);
                    this.renderFlownList();
                } else {
                    this.saveToStorage('plannedSegments', this.plannedSegments);
                    this.renderPlannedList();
                }

                this.showNotification('排序已更新', 'success');
            });
        });
    }

    updateStats() {
        const flownDistance = this.flownSegments.reduce((sum, seg) => sum + seg.distance, 0);
        const plannedDistance = this.plannedSegments.reduce((sum, seg) => sum + seg.distance, 0);

        document.getElementById('flown-count').textContent = this.flownSegments.length;
        document.getElementById('flown-distance').textContent = `${flownDistance.toFixed(0)} km`;
        document.getElementById('planned-count').textContent = this.plannedSegments.length;
        document.getElementById('planned-distance').textContent = `${plannedDistance.toFixed(0)} km`;
    }

    drawCurrentRoute() {
        this.clearMapLayers('current');

        if (this.currentRoute.length === 0) return;

        this.currentRoute.forEach(segment => {
            const line = L.polyline(
                [[segment.departure.lat, segment.departure.lng], [segment.arrival.lat, segment.arrival.lng]],
                { color: '#667eea', weight: 3, opacity: 0.7 }
            ).addTo(this.map);

            const departureMarker = L.marker([segment.departure.lat, segment.departure.lng])
                .bindPopup(`<b>${segment.departure.code}</b><br>${segment.departure.name}`)
                .addTo(this.map);

            const arrivalMarker = L.marker([segment.arrival.lat, segment.arrival.lng])
                .bindPopup(`<b>${segment.arrival.code}</b><br>${segment.arrival.name}`)
                .addTo(this.map);

            this.mapLayers.current.push(line, departureMarker, arrivalMarker);
        });
    }

    clearMapLayers(type) {
        this.mapLayers[type].forEach(layer => {
            this.map.removeLayer(layer);
        });
        this.mapLayers[type] = [];
    }

    calculateDistance(airport1, airport2) {
        const R = 6371;
        const lat1 = airport1.lat * Math.PI / 180;
        const lat2 = airport2.lat * Math.PI / 180;
        const deltaLat = (airport2.lat - airport1.lat) * Math.PI / 180;
        const deltaLng = (airport2.lng - airport1.lng) * Math.PI / 180;

        const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;

        return distance;
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        document.getElementById(`${tabName}-tab`).classList.add('active');

        // 根据保存的状态恢复显示
        if (tabName === 'flown') {
            if (this.showingAllFlown) {
                this.showAllFlown(true);
            } else {
                this.hideAllFlown(true);
            }
        } else if (tabName === 'planned') {
            if (this.showingAllPlanned) {
                this.showAllPlanned(true);
            } else {
                this.hideAllPlanned(true);
            }
        }
    }

    saveToStorage(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    }

    loadFromStorage(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    }
}

let flightMapper;

document.addEventListener('DOMContentLoaded', () => {
    const loadingStatus = document.getElementById('loading-status');
    const loadingText = document.getElementById('loading-text');

    // 监听机场数据加载完成事件
    window.addEventListener('airportsLoaded', (e) => {
        const count = e.detail.count;
        loadingStatus.classList.add('success');
        loadingText.textContent = `成功加载 ${count.toLocaleString()} 个机场数据`;

        // 3秒后隐藏加载状态
        setTimeout(() => {
            loadingStatus.classList.add('hidden');
        }, 3000);

        // 初始化应用
        flightMapper = new FlightMapper();
    });

    // 如果5秒后数据还没加载完，显示警告
    setTimeout(() => {
        if (!airportDataLoader.isLoaded) {
            loadingText.textContent = '网络较慢，正在使用备用数据...';
        }
    }, 5000);
});
