// ==UserScript==
// @name         Vibie Cloudy checker
// @namespace    kitti.vibie
// @version      1.3
// @description  Search the USER LIVE CLOUDY ranking by ID or name: rank, time, %, time left to 35h, rest allowance
// @match        https://vibie.live/app/events/YFGJ6VT3TGeJSIM0gOCWcQ*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/kitti332/vibie-checker/main/vibie-checker.user.js
// @downloadURL  https://raw.githubusercontent.com/kitti332/vibie-checker/main/vibie-checker.user.js
// @supportURL   https://github.com/kitti332/vibie-checker/issues
// ==/UserScript==

(() => {
  const URL = "https://vibie.live/app/events/YFGJ6VT3TGeJSIM0gOCWcQ";
  const KEY_Q = "vibieCheckQuery", KEY_END = "vibieCheckEnd";
  const DEFAULT_Q = "CLD016, CFQ2L6, UKTXS2, NJ7PFR, ML853W, 2K8BMC, T48QZL, 31Z35R";
  const TARGET = 35 * 3600;
  const secs = t => { const [h, m, s] = t.split(".")[0].split(":").map(Number); return h * 3600 + m * 60 + s; };
  const hms = s => { const a = Math.abs(s), p2 = n => String(n).padStart(2, "0"); return (s < 0 ? "-" : "") + Math.floor(a / 3600) + ":" + p2(Math.floor(a % 3600 / 60)) + ":" + p2(Math.floor(a % 60)); };
  const norm = s => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const load = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  const box = document.createElement("div");
  box.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:999999;background:#1e1e1e;color:#eee;" +
    "font:13px/1.4 system-ui,sans-serif;padding:10px;border-radius:8px;box-shadow:0 2px 12px #0008;max-width:95vw;max-height:90vh;overflow:auto";
  box.innerHTML = `<div style="display:flex;gap:6px;margin-bottom:6px">
      <input class="q" placeholder="ID หรือชื่อ คั่นด้วย ," style="flex:1;min-width:260px;padding:4px 6px;border-radius:4px;border:1px solid #555;background:#111;color:#eee">
      <button class="go" style="padding:4px 10px;border-radius:4px;border:0;background:#3a7;color:#fff;cursor:pointer">เช็ก</button>
      <button class="fold" title="ย่อ" style="padding:4px 8px;border-radius:4px;border:0;background:#444;color:#fff;cursor:pointer">–</button>
    </div>
    <div class="body">
      <label style="display:block;margin-bottom:6px;opacity:.8">event จบเวลา (HH:MM วันนี้/พรุ่งนี้ ไม่ทราบให้เว้นว่าง)
        <input class="end" size="5" placeholder="24:00" style="padding:2px 4px;border-radius:4px;border:1px solid #555;background:#111;color:#eee"></label>
      <div class="st" style="opacity:.7;margin-bottom:4px"></div><table style="border-collapse:collapse"></table>
    </div>`;
  document.body.appendChild(box);
  const q = box.querySelector(".q"), endIn = box.querySelector(".end"), body = box.querySelector(".body");
  const status = box.querySelector(".st"), table = box.querySelector("table");
  q.value = load(KEY_Q, DEFAULT_Q); endIn.value = load(KEY_END, "");
  box.querySelector(".fold").onclick = () => { body.style.display = body.style.display === "none" ? "" : "none"; };

  const cell = (tr, text, tag = "td") => {
    const c = document.createElement(tag); c.textContent = text;
    c.style.cssText = "padding:2px 8px;border-bottom:1px solid #333;text-align:left;white-space:nowrap";
    tr.appendChild(c); return c;
  };

  // seconds until the entered HH:MM (24:00 allowed); null when blank/invalid
  function secsLeft() {
    const m = /^(\d{1,2}):(\d{2})$/.exec(endIn.value.trim());
    if (!m) return null;
    const end = new Date(); end.setHours(+m[1], +m[2], 0, 0);
    if (end < new Date()) end.setDate(end.getDate() + 1);
    return Math.floor((end - new Date()) / 1000);
  }

  async function check() {
    const qs = q.value.split(",").map(s => s.trim()).filter(Boolean);
    save(KEY_Q, q.value); save(KEY_END, endIn.value);
    if (!qs.length) { status.textContent = "ใส่ ID หรือชื่อก่อน"; table.replaceChildren(); return; }
    status.textContent = "กำลังโหลด…";
    let html;
    try { html = (await (await fetch(URL, { cache: "no-store" })).text()).replaceAll('\\"', '"'); }
    catch (e) { status.textContent = "โหลดไม่ได้: " + e.message; return; }
    const seen = new Set(), rows = [];
    for (const m of html.matchAll(/(?:"display_name":"([^"]*)",)?"vibie_id":"([A-Za-z0-9]+)","results":"([0-9:.]+)"/g))
      if (!seen.has(m[2])) { seen.add(m[2]); rows.push({ name: m[1] || "", id: m[2], s: secs(m[3]) }); }
    rows.sort((a, b) => b.s - a.s);
    const left = secsLeft();
    status.textContent = `${new Date().toLocaleTimeString("th-TH")} · ${rows.length} คนบนหน้า · อันดับสุดท้าย ${rows.length ? hms(rows[rows.length - 1].s) : "-"}` +
      (left === null ? "" : ` · event เหลือ ${hms(left)}`) + " · รีเฟรชทุก 1 นาที";

    table.replaceChildren();
    const head = document.createElement("tr");
    ["อันดับ", "ID", "ชื่อ", "เวลา", "%", "ยังขาด", "พักได้อีก"].forEach(h => cell(head, h, "th"));
    table.appendChild(head);
    for (const term of qs) {
      let hits = rows.filter(r => r.id.toUpperCase() === term.toUpperCase());
      if (!hits.length) hits = rows.filter(r => r.name && norm(r.name).includes(norm(term)));
      if (!hits.length) {
        const tr = document.createElement("tr");
        ["–", term, "ไม่พบ (ต่ำกว่าอันดับ 250?)", "", "", "", ""].forEach(v => cell(tr, v));
        table.appendChild(tr); continue;
      }
      for (const r of hits) {
        const need = TARGET - r.s;
        const rest = left === null || need <= 0 ? null : left - need;
        const tr = document.createElement("tr");
        cell(tr, rows.indexOf(r) + 1); cell(tr, r.id); cell(tr, r.name); cell(tr, hms(r.s));
        cell(tr, Math.min(100, r.s / TARGET * 100).toFixed(1) + "%");
        cell(tr, need <= 0 ? "✅ ครบ" : hms(need));
        const c = cell(tr, rest === null ? "—" : hms(rest));
        if (rest !== null) c.style.color = rest < 0 ? "#f66" : rest < 3600 ? "#fb4" : "#6d6";
        table.appendChild(tr);
      }
    }
  }

  box.querySelector(".go").onclick = check;
  for (const el of [q, endIn]) el.onkeydown = e => { if (e.key === "Enter") check(); };
  setInterval(() => { if (q.value.trim()) check(); }, 60000);
  check();
})();
