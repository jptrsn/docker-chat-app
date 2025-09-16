export interface Message {
  id?: number;
  username: string;
  message: string;
  timestamp: Date;
  room: string;
}

export interface User {
  id: string;
  username: string;
  joinTime: Date;
}

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

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  username?: string;
  joinTime?: Date;
}