'use client'

import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents, ServerConfig, ConnectionStatus } from '@/types'

export function useSocket(serverConfig: ServerConfig | null) {
  const socketRef = useRef<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    status: 'disconnected',
    message: 'Not connected'
  })

  const connect = () => {
    if (!serverConfig) {
      setConnectionStatus({
        status: 'error',
        message: 'No server configuration provided'
      })
      return
    }

    if (socketRef.current?.connected) {
      return socketRef.current
    }

    setConnectionStatus({
      status: 'connecting',
      message: 'Connecting to server...'
    })

    // Determine the correct server URL and socket path
    let serverUrl = serverConfig.url
    let socketPath = '/socket.io/'
    
    // For HTTPS production, always use the same domain with default socket.io path
    if (serverUrl.startsWith('https://')) {
      // Production setup - use same domain, default socket.io path
      socketPath = '/socket.io/'
      console.log('🔌 Production HTTPS connection mode')
    } else {
      // Development setup - direct connection to backend
      if (serverConfig.port && serverConfig.port !== 443 && serverConfig.port !== 80) {
        serverUrl = `${serverUrl}:${serverConfig.port}`
      }
      console.log('🔌 Development connection mode')
    }

    console.log('🔌 Connecting to:', serverUrl)
    console.log('🛤️  Socket.IO path:', socketPath)

    try {
      const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
        path: socketPath,
        // Force secure transports for HTTPS
        transports: serverUrl.startsWith('https://') 
          ? ['websocket', 'polling'] 
          : ['polling', 'websocket'],
        timeout: 15000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        forceNew: true,
        // Force secure connection for HTTPS
        secure: serverUrl.startsWith('https://'),
        // Additional options for production
        upgrade: true,
        rememberUpgrade: false,
        // CORS handling
        withCredentials: false,
        // Force HTTPS for production
        forceBase64: false,
        autoConnect: true,
        // Add query parameters to help with debugging
        query: {
          clientVersion: '1.0.0',
          transport: serverUrl.startsWith('https://') ? 'secure' : 'insecure'
        }
      })

      socketRef.current = socket

      // Connection event handlers
      socket.on('connect', () => {
        console.log('✅ Connected to socket server:', socket.id)
        console.log('🚀 Transport:', socket.io.engine.transport.name)
        const isSecure = socket.io.engine.transport.name === 'websocket' ? 
          serverUrl.startsWith('https://') : 
          (socket.io.engine as any).socket?.secure || serverUrl.startsWith('https://')
        console.log('🔒 Secure:', isSecure)
        setConnectionStatus({
          status: 'connected',
          message: `Connected via ${socket.io.engine.transport.name} (${isSecure ? 'secure' : 'insecure'})`
        })
      })

      socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error)
        console.log('🔍 Error message:', error.message)
        
        let errorMessage = 'Connection failed'
        if (error.message.includes('timeout')) {
          errorMessage = 'Connection timeout - server may be unreachable'
        } else if (error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Connection refused - check server status'
        } else if (error.message.includes('Transport')) {
          errorMessage = 'Transport error - trying fallback connection method'
        } else if (error.message.includes('xhr poll error') || error.message.includes('websocket error')) {
          errorMessage = 'Network connectivity issue - check HTTPS/SSL configuration'
        } else {
          errorMessage = `Connection error: ${error.message}`
        }
        
        setConnectionStatus({
          status: 'error',
          message: errorMessage
        })
      })

      socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected:', reason)
        if (reason === 'io server disconnect') {
          // Server initiated disconnect, don't auto-reconnect
          setConnectionStatus({
            status: 'disconnected',
            message: 'Disconnected by server'
          })
        } else {
          // Client or network initiated disconnect, will auto-reconnect
          setConnectionStatus({
            status: 'connecting',
            message: 'Reconnecting...'
          })
        }
      })

      // Use socket.io for built-in Socket.IO manager events
      socket.io.on('reconnect', (attemptNumber: number) => {
        console.log('🔄 Reconnected after', attemptNumber, 'attempts')
        setConnectionStatus({
          status: 'connected',
          message: `Reconnected (attempt ${attemptNumber})`
        })
      })

      socket.io.on('reconnect_attempt', (attemptNumber: number) => {
        console.log('🔄 Reconnection attempt', attemptNumber)
        setConnectionStatus({
          status: 'connecting',
          message: `Reconnecting... (attempt ${attemptNumber})`
        })
      })

      socket.io.on('reconnect_failed', () => {
        console.error('❌ Failed to reconnect')
        setConnectionStatus({
          status: 'error',
          message: 'Failed to reconnect to server'
        })
      })

      // Transport change logging - use engine events
      socket.io.engine.on('upgrade', () => {
        console.log('⬆️ Upgraded to:', socket.io.engine.transport.name)
        const isSecure = socket.io.engine.transport.name === 'websocket' ? 
          serverUrl.startsWith('https://') : 
          (socket.io.engine as any).socket?.secure || serverUrl.startsWith('https://')
        setConnectionStatus(prev => ({
          ...prev,
          message: `Connected via ${socket.io.engine.transport.name} (${isSecure ? 'secure' : 'insecure'})`
        }))
      })

      socket.io.engine.on('upgradeError', (error: Error) => {
        console.warn('⚠️ Transport upgrade failed:', error.message)
      })

      return socket

    } catch (error) {
      console.error('Error creating socket:', error)
      setConnectionStatus({
        status: 'error',
        message: 'Failed to create connection'
      })
      return null
    }
  }

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect()
      socketRef.current = null
      setConnectionStatus({
        status: 'disconnected',
        message: 'Disconnected'
      })
    }
  }

  const emit = <T extends keyof ClientToServerEvents>(
    event: T,
    ...args: Parameters<ClientToServerEvents[T]>
  ) => {
    if (socketRef.current?.connected) {
      // @ts-ignore - TypeScript has issues with the spread operator here
      socketRef.current.emit(event, ...args)
    } else {
      console.warn('Cannot emit event: socket not connected')
    }
  }

  const on = <T extends keyof ServerToClientEvents>(
    event: T,
    handler: ServerToClientEvents[T]
  ) => {
    if (socketRef.current) {
      // Use type assertion to handle the complex Socket.IO typing
      socketRef.current.on(event, handler as any)
    }
  }

  const off = <T extends keyof ServerToClientEvents>(
    event: T,
    handler?: ServerToClientEvents[T]
  ) => {
    if (socketRef.current) {
      // Use type assertion to handle the complex Socket.IO typing
      socketRef.current.off(event, handler as any)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [])

  return {
    socket: socketRef.current,
    connectionStatus,
    connect,
    disconnect,
    emit,
    on,
    off,
    isConnected: socketRef.current?.connected ?? false
  }
}