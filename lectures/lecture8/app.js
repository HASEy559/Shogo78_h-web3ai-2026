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
// --- ここを修正：clickではなくformのsubmitで制御する、またはpreventDefaultを入れる ---

authLoginBtn.addEventListener('click', async (e) => {
    e.preventDefault(); // ページのリロードを防止！
    authErrorMsg.style.display = 'none';
    const email = authEmail.value;
    const password = authPassword.value;
    
    if (!email || !password) return; // 空判定

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        authErrorMsg.textContent = error.message;
        authErrorMsg.style.display = 'block';
    }
});

authSignupBtn.addEventListener('click', async (e) => {
    e.preventDefault(); // ページのリロードを防止！
    authErrorMsg.style.display = 'none';
    const email = authEmail.value;
    const password = authPassword.value;

    if (!email || !password) return; // 空判定

    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
        authErrorMsg.textContent = error.message;
        authErrorMsg.style.display = 'block';
    } else {
        alert('登録確認メールを確認してください（※設定をオフにしている場合はそのままログイン可能です）');
    }
});

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
// Supabase Auth 処理
// ---------------------------------------------
supabase.auth.onAuthStateChange((event, session) => {
    currentSession = session;
    if (session) {
        // ログイン成功
        loginScreen.style.display = 'none';
        appScreen.style.display = 'block';
        navFloatingBtn.style.display = 'flex';
        displayEmail.textContent = session.user.email;
        migrateData();
        switchScreen('create');
    } else {
        // ログアウト状態
        loginScreen.style.display = 'block';
        appScreen.style.display = 'none';
        navFloatingBtn.style.display = 'none';
    }
});

authLoginBtn.addEventListener('click', async () => {
    authErrorMsg.style.display = 'none';
    const email = authEmail.value;
    const password = authPassword.value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        authErrorMsg.textContent = error.message;
        authErrorMsg.style.display = 'block';
    }
});

authSignupBtn.addEventListener('click', async () => {
    authErrorMsg.style.display = 'none';
    const email = authEmail.value;
    const password = authPassword.value;
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
        authErrorMsg.textContent = error.message;
        authErrorMsg.style.display = 'block';
    } else {
        alert('登録確認メールを確認してください（※Supabaseの設定により自動ログインされる場合もあります）');
    }
});

logoutButton.addEventListener('click', async () => {
    await supabase.auth.signOut();
});

// ---------------------------------------------
// 画面切り替えルーター (ナビゲーション)
// ---------------------------------------------
navFloatingBtn.addEventListener('click', () => {
    if (currentScreen === 'create') {
        switchScreen('review');
    } else {
        switchScreen('create');
    }
});

function switchScreen(screen) {
    currentScreen = screen;
    createScreen.style.display = 'none';
    reviewScreen.style.display = 'none';
    exitEditMode();

    if (screen === 'create') {
        appHeaderTitle.textContent = 'メモを作成';
        createScreen.style.display = 'block';
        navFloatingBtn.innerHTML = '<span>🔍 振り返る</span>';
    } else if (screen === 'review') {
        appHeaderTitle.textContent = '過去のメモを振り返る';
        reviewScreen.style.display = 'block';
        navFloatingBtn.innerHTML = '<span>📝 新規作成</span>';
        initReviewScreen();
    }
}

// ---------------------------------------------
// メモ作成画面の機能 (CRUD)
// ---------------------------------------------
memoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    
    const title = titleInput.value.trim();
    const author = authorInput.value.trim();
    const text = memoInput.value.trim();
    const insight = insightInput.value.trim();
    const tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t !== "");

    if (editingId) {
        // 編集
        const idx = memos.findIndex(m => m.id === editingId);
        if (idx > -1) {
            memos[idx].title = title;
            memos[idx].author = author;
            memos[idx].memoText = text;
            memos[idx].text = text; // 互換用
            memos[idx].insight = insight;
            memos[idx].tags = tags;
        }
        exitEditMode();
    } else {
        // 新規作成
        const newMemo = {
            id: Date.now(),
            title: title,
            author: author,
            memoText: text,
            insight: insight,
            tags: tags,
            createdAt: new Date().toISOString(),
            ReviewedDates: []
        };
        memos.push(newMemo);
        memoForm.reset();
    }
    
    localStorage.setItem(getStorageKey(), JSON.stringify(memos));
    alert('メモを保存しました');
    if (currentScreen === 'create') {
        // 必要なら何かリアクション
    }
});

cancelEditButton.addEventListener('click', exitEditMode);

function exitEditMode() {
    editingId = null;
    submitButton.textContent = '保存する';
    cancelEditButton.style.display = 'none';
    memoForm.reset();
}

// ---------------------------------------------
// 振り返り画面の機能 (ランダム・テーマ・一覧)
// ---------------------------------------------
function initReviewScreen() {
    currentThemeFilter = null;
    generateThemeSuggestions();
    displayRandomMemo();
    refreshPastMemosList();
}

function displayRandomMemo() {
    const memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    randomMemoDisplay.innerHTML = '';
    
    if (memos.length === 0) {
        randomMemoDisplay.innerHTML = '<p class="empty-message">保存されたメモがありません。</p>';
        return;
    }
    
    const randomMemo = memos[Math.floor(Math.random() * memos.length)];
    const card = createMemoCardHTML(randomMemo, false);
    randomMemoDisplay.appendChild(card);
}

// テーマの抽出とボタン生成
function generateThemeSuggestions() {
    const memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    const tagCounts = {};
    
    memos.forEach(m => {
        if (m.tags) {
            m.tags.forEach(t => {
                tagCounts[t] = (tagCounts[t] || 0) + 1;
            });
        }
    });

    // 出現回数順にソートして上位を表示
    const sortedTags = Object.keys(tagCounts).sort((a, b) => tagCounts[b] - tagCounts[a]).slice(0, 5);
    
    themeSuggestions.innerHTML = '';
    if (sortedTags.length === 0) {
        themeSuggestions.innerHTML = '<span style="color:#888; font-size:0.9rem;">まだテーマ（タグ）がありません。</span>';
        return;
    }

    sortedTags.forEach(tag => {
        const btn = document.createElement('button');
        btn.className = 'theme-btn';
        btn.textContent = `${tag} (${tagCounts[tag]})`;
        btn.addEventListener('click', () => {
            // アクティブ状態の切り替え
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            currentThemeFilter = tag;
            pastMemosTitle.textContent = `過去のメモ一覧: ${tag}`;
            clearThemeFilterBtn.style.display = 'inline-block';
            refreshPastMemosList();
        });
        themeSuggestions.appendChild(btn);
    });
}

clearThemeFilterBtn.addEventListener('click', () => {
    currentThemeFilter = null;
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    pastMemosTitle.textContent = `過去のメモ一覧`;
    clearThemeFilterBtn.style.display = 'none';
    refreshPastMemosList();
});

function refreshPastMemosList() {
    let memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    memoList.innerHTML = '';

    // テーマフィルタリング
    if (currentThemeFilter) {
        memos = memos.filter(m => m.tags && m.tags.includes(currentThemeFilter));
    }

    // 新しい順にソート
    memos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    if (memos.length === 0) {
        memoList.innerHTML = '<li style="text-align:center; color:#888;">メモが見つかりません。</li>';
        return;
    }

    memos.forEach(memo => {
        const li = createMemoCardHTML(memo, true); // true=一覧モード(編集/削除あり)
        memoList.appendChild(li);
    });
}

// ---------------------------------------------
// 共通：メモカードのDOM生成
// ---------------------------------------------
function createMemoCardHTML(memo, isListMode) {
    const el = document.createElement(isListMode ? 'li' : 'div');
    if (!isListMode) el.className = 'card';

    // メタ情報 (右上の日付とReview回数)
    const metaDiv = document.createElement('div');
    metaDiv.className = 'memo-meta';
    
    const dateDiv = document.createElement('div');
    dateDiv.className = 'memo-date';
    dateDiv.textContent = new Date(memo.createdAt).toLocaleDateString('ja-JP');
    
    const reviewCount = memo.ReviewedDates ? memo.ReviewedDates.length : 0;
    const reviewMetaDiv = document.createElement('div');
    reviewMetaDiv.style.color = 'var(--color-main)';
    reviewMetaDiv.style.fontWeight = '500';
    reviewMetaDiv.style.textAlign = 'right';
    reviewMetaDiv.innerHTML = `🚩 ${reviewCount} Reviews`;
    
    metaDiv.appendChild(dateDiv);
    metaDiv.appendChild(reviewMetaDiv);

    // タイトル
    const titleDiv = document.createElement('div');
    titleDiv.className = 'memo-title';
    titleDiv.textContent = memo.title;

    // 著者
    const authorDiv = document.createElement('div');
    if (memo.author) {
        authorDiv.className = 'memo-author';
        authorDiv.textContent = `著者: ${memo.author}`;
    }

    // タグ
    const tagsDiv = document.createElement('div');
    if (memo.tags && memo.tags.length > 0) {
        tagsDiv.className = 'memo-tags';
        memo.tags.forEach(t => {
            const span = document.createElement('span');
            span.className = 'tag-badge';
            span.textContent = t;
            tagsDiv.appendChild(span);
        });
    }

    // 本文
    const textDiv = document.createElement('div');
    textDiv.className = 'memo-text';
    textDiv.textContent = memo.memoText || memo.text;

    // 気づき
    const insightDiv = document.createElement('div');
    if (memo.insight) {
        insightDiv.className = 'memo-insight';
        insightDiv.textContent = `💡 気づき\n${memo.insight}`;
    }

    // 要素の追加
    el.appendChild(metaDiv);
    el.appendChild(titleDiv);
    if (memo.author) el.appendChild(authorDiv);
    if (memo.tags && memo.tags.length > 0) el.appendChild(tagsDiv);
    el.appendChild(textDiv);
    if (memo.insight) el.appendChild(insightDiv);

    // 【詳細表示】ReviewedDates の表示ロジック
    if (memo.ReviewedDates && memo.ReviewedDates.length > 0) {
        const detailsContainer = document.createElement('div');
        
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'details-toggle-btn';
        toggleBtn.textContent = '▼ 振り返り履歴を表示';
        
        const historyDiv = document.createElement('div');
        historyDiv.className = 'review-history-section';
        historyDiv.style.display = 'none';
        
        const ul = document.createElement('ul');
        memo.ReviewedDates.forEach(dateStr => {
            const li = document.createElement('li');
            li.textContent = new Date(dateStr).toLocaleString('ja-JP');
            ul.appendChild(li);
        });
        historyDiv.appendChild(ul);

        toggleBtn.addEventListener('click', () => {
            if (historyDiv.style.display === 'none') {
                historyDiv.style.display = 'block';
                toggleBtn.textContent = '▲ 履歴を隠す';
            } else {
                historyDiv.style.display = 'none';
                toggleBtn.textContent = '▼ 振り返り履歴を表示';
            }
        });

        detailsContainer.appendChild(toggleBtn);
        detailsContainer.appendChild(historyDiv);
        el.appendChild(detailsContainer);
    }

    // フッター / アクションの設定
    if (isListMode) {
        // 一覧画面用（編集・削除 ＋ Reviewボタン）
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'memo-actions';

        const reviewFlagBtn = createReviewFlagBtn(memo, reviewMetaDiv);
        
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn edit';
        editBtn.textContent = '編集';
        editBtn.addEventListener('click', () => {
            switchScreen('create'); // 編集時は作成画面へ
            titleInput.value = memo.title;
            authorInput.value = memo.author || "";
            memoInput.value = memo.memoText || memo.text || "";
            insightInput.value = memo.insight || "";
            tagsInput.value = memo.tags ? memo.tags.join(', ') : "";
            editingId = memo.id;
            
            submitButton.textContent = '更新する';
            cancelEditButton.style.display = 'block';
            memoForm.scrollIntoView({ behavior: 'smooth' });
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete';
        deleteBtn.textContent = '削除';
        deleteBtn.addEventListener('click', () => {
            if (confirm(`「${memo.title}」を削除してもよろしいですか？`)) {
                let currentMemos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
                currentMemos = currentMemos.filter(m => m.id !== memo.id);
                localStorage.setItem(getStorageKey(), JSON.stringify(currentMemos));
                refreshPastMemosList();
            }
        });

        actionsDiv.appendChild(reviewFlagBtn);
        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
        el.appendChild(actionsDiv);

    } else {
        // ランダム振り返りなどのカード表示用（Reviewボタンのみ）
        const footerDiv = document.createElement('div');
        footerDiv.className = 'card-footer';
        
        const reviewFlagBtn = createReviewFlagBtn(memo, reviewMetaDiv);
        footerDiv.appendChild(reviewFlagBtn);
        el.appendChild(footerDiv);
    }

    return el;
}

function createReviewFlagBtn(memo, reviewMetaDiv) {
    const btn = document.createElement('button');
    btn.className = 'review-flag-btn';
    btn.innerHTML = `🚩 Review`;
    
    btn.addEventListener('click', () => {
        btn.classList.add('flagged');
        setTimeout(() => btn.classList.remove('flagged'), 300);

        let currentMemos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
        const idx = currentMemos.findIndex(m => m.id === memo.id);
        if (idx > -1) {
            if (!currentMemos[idx].ReviewedDates) currentMemos[idx].ReviewedDates = [];
            currentMemos[idx].ReviewedDates.push(new Date().toISOString());
            
            localStorage.setItem(getStorageKey(), JSON.stringify(currentMemos));
            
            // 表示の即時更新
            memo.ReviewedDates = currentMemos[idx].ReviewedDates;
            reviewMetaDiv.innerHTML = `🚩 ${memo.ReviewedDates.length} Reviews`;
        }
    });
    return btn;
}
