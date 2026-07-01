// --- 画面要素の取得 ---
// ログイン画面用
const loginScreen = document.getElementById('login-screen');
const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');

// メインアプリ画面用
const appScreen = document.getElementById('app-screen');
const displayUsername = document.getElementById('display-username');
const logoutButton = document.getElementById('logout-button');

// アプリ機能用
const form = document.getElementById('memo-form');
const titleInput = document.getElementById('book-title');
const memoInput = document.getElementById('book-memo');
const memoList = document.getElementById('memo-list');
const randomMemosContainer = document.getElementById('random-memos');
const skipButton = document.getElementById('skip-button');
const submitButton = document.getElementById('submit-button');
const cancelEditButton = document.getElementById('cancel-edit-button');

// --- 状態管理 ---
let currentUser = localStorage.getItem('currentUser') || null;
let lastDisplayedIds = [];
let editingId = null;

// ユーザごとの保存キーを取得
function getStorageKey() {
    return `reading-memos-${currentUser}`;
}

// ---------------------------------------------
// ログイン・画面切り替え処理
// ---------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    if (currentUser) {
        showApp();
    } else {
        showLogin();
    }
});

function showLogin() {
    loginScreen.style.display = 'block';
    appScreen.style.display = 'none';
    currentUser = null;
    localStorage.removeItem('currentUser');
    usernameInput.value = '';
}

function showApp() {
    loginScreen.style.display = 'none';
    appScreen.style.display = 'block';
    displayUsername.textContent = currentUser;
    
    lastDisplayedIds = [];
    exitEditMode();
    refreshList();
    displayRandomMemos();
}

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = usernameInput.value.trim();
    if (user) {
        currentUser = user;
        localStorage.setItem('currentUser', currentUser);
        showApp();
    }
});

logoutButton.addEventListener('click', () => {
    showLogin();
});

// ---------------------------------------------
// メモアプリの機能（CRUD処理）
// ---------------------------------------------
skipButton.addEventListener('click', () => {
    displayRandomMemos();
});

cancelEditButton.addEventListener('click', () => {
    exitEditMode();
});

form.addEventListener('submit', function(e) {
    e.preventDefault();

    const title = titleInput.value;
    const memoText = memoInput.value;
    let memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];

    if (editingId) {
        const idx = memos.findIndex(m => m.id === editingId);
        if (idx > -1) {
            memos[idx].title = title;
            memos[idx].text = memoText;
            localStorage.setItem(getStorageKey(), JSON.stringify(memos));
        }
        exitEditMode();
    } else {
        const newMemo = {
            id: Date.now(),
            title: title,
            text: memoText,
            likes: 0
        };
        memos.push(newMemo);
        localStorage.setItem(getStorageKey(), JSON.stringify(memos));
        form.reset();
    }

    refreshList();
    displayRandomMemos();
});

function exitEditMode() {
    editingId = null;
    submitButton.textContent = '保存する';
    cancelEditButton.style.display = 'none';
    form.reset();
}

function refreshList() {
    let memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    memoList.innerHTML = '';

    memos.forEach(function(memo) {
        const li = document.createElement('li');

        const titleDiv = document.createElement('div');
        titleDiv.className = 'memo-title';
        titleDiv.textContent = memo.title;

        const textDiv = document.createElement('div');
        textDiv.className = 'memo-text';
        textDiv.textContent = memo.text;

        const metaDiv = document.createElement('div');
        metaDiv.className = 'memo-meta';
        const likes = memo.likes || 0;
        if (likes > 0) {
            // 大人向けなので絵文字ではなくシンプルなハート記号を使用
            metaDiv.innerHTML = `<span style="font-size: 0.9em;">♥</span> ${likes}`;
        }

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'memo-actions';

        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn edit';
        editBtn.textContent = '編集';
        editBtn.addEventListener('click', () => {
            titleInput.value = memo.title;
            memoInput.value = memo.text;
            editingId = memo.id;
            
            submitButton.textContent = '更新する';
            cancelEditButton.style.display = 'block';
            form.scrollIntoView({ behavior: 'smooth' });
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete';
        deleteBtn.textContent = '削除';
        deleteBtn.addEventListener('click', () => {
            if (confirm(`「${memo.title}」を削除してもよろしいですか？`)) {
                let currentMemos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
                currentMemos = currentMemos.filter(m => m.id !== memo.id);
                localStorage.setItem(getStorageKey(), JSON.stringify(currentMemos));
                
                if (editingId === memo.id) {
                    exitEditMode();
                }

                refreshList();
                displayRandomMemos();
            }
        });

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(deleteBtn);

        li.appendChild(titleDiv);
        li.appendChild(textDiv);
        if (likes > 0) li.appendChild(metaDiv);
        li.appendChild(actionsDiv);

        memoList.prepend(li);
    });
}

function displayRandomMemos() {
    let memos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
    randomMemosContainer.innerHTML = '';

    if (memos.length === 0) {
        randomMemosContainer.innerHTML = '<p style="color: #888; padding: 20px 0; text-align: center; width: 100%;">まだメモがありません。</p>';
        return;
    }

    let candidates = memos;
    if (memos.length > 2) {
        candidates = memos.filter(m => !lastDisplayedIds.includes(m.id));
        if (candidates.length === 0) candidates = memos;
    }

    const shuffled = candidates.slice().sort(() => 0.5 - Math.random());
    const selectedMemos = shuffled.slice(0, 2);
    lastDisplayedIds = selectedMemos.map(m => m.id);

    selectedMemos.forEach(function(memo) {
        const card = document.createElement('div');
        card.className = 'card';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'memo-title';
        titleDiv.textContent = memo.title;

        const textDiv = document.createElement('div');
        textDiv.className = 'memo-text';
        textDiv.textContent = memo.text;

        const footerDiv = document.createElement('div');
        footerDiv.className = 'card-footer';

        const likeBtn = document.createElement('button');
        likeBtn.className = 'like-button';
        const currentLikes = memo.likes || 0;
        // シンプルなハート記号を使用
        likeBtn.innerHTML = `<span>♥</span> <span class="like-count">${currentLikes}</span>`;
        
        likeBtn.addEventListener('click', () => {
            likeBtn.classList.add('liked');
            setTimeout(() => {
                likeBtn.classList.remove('liked');
            }, 300);

            let currentMemos = JSON.parse(localStorage.getItem(getStorageKey())) || [];
            const idx = currentMemos.findIndex(m => m.id === memo.id);
            if (idx > -1) {
                currentMemos[idx].likes = (currentMemos[idx].likes || 0) + 1;
                localStorage.setItem(getStorageKey(), JSON.stringify(currentMemos));
                likeBtn.querySelector('.like-count').textContent = currentMemos[idx].likes;
                refreshList();
            }
        });

        footerDiv.appendChild(likeBtn);

        card.appendChild(titleDiv);
        card.appendChild(textDiv);
        card.appendChild(footerDiv);
        
        randomMemosContainer.appendChild(card);
    });
}
