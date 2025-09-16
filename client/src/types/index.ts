export interface Message {
  id?: number;
  username: string;
  message: string;
  timestamp: Date | string;
  room: string;
}

export interface User {
  id: string;
  username: string;
  joinTime: Date;
}

export interface ServerConfig {
  url: string;
  port: number;
}

export interface ConnectionStatus {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  message: string;
}

export interface ChatState {
  isConfigured: boolean;
  isLoggedIn: boolean;
  username: string | null;
  serverConfig: ServerConfig | null;
  messages: Message[];
  activeUsers: string[];
  connectionStatus: ConnectionStatus;
  typingUsers: string[];
}

// Socket.IO event interfaces
export interface ClientToServerEvents {
  join: (username: string) => void;
  message: (data: { username: string; message: string }) => void;
  typing: (data: { username: string }) => void;
  'stop-typing': (data: { username: string }) => void;
}

export interface ServerToClientEvents {
  message: (data: Message) => void;
  'chat-history': (messages: Message[]) => void;
  'user-joined': (username: string) => void;
  'user-left': (username: string) => void;
  'active-users': (users: string[]) => void;
  typing: (data: { username: string }) => void;
  'stop-typing': (data: { username: string }) => void;
  error: (message: string) => void;
}

export type AppScreen = 'config' | 'login' | 'chat';