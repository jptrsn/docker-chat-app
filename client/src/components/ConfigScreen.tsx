'use client'

import { useState } from 'react'
import type { ServerConfig } from '@/types'

interface ConfigScreenProps {
  onConfigSubmit: (config: ServerConfig) => void
  initialConfig?: ServerConfig | null
}

export default function ConfigScreen({ onConfigSubmit, initialConfig }: ConfigScreenProps) {
  // Use initial config or detect from current location
  const getInitialValues = () => {
    if (initialConfig) {
      return {
        url: initialConfig.url,
        port: initialConfig.port.toString()
      }
    }
    
    // Fallback defaults
    return {
      url: 'http://localhost',
      port: '3001'
    }
  }

  const initialValues = getInitialValues()
  const [url, setUrl] = useState(initialValues.url)
  const [port, setPort] = useState(initialValues.port)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    // Basic validation
    if (!url.trim()) {
      setError('Server URL is required')
      setIsSubmitting(false)
      return
    }

    if (!port.trim()) {
      setError('Port is required')
      setIsSubmitting(false)
      return
    }

    const portNumber = parseInt(port, 10)
    if (isNaN(portNumber) || portNumber < 1 || portNumber > 65535) {
      setError('Port must be a valid number between 1 and 65535')
      setIsSubmitting(false)
      return
    }

    // Clean up URL format
    let cleanUrl = url.trim()
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `http://${cleanUrl}`
    }

    // Remove trailing slash
    cleanUrl = cleanUrl.replace(/\/$/, '')

    try {
      // Test connection to the server
      const testUrl = `${cleanUrl}:${portNumber}/api/health`
      const response = await fetch(testUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        // Add a timeout
        signal: AbortSignal.timeout(10000)
      })

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`)
      }

      const data = await response.json()
      if (data.status !== 'OK') {
        throw new Error('Server health check failed')
      }

      // Connection successful
      onConfigSubmit({
        url: cleanUrl,
        port: portNumber
      })
    } catch (err) {
      console.error('Connection test failed:', err)
      if (err instanceof Error) {
        if (err.name === 'TimeoutError') {
          setError('Connection timeout - please check server URL and port')
        } else if (err.message.includes('Failed to fetch')) {
          setError('Unable to connect - please verify the server is running and accessible')
        } else {
          setError(`Connection failed: ${err.message}`)
        }
      } else {
        setError('Failed to connect to server - please check your configuration')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">
            <i className="fab fa-docker text-docker-blue"></i>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Docker Chat</h1>
          <p className="text-gray-600">Configure your chat server connection</p>
          {initialConfig && (
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-700 flex items-center justify-center">
                <i className="fas fa-magic mr-2"></i>
                Auto-detected from your current location
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="input-group">
            <label htmlFor="server-url" className="block text-sm font-semibold text-gray-700 mb-2">
              Server URL
            </label>
            <div className="relative">
              <i className="input-icon fas fa-server"></i>
              <input
                id="server-url"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost or http://192.168.1.100"
                className="input-field input-with-icon"
                disabled={isSubmitting}
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter the server URL (with http:// or https://)
            </p>
          </div>

          <div className="input-group">
            <label htmlFor="server-port" className="block text-sm font-semibold text-gray-700 mb-2">
              Port
            </label>
            <div className="relative">
              <i className="input-icon fas fa-plug"></i>
              <input
                id="server-port"
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder="3001"
                min="1"
                max="65535"
                className="input-field input-with-icon"
                disabled={isSubmitting}
                autoComplete="off"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Port number where the chat server is running
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
              <div className="flex items-center">
                <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary w-full py-3 text-base"
          >
            {isSubmitting ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Testing Connection...
              </>
            ) : (
              <>
                <i className="fas fa-plug"></i>
                Connect to Server
              </>
            )}
          </button>
        </form>

        <div className="mt-8 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-800 mb-2 flex items-center">
            <i className="fas fa-info-circle mr-2"></i>
            Quick Setup
          </h3>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Current page: {typeof window !== 'undefined' ? window.location.host : 'N/A'}</li>
            <li>• Auto-detected: {initialConfig ? `${initialConfig.url}:${initialConfig.port}` : 'None'}</li>
            <li>• For local development: http://localhost:3001</li>
            <li>• For Docker containers: http://chat-server:3001</li>
          </ul>
        </div>
      </div>
    </div>
  )
}