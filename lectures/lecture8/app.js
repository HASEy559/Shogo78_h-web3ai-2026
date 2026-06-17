// ---------------------------------------------
// Supabase 設定 (ご自身のプロジェクト情報に書き換えてください)
// ---------------------------------------------
const SUPABASE_URL = 'https://zmbnkfpubmnpkwbmojkg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xlP_EguyPRninpAfhkuEOw__Bh185l5';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 画面要素の取得 ---
// ログイン画面
const loginScreen = document.getElementById('login-screen');
const authForm = document.getElementById('auth-form');
const authEmail = document.getElementById('auth-email');
const authPassword = document.getElementById('auth-password');
const authLoginBtn = document.getElementById('auth-login-btn');
const authSignupBtn = document.getElementById('auth-signup-btn');
const authErrorMsg = document.getElementById('auth-error-msg');

// メインアプリコンテナ
const appScreen = document.getElementById('app-screen');
const displayEmail = document.getElementById('display-email');
const logoutButton = document.getElementById('logout-button');
const appHeaderTitle = document.getElementById('app-header-title');

// 各スクリーン
const createScreen = document.getElementById('create-screen');
const reviewScreen = document.getElementById('review-screen');

// ナビゲーション
const navFloatingBtn = document.getElementById('nav-floating-btn');

// 作成画面用
const memoForm = document.getElementById('memo-form');
const titleInput = document.getElementById('book-title');
const authorInput = document.getElementById('book-author');
const memoInput = document.getElementById('book-memo');
const insightInput = document.getElementById('book-insight');
const tagsInput = document.getElementById('book-tags');
const submitButton = document.getElementById('submit-button');
const cancelEditButton = document.getElementById('cancel-edit-button');

// 振り返り画面用
const themeSuggestions = document.getElementById('theme-suggestions');
const randomMemoDisplay = document.getElementById('random-memo-display');
const memoList = document.getElementById('memo-list');
const clearThemeFilterBtn = document.getElementById('clear-theme-filter');
const pastMemosTitle = document.getElementById('past-memos-title');

// --- 状態管理 ---
let currentSession = null;
let currentScreen = 'create'; // 'create' or 'review'
let editingId = null;
let currentThemeFilter = null;

// ストレージキー（ユーザーごとにデータを分ける）
function getStorageKey() {
    if (!currentSession) return 'reading-memos-anonymous';
    return `reading-memos-${currentSession.user.id}`;
}

// ---------------------------------------------
// データマイグレーション処理
// ---------------------------------------------
function migrateData() {
    let memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    let updated = false;
    memos = memos.map(m => {
        let changed = false;
        // ReviewedDatesへの移行
        if (!m.ReviewedDates) {
            m.ReviewedDates = [];
            // 旧rereadCountが存在すれば、その回数分ダミーの日付を入れる（または無視でも可）
            const count = m.rereadCount || m.likes || 0;
            for(let i=0; i<count; i++) {
                m.ReviewedDates.push(new Date(m.createdAt || Date.now()).toISOString());
            }
            changed = true;
        }
        if (!m.createdAt) { m.createdAt = new Date(m.id).toISOString(); changed = true; }
        if (!m.author) { m.author = ""; changed = true; }
        if (!m.insight) { m.insight = ""; changed = true; }
        if (!m.tags) { m.tags = []; changed = true; }
        
        if (changed) updated = true;
        return m;
    });
    if (updated) {
        localStorage.setItem(getStorageKey(), JSON.stringify(memos));
    }
}

// ---------------------------------------------
// Supabase Auth
