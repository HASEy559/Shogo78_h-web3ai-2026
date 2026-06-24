// ============================================
// Supabase 設定
// ============================================
const SUPABASE_URL = 'https://zmbnkfpubmnpkwbmojkg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptYm5rZnB1Ym1ucGt3Ym1vamtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTc2MTgsImV4cCI6MjA5NzI3MzYxOH0.jzd3pq74jTdmTqzd-QcO2jylO3IhHuvhxQf1b2N0xzY';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// 進捗設定
// ============================================
const PROGRESS_CONFIG = {
    title_only: { label: 'タイトルのみ', icon: '📡' },
    toc:        { label: '目次まで',     icon: '🔭' },
    overview:   { label: 'ざっくり内容', icon: '🗺️' },
    skimmed:    { label: '一通り目を通した', icon: '👁️' },
    completed:  { label: '完全読了',     icon: '✅' },
};

// ============================================
// DOM 参照
// ============================================
const loginScreen       = document.getElementById('login-screen');
const authEmail         = document.getElementById('auth-email');
const authPassword      = document.getElementById('auth-password');
const authLoginBtn      = document.getElementById('auth-login-btn');
const authSignupBtn     = document.getElementById('auth-signup-btn');
const authErrorMsg      = document.getElementById('auth-error-msg');

const appScreen         = document.getElementById('app-screen');
const displayEmail      = document.getElementById('display-email');
const logoutButton      = document.getElementById('logout-button');

const navTabs           = document.querySelectorAll('.nav-tab');
const createScreen      = document.getElementById('create-screen');
const browseScreen      = document.getElementById('browse-screen');
const randomScreen      = document.getElementById('random-screen');
const createLabel       = document.getElementById('create-screen-label');

const memoForm          = document.getElementById('memo-form');
const titleInput        = document.getElementById('book-title');
const sourceUrlInput    = document.getElementById('source-url');
const authorInput       = document.getElementById('book-author');
const progressInput     = document.getElementById('book-progress');
const checkedAtInput    = document.getElementById('checked-at');
const memoInput         = document.getElementById('book-memo');
const insightInput      = document.getElementById('book-insight');
const tagsInput         = document.getElementById('book-tags');
const submitButton      = document.getElementById('submit-button');
const cancelEditButton  = document.getElementById('cancel-edit-button');

const searchInput       = document.getElementById('search-input');
const filterProgress    = document.getElementById('filter-progress');
const filterDateFrom    = document.getElementById('filter-date-from');
const filterDateTo      = document.getElementById('filter-date-to');
const clearFiltersBtn   = document.getElementById('clear-filters-btn');
const resultCount       = document.getElementById('search-result-count');
const memoList          = document.getElementById('memo-list');

const rescanBtn         = document.getElementById('rescan-btn');
const randomDisplay     = document.getElementById('random-display');
const toastContainer    = document.querySelector('.toast-container');

// ============================================
// 状態管理
// ============================================
let currentSession  = null;
let currentScreen   = 'create';
let editingId       = null;
let allMemos        = [];

// ============================================
// トースト通知（宇宙船ターミナル風）
// ・duration ms 後に自動消去
// ・キー操作 or 画面タップでも即消去
// ============================================
function showToast(message, { icon = '📡', label = 'SYSTEM MESSAGE', duration = 3000 } = {}) {
    // 既存のトーストを消す
    toastContainer.querySelectorAll('.toast').forEach(t => dismissToast(t, true));

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div class="toast-body">
            <span class="toast-icon">${icon}</span>
            <div>
                <span class="toast-label">${label}</span>
                <span class="toast-message">${message}</span>
            </div>
        </div>
        <div class="toast-timebar" style="animation-duration:${duration}ms"></div>
    `;
    toastContainer.appendChild(toast);

    // アニメーション開始（2フレーム待って show クラスを付与）
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

    // 自動消去タイマー
    const timer = setTimeout(() => dismissToast(toast), duration);

    // キー操作 or タップで即消去
    const onInteract = () => { clearTimeout(timer); dismissToast(toast); };
    setTimeout(() => {
        document.addEventListener('keydown',     onInteract, { once: true });
        document.addEventListener('pointerdown', onInteract, { once: true });
    }, 400); // 誤操作防止のため少し遅延

    toast._dismiss = onInteract;
}

function dismissToast(toast, immediate = false) {
    if (!toast || !toast.isConnected) return;
    if (toast._dismiss) {
        document.removeEventListener('keydown',     toast._dismiss);
        document.removeEventListener('pointerdown', toast._dismiss);
    }
    if (immediate) {
        toast.remove();
    } else {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 280);
    }
}

// ============================================
// Web Share Target の受信処理
// スマホ/PCブラウザの「共有」からアプリに飛んできた際に
// URL パラメータ（title, text, url）をフォームに自動セット
// ============================================
function handleSharedContent() {
    const params = new URLSearchParams(window.location.search);
    const sharedTitle = params.get('title') || '';
    const sharedText  = params.get('text')  || '';
    const sharedUrl   = params.get('url')   || '';

    if (!sharedTitle && !sharedText && !sharedUrl) return;

    // フォームを自動入力
    titleInput.value     = sharedTitle;
    sourceUrlInput.value = sharedUrl;
    memoInput.value      = sharedText;

    // URLパラメータをブラウザ履歴から除去（再読込での再実行を防ぐ）
    window.history.replaceState({}, '', window.location.pathname);

    // 作成画面に切り替えてトースト表示
    switchScreen('create');
    showToast('フォームに自動入力しました', { icon: '🛸', label: 'INCOMING SIGNAL' });
}

// ============================================
// Supabase Auth
// ============================================
supabaseClient.auth.onAuthStateChange((event, session) => {
    currentSession = session;
    if (session) {
        loginScreen.style.display = 'none';
        appScreen.style.display   = 'block';
        displayEmail.textContent  = session.user.email;

        // ログイン後に共有コンテンツを確認
        handleSharedContent();
        switchScreen('create');
    } else {
        loginScreen.style.display = 'flex';
        appScreen.style.display   = 'none';
    }
});

authLoginBtn.addEventListener('click', async () => {
    authErrorMsg.style.display = 'none';
    const { error } = await supabaseClient.auth.signInWithPassword({
        email:    authEmail.value,
        password: authPassword.value,
    });
    if (error) {
        authErrorMsg.textContent   = error.message;
        authErrorMsg.style.display = 'block';
    }
});

authSignupBtn.addEventListener('click', async () => {
    authErrorMsg.style.display = 'none';
    const { error } = await supabaseClient.auth.signUp({
        email:    authEmail.value,
        password: authPassword.value,
    });
    if (error) {
        authErrorMsg.textContent   = error.message;
        authErrorMsg.style.display = 'block';
    } else {
        showToast('登録確認メールをご確認ください', { icon: '📨', label: 'REGISTRATION' });
    }
});

logoutButton.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
});

// ============================================
// ナビゲーション
// ============================================
navTabs.forEach(tab => {
    tab.addEventListener('click', () => switchScreen(tab.dataset.screen));
});

function switchScreen(screen) {
    currentScreen = screen;
    navTabs.forEach(t => t.classList.toggle('active', t.dataset.screen === screen));
    createScreen.style.display = screen === 'create' ? 'block' : 'none';
    browseScreen.style.display = screen === 'browse' ? 'block' : 'none';
    randomScreen.style.display = screen === 'random' ? 'block' : 'none';

    if (screen === 'create') {
        // 共有データがないときだけフォームリセット
        if (!editingId && !titleInput.value) exitEditMode();
    } else if (screen === 'browse') {
        initBrowseScreen();
    } else if (screen === 'random') {
        initRandomScreen();
    }
}

// ============================================
// Supabase DB からメモを取得
// ============================================
async function fetchMemos() {
    const { data, error } = await supabaseClient
        .from('memos')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return data;
}

// ============================================
// 新規ログ作成・編集フォーム
// ============================================
memoForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const tags = tagsInput.value
        .split(',').map(t => t.trim()).filter(t => t !== '');

    const payload = {
        title:      titleInput.value.trim(),
        source_url: sourceUrlInput.value.trim(),
        author:     authorInput.value.trim(),
        progress:   progressInput.value,
        checked_at: checkedAtInput.value || null,
        memo_text:  memoInput.value.trim(),
        insight:    insightInput.value.trim(),
        tags,
    };

    if (editingId) {
        const { error } = await supabaseClient
            .from('memos').update(payload).eq('id', editingId);
        if (error) {
            showToast('更新に失敗しました: ' + error.message, { icon: '⚠️', label: 'ERROR' });
            return;
        }
        showToast('ログを更新しました', { icon: '✅', label: 'UPDATE COMPLETE' });
        exitEditMode();
    } else {
        const { error } = await supabaseClient
            .from('memos').insert({ ...payload, user_id: currentSession.user.id });
        if (error) {
            showToast('保存に失敗しました: ' + error.message, { icon: '⚠️', label: 'ERROR' });
            return;
        }
        showToast('ログを記録しました', { icon: '📡', label: 'TRANSMISSION COMPLETE' });
        memoForm.reset();
        checkedAtInput.value = today();
    }
});

cancelEditButton.addEventListener('click', exitEditMode);

function exitEditMode() {
    editingId = null;
    createLabel.textContent        = '新規ログ記録';
    submitButton.textContent       = '📡 ログを記録する';
    cancelEditButton.style.display = 'none';
    memoForm.reset();
    checkedAtInput.value = today();
}

function today() {
    return new Date().toISOString().slice(0, 10);
}

// ============================================
// ログ一覧・検索画面
// ============================================
async function initBrowseScreen() {
    allMemos = await fetchMemos();
    renderMemoList(applyFilters(allMemos));
}

function applyFilters(memos) {
    let result = memos;
    const q  = (searchInput.value || '').trim().toLowerCase();
    const pf = filterProgress.value;
    const df = filterDateFrom.value;
    const dt = filterDateTo.value;

    if (q) {
        result = result.filter(m =>
            [m.title, m.author, m.memo_text, m.insight, m.source_url, ...(m.tags || [])]
                .join(' ').toLowerCase().includes(q)
        );
    }
    if (pf) result = result.filter(m => m.progress === pf);
    if (df) result = result.filter(m => m.created_at >= df);
    if (dt) result = result.filter(m => m.created_at <= dt + 'T23:59:59');
    return result;
}

function renderMemoList(memos) {
    memoList.innerHTML = '';
    resultCount.textContent = `${memos.length} 件`;
    if (memos.length === 0) {
        memoList.innerHTML = '<p class="empty-msg">// NO LOGS FOUND //</p>';
        return;
    }
    memos.forEach(log => memoList.appendChild(createLogCardHTML(log, 'browse')));
}

[searchInput, filterProgress, filterDateFrom, filterDateTo].forEach(el => {
    el.addEventListener('input', () => renderMemoList(applyFilters(allMemos)));
});

clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = filterProgress.value = filterDateFrom.value = filterDateTo.value = '';
    renderMemoList(applyFilters(allMemos));
});

// ============================================
// ランダム探索画面
// ============================================
async function initRandomScreen() {
    await displayRandomMemos();
}

async function displayRandomMemos() {
    randomDisplay.innerHTML = '<p class="empty-msg">// SCANNING... //</p>';
    const memos = await fetchMemos();
    if (memos.length === 0) {
        randomDisplay.innerHTML = '<p class="empty-msg">// NO LOGS FOUND //</p>';
        return;
    }
    const sample = [...memos].sort(() => Math.random() - 0.5).slice(0, 4);
    randomDisplay.innerHTML = '';
    sample.forEach(log => randomDisplay.appendChild(createLogCardHTML(log, 'random')));
}

rescanBtn.addEventListener('click', displayRandomMemos);

// ============================================
// ログカードの DOM 生成
// ============================================
function createLogCardHTML(log, mode) {
    const el = document.createElement(mode === 'browse' ? 'li' : 'div');
    el.className = 'log-card';
    el.dataset.progress = log.progress || 'title_only';

    const progress = log.progress || 'title_only';
    const pc       = PROGRESS_CONFIG[progress] || PROGRESS_CONFIG.title_only;
    const reviewed = (log.reviewed_dates || []).length;
    const logDate  = log.created_at
        ? new Date(log.created_at).toLocaleDateString('ja-JP') : '';

    // ── ヘッダー ──
    const header = document.createElement('div');
    header.className = 'card-header';

    const metaLeft = document.createElement('div');
    metaLeft.className = 'card-meta-left';

    const badge = document.createElement('span');
    badge.className = `progress-badge badge-${progress}`;
    badge.textContent = `${pc.icon} ${pc.label}`;

    const dateSpan = document.createElement('span');
    dateSpan.className = 'card-date';
    dateSpan.textContent = logDate;

    metaLeft.append(badge, dateSpan);

    const reviewSpan = document.createElement('span');
    reviewSpan.className = 'card-review-count';
    reviewSpan.textContent = reviewed > 0 ? `🚩 ${reviewed}` : '';

    header.append(metaLeft, reviewSpan);
    el.appendChild(header);

    // ── タイトル ──
    const title = document.createElement('div');
    title.className = 'card-title';
    title.textContent = log.title;
    el.appendChild(title);

    // ── 著者 ──
    if (log.author) {
        const author = document.createElement('div');
        author.className = 'card-author';
        author.textContent = `✍️ ${log.author}`;
        el.appendChild(author);
    }

    // ── ソースリンク（外部リンク） ──
    if (log.source_url) {
        const link = document.createElement('a');
        link.className = 'card-source-link';
        link.href      = log.source_url;
        link.target    = '_blank';
        link.rel       = 'noopener noreferrer';
        const displayUrl = log.source_url.length > 60
            ? log.source_url.slice(0, 60) + '…' : log.source_url;
        link.textContent = `🔗 ${displayUrl}`;
        el.appendChild(link);
    }

    // ── キーワードタグ ──
    if (log.tags && log.tags.length > 0) {
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'card-tags';
        log.tags.forEach(t => {
            const span = document.createElement('span');
            span.className = 'tag-badge';
            span.textContent = t;
            tagsDiv.appendChild(span);
        });
        el.appendChild(tagsDiv);
    }

    // ── なぜ気になったか ──
    if (log.memo_text) {
        const memo = document.createElement('div');
        memo.className = 'card-memo';
        memo.textContent = log.memo_text;
        el.appendChild(memo);
    }

    // ── 気づき ──
    if (log.insight) {
        const insight = document.createElement('div');
        insight.className = 'card-insight';
        insight.textContent = `💡 ${log.insight}`;
        el.appendChild(insight);
    }

    // ── 確認した日 ──
    if (log.checked_at) {
        const checkedDiv = document.createElement('div');
        checkedDiv.className = 'card-checked-at';
        checkedDiv.textContent =
            `📅 確認日: ${new Date(log.checked_at).toLocaleDateString('ja-JP')}`;
        el.appendChild(checkedDiv);
    }

    // ── アクションボタン ──
    const actions = document.createElement('div');
    actions.className = 'card-actions';

    // 🚩 再確認ボタン
    const reviewBtn = document.createElement('button');
    reviewBtn.className = 'btn-action review';
    reviewBtn.textContent = '🚩 再確認';
    reviewBtn.addEventListener('click', async () => {
        reviewBtn.classList.add('flagged');
        setTimeout(() => reviewBtn.classList.remove('flagged'), 400);
        const updatedDates = [...(log.reviewed_dates || []), new Date().toISOString()];
        const { error } = await supabaseClient
            .from('memos').update({ reviewed_dates: updatedDates }).eq('id', log.id);
        if (!error) {
            log.reviewed_dates = updatedDates;
            reviewSpan.textContent = `🚩 ${updatedDates.length}`;
        }
    });
    actions.appendChild(reviewBtn);

    if (mode === 'browse') {
        // ✏️ 編集ボタン
        const editBtn = document.createElement('button');
        editBtn.className = 'btn-action edit';
        editBtn.textContent = '✏️ 編集';
        editBtn.addEventListener('click', () => {
            titleInput.value     = log.title      || '';
            sourceUrlInput.value = log.source_url || '';
            authorInput.value    = log.author     || '';
            progressInput.value  = log.progress   || 'title_only';
            checkedAtInput.value = log.checked_at ? log.checked_at.slice(0, 10) : '';
            memoInput.value      = log.memo_text  || '';
            insightInput.value   = log.insight    || '';
            tagsInput.value      = (log.tags || []).join(', ');
            editingId = log.id;
            createLabel.textContent        = 'ログを編集中';
            submitButton.textContent       = '✅ 更新する';
            cancelEditButton.style.display = 'inline-flex';
            switchScreen('create');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        actions.appendChild(editBtn);

        // 🗑️ 削除ボタン
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn-action delete';
        deleteBtn.textContent = '🗑️ 削除';
        deleteBtn.addEventListener('click', async () => {
            if (!confirm(`「${log.title}」を削除しますか？`)) return;
            const { error } = await supabaseClient
                .from('memos').delete().eq('id', log.id);
            if (error) {
                showToast('削除に失敗しました', { icon: '⚠️', label: 'ERROR' });
            } else {
                el.remove();
                allMemos = allMemos.filter(m => m.id !== log.id);
                resultCount.textContent = `${applyFilters(allMemos).length} 件`;
                showToast('ログを削除しました', { icon: '🗑️', label: 'DELETED' });
            }
        });
        actions.appendChild(deleteBtn);
    }

    el.appendChild(actions);
    return el;
}

// ============================================
// 星フィールド生成（宇宙空間背景）
// ============================================
function createStarField() {
    const field = document.createElement('div');
    field.className = 'star-field';
    field.setAttribute('aria-hidden', 'true');

    const TOTAL = 220;
    let html = '';

    for (let i = 0; i < TOTAL; i++) {
        const x    = (Math.random() * 100).toFixed(2);
        const y    = (Math.random() * 100).toFixed(2);
        // 星のサイズ分布：小さい星が多く、大きい星は少ない
        const rand = Math.random();
        const size = rand < 0.65 ? 1 : rand < 0.90 ? 2 : 3;
        const op   = (0.25 + Math.random() * 0.75).toFixed(2);
        const dur  = (2.5 + Math.random() * 5).toFixed(1);
        const del  = (Math.random() * 6).toFixed(1);
        // サイズ2以上の一部の星にグローを付ける
        const bright = size >= 2 && Math.random() > 0.5;

        html += `<div class="star${bright ? ' bright' : ''}" style="` +
            `left:${x}%;top:${y}%;` +
            `width:${size}px;height:${size}px;` +
            `--star-op:${op};` +
            `animation-duration:${dur}s;` +
            `animation-delay:-${del}s` +
        `"></div>`;
    }

    field.innerHTML = html;
    document.body.prepend(field);
}

// ============================================
// 初期化：確認日のデフォルトを今日に設定 & 星フィールド生成
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    if (checkedAtInput) checkedAtInput.value = today();
    createStarField();
});
