# ✦ ARCANA — Magical Multiplayer Card Game

เกมการ์ดสไตล์ UNO คลาสสิก ธีมเวทมนตร์แบบ Cute Dark Fantasy เล่นหลายคนแบบเรียลไทม์ผ่านเบราว์เซอร์
Server เป็นผู้ควบคุมกติกาทั้งหมด (server-authoritative) ผู้เล่นแต่ละคนเห็นเฉพาะการ์ดของตัวเอง

```
Home → Create / Join → Lobby → Ready → Start → Play → Results → Rematch
```

---

## Quick start

ต้องใช้ **Node.js 20+**

```bash
npm install
npm run dev          # server :3001 + client :5173 พร้อมกัน
```

เปิด `http://localhost:5173` สองหน้าต่าง (หรือหน้าต่างปกติ + Incognito) แล้ว

1. หน้าต่าง A → **สร้างห้อง** → ได้รหัส 5 ตัว
2. หน้าต่าง B → **เข้าห้อง** → ใส่รหัส → กด **พร้อม**
3. A กด **เริ่มเกม**

ทดสอบกับมือถือในวง LAN เดียวกัน: เปิด `http://<IP เครื่องคุณ>:5173` — client ในโหมด dev จะต่อไปที่ `:3001` ของ host เดียวกันให้อัตโนมัติ

> แต่ละแท็บถือ session แยกกัน (sessionStorage) จึงเล่นสองคนในเบราว์เซอร์เดียวกันได้ ปิดแท็บแล้วเปิดใหม่ก็กลับเข้าที่นั่งเดิมได้ (สำเนาใน localStorage)

### Production แบบ service เดียว

```bash
npm run build        # build client → client/dist, bundle server → server/dist
npm start            # http://localhost:3001 เสิร์ฟทั้งเกมและ Socket.IO
```

### Scripts

| คำสั่ง | ทำอะไร |
|---|---|
| `npm run dev` | รัน server (tsx watch) + client (Vite) |
| `npm test` | Unit tests ของ engine (33) + integration tests ผ่าน socket จริง (7) |
| `npm run typecheck` | ตรวจ TypeScript ทั้ง 3 workspace |
| `npm run build` / `npm start` | build และรันแบบ production |

---

## โครงสร้างโปรเจกต์

```
arcana/
├─ shared/                 # Game engine + types + protocol (ไม่มี UI, ทดสอบได้ล้วน ๆ)
│  ├─ src/types.ts         # Card, CardColor, CardType, GameState, GameAction, GamePhase, GameView…
│  ├─ src/deck.ts          # สำรับ 108 ใบ, shuffle (seeded RNG), คะแนน
│  ├─ src/rules.ts         # isPlayable, isWild4Legal
│  ├─ src/engine.ts        # createRound, applyAction (reducer), autoAction, removePlayer
│  ├─ src/view.ts          # toGameView — projection ต่อผู้เล่น (ซ่อนมือคนอื่น)
│  ├─ src/protocol.ts      # Socket events, RoomView, ค่าคงที่ห้อง
│  └─ test/engine.test.ts
├─ server/                 # Node + Socket.IO
│  ├─ src/rooms.ts         # RoomManager: ห้อง, lobby, ready, reconnection, timers, RoomStore (in-memory)
│  ├─ src/app.ts           # HTTP + Socket.IO wiring + static hosting + /health
│  ├─ src/config.ts        # อ่าน env
│  └─ test/server.test.ts  # integration tests ด้วย socket.io-client จริง
├─ client/                 # React + TS + Vite + Tailwind v4 + Motion + Zustand
│  ├─ public/assets/       # Asset ที่แยกจากภาพ reference (PNG โปร่งใส)
│  │  ├─ cards/ avatars/ icons/ backgrounds/ decorations/ effects/
│  └─ src/
│     ├─ assets/manifest.ts   # Asset manifest: ไฟล์ → component ที่ใช้ → fallback
│     ├─ store.ts             # Zustand: connection, session, room view, toasts, settings
│     ├─ lib/net.ts           # socket client + request/ack + แปล error เป็นไทย
│     ├─ lib/anchors.ts       # registry ตำแหน่ง DOM สำหรับ FLIP animation
│     ├─ lib/sfx.ts           # เสียงสังเคราะห์ด้วย Web Audio (ไม่มีปัญหาลิขสิทธิ์)
│     ├─ components/          # Card, Avatar, Buttons, Icons, Backdrop, Particles, Modal/Toast
│     ├─ game/                # Hand, Seat, TableCenter, Effects, Dialogs (สี / ท้าพิสูจน์)
│     └─ screens/             # Menu, Lobby, Game, Results
├─ tools/extract_assets.py # สคริปต์แยก asset จาก sheet (ทำซ้ำได้)
├─ reference/              # ภาพ reference ต้นฉบับ
├─ Dockerfile · render.yaml
```

---

## สถาปัตยกรรม Multiplayer

- **Server-authoritative:** client ส่งแค่ *intent* (`play`, `draw`, `pass`, `chooseColor`, `callUno`, `catchUno`, `challenge`, `acceptDraw4`, `ready`, `start`) — server ตรวจกติกาด้วย engine เดียวกับที่ unit test ครอบคลุม แล้ว broadcast state ใหม่
- **ซ่อนมือผู้เล่น:** server สร้าง `RoomView` แยกต่อผู้เล่นผ่าน `toGameView()` — payload มีแค่ `cardCount` ของคนอื่น และไม่เคยส่ง flag `guilty` ของ Wild +4 (มี test ยืนยันว่า payload ของ A ไม่มี card id ของ B)
- **Validate ก่อน mutate:** `applyAction` คืน `{ok:false}` โดยไม่แตะ state เมื่อ action ผิด (ผิดตา, การ์ดไม่ใช่ของตัวเอง, การ์ดปลอม, payload ขยะ)
- **Duplicate actions:** ทุก intent มี `intentId` server จำ 64 อันล่าสุดต่อผู้เล่น ส่งซ้ำจะถูกตอบ ok แต่ไม่ทำซ้ำ (กันดับเบิลคลิก/ส่งซ้ำหลัง reconnect)
- **Race conditions:** Node ประมวลผล event ทีละตัวในห้อง จึงไม่มี action ซ้อนกันกลางทาง ส่วน action ที่มาช้ากว่า state จะไม่ผ่านการ validate
- **Animation ไม่ทำให้ desync:** UI วาดจาก state ที่ server ยืนยันแล้วเท่านั้น `events[]` ที่มากับแต่ละ update ใช้แค่ trigger เอฟเฟกต์

### Disconnect / Reconnect policy

| สถานการณ์ | พฤติกรรม |
|---|---|
| หลุดระหว่างเกม | ที่นั่งถูกเก็บไว้ คนอื่นเห็นไอคอนหลุด + นับถอยหลัง |
| ถึงตาคนที่หลุด | รอ `DISCONNECT_GRACE_MS` (15s) แล้ว server เล่นแทนแบบปลอดภัย (จั่ว/ผ่าน, รับ +4, เลือกสีที่มีมากสุด) |
| หลุดนานเกิน `DROP_AFTER_MS` (3 นาที) | ถูกนำออก การ์ดกลับเข้ากองจั่ว ถ้าเหลือ 1 คน คนนั้นชนะรอบ |
| ผู้เล่นที่ต่ออยู่แต่ไม่เล่น | auto-play หลัง `TURN_TIMEOUT_MS` (60s, ตั้ง 0 เพื่อปิด) |
| กลับเข้ามา | client ส่ง `session:resume {code, playerId, token}` อัตโนมัติเมื่อ socket ต่อใหม่หรือรีเฟรชหน้า |
| เปิดที่นั่งเดียวกันสองหน้าต่าง | หน้าต่างใหม่ได้ที่นั่ง หน้าต่างเก่าได้รับแจ้ง |
| Host หลุด/ออก | โอนสิทธิ์ host ให้ผู้เล่นที่ยังต่ออยู่ |

---

## กติกา (Classic)

- สำรับ 108 ใบ: ตัวเลข 76 · Skip 8 · Reverse 8 · Draw Two 8 · Wild 4 · Wild Draw Four 4 · แจกคนละ 7
- ใบเปิด: ถ้าเป็น Wild +4 คืนเข้าสำรับแล้วเปิดใหม่ · Skip = คนแรกเสียตา · Reverse = เจ้ามือเล่นก่อนและกลับทิศ · +2 = คนแรกจั่ว 2 แล้วเสียตา · Wild = คนแรกเลือกสี
- ไม่มีใบที่ลงได้ → จั่ว 1 ใบ ถ้าใบนั้นลงได้จะ **ลงทันที** หรือ **เก็บไว้** ก็ได้
- Reverse ในเกม 2 คน = Skip
- **Wild +4 + Challenge:** ลงได้เสมอ (bluff ได้) คนถัดไปเลือก *รับ +4* (จั่ว 4 + เสียตา) หรือ *ท้าพิสูจน์* — ถ้าผู้ลงมีการ์ด **สีเดียวกับสีก่อนหน้า** อยู่ (เลข/สัญลักษณ์ที่ตรงไม่นับ) ผู้ลงจั่ว 4 แทนและผู้ท้าเล่นต่อตามปกติ ถ้าไม่ผิด ผู้ท้าจั่ว 6 และเสียตา
- **ไม่มี stacking** +2/+4 (ค่าเริ่มต้นแบบมาตรฐาน — engine แยกเป็น reducer เดียว เพิ่มเป็น house rule ได้ใน `engine.ts`)
- **UNO:** กดได้ตอนเหลือ 2 ใบในตาตัวเอง หรือทันทีหลังลงจนเหลือ 1 ใบ ถ้าลืม ผู้เล่นอื่นกด **จับได้! +2** ได้จนกว่าคนถัดไปจะเริ่มเล่น
- กองจั่วหมด → สับกองทิ้งกลับมาใช้ โดยเก็บใบบนสุดไว้
- จบรอบ: ผู้ชนะได้คะแนนจากการ์ดที่เหลือของคนอื่น (เลขตามหน้าไพ่, Action 20, Wild 50) · ถ้าใบสุดท้ายเป็น +2/+4 คนถัดไปยังต้องจั่ว (นับคะแนน) โดยไม่มีช่วงท้าพิสูจน์
- **Rematch:** ทุกคนที่ออนไลน์กด *เล่นอีกรอบ* → เริ่มรอบใหม่ทันที เจ้ามือหมุนไป คะแนนสะสม · Host กด *กลับล็อบบี้* เพื่อรีเซ็ตคะแนน

ห้องรองรับ 2–4 คน (`MAX_PLAYERS` ใน `shared/src/protocol.ts`) ทั้ง engine และ layout ที่นั่งรองรับถึง 10 คน แค่ปรับค่าคงที่

---

## Assets

ภาพ `reference/game-elements-sheet.png` มีพื้นหลังโปร่งใสอยู่แล้ว สคริปต์ `tools/extract_assets.py` จึง

1. ตัดแต่ละชิ้นตาม bounding box แล้ว **mask ด้วย connected component** — เก็บเฉพาะพิกเซลขององค์ประกอบนั้น จึงไม่มีชิ้นข้างเคียงติดมา
2. Avatar ใช้ mask วงกลมตัดแถบ status pill ที่ติดกันออก
3. การ์ด Skip / Reverse / +2 ใน sheet มีอย่างละสีเดียว อีก 3 สีสร้างด้วย **hue remap** แบบจำกัดเฉพาะสีของตัวการ์ด (ขอบครีมไม่เปลี่ยน)

```bash
python3 tools/extract_assets.py reference/game-elements-sheet.png   # ต้องมี Pillow, numpy, scipy
```

ตัวเลขบนการ์ดและข้อความทั้งหมด render ผ่าน UI (ไม่ฝังใน asset) · `client/src/assets/manifest.ts` ระบุทุกไฟล์ → component ที่ใช้ → fallback (`<AssetImage>` วาด SVG แทนถ้าโหลดไม่ได้)

| กลุ่ม | ไฟล์ | ใช้ที่ |
|---|---|---|
| cards | `number-*`, `skip-*`, `reverse-*`, `draw2-*`, `wild`, `wild4`, `back` | CardFace, CardBack, กองจั่ว, ที่นั่งคู่แข่ง |
| avatars | `witch`, `tinkerer`, `cleric`, `catfolk` | Avatar (Menu, Lobby, Game, Results) |
| icons | `btn-play`, `btn-cards`, `btn-ready`, `btn-refresh`, `btn-settings`, `btn-players`, `swatch-*` | ปุ่มร่าย/จั่ว/พร้อม/เล่นอีกรอบ/ตั้งค่า, Color picker |
| backgrounds | `city-skyline`, `table` | ฉากหน้า Menu, โต๊ะเวทมนตร์ |
| decorations | `black-cat`, `crystal-ball`, `candles`, `lamp`, `banner`, `airship`, `books`, `sprout-*`, `card-fan`, `witch-silhouette` | ของตกแต่งในแต่ละหน้า |
| effects | `sparkle-*`, `shooting-star` | favicon, ดาวตก |

---

## Animation system

- **Card play (FLIP):** ก่อนส่ง intent จะบันทึก rect + มุมจริงของการ์ดในมือ เมื่อ server ยืนยัน การ์ดใบใหม่บนกองทิ้งจะเริ่มจากตำแหน่งนั้น ลอยโค้งขึ้น หมุน และลงด้วย squash เบา ๆ + sparkle · การ์ดของคู่แข่งลอยออกจากที่นั่งจริงของเขา
- **Draw / Deal:** การ์ดใหม่ในมือเริ่มจากตำแหน่งกองจั่วจริงแล้ว spring เข้าช่อง (stagger) การ์ดที่เหลือเลื่อนจัดใหม่ด้วย spring · คู่แข่งจั่ว = ไพ่หลังลอยจากกองไปที่นั่ง
- **Hover / Select:** spring ยก 18px / 30px + scale + เงาขยาย + glow · ใบที่ลงได้มีแถบทองด้านบน ใบที่ลงไม่ได้หรี่และสั่นเมื่อแตะ
- **Specials:** Skip = สัญลักษณ์ห้ามพร้อม pulse เหนือเป้าหมาย · Reverse = วงแหวนทิศทางหมุนกลับ + ลูกศรวน · Wild = วงแหวนสี + burst · Wild +4 = 4 สีรวมตัวที่กอง · UNO = star burst + วงแหวน + avatar เด้ง
- เฉพาะ `transform` / `opacity` เป็นหลัก · รองรับ `prefers-reduced-motion` และสวิตช์ “ลดการเคลื่อนไหว” ในตั้งค่า
- เสียงทั้งหมดสังเคราะห์ด้วย Web Audio เริ่มเล่นหลังผู้ใช้แตะหน้าจอครั้งแรก มีปุ่มเปิด/ปิด

---

## Deploy ให้เล่นผ่าน Internet

### แบบที่ 1 — Service เดียว (แนะนำ)

Server เสิร์ฟทั้งไฟล์เกมและ WebSocket บน origin เดียวกัน จึงไม่ต้องตั้ง CORS

**Render** (รองรับ WebSocket ใน free plan): push repo ขึ้น GitHub → New → *Blueprint* → เลือก repo (`render.yaml` ตั้งค่าไว้แล้ว)
หรือสร้าง Web Service เอง: Build `npm ci && npm run build` · Start `npm start` · Health check `/health`

**Railway / Fly.io / VPS ใดก็ได้ที่รัน Docker:**

```bash
docker build -t arcana .
docker run -p 3001:3001 arcana
```

### แบบที่ 2 — แยก Frontend / Backend

1. Backend (Render/Railway/Fly): deploy โฟลเดอร์นี้ด้วยคำสั่งเดียวกับแบบที่ 1 ตั้ง `CORS_ORIGIN=https://your-frontend.example.com`
2. Frontend (Vercel/Netlify/Cloudflare Pages): Root `client` · Build `npm run build` (ติดตั้งจาก root ด้วย `npm ci`) · Output `client/dist` · ตั้ง `VITE_SERVER_URL=https://your-backend.example.com`

### หมายเหตุ WebSocket / Proxy

- ใช้ `https://` → socket จะเป็น `wss://` อัตโนมัติ
- ถ้าวางหลัง Nginx ต้อง forward header `Upgrade` / `Connection`:
  ```nginx
  location / {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
  ```
- State อยู่ในหน่วยความจำ → ใช้ **instance เดียว** (รีสตาร์ทแล้วห้องหาย) ถ้าจะ scale หลาย instance: เปลี่ยน `MemoryRoomStore` เป็น Redis store (interface `RoomStore` ใน `server/src/rooms.ts`) + ใช้ `@socket.io/redis-adapter` + sticky sessions
- โฮสต์ free tier บางเจ้า sleep เมื่อไม่มีคนใช้ ครั้งแรกอาจต้องรอ ~30 วินาที

### Environment variables

**Server** (`server/.env.example`)

| ตัวแปร | ค่าเริ่มต้น | คำอธิบาย |
|---|---|---|
| `PORT` | `3001` | พอร์ต |
| `CORS_ORIGIN` | `*` | origin ที่อนุญาต คั่นด้วย `,` |
| `STATIC_DIR` | `../client/dist` | โฟลเดอร์ client ที่ build แล้ว |
| `DISCONNECT_GRACE_MS` | `15000` | รอผู้เล่นที่หลุดก่อนเล่นแทน |
| `TURN_TIMEOUT_MS` | `60000` | auto-play ผู้เล่นที่ไม่ขยับ (0 = ปิด) |
| `DROP_AFTER_MS` | `180000` | นำผู้เล่นที่หลุดออกจากเกม |
| `LOBBY_DROP_AFTER_MS` | `60000` | นำผู้เล่นที่หลุดออกจาก lobby |
| `EMPTY_ROOM_TTL_MS` | `600000` | ลบห้องที่ไม่มีใครต่ออยู่ |

**Client** (`client/.env.example`)

| ตัวแปร | คำอธิบาย |
|---|---|
| `VITE_SERVER_URL` | URL ของ server เว้นว่างเมื่อ server เสิร์ฟ client เอง |

---

## Debug

เปิดเกมด้วย `?debug` แล้วใน devtools ใช้ `__arcana.getState()` ดู state ฝั่ง client (มีเฉพาะมุมมองของผู้เล่นคนนั้น)

## ข้อจำกัดที่รู้อยู่

- Asset ใน sheet ต้นฉบับมีความละเอียดประมาณ 140px ต่อการ์ด บนจอ Retina ขนาดใหญ่จะนุ่มเล็กน้อย ถ้ามีไฟล์ความละเอียดสูงกว่า วางทับชื่อเดิมใน `client/public/assets/` ได้ทันที
- Skip/Reverse/+2 สีที่ไม่มีใน sheet สร้างด้วย hue remap
- ใบสุดท้ายเป็น Wild +4 จะไม่มีช่วงท้าพิสูจน์ (จบรอบทันทีและคนถัดไปจั่ว 4)
