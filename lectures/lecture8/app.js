// --- 画面要素の取得 ---
// ログイン画面
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');

// メインアプリコンテナ
const appScreen = document.getElementById('app-screen');
const displayUsername = document.getElementById('display-username');
const logoutButton = document.getElementById('logout-button');
const appHeaderTitle = document.getElementById('app-header-title');

// 各スクリーン
const topScreen = document.getElementById('top-screen');
const createScreen = document.getElementById('create-screen');
const reviewScreen = document.getElementById('review-screen');

// ナビゲーション
const navCreateBtn = document.getElementById('nav-create-btn');
const navReviewBtn = document.getElementById('nav-review-btn');
const globalNavBtn = document.getElementById('global-nav-btn');

// 作成・一覧画面用
const memoForm = document.getElementById('memo-form');
const titleInput = document.getElementById('book-title');
const authorInput = document.getElementById('book-author');
const memoInput = document.getElementById('book-memo');
const insightInput = document.getElementById('book-insight');
const tagsInput = document.getElementById('book-tags');
const submitButton = document.getElementById('submit-button');
const cancelEditButton = document.getElementById('cancel-edit-button');
const memoList = document.getElementById('memo-list');

// 検索・ソート用
const searchText = document.getElementById('search-text');
const searchTag = document.getElementById('search-tag');
const searchDateFrom = document.getElementById('search-date-from');
const searchDateTo = document.getElementById('search-date-to');
const sortReread = document.getElementById('sort-reread');

// 振り返り画面用
const reviewRandomBtn = document.getElementById('review-random-btn');
const review1wBtn = document.getElementById('review-1w-btn');
const review1mBtn = document.getElementById('review-1m-btn');
const review1yBtn = document.getElementById('review-1y-btn');
const reviewDisplayArea = document.getElementById('review-display-area');
const reflectionFormContainer = document.getElementById('reflection-form-container');
const reflectionForm = document.getElementById('reflection-form');
const reflectionText = document.getElementById('reflection-text');

// --- 状態管理 ---
let currentUser = localStorage.getItem('currentUser') || null;
let currentScreen = 'login'; // login, top, create, review
let editingId = null;
let reviewingMemoId = null;

// ストレージキー
function getStorageKey() {
    return `reading-memos-${currentUser}`;
}

// ---------------------------------------------
// データマイグレーション処理
// ---------------------------------------------
// 既存のデータを新しいフォーマットに変換します
function migrateData() {
    let memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    let updated = false;
    memos = memos.map(m => {
        let changed = false;
        if (m.rereadCount === undefined) {
            // 旧likesをrereadCountに移行
            m.rereadCount = m.likes || 0;
            delete m.likes;
            changed = true;
        }
        if (!m.createdAt) {
            m.createdAt = new Date(m.id).toISOString();
            changed = true;
        }
        if (!m.author) { m.author = ""; changed = true; }
        if (!m.insight) { m.insight = ""; changed = true; }
        if (!m.tags) { m.tags = []; changed = true; }
        if (!m.reflectionNotes) { m.reflectionNotes = []; changed = true; }
        if (changed) updated = true;
        return m;
    });
    if (updated) {
        localStorage.setItem(getStorageKey(), JSON.stringify(memos));
    }
}

// ---------------------------------------------
// 画面切り替えルーター（SPA化）
// ---------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        migrateData();
        switchScreen('top');
    } else {
        switchScreen('login');
    }
});

function switchScreen(screen) {
    currentScreen = screen;
    
    // 全て非表示にリセット
    loginScreen.style.display = 'none';
    appScreen.style.display = 'none';
    topScreen.style.display = 'none';
    createScreen.style.display = 'none';
    reviewScreen.style.display = 'none';
    globalNavBtn.style.display = 'none';

    if (screen === 'login') {
        loginScreen.style.display = 'block';
        currentUser = null;
        localStorage.removeItem('currentUser');
        usernameInput.value = '';
    } else {
        appScreen.style.display = 'block';
        displayUsername.textContent = currentUser;

        if (screen === 'top') {
            appHeaderTitle.textContent = 'トップ';
            topScreen.style.display = 'block';
            exitEditMode();
        } else if (screen === 'create') {
            appHeaderTitle.textContent = '新規メモを作成・一覧';
            createScreen.style.display = 'block';
            globalNavBtn.style.display = 'flex';
            refreshList();
        } else if (screen === 'review') {
            appHeaderTitle.textContent = '過去のメモを振り返る';
            reviewScreen.style.display = 'block';
            globalNavBtn.style.display = 'flex';
            clearReviewDisplay();
        }
    }
}

// ナビゲーションイベント
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = usernameInput.value.trim();
    if (user) {
        currentUser = user;
        localStorage.setItem('currentUser', currentUser);
        migrateData();
        switchScreen('top');
    }
});

logoutButton.addEventListener('click', () => switchScreen('login'));
navCreateBtn.addEventListener('click', () => switchScreen('create'));
navReviewBtn.addEventListener('click', () => switchScreen('review'));
globalNavBtn.addEventListener('click', () => switchScreen('top'));

// ---------------------------------------------
// 作成・一覧画面の機能 (CRUD + 検索・ソート)
// ---------------------------------------------

// 保存処理
memoForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    
    const title = titleInput.value.trim();
    const author = authorInput.value.trim();
    const text = memoInput.value.trim();
    const insight = insightInput.value.trim();
    // カンマ区切りのタグを配列化
    const tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t !== "");

    if (editingId) {
        // 編集モード
        const idx = memos.findIndex(m => m.id === editingId);
        if (idx > -1) {
            memos[idx].title = title;
            memos[idx].author = author;
            memos[idx].memoText = text; 
            memos[idx].text = text; // 互換性のため
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
            rereadCount: 0,
            reflectionNotes: []
        };
        memos.push(newMemo);
        memoForm.reset();
    }
    
    localStorage.setItem(getStorageKey(), JSON.stringify(memos));
    refreshList();
});

cancelEditButton.addEventListener('click', exitEditMode);

function exitEditMode() {
    editingId = null;
    submitButton.textContent = '保存する';
    cancelEditButton.style.display = 'none';
    memoForm.reset();
}

// 検索フィルターのイベントリスナー
[searchText, searchTag, searchDateFrom, searchDateTo, sortReread].forEach(el => {
    el.addEventListener('input', refreshList);
    el.addEventListener('change', refreshList);
});

// 一覧描画と検索・ソート処理
function refreshList() {
    let memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];

    // --- フィルタリング ---
    const sText = searchText.value.toLowerCase().trim();
    const sTag = searchTag.value.toLowerCase().trim();
    const sDateFrom = searchDateFrom.value;
    const sDateTo = searchDateTo.value;

    memos = memos.filter(m => {
        // 内容・タイトル部分一致
        if (sText) {
            const tMatch = m.title.toLowerCase().includes(sText);
            const mMatch = (m.memoText || m.text || "").toLowerCase().includes(sText);
            if (!tMatch && !mMatch) return false;
        }
        // タグ一致
        if (sTag) {
            const hasTag = m.tags && m.tags.some(t => t.toLowerCase().includes(sTag));
            if (!hasTag) return false;
        }
        // 期間一致
        if (sDateFrom || sDateTo) {
            const mDate = new Date(m.createdAt).getTime();
            if (sDateFrom) {
                const fromTime = new Date(sDateFrom + "T00:00:00").getTime();
                if (mDate < fromTime) return false;
            }
            if (sDateTo) {
                const toTime = new Date(sDateTo + "T23:59:59").getTime();
                if (mDate > toTime) return false;
            }
        }
        return true;
    });

    // --- ソート ---
    // デフォルトは新しい順
    memos.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 再読回数が多い順を優先
    if (sortReread.checked) {
        memos.sort((a, b) => (b.rereadCount || 0) - (a.rereadCount || 0));
    }

    // --- 描画 ---
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
// 振り返り画面の機能
// ---------------------------------------------
function clearReviewDisplay() {
    reviewingMemoId = null;
    reviewDisplayArea.innerHTML = '<p class="empty-message">上のボタンから振り返るメモを選んでください。</p>';
    reflectionFormContainer.style.display = 'none';
}

function displayReviewMemo(memo) {
    if (!memo) {
        reviewDisplayArea.innerHTML = '<p class="empty-message">該当するメモが見つかりませんでした。</p>';
        reflectionFormContainer.style.display = 'none';
        reviewingMemoId = null;
        return;
    }
    
    reviewDisplayArea.innerHTML = '';
    // isListMode=false（振り返りカードとして表示）
    const card = createMemoCardHTML(memo, false);
    reviewDisplayArea.appendChild(card);
    
    reviewingMemoId = memo.id;
    reflectionFormContainer.style.display = 'block';
    reflectionForm.reset();
}

// 1. ランダム
reviewRandomBtn.addEventListener('click', () => {
    const memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    if (memos.length === 0) return displayReviewMemo(null);
    const randomMemo = memos[Math.floor(Math.random() * memos.length)];
    displayReviewMemo(randomMemo);
});

// 時間ベース検索用ヘルパー関数
// 目標日時に最も近い（日時の差が一番小さい）メモを探す
function findNearestMemo(targetTime) {
    const memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    if (memos.length === 0) return null;
    
    let nearest = memos[0];
    let minDiff = Math.abs(new Date(memos[0].createdAt).getTime() - targetTime);

    for (let i = 1; i < memos.length; i++) {
        const diff = Math.abs(new Date(memos[i].createdAt).getTime() - targetTime);
        if (diff < minDiff) {
            minDiff = diff;
            nearest = memos[i];
        }
    }
    return nearest;
}

// 2. 1週間前
review1wBtn.addEventListener('click', () => {
    const target = new Date();
    target.setDate(target.getDate() - 7);
    displayReviewMemo(findNearestMemo(target.getTime()));
});

// 3. 1ヶ月前
review1mBtn.addEventListener('click', () => {
    const target = new Date();
    target.setMonth(target.getMonth() - 1);
    displayReviewMemo(findNearestMemo(target.getTime()));
});

// 4. 1年前
review1yBtn.addEventListener('click', () => {
    const target = new Date();
    target.setFullYear(target.getFullYear() - 1);
    displayReviewMemo(findNearestMemo(target.getTime()));
});

// 5. 追記（気づき）の保存
reflectionForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!reviewingMemoId) return;

    const noteText = reflectionText.value.trim();
    if (!noteText) return;

    let memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    const idx = memos.findIndex(m => m.id === reviewingMemoId);
    if (idx > -1) {
        if (!memos[idx].reflectionNotes) memos[idx].reflectionNotes = [];
        memos[idx].reflectionNotes.push({
            date: new Date().toISOString(),
            text: noteText
        });
        localStorage.setItem(getStorageKey(), JSON.stringify(memos));
        displayReviewMemo(memos[idx]); // 再描画
    }
});

// ---------------------------------------------
// 共通：メモカードのDOM生成
// ---------------------------------------------
function createMemoCardHTML(memo, isListMode) {
    const el = document.createElement(isListMode ? 'li' : 'div');
    if (!isListMode) el.className = 'card';

    // メタ情報 (右上の日付と再読カウント)
    const metaDiv = document.createElement('div');
    metaDiv.className = 'memo-meta';
    
    const dateDiv = document.createElement('div');
    dateDiv.className = 'memo-date';
    dateDiv.textContent = new Date(memo.createdAt).toLocaleDateString('ja-JP');
    
    const rereadMetaDiv = document.createElement('div');
    rereadMetaDiv.className = 'memo-reread-count';
    rereadMetaDiv.innerHTML = `<span style="font-size:1em;">♥</span> ${memo.rereadCount || 0}`;
    
    metaDiv.appendChild(dateDiv);
    metaDiv.appendChild(rereadMetaDiv);

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

    // 追記履歴 (Reflection Notes)
    const reflectionDiv = document.createElement('div');
    if (memo.reflectionNotes && memo.reflectionNotes.length > 0) {
        reflectionDiv.className = 'reflection-notes';
        const h4 = document.createElement('h4');
        h4.textContent = '📝 振り返りの追記';
        reflectionDiv.appendChild(h4);

        memo.reflectionNotes.forEach(note => {
            const nDiv = document.createElement('div');
            nDiv.className = 'reflection-item';
            
            const nDate = document.createElement('span');
            nDate.className = 'reflection-date';
            nDate.textContent = new Date(note.date).toLocaleString('ja-JP');
            
            const nText = document.createElement('div');
            nText.textContent = note.text;
            
            nDiv.appendChild(nDate);
            nDiv.appendChild(nText);
            reflectionDiv.appendChild(nDiv);
        });
    }

    // 要素の追加
    el.appendChild(metaDiv);
    el.appendChild(titleDiv);
    if (memo.author) el.appendChild(authorDiv);
    if (memo.tags && memo.tags.length > 0) el.appendChild(tagsDiv);
    el.appendChild(textDiv);
    if (memo.insight) el.appendChild(insightDiv);
    if (memo.reflectionNotes && memo.reflectionNotes.length > 0) el.appendChild(reflectionDiv);

    // フッター / アクションの設定
    if (isListMode) {
        // 一覧画面用（編集・削除）
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'memo-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn edit';
        editBtn.textContent = '編集';
        editBtn.addEventListener('click', () => {
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
                if (editingId === memo.id) exitEditMode();
                refreshList();
            }
        });

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);
        el.appendChild(actionsDiv);

    } else {
        // 振り返り画面用（再読ボタン）
        const footerDiv = document.createElement('div');
        footerDiv.className = 'card-footer';

        const rereadBtn = document.createElement('button');
        rereadBtn.className = 'reread-button';
        rereadBtn.innerHTML = `<span>♥ 再読した！</span> <span class="like-count">${memo.rereadCount || 0}</span>`;
        
        // 再読カウントのインクリメント処理
        rereadBtn.addEventListener('click', () => {
            rereadBtn.classList.add('liked');
            setTimeout(() => rereadBtn.classList.remove('liked'), 300);

            let currentMemos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
            const idx = currentMemos.findIndex(m => m.id === memo.id);
            if (idx > -1) {
                currentMemos[idx].rereadCount = (currentMemos[idx].rereadCount || 0) + 1;
                localStorage.setItem(getStorageKey(), JSON.stringify(currentMemos));
                rereadBtn.querySelector('.like-count').textContent = currentMemos[idx].rereadCount;
                
                // 表示中の状態も更新
                memo.rereadCount = currentMemos[idx].rereadCount;
                rereadMetaDiv.innerHTML = `<span style="font-size:1em;">♥</span> ${memo.rereadCount}`;
            }
        });
        footerDiv.appendChild(rereadBtn);
        el.appendChild(footerDiv);
    }

    return el;
}