'use client'

import { useEffect, useState } from 'react'

interface PWAProps {
  children: React.ReactNode
}

export default function PWAProvider({ children }: PWAProps) {
  const [isInstallable, setIsInstallable] = useState(false)
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showInstallBanner, setShowInstallBanner] = useState(false)
  const [swUpdate, setSWUpdate] = useState(false)

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    const isInWebAppiOS = (window.navigator as any).standalone === true
    const isInstalled = isStandalone || isInWebAppiOS
    
    setIsInstalled(isInstalled)

    // Register service worker
    if ('serviceWorker' in navigator) {
      registerServiceWorker()
    }

    // Handle install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
      setIsInstallable(true)
      
      // Show install banner after 10 seconds if not dismissed
      setTimeout(() => {
        if (!isInstalled && !localStorage.getItem('pwa-install-dismissed')) {
          setShowInstallBanner(true)
        }
      }, 10000)
    }

    // Handle app installed
    const handleAppInstalled = () => {
      setIsInstallable(false)
      setInstallPrompt(null)
      setIsInstalled(true)
      setShowInstallBanner(false)
      console.log('✅ PWA was installed successfully')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [isInstalled])

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      })

      console.log('✅ Service Worker registered successfully:', registration.scope)

      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('🔄 New service worker available')
              setSWUpdate(true)
            }
          })
        }
      })

      // Handle controlling service worker change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 Service worker controller changed, reloading...')
        window.location.reload()
      })

    } catch (error) {
      console.error('❌ Service Worker registration failed:', error)
    }
  }

  const handleInstallClick = async () => {
    if (!installPrompt) return

    try {
      const result = await installPrompt.prompt()
      console.log('📱 Install prompt result:', result)
      
      if (result.outcome === 'accepted') {
        console.log('✅ User accepted the install prompt')
      } else {
        console.log('❌ User dismissed the install prompt')
      }
      
      setInstallPrompt(null)
      setIsInstallable(false)
      setShowInstallBanner(false)
    } catch (error) {
      console.error('❌ Error during install:', error)
    }
  }

  const handleDismissInstall = () => {
    setShowInstallBanner(false)
    localStorage.setItem('pwa-install-dismissed', 'true')
  }

  const handleUpdateClick = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister().then(() => {
            window.location.reload()
          })
        })
      })
    }
  }

  return (
    <>
      {children}
      
      {/* Install Banner */}
      {showInstallBanner && !isInstalled && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50 animate-fade-in">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-docker-blue rounded-lg flex items-center justify-center">
                <i className="fas fa-mobile-alt text-white text-lg"></i>
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">
                Install Bootcamp Chat
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                Add to your home screen for quick access and offline support
              </p>
              
              <div className="flex space-x-2">
                <button
                  onClick={handleInstallClick}
                  className="btn btn-primary text-xs px-3 py-1.5"
                >
                  <i className="fas fa-download mr-1"></i>
                  Install
                </button>
                <button
                  onClick={handleDismissInstall}
                  className="btn btn-secondary text-xs px-3 py-1.5"
                >
                  Not now
                </button>
              </div>
            </div>
            
            <button
              onClick={handleDismissInstall}
              className="flex-shrink-0 text-gray-400 hover:text-gray-600"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      )}

      {/* Update Banner */}
      {swUpdate && (
        <div className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-blue-600 text-white rounded-lg shadow-lg p-4 z-50 animate-fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-sm mb-1">Update Available</h4>
              <p className="text-xs opacity-90">
                A new version of the app is ready
              </p>
            </div>
            <button
              onClick={handleUpdateClick}
              className="bg-white text-blue-600 px-3 py-1.5 rounded text-xs font-semibold hover:bg-gray-100 transition-colors"
            >
              Update
            </button>
          </div>
        </div>
      )}

      {/* Offline Status Indicator */}
      <OfflineIndicator />
    </>
  )
}

// Offline status component
function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine)
    }

    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    // Initial check
    updateOnlineStatus()

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  if (isOnline) return null

  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-yellow-500 text-white px-4 py-2 rounded-full shadow-lg z-50 text-sm font-medium animate-fade-in">
      <i className="fas fa-wifi-slash mr-2"></i>
      You're offline
    </div>
  )
}