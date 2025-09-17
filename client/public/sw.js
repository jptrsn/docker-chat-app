// service-worker.js
const CACHE_NAME = 'docker-bootcamp-chat-v1.0.0'
const STATIC_CACHE_NAME = `${CACHE_NAME}-static`
const DYNAMIC_CACHE_NAME = `${CACHE_NAME}-dynamic`

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/logo.svg',
  '/favicon.png'
]

// Assets that should always be fetched from network
const NETWORK_FIRST = [
  '/api/',
  '/socket.io/',
  '/_next/static/'
]

// Assets that can be cached with fallback to network
const CACHE_FIRST = [
  '.js',
  '.css',
  '.woff2',
  '.woff',
  '.ttf',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker: Installing...')
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log('✅ Service Worker: Installation complete')
        // Take control immediately
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('❌ Service Worker: Installation failed', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker: Activating...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete old cache versions
            if (cacheName.startsWith('docker-bootcamp-chat-') && 
                cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME) {
              console.log('🗑️ Service Worker: Deleting old cache', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => {
        console.log('✅ Service Worker: Activation complete')
        // Take control of all pages immediately
        return self.clients.claim()
      })
      .catch((error) => {
        console.error('❌ Service Worker: Activation failed', error)
      })
  )
})

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return
  }

  // Network first for API calls, Socket.IO, and Next.js assets
  if (NETWORK_FIRST.some(pattern => url.pathname.startsWith(pattern))) {
    event.respondWith(networkFirst(request))
    return
  }

  // Cache first for static assets
  if (CACHE_FIRST.some(ext => url.pathname.endsWith(ext))) {
    event.respondWith(cacheFirst(request))
    return
  }

  // Stale while revalidate for pages
  event.respondWith(staleWhileRevalidate(request))
})

// Network first strategy - for critical dynamic content
async function networkFirst(request) {
  try {
    console.log('🌐 Network First:', request.url)
    const networkResponse = await fetch(request)
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.log('📦 Network failed, trying cache:', request.url)
    const cachedResponse = await caches.match(request)
    
    if (cachedResponse) {
      return cachedResponse
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/') || new Response('App is offline', {
        status: 503,
        statusText: 'Service Unavailable'
      })
    }
    
    throw error
  }
}

// Cache first strategy - for static assets
async function cacheFirst(request) {
  console.log('📦 Cache First:', request.url)
  const cachedResponse = await caches.match(request)
  
  if (cachedResponse) {
    return cachedResponse
  }
  
  try {
    const networkResponse = await fetch(request)
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }
    
    return networkResponse
  } catch (error) {
    console.error('❌ Cache and network failed:', request.url, error)
    throw error
  }
}

// Stale while revalidate strategy - for pages
async function staleWhileRevalidate(request) {
  console.log('🔄 Stale While Revalidate:', request.url)
  const cache = await caches.open(DYNAMIC_CACHE_NAME)
  const cachedResponse = await caches.match(request)
  
  // Always fetch from network in background
  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone())
      }
      return networkResponse
    })
    .catch(() => {
      // Network failed, just ignore
    })
  
  // Return cached version immediately if available
  if (cachedResponse) {
    // Start background update
    fetchPromise
    return cachedResponse
  }
  
  // No cached version, wait for network
  try {
    return await fetchPromise
  } catch (error) {
    // Network failed and no cache
    if (request.mode === 'navigate') {
      return new Response(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Offline - Docker Bootcamp Chat</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                margin: 0; padding: 20px; text-align: center; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; min-height: 100vh; display: flex;
                align-items: center; justify-content: center; flex-direction: column;
              }
              .container { background: rgba(255,255,255,0.1); padding: 40px; border-radius: 20px; }
              .icon { font-size: 64px; margin-bottom: 20px; }
              h1 { margin-bottom: 10px; }
              button { 
                background: #0db7ed; color: white; border: none; 
                padding: 12px 24px; border-radius: 8px; cursor: pointer;
                font-size: 16px; margin-top: 20px;
              }
              button:hover { background: #0a9bc7; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="icon">📱</div>
              <h1>You're Offline</h1>
              <p>Docker Bootcamp Chat is not available right now.</p>
              <p>Check your internet connection and try again.</p>
              <button onclick="location.reload()">Try Again</button>
            </div>
          </body>
        </html>
      `, {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/html' }
      })
    }
    
    throw error
  }
}

// Handle background sync for offline actions (future enhancement)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('🔄 Background sync triggered')
    // Handle offline message queue here
  }
})

// Handle push notifications (future enhancement)
self.addEventListener('push', (event) => {
  console.log('📨 Push notification received')
  
  if (event.data) {
    const data = event.data.json()
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'New Message', {
        body: data.body || 'You have a new message in Docker Bootcamp Chat',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/badge-72x72.png',
        tag: 'chat-message',
        requireInteraction: false,
        silent: false,
        data: {
          url: data.url || '/'
        }
      })
    )
  }
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('🔔 Notification clicked')
  
  event.notification.close()
  
  const url = event.notification.data?.url || '/'
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' })
      .then((clients) => {
        // Check if app is already open
        for (const client of clients) {
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }
        
        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(url)
        }
      })
  )
})