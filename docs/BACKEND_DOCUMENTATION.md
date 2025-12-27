# Wave Up Terminal - Backend Documentation

## 📋 Tổng Quan

Tài liệu này mô tả chi tiết về kiến trúc backend, các API cần thiết, và hướng dẫn lấy API key để Wave Up Terminal hoạt động đầy đủ với dữ liệu chứng khoán Việt Nam.

---

## 🏗️ Kiến Trúc Backend

```
┌─────────────────────────────────────────────────────────────────┐
│                        WAVE UP TERMINAL                         │
│                      (React Frontend)                            │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SUPABASE EDGE FUNCTIONS                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │
│  │ Stock API   │ │ AI Analysis │ │ News API    │ │ Auth       │ │
│  │ Proxy       │ │ Handler     │ │ Handler     │ │ Handler    │ │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬──────┘ │
└─────────┼───────────────┼───────────────┼──────────────┼────────┘
          │               │               │              │
          ▼               ▼               ▼              ▼
┌─────────────┐   ┌─────────────┐  ┌────────────┐ ┌────────────┐
│ SSI FC API  │   │ Google      │  │ News APIs  │ │ Supabase   │
│ (VN Stock)  │   │ Gemini AI   │  │ (RSS/API)  │ │ Auth       │
└─────────────┘   └─────────────┘  └────────────┘ └────────────┘
```

---

## 🔑 Danh Sách API Keys Cần Thiết

### 1. SSI FC Data API (Chứng Khoán Việt Nam) ⭐ BẮT BUỘC

| Thông tin | Chi tiết |
|-----------|----------|
| **Mục đích** | Lấy dữ liệu chứng khoán Việt Nam real-time |
| **URL** | `https://fc-data.ssi.com.vn` |
| **Keys cần** | `SSI_CONSUMER_ID`, `SSI_CONSUMER_SECRET` |
| **Miễn phí** | ✅ Có gói miễn phí cho retail |
| **Độ khó** | ⭐⭐ Trung bình |

**Tính năng:**
- Danh sách chứng khoán HOSE, HNX, UPCOM
- Giá cổ phiếu theo ngày/intraday
- Thông tin chi tiết mã chứng khoán
- Chỉ số thị trường (VNINDEX, VN30, HNX30...)
- Data streaming real-time

**Endpoints chính:**
```
POST /api/v2/Market/AccessToken          - Lấy access token
GET  /api/v2/Market/Securities           - Danh sách mã CK
GET  /api/v2/Market/SecuritiesDetails    - Chi tiết mã CK
GET  /api/v2/Market/DailyOhlc            - Giá OHLC theo ngày
GET  /api/v2/Market/IntradayOhlc         - Giá OHLC intraday
GET  /api/v2/Market/DailyIndex           - Chỉ số theo ngày
GET  /api/v2/Market/DailyStockPrice      - Giá cổ phiếu theo ngày
```

---

### 2. Google Gemini AI API ⭐ BẮT BUỘC CHO AI FEATURES

| Thông tin | Chi tiết |
|-----------|----------|
| **Mục đích** | AI Analysis, Voice Terminal, Strategy Lab |
| **URL** | `https://generativelanguage.googleapis.com` |
| **Keys cần** | `GEMINI_API_KEY` |
| **Miễn phí** | ✅ 1,500 requests/ngày miễn phí |
| **Độ khó** | ⭐ Dễ |

**Tính năng:**
- AI Visual Analysis (phân tích chart)
- AI Market Outlook
- Voice Terminal (Live API)
- Strategy Lab (sinh code PineScript)
- AI Sentiment Analysis

---

### 3. Perplexity API (TÙY CHỌN - AI Search)

| Thông tin | Chi tiết |
|-----------|----------|
| **Mục đích** | Deep Research với AI-powered search |
| **URL** | `https://api.perplexity.ai` |
| **Keys cần** | `PERPLEXITY_API_KEY` |
| **Miễn phí** | ❌ Trả phí ($5/1M tokens) |
| **Độ khó** | ⭐ Dễ |

---

### 4. VNDirect API (TÙY CHỌN - Thay thế SSI)

| Thông tin | Chi tiết |
|-----------|----------|
| **Mục đích** | Nguồn dữ liệu thay thế |
| **URL** | `https://dchart-api.vndirect.com.vn` |
| **Keys cần** | Không cần (public) |
| **Miễn phí** | ✅ Miễn phí |
| **Độ khó** | ⭐ Dễ |

---

## 📖 Hướng Dẫn Lấy API Keys

### 1. SSI FC Data API

**Bước 1: Đăng ký tài khoản SSI**
1. Truy cập: https://iboard.ssi.com.vn
2. Nhấn "Đăng ký" và điền thông tin
3. Xác minh email và số điện thoại

**Bước 2: Đăng ký Developer Account**
1. Truy cập: https://fc-data.ssi.com.vn
2. Đăng nhập bằng tài khoản SSI
3. Vào phần "Clients" → Download SDK
4. Đăng ký để nhận Consumer ID và Consumer Secret

**Bước 3: Lấy Access Token**
```javascript
// Ví dụ lấy access token
const response = await fetch('https://fc-data.ssi.com.vn/api/v2/Market/AccessToken', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    consumerID: 'YOUR_CONSUMER_ID',
    consumerSecret: 'YOUR_CONSUMER_SECRET'
  })
});
const { accessToken } = await response.json();
```

---

### 2. Google Gemini API

**Bước 1: Truy cập Google AI Studio**
1. Đi tới: https://aistudio.google.com/apikey
2. Đăng nhập bằng tài khoản Google

**Bước 2: Tạo API Key**
1. Nhấn "Create API Key"
2. Chọn project hoặc tạo mới
3. Copy API key

**Bước 3: Kiểm tra**
```javascript
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Hello' }] }]
    })
  }
);
```

---

### 3. Perplexity API

**Bước 1: Đăng ký**
1. Truy cập: https://www.perplexity.ai
2. Tạo tài khoản và đăng nhập

**Bước 2: Lấy API Key**
1. Vào Settings → API
2. Tạo API key mới
3. Thêm credit ($5 minimum)

---

## 🔧 Cấu Trúc Edge Functions

### Cấu trúc thư mục:
```
supabase/
├── config.toml
└── functions/
    ├── vn-stock-data/
    │   └── index.ts
    ├── ai-analysis/
    │   └── index.ts
    ├── market-news/
    │   └── index.ts
    └── stock-screener/
        └── index.ts
```

---

## 📊 API Endpoints Cần Xây Dựng

### 1. VN Stock Data Proxy
```typescript
// supabase/functions/vn-stock-data/index.ts
// Endpoints:
// - GET /stocks - Danh sách mã CK
// - GET /stocks/:symbol - Chi tiết 1 mã
// - GET /stocks/:symbol/history - Lịch sử giá
// - GET /indices - Danh sách chỉ số
// - GET /indices/:id/history - Lịch sử chỉ số
```

### 2. AI Analysis
```typescript
// supabase/functions/ai-analysis/index.ts
// Endpoints:
// - POST /analyze-chart - Phân tích chart từ ảnh
// - POST /market-outlook - AI dự báo thị trường
// - POST /sentiment - Phân tích tâm lý
// - POST /strategy - Sinh chiến lược giao dịch
```

### 3. Market News
```typescript
// supabase/functions/market-news/index.ts
// Endpoints:
// - GET /headlines - Tin tức mới nhất
// - GET /headlines/:symbol - Tin theo mã CK
// - POST /analyze-news - AI phân tích tin tức
```

---

## 🔐 Bảo Mật

### Secrets cần lưu trong Supabase:
| Secret Name | Mô tả |
|-------------|-------|
| `SSI_CONSUMER_ID` | SSI API Consumer ID |
| `SSI_CONSUMER_SECRET` | SSI API Consumer Secret |
| `GEMINI_API_KEY` | Google Gemini API Key |
| `PERPLEXITY_API_KEY` | Perplexity API Key (tùy chọn) |

### Không bao giờ:
- ❌ Lưu API keys trong code frontend
- ❌ Commit secrets lên Git
- ❌ Expose secrets trong console logs

---

## 🚀 Các Bước Triển Khai

### Phase 1: Setup Cơ Bản
1. [ ] Enable Lovable Cloud/Supabase
2. [ ] Thêm SSI API credentials
3. [ ] Thêm Gemini API key
4. [ ] Tạo edge function `vn-stock-data`

### Phase 2: Tích Hợp Data
1. [ ] Kết nối SSI API
2. [ ] Hiển thị danh sách mã CK VN
3. [ ] Hiển thị giá real-time
4. [ ] Hiển thị chỉ số VNINDEX, VN30

### Phase 3: AI Features
1. [ ] Tích hợp Gemini cho AI Analysis
2. [ ] Voice Terminal (nếu có)
3. [ ] Strategy Lab

### Phase 4: Mở Rộng
1. [ ] Portfolio tracking với database
2. [ ] User authentication
3. [ ] Watchlist cá nhân hóa

---

## 📚 Tài Liệu Tham Khảo

| Nguồn | Link |
|-------|------|
| SSI FC API Docs | https://fc-data.ssi.com.vn/Help |
| SSI Node.js SDK | https://github.com/SSI-Securities-Corporation/node-fcdata |
| VNStock Python | https://github.com/thinh-vu/vnstock |
| Google Gemini Docs | https://ai.google.dev/gemini-api/docs |
| Perplexity API Docs | https://docs.perplexity.ai |
| Supabase Edge Functions | https://supabase.com/docs/guides/functions |

---

## ⚠️ Lưu Ý Quan Trọng

1. **Rate Limits**: SSI API có giới hạn số request/phút. Cần implement caching.

2. **Market Hours**: Thị trường VN giao dịch 9:00 - 15:00 (GMT+7). Ngoài giờ chỉ có data cuối ngày.

3. **Data Delay**: Gói miễn phí SSI có thể delay 15 phút. Gói Premium không delay.

4. **Phí dịch vụ**: 
   - SSI Free: Miễn phí nhưng hạn chế
   - Gemini: 1,500 requests/ngày miễn phí
   - Perplexity: Trả phí từ đầu

---

*Tài liệu được tạo bởi Wave Up Terminal - Version 1.0*
