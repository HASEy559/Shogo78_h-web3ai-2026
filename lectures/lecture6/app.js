// アプリのデータ管理とイベント処理 (ログイン強化・編集機能対応版)

// ユーザーごとの初期サンプルデータ
const SAMPLE_MEMOS = [
  {
    id: "sample-1",
    title: "人間失格",
    author: "太宰治",
    content: "恥の多い生涯を送って来ました。自分には、人間の生活というものが、見当つかないのです。これほど強く心に刺さる言葉はありません。人間関係に悩むすべての人に読んでほしい古典の名作です。",
    date: "2026-05-01",
    tags: ["古典", "文学", "葛藤", "名作"],
    likes: 5
  },
  {
    id: "sample-2",
    title: "吾輩は猫である",
    author: "夏目漱石",
    content: "「吾輩は猫である。名前はまだ無い。」という有名な書き出しから始まる、猫の視点から人間社会をユーモラスに風刺した小説。知的な表現と滑稽な人間観察が絶妙にブレンドされていて面白い。",
    date: "2026-05-05",
    tags: ["ユーモア", "小説", "猫", "風刺"],
    likes: 2
  },
  {
    id: "sample-3",
    title: "リーダブルコード",
    author: "Dustin Boswell",
    content: "「コードは他の人が最短時間で理解できるように書かなければならない」という原則を徹底解説する本。変数名の付け方から関数の分割方法まで、具体的で実用的な内容ばかりでエンジニア必須の1冊。",
    date: "2026-05-15",
    tags: ["プログラミング", "リファクタリング", "技術書"],
    likes: 8
  },
  {
    id: "sample-4",
    title: "星の王子さま",
    author: "アントワーヌ・ド・サン＝テグジュペリ",
    content: "「かんじんなことは、目に見えないんだよ」というメッセージが心に残る。子供の純粋な目線から、大人の社会の不条理さや、本当に大切な絆、友情、愛について教えてくれる哲学的な児童文学。",
    date: "2026-05-20",
    tags: ["児童書", "哲学", "名作", "フランス"],
    likes: 4
  }
];

// アプリケーションの状態管理
const state = {
  currentUser: null, // 現在ログイン中のユーザー名
  memos: [], // 現在のユーザーのメモ一覧
  selectedTags: [], // フォームで選択中のタグ
  activeFilterTag: null, // 一覧で絞り込んでいるタグ
  searchQuery: "", // 検索キーワード
  aiTimeout: null, // AI推定のデバウンス
  editingMemoId: null // 編集中のメモID (nullの場合は新規作成)
};

// --- 初期化処理 ---
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  // 起動時はログインしていないため、ログイン画面を表示し、メインは隠す
  showAuthScreen();
});

// ログイン画面の表示
function showAuthScreen() {
  document.getElementById("login-screen").classList.remove("hidden");
  document.getElementById("main-app").classList.add("hidden");
  document.getElementById("login-username").value = "";
  state.currentUser = null;
  state.memos = [];
}

// ユーザーデータの読み込み
function loadUserData(username) {
  state.currentUser = username;
  const storageKey = `readmemo_memos_${username}`;
  const storedMemos = localStorage.getItem(storageKey);
  
  if (storedMemos) {
    state.memos = JSON.parse(storedMemos);
  } else {
    // 新規ユーザーには初期状態でサンプルデータを設定して、体験をスムーズにする
    state.memos = SAMPLE_MEMOS.map(memo => ({
      ...memo,
      id: `${username}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` // ユーザー固有のIDに変更
    }));
    saveUserData();
  }
}

// ユーザーデータの保存
function saveUserData() {
  if (!state.currentUser) return;
  const storageKey = `readmemo_memos_${state.currentUser}`;
  localStorage.setItem(storageKey, JSON.stringify(state.memos));
}

// 登録されている全タグのユニークリストを取得 (現在ログイン中のユーザーのメモから)
function getAllUniqueTags() {
  const tagsSet = new Set();
  state.memos.forEach(memo => {
    if (memo.tags) {
      memo.tags.forEach(tag => tagsSet.add(tag));
    }
  });
  return Array.from(tagsSet);
}

// --- イベントリスナー設定 ---
function setupEventListeners() {
  // ログインフォーム送信
  const loginForm = document.getElementById("login-form");
  loginForm.addEventListener("submit", handleLoginSubmit);

  // ログアウトボタン
  const logoutBtn = document.getElementById("logout-btn");
  logoutBtn.addEventListener("click", () => {
    if (confirm("ログアウトしてもよろしいですか？")) {
      showAuthScreen();
    }
  });

  // メモフォーム送信
  const memoForm = document.getElementById("memo-form");
  memoForm.addEventListener("submit", handleMemoFormSubmit);

  // 編集キャンセルボタン
  const cancelEditBtn = document.getElementById("cancel-edit-btn");
  cancelEditBtn.addEventListener("click", resetForm);

  // タイトル入力時のAI自動推定トリガー (デバウンス付き)
  const titleInput = document.getElementById("book-title");
  titleInput.addEventListener("input", handleTitleInput);

  // 手動タグ入力
  const tagInput = document.getElementById("tag-input");
  tagInput.addEventListener("keydown", handleTagInputKeyDown);
  tagInput.addEventListener("input", handleTagInputInput);
  
  // ドキュメントクリックでタグサジェストを閉じる
  document.addEventListener("click", (e) => {
    const suggestions = document.getElementById("tag-suggestions");
    if (!e.target.closest(".tag-input-wrapper")) {
      suggestions.classList.add("hidden");
    }
  });

  // 検索入力
  const searchInput = document.getElementById("search-input");
  searchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value.trim().toLowerCase();
    renderMemos();
  });

  // 絞り込み解除ボタン
  const clearFiltersBtn = document.getElementById("clear-filters-btn");
  clearFiltersBtn.addEventListener("click", () => {
    state.activeFilterTag = null;
    state.searchQuery = "";
    document.getElementById("search-input").value = "";
    document.querySelectorAll(".filter-tag-badge").forEach(badge => {
      badge.classList.remove("active");
    });
    clearFiltersBtn.classList.add("hidden");
    renderMemos();
  });

  // 推薦モーダルの閉じるボタン
  const closeLoginBtn = document.getElementById("close-login-btn");
  closeLoginBtn.addEventListener("click", () => {
    document.getElementById("login-modal").classList.add("hidden");
  });
}

// --- ログイン処理 ---
function handleLoginSubmit(e) {
  e.preventDefault();
  const usernameInput = document.getElementById("login-username");
  const username = usernameInput.value.trim();

  if (!username) return;

  // ユーザーデータの読み込み
  loadUserData(username);

  // UI表示切り替え
  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("main-app").classList.remove("hidden");
  document.getElementById("current-user-display").textContent = `@${username}`;

  // メイン画面の初期描画
  renderMemos();
  renderFilterTags();
  resetForm();

  // 推薦の提示（過去のメモが2件以上ある場合のみ）
  if (state.memos.length >= 2) {
    showLoginModal();
  }
}

// --- 過去メモ推薦（ログインウェルカム） ---
function showLoginModal() {
  const modal = document.getElementById("login-modal");
  modal.classList.remove("hidden");

  // 過去のメモからランダムで2件選出
  const recommendations = getRandomMemos(2);
  
  const recCard0 = document.getElementById("rec-card-0");
  const recCard1 = document.getElementById("rec-card-1");

  renderRecommendCard(recCard0, recommendations[0]);
  renderRecommendCard(recCard1, recommendations[1]);
}

function getRandomMemos(count) {
  if (state.memos.length === 0) return [];
  const shuffled = [...state.memos].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function renderRecommendCard(cardElement, memo) {
  if (!memo) {
    cardElement.innerHTML = `
      <div class="card-empty-state">
        <p>おすすめできる過去のメモがありません</p>
      </div>
    `;
    return;
  }

  cardElement.innerHTML = `
    <div>
      <div class="rec-title">📖 ${escapeHTML(memo.title)}</div>
      <div class="rec-author">${memo.author ? `著者: ${escapeHTML(memo.author)}` : "著者不明"}</div>
      <div class="rec-content">“${escapeHTML(memo.content)}”</div>
    </div>
    <div class="rec-actions">
      <button class="btn btn-like btn-block" onclick="likeRecommendMemo('${memo.id}', this)">
        ❤️ いいね
      </button>
      <button class="btn btn-skip btn-block" onclick="skipRecommendMemo(this)">
        スキップ
      </button>
    </div>
  `;
}

window.likeRecommendMemo = function(memoId, button) {
  const memoIndex = state.memos.findIndex(m => m.id === memoId);
  if (memoIndex !== -1) {
    state.memos[memoIndex].likes = (state.memos[memoIndex].likes || 0) + 1;
    saveUserData();
    renderMemos();
  }
  
  button.innerHTML = "❤️ いいねしました！";
  button.disabled = true;
  button.style.background = "#4e8c65";
  
  setTimeout(() => {
    document.getElementById("login-modal").classList.add("hidden");
  }, 600);
};

window.skipRecommendMemo = function(button) {
  button.innerHTML = "スキップしました";
  button.disabled = true;
  
  setTimeout(() => {
    document.getElementById("login-modal").classList.add("hidden");
  }, 600);
};

// --- AI連携（擬似/モックAPI） ---
function handleTitleInput(e) {
  const title = e.target.value.trim();
  
  if (state.aiTimeout) {
    clearTimeout(state.aiTimeout);
  }

  const authorInput = document.getElementById("book-author");
  const authorStatus = document.getElementById("author-status");
  const aiTagsContainer = document.getElementById("ai-tags-container");

  // 編集モード時にタイトルが未編集または空の場合はAI推定を抑止することも可能だが、
  // タイトルを大幅に変えたときは走る方が親切
  if (!title) {
    authorInput.value = "";
    authorStatus.className = "status-indicator";
    aiTagsContainer.innerHTML = `<span class="placeholder-text">タイトルを入力するとAIがタグを提案します</span>`;
    return;
  }

  authorStatus.className = "status-indicator loading";
  
  state.aiTimeout = setTimeout(async () => {
    try {
      const result = await simulateAIApi(title);
      
      // ユーザーが手入力で既に著者名を入れている場合は上書きしない配慮
      if (!authorInput.value || authorInput.value === "著者不明" || authorInput.value.includes("(推定不可)")) {
        authorInput.value = result.author;
      }
      
      authorStatus.className = "status-indicator success";
      renderAITagSuggestions(result.tags);
    } catch (error) {
      console.error("AI API Error:", error);
      authorStatus.className = "status-indicator";
    }
  }, 800);
}

function simulateAIApi(title) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const lowerTitle = title.toLowerCase();
      
      const mockDatabase = {
        "人間失格": {
          author: "太宰治",
          tags: ["古典", "文学", "葛藤", "昭和", "名作", "太宰治", "日本文学", "アイデンティティ"]
        },
        "吾輩は猫である": {
          author: "夏目漱石",
          tags: ["ユーモア", "名作", "猫", "明治", "風刺", "夏目漱石", "日本文学", "観察日記"]
        },
        "リーダブルコード": {
          author: "Dustin Boswell",
          tags: ["プログラミング", "リファクタリング", "技術書", "ベストプラクティス", "設計", "エンジニア", "コーディング"]
        },
        "星の王子さま": {
          author: "サン＝テグジュペリ",
          tags: ["児童書", "哲学", "愛", "友情", "フランス", "ファンタジー", "名言"]
        },
        "こころ": {
          author: "夏目漱石",
          tags: ["夏目漱石", "エゴイズム", "友情", "葛藤", "日本文学", "心理描写", "明治"]
        },
        "走れメロス": {
          author: "太宰治",
          tags: ["友情", "信頼", "ギリシャ神話", "約束", "太宰治", "短編小説", "感動"]
        },
        "三体": {
          author: "劉慈欣",
          tags: ["SF", "宇宙", "科学", "中国文学", "エンタメ", "異星人", "壮大", "ミステリー"]
        }
      };

      let foundKey = Object.keys(mockDatabase).find(key => lowerTitle.includes(key.toLowerCase()));

      if (foundKey) {
        resolve(mockDatabase[foundKey]);
      } else {
        const generatedTags = ["読書メモ", "お気に入り", "インスピレーション", "書籍関連", "要約", "教養"];
        if (title.length > 2) {
          generatedTags.unshift(title.substring(0, 4) + "関連");
        }
        resolve({
          author: "著者不明 (推定不可)",
          tags: generatedTags.slice(0, 6)
        });
      }
    }, 800);
  });
}

function renderAITagSuggestions(tags) {
  const container = document.getElementById("ai-tags-container");
  container.innerHTML = "";
  
  tags.forEach(tag => {
    // 既に選択済みのタグは提案しない
    if (state.selectedTags.includes(tag)) return;

    const badge = document.createElement("span");
    badge.className = "ai-tag-suggestion";
    badge.textContent = `+ ${tag}`;
    badge.addEventListener("click", () => {
      addTag(tag);
      badge.style.transform = "scale(0)";
      badge.style.opacity = "0";
      setTimeout(() => badge.remove(), 200);
    });
    container.appendChild(badge);
  });
}

// --- 手動タグ入力機能 ---
function handleTagInputKeyDown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    const tagVal = e.target.value.trim();
    if (tagVal) {
      addTag(tagVal);
      e.target.value = "";
      document.getElementById("tag-suggestions").classList.add("hidden");
    }
  }
}

function handleTagInputInput(e) {
  const query = e.target.value.trim().toLowerCase();
  const suggestionsBox = document.getElementById("tag-suggestions");

  if (!query) {
    suggestionsBox.classList.add("hidden");
    return;
  }

  const allTags = getAllUniqueTags();
  const matchedTags = allTags.filter(tag => 
    tag.toLowerCase().includes(query) && !state.selectedTags.includes(tag)
  );

  if (matchedTags.length === 0) {
    suggestionsBox.classList.add("hidden");
    return;
  }

  suggestionsBox.innerHTML = "";
  matchedTags.forEach(tag => {
    const item = document.createElement("div");
    item.className = "suggestion-item";
    item.textContent = tag;
    item.addEventListener("click", () => {
      addTag(tag);
      e.target.value = "";
      suggestionsBox.classList.add("hidden");
    });
    suggestionsBox.appendChild(item);
  });

  suggestionsBox.classList.remove("hidden");
}

function addTag(tag) {
  if (state.selectedTags.includes(tag)) return;
  state.selectedTags.push(tag);
  renderSelectedTags();
}

function removeTag(tag) {
  state.selectedTags = state.selectedTags.filter(t => t !== tag);
  renderSelectedTags();
}

function renderSelectedTags() {
  const container = document.getElementById("active-tags-container");
  container.innerHTML = "";

  state.selectedTags.forEach(tag => {
    const badge = document.createElement("span");
    badge.className = "tag-badge";
    badge.innerHTML = `
      #${escapeHTML(tag)}
      <span class="remove-tag-btn">&times;</span>
    `;
    badge.querySelector(".remove-tag-btn").addEventListener("click", () => removeTag(tag));
    container.appendChild(badge);
  });
}

// --- メモの追加・編集登録処理 ---
function handleMemoFormSubmit(e) {
  e.preventDefault();
  
  const titleInput = document.getElementById("book-title");
  const authorInput = document.getElementById("book-author");
  const contentInput = document.getElementById("book-content");

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const author = authorInput.value.trim() || "著者不明";

  if (!title || !content) {
    alert("タイトルと一言メモは必須入力です。");
    return;
  }

  if (state.editingMemoId) {
    // 【編集（更新）モード】
    const memoIndex = state.memos.findIndex(m => m.id === state.editingMemoId);
    if (memoIndex !== -1) {
      // タイトル、著者、内容、タグを更新（日付といいね数は維持）
      state.memos[memoIndex].title = title;
      state.memos[memoIndex].author = author;
      state.memos[memoIndex].content = content;
      state.memos[memoIndex].tags = [...state.selectedTags];
    }
  } else {
    // 【新規登録モード】
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];

    const newMemo = {
      id: "memo-" + Date.now(),
      title: title,
      author: author,
      content: content,
      date: formattedDate, // 作成日付自動入力
      tags: [...state.selectedTags],
      likes: 0
    };
    state.memos.unshift(newMemo);
  }

  saveUserData();
  resetForm();
  renderMemos();
  renderFilterTags();

  // スクロールでリストを表示
  document.getElementById("memos-container").scrollIntoView({ behavior: "smooth", block: "nearest" });
}

// 編集モードの開始
window.editMemo = function(memoId) {
  const memo = state.memos.find(m => m.id === memoId);
  if (!memo) return;

  state.editingMemoId = memoId;
  state.selectedTags = [...(memo.tags || [])];

  // フォームにデータをロード
  document.getElementById("book-title").value = memo.title;
  document.getElementById("book-author").value = memo.author || "";
  document.getElementById("book-content").value = memo.content;
  renderSelectedTags();

  // UIを編集モード状態へ
  document.getElementById("form-title").textContent = "メモを編集";
  document.getElementById("submit-btn").textContent = "更新する";
  document.getElementById("cancel-edit-btn").classList.remove("hidden");
  document.getElementById("edit-indicator").classList.remove("hidden");
  
  // フォームパネルの強調表示
  document.querySelector(".form-section").classList.add("editing-focus");

  // スクロールでフォームを表示
  document.querySelector(".form-section").scrollIntoView({ behavior: "smooth", block: "start" });
};

// フォームのリセット（編集キャンセルおよびクリア）
function resetForm() {
  state.editingMemoId = null;
  state.selectedTags = [];

  document.getElementById("memo-form").reset();
  renderSelectedTags();

  // AIステータスのリセット
  document.getElementById("author-status").className = "status-indicator";
  document.getElementById("ai-tags-container").innerHTML = `<span class="placeholder-text">タイトルを入力するとAIがタグを提案します</span>`;

  // UIを新規登録モードに戻す
  document.getElementById("form-title").textContent = "新しいメモを追加";
  document.getElementById("submit-btn").textContent = "メモを保存する";
  document.getElementById("cancel-edit-btn").classList.add("hidden");
  document.getElementById("edit-indicator").classList.add("hidden");
  
  document.querySelector(".form-section").classList.remove("editing-focus");
}

// --- 一覧・検索・フィルタリングの描画 ---
function renderMemos() {
  const container = document.getElementById("memos-container");
  const memoCount = document.getElementById("memo-count");
  
  const filteredMemos = state.memos.filter(memo => {
    // 1. 部分一致検索
    const matchesSearch = !state.searchQuery || 
      memo.title.toLowerCase().includes(state.searchQuery) ||
      memo.content.toLowerCase().includes(state.searchQuery) ||
      (memo.author && memo.author.toLowerCase().includes(state.searchQuery)) ||
      (memo.tags && memo.tags.some(tag => tag.toLowerCase().includes(state.searchQuery)));

    // 2. タグ絞り込み
    const matchesTag = !state.activeFilterTag || 
      (memo.tags && memo.tags.includes(state.activeFilterTag));

    return matchesSearch && matchesTag;
  });

  memoCount.textContent = filteredMemos.length;

  const clearFiltersBtn = document.getElementById("clear-filters-btn");
  if (state.activeFilterTag || state.searchQuery) {
    clearFiltersBtn.classList.remove("hidden");
  } else {
    clearFiltersBtn.classList.add("hidden");
  }

  container.innerHTML = "";

  if (filteredMemos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <p>該当する読書メモが見つかりません</p>
      </div>
    `;
    return;
  }

  filteredMemos.forEach(memo => {
    const card = document.createElement("div");
    card.className = "memo-card";
    
    const tagsHTML = memo.tags && memo.tags.length > 0
      ? memo.tags.map(tag => `<span class="card-tag-badge">#${escapeHTML(tag)}</span>`).join("")
      : "";

    card.innerHTML = `
      <div>
        <div class="memo-card-header">
          <div class="memo-title-author">
            <span class="memo-card-title">${escapeHTML(memo.title)}</span>
            <span class="memo-card-author">${memo.author ? escapeHTML(memo.author) : "著者不明"}</span>
          </div>
          <span class="memo-card-date">${escapeHTML(memo.date)}</span>
        </div>
        <p class="memo-card-content">${escapeHTML(memo.content)}</p>
      </div>
      <div class="memo-card-footer">
        <div class="memo-card-tags">
          ${tagsHTML}
        </div>
        <div class="card-actions">
          <button class="like-action-btn ${memo.likes > 0 ? 'liked' : ''}" onclick="likeMemo('${memo.id}')">
            ❤️ <span class="like-count">${memo.likes || 0}</span>
          </button>
          <button class="edit-action-btn" onclick="editMemo('${memo.id}')" title="編集">
            ✏️
          </button>
          <button class="delete-action-btn" onclick="deleteMemo('${memo.id}')" title="削除">
            🗑️
          </button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
}

function renderFilterTags() {
  const container = document.getElementById("filter-tags-container");
  const allTags = getAllUniqueTags();

  if (allTags.length === 0) {
    container.innerHTML = `<span class="no-tags-text">タグがありません</span>`;
    return;
  }

  container.innerHTML = "";
  allTags.forEach(tag => {
    const badge = document.createElement("span");
    badge.className = "filter-tag-badge";
    if (state.activeFilterTag === tag) {
      badge.classList.add("active");
    }
    badge.textContent = `#${tag}`;
    badge.addEventListener("click", () => {
      if (state.activeFilterTag === tag) {
        state.activeFilterTag = null;
        badge.classList.remove("active");
      } else {
        state.activeFilterTag = tag;
        document.querySelectorAll(".filter-tag-badge").forEach(b => b.classList.remove("active"));
        badge.classList.add("active");
      }
      renderMemos();
    });
    container.appendChild(badge);
  });
}

// --- カードアクション ---
window.likeMemo = function(memoId) {
  const memoIndex = state.memos.findIndex(m => m.id === memoId);
  if (memoIndex !== -1) {
    state.memos[memoIndex].likes = (state.memos[memoIndex].likes || 0) + 1;
    saveUserData();
    renderMemos();
  }
};

window.deleteMemo = function(memoId) {
  if (confirm("このメモを削除してもよろしいですか？")) {
    state.memos = state.memos.filter(m => m.id !== memoId);
    saveUserData();
    
    // 編集中のメモを削除した場合はフォームをリセット
    if (state.editingMemoId === memoId) {
      resetForm();
    }
    
    renderMemos();
    renderFilterTags();
  }
};

// HTMLのエスケープ
function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
