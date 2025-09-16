'use client'

import { useState, useRef, useEffect } from 'react'
import type { Message, ServerConfig } from '@/types'
import { linkify, getFirstUrl, containsUrls } from '@/utils'
import UrlPreview from './UrlPreview'

interface ChatScreenProps {
  messages: Message[]
  activeUsers: string[]
  typingUsers: string[]
  currentUsername: string | null
  onSendMessage: (message: string) => void
  onLogout: () => void
  onTyping: () => void
  onStopTyping: () => void
  serverConfig: ServerConfig | null
}

export default function ChatScreen({
  messages = [],
  activeUsers = [],
  typingUsers = [],
  currentUsername,
  onSendMessage,
  onLogout,
  onTyping,
  onStopTyping,
  serverConfig
}: ChatScreenProps) {
  const [messageInput, setMessageInput] = useState('')
  const [showSidebar, setShowSidebar] = useState(false)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [messages])

  // Focus message input on mount
  useEffect(() => {
    messageInputRef.current?.focus()
  }, [])

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    if (messageInput.trim()) {
      onSendMessage(messageInput.trim())
      setMessageInput('')
      onStopTyping()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value)
    if (e.target.value.length > 0) {
      onTyping()
    } else {
      onStopTyping()
    }
  }

  const handleKeyUp = () => {
    if (messageInput.trim().length === 0) {
      onStopTyping()
    }
  }

  const formatTimestamp = (timestamp: Date | string) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const renderMessageContent = (message: string) => {
    const linkedContent = linkify(message)
    return { __html: linkedContent }
  }

  const isOwnMessage = (username: string) => username === currentUsername
  const isSystemMessage = (username: string) => username === 'System'

  return (
    <div className="flex flex-col h-screen bg-chat-bg">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="lg:hidden btn btn-secondary p-2"
          >
            <i className="fas fa-bars"></i>
          </button>
          
          <div className="flex items-center space-x-3">
            <i className="fab fa-docker text-docker-blue text-2xl"></i>
            <div>
              <h1 className="font-bold text-lg text-gray-800">Docker Bootcamp</h1>
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium">
                  #general
                </span>
                {serverConfig && (
                  <span className="text-xs">
                    {serverConfig.url}:{serverConfig.port}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
            <i className="fas fa-users"></i>
            <span>{activeUsers?.length || 0} online</span>
          </div>
          
          <button
            onClick={onLogout}
            className="btn btn-secondary"
          >
            <i className="fas fa-sign-out-alt"></i>
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`
          ${showSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          fixed lg:relative inset-y-0 left-0 z-50 w-64 bg-chat-sidebar border-r border-gray-200 transition-transform duration-300 ease-in-out flex flex-col
        `}>
          {/* Mobile close button */}
          <div className="lg:hidden flex justify-between items-center p-4 border-b">
            <h3 className="font-semibold text-gray-800">Chat Info</h3>
            <button
              onClick={() => setShowSidebar(false)}
              className="btn btn-secondary p-2"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-custom p-4">
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <i className="fas fa-users mr-2"></i>
                Online Users ({activeUsers?.length || 0})
              </h3>
              
              <div className="space-y-2">
                {activeUsers?.map((user) => (
                  <div
                    key={user}
                    className={`
                      flex items-center space-x-3 p-2 rounded-lg transition-colors
                      ${user === currentUsername 
                        ? 'bg-docker-blue/10 border border-docker-blue/20' 
                        : 'bg-gray-50 hover:bg-gray-100'
                      }
                    `}
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className={`text-sm font-medium ${user === currentUsername ? 'text-docker-blue' : 'text-gray-700'}`}>
                      {user}
                      {user === currentUsername && (
                        <span className="text-xs text-gray-500 ml-1">(you)</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Room info */}
            <div className="border-t pt-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Room Information
              </h4>
              <div className="space-y-2 text-xs text-gray-600">
                <div>Room: #general</div>
                <div>Messages: {messages?.length || 0}</div>
                <div>Created for Docker Bootcamp</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Sidebar overlay for mobile */}
        {showSidebar && (
          <div
            className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowSidebar(false)}
          />
        )}

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Messages Container */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto scrollbar-custom p-4 space-y-4"
          >
            {messages?.map((message, index) => {
              const hasUrls = containsUrls(message.message)
              const firstUrl = hasUrls ? getFirstUrl(message.message) : null
              
              return (
                <div
                  key={index}
                  className={`
                    animate-message flex flex-col
                    ${isOwnMessage(message.username) 
                      ? 'items-end' 
                      : isSystemMessage(message.username) 
                        ? 'items-center' 
                        : 'items-start'
                    }
                  `}
                >
                  {!isSystemMessage(message.username) && (
                    <div className={`
                      text-xs text-gray-500 mb-1 flex items-center space-x-2
                      ${isOwnMessage(message.username) ? 'flex-row-reverse space-x-reverse' : ''}
                    `}>
                      <span className="font-medium">
                        {isOwnMessage(message.username) ? 'You' : message.username}
                      </span>
                      <span>{formatTimestamp(message.timestamp)}</span>
                    </div>
                  )}

                  <div className={`
                    message-bubble
                    ${isOwnMessage(message.username) 
                      ? 'message-own' 
                      : isSystemMessage(message.username) 
                        ? 'message-system' 
                        : 'message-other'
                    }
                  `}>
                    <div 
                      dangerouslySetInnerHTML={renderMessageContent(message.message)}
                      className="break-words"
                    />
                  </div>

                  {/* URL Preview - only show for non-system messages with URLs */}
                  {!isSystemMessage(message.username) && firstUrl && (
                    <div className={`
                      ${isOwnMessage(message.username) ? 'self-end' : 'self-start'}
                    `}>
                      <UrlPreview 
                        url={firstUrl} 
                        serverUrl={serverConfig ? `${serverConfig.url}:${serverConfig.port}` : undefined}
                      />
                    </div>
                  )}
                </div>
              )
            })}


            {/* Typing Indicators */}
            {typingUsers && typingUsers.length > 0 && (
              <div className="flex items-center space-x-2 text-sm text-gray-500 animate-typing">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span>
                  {typingUsers.length === 1 
                    ? `${typingUsers[0]} is typing...`
                    : `${typingUsers.length} people are typing...`
                  }
                </span>
              </div>
            )}
          </div>

          {/* Input Container */}
          <div className="bg-white border-t border-gray-200 p-4">
            <form onSubmit={handleSendMessage} className="flex space-x-3">
              <div className="flex-1 relative">
                <input
                  ref={messageInputRef}
                  type="text"
                  value={messageInput}
                  onChange={handleInputChange}
                  onKeyUp={handleKeyUp}
                  placeholder="Type your message..."
                  maxLength={500}
                  className="w-full px-4 py-3 border border-gray-200 rounded-full text-base focus:outline-none focus:border-docker-blue focus:ring-2 focus:ring-docker-blue/20 transition-all duration-200"
                />
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-400">
                  {messageInput.length}/500
                </div>
              </div>
              
              <button
                type="submit"
                disabled={!messageInput.trim()}
                className="btn btn-primary p-3 rounded-full w-12 h-12 flex items-center justify-center"
              >
                <i className="fas fa-paper-plane"></i>
              </button>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}