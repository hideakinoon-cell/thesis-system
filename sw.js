/* Service Worker สำหรับให้เว็บนี้เปิดใช้งานได้แม้ไม่มีอินเทอร์เน็ตเลย (หลังจากเคยเปิดออนไลน์สำเร็จอย่างน้อย 1 ครั้ง)
   กลยุทธ์: network-first — พยายามโหลดจากเน็ตก่อนเสมอเพื่อให้ได้เวอร์ชันล่าสุดทุกครั้งที่มีเน็ต แล้วเก็บสำเนาไว้ในแคช
   ถ้าโหลดจากเน็ตไม่สำเร็จ (ไม่มีอินเทอร์เน็ต) จึงค่อย fallback ไปใช้สำเนาที่แคชไว้ล่าสุดแทน
   จำกัดขอบเขตเฉพาะไฟล์ของเว็บเอง (index.html, วิดีโอ/รูปพื้นหลัง) และสคริปต์ static จาก CDN ที่รู้จัก —
   ไม่แตะ/ไม่แคช Google Sheets, Google Drive, Google Sign-In (accounts.google.com) หรือ API อื่นใดของ Google
   เพื่อไม่ให้รบกวนระบบตรวจจับออฟไลน์ของแอปที่ทำงานอยู่แล้ว (initOfflineDetection ใน index.html) */
var CACHE_NAME = 'thesis-app-v1';
var CORE_ASSETS = [
  './',
  './index.html',
  './hero-bg.mp4',
  './hero-bg-poster.jpg'
];
var CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return Promise.all(CORE_ASSETS.map(function(url){
        return fetch(url).then(function(res){ return cache.put(url, res); }).catch(function(){});
      }));
    })
  );
});

self.addEventListener('activate', function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return k!==CACHE_NAME; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function shouldHandle(url){
  if(url.origin === self.location.origin) return true;
  return CDN_HOSTS.indexOf(url.hostname) > -1;
}

self.addEventListener('fetch', function(e){
  if(e.request.method !== 'GET') return;
  var url;
  try{ url = new URL(e.request.url); }catch(err){ return; }
  if(!shouldHandle(url)) return; // ปล่อยผ่านตามปกติ ไม่แตะ Google API/Auth ใดๆ ทั้งสิ้น

  e.respondWith(
    fetch(e.request).then(function(res){
      var resClone = res.clone();
      caches.open(CACHE_NAME).then(function(cache){ cache.put(e.request, resClone); }).catch(function(){});
      return res;
    }).catch(function(){
      return caches.match(e.request).then(function(cached){
        if(cached) return cached;
        if(e.request.mode === 'navigate') return caches.match('./index.html');
      });
    })
  );
});
