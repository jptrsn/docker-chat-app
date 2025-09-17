'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import ConfigScreen from '@/components/ConfigScreen'
import LoginScreen from '@/components/LoginScreen'
import ChatScreen from '@/components/ChatScreen'
import ConnectionStatus from '@/components/ConnectionStatus'
import PWAProvider from '@/components/PWAProvider'
import { useSocket } from '@/hooks/useSocket'
import type { ServerConfig, Message, AppScreen, ChatState } from '@/types'

export default function Home() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('config')
  const [chatState, setChatState] = useState<ChatState>({
    isConfigured: false,
    isLoggedIn: false,
    username: null,
    serverConfig: null,
    messages: [],
    activeUsers: [],
    connectionStatus: { status: 'disconnected', message: 'Not connected' },
    typingUsers: []
  })

  const { socket, connectionStatus, connect, disconnect, emit, on, off } = useSocket(chatState.serverConfig)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()
  
  // Create a ref to always have the latest connection status
  const connectionStatusRef = useRef(connectionStatus)
  
  // Update the ref whenever connection status changes
  useEffect(() => {
    connectionStatusRef.current = connectionStatus
  }, [connectionStatus])

  // Check for environment variable configuration on mount
  useEffect(() => {
    const envServerUrl = process.env.NEXT_PUBLIC_SERVER_URL
    
    if (envServerUrl) {
      try {
        const url = new URL(envServerUrl)
        const serverConfig: ServerConfig = {
          url: envServerUrl, // Use the full URL including path
          port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80)
        }
        
        console.log('🔧 Using environment server config:', serverConfig)
        
        setChatState(prev => ({ 
          ...prev, 
          serverConfig,
          isConfigured: true 
        }))
        setCurrentScreen('login')
        return // Exit early if env var is set
      } catch (error) {
        console.error('Invalid NEXT_PUBLIC_SERVER_URL:', error)
        // Fall through to auto-detect based on current host
      }
    }
    
    // If no environment variable, auto-detect server URL based on current host
    if (typeof window !== 'undefined') {
      const currentHost = window.location.hostname
      const currentProtocol = window.location.protocol
      
      // Force HTTP for localhost/local addresses, HTTPS for everything else
      let detectedProtocol = 'https:' // Default to HTTPS
      if (currentHost === 'localhost' || 
          currentHost === '127.0.0.1' || 
          currentHost === '0.0.0.0' ||
          currentHost.startsWith('192.168.') ||
          currentHost.startsWith('10.') ||
          currentHost.startsWith('172.') ||
          currentHost.endsWith('.local')) {
        detectedProtocol = 'http:'
        console.log('🔓 Forcing HTTP for local address:', currentHost)
      } else {
        console.log('🔒 Forcing HTTPS for production domain:', currentHost)
      }
      
      // When behind reverse proxy, use the same domain with detected protocol
      const serverUrl = `${detectedProtocol}//${currentHost}`
      
      const autoDetectedConfig: ServerConfig = {
        url: serverUrl,
        port: detectedProtocol === 'https:' ? 443 : 80
      }
      
      console.log('🔍 Auto-detected server config:', autoDetectedConfig)
      
      // Set the auto-detected config
      setChatState(prev => ({ 
        ...prev, 
        serverConfig: autoDetectedConfig,
        isConfigured: false // Still show config screen for user to confirm
      }))
    }
  }, [])

  // Update connection status
  useEffect(() => {
    console.log('📊 Connection status changed:', connectionStatus)
    setChatState(prev => ({ ...prev, connectionStatus }))
  }, [connectionStatus])

  // Socket event handlers
  useEffect(() => {
    if (!socket) return

    const handleMessage = (data: Message) => {
      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, data]
      }))
    }

    const handleChatHistory = (messages: Message[]) => {
      setChatState(prev => ({
        ...prev,
        messages: messages
      }))
    }

    const handleUserJoined = (username: string) => {
      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, {
          username: 'System',
          message: `${username} joined the chat`,
          timestamp: new Date(),
          room: 'general'
        }]
      }))
    }

    const handleUserLeft = (username: string) => {
      setChatState(prev => ({
        ...prev,
        messages: [...prev.messages, {
          username: 'System',
          message: `${username} left the chat`,
          timestamp: new Date(),
          room: 'general'
        }]
      }))
    }

    const handleActiveUsers = (users: string[]) => {
      setChatState(prev => ({
        ...prev,
        activeUsers: users
      }))
    }

    const handleTyping = (data: { username: string }) => {
      if (data.username !== chatState.username) {
        setChatState(prev => ({
          ...prev,
          typingUsers: [...prev.typingUsers.filter(u => u !== data.username), data.username]
        }))
        
        // Clear typing indicator after 3 seconds
        setTimeout(() => {
          setChatState(prev => ({
            ...prev,
            typingUsers: prev.typingUsers.filter(u => u !== data.username)
          }))
        }, 3000)
      }
    }

    const handleStopTyping = (data: { username: string }) => {
      setChatState(prev => ({
        ...prev,
        typingUsers: prev.typingUsers.filter(u => u !== data.username)
      }))
    }

    const handleError = (message: string) => {
      alert(`Error: ${message}`)
    }

    // Register event listeners
    on('message', handleMessage)
    on('chat-history', handleChatHistory)
    on('user-joined', handleUserJoined)
    on('user-left', handleUserLeft)
    on('active-users', handleActiveUsers)
    on('typing', handleTyping)
    on('stop-typing', handleStopTyping)
    on('error', handleError)

    // Cleanup function
    return () => {
      off('message', handleMessage)
      off('chat-history', handleChatHistory)
      off('user-joined', handleUserJoined)
      off('user-left', handleUserLeft)
      off('active-users', handleActiveUsers)
      off('typing', handleTyping)
      off('stop-typing', handleStopTyping)
      off('error', handleError)
    }
  }, [socket, chatState.username, on, off])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatState.messages])

  // Handle server configuration
  const handleConfigSubmit = useCallback((config: ServerConfig) => {
    // Force HTTP for localhost/local addresses, HTTPS for everything else
    if (typeof window !== 'undefined') {
      const currentHost = window.location.hostname
      const isLocal = currentHost === 'localhost' || 
                      currentHost === '127.0.0.1' || 
                      currentHost === '0.0.0.0' ||
                      currentHost.startsWith('192.168.') ||
                      currentHost.startsWith('10.') ||
                      currentHost.startsWith('172.') ||
                      currentHost.endsWith('.local')
      
      if (isLocal && !config.url.startsWith('http://')) {
        config.url = config.url.replace('https://', 'http://')
        console.log('🔓 Forced HTTP for local address:', config.url)
      } else if (!isLocal && !config.url.startsWith('https://')) {
        config.url = config.url.replace('http://', 'https://')
        console.log('🔒 Forced HTTPS for production domain:', config.url)
      }
    }
    
    setChatState(prev => ({
      ...prev,
      serverConfig: config,
      isConfigured: true
    }))
    setCurrentScreen('login')
  }, [])

  // Handle login
  const handleLogin = useCallback(async (username: string) => {
    console.log('🚀 Login attempt started for username:', username)
    console.log('📊 Initial connection status:', connectionStatusRef.current)
    console.log('🔌 Socket exists:', !!socket)
    console.log('🔌 Socket connected:', socket?.connected)
    
    try {
      // Connect if not already connected
      if (connectionStatusRef.current.status !== 'connected') {
        console.log('⚡ Connection not established, calling connect()')
        connect()
        
        // Wait for connection status to be 'connected'
        const waitForConnection = () => {
          return new Promise<void>((resolve, reject) => {
            console.log('⏳ Starting connection wait with 15s timeout')
            const timeout = setTimeout(() => {
              console.log('❌ Connection timeout reached (15s)')
              console.log('📊 Final connection status:', connectionStatusRef.current)
              console.log('🔌 Final socket state:', { exists: !!socket, connected: socket?.connected })
              reject(new Error('Connection timeout'))
            }, 15000)

            let attemptCount = 0
            // Check connection status periodically
            const checkStatus = () => {
              attemptCount++
              const currentStatus = connectionStatusRef.current
              console.log(`🔄 Connection check #${attemptCount} - Status: ${currentStatus.status}, Message: ${currentStatus.message}`)
              
              if (currentStatus.status === 'connected') {
                console.log('✅ Connection established successfully!')
                clearTimeout(timeout)
                resolve()
              } else if (currentStatus.status === 'error') {
                console.log('❌ Connection error detected:', currentStatus.message)
                clearTimeout(timeout)
                reject(new Error(currentStatus.message))
              } else {
                console.log(`⏳ Still waiting... Status: ${currentStatus.status}`)
                setTimeout(checkStatus, 200)
              }
            }
            
            // Start checking after a brief delay
            console.log('⏳ Starting status checks in 100ms...')
            setTimeout(checkStatus, 100)
          })
        }

        await waitForConnection()
      } else {
        console.log('✅ Already connected, skipping connection wait')
      }
      
      console.log('📤 Sending join event with username:', username)
      // Send join event
      emit('join', username)
      
      console.log('✅ Updating chat state and switching to chat screen')
      setChatState(prev => ({
        ...prev,
        username,
        isLoggedIn: true
      }))
      setCurrentScreen('chat')
      
    } catch (error) {
      console.error('❌ Login failed with error:', error)
      console.log('📊 Error state - Connection status:', connectionStatusRef.current)
      console.log('🔌 Error state - Socket:', { exists: !!socket, connected: socket?.connected })
      alert(`Failed to join chat: ${error instanceof Error ? error.message : 'Unknown error'}. Please check the server connection and try again.`)
    }
  }, [connect, emit, socket]) // Removed connectionStatus from dependencies

  // Handle logout
  const handleLogout = useCallback(() => {
    disconnect()
    setChatState(prev => ({
      ...prev,
      username: null,
      isLoggedIn: false,
      messages: [],
      activeUsers: [],
      typingUsers: []
    }))
    setCurrentScreen('login')
  }, [disconnect])

  // Handle sending messages
  const handleSendMessage = useCallback((message: string) => {
    if (chatState.username && message.trim()) {
      emit('message', {
        username: chatState.username,
        message: message.trim()
      })
    }
  }, [chatState.username, emit])

  // Handle typing indicators
  const handleTyping = useCallback(() => {
    if (chatState.username) {
      emit('typing', { username: chatState.username })
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
      
      // Set new timeout to stop typing
      typingTimeoutRef.current = setTimeout(() => {
        emit('stop-typing', { username: chatState.username! })
      }, 1000)
    }
  }, [chatState.username, emit])

  const handleStopTyping = useCallback(() => {
    if (chatState.username && typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
      emit('stop-typing', { username: chatState.username })
    }
  }, [chatState.username, emit])

  // Handle going back to config
  const handleBackToConfig = useCallback(() => {
    disconnect()
    setChatState(prev => ({
      ...prev,
      serverConfig: null,
      isConfigured: false,
      username: null,
      isLoggedIn: false,
      messages: [],
      activeUsers: [],
      typingUsers: []
    }))
    setCurrentScreen('config')
  }, [disconnect])

  return (
    <PWAProvider>
      <div className="relative w-full h-full">
        {/* Connection Status */}
        <ConnectionStatus 
          connectionStatus={chatState.connectionStatus}
          show={currentScreen === 'chat' || currentScreen === 'login'}
        />

        {/* Screens */}
        {currentScreen === 'config' && (
          <ConfigScreen 
            onConfigSubmit={handleConfigSubmit} 
            initialConfig={chatState.serverConfig}
          />
        )}

        {currentScreen === 'login' && (
          <LoginScreen 
            onLogin={handleLogin}
            onBackToConfig={handleBackToConfig}
            isConnecting={chatState.connectionStatus.status === 'connecting'}
            connectionError={chatState.connectionStatus.status === 'error' ? chatState.connectionStatus.message : null}
          />
        )}

        {currentScreen === 'chat' && chatState.username && (
          <ChatScreen
            messages={chatState.messages || []}
            activeUsers={chatState.activeUsers || []}
            typingUsers={chatState.typingUsers || []}
            currentUsername={chatState.username}
            onSendMessage={handleSendMessage}
            onLogout={handleLogout}
            onTyping={handleTyping}
            onStopTyping={handleStopTyping}
            serverConfig={chatState.serverConfig}
          />
        )}

        {/* Messages scroll anchor */}
        <div ref={messagesEndRef} />
      </div>
    </PWAProvider>
  )
}