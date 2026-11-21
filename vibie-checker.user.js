// ==UserScript==
// @name         Vibie Cloudy checker
// @namespace    kitti.vibie
// @version      2.4
// @description  Search the USER LIVE CLOUDY ranking by ID, name, rank (e.g. 250, #1, 245-250), per-account target (e.g. ID:10, ID:20, ID:#1), or separator (e.g. ---): rank, time, target (35h/20h/10h/#1), %, time left, rest allowance
// @match        https://vibie.live/app/events/YFGJ6VT3TGeJSIM0gOCWcQ*
// @grant        none
// @updateURL    https://raw.githubusercontent.com/kitti332/vibie-checker/main/vibie-checker.user.js
// @downloadURL  https://raw.githubusercontent.com/kitti332/vibie-checker/main/vibie-checker.user.js
// @supportURL   https://github.com/kitti332/vibie-checker/issues
// ==/UserScript==

(() => {
  const URL = "https://vibie.live/app/events/YFGJ6VT3TGeJSIM0gOCWcQ";
  const KEY_Q = "vibieCheckQuery", KEY_END = "vibieCheckEnd", KEY_TARGETS = "vibieCheckTargets";
  const DEFAULT_Q = "CLD016, CFQ2L6, UKTXS2, NJ7PFR, ML853W, 2K8BMC, T48QZL, 31Z35R";
  const DEFAULT_TARGET_H = 35;
  const secs = t => { const [h, m, s] = t.split(".")[0].split(":").map(Number); return h * 3600 + m * 60 + s; };
  const hms = s => { const a = Math.abs(s), p2 = n => String(n).padStart(2, "0"); return (s < 0 ? "-" : "") + Math.floor(a / 3600) + ":" + p2(Math.floor(a % 3600 / 60)) + ":" + p2(Math.floor(a % 60)); };
  const norm = s => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  const load = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
  const loadTargets = () => { try { return JSON.parse(localStorage.getItem(KEY_TARGETS) || "{}"); } catch { return {}; } };
  let targets = loadTargets();

  const box = document.createElement("div");
  box.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:999999;background:#1e1e1e;color:#eee;" +
    "font:13px/1.4 system-ui,sans-serif;padding:10px;border-radius:8px;box-shadow:0 2px 12px #0008;max-width:95vw;max-height:90vh;overflow:auto";
  box.innerHTML = `<div style="display:flex;gap:6px;margin-bottom:6px">
      <input class="q" placeholder="ID, ชื่อ, อันดับ (เช่น ID:10, ID:20, ID:#1, 250, #1, 245-250) หรือตัวคั่น ---" style="flex:1;min-width:300px;padding:4px 6px;border-radius:4px;border:1px solid #555;background:#111;color:#eee">
      <button class="go" style="padding:4px 10px;border-radius:4px;border:0;background:#3a7;color:#fff;cursor:pointer">เช็ก</button>
      <button class="fold" title="ย่อ" style="padding:4px 8px;border-radius:4px;border:0;background:#444;color:#fff;cursor:pointer">–</button>
    </div>
    <div class="body">
      <label style="display:block;margin-bottom:6px;opacity:.8">event จบ <span class="endauto"></span> · กรอก HH:MM เพื่อใช้เวลาอื่นแทน (เว้นว่าง = ใช้ค่าจากหน้าเว็บ)
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

  function parseTermTarget(raw) {
    const tm = /^(.*?)\s*(?:[:=/]\s*(#?1|top1|\d+(?:\.\d+)?)h?|\(\s*(#?1|top1|\d+(?:\.\d+)?)h?\s*\)|\s+(#?1|top1|\d+(?:\.\d+)?)h)$/i.exec(raw);
    if (tm && tm[1].trim()) {
      const rawVal = (tm[2] || tm[3] || tm[4]).toLowerCase();
      const target = (rawVal === "#1" || rawVal === "1" || rawVal === "top1") ? "#1" : parseFloat(rawVal);
      return { base: tm[1].trim(), explicitTarget: target };
    }
    return { base: raw, explicitTarget: null };
  }

  function getTarget(key, explicitTarget) {
    if (explicitTarget === "#1" || (typeof explicitTarget === "number" && !isNaN(explicitTarget) && explicitTarget > 0)) return explicitTarget;
    const saved = key ? targets[key.toUpperCase()] : null;
    if (saved === "#1") return "#1";
    return saved && !isNaN(saved) && Number(saved) > 0 ? Number(saved) : DEFAULT_TARGET_H;
  }

  function makeTargetCell(tr, key, targetVal, termIdx) {
    const isTop1 = targetVal === "#1";
    const c = cell(tr, isTop1 ? "🏆#1" : `${targetVal}h`);
    const color = isTop1 ? "#ffd700" : targetVal <= 10 ? "#5cf" : targetVal <= 20 ? "#fb4" : "#aaa";
    c.style.cssText += `;color:${color};cursor:pointer;user-select:none;font-weight:600;text-decoration:underline dotted`;
    c.title = "คลิกเพื่อสลับเป้าหมาย (35h ➔ 20h ➔ 10h ➔ 🏆#1) หรือพิมพ์ต่อท้าย เช่น ID:10, ID:20, ID:#1";
    c.onclick = () => {
      const tiers = [35, 20, 10, "#1"];
      const idx = tiers.indexOf(targetVal);
      const nextVal = tiers[(idx + 1) % tiers.length];
      if (key) {
        if (nextVal === DEFAULT_TARGET_H) delete targets[key.toUpperCase()];
        else targets[key.toUpperCase()] = nextVal;
        save(KEY_TARGETS, JSON.stringify(targets));
      }
      const parts = q.value.split(",").map(s => s.trim()).filter(Boolean);
      if (termIdx >= 0 && termIdx < parts.length) {
        const parsed = parseTermTarget(parts[termIdx]);
        if (parsed.explicitTarget !== null && parsed.base) {
          parts[termIdx] = nextVal === "#1" ? `${parsed.base}:#1` : nextVal === DEFAULT_TARGET_H ? parsed.base : `${parsed.base}:${nextVal}`;
          q.value = parts.join(", ");
          save(KEY_Q, q.value);
        }
      }
      check();
    };
    return c;
  }

  function appendMissingRow(rankText, idText, nameText, key, explicitTarget, termIdx, top1Sec, left) {
    const targetVal = getTarget(key, explicitTarget);
    const isTop1Target = targetVal === "#1";
    const targetSec = isTop1Target ? (top1Sec ?? 0) : targetVal * 3600;
    const tr = document.createElement("tr");
    cell(tr, rankText);
    cell(tr, idText);
    cell(tr, nameText);
    cell(tr, "—");
    makeTargetCell(tr, key, targetVal, termIdx);
    cell(tr, "0.0%");
    const needCell = cell(tr, isTop1Target ? (top1Sec !== null ? "ห่าง " + hms(top1Sec) : "—") : hms(targetSec));
    if (isTop1Target && top1Sec !== null) needCell.style.color = "#f99";
    const rest = left === null ? null : left - targetSec;
    const c = cell(tr, rest === null ? "—" : hms(rest));
    if (rest !== null) c.style.color = rest < 0 ? "#f66" : rest < 3600 ? "#fb4" : "#6d6";
    table.appendChild(tr);
  }

  // seconds until the event ends: a typed HH:MM wins, otherwise the date_end the page itself carries
  let endAuto = null;
  function secsLeft() {
    const m = /^(\d{1,2}):(\d{2})$/.exec(endIn.value.trim());
    if (!m) return endAuto ? Math.floor((endAuto - new Date()) / 1000) : null;
    const end = new Date(); end.setHours(+m[1], +m[2], 0, 0);
    if (end < new Date()) end.setDate(end.getDate() + 1);
    return Math.floor((end - new Date()) / 1000);
  }

  async function check() {
    const qs = q.value.split(",").map(s => s.trim()).filter(Boolean);
    save(KEY_Q, q.value); save(KEY_END, endIn.value);
    targets = loadTargets();
    if (!qs.length) { status.textContent = "ใส่ ID, ชื่อ หรืออันดับก่อน"; table.replaceChildren(); return; }
    status.textContent = "กำลังโหลด…";
    let html;
    try { html = (await (await fetch(URL, { cache: "no-store" })).text()).replaceAll('\\"', '"'); }
    catch (e) { status.textContent = "โหลดไม่ได้: " + e.message; return; }
    const em = /"date_end":"([^"]+)"/.exec(html);
    const d = em ? new Date(em[1]) : null;
    endAuto = d && !isNaN(d) ? d : null;
    box.querySelector(".endauto").textContent = endAuto ? "(หน้าเว็บ: " + endAuto.toLocaleString("th-TH-u-ca-gregory", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok", hour12: false }) + ")" : "(อ่านจากหน้าเว็บไม่ได้)";
    const seen = new Set(), rows = [];
    for (const m of html.matchAll(/(?:"display_name":"([^"]*)",)?"vibie_id":"([A-Za-z0-9]+)",(?:"tier":"[^"]*",)?"results":"([0-9:.]+)"/g))
      if (!seen.has(m[2])) { seen.add(m[2]); rows.push({ name: m[1] || "", id: m[2], s: secs(m[3]) }); }
    rows.sort((a, b) => b.s - a.s);
    const top1Sec = rows.length ? rows[0].s : null;
    const left = secsLeft();
    status.innerHTML = `${new Date().toLocaleTimeString("th-TH")} · ${rows.length} คนบนหน้า · ` +
      (rows.length ? `<span class="first-rank" style="text-decoration:underline;cursor:pointer" title="คลิกเพื่อเพิ่ม #1 ลงในช่องค้นหา">อันดับ 1: ${hms(rows[0].s)}</span> · ` : "") +
      (rows.length ? `<span class="last-rank" style="text-decoration:underline;cursor:pointer" title="คลิกเพื่อเพิ่มอันดับ ${rows.length} ลงในช่องค้นหา">อันดับ ${rows.length}: ${hms(rows[rows.length - 1].s)}</span>` : "ไม่มีข้อมูล") +
      (left === null ? "" : ` · event เหลือ ${hms(left)}`) + " · รีเฟรชทุก 1 นาที";
    const frBtn = status.querySelector(".first-rank");
    if (frBtn) {
      frBtn.onclick = () => {
        const val = q.value.trim();
        if (!val.split(",").map(s => s.trim()).includes("#1")) {
          q.value = val ? `${val}, #1` : "#1";
          check();
        }
      };
    }
    const lrBtn = status.querySelector(".last-rank");
    if (lrBtn) {
      lrBtn.onclick = () => {
        const val = q.value.trim();
        const targetRank = String(rows.length);
        if (!val.split(",").map(s => s.trim()).includes(targetRank)) {
          q.value = val ? `${val}, ${targetRank}` : targetRank;
          check();
        }
      };
    }

    table.replaceChildren();
    const head = document.createElement("tr");
    ["อันดับ", "ID", "ชื่อ", "เวลา", "เป้า", "%", "ยังขาด", "พักได้อีก"].forEach(h => cell(head, h, "th"));
    table.appendChild(head);
    for (let termIdx = 0; termIdx < qs.length; termIdx++) {
      const rawTerm = qs[termIdx];
      // 0. Separator row (e.g. ---, --------, or --- label ---)
      const sepMatch = /^[-=_~*|]{2,}\s*(.*?)\s*[-=_~*|]{2,}$/.exec(rawTerm);
      const isPureSep = /^[-=_~*|]{2,}$/.test(rawTerm);
      if (isPureSep || sepMatch) {
        const label = sepMatch && sepMatch[1] ? sepMatch[1].trim() : "";
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 8;
        td.style.cssText = "padding:8px 0;background:transparent;";
        if (label) {
          td.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin:2px 8px;color:#fff;font-size:12px;font-weight:bold">
            <div style="flex:1;height:2px;background:#888;border-radius:1px"></div>
            <span>${label}</span>
            <div style="flex:1;height:2px;background:#888;border-radius:1px"></div>
          </div>`;
        } else {
          td.innerHTML = `<div style="height:3px;background:#aaa;margin:2px 8px;border-radius:2px"></div>`;
        }
        tr.appendChild(td);
        table.appendChild(tr);
        continue;
      }

      // Parse optional per-account target suffix e.g. ID:10, ID:20, ID:#1, ID:top1
      const { base: term, explicitTarget } = parseTermTarget(rawTerm);

      let hits = [];
      const rangeM = /^[#]?(\d+)\s*-\s*[#]?(\d+)$/.exec(term);
      if (rangeM) {
        const from = Math.min(+rangeM[1], +rangeM[2]);
        const to = Math.max(+rangeM[1], +rangeM[2]);
        if (from >= 1) {
          for (let k = from; k <= to; k++) {
            if (k <= rows.length) {
              hits.push(rows[k - 1]);
            } else {
              appendMissingRow(k, "—", `ไม่พบ (มีแค่ ${rows.length} อันดับบนหน้าเว็บ)`, `#${k}`, explicitTarget, termIdx, top1Sec, left);
            }
          }
        }
      } else {
        // 1. Exact ID match
        hits = rows.filter(r => r.id.toUpperCase() === term.toUpperCase());

        // 2. Rank match (e.g. 250, #250, 1)
        if (!hits.length) {
          const rankM = /^[#]?(\d+)$/.exec(term);
          if (rankM) {
            const k = parseInt(rankM[1], 10);
            if (k >= 1 && k <= rows.length) {
              hits = [rows[k - 1]];
            } else if (k > rows.length) {
              appendMissingRow(k, "—", `ไม่พบ (มีแค่ ${rows.length} อันดับบนหน้าเว็บ)`, `#${k}`, explicitTarget, termIdx, top1Sec, left);
              continue;
            }
          }
        }

        // 3. Name match
        if (!hits.length) hits = rows.filter(r => r.name && norm(r.name).includes(norm(term)));
      }

      if (!hits.length && !rangeM) {
        appendMissingRow("–", term, "ไม่พบ (ต่ำกว่าอันดับ 250?)", term, explicitTarget, termIdx, top1Sec, left);
        continue;
      }

      for (const r of hits) {
        const targetVal = getTarget(r.id, explicitTarget);
        if (explicitTarget === "#1" || (typeof explicitTarget === "number" && !isNaN(explicitTarget) && explicitTarget > 0)) {
          targets[r.id.toUpperCase()] = explicitTarget;
          save(KEY_TARGETS, JSON.stringify(targets));
        }
        const isTop1Target = targetVal === "#1";
        const targetSec = isTop1Target ? (top1Sec ?? 0) : targetVal * 3600;
        const need = targetSec - r.s;
        const tr = document.createElement("tr");
        cell(tr, rows.indexOf(r) + 1); cell(tr, r.id); cell(tr, r.name); cell(tr, hms(r.s));
        makeTargetCell(tr, r.id, targetVal, termIdx);
        cell(tr, targetSec > 0 ? Math.min(100, r.s / targetSec * 100).toFixed(1) + "%" : "100.0%");
        if (isTop1Target) {
          const needCell = cell(tr, need <= 0 ? "🏆 ที่ 1" : "ห่าง " + hms(need));
          needCell.style.color = need <= 0 ? "#ffd700" : "#f99";
        } else {
          cell(tr, need <= 0 ? "✅ ครบ" : hms(need));
        }
        if (isTop1Target && need <= 0) {
          if (rows.length > 1) {
            const c = cell(tr, "นำ #2 " + hms(r.s - rows[1].s));
            c.style.color = "#6d6";
          } else {
            cell(tr, "—");
          }
        } else {
          const rest = left === null || need <= 0 ? null : left - need;
          const c = cell(tr, rest === null ? "—" : hms(rest));
          if (rest !== null) c.style.color = rest < 0 ? "#f66" : rest < 3600 ? "#fb4" : "#6d6";
        }
        table.appendChild(tr);
      }
    }
  }

  box.querySelector(".go").onclick = check;
  for (const el of [q, endIn]) el.onkeydown = e => { if (e.key === "Enter") check(); };
  setInterval(() => { if (q.value.trim()) check(); }, 60000);
  check();
})();
