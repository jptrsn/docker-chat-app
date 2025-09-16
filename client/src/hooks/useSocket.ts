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

    const serverUrl = serverConfig.port 
      ? `${serverConfig.url}:${serverConfig.port}`
      : serverConfig.url

    try {
      const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
        forceNew: true
      })

      socketRef.current = socket

      socket.on('connect', () => {
        console.log('✅ Connected to chat server')
        setConnectionStatus({
          status: 'connected',
          message: 'Connected to server'
        })
      })

      socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected from chat server:', reason)
        setConnectionStatus({
          status: 'disconnected',
          message: `Disconnected: ${reason}`
        })
      })

      socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error)
        setConnectionStatus({
          status: 'error',
          message: `Connection error: ${error.message}`
        })
      })

      socket.io.on('reconnect', (attemptNumber) => {
        console.log(`🔄 Reconnected after ${attemptNumber} attempts`)
        setConnectionStatus({
          status: 'connected',
          message: 'Reconnected to server'
        })
      })

      socket.io.on('reconnect_error', (error) => {
        console.error('🔄❌ Reconnection error:', error)
        setConnectionStatus({
          status: 'error',
          message: 'Failed to reconnect'
        })
      })

      socket.io.on('reconnect_failed', () => {
        console.error('🔄❌ Reconnection failed completely')
        setConnectionStatus({
          status: 'error',
          message: 'Connection lost - please refresh'
        })
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
      socketRef.current.on(event, handler)
    }
  }

  const off = <T extends keyof ServerToClientEvents>(
    event: T,
    handler?: ServerToClientEvents[T]
  ) => {
    if (socketRef.current) {
      socketRef.current.off(event, handler)
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