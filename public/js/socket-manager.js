/**
 * Socket Manager for real-time messaging
 * Handles socket.io connections and message delivery
 */

class SocketManager {
  constructor() {
    // Create socket connection with debugging
    console.log('Initializing socket connection');
    
    this.socket = io({
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
      forceNew: true
    });
    
    this.messageHandlers = [];
    this.connectionHandlers = [];
    this.initialized = false;
    this.connected = false;
    
    this.init();
  }
  
  init() {
    if (this.initialized) return;
    
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.connected = true;
      this.connectionHandlers.forEach(handler => handler(true));
    });
    
    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.connected = false;
      this.connectionHandlers.forEach(handler => handler(false));
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
    });
    
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
    
    this.socket.on('reconnect_attempt', (attempt) => {
      console.log('Reconnection attempt:', attempt);
    });
    
    this.socket.on('reconnect', () => {
      console.log('Socket reconnected');
      this.connected = true;
      this.connectionHandlers.forEach(handler => handler(true));
    });
    
    this.socket.on('newMessage', (message) => {
      console.log('New message received:', message);
      this.messageHandlers.forEach(handler => handler(message));
    });
    
    this.socket.on('userTyping', (data) => {
      this.messageHandlers.forEach(handler => {
        handler({type: 'userTyping', ...data});
      });
    });
    
    this.socket.on('user_status', (data) => {
      this.messageHandlers.forEach(handler => {
        handler({type: 'userStatus', ...data});
      });
    });
    
    this.socket.on('messageStatus', (data) => {
      this.messageHandlers.forEach(handler => {
        handler({type: 'messageStatus', ...data});
      });
    });
    
    this.socket.on('messageSent', (data) => {
      this.messageHandlers.forEach(handler => {
        handler({type: 'messageSent', ...data});
      });
    });
    
    this.initialized = true;
  }
  
  sendMessage(recipientId, message) {
    return new Promise((resolve, reject) => {
      try {
        if (!this.connected) {
          console.warn('Socket not connected, attempting to reconnect...');
          this.socket.connect();
        }
        
        console.log('Sending message to:', recipientId, message);
        
        this.socket.emit('privateMessage', {
          recipient_id: recipientId,
          message: message
        }, (acknowledgement) => {
          // Handle acknowledgement if server supports it
          if (acknowledgement) {
            resolve(acknowledgement);
          } else {
            resolve();
          }
        });
      } catch (err) {
        console.error('Error sending message via socket:', err);
        reject(err);
      }
    });
  }
  
  onMessage(handler) {
    if (typeof handler === 'function') {
      this.messageHandlers.push(handler);
    }
  }
  
  onConnectionChange(handler) {
    if (typeof handler === 'function') {
      this.connectionHandlers.push(handler);
      // Immediately call with current state if already initialized
      if (this.initialized) {
        handler(this.connected);
      }
    }
  }
  
  isConnected() {
    return this.connected;
  }
  
  reconnect() {
    console.log('Manually reconnecting socket...');
    this.socket.disconnect();
    setTimeout(() => {
      this.socket.connect();
    }, 500);
  }
}

// Create singleton instance
const socketManager = new SocketManager();