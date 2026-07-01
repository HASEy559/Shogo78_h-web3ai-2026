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

// タグフィルタ状態 UI
const tagFilterStatus   = document.getElementById('tag-filter-status');
const tagFilterTextEl   = document.getElementById('tag-filter-text');
const tagFilterClearBtn = document.getElementById('tag-filter-clear');

// ワードマップ画面
const wordmapScreen     = document.getElementById('wordmap-screen');
const wordmapCloud      = document.getElementById('wordmap-cloud');
const wordmapStats      = document.getElementById('wordmap-stats');

// ============================================
// 状態管理
// ============================================
let currentSession  = null;
let currentScreen   = 'create';
let editingId       = null;
let allMemos        = [];
let activeTagFilter = null; // キーワードクリックで絞り込み中のタグ

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
// URL → タイトル自動取得
// ============================================
//
// 【なぜ直接 fetch(url) でなく API を使うのか？】
//   ブラウザから他ドメインへの fetch は CORS ポリシーで原則ブロックされる。
//   <meta> タグを読もうとしても同じ理由でレスポンスが取れない。
//   そのため、サーバー側で URL を取得してメタ情報を返してくれる
//   microlink.io（無料100件/日）を経由する。
//
async function fetchTitleFromUrl(url) {
    // http(s):// で始まる URL のみ対象
    if (!url || !/^https?:\/\//i.test(url)) return null;

    try {
        const endpoint = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;
        // 8秒でタイムアウト（AbortSignal.timeout は Chrome103+/Firefox100+/Safari15.4+ で対応）
        const res = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return null;
        const json = await res.json();
        // status === 'success' かつ title が存在する場合のみ返す
        return (json.status === 'success' && json.data?.title) ? json.data.title : null;
    } catch {
        // ネットワークエラー・タイムアウト・CORS エラーはすべてフォールバック
        return null;
    }
}

// URL フィールドからフォーカスが外れたとき（blur）にタイトルを自動取得する
// ・タイトルが既入力の場合は上書きしない
// ・URL が空の場合はスキップ
sourceUrlInput.addEventListener('blur', async () => {
    const url = sourceUrlInput.value.trim();
    if (!url || titleInput.value.trim()) return; // 空 or タイトル入力済みなら何もしない

    // ── ローディング状態 ──
    titleInput.placeholder = '// SCANNING PAGE TITLE...';
    titleInput.classList.add('fetching');
    sourceUrlInput.classList.add('fetching');

    const title = await fetchTitleFromUrl(url);

    // ── ローディング解除 ──
    titleInput.placeholder = '本・記事・論文・ウェブページのタイトル';
    titleInput.classList.remove('fetching');
    sourceUrlInput.classList.remove('fetching');

    if (title) {
        titleInput.value = title;
        showToast('タイトルを自動取得しました', { icon: '🛸', label: 'PAGE SCAN COMPLETE' });
    } else {
        // 取得失敗：手動入力を促す（フォームはそのままにする）
        showToast('タイトルを自動取得できませんでした', {
            icon: '📡', label: 'SCAN FAILED', duration: 2500
        });
    }
});

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
    createScreen.style.display  = screen === 'create'  ? 'block' : 'none';
    browseScreen.style.display  = screen === 'browse'  ? 'block' : 'none';
    randomScreen.style.display  = screen === 'random'  ? 'block' : 'none';
    wordmapScreen.style.display = screen === 'wordmap' ? 'block' : 'none';

    if (screen === 'create') {
        // 共有データがないときだけフォームリセット
        if (!editingId && !titleInput.value) exitEditMode();
    } else if (screen === 'browse') {
        initBrowseScreen();
    } else if (screen === 'random') {
        initRandomScreen();
    } else if (screen === 'wordmap') {
        initWordmapScreen();
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

    // キーワードクリックによるタグ絞り込み
    // tags は配列なので includes() で完全一致チェック
    if (activeTagFilter) {
        result = result.filter(m => (m.tags || []).includes(activeTagFilter));
    }

    return result;
}

// ============================================
// キーワードクリックで絞り込む
// ============================================
function filterByTag(tag) {
    activeTagFilter = tag;
    if (currentScreen === 'browse') {
        // すでにログ一覧画面にいる場合は再レンダリングのみ（Supabase 再フェッチ不要）
        renderMemoList(applyFilters(allMemos));
    } else {
        // 他の画面からの場合はログ一覧に遷移（switchScreen 内で initBrowseScreen が呼ばれる）
        switchScreen('browse');
    }
}

function renderMemoList(memos) {
    memoList.innerHTML = '';
    resultCount.textContent = `${memos.length} 件`;

    // タグフィルタ状態バッジを表示/非表示
    if (activeTagFilter) {
        tagFilterStatus.style.display = 'flex';
        tagFilterTextEl.textContent   = activeTagFilter;
    } else {
        tagFilterStatus.style.display = 'none';
    }

    if (memos.length === 0) {
        memoList.innerHTML = '<p class="empty-msg">// NO LOGS FOUND //</p>';
        return;
    }
    memos.forEach(log => memoList.appendChild(createLogCardHTML(log, 'browse')));
}

[searchInput, filterProgress, filterDateFrom, filterDateTo].forEach(el => {
    el.addEventListener('input', () => renderMemoList(applyFilters(allMemos)));
});

// 「リセット」ボタン：テキスト・進捗・日付 + タグフィルタをすべてクリア
clearFiltersBtn.addEventListener('click', () => {
    searchInput.value = filterProgress.value = filterDateFrom.value = filterDateTo.value = '';
    activeTagFilter = null;
    renderMemoList(applyFilters(allMemos));
});

// 「✕ 解除」ボタン：タグフィルタのみ解除
tagFilterClearBtn.addEventListener('click', () => {
    activeTagFilter = null;
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
// ワードマップ画面
// ============================================

// 宇宙テーマに合わせたカラーパレット（シアン・パープル・グリーン・アンバー…）
const WORDMAP_COLORS = [
    '#58a6ff', '#bc8cff', '#3fb950', '#d29922',
    '#79c0ff', '#e6edf3', '#ff7b72', '#ffa657',
];

// ── ① キーワードの出現頻度を集計 ──
//   tags は配列なので全ログを走査して Map にカウントする。
//   返り値: [[word, count], ...] の形式で頻度の高い順にソート済み
function calcTagFrequency(memos) {
    const freq = {};
    memos.forEach(m => {
        (m.tags || []).forEach(tag => {
            const t = tag.trim();
            if (t) freq[t] = (freq[t] || 0) + 1;
        });
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]);
}

// ── ② ワードマップを描画 ──
async function initWordmapScreen() {
    wordmapCloud.innerHTML = '<p class="empty-msg">// SCANNING... //</p>';
    wordmapStats.innerHTML = '';

    // allMemos がまだ空の場合のみ Supabase から取得（他タブで既取得済みなら再利用）
    if (allMemos.length === 0) {
        allMemos = await fetchMemos();
    }

    const tagList = calcTagFrequency(allMemos);

    if (tagList.length === 0) {
        wordmapCloud.innerHTML = '<p class="empty-msg">// NO KEYWORDS FOUND //</p>';
        return;
    }

    wordmapCloud.innerHTML = '';

    const maxCount = tagList[0][1];
    const minCount = tagList[tagList.length - 1][1];
    const range    = maxCount - minCount || 1; // 全部同頻度でも 0 除算しない

    // ── ③ ランダム順に並べて視覚的バラエティを出す ──
    //   頻度順のままだと大きいワードが先頭に固まるため、
    //   Flex コンテナ内でシャッフルすることで分散させる
    const shuffled = [...tagList].sort(() => Math.random() - 0.5);

    shuffled.forEach(([word, count], i) => {
        // フォントサイズ: 最小頻度 → 13px、最大頻度 → 52px にリニアスケール
        const size    = 13 + Math.round(((count - minCount) / range) * 39);
        // 透明度: 0.5〜1.0（低頻度ほど薄く）
        const opacity = (0.5 + ((count - minCount) / range) * 0.5).toFixed(2);
        // カラーパレットを循環して使用
        const color   = WORDMAP_COLORS[i % WORDMAP_COLORS.length];

        const span       = document.createElement('span');
        span.className   = 'wm-word';
        span.textContent = word;
        span.title       = `${word}：${count} 件`;
        span.style.cssText = `font-size:${size}px; color:${color}; opacity:${opacity};`;

        // ── ④ クリックで filterByTag に連携 ──
        //   既実装の filterByTag(tag) を呼ぶだけで
        //   activeTagFilter セット → ログ一覧画面へ遷移 → 絞り込み表示
        span.addEventListener('click', () => filterByTag(word));

        wordmapCloud.appendChild(span);
    });

    // ── 統計テキスト ──
    const totalTypes = tagList.length;
    const totalCount = tagList.reduce((s, [, c]) => s + c, 0);
    wordmapStats.innerHTML = `
        <span class="wm-stat">📊 ${totalTypes} 種類のキーワード</span>
        <span class="wm-sep">/</span>
        <span class="wm-stat">総出現 ${totalCount} 回</span>
        <span class="wm-hint">// クリックで絞り込み //</span>
    `;
}

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

    // ── キーワードタグ（クリックで絞り込み） ──
    if (log.tags && log.tags.length > 0) {
        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'card-tags';
        log.tags.forEach(t => {
            const span = document.createElement('span');
            // activeTagFilter と一致するタグはハイライト表示
            const isActive = t === activeTagFilter;
            span.className = `tag-badge tag-badge-clickable${isActive ? ' tag-active' : ''}`;
            span.textContent = t;
            span.title = `「${t}」で絞り込む`;
            span.addEventListener('click', (e) => {
                e.stopPropagation(); // カード内の他のイベントに干渉しない
                filterByTag(t);
            });
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
