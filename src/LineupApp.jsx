import { useState, useEffect, useCallback } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

const POSITIONS = ["P", "C", "1B", "2B", "3B", "SS", "LF", "CF", "RF"];
const POSITION_LABELS = {
  P: "投手", C: "捕手", "1B": "一塁手", "2B": "二塁手", "3B": "三塁手",
  SS: "遊撃手", LF: "左翼手", CF: "中堅手", RF: "右翼手", DH: "指名打者",
};
// 表示用短縮名（日本語）
const POS_SHORT = {
  P: "投", C: "捕", "1B": "一", "2B": "二", "3B": "三",
  SS: "遊", LF: "左", CF: "中", RF: "右", DH: "DH",
};
const FIELD_POSITIONS = [
  // 外野（さらに前進）
  { id: "CF", x: 50, y: 26 },
  { id: "LF", x: 20, y: 33 },
  { id: "RF", x: 80, y: 33 },
  // 内野
  { id: "SS", x: 40, y: 46 },   // 2塁ベース(50,39)の左後方
  { id: "2B", x: 60, y: 46 },   // 2塁ベース(50,39)の右後方
  { id: "3B", x: 22, y: 62 },   // 3塁守備位置
  { id: "1B", x: 77, y: 62 },   // 1塁守備位置
  { id: "P",  x: 50, y: 61 },   // 投手板（マウンド）
  { id: "C",  x: 50, y: 88 },   // 捕手（ホームベース後方）
];
const THROW_OPTIONS = [{ value: "", label: "—" }, { value: "右投", label: "右投" }, { value: "左投", label: "左投" }];
const BAT_OPTIONS   = [{ value: "", label: "—" }, { value: "右打", label: "右打" }, { value: "左打", label: "左打" }, { value: "両打", label: "両打" }];
const GRADE_OPTIONS = [{ value: "", label: "—" }, ...["1年","2年","3年","4年","5年","6年"].map(v => ({ value: v, label: v }))];

const INIT_PLAYERS = [
  { id: 1, name: "山田 太郎",   number: "1", grade: "", throwHand: "", batHand: "" },
  { id: 2, name: "鈴木 一郎",   number: "2", grade: "", throwHand: "", batHand: "" },
  { id: 3, name: "田中 健太",   number: "3", grade: "", throwHand: "", batHand: "" },
  { id: 4, name: "佐藤 大輝",   number: "4", grade: "", throwHand: "", batHand: "" },
  { id: 5, name: "伊藤 翔",     number: "5", grade: "", throwHand: "", batHand: "" },
  { id: 6, name: "渡辺 蓮",     number: "6", grade: "", throwHand: "", batHand: "" },
  { id: 7, name: "中村 悠斗",   number: "7", grade: "", throwHand: "", batHand: "" },
  { id: 8, name: "小林 龍之介", number: "8", grade: "", throwHand: "", batHand: "" },
  { id: 9, name: "加藤 光",     number: "9", grade: "", throwHand: "", batHand: "" },
];

function handLabel(t, b) {
  if (!t && !b) return null;
  return `${t.replace("投","") || "—"}投${b.replace("打","") || "—"}打`;
}
async function saveTeamData(uid, data) {
  await setDoc(doc(db, "teams", uid), data, { merge: true });
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ label, sublabel, checked, onChange, color }) {
  return (
    <div onClick={onChange} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: "10px 14px", borderRadius: 10, background: checked ? `${color}18` : "rgba(255,255,255,0.03)", border: `1px solid ${checked ? color + "66" : "#1e3a6a"}`, transition: "all 0.2s", userSelect: "none", flex: 1, WebkitTapHighlightColor: "transparent" }}>
      <div style={{ width: 44, height: 24, borderRadius: 12, background: checked ? color : "#1e3a6a", position: "relative", transition: "all 0.25s", flexShrink: 0, boxShadow: checked ? `0 0 10px ${color}60` : "none" }}>
        <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: checked ? 23 : 3, transition: "left 0.25s" }} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: checked ? color : "#7eb8ff" }}>{label}</div>
        {sublabel && <div style={{ fontSize: 11, color: "#5a7aaa", marginTop: 2 }}>{sublabel}</div>}
      </div>
    </div>
  );
}

// ─── Accordion section (mobile bench/absent panels) ───────────────────────────
function Accordion({ title, count, color = "#7eb8ff", defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${color}33`, borderRadius: 10, overflow: "hidden", marginBottom: 8 }}>
      <div onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: `${color}0d`, cursor: "pointer", userSelect: "none", WebkitTapHighlightColor: "transparent" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: 1 }}>{title} <span style={{ fontWeight: 400, opacity: 0.7 }}>({count})</span></div>
        <div style={{ fontSize: 16, color, transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "none" }}>▾</div>
      </div>
      {open && <div style={{ padding: "8px 10px", background: "rgba(0,0,0,0.15)" }}>{children}</div>}
    </div>
  );
}

// ─── Baseball SVG Icon ───────────────────────────────────────────────────────
function BaseballIcon({ size = 28, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, ...style }}>
      <circle cx="16" cy="16" r="14" fill="white" stroke="#e0e0e0" strokeWidth="0.5"/>
      {/* 左側のステッチ */}
      <path d="M 9 7 C 11 10, 11 14, 9 17 C 11 20, 11 24, 9 25" stroke="#cc2200" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      {/* 右側のステッチ */}
      <path d="M 23 7 C 21 10, 21 14, 23 17 C 21 20, 21 24, 23 25" stroke="#cc2200" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      {/* 左ステッチの横糸 */}
      <line x1="9" y1="9.5"  x2="12" y2="10.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="12"   x2="12" y2="12.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="14.5" x2="12" y2="14.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="17"   x2="12" y2="16.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="19.5" x2="12" y2="19"   stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="22"   x2="12" y2="22"   stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      {/* 右ステッチの横糸 */}
      <line x1="23" y1="9.5"  x2="20" y2="10.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="23" y1="12"   x2="20" y2="12.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="23" y1="14.5" x2="20" y2="14.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="23" y1="17"   x2="20" y2="16.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="23" y1="19.5" x2="20" y2="19"   stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="23" y1="22"   x2="20" y2="22"   stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

// ─── Stadium SVG Icon ─────────────────────────────────────────────────────────
function StadiumIcon({ size = 20, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, ...style }}>
      {/* 外枠リング */}
      <circle cx="20" cy="20" r="19" fill="#1e6b2f" stroke="#4caf50" strokeWidth="2"/>
      <circle cx="20" cy="20" r="19" fill="none" stroke="#4caf50" strokeWidth="7"/>
      {/* 芝フィールド */}
      <circle cx="20" cy="20" r="12" fill="#1e6b2f"/>
      {/* 内野土 */}
      <polygon points="20,9 31,20 20,31 9,20" fill="#8b5e3c"/>
      {/* マウンド */}
      <circle cx="20" cy="20" r="2.5" fill="#a07040"/>
      {/* 投手板 */}
      <rect x="17.5" y="19" width="5" height="2" rx="0.5" fill="white" opacity="0.9"/>
      {/* ホームプレート */}
      <polygon points="20,29 17.5,26.5 17.5,24.5 22.5,24.5 22.5,26.5" fill="white"/>
      {/* 1塁 */}
      <rect x="25.5" y="17.5" width="4" height="4" rx="0.5" fill="white" transform="rotate(45 27.5 19.5)"/>
      {/* 2塁 */}
      <rect x="17.5" y="8.5" width="4" height="4" rx="0.5" fill="white" transform="rotate(45 19.5 10.5)"/>
      {/* 3塁 */}
      <rect x="9.5" y="17.5" width="4" height="4" rx="0.5" fill="white" transform="rotate(45 11.5 19.5)"/>
      {/* ファールライン左 */}
      <line x1="20" y1="28" x2="4" y2="4" stroke="white" strokeWidth="0.8" opacity="0.6"/>
      {/* ファールライン右 */}
      <line x1="20" y1="28" x2="36" y2="4" stroke="white" strokeWidth="0.8" opacity="0.6"/>
    </svg>
  );
}


// ─── FieldView ────────────────────────────────────────────────────────────────
// SVG座標系: viewBox="0 0 100 100"
// ベース位置（実際の野球場の比率に基づく）
//   Home: (50, 83)  1B: (74, 61)  2B: (50, 39)  3B: (26, 61)  Mound: (50, 62)
// ファールライン: Home→1B方向を延長してRF角へ、Home→3B方向を延長してLF角へ
//   方向ベクトル Home→1B: (24, -22) → 右端(x=102)まで延長 → y = 83+(52/24)*(-22) ≈ 35.4
//   方向ベクトル Home→3B: (-24,-22) → 左端(x=-2)まで延長 → y ≈ 35.4
function FieldView({ players, positions, lineup = [], onPlayerTap = null }) {
  const getHolder = (pos) => {
    const pid = Object.keys(positions).find(k => positions[k] === pos);
    return pid ? players.find(p => p.id === Number(pid)) : null;
  };
  const getBatOrder = (player) => {
    if (!player) return null;
    const idx = lineup.indexOf(player.id);
    return idx >= 0 ? idx + 1 : null;
  };

  // SVG上のキー座標
  const HOME  = { x: 50,  y: 83 };
  const B1    = { x: 74,  y: 61 };
  const B2    = { x: 50,  y: 39 };
  const B3    = { x: 26,  y: 61 };
  const MOUND = { x: 50,  y: 62 };

  // ファールライン延長先（フィールド外まで伸ばしてclipで切る）
  const RF_END = { x: 104, y: 83 + (104 - 50) / (74 - 50) * (61 - 83) }; // ≈ (104, 33.5)
  const LF_END = { x: -4,  y: 83 + (-4  - 50) / (26 - 50) * (61 - 83) }; // ≈ (-4, 33.5)

  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: "10 / 9", background: "radial-gradient(ellipse at 50% 92%, #1e6b2f 0%, #114a1c 45%, #0a3212 70%, #071a0c 100%)", borderRadius: 14, overflow: "hidden", border: "2px solid #1e4a2a" }}>
      <svg
        viewBox="0 0 100 100"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
        preserveAspectRatio="none"
      >
        {/* ── 外野フェンス弧 ── */}
        <path
          d={`M ${LF_END.x + 4} ${LF_END.y} Q 50 2 ${RF_END.x - 4} ${RF_END.y}`}
          fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5"
        />

        {/* ── ファールライン（ホーム→LF角、ホーム→RF角） ── */}
        <line x1={HOME.x} y1={HOME.y} x2={LF_END.x} y2={LF_END.y}
          stroke="rgba(255,255,255,0.45)" strokeWidth="0.4" />
        <line x1={HOME.x} y1={HOME.y} x2={RF_END.x} y2={RF_END.y}
          stroke="rgba(255,255,255,0.45)" strokeWidth="0.4" />

        {/* ── 内野土（ダイヤモンド） ── */}
        <polygon
          points={`${B3.x},${B3.y} ${B2.x},${B2.y} ${B1.x},${B1.y} ${HOME.x},${HOME.y}`}
          fill="rgba(160,100,50,0.22)" stroke="rgba(200,140,80,0.3)" strokeWidth="0.3"
        />

        {/* ── 内野外周の土の弧（外野との境界） ── */}
        <path
          d={`M ${B3.x - 10} ${B3.y + 8} Q 50 ${B2.y - 14} ${B1.x + 10} ${B1.y + 8}`}
          fill="none" stroke="rgba(200,140,80,0.2)" strokeWidth="0.4" strokeDasharray="1.5,1.5"
        />

        {/* ── ベースライン（ダイヤモンド辺） ── */}
        <polygon
          points={`${B3.x},${B3.y} ${B2.x},${B2.y} ${B1.x},${B1.y} ${HOME.x},${HOME.y}`}
          fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.3"
        />

        {/* ── 投手板 ── */}
        <rect x={MOUND.x - 1.5} y={MOUND.y - 0.6} width="3" height="1.2"
          fill="rgba(255,255,255,0.85)" rx="0.3" />

        {/* ── マウンド円 ── */}
        <circle cx={MOUND.x} cy={MOUND.y} r="5"
          fill="rgba(160,100,50,0.12)" stroke="rgba(200,140,80,0.15)" strokeWidth="0.3" />

        {/* ── ホームプレート ── */}
        <rect x={HOME.x - 1.4} y={HOME.y - 1.4} width="2.8" height="2.8"
          fill="white" opacity="0.95" transform={`rotate(45 ${HOME.x} ${HOME.y})`} />

        {/* ── 各ベース（白い正方形） ── */}
        {[B1, B2, B3].map((b, i) => (
          <rect key={i} x={b.x - 1.2} y={b.y - 1.2} width="2.4" height="2.4"
            fill="white" opacity="0.9" transform={`rotate(45 ${b.x} ${b.y})`}
            style={{ filter: "drop-shadow(0 0 1px rgba(255,255,255,0.8))" }} />
        ))}

        {/* ── バッターボックス ── */}
        <rect x={HOME.x - 4.5} y={HOME.y - 2.5} width="2.8" height="5"
          fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.25" />
        <rect x={HOME.x + 1.7} y={HOME.y - 2.5} width="2.8" height="5"
          fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.25" />
      </svg>

      {/* ── 選手アイコン（div絶対配置） ── */}
      {FIELD_POSITIONS.map(fp => {
        const h = getHolder(fp.id);
        const batNum = getBatOrder(h);
        const tappable = onPlayerTap !== null;
        return (
          <div key={fp.id}
            onClick={tappable ? () => onPlayerTap(h, fp.id) : undefined}
            style={{ position: "absolute", left: `${fp.x}%`, top: `${fp.y}%`, transform: "translate(-50%,-50%)", textAlign: "center", zIndex: 3, transition: "all 0.3s", cursor: tappable ? "pointer" : "default" }}>
            {/* 打順バッジ */}
            {batNum && (
              <div style={{ position: "absolute", top: -8, right: -8, width: 16, height: 16, borderRadius: "50%", background: "#ffb400", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#000", zIndex: 4, boxShadow: "0 1px 4px rgba(0,0,0,0.5)", lineHeight: 1 }}>{batNum}</div>
            )}
            <div style={{
              width: h ? 48 : 34, height: h ? 48 : 34, borderRadius: "50%",
              background: h ? "linear-gradient(135deg,#00b4ff,#0055cc)" : tappable ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.08)",
              border: `2px solid ${h ? "#00e5ff" : tappable ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.2)"}`,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              boxShadow: h ? "0 0 14px rgba(0,180,255,0.55)" : "none", transition: "all 0.3s",
            }}>
              <div style={{ fontSize: h ? 8 : 9, fontWeight: 900, color: h ? "#fff" : tappable ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.45)", lineHeight: 1 }}>{POS_SHORT[fp.id] || fp.id}</div>
              {h && <div style={{ fontSize: 7, color: "rgba(255,255,255,0.92)", marginTop: 2, lineHeight: 1, maxWidth: 40, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name.split(" ").pop()}</div>}
              {!h && tappable && <div style={{ fontSize: 6, color: "rgba(255,255,255,0.4)", marginTop: 2, lineHeight: 1 }}>+</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Player Edit Modal ────────────────────────────────────────────────────────
function PlayerEditModal({ player, onSave, onClose }) {
  const [form, setForm] = useState({ name: player.name || "", number: player.number || "", grade: player.grade || "", throwHand: player.throwHand || "", batHand: player.batHand || "" });
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const inp = { width: "100%", padding: "12px 14px", background: "#0a1e40", border: "1px solid #1e3a6a", borderRadius: 10, color: "#e8f0fe", fontSize: 16, fontFamily: "inherit", outline: "none", WebkitAppearance: "none" };
  const lbl = { fontSize: 12, color: "#7eb8ff", fontWeight: 700, marginBottom: 6, display: "block" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300 }} onClick={onClose}>
      <div style={{ background: "#0d1e3a", border: "1px solid #1e3a6a", borderRadius: "20px 20px 0 0", padding: "24px 20px 36px", width: "100%", maxWidth: 520, fontFamily: "'Noto Sans JP', sans-serif" }} onClick={e => e.stopPropagation()}>
        {/* Handle bar */}
        <div style={{ width: 40, height: 4, background: "#2a4a8a", borderRadius: 2, margin: "0 auto 20px" }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: "#e8f0fe", marginBottom: 20 }}>✏️ 選手情報を編集</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 90 }}>
              <label style={lbl}>背番号</label>
              <input style={inp} value={form.number} onChange={e => set("number", e.target.value)} placeholder="10" />
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>選手名</label>
              <input style={inp} value={form.name} onChange={e => set("name", e.target.value)} placeholder="山田 太郎" />
            </div>
          </div>
          <div>
            <label style={lbl}>学年</label>
            <select style={inp} value={form.grade} onChange={e => set("grade", e.target.value)}>
              {GRADE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={lbl}>投げる手</label>
              <select style={inp} value={form.throwHand} onChange={e => set("throwHand", e.target.value)}>
                {THROW_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={lbl}>打つ手</label>
              <select style={inp} value={form.batHand} onChange={e => set("batHand", e.target.value)}>
                {BAT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          {(form.throwHand || form.batHand) && (
            <div style={{ fontSize: 13, color: "#00e5ff", background: "rgba(0,229,255,0.07)", border: "1px solid rgba(0,229,255,0.2)", borderRadius: 8, padding: "8px 14px", textAlign: "center" }}>
              {form.throwHand || "—"}　{form.batHand || "—"}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "14px", background: "#1a3260", border: "none", borderRadius: 12, color: "#7eb8ff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>キャンセル</button>
          <button onClick={() => onSave(form)} style={{ flex: 2, padding: "14px", background: "linear-gradient(135deg,#1e6adc,#0d4aaa)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>保存</button>
        </div>
      </div>
    </div>
  );
}

// ─── SubModal ────────────────────────────────────────────────────────────────
function SubModal({ sub, players, lineup, absent, availablePositions, onSave, onClose }) {
  const isEdit = sub !== null;
  const [subType,    setSubType]    = useState(sub?.subType    || "sub");
  const [outPlayerId,setOutPlayerId]= useState(sub?.outPlayerId|| "");
  const [inPlayerId, setInPlayerId] = useState(sub?.inPlayerId || "");
  const [posPlayerA, setPosPlayerA] = useState(sub?.posPlayerA || "");
  const [posPlayerB, setPosPlayerB] = useState(sub?.posPlayerB || "");
  const [position,   setPosition]   = useState(sub?.position   || "");
  const [memo,       setMemo]       = useState(sub?.memo       || "");
  const [error,      setError]      = useState("");

  const inp = { width:"100%", padding:"11px 14px", background:"#091a38", border:"1px solid #1e3a6a", borderRadius:9, color:"#e8f0fe", fontSize:16, fontFamily:"inherit", outline:"none", WebkitAppearance:"none" };
  const lbl = { fontSize:12, color:"#7eb8ff", fontWeight:700, marginBottom:6, display:"block" };

  const activePlayerIds = lineup.filter(Boolean);
  const starterPlayers  = players.filter(p => activePlayerIds.includes(p.id));
  const benchPlayers    = players.filter(p => !activePlayerIds.includes(p.id) && !absent.includes(p.id));

  const handleSave = () => {
    if (subType === "sub" && !outPlayerId && !inPlayerId) { setError("出る選手または入る選手を選択してください"); return; }
    if (subType === "posChange" && !posPlayerA) { setError("守備変更する選手を選択してください"); return; }
    onSave({
      id: sub?.id || null,
      subType,
      outPlayerId:  subType === "sub"       ? (outPlayerId  || null) : null,
      inPlayerId:   subType === "sub"       ? (inPlayerId   || null) : null,
      posPlayerA:   subType === "posChange" ? (posPlayerA   || null) : null,
      posPlayerB:   subType === "posChange" ? (posPlayerB   || null) : null,
      position:     position || "",
      memo:         memo || "",
    });
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.82)", display:"flex", alignItems:"flex-end", justifyContent:"center", zIndex:300 }} onClick={onClose}>
      <div style={{ background:"#0d1e3a", border:"1px solid #1e3a6a", borderRadius:"20px 20px 0 0", padding:"20px 20px 44px", width:"100%", maxWidth:520, fontFamily:"'Noto Sans JP', sans-serif", maxHeight:"90vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
        <div style={{ width:40, height:4, background:"#2a4a8a", borderRadius:2, margin:"0 auto 18px" }} />
        <div style={{ fontSize:16, fontWeight:700, color:"#e8f0fe", marginBottom:16 }}>
          {isEdit ? "交代・守備変更を編集" : "交代・守備変更を追加"}
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>

          {/* 種別 */}
          <div style={{ display:"flex", background:"#091a38", borderRadius:9, padding:3 }}>
            {[["sub","🔄 選手交代"],["posChange","🔀 守備変更のみ"]].map(([key, label]) => (
              <button key={key} onClick={() => setSubType(key)}
                style={{ flex:1, padding:"9px", border:"none", borderRadius:7, cursor:"pointer", fontFamily:"inherit", fontSize:13, fontWeight:700, background:subType===key ? "linear-gradient(135deg,#1e4a9a,#0d2e6a)" : "transparent", color:subType===key ? "#fff" : "#4a6a9a", transition:"all 0.2s", WebkitTapHighlightColor:"transparent" }}>
                {label}
              </button>
            ))}
          </div>

          {/* 選手交代 */}
          {subType === "sub" && (<>
            <div>
              <label style={lbl}>OUT（出る選手）</label>
              <select style={inp} value={outPlayerId} onChange={e => setOutPlayerId(Number(e.target.value)||"")}>
                <option value="">— 選択してください —</option>
                {starterPlayers.map(p => <option key={p.id} value={p.id}>#{p.number} {p.name}{p.grade ? ` (${p.grade})` : ""}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>IN（入る選手）</label>
              <select style={inp} value={inPlayerId} onChange={e => setInPlayerId(Number(e.target.value)||"")}>
                <option value="">— 選択してください —</option>
                {benchPlayers.map(p => <option key={p.id} value={p.id}>#{p.number} {p.name}{p.grade ? ` (${p.grade})` : ""}</option>)}
                {benchPlayers.length === 0 && <option disabled>控え選手がいません</option>}
              </select>
            </div>
            <div>
              <label style={lbl}>守備ポジション（未指定時はOUT選手のポジションを引き継ぎ。変更する場合は明示的に選択）</label>
              <select style={inp} value={position} onChange={e => setPosition(e.target.value)}>
                <option value="">— OUT選手から引き継ぎ —</option>
                {availablePositions.map(p => <option key={p} value={p}>{POS_SHORT[p] || p}</option>)}
              </select>
            </div>
          </>)}

          {/* 守備変更のみ */}
          {subType === "posChange" && (<>
            <div>
              <label style={lbl}>選手A（守備変更する選手）</label>
              <select style={inp} value={posPlayerA} onChange={e => setPosPlayerA(Number(e.target.value)||"")}>
                <option value="">— 選択してください —</option>
                {starterPlayers.map(p => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>選手B（入れ替える相手・省略時は単独変更）</label>
              <select style={inp} value={posPlayerB} onChange={e => setPosPlayerB(Number(e.target.value)||"")}>
                <option value="">— 入れ替えなし —</option>
                {starterPlayers.filter(p => p.id !== Number(posPlayerA)).map(p => <option key={p.id} value={p.id}>#{p.number} {p.name}</option>)}
              </select>
            </div>
            {!posPlayerB && (
              <div>
                <label style={lbl}>変更後のポジション（選手B未指定時は必須）</label>
                <select style={inp} value={position} onChange={e => setPosition(e.target.value)}>
                  <option value="">— 選択してください —</option>
                  {availablePositions.map(p => <option key={p} value={p}>{POS_SHORT[p] || p}</option>)}
                </select>
              </div>
            )}
          </>)}

          {/* メモ */}
          <div>
            <label style={lbl}>メモ（任意）</label>
            <input style={inp} value={memo} onChange={e => setMemo(e.target.value)} placeholder="例: 球数制限、疲労のため" />
          </div>

          {error && <div style={{ fontSize:12, color:"#ff8080", background:"rgba(255,60,60,0.1)", border:"1px solid rgba(255,60,60,0.25)", borderRadius:7, padding:"8px 12px" }}>⚠️ {error}</div>}

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={onClose} style={{ flex:1, padding:"13px", background:"#1a3260", border:"none", borderRadius:12, color:"#7eb8ff", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>キャンセル</button>
            <button onClick={handleSave} style={{ flex:2, padding:"13px", background:"linear-gradient(135deg,#1e6adc,#0d4aaa)", border:"none", borderRadius:12, color:"#fff", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"inherit" }}>
              {isEdit ? "更新する" : "追加する"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// ─── Main ─────────────────────────────────────────────────────────────────────
export default function LineupApp({ user, onLogout, onOpenSettings }) {
  const [players, setPlayers]             = useState(INIT_PLAYERS);
  const [games, setGames]                 = useState([]);
  const [currentGame, setCurrentGame]     = useState(null);
  const [activeTab, setActiveTab]         = useState("history");
  const [dragInfo, setDragInfo]           = useState(null);
  const [hoveredSlot, setHoveredSlot]     = useState(null);
  const [newName, setNewName]             = useState("");
  const [newNumber, setNewNumber]         = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [saveStatus, setSaveStatus]       = useState("idle");
  const [dataLoaded, setDataLoaded]       = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [rosterFilter, setRosterFilter]   = useState("");
  const [showLogout, setShowLogout]       = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  // PWAインストールプロンプトを保持
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };
  const [importError, setImportError]     = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [swapConfirm, setSwapConfirm]     = useState(null); // { outPid, inPid, inName, outPos }
  const [fieldEditTarget, setFieldEditTarget] = useState(null); // { player, currentPos }
  const [pendingBenchSwap, setPendingBenchSwap]   = useState(null); // { outPlayer, inPlayer, outPos }
  const [showShare, setShowShare]         = useState(false);
  const [showSubModal, setShowSubModal]     = useState(false);
  const [selectedSubGroup, setSelectedSubGroup] = useState(null); // null=先発, number=グループindex
  const [editingGroupIdx, setEditingGroupIdx]   = useState(null); // 変更を追加するグループ
  const [editingChange, setEditingChange]       = useState(null); // null=新規, object=編集中
  const [shareTab, setShareTab]           = useState("text");
  const [copyDone, setCopyDone]           = useState(false);
  const [imgGenerating, setImgGenerating] = useState(false);
  const [fieldImgUrl, setFieldImgUrl]     = useState(null);
  const [combinedMode, setCombinedMode]   = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "teams", user.uid), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if (d.players) setPlayers(d.players);
        if (d.games)   setGames(d.games);
      }
      setDataLoaded(true);
    }, () => setDataLoaded(true));
    return unsub;
  }, [user.uid]);

  const persistData = useCallback(async (np, ng) => {
    setSaveStatus("saving");
    try {
      await saveTeamData(user.uid, { players: np, games: ng });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch { setSaveStatus("error"); setTimeout(() => setSaveStatus("idle"), 3000); }
  }, [user.uid]);

  const settings           = currentGame?.settings  || { dh: false, zenin: false };
  const lineup             = currentGame?.lineup    || [];
  const positions          = currentGame?.positions || {};
  const absent             = currentGame?.absent    || [];
  const availablePositions = settings.dh ? [...POSITIONS, "DH"] : POSITIONS;
  const totalSlots         = settings.zenin ? players.filter(p => !absent.includes(p.id)).length : settings.dh ? 10 : 9;
  const benchPlayers       = players.filter(p => !lineup.filter(Boolean).includes(p.id) && !absent.includes(p.id));
  const absentPlayers      = players.filter(p => absent.includes(p.id));
  const getPositionHolder  = (pos) => { const pid = Object.keys(positions).find(k => positions[k] === pos); return pid ? players.find(p => p.id === Number(pid)) : null; };

  // ── 共有テキスト生成 ──────────────────────────────────────────────────────────
  const buildShareText = () => {
    if (!currentGame) return "";
    const g = currentGame;
    const dateStr = g.date ? g.date.replace(/-/g, "/") : "";
    const lines = [];
    lines.push("⚾ スタメン表");
    lines.push(`📅 ${dateStr}${g.opponent ? "　vs " + g.opponent : ""}`);
    if (g.note) lines.push("📝 " + g.note);
    const modeStr = [g.settings?.dh ? "DH制" : "", g.settings?.zenin ? "全員打ち" : ""].filter(Boolean).join("・");
    if (modeStr) lines.push("🔧 " + modeStr);
    lines.push("");
    lines.push("【打順】");
    (g.lineup || []).forEach((pid, i) => {
      const p = players.find(pl => pl.id === pid);
      if (!p) return;
      const pos = (g.positions || {})[pid] || "";
      const hand = handLabel(p.throwHand || "", p.batHand || "");
      lines.push((i + 1) + "番  " + (pos ? "[" + pos + "]" : "　　") + "  #" + p.number + " " + p.name + (p.grade ? " (" + p.grade + ")" : "") + (hand ? " " + hand : ""));
    });
    const lineupIds = g.lineup || [];
    const absentIds = g.absent || [];
    const bench = players.filter(p => !lineupIds.includes(p.id) && !absentIds.includes(p.id));
    if (bench.length > 0) {
      lines.push("");
      lines.push("【控え】");
      bench.forEach(p => lines.push("  #" + p.number + " " + p.name));
    }
    const absentList = players.filter(p => absentIds.includes(p.id));
    if (absentList.length > 0) {
      lines.push("");
      lines.push("【休み】");
      absentList.forEach(p => lines.push("  #" + p.number + " " + p.name));
    }
    return lines.join("\n");
  };

  const handleWebShare = async () => {
    const text = buildShareText();
    if (navigator.share) {
      try { await navigator.share({ title: "スタメン表 " + (currentGame?.opponent || ""), text }); } catch (e) {}
    }
  };
  const handleCopy = async () => {
    const text = buildShareText();
    try { await navigator.clipboard.writeText(text); setCopyDone(true); setTimeout(() => setCopyDone(false), 2500); } catch {}
  };
  const handleLineShare = () => {
    const text = encodeURIComponent(buildShareText());
    window.open("https://line.me/R/share?text=" + text, "_blank");
  };

  // ── 守備配置画像生成（SVG→Canvas→PNG） ──────────────────────────────────────
  const buildFieldImageBlob = () => new Promise((resolve) => {
    const W = 600, H = 560;
    const g = currentGame;
    const pos = g?.positions || {};
    const getHolder = (posCode) => {
      const pid = Object.keys(pos).find(k => pos[k] === posCode);
      return pid ? players.find(p => p.id === Number(pid)) : null;
    };

    // 選手配置座標（FIELD_POSITIONS と同じ値）
    const FP = [
      { id:"CF", x:50, y:26 }, { id:"LF", x:20, y:33 }, { id:"RF", x:80, y:33 },
      { id:"SS", x:40, y:46 }, { id:"2B", x:60, y:46 }, { id:"3B", x:22, y:62 },
      { id:"1B", x:77, y:62 }, { id:"P",  x:50, y:61 }, { id:"C",  x:50, y:88 },
    ];

    // 選手円のSVG要素を生成
    const lineupIds = g?.lineup || [];
    const playerCircles = FP.map(fp => {
      const h = getHolder(fp.id);
      const cx = fp.x / 100 * W;
      const cy = fp.y / 100 * H;
      const r = h ? 26 : 18;
      const fill = h ? "url(#playerGrad)" : "rgba(255,255,255,0.08)";
      const stroke = h ? "#00e5ff" : "rgba(255,255,255,0.2)";
      const glow = h ? `<circle cx="${cx}" cy="${cy}" r="${r+6}" fill="none" stroke="#00e5ff" stroke-width="1" opacity="0.3"/>` : "";
      const batIdx = h ? lineupIds.indexOf(h.id) : -1;
      const batBadge = batIdx >= 0
        ? `<circle cx="${cx + r - 2}" cy="${cy - r + 2}" r="9" fill="#ffb400" stroke="#000" stroke-width="0.5" opacity="0.95"/>
           <text x="${cx + r - 2}" y="${cy - r + 6}" text-anchor="middle" font-size="9" font-weight="900" fill="#000" font-family="sans-serif">${batIdx + 1}</text>`
        : "";
      const label = h
        ? `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="9" font-weight="900" fill="white" font-family="sans-serif">${POS_SHORT[fp.id] || fp.id}</text>
           <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="8" fill="rgba(255,255,255,0.9)" font-family="sans-serif">${h.name.split(" ").pop()}</text>`
        : `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="9" font-weight="900" fill="rgba(255,255,255,0.4)" font-family="sans-serif">${POS_SHORT[fp.id] || fp.id}</text>`;
      return `${glow}<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>${label}${batBadge}`;
    }).join("");

    // タイトル行
    const dateStr = (g?.date || "").replace(/-/g, "/");
    const title = `${dateStr}${g?.opponent ? "  vs " + g.opponent : ""}`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H + 56}" viewBox="0 0 ${W} ${H + 56}">
      <defs>
        <radialGradient id="bgGrad" cx="50%" cy="90%" r="70%">
          <stop offset="0%" stop-color="#1e6b2f"/>
          <stop offset="45%" stop-color="#114a1c"/>
          <stop offset="70%" stop-color="#0a3212"/>
          <stop offset="100%" stop-color="#071a0c"/>
        </radialGradient>
        <linearGradient id="playerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#00b4ff"/>
          <stop offset="100%" stop-color="#0055cc"/>
        </linearGradient>
        <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0c1e44"/>
          <stop offset="100%" stop-color="#112b5e"/>
        </linearGradient>
      </defs>

      <!-- ヘッダー -->
      <rect width="${W}" height="56" fill="url(#headerGrad)"/>
      <text x="20" y="24" font-size="20" font-weight="900" fill="white" font-family="sans-serif">⚾ 守備配置</text>
      <text x="20" y="44" font-size="13" fill="#7eb8ff" font-family="sans-serif">${title}</text>

      <!-- フィールド背景 -->
      <rect x="0" y="56" width="${W}" height="${H}" fill="url(#bgGrad)"/>

      <!-- ファールライン -->
      <line x1="${W*0.5}" y1="${56 + H*0.83}" x2="${W*1.04}" y2="${56 + H*0.33}" stroke="rgba(255,255,255,0.45)" stroke-width="1"/>
      <line x1="${W*0.5}" y1="${56 + H*0.83}" x2="${W*(-0.04)}" y2="${56 + H*0.33}" stroke="rgba(255,255,255,0.45)" stroke-width="1"/>

      <!-- 外野フェンス弧 -->
      <path d="M ${W*(-0.04)} ${56 + H*0.33} Q ${W*0.5} ${56 + H*0.02} ${W*1.04} ${56 + H*0.33}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>

      <!-- 内野土 -->
      <polygon points="${W*0.26},${56+H*0.61} ${W*0.5},${56+H*0.39} ${W*0.74},${56+H*0.61} ${W*0.5},${56+H*0.83}"
        fill="rgba(160,100,50,0.22)" stroke="rgba(200,140,80,0.3)" stroke-width="1"/>

      <!-- マウンド -->
      <circle cx="${W*0.5}" cy="${56+H*0.62}" r="20" fill="rgba(160,100,50,0.12)" stroke="rgba(200,140,80,0.15)" stroke-width="1"/>

      <!-- 投手板 -->
      <rect x="${W*0.5-9}" y="${56+H*0.62-3}" width="18" height="6" fill="rgba(255,255,255,0.85)" rx="2"/>

      <!-- ホームプレート -->
      <rect x="${W*0.5-7}" y="${56+H*0.83-7}" width="14" height="14" fill="white" opacity="0.95" transform="rotate(45 ${W*0.5} ${56+H*0.83})"/>

      <!-- 各ベース -->
      <rect x="${W*0.74-6}" y="${56+H*0.61-6}" width="12" height="12" fill="white" opacity="0.9" transform="rotate(45 ${W*0.74} ${56+H*0.61})"/>
      <rect x="${W*0.5-6}"  y="${56+H*0.39-6}" width="12" height="12" fill="white" opacity="0.9" transform="rotate(45 ${W*0.5}  ${56+H*0.39})"/>
      <rect x="${W*0.26-6}" y="${56+H*0.61-6}" width="12" height="12" fill="white" opacity="0.9" transform="rotate(45 ${W*0.26} ${56+H*0.61})"/>

      <!-- 選手 -->
      <g transform="translate(0, 56)">${playerCircles}</g>
    </svg>`;

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H + 56;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob(resolve, "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });

  // ── 打順＋守備配置 合成画像生成 ──────────────────────────────────────────────
  const buildCombinedImageBlob = () => new Promise(async (resolve) => {
    const g = currentGame;
    const lineupIds = g?.lineup || [];
    const pos = g?.positions || {};
    const dateStr = (g?.date || "").replace(/-/g, "/");
    const title = `${dateStr}${g?.opponent ? "  vs " + g.opponent : ""}`;

    // ① フィールド画像を先に生成してImageオブジェクト化
    const fieldBlob = await buildFieldImageBlob();
    if (!fieldBlob) { resolve(null); return; }
    const fieldUrl = URL.createObjectURL(fieldBlob);
    const fieldImg = await new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = fieldUrl;
    });
    URL.revokeObjectURL(fieldUrl);

    // ② Canvas全体サイズ: 打順パネル(左280px) + フィールド(右600px) + ヘッダー56px
    const FW = fieldImg.width;   // 600
    const FH = fieldImg.height;  // 616 (560+56)
    const PW = 300;              // 打順パネル幅
    const TW = FW + PW;
    const TH = FH;

    const canvas = document.createElement("canvas");
    canvas.width = TW; canvas.height = TH;
    const ctx = canvas.getContext("2d");

    // 背景
    const headerGrad = ctx.createLinearGradient(0, 0, TW, 0);
    headerGrad.addColorStop(0, "#0c1e44"); headerGrad.addColorStop(1, "#112b5e");
    ctx.fillStyle = headerGrad; ctx.fillRect(0, 0, TW, 56);

    // ヘッダーテキスト
    ctx.fillStyle = "white";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("⚾ スタメン表", 16, 24);
    ctx.fillStyle = "#7eb8ff";
    ctx.font = "13px sans-serif";
    ctx.fillText(title, 16, 44);

    // 控え・休み計算
    const absentIds = g?.absent || [];
    const bench = players.filter(p => !lineupIds.includes(p.id) && !absentIds.includes(p.id));

    // 行の高さを固定（打順・控えが収まるようにCanvas高さを動的に調整）
    const ROW_H = 52;                        // 打順1行の高さ
    const BENCH_ROW_H = 20;                  // 控え1行の高さ
    const HEADER_H = 56;
    const SECTION_PAD = 8;
    const LINEUP_LABEL_H = 24;
    const BENCH_LABEL_H = bench.length > 0 ? 24 : 0;
    const BENCH_BLOCK_H = bench.length > 0 ? BENCH_LABEL_H + bench.length * BENCH_ROW_H + SECTION_PAD : 0;
    const PANEL_CONTENT_H = LINEUP_LABEL_H + lineupIds.length * ROW_H + 16 + BENCH_BLOCK_H + 16;
    const PANEL_H = Math.max(FH - HEADER_H, PANEL_CONTENT_H);
    const TOTAL_H = HEADER_H + PANEL_H;

    // Canvas再設定（高さが変わる場合）
    if (TOTAL_H !== TH) {
      canvas.height = TOTAL_H;
    }

    // 打順パネル背景
    ctx.fillStyle = "#0a1628"; ctx.fillRect(0, HEADER_H, PW, TOTAL_H - HEADER_H);
    ctx.strokeStyle = "#1e3a6a"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(PW, HEADER_H); ctx.lineTo(PW, TOTAL_H); ctx.stroke();

    // 打順ラベル
    let curY = HEADER_H + SECTION_PAD + 16;
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = "#7eb8ff";
    ctx.fillText("【打順】", 14, curY);
    curY += 8;

    lineupIds.forEach((pid, i) => {
      const p = players.find(pl => pl.id === pid); if (!p) return;
      const posCode = pos[pid] || "";
      const rowY = curY + i * ROW_H + ROW_H * 0.6;

      // 打順番号バッジ
      ctx.fillStyle = "#ffb400";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText(`${i + 1}`, 10, rowY);

      // ポジション
      ctx.fillStyle = posCode ? "#00e5ff" : "#3a5a8a";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(posCode || "—", 34, rowY);

      // 選手名
      ctx.fillStyle = "#e8f0fe";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(p.name, 68, rowY - 5);

      // 学年・投打サブ情報
      const sub = [p.grade, p.throwHand && p.batHand ? p.throwHand.replace("投","") + p.batHand.replace("打","") : ""].filter(Boolean).join(" ");
      if (sub) {
        ctx.fillStyle = "#7eb8ff";
        ctx.font = "10px sans-serif";
        ctx.fillText(sub, 68, rowY + 8);
      }

      // 区切り線
      ctx.strokeStyle = "#1e3a6a"; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(8, curY + (i + 1) * ROW_H - 4); ctx.lineTo(PW - 8, curY + (i + 1) * ROW_H - 4); ctx.stroke();
    });

    // 控え
    if (bench.length > 0) {
      const benchStart = curY + lineupIds.length * ROW_H + 16;
      ctx.fillStyle = "#7eb8ff"; ctx.font = "bold 12px sans-serif";
      ctx.fillText("【控え】", 14, benchStart);
      bench.forEach((p, i) => {
        ctx.fillStyle = "#c0d8ff"; ctx.font = "11px sans-serif";
        ctx.fillText(`#${p.number} ${p.name}${p.grade ? " (" + p.grade + ")" : ""}`, 14, benchStart + 20 + i * BENCH_ROW_H);
        // 区切り線
        ctx.strokeStyle = "#1a2e50"; ctx.lineWidth = 0.4;
        ctx.beginPath(); ctx.moveTo(8, benchStart + 28 + i * BENCH_ROW_H); ctx.lineTo(PW - 8, benchStart + 28 + i * BENCH_ROW_H); ctx.stroke();
      });
    }

    // ③ フィールド画像を右側に垂直中央で描画
    const fieldDrawH = Math.min(FH, TOTAL_H);
    const fieldOffsetY = Math.max(0, (TOTAL_H - fieldDrawH) / 2);
    ctx.drawImage(fieldImg, PW, fieldOffsetY, FW, fieldDrawH);

    // ヘッダー上書き（幅全体で統一）
    const hg2 = ctx.createLinearGradient(0, 0, TW, 0);
    hg2.addColorStop(0, "#0c1e44"); hg2.addColorStop(1, "#112b5e");
    ctx.fillStyle = hg2; ctx.fillRect(0, 0, TW, HEADER_H);
    ctx.fillStyle = "white"; ctx.font = "bold 18px sans-serif";
    ctx.fillText("⚾ スタメン表", 16, 24);
    ctx.fillStyle = "#7eb8ff"; ctx.font = "13px sans-serif";
    ctx.fillText(title, 16, 44);

    canvas.toBlob(resolve, "image/png");
  });

  const handlePreviewCombinedImage = async () => {
    setImgGenerating(true);
    try {
      const blob = await buildCombinedImageBlob();
      if (!blob) return;
      setFieldImgUrl(URL.createObjectURL(blob));
      setCombinedMode(true);
    } catch (e) { console.error(e); }
    setImgGenerating(false);
  };

  const handleShareCombinedImage = async () => {
    setImgGenerating(true);
    try {
      const blob = await buildCombinedImageBlob();
      if (!blob) return;
      const file = new File([blob], "lineup-combined.png", { type: "image/png" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: "スタメン表", files: [file] });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "lineup-combined.png"; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {}
    setImgGenerating(false);
  };

  const handleShareFieldImage = async () => {
    setImgGenerating(true);
    try {
      const blob = await buildFieldImageBlob();
      if (!blob) return;
      const file = new File([blob], "lineup.png", { type: "image/png" });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ title: "守備配置", files: [file] });
      } else {
        // フォールバック: ダウンロード
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "lineup-field.png"; a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {}
    setImgGenerating(false);
  };

  const handlePreviewFieldImage = async () => {
    setImgGenerating(true);
    try {
      const blob = await buildFieldImageBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      setFieldImgUrl(url);
    } catch (e) {}
    setImgGenerating(false);
  };

  // ── エクスポート（CSV） ─────────────────────────────────────────────────────
  const exportPlayers = () => {
    const header = "背番号,名前,学年,投げる手,打つ手";
    const rows = players.map(p =>
      [p.number, p.name, p.grade || "", p.throwHand || "", p.batHand || ""]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const bom  = "\uFEFF"; // Excel用BOM
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `選手一覧_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── インポート（CSV） ─────────────────────────────────────────────────────
  const importPlayers = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(""); setImportSuccess("");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const text = ev.target.result.replace(/^\uFEFF/, ""); // BOM除去
        const lines = text.trim().split(/\r?\n/);
        if (lines.length < 2) { setImportError("データが空です"); return; }
        // ヘッダー行をスキップ（1行目）
        const newPlayers = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].match(/("([^"]|"")*"|[^,]*)(,|$)/g)
            ?.map(c => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim())
            || [];
          if (cols.length < 2 || !cols[1]) continue;
          newPlayers.push({
            id:        Date.now() + i,
            number:    cols[0] || "?",
            name:      cols[1],
            grade:     cols[2] || "",
            throwHand: cols[3] || "",
            batHand:   cols[4] || "",
          });
        }
        if (newPlayers.length === 0) { setImportError("有効な選手データが見つかりませんでした"); return; }
        // 既存選手とマージ（名前が同じなら上書き、新規は追加）
        const merged = [...players];
        newPlayers.forEach(np => {
          const existing = merged.findIndex(p => p.name === np.name);
          if (existing >= 0) merged[existing] = { ...merged[existing], ...np, id: merged[existing].id };
          else merged.push(np);
        });
        await savePlayers(merged);
        setImportSuccess(`${newPlayers.length}名をインポートしました`);
        setTimeout(() => setImportSuccess(""), 3000);
      } catch (err) {
        setImportError("CSVの読み込みに失敗しました: " + err.message);
      }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = ""; // 同じファイル再選択可能に
  };

  const copyGame = (g) => {
    setCurrentGame({
      ...g,
      id:       Date.now(),
      date:     new Date().toISOString().slice(0, 10), // 日付は今日にリセット
      opponent: "",                                     // 対戦相手はリセット
      note:     g.note ? `${g.note}（コピー）` : "",
      absent:   [],                                     // 休みはリセット
    });
    setActiveTab("lineup");
  };

  // 指定グループインデックスまでの交代を累積適用した {pos, lin} を返す
  const applySubsUpTo = (upToGroupIdx) => {
    const groups = currentGame?.subGroups || [];
    const np = { ...(currentGame?.positions || {}) };
    const nl = [...(currentGame?.lineup || [])];
    groups.slice(0, upToGroupIdx + 1).forEach(group => {
      (group.changes || []).forEach(ch => {
        if ((ch.subType || "sub") === "posChange") {
          if (ch.posPlayerA && ch.posPlayerB) {
            const posA = np[ch.posPlayerA], posB = np[ch.posPlayerB];
            if (posA) np[ch.posPlayerB] = posA; else delete np[ch.posPlayerB];
            if (posB) np[ch.posPlayerA] = posB; else delete np[ch.posPlayerA];
          } else if (ch.posPlayerA && ch.position) {
            Object.keys(np).forEach(k => { if (np[k] === ch.position) delete np[k]; });
            np[ch.posPlayerA] = ch.position;
          }
        } else {
          if (ch.outPlayerId && ch.inPlayerId) {
            const outPos = np[ch.outPlayerId];
            const targetPos = ch.position || outPos;
            if (targetPos) {
              Object.keys(np).forEach(k => { if (np[k] === targetPos && Number(k) !== ch.outPlayerId) delete np[k]; });
              np[ch.inPlayerId] = targetPos;
            }
            delete np[ch.outPlayerId];
            const oi = nl.indexOf(ch.outPlayerId);
            if (oi >= 0) nl[oi] = ch.inPlayerId;
          } else if (ch.inPlayerId && ch.position) {
            Object.keys(np).forEach(k => { if (np[k] === ch.position) delete np[k]; });
            np[ch.inPlayerId] = ch.position;
          }
        }
      });
    });
    return { pos: np, lin: nl };
  };

  const createGame = () => {
    setCurrentGame({ id: Date.now(), date: new Date().toISOString().slice(0,10), opponent: "", note: "", settings: { dh: false, zenin: false }, lineup: [], positions: {}, absent: [] });
    setActiveTab("lineup");
  };
  const saveCurrentGame = async () => {
    if (!currentGame) return;
    const ng = (() => { const i = games.findIndex(g => g.id === currentGame.id); if (i >= 0) { const n = [...games]; n[i] = currentGame; return n; } return [currentGame, ...games]; })();
    setGames(ng); await persistData(players, ng);
  };
  const loadGame   = (g) => { setCurrentGame({ absent: [], ...g }); setActiveTab("lineup"); };
  const deleteGame = async (id) => { const ng = games.filter(g => g.id !== id); setGames(ng); if (currentGame?.id === id) setCurrentGame(null); setDeleteConfirm(null); await persistData(players, ng); };
  const updateGame     = (p) => setCurrentGame(prev => ({ ...prev, ...p }));
  const updateSettings = (p) => setCurrentGame(prev => ({ ...prev, settings: { ...prev.settings, ...p }, lineup: [], positions: {}, absent: prev.absent || [] }));

  const toggleAbsent = (pid) => {
    if (!currentGame) return;
    if (absent.includes(pid)) { updateGame({ absent: absent.filter(id => id !== pid) }); }
    else { const np = { ...positions }; delete np[pid]; const nl = lineup.map(id => id === pid ? null : id); while (nl.length > 0 && nl[nl.length-1] === null) nl.pop(); updateGame({ absent: [...absent, pid], lineup: nl, positions: np }); }
  };
  const removeFromLineup = (pid) => { const np = { ...positions }; delete np[pid]; const nl = lineup.map(id => id === pid ? null : id); while (nl.length > 0 && nl[nl.length-1] === null) nl.pop(); updateGame({ lineup: nl, positions: np }); };
  const setPosition      = (pid, pos) => { const np = { ...positions }; Object.keys(np).forEach(k => { if (np[k] === pos) delete np[k]; }); if (pos) np[pid] = pos; else delete np[pid]; updateGame({ positions: np }); };
  // 2選手の守備ポジションを入れ替える
  const swapPosition = (pid, newPos) => {
    const np = { ...positions };
    const prevPos = np[pid];                                      // 自分の現在ポジション
    const otherPid = Object.keys(np).find(k => np[k] === newPos); // 新ポジションの現在の持ち主
    if (otherPid) {
      // 相手が自分の元ポジションに入る（入れ替え）
      if (prevPos) np[otherPid] = prevPos;
      else delete np[otherPid];
    }
    if (newPos) np[pid] = newPos;
    else delete np[pid];
    updateGame({ positions: np });
  };

  // ── ドラッグ＆ドロップ（PC）+ タップ選択（スマホ）両対応 ──────────────────────
  const onDragStartBench = (pid) => setDragInfo({ type: "bench", pid });
  const onDragStartSlot  = (idx) => setDragInfo({ type: "slot", idx });
  const onDropSlot = (toIdx) => {
    if (!dragInfo || !currentGame) return;
    const cur = [...lineup];
    if (dragInfo.type === "bench") {
      const pid = dragInfo.pid;
      // 既に他のスロットにいれば元のスロットをnullに
      const ei = cur.indexOf(pid);
      if (ei >= 0) {
        const displaced = cur[toIdx];               // 移動先の選手
        cur[toIdx] = pid;
        cur[ei] = displaced !== undefined ? displaced : null; // 入れ替え or 空に
      } else {
        // 必要なら配列をnullで拡張
        while (cur.length <= toIdx) cur.push(null);
        const displaced = cur[toIdx];
        cur[toIdx] = pid;
        // 移動先に誰かいた場合は控えに戻す（nullにする）
        if (displaced) {/* 控えへ: lineupから外れるだけでよい */}
      }
    } else {
      const fi = dragInfo.idx;
      if (fi !== toIdx) {
        while (cur.length <= Math.max(fi, toIdx)) cur.push(null);
        const tmp = cur[toIdx]; cur[toIdx] = cur[fi]; cur[fi] = tmp;
      }
    }
    // nullを除いてlengthを縮める（末尾のnullを削除）
    while (cur.length > 0 && cur[cur.length - 1] === null) cur.pop();
    updateGame({ lineup: cur });
    setDragInfo(null); setHoveredSlot(null);
  };
  const onDropBench = () => { if (dragInfo?.type === "slot") removeFromLineup(lineup[dragInfo.idx]); setDragInfo(null); };

  // タップ操作: 控え選手をタップで選択 → スロットをタップで配置
  const onTapBench = (pid) => {
    if (dragInfo?.type === "bench" && dragInfo.pid === pid) {
      setDragInfo(null); // 同じ選手をタップ→選択解除
    } else {
      setDragInfo({ type: "bench", pid });
    }
  };
  const onTapSlot = (toIdx) => {
    if (!dragInfo) {
      // スロットに選手がいれば選択
      const pid = lineup[toIdx];
      if (pid) setDragInfo({ type: "slot", idx: toIdx });
      return;
    }
    if (dragInfo.type === "bench") {
      const cur = [...lineup];
      const pid = dragInfo.pid;
      const ei = cur.indexOf(pid);
      while (cur.length <= toIdx) cur.push(null);
      if (ei >= 0) {
        const displaced = cur[toIdx];
        cur[toIdx] = pid;
        cur[ei] = displaced || null;
      } else {
        cur[toIdx] = pid;
      }
      while (cur.length > 0 && cur[cur.length - 1] === null) cur.pop();
      updateGame({ lineup: cur });
    } else if (dragInfo.type === "slot") {
      const fi = dragInfo.idx;
      if (fi !== toIdx) {
        const cur = [...lineup];
        while (cur.length <= Math.max(fi, toIdx)) cur.push(null);
        const tmp = cur[toIdx]; cur[toIdx] = cur[fi]; cur[fi] = tmp;
        while (cur.length > 0 && cur[cur.length - 1] === null) cur.pop();
        updateGame({ lineup: cur });
      }
    }
    setDragInfo(null); setHoveredSlot(null);
  };
  const savePlayers = async (newPlayers) => {
    setPlayers(newPlayers);
    await persistData(newPlayers, games);
  };

  const addPlayer = async () => {
    if (!newName.trim()) return;
    const np = [...players, { id: Date.now(), name: newName.trim(), number: newNumber.trim() || "?", grade: "", throwHand: "", batHand: "" }];
    setPlayers(np); setNewName(""); setNewNumber(""); await persistData(np, games);
  };
  const savePlayerEdit = async (form) => { const np = players.map(p => p.id === editingPlayer.id ? { ...p, ...form } : p); setPlayers(np); setEditingPlayer(null); await persistData(np, games); };
  const removePlayer   = async (id) => { const np = players.filter(p => p.id !== id); setPlayers(np); if (currentGame) { const npos = { ...positions }; delete npos[id]; updateGame({ lineup: lineup.filter(x => x !== id && x !== null), positions: npos, absent: absent.filter(x => x !== id) }); } await persistData(np, games); };

  const slotArray      = Array.from({ length: totalSlots }, (_, i) => ({ idx: i, player: (lineup[i] && lineup[i] !== null) ? players.find(p => p.id === lineup[i]) : null }));
  const filteredPlayers = rosterFilter ? players.filter(p => p.grade === rosterFilter) : players;

  const C = { bg: "#0a1628", card: "rgba(255,255,255,0.03)", border: "#1e3a6a" };
  const S = {
    card:  { background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 },
    inp:   { padding: "12px 14px", background: "#0a1e40", border: `1px solid ${C.border}`, borderRadius: 10, color: "#e8f0fe", fontSize: 16, fontFamily: "inherit", outline: "none", WebkitAppearance: "none", width: "100%" },
    btn:   { padding: "12px 18px", background: "linear-gradient(135deg,#1e6adc,#0d4aaa)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" },
    btnSm: { padding: "8px 14px", background: "linear-gradient(135deg,#1e6adc,#0d4aaa)", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", WebkitTapHighlightColor: "transparent" },
    btnDanger: { padding: "8px 14px", background: "rgba(255,60,60,0.12)", border: "1px solid rgba(255,60,60,0.25)", color: "#ff8080", borderRadius: 8, cursor: "pointer", fontSize: 13, fontFamily: "inherit" },
  };
  const TABS = [["history","🗂","履歴"],["lineup","📋","打順"],["field","STADIUM","守備"],["sub","🔄","交代"],["roster","👥","選手"]];
  const saveLabel = { saving: "⏳ 保存中...", saved: "✓ 保存", error: "⚠️ 失敗" };
  const saveColor = { saving: "#7eb8ff", saved: "#00dc78", error: "#ff8080" };

  if (!dataLoaded) return (
    <div style={{ background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#7eb8ff", fontFamily: "sans-serif", fontSize: 16, gap: 10 }}><BaseballIcon size={24} />読み込み中...</div>
  );

  return (
    <div style={{ fontFamily: "'Noto Sans JP', sans-serif", minHeight: "100vh", background: C.bg, color: "#e8f0fe", paddingBottom: 72 }}>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: #2a4a8a; border-radius: 2px; }
        .drag-card { cursor: grab; transition: transform 0.12s, box-shadow 0.12s; }
        .drag-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,180,255,0.2); }
        .drag-card:active { cursor: grabbing; opacity: 0.75; }
        .drop-slot { transition: border-color 0.15s, background 0.15s; }
        .slot-hov { border-color: #00b4ff !important; background: rgba(0,180,255,0.09) !important; }
        .slot-tap-target:not(.slot-hov) { border-color: rgba(0,180,255,0.35) !important; }
        .game-row { transition: background 0.12s; }
        .game-row:active { background: rgba(255,255,255,0.06) !important; }
        input:focus, select:focus { border-color: #4a8adc !important; outline: none; }
        .fade-in { animation: fadeIn 0.22s ease; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
        .grade-badge { display:inline-flex;align-items:center;justify-content:center;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;background:rgba(124,180,255,0.15);color:#7eb8ff;border:1px solid rgba(124,180,255,0.3); }
        .hand-badge  { display:inline-flex;align-items:center;padding:1px 6px;border-radius:4px;font-size:10px;font-weight:700;background:rgba(0,229,255,0.1);color:#00e5ff;border:1px solid rgba(0,229,255,0.25); }
        .bottom-nav-btn { display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;flex:1;padding:8px 4px;border:none;background:transparent;cursor:pointer;font-family:inherit;transition:opacity 0.15s;WebkitTapHighlightColor:transparent; }
        .bottom-nav-btn:active { opacity:0.7; }
        /* PC: side-by-side layout */
        @media (min-width: 640px) {
          .lineup-grid { display: grid !important; grid-template-columns: 1fr 265px; gap: 16px; }
          .field-grid  { display: grid !important; grid-template-columns: 1fr 230px; gap: 16px; }
          .bench-panel { display: flex !important; flex-direction: column; gap: 12px; }
          .mobile-only { display: none !important; }
          .pc-only     { display: flex !important; }
          .btn-label-pc { display: inline !important; }
        }
        @media (max-width: 639px) {
          .lineup-grid { display: block !important; }
          .field-grid  { display: block !important; }
          .bench-panel { display: none !important; }
          .pc-only     { display: none !important; }
          .mobile-only { display: block !important; }
          .btn-label-pc { display: none !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ background: "linear-gradient(135deg,#0c1e44,#112b5e)", borderBottom: "2px solid #1e4a9a", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, lineHeight: 1 }}><BaseballIcon size={24} /><span style={{ fontSize: 24, fontFamily: "'Bebas Neue'", letterSpacing: 3, background: "linear-gradient(90deg,#fff,#7eb8ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>LINEUP CARD</span></div>
          <div style={{ fontSize: 10, color: "#4a6a9a", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.displayName || user.email}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0, marginLeft: 8 }}>
          {saveStatus !== "idle" && <span style={{ fontSize: 11, color: saveColor[saveStatus], whiteSpace: "nowrap" }}>{saveLabel[saveStatus]}</span>}
          {currentGame && (
            <>
              <button onClick={saveCurrentGame} style={{ ...S.btnSm, background: "linear-gradient(135deg,#00a050,#006030)", padding: "8px 12px", display: "flex", alignItems: "center", gap: 4 }}>
                <span>💾</span><span className="btn-label-pc">保存</span>
              </button>
              <button onClick={() => setShowShare(true)} style={{ ...S.btnSm, background: "linear-gradient(135deg,#7b2ff7,#4a0aaa)", padding: "8px 12px", display: "flex", alignItems: "center", gap: 4 }}>
                <span>📤</span><span className="btn-label-pc">共有</span>
              </button>
            </>
          )}
          {installPrompt && (
            <button onClick={handleInstall}
              title="アプリをインストール"
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "0 12px", height: 36, background: "rgba(0,180,255,0.12)", border: "1px solid rgba(0,180,255,0.35)", borderRadius: 8, color: "#00b4ff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, WebkitTapHighlightColor: "transparent" }}>
              ⬇️ <span className="btn-label-pc">インストール</span>
            </button>
          )}
          <button onClick={() => setShowLogout(true)} style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "1px solid #1e3a6a", color: "#7eb8ff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>≡</button>
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ padding: "14px 14px", maxWidth: 980, margin: "0 auto" }}>

        {/* ===== HISTORY ===== */}
        {activeTab === "history" && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7eb8ff", letterSpacing: 2 }}>試合履歴 ({games.length}件)</div>
              <button onClick={createGame} style={S.btnSm}>＋ 新規作成</button>
            </div>
            {games.length === 0 ? (
              <div style={{ ...S.card, padding: 48, textAlign: "center", color: "#3a5a8a" }}>
                <div style={{ marginBottom: 14, display: "flex", justifyContent: "center" }}><BaseballIcon size={56} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>試合履歴がありません</div>
                <div style={{ fontSize: 12, color: "#2a4a7a", marginBottom: 20 }}>「新規作成」からスタメンを作りましょう</div>
                <button onClick={createGame} style={S.btn}>＋ 新しい試合を作成</button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {games.map(g => {
                  const s = g.settings || {}, count = (g.lineup||[]).filter(Boolean).length, ac = (g.absent||[]).length, isCur = currentGame?.id === g.id;
                  return (
                    <div key={g.id} className="game-row" onClick={() => loadGame(g)}
                      style={{ ...S.card, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", borderColor: isCur ? "#2a5aaa" : "#1e3a6a", background: isCur ? "rgba(30,74,154,0.12)" : "rgba(255,255,255,0.02)" }}>
                      <div style={{ textAlign: "center", minWidth: 44 }}>
                        <div style={{ fontSize: 9, color: "#4a6a9a" }}>{g.date?.slice(0,4)}</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: "#c0d8ff" }}>{g.date?.slice(5).replace("-","/")}</div>
                      </div>
                      <div style={{ width: 1, height: 32, background: "#1e3a6a", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.opponent || <span style={{ color: "#3a5a8a" }}>対戦相手未設定</span>}</div>
                        {g.note && <div style={{ fontSize: 11, color: "#7eb8ff", marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📝 {g.note}</div>}
                        <div style={{ display: "flex", gap: 5, marginTop: 4, flexWrap: "wrap" }}>
                          {isCur && <span style={{ fontSize: 10, padding: "1px 6px", background: "rgba(0,180,255,0.15)", border: "1px solid rgba(0,180,255,0.4)", borderRadius: 4, color: "#00b4ff" }}>編集中</span>}
                          {s.dh   && <span style={{ fontSize: 10, padding: "1px 6px", background: "rgba(255,180,0,0.12)", border: "1px solid rgba(255,180,0,0.3)", borderRadius: 4, color: "#ffb400" }}>DH制</span>}
                          {s.zenin && <span style={{ fontSize: 10, padding: "1px 6px", background: "rgba(0,220,120,0.1)", border: "1px solid rgba(0,220,120,0.3)", borderRadius: 4, color: "#00dc78" }}>全員打ち</span>}
                          {ac > 0 && <span style={{ fontSize: 10, padding: "1px 6px", background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.3)", borderRadius: 4, color: "#ff8080" }}>休み{ac}名</span>}
                          <span style={{ fontSize: 10, color: "#5a7aaa" }}>{count}名</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => copyGame(g)}
                          style={{ padding: "6px 10px", background: "rgba(0,180,255,0.1)", border: "1px solid rgba(0,180,255,0.25)", color: "#7eb8ff", borderRadius: 6, cursor: "pointer", fontSize: 12, fontFamily: "inherit", whiteSpace: "nowrap" }}>
                          コピー
                        </button>
                        <button onClick={() => setDeleteConfirm(g.id)} style={{ ...S.btnDanger, padding: "6px 10px" }}>削除</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== LINEUP ===== */}
        {activeTab === "lineup" && (
          <div className="fade-in">
            {!currentGame ? (
              <div style={{ ...S.card, padding: 48, textAlign: "center", color: "#3a5a8a" }}>
                <div style={{ fontSize: 14, marginBottom: 16 }}>試合を選択するか、新規作成してください</div>
                <button onClick={createGame} style={S.btn}>＋ 新しい試合を作成</button>
              </div>
            ) : (
              <>
                {/* Game meta */}
                <div style={{ ...S.card, padding: "12px 14px", marginBottom: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input type="date" value={currentGame.date} onChange={e => updateGame({ date: e.target.value })} style={{ ...S.inp, flex: "0 0 auto", width: "auto", fontSize: 16 }} />
                    <input value={currentGame.opponent} onChange={e => updateGame({ opponent: e.target.value })} placeholder="対戦相手" style={{ ...S.inp, flex: 1, fontSize: 16 }} />
                  </div>
                  <input value={currentGame.note} onChange={e => updateGame({ note: e.target.value })} placeholder="メモ（公式戦・練習試合など）" style={{ ...S.inp, fontSize: 16 }} />
                </div>

                {/* Toggles */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <Toggle label="DH制" sublabel="指名打者あり" checked={settings.dh} onChange={() => updateSettings({ dh: !settings.dh, zenin: false })} color="#ffb400" />
                  <Toggle label="全員打ち" sublabel="全員が打順に入る" checked={settings.zenin} onChange={() => updateSettings({ zenin: !settings.zenin, dh: false })} color="#00dc78" />
                </div>

                {/* Main grid */}
                <div className="lineup-grid">
                  {/* Batting order */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#7eb8ff", letterSpacing: 2, marginBottom: 8 }}>打順 ({lineup.filter(Boolean).length}/{totalSlots})</div>
                    {dragInfo && (
                      <div style={{ fontSize: 12, color: "#00b4ff", background: "rgba(0,180,255,0.1)", border: "1px solid rgba(0,180,255,0.3)", borderRadius: 8, padding: "8px 12px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>
                          {dragInfo.type === "bench"
                            ? `✅ ${players.find(p => p.id === dragInfo.pid)?.name || ""}　を選択中 → 打順をタップして配置`
                            : `✅ ${lineup[dragInfo.idx] ? players.find(p => p.id === lineup[dragInfo.idx])?.name : ""}　を選択中 → 移動先をタップ`}
                        </span>
                        <button onClick={() => setDragInfo(null)}
                          style={{ background: "none", border: "none", color: "#7eb8ff", fontSize: 16, cursor: "pointer", padding: "0 0 0 8px", lineHeight: 1 }}>×</button>
                      </div>
                    )}
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {slotArray.map(({ idx, player }) => {
                        const isDH = settings.dh && idx === 9;
                        return (
                          <div key={idx}
                            className={`drop-slot${hoveredSlot === idx ? " slot-hov" : ""}${dragInfo ? " slot-tap-target" : ""}`}
                            onDragOver={e => { e.preventDefault(); setHoveredSlot(idx); }}
                            onDragLeave={() => setHoveredSlot(null)}
                            onDrop={() => onDropSlot(idx)}
                            onClick={() => {
                              // 選手がいないスロットへのタップ配置のみ（選手ありのスロットは≡ボタンで操作）
                              if (!player && dragInfo) onTapSlot(idx);
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: hoveredSlot === idx ? "rgba(0,180,255,0.09)" : dragInfo && !player ? "rgba(0,180,255,0.05)" : "rgba(255,255,255,0.02)", border: `1px solid ${dragInfo && !player ? "#00b4ff66" : isDH ? "rgba(255,180,0,0.3)" : "#192e5a"}`, borderRadius: 9, minHeight: 52, cursor: dragInfo && !player ? "pointer" : "default", transition: "all 0.15s" }}>
                            <div style={{ width: 30, height: 30, borderRadius: "50%", background: isDH ? "rgba(255,180,0,0.15)" : "linear-gradient(135deg,#18388a,#0c1e40)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontFamily: "'Bebas Neue'", color: isDH ? "#ffb400" : "#7eb8ff", flexShrink: 0, border: `1px solid ${isDH ? "rgba(255,180,0,0.4)" : "#243870"}` }}>{idx + 1}</div>
                            {isDH && !player && <span style={{ fontSize: 10, color: "#ffb400", fontWeight: 700 }}>DH</span>}
                            {player ? (
                              <div
                                draggable onDragStart={() => onDragStartSlot(idx)}
                                style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", background: dragInfo?.type === "slot" && dragInfo?.idx === idx ? "rgba(0,180,255,0.15)" : "rgba(25,55,130,0.3)", borderRadius: 8, padding: "4px 6px 4px 10px", border: `1px solid ${dragInfo?.type === "slot" && dragInfo?.idx === idx ? "#00b4ff" : "#243870"}` }}>
                                {/* 並べ替えハンドル（タップで選択モード） */}
                                <button
                                  onClick={e => { e.stopPropagation(); if (!dragInfo) onDragStartSlot(idx); else onTapSlot(idx); }}
                                  style={{ background: "none", border: "none", color: dragInfo?.type === "slot" && dragInfo?.idx === idx ? "#00b4ff" : "#3a5a8a", fontSize: 16, cursor: "pointer", padding: "6px 8px 6px 0", lineHeight: 1, flexShrink: 0, WebkitTapHighlightColor: "transparent" }}
                                  title="タップして並べ替え">
                                  ≡
                                </button>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1 }}>
                                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#0c1e3a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#7eb8ff", flexShrink: 0 }}>#{player.number}</div>
                                  <span style={{ fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{player.name}</span>
                                  {player.grade && <span className="grade-badge" style={{ flexShrink: 0 }}>{player.grade}</span>}
                                </div>
                                <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                                  <select value={positions[player.id] || ""} onChange={e => { e.stopPropagation(); setPosition(player.id, e.target.value); }}
                                    style={{ background: "#091a38", color: positions[player.id] ? "#00e5ff" : "#3a5a8a", border: "1px solid #243870", borderRadius: 6, padding: "4px 5px", fontSize: 13, fontFamily: "inherit", cursor: "pointer", WebkitAppearance: "none" }}>
                                    <option value="">守備—</option>
                                    {availablePositions.map(p => <option key={p} value={p}>{POS_SHORT[p] || p}</option>)}
                                  </select>
                                  <button onClick={e => { e.stopPropagation(); removeFromLineup(player.id); }} style={{ background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.2)", color: "#ff8080", borderRadius: 6, width: 24, height: 24, cursor: "pointer", fontSize: 13, lineHeight: "22px", flexShrink: 0 }}>×</button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ flex: 1, textAlign: "center", fontSize: 11, color: dragInfo ? "#00b4ff" : "#24406a" }}>
                                {dragInfo ? "タップして配置" : "選手をタップして選択"}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right panel (PC only) */}
                  <div className="bench-panel pc-only">
                    {/* 控え */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#7eb8ff", letterSpacing: 2, marginBottom: 8 }}>控え ({benchPlayers.length})</div>
                      <div onDragOver={e => e.preventDefault()} onDrop={onDropBench}
                        style={{ minHeight: 80, background: "rgba(255,255,255,0.01)", border: "1px dashed #1a3460", borderRadius: 9, padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                        {benchPlayers.length === 0 ? <div style={{ color: "#1e3a6a", fontSize: 11, textAlign: "center", marginTop: 12 }}>全員スタメン！</div>
                          : benchPlayers.map(p => (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div className="drag-card"
                                draggable onDragStart={() => onDragStartBench(p.id)}
                                onClick={() => onTapBench(p.id)}
                                style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: dragInfo?.type === "bench" && dragInfo?.pid === p.id ? "rgba(0,180,255,0.2)" : "rgba(255,255,255,0.025)", border: `1px solid ${dragInfo?.type === "bench" && dragInfo?.pid === p.id ? "#00b4ff" : "#192e5a"}`, borderRadius: 7, cursor: "pointer" }}>
                                <div style={{ width: 20, height: 20, borderRadius: "50%", background: "#0c1e3a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#7eb8ff" }}>#{p.number}</div>
                                <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{p.name}</span>
                                {p.grade && <span className="grade-badge">{p.grade}</span>}
                              </div>
                              <button onClick={() => toggleAbsent(p.id)} style={{ background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.25)", color: "#ff8080", borderRadius: 6, padding: "5px 8px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", flexShrink: 0 }}>休み</button>
                            </div>
                          ))}
                      </div>
                    </div>
                    {/* 休み */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#ff8080", letterSpacing: 2, marginBottom: 8 }}>😴 休み ({absentPlayers.length})</div>
                      <div style={{ minHeight: 48, background: "rgba(255,80,80,0.03)", border: "1px dashed rgba(255,100,100,0.25)", borderRadius: 9, padding: 8, display: "flex", flexDirection: "column", gap: 5 }}>
                        {absentPlayers.length === 0 ? <div style={{ color: "#3a2a2a", fontSize: 11, textAlign: "center", marginTop: 8 }}>休みの選手なし</div>
                          : absentPlayers.map(p => (
                            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 9px", background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,100,100,0.2)", borderRadius: 7 }}>
                              <div style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(255,80,80,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#ff8080" }}>#{p.number}</div>
                              <span style={{ fontSize: 12, fontWeight: 600, flex: 1, color: "#cc8888" }}>{p.name}</span>
                              <button onClick={() => toggleAbsent(p.id)} style={{ background: "rgba(0,180,255,0.1)", border: "1px solid rgba(0,180,255,0.25)", color: "#7eb8ff", borderRadius: 6, padding: "5px 8px", cursor: "pointer", fontSize: 11, fontFamily: "inherit", flexShrink: 0 }}>復帰</button>
                            </div>
                          ))}
                      </div>
                    </div>
                    {/* 守備 */}
                    <div style={{ ...S.card, padding: 12 }}>
                      <div style={{ fontSize: 10, color: "#7eb8ff", fontWeight: 700, marginBottom: 8, letterSpacing: 1 }}>守備配置</div>
                      {availablePositions.map(pos => { const h = getPositionHolder(pos); return (
                        <div key={pos} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0", borderBottom: "1px solid #0c1e38" }}>
                          <span style={{ fontWeight: 700, width: 28, color: h ? "#00e5ff" : "#243870" }}>{pos}</span>
                          <span style={{ color: h ? "#c0d8ff" : "#243870" }}>{h ? h.name : "—"}</span>
                        </div>
                      ); })}
                    </div>
                  </div>
                </div>

                {/* Mobile-only accordion panels */}
                <div className="mobile-only" style={{ marginTop: 12 }}>
                  <Accordion title="控え" count={benchPlayers.length} color="#7eb8ff">
                    <div onDragOver={e => e.preventDefault()} onDrop={onDropBench} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {benchPlayers.length === 0 ? <div style={{ color: "#1e3a6a", fontSize: 12, textAlign: "center", padding: "8px 0" }}>全員スタメン！</div>
                        : benchPlayers.map(p => (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div className="drag-card"
                              draggable onDragStart={() => onDragStartBench(p.id)}
                              onClick={() => onTapBench(p.id)}
                              style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: dragInfo?.type === "bench" && dragInfo?.pid === p.id ? "rgba(0,180,255,0.18)" : "rgba(255,255,255,0.03)", border: `1px solid ${dragInfo?.type === "bench" && dragInfo?.pid === p.id ? "#00b4ff" : "#192e5a"}`, borderRadius: 9, minHeight: 44, cursor: "pointer", transition: "all 0.15s" }}>
                              <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#0c1e3a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#7eb8ff" }}>#{p.number}</div>
                              <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{p.name}</span>
                              {p.grade && <span className="grade-badge">{p.grade}</span>}
                              {dragInfo?.type === "bench" && dragInfo?.pid === p.id && <span style={{ fontSize: 11, color: "#00b4ff", fontWeight: 700 }}>選択中</span>}
                            </div>
                            <button onClick={() => toggleAbsent(p.id)} style={{ background: "rgba(255,100,100,0.1)", border: "1px solid rgba(255,100,100,0.3)", color: "#ff8080", borderRadius: 8, padding: "10px 12px", cursor: "pointer", fontSize: 13, fontFamily: "inherit", minHeight: 44 }}>休み</button>
                          </div>
                        ))}
                    </div>
                  </Accordion>

                  <Accordion title="😴 休み" count={absentPlayers.length} color="#ff8080" defaultOpen={absentPlayers.length > 0}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {absentPlayers.length === 0 ? <div style={{ color: "#3a2a2a", fontSize: 12, textAlign: "center", padding: "8px 0" }}>休みの選手なし</div>
                        : absentPlayers.map(p => (
                          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "rgba(255,80,80,0.06)", border: "1px solid rgba(255,100,100,0.2)", borderRadius: 9, minHeight: 44 }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(255,80,80,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#ff8080" }}>#{p.number}</div>
                            <span style={{ fontSize: 14, fontWeight: 600, flex: 1, color: "#cc8888" }}>{p.name}</span>
                            <button onClick={() => toggleAbsent(p.id)} style={{ background: "rgba(0,180,255,0.1)", border: "1px solid rgba(0,180,255,0.3)", color: "#7eb8ff", borderRadius: 8, padding: "10px 12px", cursor: "pointer", fontSize: 13, fontFamily: "inherit", minHeight: 44 }}>復帰</button>
                          </div>
                        ))}
                    </div>
                  </Accordion>

                  <Accordion title="守備配置" count={Object.keys(positions).length} color="#00e5ff" defaultOpen={false}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      {availablePositions.map(pos => { const h = getPositionHolder(pos); return (
                        <div key={pos} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: h ? "rgba(0,180,255,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${h ? "rgba(0,180,255,0.2)" : "#1a2e50"}`, borderRadius: 8 }}>
                          <span style={{ fontWeight: 900, fontSize: 12, color: h ? "#00e5ff" : "#2a4a7a", width: 28, flexShrink: 0 }}>{POS_SHORT[pos] || pos}</span>
                          <span style={{ fontSize: 12, color: h ? "#c0d8ff" : "#2a4a7a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h ? h.name.split(" ").pop() : "—"}</span>
                        </div>
                      ); })}
                    </div>
                  </Accordion>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== FIELD ===== */}
        {activeTab === "field" && (
          <div className="fade-in">
            <div className="field-grid">
              <FieldView players={players} positions={positions} lineup={lineup} onPlayerTap={currentGame ? (player, pos) => setFieldEditTarget({ player, pos }) : null} />
              <div className="pc-only" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ ...S.card, padding: "14px 16px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7eb8ff", letterSpacing: 2, marginBottom: 12 }}>守備割り当て</div>
                  {FIELD_POSITIONS.map(fp => {
                    const h = getPositionHolder(fp.id);
                    return (
                      <div key={fp.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #0c1e38" }}>
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: h ? "linear-gradient(135deg,#00b4ff,#0055cc)" : "#0c1e3a", border: `1px solid ${h ? "#00e5ff55" : "#243870"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: h ? "#fff" : "#2a4a7a", flexShrink: 0, boxShadow: h ? "0 0 8px rgba(0,180,255,0.3)" : "none" }}>{POS_SHORT[fp.id] || fp.id}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: "#4a6a9a" }}>{POSITION_LABELS[fp.id]}</div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: h ? "#e8f0fe" : "#243870", marginTop: 1 }}>{h ? h.name : <span style={{ color: "#243870" }}>未配置</span>}</div>
                        </div>
                        {h && <div style={{ fontSize: 10, color: "#5a7aaa" }}>#{h.number}</div>}
                      </div>
                    );
                  })}
                </div>
                {/* DH if applicable */}
                {settings.dh && (() => { const h = getPositionHolder("DH"); return (
                  <div style={{ ...S.card, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, borderColor: "rgba(255,180,0,0.3)" }}>
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: h ? "rgba(255,180,0,0.2)" : "#0c1e3a", border: `1px solid ${h ? "rgba(255,180,0,0.5)" : "#243870"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: h ? "#ffb400" : "#2a4a7a", flexShrink: 0 }}>DH</div>
                    <div>
                      <div style={{ fontSize: 10, color: "#aa8800" }}>指名打者</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: h ? "#ffb400" : "#243870" }}>{h ? h.name : "未配置"}</div>
                    </div>
                  </div>
                ); })()}
              </div>
            </div>
            {/* Mobile: grid list below field */}
            <div className="mobile-only" style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7eb8ff", letterSpacing: 2, marginBottom: 10 }}>守備割り当て</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 14 }}>
                {FIELD_POSITIONS.map(fp => { const h = getPositionHolder(fp.id); return (
                  <div key={fp.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 12px", background: h ? "rgba(0,180,255,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${h ? "rgba(0,180,255,0.2)" : "#1a2e50"}`, borderRadius: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", background: h ? "linear-gradient(135deg,#00b4ff,#0055cc)" : "#0c1e3a", border: "1px solid #243870", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 900, color: h ? "#fff" : "#2a4a7a", flexShrink: 0 }}>{POS_SHORT[fp.id] || fp.id}</div>
                    <div><div style={{ fontSize: 9, color: "#3a5a8a" }}>{POSITION_LABELS[fp.id]}</div><div style={{ fontSize: 12, fontWeight: 700, color: h ? "#e8f0fe" : "#243870" }}>{h ? h.name.split(" ").pop() : "未配置"}</div></div>
                  </div>
                ); })}
              </div>
            </div>

            {/* 控え・休み（PC/スマホ共通） */}
            {currentGame && (benchPlayers.length > 0 || absentPlayers.length > 0) && (
              <div style={{ display: "grid", gridTemplateColumns: benchPlayers.length > 0 && absentPlayers.length > 0 ? "1fr 1fr" : "1fr", gap: 10, marginTop: 4 }}>
                {benchPlayers.length > 0 && (
                  <div style={{ ...S.card, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#7eb8ff", letterSpacing: 2, marginBottom: 8 }}>控え ({benchPlayers.length})</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {benchPlayers.map(p => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", background: "rgba(255,255,255,0.03)", border: "1px solid #192e5a", borderRadius: 7 }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#0c1e3a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#7eb8ff", flexShrink: 0 }}>#{p.number}</div>
                          <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                          {p.grade && <span className="grade-badge" style={{ fontSize: 9 }}>{p.grade}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {absentPlayers.length > 0 && (
                  <div style={{ ...S.card, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#ff8080", letterSpacing: 2, marginBottom: 8 }}>😴 休み ({absentPlayers.length})</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                      {absentPlayers.map(p => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px", background: "rgba(255,80,80,0.05)", border: "1px solid rgba(255,100,100,0.2)", borderRadius: 7 }}>
                          <div style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(255,80,80,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#ff8080", flexShrink: 0 }}>#{p.number}</div>
                          <span style={{ fontSize: 12, fontWeight: 600, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#cc8888" }}>{p.name}</span>
                          {p.grade && <span className="grade-badge" style={{ fontSize: 9 }}>{p.grade}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== SUB ===== */}
        {activeTab === "sub" && (() => {
          // subs → subGroups に移行（後方互換）
          const groups = currentGame?.subGroups || [];

          const applied = selectedSubGroup === null ? { pos: positions, lin: lineup } : applySubsUpTo(selectedSubGroup);

          const addGroup = () => {
            const newGroups = [...groups, { id: Date.now(), label: `${groups.length + 1}回目の交代`, changes: [] }];
            updateGame({ subGroups: newGroups });
            setSelectedSubGroup(newGroups.length - 1);
          };
          const deleteGroup = (gi) => {
            const newGroups = groups.filter((_, i) => i !== gi);
            updateGame({ subGroups: newGroups });
            if (selectedSubGroup >= newGroups.length) setSelectedSubGroup(newGroups.length > 0 ? newGroups.length - 1 : null);
          };
          const moveGroup = (gi, dir) => {
            const arr = [...groups];
            const to = gi + dir;
            if (to < 0 || to >= arr.length) return;
            [arr[gi], arr[to]] = [arr[to], arr[gi]];
            updateGame({ subGroups: arr });
            setSelectedSubGroup(to);
          };
          const updateGroupLabel = (gi, label) => {
            updateGame({ subGroups: groups.map((g, i) => i === gi ? { ...g, label } : g) });
          };
          const deleteChange = (gi, ci) => {
            updateGame({ subGroups: groups.map((g, i) => i !== gi ? g : { ...g, changes: (g.changes||[]).filter((_,j) => j !== ci) }) });
          };
          const moveChange = (gi, ci, dir) => {
            const arr = [...(groups[gi].changes || [])];
            const to = ci + dir;
            if (to < 0 || to >= arr.length) return;
            [arr[ci], arr[to]] = [arr[to], arr[ci]];
            updateGame({ subGroups: groups.map((g, i) => i !== gi ? g : { ...g, changes: arr }) });
          };

          return (
            <div className="fade-in">
              {!currentGame ? (
                <div style={{ ...S.card, padding:48, textAlign:"center", color:"#3a5a8a" }}>
                  <div style={{ fontSize:14, marginBottom:16 }}>試合を選択するか、新規作成してください</div>
                  <button onClick={createGame} style={S.btn}>＋ 新しい試合を作成</button>
                </div>
              ) : (<>
                {/* ── ステップ選択タブ ── */}
                <div style={{ display:"flex", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:4, alignItems:"center" }}>
                  <button onClick={() => setSelectedSubGroup(null)}
                    style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${selectedSubGroup===null?"#7eb8ff":"#1e3a6a"}`, background:selectedSubGroup===null?"rgba(124,180,255,0.15)":"rgba(255,255,255,0.04)", color:selectedSubGroup===null?"#7eb8ff":"#5a7aaa", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
                    先発
                  </button>
                  {groups.map((g, i) => (
                    <button key={g.id || i} onClick={() => setSelectedSubGroup(i)}
                      style={{ padding:"7px 14px", borderRadius:8, border:`1px solid ${selectedSubGroup===i?"#ffb400":"#1e3a6a"}`, background:selectedSubGroup===i?"rgba(255,180,0,0.12)":"rgba(255,255,255,0.04)", color:selectedSubGroup===i?"#ffb400":"#5a7aaa", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
                      {i+1}回目後
                    </button>
                  ))}
                  <button onClick={addGroup}
                    style={{ padding:"7px 12px", borderRadius:8, border:"1px dashed #1e3a6a", background:"transparent", color:"#4a6a9a", fontWeight:700, fontSize:12, cursor:"pointer", fontFamily:"inherit", flexShrink:0 }}>
                    ＋ グループ追加
                  </button>
                </div>

                {/* ── グラウンド配置図 ── */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:"#7eb8ff", letterSpacing:2, marginBottom:8 }}>
                    <StadiumIcon size={14} style={{ display:"inline-block", verticalAlign:"middle", marginRight:4 }} /> {selectedSubGroup===null ? "先発" : `${selectedSubGroup+1}回目交代後`}の守備配置
                  </div>
                  <FieldView
                    players={players}
                    positions={applied.pos}
                    lineup={applied.lin}
                    onPlayerTap={(player, pos) => setFieldEditTarget({ player, pos, groupIdx: selectedSubGroup, appliedPos: applied.pos, appliedLin: applied.lin })}
                  />
                  <div style={{ fontSize:11, color:"#4a6a9a", textAlign:"center", marginTop:6 }}>
                    選手アイコンをタップして守備位置を変更できます
                  </div>
                </div>

                {/* ── グループ一覧 ── */}
                {groups.length === 0 ? (
                  <div style={{ ...S.card, padding:36, textAlign:"center", color:"#3a5a8a" }}>
                    <div style={{ fontSize:28, marginBottom:10 }}>🔄</div>
                    <div style={{ fontSize:13, fontWeight:700, marginBottom:6 }}>交代グループがありません</div>
                    <div style={{ fontSize:12, color:"#2a4a7a", marginBottom:16 }}>「＋ グループ追加」から1回目の交代を作りましょう</div>
                    <button onClick={addGroup} style={S.btn}>＋ グループを追加</button>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                    {groups.map((group, gi) => {
                      const isActiveGroup = selectedSubGroup !== null && gi <= selectedSubGroup;
                      return (
                        <div key={group.id || gi} style={{ ...S.card, borderColor: isActiveGroup ? "#00b4ff44" : "#1e3a6a", background: isActiveGroup ? "rgba(0,180,255,0.03)" : "rgba(255,255,255,0.02)" }}>
                          {/* グループヘッダー */}
                          <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", borderBottom:"1px solid #1e3a6a" }}>
                            <div style={{ width:32, height:32, borderRadius:"50%", background:isActiveGroup?"rgba(0,180,255,0.15)":"rgba(255,180,0,0.15)", border:`1px solid ${isActiveGroup?"rgba(0,180,255,0.4)":"rgba(255,180,0,0.4)"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:900, color:isActiveGroup?"#00b4ff":"#ffb400", fontFamily:"'Bebas Neue'", flexShrink:0 }}>
                              {gi+1}
                            </div>
                            <input
                              value={group.label || `${gi+1}回目の交代`}
                              onChange={e => updateGroupLabel(gi, e.target.value)}
                              style={{ flex:1, background:"transparent", border:"none", color:"#e8f0fe", fontWeight:700, fontSize:14, fontFamily:"inherit", outline:"none", minWidth:0 }}
                            />
                            {isActiveGroup && <span style={{ fontSize:10, color:"#00b4ff", background:"rgba(0,180,255,0.12)", border:"1px solid rgba(0,180,255,0.3)", borderRadius:4, padding:"1px 6px", flexShrink:0 }}>表示中</span>}
                            {/* グループ操作 */}
                            <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                              <button onClick={() => moveGroup(gi, -1)} disabled={gi===0}
                                style={{ width:26, height:26, borderRadius:5, border:"1px solid #1e3a6a", background:"rgba(255,255,255,0.04)", color:gi===0?"#243870":"#7eb8ff", cursor:gi===0?"default":"pointer", fontSize:11 }}>↑</button>
                              <button onClick={() => moveGroup(gi, 1)} disabled={gi===groups.length-1}
                                style={{ width:26, height:26, borderRadius:5, border:"1px solid #1e3a6a", background:"rgba(255,255,255,0.04)", color:gi===groups.length-1?"#243870":"#7eb8ff", cursor:gi===groups.length-1?"default":"pointer", fontSize:11 }}>↓</button>
                              <button onClick={() => { setEditingGroupIdx(gi); setEditingChange(null); setShowSubModal(true); }}
                                style={{ padding:"0 10px", height:26, borderRadius:5, background:"rgba(0,180,255,0.1)", border:"1px solid rgba(0,180,255,0.25)", color:"#7eb8ff", cursor:"pointer", fontSize:11, fontFamily:"inherit" }}>＋変更追加</button>
                              <button onClick={() => deleteGroup(gi)}
                                style={{ width:26, height:26, borderRadius:5, background:"rgba(255,60,60,0.1)", border:"1px solid rgba(255,60,60,0.25)", color:"#ff8080", cursor:"pointer", fontSize:12 }}>×</button>
                            </div>
                          </div>

                          {/* 変更一覧 */}
                          <div style={{ padding:"8px 14px", display:"flex", flexDirection:"column", gap:6 }}>
                            {(group.changes || []).length === 0 ? (
                              <div style={{ fontSize:12, color:"#2a4a7a", textAlign:"center", padding:"10px 0" }}>
                                「＋変更追加」で交代・守備変更を登録してください
                              </div>
                            ) : (group.changes || []).map((ch, ci) => {
                              const outP = players.find(p => p.id === ch.outPlayerId);
                              const inP  = players.find(p => p.id === ch.inPlayerId);
                              const pA   = players.find(p => p.id === ch.posPlayerA);
                              const pB   = players.find(p => p.id === ch.posPlayerB);
                              // 元ポジション表示用の計算
                              // posAtGroupStart: 前グループまで適用した状態（グループ開始時点）
                              // posBeforeThis: グループ内のこの変更より前まで適用した状態
                              const applyChangeFn = (np, prev) => {
                                if ((prev.subType||"sub") === "posChange") {
                                  if (prev.posPlayerA && prev.posPlayerB) { const a=np[prev.posPlayerA],b=np[prev.posPlayerB]; if(a)np[prev.posPlayerB]=a;else delete np[prev.posPlayerB]; if(b)np[prev.posPlayerA]=b;else delete np[prev.posPlayerA]; }
                                  else if (prev.posPlayerA && prev.position) { Object.keys(np).forEach(k=>{if(np[k]===prev.position)delete np[k];}); np[prev.posPlayerA]=prev.position; }
                                } else {
                                  if (prev.outPlayerId && prev.inPlayerId) { const op=np[prev.outPlayerId],tp=prev.position||op; if(tp){Object.keys(np).forEach(k=>{if(np[k]===tp&&Number(k)!==prev.outPlayerId)delete np[k];}); np[prev.inPlayerId]=tp;} delete np[prev.outPlayerId]; }
                                }
                              };
                              const posAtGroupStart = (() => {
                                const np = { ...positions };
                                groups.slice(0, gi).forEach(g => (g.changes||[]).forEach(prev => applyChangeFn(np, prev)));
                                return np;
                              })();
                              const posBeforeThis = (() => {
                                const np = { ...posAtGroupStart };
                                (groups[gi]?.changes||[]).slice(0, ci).forEach(prev => applyChangeFn(np, prev));
                                return np;
                              })();
                              // 元ポジションの取得: posBeforeThisで取れない場合はposAtGroupStartで補完
                              const getOriginalPos = (pid) => posBeforeThis[pid] || posAtGroupStart[pid] || null;
                              return (
                                <div key={ch.id || ci} style={{ display:"flex", alignItems:"center", gap:10, padding:"8px 10px", background:"rgba(255,255,255,0.03)", border:"1px solid #192e5a", borderRadius:8 }}>
                                  <div style={{ flex:1, minWidth:0 }}>
                                    {(ch.subType || "sub") === "sub" ? (
                                      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                                        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                                          <span style={{ fontSize:10, color:"#ff8080", background:"rgba(255,80,80,0.1)", border:"1px solid rgba(255,80,80,0.25)", borderRadius:4, padding:"1px 6px", flexShrink:0 }}>OUT</span>
                                          <span style={{ fontSize:13, fontWeight:700, color:"#e8f0fe" }}>{outP ? `#${outP.number} ${outP.name}` : <span style={{ color:"#3a5a8a" }}>未設定</span>}</span>
                                          {outP && getOriginalPos(outP.id) && <span style={{ fontSize:11, color:"#ff8080", background:"rgba(255,80,80,0.08)", borderRadius:4, padding:"1px 5px" }}>{getOriginalPos(outP.id)}</span>}
                                        </div>
                                        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                                          <span style={{ fontSize:10, color:"#00dc78", background:"rgba(0,220,120,0.1)", border:"1px solid rgba(0,220,120,0.25)", borderRadius:4, padding:"1px 6px", flexShrink:0 }}>IN</span>
                                          <span style={{ fontSize:13, fontWeight:700, color:"#e8f0fe" }}>{inP ? `#${inP.number} ${inP.name}` : <span style={{ color:"#3a5a8a" }}>未設定</span>}</span>
                                          {(() => { const newPos = ch.position || (outP && posBeforeThis[outP.id] ? posBeforeThis[outP.id] : null); return newPos ? <span style={{ fontSize:11, color:"#00e5ff", background:"rgba(0,229,255,0.08)", borderRadius:4, padding:"1px 5px" }}>{newPos}</span> : null; })()}
                                        </div>
                                      </div>
                                    ) : (
                                      <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                                        <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                                          <span style={{ fontSize:10, color:"#7eb8ff", background:"rgba(124,180,255,0.1)", border:"1px solid rgba(124,180,255,0.25)", borderRadius:4, padding:"1px 6px", flexShrink:0 }}>🔀守備</span>
                                          {pB ? (
                                            <span style={{ fontSize:13, fontWeight:700, color:"#e8f0fe" }}>
                                              {pA?.name||"?"}{getOriginalPos(pA?.id) ? <span style={{ fontSize:11, color:"#7eb8ff" }}>({getOriginalPos(pA.id)})</span> : ""} ⇄ {pB?.name||"?"}{getOriginalPos(pB?.id) ? <span style={{ fontSize:11, color:"#7eb8ff" }}>({getOriginalPos(pB.id)})</span> : ""}
                                            </span>
                                          ) : (
                                            <span style={{ fontSize:13, fontWeight:700, color:"#e8f0fe" }}>
                                              {pA?.name||"?"}{getOriginalPos(pA?.id) ? <span style={{ fontSize:11, color:"#7eb8ff" }}>({getOriginalPos(pA.id)})</span> : ""} → <span style={{ color:"#00e5ff" }}>{ch.position}</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                    {ch.memo && <div style={{ fontSize:11, color:"#5a7aaa", marginTop:2 }}>📝 {ch.memo}</div>}
                                  </div>
                                  <div style={{ display:"flex", gap:4, flexShrink:0 }}>
                                    <button onClick={() => moveChange(gi, ci, -1)} disabled={ci===0}
                                      style={{ width:24, height:24, borderRadius:5, border:"1px solid #1e3a6a", background:"rgba(255,255,255,0.04)", color:ci===0?"#243870":"#7eb8ff", cursor:ci===0?"default":"pointer", fontSize:10 }}>↑</button>
                                    <button onClick={() => moveChange(gi, ci, 1)} disabled={ci===(group.changes||[]).length-1}
                                      style={{ width:24, height:24, borderRadius:5, border:"1px solid #1e3a6a", background:"rgba(255,255,255,0.04)", color:ci===(group.changes||[]).length-1?"#243870":"#7eb8ff", cursor:ci===(group.changes||[]).length-1?"default":"pointer", fontSize:10 }}>↓</button>
                                    <button onClick={() => { setEditingGroupIdx(gi); setEditingChange(ch); setShowSubModal(true); }}
                                      style={{ width:24, height:24, borderRadius:5, background:"rgba(0,180,255,0.1)", border:"1px solid rgba(0,180,255,0.25)", color:"#7eb8ff", cursor:"pointer", fontSize:11 }}>✏️</button>
                                    <button onClick={() => deleteChange(gi, ci)}
                                      style={{ width:24, height:24, borderRadius:5, background:"rgba(255,60,60,0.1)", border:"1px solid rgba(255,60,60,0.25)", color:"#ff8080", cursor:"pointer", fontSize:12 }}>×</button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>)}
            </div>
          );
        })()}

        {/* ===== ROSTER ===== */}
        {activeTab === "roster" && (
          <div className="fade-in">
            {/* タイトル + エクスポート/インポート */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#7eb8ff", letterSpacing: 2 }}>選手一覧 ({players.length}名)</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={exportPlayers}
                  style={{ padding: "7px 12px", background: "rgba(0,180,255,0.1)", border: "1px solid rgba(0,180,255,0.3)", borderRadius: 8, color: "#7eb8ff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  ⬇️ CSV出力
                </button>
                <label style={{ padding: "7px 12px", background: "rgba(0,220,120,0.1)", border: "1px solid rgba(0,220,120,0.3)", borderRadius: 8, color: "#00dc78", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                  ⬆️ CSV取込
                  <input type="file" accept=".csv" onChange={importPlayers} style={{ display: "none" }} />
                </label>
              </div>
            </div>
            {/* インポート結果メッセージ */}
            {importError   && <div style={{ fontSize: 12, color: "#ff8080", background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.2)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>⚠️ {importError}</div>}
            {importSuccess && <div style={{ fontSize: 12, color: "#00dc78", background: "rgba(0,220,120,0.08)", border: "1px solid rgba(0,220,120,0.2)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>✓ {importSuccess}</div>}
            {/* CSVフォーマット説明 */}
            <div style={{ fontSize: 11, color: "#3a5a8a", background: "rgba(255,255,255,0.02)", border: "1px solid #1a2e50", borderRadius: 8, padding: "8px 12px", marginBottom: 12 }}>
              📄 CSVフォーマット：背番号, 名前, 学年, 投げる手, 打つ手（1行目はヘッダー）
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input value={newNumber} onChange={e => setNewNumber(e.target.value)} placeholder="番号" style={{ ...S.inp, width: 72 }} />
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="選手名" onKeyDown={e => e.key === "Enter" && addPlayer()} style={{ ...S.inp, flex: 1 }} />
              <button onClick={addPlayer} style={{ ...S.btn, padding: "12px 16px", flexShrink: 0 }}>追加</button>
            </div>
            {/* 学年フィルター */}
            <div style={{ display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 4 }}>
              {[{ value: "", label: "全員" }, ...GRADE_OPTIONS.filter(o => o.value)].map(o => (
                <button key={o.value} onClick={() => setRosterFilter(o.value)}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: rosterFilter === o.value ? "#1e4a9a" : "rgba(255,255,255,0.07)", color: rosterFilter === o.value ? "#fff" : "#6a8ab0", flexShrink: 0, minHeight: 36, WebkitTapHighlightColor: "transparent" }}>
                  {o.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredPlayers.map(p => {
                const bi = currentGame ? lineup.indexOf(p.id) : -1;
                const pos = currentGame ? positions[p.id] : null;
                const isAbs = currentGame ? absent.includes(p.id) : false;
                const hl = handLabel(p.throwHand || "", p.batHand || "");
                return (
                  <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", ...S.card, borderRadius: 11, opacity: isAbs ? 0.55 : 1, minHeight: 60 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: isAbs ? "rgba(255,80,80,0.2)" : "linear-gradient(135deg,#1e4a9a,#0c1e40)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: isAbs ? "#ff8080" : "#7eb8ff", border: "1px solid #243870", flexShrink: 0 }}>#{p.number}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</span>
                        {p.grade && <span className="grade-badge">{p.grade}</span>}
                        {hl && <span className="hand-badge">{hl}</span>}
                      </div>
                      <div style={{ fontSize: 11, color: isAbs ? "#ff8080" : "#4a6a9a", marginTop: 2 }}>
                        {isAbs ? "😴 休み" : bi >= 0 ? `打順 ${bi+1}番` : "控え"}{pos ? `　${POS_SHORT[pos] || pos}` : ""}
                      </div>
                    </div>
                    <button onClick={() => setEditingPlayer(p)} style={{ background: "rgba(0,180,255,0.1)", border: "1px solid rgba(0,180,255,0.25)", color: "#7eb8ff", borderRadius: 8, padding: "8px 10px", cursor: "pointer", fontSize: 16, flexShrink: 0, minWidth: 40, minHeight: 40 }}>✏️</button>
                    <button onClick={() => removePlayer(p.id)} style={{ ...S.btnDanger, flexShrink: 0, minHeight: 40 }}>削除</button>
                  </div>
                );
              })}
              {filteredPlayers.length === 0 && (
                <div style={{ ...S.card, padding: 24, textAlign: "center", color: "#3a5a8a", fontSize: 13 }}>{rosterFilter}の選手はいません</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Copyright footer ── */}
      <div style={{ textAlign: "center", padding: "16px 0 8px", fontSize: 10, color: "#2a4a6a", userSelect: "none" }}>
        © {new Date().getFullYear()} Reo Matayoshi. All rights reserved.
      </div>

      {/* ── Bottom navigation ── */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "rgba(10,22,40,0.97)", borderTop: "1px solid #1e3a6a", display: "flex", zIndex: 50, backdropFilter: "blur(12px)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        {TABS.map(([key, icon, label]) => (
          <button key={key} className="bottom-nav-btn" onClick={() => setActiveTab(key)}
            style={{ color: activeTab === key ? "#00b4ff" : "#4a6a9a" }}>
            {icon === "STADIUM"
              ? <StadiumIcon size={24} />
              : <span style={{ fontSize: 22 }}>{icon}</span>
            }
            <span style={{ fontSize: 10, fontWeight: 700 }}>{label}</span>
            {activeTab === key && <div style={{ width: 20, height: 2, background: "#00b4ff", borderRadius: 1, position: "absolute", bottom: "calc(env(safe-area-inset-bottom) + 4px)" }} />}
          </button>
        ))}
      </div>

      {/* ── Logout menu ── */}
      {showLogout && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200 }} onClick={() => setShowLogout(false)}>
          <div style={{ position: "absolute", top: 60, right: 14, background: "#0d1e3a", border: "1px solid #1e3a6a", borderRadius: 12, overflow: "hidden", minWidth: 180 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: "10px 16px", fontSize: 12, color: "#5a7aaa", borderBottom: "1px solid #1e3a6a" }}>
              <div style={{ fontWeight: 700, color: "#c0d8ff" }}>{user.displayName || "—"}</div>
              <div style={{ marginTop: 2 }}>{user.email}</div>
            </div>
            <button onClick={() => { setShowLogout(false); onOpenSettings(); }}
              style={{ width: "100%", padding: "12px 16px", background: "transparent", border: "none", borderBottom: "1px solid #1e3a6a", color: "#7eb8ff", fontSize: 14, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}>
              ⚙️ アカウント設定
            </button>
            <a href="https://baseball-lineup-app-3ffba.web.app/lp/" target="_blank" rel="noreferrer"
              style={{ display: "block", padding: "12px 16px", borderBottom: "1px solid #1e3a6a", color: "#7eb8ff", fontSize: 14, textDecoration: "none" }}
              onClick={() => setShowLogout(false)}>
              📄 アプリ紹介ページ
            </a>
            <button onClick={onLogout}
              style={{ width: "100%", padding: "12px 16px", background: "transparent", border: "none", color: "#ff8080", fontSize: 14, fontFamily: "inherit", cursor: "pointer", textAlign: "left" }}>
              ログアウト
            </button>
          </div>
        </div>
      )}

      {/* ── Delete modal ── */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 200 }}>
          <div style={{ ...S.card, padding: "24px 20px 36px", textAlign: "center", width: "100%", maxWidth: 520, borderRadius: "20px 20px 0 0" }}>
            <div style={{ width: 40, height: 4, background: "#2a4a8a", borderRadius: 2, margin: "0 auto 20px" }} />
            <div style={{ fontSize: 28, marginBottom: 10 }}>🗑</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>この試合を削除しますか？</div>
            <div style={{ fontSize: 12, color: "#4a6a9a", marginBottom: 24 }}>削除したデータは元に戻せません</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "14px", background: "#1a3260", border: "none", borderRadius: 12, color: "#7eb8ff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>キャンセル</button>
              <button onClick={() => deleteGame(deleteConfirm)} style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg,#c02020,#801010)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Substitution modal ── */}
      {showSubModal && currentGame && (() => {
        // 編集中グループの直前まで交代を適用した lineup を渡す
        const modalLineup = editingGroupIdx !== null && editingGroupIdx > 0
          ? applySubsUpTo(editingGroupIdx - 1).lin
          : lineup;
        return (
        <SubModal
          sub={editingChange}
          players={players}
          lineup={modalLineup}
          absent={absent}
          availablePositions={availablePositions}
          onSave={(change) => {
            const groups = currentGame.subGroups || [];
            const gIdx = editingGroupIdx;
            if (gIdx === null) return;
            const newGroups = groups.map((g, i) => {
              if (i !== gIdx) return g;
              const changes = g.changes || [];
              const ci = changes.findIndex(c => c.id === change.id);
              return {
                ...g,
                changes: ci >= 0
                  ? changes.map(c => c.id === change.id ? change : c)
                  : [...changes, { ...change, id: Date.now() }],
              };
            });
            updateGame({ subGroups: newGroups });
            setShowSubModal(false);
            setEditingChange(null);
            setEditingGroupIdx(null);
          }}
          onClose={() => { setShowSubModal(false); setEditingChange(null); setEditingGroupIdx(null); }}
        />
        );
      })()}

      {/* ── Field position edit modal ── */}
      {fieldEditTarget !== null && (() => {
        // fieldEditTarget.groupIdx が設定されている場合は交代グループに記録する
        const groupIdx = fieldEditTarget.groupIdx ?? null;
        const isSubTab = groupIdx !== null;

        // ポジション変更をグループに記録するヘルパー
        const recordToGroup = (changeObj) => {
          if (!isSubTab || !currentGame) return;
          const groups = currentGame.subGroups || [];
          const newGroups = groups.map((g, i) => i !== groupIdx ? g : {
            ...g,
            changes: [...(g.changes || []), { ...changeObj, id: Date.now() }],
          });
          updateGame({ subGroups: newGroups });
        };

        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300 }}
            onClick={() => { setFieldEditTarget(null); setPendingBenchSwap(null); }}>
            <div style={{ background: "#0d1e3a", border: "1px solid #1e3a6a", borderRadius: "20px 20px 0 0", padding: "20px 20px 44px", width: "100%", maxWidth: 480, fontFamily: "'Noto Sans JP', sans-serif", maxHeight: "90vh", overflowY: "auto" }}
              onClick={e => e.stopPropagation()}>
              <div style={{ width: 40, height: 4, background: "#2a4a8a", borderRadius: 2, margin: "0 auto 18px" }} />

              {/* ヘッダー */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#e8f0fe", marginBottom: 4 }}>
                  <StadiumIcon size={18} style={{ display:"inline-block", verticalAlign:"middle", marginRight:6 }} /> 守備ポジションを変更
                </div>
                {fieldEditTarget.player ? (
                  <div style={{ fontSize: 12, color: "#7eb8ff" }}>
                    #{fieldEditTarget.player.number} {fieldEditTarget.player.name}
                    {(() => { const ap = fieldEditTarget.appliedPos || positions; const cur = ap[fieldEditTarget.player.id]; return cur ? <span style={{ marginLeft: 8, color: "#00e5ff" }}>現在: {cur}</span> : null; })()}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#5a7aaa" }}>
                    [{fieldEditTarget.pos}] {POSITION_LABELS[fieldEditTarget.pos] || ""} — 現在未配置
                  </div>
                )}
                {isSubTab && (
                  <div style={{ fontSize: 11, color: "#ffb400", background: "rgba(255,180,0,0.08)", border: "1px solid rgba(255,180,0,0.2)", borderRadius: 7, padding: "5px 10px", marginTop: 8 }}>
                    📋 変更は「{(currentGame?.subGroups||[])[groupIdx]?.label || `${groupIdx+1}回目の交代`}」に記録されます
                  </div>
                )}
              </div>

              {/* ポジション選択グリッド */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 16 }}>
                {availablePositions.map(pos => {
                  const activePos = fieldEditTarget.appliedPos || positions;
                  const getActiveHolder = (p) => { const pid = Object.keys(activePos).find(k => activePos[k] === p); return pid ? players.find(pl => pl.id === Number(pid)) : null; };
                  const currentHolder = getActiveHolder(pos);
                  const isCurrentPos = fieldEditTarget.player
                    ? activePos[fieldEditTarget.player.id] === pos
                    : fieldEditTarget.pos === pos;
                  const isOccupied = currentHolder && currentHolder.id !== fieldEditTarget.player?.id;
                  return (
                    <button key={pos}
                      onClick={() => {
                        if (fieldEditTarget.player) {
                          if (isCurrentPos) {
                            // 守備なしに → 交代タブでは記録のみ、先発は変更しない
                            if (!isSubTab) setPosition(fieldEditTarget.player.id, "");
                          } else {
                            if (isSubTab) {
                              // 交代タブ: グループに記録するだけ（先発配置は変更しない）
                              if (isOccupied) {
                                recordToGroup({ subType: "posChange", posPlayerA: fieldEditTarget.player.id, posPlayerB: currentHolder.id, position: "" });
                              } else {
                                recordToGroup({ subType: "posChange", posPlayerA: fieldEditTarget.player.id, posPlayerB: null, position: pos });
                              }
                            } else {
                              // 守備タブ等: 先発配置を直接変更
                              swapPosition(fieldEditTarget.player.id, pos);
                            }
                          }
                        }
                        setFieldEditTarget(null);
                      }}
                      style={{
                        padding: "12px 6px", border: `1px solid ${isCurrentPos ? "#00e5ff" : isOccupied ? "rgba(255,180,0,0.4)" : "#1e3a6a"}`,
                        borderRadius: 10, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13,
                        background: isCurrentPos ? "rgba(0,229,255,0.15)" : isOccupied ? "rgba(255,180,0,0.08)" : "rgba(255,255,255,0.04)",
                        color: isCurrentPos ? "#00e5ff" : isOccupied ? "#ffb400" : "#c0d8ff",
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
                        WebkitTapHighlightColor: "transparent",
                      }}>
                      <span>{POS_SHORT[pos] || pos}</span>
                      {isOccupied && <span style={{ fontSize: 9, fontWeight: 400, color: "#ffb400" }}>{currentHolder.name.split(" ").pop()}</span>}
                      {isCurrentPos && <span style={{ fontSize: 9, fontWeight: 400, color: "#00e5ff" }}>現在</span>}
                    </button>
                  );
                })}
              </div>

              {/* 控え選手との入れ替え（交代タブ・スタメン選手のみ） */}
              {isSubTab && fieldEditTarget.player && (() => {
                const ap = fieldEditTarget.appliedPos || positions;
                const al = fieldEditTarget.appliedLin || lineup;
                const activeIds = al.filter(Boolean);
                const isStarter = activeIds.includes(fieldEditTarget.player.id);
                const subBench = players.filter(p => !activeIds.includes(p.id) && !absent.includes(p.id));
                if (!isStarter || subBench.length === 0) return null;

                // ステップ2: ポジション選択中
                if (pendingBenchSwap && pendingBenchSwap.outPlayer.id === fieldEditTarget.player.id) {
                  return (
                    <div style={{ marginBottom: 14 }}>
                      <button onClick={() => setPendingBenchSwap(null)}
                        style={{ background:"none", border:"none", color:"#7eb8ff", fontSize:13, cursor:"pointer", fontFamily:"inherit", padding:"0 0 10px 0" }}>
                        ← 控え選手選択に戻る
                      </button>
                      <div style={{ fontSize:13, fontWeight:700, color:"#e8f0fe", marginBottom:10 }}>
                        {pendingBenchSwap.inPlayer.name} の守備ポジション
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:7, marginBottom:10 }}>
                        {availablePositions.map(pos => (
                          <button key={pos} onClick={() => {
                            recordToGroup({
                              subType: "sub",
                              outPlayerId: pendingBenchSwap.outPlayer.id,
                              inPlayerId:  pendingBenchSwap.inPlayer.id,
                              position:    pos,
                            });
                            setPendingBenchSwap(null);
                            setFieldEditTarget(null);
                          }}
                          style={{ padding:"10px 4px", border:`1px solid ${pos === pendingBenchSwap.outPos ? "#ffb400" : "#1e3a6a"}`, borderRadius:9, cursor:"pointer", fontFamily:"inherit", fontWeight:700, fontSize:13, background: pos === pendingBenchSwap.outPos ? "rgba(255,180,0,0.12)" : "rgba(255,255,255,0.04)", color: pos === pendingBenchSwap.outPos ? "#ffb400" : "#c0d8ff", display:"flex", flexDirection:"column", alignItems:"center", gap:2, WebkitTapHighlightColor:"transparent" }}>
                            {pos}
                            {pos === pendingBenchSwap.outPos && <span style={{ fontSize:8, color:"#ffb400" }}>元の守備</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                }

                // ステップ1: 控え選手選択
                return (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#00dc78", letterSpacing: 1, marginBottom: 8 }}>
                      🔄 控え選手と交代（グループに記録）
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {subBench.map(bp => {
                        const outPos = ap[fieldEditTarget.player.id];
                        return (
                          <button key={bp.id}
                            onClick={() => {
                              // 控え選手を選択 → ポジション選択ステップへ
                              setPendingBenchSwap({
                                outPlayer: fieldEditTarget.player,
                                inPlayer:  bp,
                                outPos:    outPos || "",
                              });
                            }}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(0,220,120,0.05)", border: "1px solid rgba(0,220,120,0.2)", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#0c3020", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#00dc78", flexShrink: 0 }}>#{bp.number}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "#e8f0fe" }}>{bp.name}</div>
                              {bp.grade && <div style={{ fontSize: 10, color: "#5a7aaa" }}>{bp.grade}</div>}
                            </div>
                            <div style={{ fontSize: 11, color: "#00dc78", flexShrink: 0 }}>
                              {fieldEditTarget.player.name} と交代 →
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* 控え選手との入れ替え（守備タブ・スタメン選手のみ） */}
              {!isSubTab && fieldEditTarget.player && lineup.filter(Boolean).includes(fieldEditTarget.player.id) && benchPlayers.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7eb8ff", letterSpacing: 1, marginBottom: 8 }}>
                    🔄 控え選手と入れ替え
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {benchPlayers.map(bp => {
                      return (
                        <button key={bp.id}
                          onClick={() => {
                            const hasGroups = (currentGame?.subGroups || []).length > 0;
                            if (hasGroups) {
                              // 交代グループがある場合は確認ダイアログを出す
                              setSwapConfirm({
                                outPid: fieldEditTarget.player.id,
                                inPid:  bp.id,
                                outName: fieldEditTarget.player.name,
                                inName:  bp.name,
                                outPos:  positions[fieldEditTarget.player.id],
                              });
                            } else {
                              // 交代グループがない場合は直接実行
                              const outPid = fieldEditTarget.player.id;
                              const inPid  = bp.id;
                              const newLineup = lineup.map(id => id === outPid ? inPid : id);
                              const np = { ...positions };
                              if (positions[outPid]) { np[inPid] = positions[outPid]; }
                              delete np[outPid];
                              updateGame({ lineup: newLineup, positions: np });
                              setFieldEditTarget(null);
                            }
                          }}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,0.04)", border: "1px solid #1e3a6a", borderRadius: 10, cursor: "pointer", fontFamily: "inherit", textAlign: "left", WebkitTapHighlightColor: "transparent" }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#0c1e3a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, color: "#7eb8ff", flexShrink: 0 }}>#{bp.number}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#e8f0fe" }}>{bp.name}</div>
                            {bp.grade && <div style={{ fontSize: 10, color: "#5a7aaa" }}>{bp.grade}</div>}
                          </div>
                          <div style={{ fontSize: 11, color: "#4a6a9a", flexShrink: 0 }}>
                            {fieldEditTarget.player.name} と交代
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 守備なし */}
              {!isSubTab && fieldEditTarget.player && (fieldEditTarget.appliedPos || positions)[fieldEditTarget.player.id] && (
                <button
                  onClick={() => { setPosition(fieldEditTarget.player.id, ""); setFieldEditTarget(null); }}
                  style={{ width: "100%", padding: "12px", background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.25)", borderRadius: 12, color: "#ff8080", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
                  守備ポジションを外す
                </button>
              )}

              <div style={{ fontSize: 11, color: "#3a5a8a", textAlign: "center" }}>
                🟡 黄色は他の選手が配置済みのポジション（入れ替わります）
              </div>

              <button onClick={() => setFieldEditTarget(null)}
                style={{ width: "100%", marginTop: 12, padding: "11px", background: "transparent", border: "1px solid #1e3a6a", borderRadius: 12, color: "#5a7aaa", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                キャンセル
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── スタメン入れ替え確認ダイアログ ── */}
      {swapConfirm !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: "0 20px" }}
          onClick={() => setSwapConfirm(null)}>
          <div style={{ background: "#0d1e3a", border: "1px solid #1e3a6a", borderRadius: 16, padding: "24px 20px", width: "100%", maxWidth: 380, fontFamily: "'Noto Sans JP', sans-serif" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e8f0fe", marginBottom: 12 }}>⚠️ 確認</div>
            <div style={{ fontSize: 13, color: "#c0d8ff", marginBottom: 8, lineHeight: 1.7 }}>
              <span style={{ color: "#ff8080", fontWeight: 700 }}>{swapConfirm.outName}</span> と <span style={{ color: "#00dc78", fontWeight: 700 }}>{swapConfirm.inName}</span> を入れ替えます。
            </div>
            <div style={{ fontSize: 12, color: "#ff8080", background: "rgba(255,60,60,0.08)", border: "1px solid rgba(255,60,60,0.2)", borderRadius: 9, padding: "10px 12px", marginBottom: 20 }}>
              登録済みの交代予定グループがすべてクリアされます。よろしいですか？
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setSwapConfirm(null)}
                style={{ flex: 1, padding: "12px", background: "#1a3260", border: "none", borderRadius: 10, color: "#7eb8ff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                キャンセル
              </button>
              <button onClick={() => {
                  const { outPid, inPid, outPos } = swapConfirm;
                  const newLineup = lineup.map(id => id === outPid ? inPid : id);
                  const np = { ...positions };
                  if (outPos) { np[inPid] = outPos; }
                  delete np[outPid];
                  updateGame({ lineup: newLineup, positions: np, subGroups: [] });
                  setSwapConfirm(null);
                  setFieldEditTarget(null);
                }}
                style={{ flex: 2, padding: "12px", background: "linear-gradient(135deg,#cc2200,#8b1500)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                入れ替えて交代をクリア
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Player edit modal ── */}
      {editingPlayer && <PlayerEditModal player={editingPlayer} onSave={savePlayerEdit} onClose={() => setEditingPlayer(null)} />}

      {/* ── Share modal ── */}
      {showShare && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 300 }} onClick={() => { setShowShare(false); setFieldImgUrl(null); setCombinedMode(false); }}>
          <div style={{ background: "#0d1e3a", border: "1px solid #1e3a6a", borderRadius: "20px 20px 0 0", padding: "20px 20px 40px", width: "100%", maxWidth: 520, fontFamily: "'Noto Sans JP', sans-serif", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: "#2a4a8a", borderRadius: 2, margin: "0 auto 18px" }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e8f0fe", marginBottom: 4 }}>📤 スタメンを共有</div>
            <div style={{ fontSize: 12, color: "#4a6a9a", marginBottom: 18 }}>
              {currentGame?.date?.replace(/-/g, "/")}
              {currentGame?.opponent ? `　vs ${currentGame.opponent}` : ""}
            </div>

            {/* タブ：テキスト / 画像 */}
            <>
              <div style={{ display: "flex", background: "#091a38", borderRadius: 10, padding: 3, marginBottom: 16 }}>
              {[["text","📋 打順テキスト"],["image","⬜ 守備配置画像"]].map(([key, label]) => (
          <button key={key} onClick={() => setShareTab(key)}
            style={{ flex: 1, padding: "9px", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: shareTab === key ? "linear-gradient(135deg,#1e4a9a,#0d2e6a)" : "transparent", color: shareTab === key ? "#fff" : "#4a6a9a", transition: "all 0.2s" }}>
            {label}
          </button>
              ))}
            </div>

            {shareTab === "text" && (
              <>
          <div style={{ background: "#091a38", border: "1px solid #1e3a6a", borderRadius: 10, padding: "12px 14px", marginBottom: 16, maxHeight: 160, overflowY: "auto" }}>
            <pre style={{ fontSize: 11, color: "#c0d8ff", lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "'Noto Sans JP', sans-serif" }}>{buildShareText()}</pre>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button onClick={handleLineShare}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px", background: "#06c755", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
              LINEで送る（テキスト）
            </button>
            {"share" in navigator && (
              <button onClick={handleWebShare}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px", background: "linear-gradient(135deg,#1e6adc,#0d4aaa)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
                📨 その他のアプリで送る
              </button>
            )}
            <button onClick={handleCopy}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px", background: copyDone ? "rgba(0,200,100,0.15)" : "rgba(255,255,255,0.06)", border: `1px solid ${copyDone ? "rgba(0,200,100,0.4)" : "#1e3a6a"}`, borderRadius: 12, color: copyDone ? "#00dc78" : "#c0d8ff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
              {copyDone ? "✓ コピーしました！" : "📋 テキストをコピー"}
            </button>
          </div>
              </>
            )}

            {shareTab === "image" && (
              <>
          {/* 画像タイプ選択 */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[["field", "守備配置のみ"], ["combined", "📋＋守備"]].map(([key, label]) => (
              <button key={key} onClick={() => { setFieldImgUrl(null); setCombinedMode(key === "combined"); }}
                style={{ flex: 1, padding: "9px 6px", border: `1px solid ${combinedMode === (key === "combined") ? "#00b4ff" : "#1e3a6a"}`, borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700, background: combinedMode === (key === "combined") ? "rgba(0,180,255,0.12)" : "rgba(255,255,255,0.04)", color: combinedMode === (key === "combined") ? "#00b4ff" : "#6a8ab0", transition: "all 0.2s" }}>
                {label}
              </button>
            ))}
          </div>

          {/* 画像プレビュー */}
          {fieldImgUrl ? (
            <div style={{ marginBottom: 16 }}>
              <img src={fieldImgUrl} alt="スタメン画像" style={{ width: "100%", borderRadius: 10, border: "1px solid #1e3a6a" }} />
            </div>
          ) : (
            <div style={{ background: "#091a38", border: "1px dashed #1e3a6a", borderRadius: 10, padding: "32px 0", marginBottom: 16, textAlign: "center", color: "#4a6a9a", fontSize: 13 }}>
              {imgGenerating ? "⏳ 画像を生成中..." : "ボタンを押して画像を生成してください"}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {!fieldImgUrl && (
              <button onClick={combinedMode ? handlePreviewCombinedImage : handlePreviewFieldImage} disabled={imgGenerating}
                style={{ padding: "14px", background: "linear-gradient(135deg,#1e6adc,#0d4aaa)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit", opacity: imgGenerating ? 0.6 : 1 }}>
                {imgGenerating ? "⏳ 生成中..." : "🖼 画像を生成する"}
              </button>
            )}
            {fieldImgUrl && (
              <>
                <button onClick={combinedMode ? handleShareCombinedImage : handleShareFieldImage} disabled={imgGenerating}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "14px", background: "#06c755", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/></svg>
                  LINEまたはアプリで送る
                </button>
                <button onClick={() => { const a = document.createElement("a"); a.href = fieldImgUrl; a.download = combinedMode ? "lineup-combined.png" : "lineup-field.png"; a.click(); }}
                  style={{ padding: "14px", background: "rgba(255,255,255,0.06)", border: "1px solid #1e3a6a", borderRadius: 12, color: "#c0d8ff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}>
                  ⬇️ 画像をダウンロード
                </button>
                <button onClick={() => setFieldImgUrl(null)}
                  style={{ padding: "10px", background: "transparent", border: "none", color: "#4a6a9a", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  再生成する
                </button>
              </>
            )}
          </div>
              </>
            )}
            </>

            <button onClick={() => { setShowShare(false); setFieldImgUrl(null); setCombinedMode(false); }}
              style={{ width: "100%", marginTop: 14, padding: "12px", background: "transparent", border: "1px solid #1e3a6a", borderRadius: 12, color: "#5a7aaa", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
