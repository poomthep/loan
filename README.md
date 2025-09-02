# Loan App (Vite + Supabase + Netlify)

โปรเจกต์เว็บแอปวิเคราะห์สินเชื่อบ้าน รองรับการ Login, Admin Console และ Loan Calculator  
ใช้ **Vite** เป็น Build System และ **Supabase** เป็น Backend

---

## 🚀 การใช้งาน

### 1. ติดตั้ง Dependencies
```bash
npm install
```

### 2. รัน Dev Server
```bash
npm run dev
```
แล้วเปิด `http://localhost:5173`

### 3. Build สำหรับ Production
```bash
npm run build
```

ผลลัพธ์จะอยู่ในโฟลเดอร์ `dist/`

---

## 🌐 Deploy บน Netlify

### ขั้นตอน
1. Push โปรเจกต์นี้ขึ้น GitHub  
2. เชื่อม GitHub Repo → Netlify  
3. ตั้งค่า **Build Settings** บน Netlify:
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`

### Environment Variables
ใน Netlify → Site settings → Environment variables → เพิ่ม:

- `VITE_SUPABASE_URL` → URL ของ Supabase Project (เช่น `https://xxxx.supabase.co`)  
- `VITE_SUPABASE_ANON_KEY` → anon key จาก Supabase (Public API Key)  

### Headers (กัน Cache เก่า)
Netlify จะอ่านไฟล์ `_headers` ที่อยู่ root อัตโนมัติ

```txt
/* 
  Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0
  Pragma: no-cache
  Expires: 0
```

---

## 📂 โครงสร้างไฟล์

```
.
├── index.html
├── loan.html
├── admin.html
├── app.css
├── _headers
├── package.json
├── vite.config.js
├── /src
│   ├── js/
│   │   ├── index-manager.js
│   │   ├── auth-manager.js
│   │   ├── loan-calculator.js
│   │   └── loan-calculator-supabase.js
│   └── config/
│       ├── supabase-config.js
│       └── supabase-init.js
```

---

## ✨ หมายเหตุ
- ใช้ `VITE_SUPABASE_URL` และ `VITE_SUPABASE_ANON_KEY` เท่านั้น (Netlify จะ inject ตอน build)  
- Key ที่ใช้ฝั่ง client ต้องเป็น **anon key** เท่านั้น ห้ามใช้ service role key  
- ถ้าแก้โค้ดฝั่ง JS ให้ใช้ `import/export` แบบ ES Module ได้เลย
