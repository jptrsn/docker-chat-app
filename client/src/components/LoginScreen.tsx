'use client'

import { useState } from 'react'

interface LoginScreenProps {
  onLogin: (username: string) => void
  onBackToConfig: () => void
  isConnecting: boolean
  connectionError: string | null
}

export default function LoginScreen({ 
  onLogin, 
  onBackToConfig, 
  isConnecting, 
  connectionError 
}: LoginScreenProps) {
  const [username, setUsername] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validate username
    if (!username.trim()) {
      setError('Please enter a username')
      return
    }

    if (username.length > 20) {
      setError('Username must be 20 characters or less')
      return
    }

    const validUsername = /^[a-zA-Z0-9_-]+$/.test(username.trim())
    if (!validUsername) {
      setError('Username can only contain letters, numbers, hyphens, and underscores')
      return
    }

    setIsSubmitting(true)

    try {
      await onLogin(username.trim())
    } catch (err) {
      setError('Failed to join chat. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-md p-8 animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4 animate-bounce-gentle">
            <img 
              src="/logo.svg" 
              alt="Bootcamp Logo" 
              className="w-16 h-16 mx-auto"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Join the Chat</h1>
          <p className="text-gray-600">Enter your username to start chatting</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="input-group">
            <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
              Username
            </label>
            <div className="relative">
              <i className="input-icon fas fa-user"></i>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username..."
                maxLength={20}
                className="input-field input-with-icon"
                disabled={isSubmitting || isConnecting}
                autoComplete="off"
                autoFocus
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Letters, numbers, hyphens, and underscores only (max 20 characters)
            </p>
          </div>

          {(error || connectionError) && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in">
              <div className="flex items-center">
                <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>
                <p className="text-sm text-red-700">{error || connectionError}</p>
              </div>
            </div>
          )}

          {isConnecting && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg animate-fade-in">
              <div className="flex items-center">
                <i className="fas fa-spinner fa-spin text-blue-500 mr-2"></i>
                <p className="text-sm text-blue-700">Connecting to server...</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <button
              type="submit"
              disabled={isSubmitting || isConnecting || !username.trim()}
              className="btn btn-primary w-full py-3 text-base"
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  Joining Chat...
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt"></i>
                  Join Chat
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onBackToConfig}
              disabled={isSubmitting}
              className="btn btn-secondary w-full py-2"
            >
              <i className="fas fa-cog"></i>
              Change Server Settings
            </button>
          </div>
        </form>

        <div className="mt-8 p-4 bg-green-50 rounded-lg">
          <h3 className="text-sm font-semibold text-green-800 mb-2 flex items-center">
            <i className="fas fa-info-circle mr-2"></i>
            Chat Guidelines
          </h3>
          <ul className="text-xs text-green-700 space-y-1">
            <li>• Be respectful to other participants</li>
            <li>• Keep messages relevant to the bootcamp</li>
            <li>• Use appropriate language</li>
            <li>• Have fun learning Docker!</li>
          </ul>
        </div>
      </div>
    </div>
  )
}