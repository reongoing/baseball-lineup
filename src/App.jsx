import { useState, useEffect } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  updateEmail,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "./firebase";
import LineupApp from "./LineupApp";

const BASE = {
  page:  { minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans JP', sans-serif", color: "#e8f0fe" },
  card:  { background: "rgba(255,255,255,0.04)", border: "1px solid #1e3a6a", borderRadius: 16, padding: "36px 28px", width: "100%", maxWidth: 400 },
  input: { width: "100%", padding: "12px 14px", background: "#091a38", border: "1px solid #1e3a6a", borderRadius: 9, color: "#e8f0fe", fontSize: 16, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  btn:   { width: "100%", padding: "13px", background: "linear-gradient(135deg,#1e6adc,#0d4aaa)", border: "none", borderRadius: 9, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: "inherit" },
  label: { fontSize: 12, color: "#7eb8ff", fontWeight: 700, marginBottom: 6, display: "block" },
  err:   { fontSize: 12, color: "#ff8080", background: "rgba(255,60,60,0.1)", border: "1px solid rgba(255,60,60,0.25)", borderRadius: 7, padding: "8px 12px" },
  ok:    { fontSize: 12, color: "#00dc78", background: "rgba(0,200,100,0.08)", border: "1px solid rgba(0,200,100,0.25)", borderRadius: 7, padding: "8px 12px" },
};

const ERROR_MESSAGES = {
  "auth/email-already-in-use":  "このメールアドレスはすでに登録されています",
  "auth/invalid-email":         "メールアドレスの形式が正しくありません",
  "auth/weak-password":         "パスワードは6文字以上で設定してください",
  "auth/user-not-found":        "メールアドレスまたはパスワードが違います",
  "auth/wrong-password":        "メールアドレスまたはパスワードが違います",
  "auth/invalid-credential":    "メールアドレスまたはパスワードが違います",
  "auth/too-many-requests":     "試行回数が多すぎます。しばらく待ってから再試行してください",
  "auth/requires-recent-login": "セキュリティのため再ログインが必要です",
};
const errMsg = (code) => ERROR_MESSAGES[code] || `エラーが発生しました（${code}）`;

// ─── Baseball SVG Icon ───────────────────────────────────────────────────────
function BaseballIcon({ size = 28, style = {} }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, ...style }}>
      <circle cx="16" cy="16" r="14" fill="white" stroke="#e0e0e0" strokeWidth="0.5"/>
      <path d="M 9 7 C 11 10, 11 14, 9 17 C 11 20, 11 24, 9 25" stroke="#cc2200" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <path d="M 23 7 C 21 10, 21 14, 23 17 C 21 20, 21 24, 23 25" stroke="#cc2200" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <line x1="9" y1="9.5"  x2="12" y2="10.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="12"   x2="12" y2="12.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="14.5" x2="12" y2="14.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="17"   x2="12" y2="16.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="19.5" x2="12" y2="19"   stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="9" y1="22"   x2="12" y2="22"   stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="23" y1="9.5"  x2="20" y2="10.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="23" y1="12"   x2="20" y2="12.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="23" y1="14.5" x2="20" y2="14.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="23" y1="17"   x2="20" y2="16.5" stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="23" y1="19.5" x2="20" y2="19"   stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
      <line x1="23" y1="22"   x2="20" y2="22"   stroke="#cc2200" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  );
}

// ─── パスワードリセット画面 ───────────────────────────────────────────────────
function ResetPasswordScreen({ onBack }) {
  const [email, setEmail]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [sent, setSent]       = useState(false);

  const handleReset = async () => {
    if (!email.trim()) { setError("メールアドレスを入力してください"); return; }
    setLoading(true); setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (e) {
      const map = {
        "auth/user-not-found":  "このメールアドレスは登録されていません",
        "auth/invalid-email":   "メールアドレスの形式が正しくありません",
        "auth/too-many-requests": "しばらく待ってから再試行してください",
      };
      setError(map[e.code] || `エラーが発生しました（${e.code}）`);
    }
    setLoading(false);
  };

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#7eb8ff", fontSize: 13, cursor: "pointer", fontFamily: "inherit", padding: "0 0 16px 0" }}>← ログインに戻る</button>
      <div style={{ fontSize: 16, fontWeight: 700, color: "#e8f0fe", marginBottom: 6 }}>🔑 パスワードをリセット</div>
      <div style={{ fontSize: 12, color: "#4a6a9a", marginBottom: 20 }}>
        登録済みのメールアドレスを入力すると、パスワード再設定のリンクをお送りします。
      </div>
      {!sent ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={BASE.label}>登録済みメールアドレス</label>
            <input style={BASE.input} type="email" placeholder="example@email.com"
              value={email} onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleReset()} />
          </div>
          {error && <div style={BASE.err}>⚠️ {error}</div>}
          <button onClick={handleReset} disabled={loading}
            style={{ ...BASE.btn, opacity: loading ? 0.6 : 1 }}>
            {loading ? "送信中..." : "リセットメールを送信"}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={BASE.ok}>
            ✓ {email} にリセット用メールを送信しました。メール内のリンクからパスワードを再設定してください。
          </div>
          <div style={{ fontSize: 11, color: "#4a6a9a" }}>
            ※ メールが届かない場合は迷惑メールフォルダをご確認ください。
          </div>
          <button onClick={onBack} style={{ ...BASE.btn, background: "#1a3260" }}>
            ログイン画面に戻る
          </button>
        </div>
      )}
    </div>
  );
}

// ─── ログイン・新規登録画面 ────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode]         = useState("login");
  const [teamName, setTeamName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email || !password) { setError("メールアドレスとパスワードを入力してください"); return; }
    if (mode === "signup" && !teamName.trim()) { setError("チーム名を入力してください"); return; }
    setLoading(true);
    try {
      if (mode === "signup") {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: teamName.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) { setError(errMsg(e.code)); }
    setLoading(false);
  };

  return (
    <div style={BASE.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;700;900&family=Bebas+Neue&display=swap'); * { box-sizing: border-box; } input:focus { border-color: #4a8adc !important; outline: none; }`}</style>
      <div style={BASE.card}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}><BaseballIcon size={38} /><span style={{ fontSize: 38, fontFamily: "'Bebas Neue'", letterSpacing: 4, background: "linear-gradient(90deg,#fff,#7eb8ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>LINEUP CARD</span></div>
          <div style={{ fontSize: 12, color: "#4a6a9a", marginTop: 4 }}>少年野球スタメン作成アプリ</div>
        </div>
        <div style={{ display: "flex", background: "#091a38", borderRadius: 9, padding: 3, marginBottom: 24 }}>
          {[["login","ログイン"],["signup","新規登録"]].map(([key, label]) => (
            <button key={key} onClick={() => { setMode(key); setError(""); }}
              style={{ flex: 1, padding: "9px", border: "none", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, background: mode === key ? "linear-gradient(135deg,#1e4a9a,#0d2e6a)" : "transparent", color: mode === key ? "#fff" : "#4a6a9a", transition: "all 0.2s" }}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {mode === "signup" && (
            <div>
              <label style={BASE.label}>チーム名</label>
              <input style={BASE.input} placeholder="例：○○スポーツ少年団" value={teamName} onChange={e => setTeamName(e.target.value)} />
            </div>
          )}
          <div>
            <label style={BASE.label}>メールアドレス</label>
            <input style={BASE.input} type="email" placeholder="example@email.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          <div>
            <label style={BASE.label}>パスワード（6文字以上）</label>
            <input style={BASE.input} type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSubmit()} />
          </div>
          {error && <div style={BASE.err}>⚠️ {error}</div>}
          <button onClick={handleSubmit} disabled={loading} style={{ ...BASE.btn, opacity: loading ? 0.6 : 1, marginTop: 4 }}>
            {loading ? "処理中..." : mode === "login" ? "ログイン" : "チームを登録して始める"}
          </button>
        </div>
        {mode === "login" && (
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: "#4a6a9a" }}>
            アカウントをお持ちでない方は
            <span onClick={() => setMode("signup")} style={{ color: "#7eb8ff", cursor: "pointer", marginLeft: 4, fontWeight: 700 }}>新規登録</span>
          </div>
        )}
        {mode === "login" && (
          <div style={{ textAlign: "center", marginTop: 10, fontSize: 12 }}>
            <span onClick={() => { setMode("reset"); setError(""); }} style={{ color: "#5a7aaa", cursor: "pointer" }}>パスワードを忘れた方はこちら</span>
          </div>
        )}
        {mode === "reset" && (
          <ResetPasswordScreen onBack={() => { setMode("login"); setError(""); }} />
        )}
      </div>
    </div>
  );
}

// ─── アカウント設定画面 ────────────────────────────────────────────────────────
function AccountSettings({ user, onClose }) {
  const [section, setSection]         = useState("menu");
  const [currentPw, setCurrentPw]     = useState("");
  const [newValue, setNewValue]       = useState("");
  const [newPwConfirm, setNewPwConfirm] = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [success, setSuccess]         = useState("");

  const reset = () => { setCurrentPw(""); setNewValue(""); setNewPwConfirm(""); setError(""); setSuccess(""); };
  const goSection = (s) => { reset(); setSection(s); };

  const reauth = async () => {
    const credential = EmailAuthProvider.credential(user.email, currentPw);
    await reauthenticateWithCredential(user, credential);
  };

  const handleTeamName = async () => {
    if (!newValue.trim()) { setError("チーム名を入力してください"); return; }
    setLoading(true); setError("");
    try {
      await updateProfile(user, { displayName: newValue.trim() });
      setSuccess("チーム名を変更しました");
      setNewValue("");
    } catch (e) { setError(errMsg(e.code)); }
    setLoading(false);
  };

  const handleEmail = async () => {
    if (!currentPw) { setError("現在のパスワードを入力してください"); return; }
    if (!newValue)  { setError("新しいメールアドレスを入力してください"); return; }
    setLoading(true); setError("");
    try {
      await reauth();
      await updateEmail(user, newValue);
      setSuccess("メールアドレスを変更しました");
      setNewValue(""); setCurrentPw("");
    } catch (e) { setError(errMsg(e.code)); }
    setLoading(false);
  };

  const handlePassword = async () => {
    if (!currentPw)                { setError("現在のパスワードを入力してください"); return; }
    if (!newValue)                 { setError("新しいパスワードを入力してください"); return; }
    if (newValue.length < 6)       { setError("パスワードは6文字以上で設定してください"); return; }
    if (newValue !== newPwConfirm) { setError("新しいパスワードが一致しません"); return; }
    setLoading(true); setError("");
    try {
      await reauth();
      await updatePassword(user, newValue);
      setSuccess("パスワードを変更しました");
      setCurrentPw(""); setNewValue(""); setNewPwConfirm("");
    } catch (e) { setError(errMsg(e.code)); }
    setLoading(false);
  };

  const MENU_ITEMS = [
    { id: "teamName", icon: "🏷", label: "チーム名を変更",         sub: user.displayName || "未設定" },
    { id: "email",    icon: "✉️", label: "メールアドレスを変更",   sub: user.email },
    { id: "password", icon: "🔑", label: "パスワードを変更",       sub: "••••••••" },
  ];

  const BackBtn = ({ to }) => (
    <button onClick={() => goSection(to)} style={{ background: "none", border: "none", color: "#7eb8ff", fontSize: 22, cursor: "pointer", padding: "0 4px 0 0", lineHeight: 1 }}>‹</button>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 500 }} onClick={onClose}>
      <div style={{ background: "#0d1e3a", border: "1px solid #1e3a6a", borderRadius: "20px 20px 0 0", padding: "20px 20px 44px", width: "100%", maxWidth: 480, fontFamily: "'Noto Sans JP', sans-serif" }} onClick={e => e.stopPropagation()}>
        <div style={{ width: 40, height: 4, background: "#2a4a8a", borderRadius: 2, margin: "0 auto 18px" }} />

        {/* メニュー */}
        {section === "menu" && (
          <>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#e8f0fe", marginBottom: 20 }}>⚙️ アカウント設定</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {MENU_ITEMS.map(item => (
                <button key={item.id} onClick={() => goSection(item.id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid #1e3a6a", borderRadius: 12, cursor: "pointer", fontFamily: "inherit", textAlign: "left", WebkitTapHighlightColor: "transparent", width: "100%" }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#e8f0fe" }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: "#4a6a9a", marginTop: 2 }}>{item.sub}</div>
                  </div>
                  <span style={{ color: "#4a6a9a", fontSize: 20 }}>›</span>
                </button>
              ))}
            </div>
            <button onClick={onClose} style={{ width: "100%", marginTop: 14, padding: "13px", background: "transparent", border: "1px solid #1e3a6a", borderRadius: 12, color: "#5a7aaa", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
              閉じる
            </button>
          </>
        )}

        {/* チーム名変更 */}
        {section === "teamName" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <BackBtn to="menu" />
              <div style={{ fontSize: 16, fontWeight: 700, color: "#e8f0fe" }}>🏷 チーム名を変更</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={BASE.label}>現在のチーム名</label>
                <div style={{ padding: "11px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid #1e3a6a", borderRadius: 9, color: "#5a7aaa", fontSize: 14 }}>{user.displayName || "未設定"}</div>
              </div>
              <div>
                <label style={BASE.label}>新しいチーム名</label>
                <input style={BASE.input} placeholder="例：○○スポーツ少年団" value={newValue} onChange={e => setNewValue(e.target.value)} />
              </div>
              {error   && <div style={BASE.err}>⚠️ {error}</div>}
              {success && <div style={BASE.ok}>✓ {success}</div>}
              <button onClick={handleTeamName} disabled={loading} style={{ ...BASE.btn, opacity: loading ? 0.6 : 1 }}>
                {loading ? "変更中..." : "チーム名を変更する"}
              </button>
            </div>
          </>
        )}

        {/* メールアドレス変更 */}
        {section === "email" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <BackBtn to="menu" />
              <div style={{ fontSize: 16, fontWeight: 700, color: "#e8f0fe" }}>✉️ メールアドレスを変更</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={BASE.label}>現在のメールアドレス</label>
                <div style={{ padding: "11px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid #1e3a6a", borderRadius: 9, color: "#5a7aaa", fontSize: 14 }}>{user.email}</div>
              </div>
              <div>
                <label style={BASE.label}>新しいメールアドレス</label>
                <input style={BASE.input} type="email" placeholder="new@example.com" value={newValue} onChange={e => setNewValue(e.target.value)} />
              </div>
              <div>
                <label style={BASE.label}>現在のパスワード（確認用）</label>
                <input style={BASE.input} type="password" placeholder="••••••••" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
              </div>
              {error   && <div style={BASE.err}>⚠️ {error}</div>}
              {success && <div style={BASE.ok}>✓ {success}</div>}
              <button onClick={handleEmail} disabled={loading} style={{ ...BASE.btn, opacity: loading ? 0.6 : 1 }}>
                {loading ? "変更中..." : "メールアドレスを変更する"}
              </button>
            </div>
          </>
        )}

        {/* パスワード変更 */}
        {section === "password" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <BackBtn to="menu" />
              <div style={{ fontSize: 16, fontWeight: 700, color: "#e8f0fe" }}>🔑 パスワードを変更</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={BASE.label}>現在のパスワード</label>
                <input style={BASE.input} type="password" placeholder="••••••••" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
              </div>
              <div>
                <label style={BASE.label}>新しいパスワード（6文字以上）</label>
                <input style={BASE.input} type="password" placeholder="••••••••" value={newValue} onChange={e => setNewValue(e.target.value)} />
              </div>
              <div>
                <label style={BASE.label}>新しいパスワード（確認）</label>
                <input style={BASE.input} type="password" placeholder="••••••••" value={newPwConfirm} onChange={e => setNewPwConfirm(e.target.value)} />
              </div>
              {error   && <div style={BASE.err}>⚠️ {error}</div>}
              {success && <div style={BASE.ok}>✓ {success}</div>}
              <button onClick={handlePassword} disabled={loading} style={{ ...BASE.btn, opacity: loading ? 0.6 : 1 }}>
                {loading ? "変更中..." : "パスワードを変更する"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── App（認証ラッパー） ───────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]               = useState(null);
  const [checking, setChecking]       = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setChecking(false); });
    return unsub;
  }, []);

  if (checking) return (
    <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", color: "#7eb8ff", fontFamily: "sans-serif", fontSize: 16 }}>
      <BaseballIcon size={22} style={{ marginRight: 8 }} />読み込み中...
    </div>
  );

  if (!user) return <AuthScreen />;

  return (
    <>
      <LineupApp
        user={user}
        onLogout={() => signOut(auth)}
        onOpenSettings={() => setShowSettings(true)}
      />
      {showSettings && (
        <AccountSettings user={user} onClose={() => setShowSettings(false)} />
      )}
    </>
  );
}
