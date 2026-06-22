// ---------------------------------------------
// Supabase 設定 (ご自身のプロジェクト情報に書き換えてください)
// ---------------------------------------------
const SUPABASE_URL = 'https://zmbnkfpubmnpkwbmojkg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InptYm5rZnB1Ym1ucGt3Ym1vamtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2OTc2MTgsImV4cCI6MjA5NzI3MzYxOH0.jzd3pq74jTdmTqzd-QcO2jylO3IhHuvhxQf1b2N0xzY';
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

// [修正] getStorageKey() を削除
// Supabase の Row Level Security (RLS) によってユーザーごとのデータ分離を行うため、
// localStorage のキーでユーザーを区別する必要がなくなりました。
//
// 旧コード:
// function getStorageKey() {
//     if (!currentSession) return 'reading-memos-anonymous';
//     return `reading-memos-${currentSession.user.id}`;
// }

// ---------------------------------------------
// [修正] migrateData() を削除
// データ保存先が localStorage から Supabase DB に変わったため、
// localStorage のデータ構造を移行する処理は不要になりました。
//
// 旧コード:
// function migrateData() {
//     let memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
//     let updated = false;
//     memos = memos.map(m => {
//         let changed = false;
//         if (!m.ReviewedDates) {
//             m.ReviewedDates = [];
//             const count = m.rereadCount || m.likes || 0;
//             for(let i=0; i<count; i++) {
//                 m.ReviewedDates.push(new Date(m.createdAt || Date.now()).toISOString());
//             }
//             changed = true;
//         }
//         if (!m.createdAt) { m.createdAt = new Date(m.id).toISOString(); changed = true; }
//         if (!m.author) { m.author = ""; changed = true; }
//         if (!m.insight) { m.insight = ""; changed = true; }
//         if (!m.tags) { m.tags = []; changed = true; }
//         if (changed) updated = true;
//         return m;
//     });
//     if (updated) {
//         localStorage.setItem(getStorageKey(), JSON.stringify(memos));
//     }
// }

// ---------------------------------------------
// [追加] Supabase DB からメモを取得する共通関数
// localStorage.getItem() の代替として、全データ取得・タグフィルタリングをここで一元管理します。
// tagFilter に文字列を渡すと、そのタグを含むメモだけを返します。
// ---------------------------------------------
async function fetchMemos(tagFilter = null) {
    let query = supabase
        .from('memos')
        .select('*')
        .order('created_at', { ascending: false });

    // タグフィルタが指定されている場合、配列型カラム tags に対して contains を使用
    if (tagFilter) {
        query = query.contains('tags', [tagFilter]);
    }

    const { data, error } = await query;
    if (error) {
        console.error('メモの取得に失敗しました:', error);
        return [];
    }
    return data;
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

        // [修正] migrateData() の呼び出しを削除
        // localStorage へのデータ移行処理が不要になったため削除しました。
        // 旧コード: migrateData();

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

// [修正] memoForm の submit イベントを非同期（async）に変更
// データ保存先を localStorage から Supabase DB（insert / update）に変更しました。
// 新規作成時は supabase.from('memos').insert()、
// 編集時は supabase.from('memos').update() を呼び出します。
// また、カラム名を DB のスキーマに合わせて変更しています（memoText → memo_text）。
memoForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const author = authorInput.value.trim();
    const memoText = memoInput.value.trim();
    const insight = insightInput.value.trim();
    const tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t !== '');

    if (editingId) {
        // 編集: Supabase の update を使用
        // 旧コード:
        // let memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
        // const idx = memos.findIndex(m => m.id === editingId);
        // if (idx > -1) {
        //     memos[idx].title = title;
        //     memos[idx].author = author;
        //     memos[idx].memoText = text;
        //     memos[idx].text = text;
        //     memos[idx].insight = insight;
        //     memos[idx].tags = tags;
        // }
        // localStorage.setItem(getStorageKey(), JSON.stringify(memos));
        const { error } = await supabase
            .from('memos')
            .update({ title, author, memo_text: memoText, insight, tags })
            .eq('id', editingId);

        if (error) {
            alert('更新に失敗しました: ' + error.message);
            return;
        }
        exitEditMode();
    } else {
        // 新規作成: Supabase の insert を使用
        // RLS により user_id は必須。Supabase が認証ユーザーを検証します。
        // 旧コード:
        // const newMemo = {
        //     id: Date.now(),
        //     title, author,
        //     memoText: text,
        //     insight, tags,
        //     createdAt: new Date().toISOString(),
        //     ReviewedDates: []
        // };
        // memos.push(newMemo);
        // localStorage.setItem(getStorageKey(), JSON.stringify(memos));
        const { error } = await supabase
            .from('memos')
            .insert({
                user_id: currentSession.user.id,
                title,
                author,
                memo_text: memoText,
                insight,
                tags,
                // created_at と reviewed_dates は DB のデフォルト値が使われます
            });

        if (error) {
            alert('保存に失敗しました: ' + error.message);
            return;
        }
        memoForm.reset();
    }

    alert('メモを保存しました');
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

// [修正] displayRandomMemo を非同期（async）に変更
// localStorage.getItem() を fetchMemos() に置き換えました。
async function displayRandomMemo() {
    // 旧コード: const memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    const memos = await fetchMemos();

    randomMemoDisplay.innerHTML = '';

    if (memos.length === 0) {
        randomMemoDisplay.innerHTML = '<p class="empty-message">保存されたメモがありません。</p>';
        return;
    }

    const randomMemo = memos[Math.floor(Math.random() * memos.length)];
    const card = createMemoCardHTML(randomMemo, false);
    randomMemoDisplay.appendChild(card);
}

// [修正] generateThemeSuggestions を非同期（async）に変更
// localStorage.getItem() を fetchMemos() に置き換えました。
async function generateThemeSuggestions() {
    // 旧コード: const memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    const memos = await fetchMemos();

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

// [修正] refreshPastMemosList を非同期（async）に変更
// localStorage.getItem() を fetchMemos() に置き換えました。
// ソートは Supabase 側の order() で行うため、JS 側のソート処理は削除しています。
async function refreshPastMemosList() {
    // 旧コード:
    // let memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    // if (currentThemeFilter) {
    //     memos = memos.filter(m => m.tags && m.tags.includes(currentThemeFilter));
    // }
    // memos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const memos = await fetchMemos(currentThemeFilter);

    memoList.innerHTML = '';

    if (memos.length === 0) {
        memoList.innerHTML = '<li style="text-align:center; color:#888;">メモが見つかりません。</li>';
        return;
    }

    memos.forEach(memo => {
        const li = createMemoCardHTML(memo, true);
        memoList.appendChild(li);
    });
}

// ---------------------------------------------
// 共通：メモカードのDOM生成
// ---------------------------------------------

// [修正] createMemoCardHTML 内のカラム名を Supabase DB のスキーマに合わせて変更
// 旧: memo.ReviewedDates → 新: memo.reviewed_dates
// 旧: memo.createdAt     → 新: memo.created_at
// 旧: memo.memoText      → 新: memo.memo_text
function createMemoCardHTML(memo, isListMode) {
    const el = document.createElement(isListMode ? 'li' : 'div');
    if (!isListMode) el.className = 'card';

    // メタ情報 (右上の日付とReview回数)
    const metaDiv = document.createElement('div');
    metaDiv.className = 'memo-meta';

    const dateDiv = document.createElement('div');
    dateDiv.className = 'memo-date';
    // 旧コード: dateDiv.textContent = new Date(memo.createdAt).toLocaleDateString('ja-JP');
    dateDiv.textContent = new Date(memo.created_at).toLocaleDateString('ja-JP');

    // 旧コード: const reviewCount = memo.ReviewedDates ? memo.ReviewedDates.length : 0;
    const reviewCount = memo.reviewed_dates ? memo.reviewed_dates.length : 0;
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
    // 旧コード: textDiv.textContent = memo.memoText || memo.text;
    textDiv.textContent = memo.memo_text;

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

    // 【詳細表示】reviewed_dates の表示ロジック
    // 旧コード: if (memo.ReviewedDates && memo.ReviewedDates.length > 0)
    if (memo.reviewed_dates && memo.reviewed_dates.length > 0) {
        const detailsContainer = document.createElement('div');

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'details-toggle-btn';
        toggleBtn.textContent = '▼ 振り返り履歴を表示';

        const historyDiv = document.createElement('div');
        historyDiv.className = 'review-history-section';
        historyDiv.style.display = 'none';

        const ul = document.createElement('ul');
        // 旧コード: memo.ReviewedDates.forEach(dateStr => {
        memo.reviewed_dates.forEach(dateStr => {
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
            switchScreen('create');
            titleInput.value = memo.title;
            authorInput.value = memo.author || '';
            // 旧コード: memoInput.value = memo.memoText || memo.text || '';
            memoInput.value = memo.memo_text || '';
            insightInput.value = memo.insight || '';
            tagsInput.value = memo.tags ? memo.tags.join(', ') : '';
            editingId = memo.id;

            submitButton.textContent = '更新する';
            cancelEditButton.style.display = 'block';
            memoForm.scrollIntoView({ behavior: 'smooth' });
        });

        // [修正] 削除処理を Supabase の delete に変更
        // 旧コード:
        // deleteBtn.addEventListener('click', () => {
        //     if (confirm(`「${memo.title}」を削除してもよろしいですか？`)) {
        //         let currentMemos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
        //         currentMemos = currentMemos.filter(m => m.id !== memo.id);
        //         localStorage.setItem(getStorageKey(), JSON.stringify(currentMemos));
        //         refreshPastMemosList();
        //     }
        // });
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete';
        deleteBtn.textContent = '削除';
        deleteBtn.addEventListener('click', async () => {
            if (confirm(`「${memo.title}」を削除してもよろしいですか？`)) {
                const { error } = await supabase
                    .from('memos')
                    .delete()
                    .eq('id', memo.id);

                if (error) {
                    alert('削除に失敗しました: ' + error.message);
                    return;
                }
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

// [修正] createReviewFlagBtn を非同期（async）に変更
// 振り返り日時の追記を localStorage への書き込みから Supabase の update に変更しました。
// reviewed_dates カラム（配列型）に新しい日時を追加して上書き保存します。
function createReviewFlagBtn(memo, reviewMetaDiv) {
    const btn = document.createElement('button');
    btn.className = 'review-flag-btn';
    btn.innerHTML = `🚩 Review`;

    btn.addEventListener('click', async () => {
        btn.classList.add('flagged');
        setTimeout(() => btn.classList.remove('flagged'), 300);

        // 旧コード:
        // let currentMemos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
        // const idx = currentMemos.findIndex(m => m.id === memo.id);
        // if (idx > -1) {
        //     if (!currentMemos[idx].ReviewedDates) currentMemos[idx].ReviewedDates = [];
        //     currentMemos[idx].ReviewedDates.push(new Date().toISOString());
        //     localStorage.setItem(getStorageKey(), JSON.stringify(currentMemos));
        //     memo.ReviewedDates = currentMemos[idx].ReviewedDates;
        //     reviewMetaDiv.innerHTML = `🚩 ${memo.ReviewedDates.length} Reviews`;
        // }

        // 既存の reviewed_dates 配列に今の日時を追加して Supabase を update
        const updatedDates = [...(memo.reviewed_dates || []), new Date().toISOString()];

        const { error } = await supabase
            .from('memos')
            .update({ reviewed_dates: updatedDates })
            .eq('id', memo.id);

        if (error) {
            alert('振り返り記録に失敗しました: ' + error.message);
            return;
        }

        // ローカルの memo オブジェクトも更新して表示を即時反映
        memo.reviewed_dates = updatedDates;
        reviewMetaDiv.innerHTML = `🚩 ${updatedDates.length} Reviews`;
    });

    return btn;
}
