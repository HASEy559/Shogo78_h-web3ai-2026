// ============================================================
// Service Worker — 積んドク！log
// PWA のインストール可能化 & Web Share Target の動作に必要
// ============================================================
const CACHE_NAME = 'tsundoku-log-v1';
const CACHED_URLS = ['/', '/index.html', '/style.css', '/app.js', '/manifest.json', '/icon.svg'];

// インストール時：静的ファイルをキャッシュ
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CACHED_URLS))
            .then(() => self.skipWaiting())
    );
});

// 有効化時：古いキャッシュを削除
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys
                .filter(k => k !== CACHE_NAME)
                .map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// フェッチ：キャッシュ優先（なければネットワーク）
self.addEventListener('fetch', event => {
    // Supabase API へのリクエストはキャッシュしない
    if (event.request.url.includes('supabase.co')) {
        event.respondWith(fetch(event.request));
        return;
    }
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request))
    );
});
