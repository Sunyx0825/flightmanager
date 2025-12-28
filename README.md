# 飞行距离查询 Flight Distance Mapper

一个功能完整的飞行距离查询网页应用，类似于 Great Circle Mapper (gcmap.com)。

## 主要功能

### ✈️ 全球机场数据库
- **自动加载全球 10,000+ 机场数据**
- 数据来源：OpenFlights 和 OurAirports 开源数据库
- 支持 IATA 和 ICAO 机场代码
- 包含机场名称、城市、国家、坐标等详细信息
- 智能降级：网络失败时使用本地备份数据

### 🔍 智能搜索
- 支持按机场代码搜索（IATA/ICAO）
- 支持按城市名搜索
- 支持按机场名称搜索
- 支持按国家搜索
- 实时自动补全建议
- 智能匹配算法，优先显示常用机场

### 📏 距离计算
- 使用大圆距离公式（Haversine）精确计算
- 支持公里和英里两种单位显示
- 自动计算多段航线总距离

### 🗺️ 地图可视化
- 使用 Leaflet.js 显示交互式地图
- 在地图上绘制航线
- 显示出发和到达机场标记
- 点击标记查看机场详细信息
- 自动缩放到合适的视图范围

### ✅ 航段管理
- **已飞航段**：记录已经飞过的航线
- **待飞航段**：记录计划要飞的航线
- 分别统计已飞和待飞的航段数量和总距离
- 支持查看、删除航段
- 数据持久化保存（localStorage）

### 🎯 多段航线支持
- 添加多个航段组成完整行程
- 实时显示每段距离
- 计算总距离
- 支持从当前航线快速添加到已飞/待飞列表

## 技术栈

- **纯前端**：HTML + CSS + JavaScript（无需构建工具）
- **地图库**：Leaflet.js
- **地图数据**：OpenStreetMap
- **机场数据**：OpenFlights / OurAirports

## 使用方法

### 基本使用

1. 打开 `index.html` 文件
2. 等待全球机场数据加载完成
3. 在搜索框输入机场代码或城市名
4. 点击"添加航段"添加航线
5. 点击"计算距离"查看总距离

### 搜索示例

- 输入代码：`PEK`（北京首都）、`PVG`（上海浦东）
- 输入城市：`Beijing`、`Shanghai`、`Tokyo`
- 输入机场名：`Changi`（新加坡樟宜）

### 管理航段

- 点击航段旁的"已飞"按钮添加到已飞列表
- 点击航段旁的"待飞"按钮添加到待飞列表
- 在"我的航段"标签页查看所有已飞/待飞航段
- 点击"显示"在地图上查看航线
- 点击"删除"移除航段

## 数据说明

### 机场数据来源

应用会尝试从以下数据源加载全球机场数据：

1. **OpenFlights**：https://github.com/jpatokal/openflights
   - 包含 10,000+ 全球机场
   - 包含 IATA 和 ICAO 代码

2. **OurAirports**：https://ourairports.com/
   - 备用数据源
   - 定期更新

如果网络加载失败，会自动使用内置的主要国际机场备份数据。

### 距离计算方法

使用**大圆距离**（Great Circle Distance）公式，也称为**球面距离**或 **Haversine 公式**：

- 这是地球表面两点之间的最短距离
- 与 Great Circle Mapper 使用相同的计算方法
- 地球半径取 6,371 公里

## 文件结构

```
flightmanager/
├── flightmanager.html   # 主页面
├── style.css            # 样式文件
├── airports.js          # 机场数据加载器
├── app.js               # 应用主逻辑
├── README.md            # 说明文档
├── LICENSE              # MIT 许可证
└── .gitignore           # Git 忽略配置
```

## 浏览器兼容性

- Chrome/Edge（推荐）
- Firefox
- Safari
- 需要支持 ES6+ 和 Fetch API

## 隐私说明

- 所有数据保存在浏览器本地（localStorage）
- 不会上传任何数据到服务器
- 机场数据从公开的开源数据库加载

## 更新日志

### v2.0 (2025-12-28)
- ✨ 新增：全球 10,000+ 机场数据支持
- ✨ 新增：动态加载机场数据
- ✨ 新增：ICAO 代码支持
- ✨ 改进：搜索算法优化
- ✨ 改进：加载状态显示

### v1.0
- 基础功能实现
- 主要国际机场数据

## 开发说明

### 本地开发

直接用浏览器打开 `index.html` 即可，无需启动服务器。

### 自定义机场数据

如果需要使用自己的机场数据，可以修改 `airports.js` 中的 `FALLBACK_AIRPORTS` 数组。

## 致谢

- 机场数据：OpenFlights 和 OurAirports 项目
- 地图：Leaflet.js 和 OpenStreetMap
- 灵感来源：Great Circle Mapper (gcmap.com)

## 许可

MIT License
