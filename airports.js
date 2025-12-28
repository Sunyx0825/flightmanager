// 全球机场数据加载器
class AirportDataLoader {
    constructor() {
        this.airports = [];
        this.airportIndex = {
            byCode: {},
            byICAO: {},
            searchIndex: []
        };
        this.isLoaded = false;
        this.loadPromise = null;
    }

    async loadAirports() {
        if (this.isLoaded) return this.airports;
        if (this.loadPromise) return this.loadPromise;

        this.loadPromise = this.fetchAirportData();
        return this.loadPromise;
    }

    async fetchAirportData() {
        try {
            // 尝试从多个数据源加载
            const sources = [
                'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat',
                'https://davidmegginson.github.io/ourairports-data/airports.csv'
            ];

            for (const source of sources) {
                try {
                    const response = await fetch(source);
                    if (response.ok) {
                        const text = await response.text();
                        if (source.includes('openflights')) {
                            this.parseOpenFlightsData(text);
                        } else {
                            this.parseOurAirportsData(text);
                        }
                        this.buildIndex();
                        this.isLoaded = true;
                        console.log(`成功加载 ${this.airports.length} 个机场数据`);
                        return this.airports;
                    }
                } catch (e) {
                    console.warn(`从 ${source} 加载失败:`, e);
                    continue;
                }
            }

            // 如果所有远程源都失败，使用本地备份数据
            console.warn('无法从远程加载数据，使用本地备份');
            this.loadFallbackData();
            this.buildIndex();
            this.isLoaded = true;
            return this.airports;

        } catch (error) {
            console.error('加载机场数据失败:', error);
            this.loadFallbackData();
            this.buildIndex();
            this.isLoaded = true;
            return this.airports;
        }
    }

    parseOpenFlightsData(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim());

        this.airports = lines.map(line => {
            // OpenFlights 格式: ID,Name,City,Country,IATA,ICAO,Lat,Lng,Alt,TZ,DST,TzDB,Type,Source
            const parts = this.parseCSVLine(line);

            const iata = parts[4] && parts[4] !== '\\N' ? parts[4] : null;
            const icao = parts[5] && parts[5] !== '\\N' ? parts[5] : null;

            if (!iata && !icao) return null; // 跳过没有代码的机场

            return {
                id: parts[0],
                name: parts[1],
                city: parts[2],
                country: parts[3],
                code: iata || icao, // IATA优先，没有则用ICAO
                iata: iata,
                icao: icao,
                lat: parseFloat(parts[6]),
                lng: parseFloat(parts[7]),
                altitude: parseFloat(parts[8]) || 0,
                timezone: parts[9],
                type: parts[12] || 'airport'
            };
        }).filter(airport => airport !== null);
    }

    parseOurAirportsData(csvText) {
        const lines = csvText.split('\n').filter(line => line.trim());
        const header = this.parseCSVLine(lines[0]);

        this.airports = lines.slice(1).map(line => {
            const parts = this.parseCSVLine(line);
            if (parts.length < 10) return null;

            const obj = {};
            header.forEach((key, i) => {
                obj[key] = parts[i];
            });

            const iata = obj.iata_code && obj.iata_code !== '' ? obj.iata_code : null;
            const icao = obj.ident || null;

            if (!iata && !icao) return null;

            return {
                id: obj.id,
                name: obj.name,
                city: obj.municipality || obj.name,
                country: obj.iso_country,
                code: iata || icao,
                iata: iata,
                icao: icao,
                lat: parseFloat(obj.latitude_deg),
                lng: parseFloat(obj.longitude_deg),
                altitude: parseFloat(obj.elevation_ft) || 0,
                type: obj.type || 'airport'
            };
        }).filter(airport => airport !== null && !isNaN(airport.lat) && !isNaN(airport.lng));
    }

    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    buildIndex() {
        this.airportIndex.byCode = {};
        this.airportIndex.byICAO = {};
        this.airportIndex.searchIndex = [];

        this.airports.forEach(airport => {
            if (airport.iata) {
                this.airportIndex.byCode[airport.iata.toUpperCase()] = airport;
            }
            if (airport.icao) {
                this.airportIndex.byICAO[airport.icao.toUpperCase()] = airport;
            }

            this.airportIndex.searchIndex.push({
                ...airport,
                searchName: airport.name.toLowerCase(),
                searchCity: airport.city.toLowerCase(),
                searchCountry: airport.country.toLowerCase()
            });
        });
    }

    loadFallbackData() {
        // 本地备份数据 - 包含主要国际机场
        this.airports = FALLBACK_AIRPORTS;
    }

    searchAirports(query, limit = 10) {
        if (!this.isLoaded || !query || query.length < 1) return [];

        const lowerQuery = query.toLowerCase().trim();
        const results = [];
        const seen = new Set();

        // 首先检查精确的IATA代码匹配
        const exactIATA = this.airportIndex.byCode[query.toUpperCase()];
        if (exactIATA && !seen.has(exactIATA.code)) {
            results.push({ ...exactIATA, score: 10000 });
            seen.add(exactIATA.code);
        }

        // 检查ICAO代码匹配
        const exactICAO = this.airportIndex.byICAO[query.toUpperCase()];
        if (exactICAO && !seen.has(exactICAO.code)) {
            results.push({ ...exactICAO, score: 9000 });
            seen.add(exactICAO.code);
        }

        // 搜索其他匹配
        this.airportIndex.searchIndex.forEach(airport => {
            if (seen.has(airport.code)) return;
            if (results.length >= limit * 3) return; // 提前终止以提高性能

            const matchScore = this.getMatchScore(airport, lowerQuery);
            if (matchScore > 0) {
                results.push({ ...airport, score: matchScore });
                seen.add(airport.code);
            }
        });

        results.sort((a, b) => b.score - a.score);
        return results.slice(0, limit);
    }

    getMatchScore(airport, query) {
        let score = 0;

        // IATA代码匹配
        if (airport.iata) {
            const iataLower = airport.iata.toLowerCase();
            if (iataLower === query) score += 1000;
            else if (iataLower.startsWith(query)) score += 500;
            else if (iataLower.includes(query)) score += 100;
        }

        // ICAO代码匹配
        if (airport.icao) {
            const icaoLower = airport.icao.toLowerCase();
            if (icaoLower === query) score += 800;
            else if (icaoLower.startsWith(query)) score += 400;
        }

        // 城市匹配
        if (airport.searchCity.includes(query)) {
            if (airport.searchCity.startsWith(query)) score += 300;
            else score += 80;
        }

        // 机场名称匹配
        if (airport.searchName.includes(query)) {
            score += 50;
        }

        // 国家匹配
        if (airport.searchCountry.includes(query)) {
            score += 30;
        }

        // 优先显示大型机场（有IATA代码的）
        if (airport.iata) {
            score += 10;
        }

        return score;
    }

    getAirportByCode(code) {
        const upperCode = code.toUpperCase();
        return this.airportIndex.byCode[upperCode] || this.airportIndex.byICAO[upperCode];
    }
}

// 本地备份数据（主要国际机场）
const FALLBACK_AIRPORTS = [
    // 中国主要机场
    { code: "PEK", iata: "PEK", icao: "ZBAA", name: "Beijing Capital International Airport", city: "Beijing", country: "China", lat: 40.0801, lng: 116.5846 },
    { code: "PKX", iata: "PKX", icao: "ZBAD", name: "Beijing Daxing International Airport", city: "Beijing", country: "China", lat: 39.5098, lng: 116.4105 },
    { code: "PVG", iata: "PVG", icao: "ZSPD", name: "Shanghai Pudong International Airport", city: "Shanghai", country: "China", lat: 31.1443, lng: 121.8083 },
    { code: "SHA", iata: "SHA", icao: "ZSSS", name: "Shanghai Hongqiao International Airport", city: "Shanghai", country: "China", lat: 31.1979, lng: 121.3365 },
    { code: "CAN", iata: "CAN", icao: "ZGGG", name: "Guangzhou Baiyun International Airport", city: "Guangzhou", country: "China", lat: 23.3924, lng: 113.2988 },
    { code: "SZX", iata: "SZX", icao: "ZGSZ", name: "Shenzhen Bao'an International Airport", city: "Shenzhen", country: "China", lat: 22.6393, lng: 113.8106 },
    { code: "CTU", iata: "CTU", icao: "ZUUU", name: "Chengdu Shuangliu International Airport", city: "Chengdu", country: "China", lat: 30.5785, lng: 103.9470 },
    { code: "KMG", iata: "KMG", icao: "ZPPP", name: "Kunming Changshui International Airport", city: "Kunming", country: "China", lat: 24.9920, lng: 102.7431 },
    { code: "XIY", iata: "XIY", icao: "ZLXY", name: "Xi'an Xianyang International Airport", city: "Xi'an", country: "China", lat: 34.4471, lng: 108.7514 },
    { code: "CSX", iata: "CSX", icao: "ZGHA", name: "Changsha Huanghua International Airport", city: "Changsha", country: "China", lat: 28.1892, lng: 113.2200 },
    { code: "CKG", iata: "CKG", icao: "ZUCK", name: "Chongqing Jiangbei International Airport", city: "Chongqing", country: "China", lat: 29.7192, lng: 106.6417 },
    { code: "WUH", iata: "WUH", icao: "ZHHH", name: "Wuhan Tianhe International Airport", city: "Wuhan", country: "China", lat: 30.7838, lng: 114.2081 },
    { code: "HGH", iata: "HGH", icao: "ZSHC", name: "Hangzhou Xiaoshan International Airport", city: "Hangzhou", country: "China", lat: 30.2295, lng: 120.4340 },
    { code: "NKG", iata: "NKG", icao: "ZSNJ", name: "Nanjing Lukou International Airport", city: "Nanjing", country: "China", lat: 31.7420, lng: 118.8620 },
    { code: "TAO", iata: "TAO", icao: "ZSQD", name: "Qingdao Liuting International Airport", city: "Qingdao", country: "China", lat: 36.2661, lng: 120.3747 },
    { code: "DLC", iata: "DLC", icao: "ZYTL", name: "Dalian Zhoushuizi International Airport", city: "Dalian", country: "China", lat: 38.9657, lng: 121.5386 },
    { code: "HRB", iata: "HRB", icao: "ZYHB", name: "Harbin Taiping International Airport", city: "Harbin", country: "China", lat: 45.6234, lng: 126.2497 },
    { code: "URC", iata: "URC", icao: "ZWWW", name: "Urumqi Diwopu International Airport", city: "Urumqi", country: "China", lat: 43.9071, lng: 87.4741 },
    { code: "TSN", iata: "TSN", icao: "ZBTJ", name: "Tianjin Binhai International Airport", city: "Tianjin", country: "China", lat: 39.1244, lng: 117.3464 },
    { code: "XMN", iata: "XMN", icao: "ZSAM", name: "Xiamen Gaoqi International Airport", city: "Xiamen", country: "China", lat: 24.5440, lng: 118.1278 },
    { code: "HKG", iata: "HKG", icao: "VHHH", name: "Hong Kong International Airport", city: "Hong Kong", country: "Hong Kong", lat: 22.3080, lng: 113.9185 },
    { code: "TPE", iata: "TPE", icao: "RCTP", name: "Taiwan Taoyuan International Airport", city: "Taipei", country: "Taiwan", lat: 25.0777, lng: 121.2328 },

    // 亚洲主要机场
    { code: "NRT", iata: "NRT", icao: "RJAA", name: "Narita International Airport", city: "Tokyo", country: "Japan", lat: 35.7647, lng: 140.3864 },
    { code: "HND", iata: "HND", icao: "RJTT", name: "Tokyo Haneda Airport", city: "Tokyo", country: "Japan", lat: 35.5494, lng: 139.7798 },
    { code: "KIX", iata: "KIX", icao: "RJBB", name: "Kansai International Airport", city: "Osaka", country: "Japan", lat: 34.4347, lng: 135.2441 },
    { code: "ICN", iata: "ICN", icao: "RKSI", name: "Incheon International Airport", city: "Seoul", country: "South Korea", lat: 37.4602, lng: 126.4407 },
    { code: "SIN", iata: "SIN", icao: "WSSS", name: "Singapore Changi Airport", city: "Singapore", country: "Singapore", lat: 1.3644, lng: 103.9915 },
    { code: "BKK", iata: "BKK", icao: "VTBS", name: "Suvarnabhumi Airport", city: "Bangkok", country: "Thailand", lat: 13.6811, lng: 100.7473 },
    { code: "KUL", iata: "KUL", icao: "WMKK", name: "Kuala Lumpur International Airport", city: "Kuala Lumpur", country: "Malaysia", lat: 2.7456, lng: 101.7099 },
    { code: "DXB", iata: "DXB", icao: "OMDB", name: "Dubai International Airport", city: "Dubai", country: "UAE", lat: 25.2528, lng: 55.3644 },
    { code: "DEL", iata: "DEL", icao: "VIDP", name: "Indira Gandhi International Airport", city: "Delhi", country: "India", lat: 28.5665, lng: 77.1031 },

    // 北美主要机场
    { code: "LAX", iata: "LAX", icao: "KLAX", name: "Los Angeles International Airport", city: "Los Angeles", country: "USA", lat: 33.9416, lng: -118.4085 },
    { code: "SFO", iata: "SFO", icao: "KSFO", name: "San Francisco International Airport", city: "San Francisco", country: "USA", lat: 37.6213, lng: -122.3790 },
    { code: "JFK", iata: "JFK", icao: "KJFK", name: "John F. Kennedy International Airport", city: "New York", country: "USA", lat: 40.6413, lng: -73.7781 },
    { code: "ORD", iata: "ORD", icao: "KORD", name: "O'Hare International Airport", city: "Chicago", country: "USA", lat: 41.9742, lng: -87.9073 },
    { code: "ATL", iata: "ATL", icao: "KATL", name: "Hartsfield-Jackson Atlanta International Airport", city: "Atlanta", country: "USA", lat: 33.6407, lng: -84.4277 },
    { code: "YVR", iata: "YVR", icao: "CYVR", name: "Vancouver International Airport", city: "Vancouver", country: "Canada", lat: 49.1967, lng: -123.1815 },
    { code: "YYZ", iata: "YYZ", icao: "CYYZ", name: "Toronto Pearson International Airport", city: "Toronto", country: "Canada", lat: 43.6777, lng: -79.6248 },

    // 欧洲主要机场
    { code: "LHR", iata: "LHR", icao: "EGLL", name: "London Heathrow Airport", city: "London", country: "UK", lat: 51.4700, lng: -0.4543 },
    { code: "CDG", iata: "CDG", icao: "LFPG", name: "Charles de Gaulle Airport", city: "Paris", country: "France", lat: 49.0097, lng: 2.5479 },
    { code: "FRA", iata: "FRA", icao: "EDDF", name: "Frankfurt Airport", city: "Frankfurt", country: "Germany", lat: 50.0379, lng: 8.5622 },
    { code: "AMS", iata: "AMS", icao: "EHAM", name: "Amsterdam Airport Schiphol", city: "Amsterdam", country: "Netherlands", lat: 52.3105, lng: 4.7683 },
    { code: "MAD", iata: "MAD", icao: "LEMD", name: "Madrid-Barajas Airport", city: "Madrid", country: "Spain", lat: 40.4839, lng: -3.5680 },
    { code: "FCO", iata: "FCO", icao: "LIRF", name: "Leonardo da Vinci-Fiumicino Airport", city: "Rome", country: "Italy", lat: 41.8003, lng: 12.2389 },

    // 大洋洲主要机场
    { code: "SYD", iata: "SYD", icao: "YSSY", name: "Sydney Kingsford Smith Airport", city: "Sydney", country: "Australia", lat: -33.9399, lng: 151.1753 },
    { code: "MEL", iata: "MEL", icao: "YMML", name: "Melbourne Airport", city: "Melbourne", country: "Australia", lat: -37.6690, lng: 144.8410 }
];

// 创建全局实例
const airportDataLoader = new AirportDataLoader();

// 兼容旧的API
function searchAirports(query, limit) {
    return airportDataLoader.searchAirports(query, limit);
}

function getAirportByCode(code) {
    return airportDataLoader.getAirportByCode(code);
}

// 页面加载时自动加载机场数据
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        console.log('开始加载全球机场数据...');
        airportDataLoader.loadAirports().then(() => {
            console.log('机场数据加载完成');
            // 触发一个自定义事件，通知应用数据已加载
            window.dispatchEvent(new CustomEvent('airportsLoaded', {
                detail: { count: airportDataLoader.airports.length }
            }));
        });
    });
}
