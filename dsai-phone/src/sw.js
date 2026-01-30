const cacheID = "v2";
// Cache list - only include files that actually exist and are needed for offline
// Note: index.html is always loaded from network, wallpapers are optional
const CacheItems = [
    "/favicon.ico",

    "avatars/default.0.webp",
    "avatars/default.1.webp",
    "avatars/default.2.webp",
    "avatars/default.3.webp",
    "avatars/default.4.webp",
    "avatars/default.5.webp",
    "avatars/default.6.webp",
    "avatars/default.7.webp",
    "avatars/default.8.webp",

    // Wallpapers removed - they load fine from network and cause cache issues
    // "wallpaper.dark.webp",
    // "wallpaper.light.webp",

    "media/Alert.mp3",
    "media/Ringtone_1.mp3",
    "media/speech_orig.mp3",
    "media/Tone_Busy-UK.mp3",
    "media/Tone_Busy-US.mp3",
    "media/Tone_CallWaiting.mp3",
    "media/Tone_Congestion-UK.mp3",
    "media/Tone_Congestion-US.mp3",
    "media/Tone_EarlyMedia-Australia.mp3",
    "media/Tone_EarlyMedia-European.mp3",
    "media/Tone_EarlyMedia-Japan.mp3",
    "media/Tone_EarlyMedia-UK.mp3",
    "media/Tone_EarlyMedia-US.mp3",

    "https://dtd6jl0d42sve.cloudfront.net/lib/jquery/jquery-3.6.1.min.js",
    "https://dtd6jl0d42sve.cloudfront.net/lib/jquery/jquery-ui-1.13.2.min.js",
    "https://dtd6jl0d42sve.cloudfront.net/lib/jquery/jquery.md5-min.js",
    "https://dtd6jl0d42sve.cloudfront.net/lib/Chart/Chart.bundle-2.7.2.min.js",
    "https://dtd6jl0d42sve.cloudfront.net/lib/SipJS/sip-0.20.0.min.js",
    "https://dtd6jl0d42sve.cloudfront.net/lib/FabricJS/fabric-2.4.6.min.js",
    "https://dtd6jl0d42sve.cloudfront.net/lib/Moment/moment-with-locales-2.24.0.min.js",
    "https://dtd6jl0d42sve.cloudfront.net/lib/Croppie/Croppie-2.6.4/croppie.min.js",
    "https://dtd6jl0d42sve.cloudfront.net/lib/XMPP/strophe-1.4.1.umd.min.js",

    "https://dtd6jl0d42sve.cloudfront.net/lib/Normalize/normalize-v8.0.1.css",
    "https://dtd6jl0d42sve.cloudfront.net/lib/fonts/font_roboto/roboto.css",
    "https://dtd6jl0d42sve.cloudfront.net/lib/fonts/font_awesome/css/font-awesome.min.css",
    "https://dtd6jl0d42sve.cloudfront.net/lib/jquery/jquery-ui-1.13.2.min.css",
    "https://dtd6jl0d42sve.cloudfront.net/lib/Croppie/Croppie-2.6.4/croppie.css",

    "phone.js",
    "phone.css",
    "phone.light.css",
    "phone.dark.css"

];

self.addEventListener('install', function(event){
    console.log("Service Worker: Install");
    event.waitUntil(caches.open(cacheID).then(async function(cache){
        console.log("Cache open, adding Items individually...");
        // Cache items individually to avoid failing if any single item fails
        let successCount = 0;
        let failCount = 0;
        for (const item of CacheItems) {
            try {
                await cache.add(item);
                successCount++;
            } catch (error) {
                failCount++;
                console.warn("Failed to cache:", item);
            }
        }
        console.log("Cache complete. Success:", successCount, "Failed:", failCount);
    }).then(function(){
        console.log("Service Worker: skipWaiting");
        // Skip waiting to activate
        self.skipWaiting();
    }).catch(function(error){
        console.warn("Error opening Cache:", error);
        // Skip waiting to activate
        self.skipWaiting();
    }));
});

self.addEventListener('activate', function(event){
    console.log("Service Worker: Activate");
    // Clear old caches when new service worker activates
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.filter(function(cacheName) {
                    return cacheName !== cacheID;
                }).map(function(cacheName) {
                    console.log("Service Worker: Clearing old cache:", cacheName);
                    return caches.delete(cacheName);
                })
            );
        }).then(function() {
            return clients.claim();
        })
    );
});

self.addEventListener("fetch", function(event){
    // Skip non-cacheable requests (non-GET, non-http/https)
    const url = new URL(event.request.url);
    if (event.request.method !== 'GET' || (url.protocol !== 'http:' && url.protocol !== 'https:')) {
        return; // Let the browser handle it normally
    }

    if(event.request.url.endsWith("index.html")){
        console.log("Special Home Page handling...", event.request.url);
        event.respondWith(loadHomePage(event.request));
    }
    else {
        // Other Request
        event.respondWith(loadFromCacheFirst(event.request));
    }
});


const loadFromCacheFirst = async function(request) {
    // First try to get the resource from the cache
    const responseFromCache = await caches.match(request);
    if (responseFromCache) {
        return responseFromCache;
    }
    // Next try to get the resource from the network
    try {
        const responseFromNetwork = await fetch(request);
        if(responseFromNetwork.ok){
            // If the request was fine, add it to the cache
            addToCache(request, responseFromNetwork.clone());
        }
        return responseFromNetwork;
    } 
    catch (error) {
        return new Response("Network Error", { status: 408, statusText : "Network Error", headers: { "Content-Type": "text/plain" },});
    }
}
const loadHomePage = async function(request) {
    // First try to get the resource from the network
    try {
        const responseFromNetwork = await fetch(request);
        if(responseFromNetwork.ok){
            // Normal Response from server
            return responseFromNetwork;
        } else {
            throw new Error("Server Error");
        }
    }
    catch (error) {
        // Return error response if network fails (no offline page available)
        return new Response("Network Error - Please check your connection", {
            status: 408,
            statusText: "Network Error",
            headers: { "Content-Type": "text/plain" }
        });
    }
}
const addToCache = async function(request, response) {
    // Only cache GET requests with http/https schemes
    // Service Workers cannot cache POST requests or non-http schemes (like chrome-extension://)
    if (request.method !== 'GET') {
        return;
    }
    const url = new URL(request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return;
    }
    try {
        const cache = await caches.open(cacheID);
        await cache.put(request, response);
    } catch (error) {
        console.warn("Failed to cache:", request.url, error);
    }
}
