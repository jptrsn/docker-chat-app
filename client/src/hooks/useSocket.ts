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

    // Use the serverConfig URL directly (should be https://domain.com/api)
    const serverUrl = serverConfig.port && serverConfig.port !== 443 && serverConfig.port !== 80
      ? `${serverConfig.url}:${serverConfig.port}`
      : serverConfig.url

    console.log('🔌 Connecting to:', serverUrl)

    try {
      const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        forceNew: true,
        // Important: Use secure connection when connecting to HTTPS
        secure: serverUrl.startsWith('https://'),
        // Handle reverse proxy path if needed
        path: '/socket.io/', // Default path, but can be customized
      })

      socketRef.current = socket
      // ... rest of the connection logic
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