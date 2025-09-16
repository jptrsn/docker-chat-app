'use client'

import { useEffect, useState } from 'react'
import type { ConnectionStatus as ConnectionStatusType } from '@/types'

interface ConnectionStatusProps {
  connectionStatus: ConnectionStatusType
  show: boolean
}

export default function ConnectionStatus({ connectionStatus, show }: ConnectionStatusProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!show) {
      setVisible(false)
      return
    }

    if (connectionStatus.status === 'connected') {
      setVisible(true)
      // Hide success message after 3 seconds
      const timer = setTimeout(() => {
        setVisible(false)
      }, 3000)
      return () => clearTimeout(timer)
    } else {
      setVisible(true)
    }
  }, [connectionStatus, show])

  if (!show || !visible) return null

  const getStatusConfig = () => {
    switch (connectionStatus.status) {
      case 'connected':
        return {
          bgColor: 'bg-green-500',
          textColor: 'text-white',
          icon: 'fas fa-check-circle',
          pulse: false
        }
      case 'connecting':
        return {
          bgColor: 'bg-yellow-500',
          textColor: 'text-white',
          icon: 'fas fa-spinner fa-spin',
          pulse: true
        }
      case 'disconnected':
        return {
          bgColor: 'bg-gray-500',
          textColor: 'text-white',
          icon: 'fas fa-exclamation-circle',
          pulse: false
        }
      case 'error':
        return {
          bgColor: 'bg-red-500',
          textColor: 'text-white',
          icon: 'fas fa-exclamation-triangle',
          pulse: false
        }
      default:
        return {
          bgColor: 'bg-gray-500',
          textColor: 'text-white',
          icon: 'fas fa-question-circle',
          pulse: false
        }
    }
  }

  const { bgColor, textColor, icon, pulse } = getStatusConfig()

  return (
    <div className={`
      fixed top-4 right-4 z-50 max-w-sm
      ${bgColor} ${textColor}
      px-4 py-2 rounded-lg shadow-lg
      animate-fade-in
      ${pulse ? 'animate-pulse' : ''}
    `}>
      <div className="flex items-center space-x-2">
        <i className={icon}></i>
        <div>
          <div className="font-semibold text-sm capitalize">
            {connectionStatus.status === 'error' ? 'Connection Error' : connectionStatus.status}
          </div>
          <div className="text-xs opacity-90">
            {connectionStatus.message}
          </div>
        </div>
      </div>
    </div>
  )
}