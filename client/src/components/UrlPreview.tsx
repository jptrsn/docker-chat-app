'use client'

import { useState, useEffect } from 'react'

interface UrlMetadata {
  title?: string
  description?: string
  image?: string
  siteName?: string
  url?: string
  favicon?: string
}

interface UrlPreviewProps {
  url: string
  className?: string
  serverUrl?: string // Add server URL prop
}

export default function UrlPreview({ url, className = '', serverUrl }: UrlPreviewProps) {
  const [metadata, setMetadata] = useState<UrlMetadata | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [networkError, setNetworkError] = useState(false)

  useEffect(() => {
    if (!url) return

    const fetchMetadata = async () => {
      setLoading(true)
      setError(false)
      setNetworkError(false)
      setMetadata(null) // Clear previous metadata
      
      try {
        // Clean and validate URL
        let cleanUrl = url.trim()
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          cleanUrl = 'https://' + cleanUrl
        }

        // Validate URL format
        new URL(cleanUrl)
        
        // Use server endpoint for metadata
        const metadataUrl = serverUrl 
          ? `${serverUrl}/api/metadata?url=${encodeURIComponent(cleanUrl)}`
          : `/api/metadata?url=${encodeURIComponent(cleanUrl)}`

        console.log(`🔍 Fetching metadata from server: ${metadataUrl}`)
        
        const response = await fetch(metadataUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(15000) // 15 second timeout
        })

        if (!response.ok) {
          if (response.status === 404) {
            console.log('No metadata available for URL:', cleanUrl)
            setError(true)
            return
          }
          throw new Error(`HTTP ${response.status}`)
        }

        const metadata = await response.json()
        
        if (metadata && (metadata.title || metadata.description)) {
          console.log('✅ Metadata retrieved successfully')
          setMetadata({
            title: metadata.title?.trim() || '',
            description: metadata.description?.trim() || '',
            image: metadata.image?.trim() || '',
            siteName: metadata.siteName?.trim() || '',
            url: metadata.url || cleanUrl,
            favicon: metadata.favicon?.trim() || ''
          })
        } else {
          setError(true)
        }
      } catch (err) {
        console.error('Error fetching URL metadata:', err)
        
        // Check if it's a network-related error
        if (err instanceof Error) {
          if (err.message.includes('Failed to fetch') || 
              err.message.includes('Network Error') ||
              err.name === 'TypeError') {
            setNetworkError(true)
            console.warn('Network error detected, URL previews may not work from this network location')
          }
        }
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    // Start loading immediately
    fetchMetadata()
  }, [url])

  const handleClick = () => {
    // Try to use metadata URL first, fallback to original URL
    const targetUrl = metadata?.url || url
    let finalUrl = targetUrl
    
    // Ensure URL has protocol
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl
    }
    
    window.open(finalUrl, '_blank', 'noopener,noreferrer')
  }

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.target as HTMLImageElement
    img.style.display = 'none'
  }

  // Show loading placeholder while fetching
  if (loading) {
    return (
      <div className={`
        mt-2 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 max-w-md animate-pulse
        ${className}
      `}>
        {/* Loading image placeholder */}
        <div className="w-full h-32 bg-gray-200 flex items-center justify-center">
          <i className="fas fa-spinner fa-spin text-gray-400 text-xl"></i>
        </div>
        
        {/* Loading content placeholder */}
        <div className="p-3">
          {/* Site name placeholder */}
          <div className="flex items-center gap-2 mb-2">
            <div className="w-4 h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-20 h-3 bg-gray-200 rounded animate-pulse"></div>
          </div>

          {/* Title placeholder */}
          <div className="space-y-2 mb-2">
            <div className="w-3/4 h-4 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-1/2 h-4 bg-gray-200 rounded animate-pulse"></div>
          </div>

          {/* Description placeholder */}
          <div className="space-y-1 mb-2">
            <div className="w-full h-3 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-4/5 h-3 bg-gray-200 rounded animate-pulse"></div>
          </div>

          {/* URL placeholder */}
          <div className="w-32 h-3 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    )
  }

  // Show a minimal link card for network errors
  if (networkError && !metadata) {
    return (
      <div className={`
        mt-2 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 hover:bg-gray-100 
        cursor-pointer transition-colors duration-200 max-w-md
        ${className}
      `}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick()
          }
        }}
      >
        <div className="p-3">
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <i className="fas fa-link"></i>
            <span>Link Preview</span>
            <i className="fas fa-external-link-alt text-gray-400 ml-auto"></i>
          </div>
          <div className="text-blue-600 text-sm truncate">
            {url}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Click to open in new tab
          </div>
        </div>
      </div>
    )
  }

  // Don't render anything if error (but not network error) or no metadata
  if (error || !metadata) {
    return null
  }

  // Don't render if no meaningful content
  if (!metadata.title && !metadata.description && !metadata.image) {
    return null
  }

  return (
    <div 
      className={`
        mt-2 border border-gray-200 rounded-lg overflow-hidden bg-gray-50 hover:bg-gray-100 
        cursor-pointer transition-colors duration-200 max-w-md
        ${className}
      `}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick()
        }
      }}
    >
      {/* Image */}
      {metadata.image && (
        <div className="relative w-full h-32 bg-gray-200">
          <img
            src={metadata.image}
            alt={metadata.title || 'Link preview image'}
            className="w-full h-full object-cover"
            onError={handleImageError}
            loading="lazy"
          />
        </div>
      )}
      
      {/* Content */}
      <div className="p-3">
        {/* Site name and favicon */}
        {(metadata.siteName || metadata.favicon) && (
          <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
            {metadata.favicon && (
              <img
                src={metadata.favicon}
                alt=""
                className="w-4 h-4 rounded"
                onError={(e) => {
                  const img = e.target as HTMLImageElement
                  img.style.display = 'none'
                }}
              />
            )}
            {metadata.siteName && (
              <span className="truncate">{metadata.siteName}</span>
            )}
            <i className="fas fa-external-link-alt text-gray-400 ml-auto"></i>
          </div>
        )}

        {/* Title */}
        {metadata.title && (
          <h4 className="font-semibold text-gray-900 text-sm mb-1 line-clamp-2 leading-tight">
            {metadata.title}
          </h4>
        )}

        {/* Description */}
        {metadata.description && (
          <p className="text-gray-600 text-xs line-clamp-2 leading-relaxed">
            {metadata.description}
          </p>
        )}

        {/* URL */}
        <div className="mt-2 text-xs text-blue-600 truncate">
          {metadata.url ? new URL(metadata.url).hostname : url}
        </div>
      </div>
    </div>
  )
}