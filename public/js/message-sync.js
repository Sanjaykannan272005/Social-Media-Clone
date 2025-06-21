/**
 * Message synchronization utility
 * Ensures messages are properly delivered and synchronized
 */

class MessageSync {
  constructor(socketManager) {
    this.socketManager = socketManager;
    this.pendingMessages = [];
    this.retryInterval = null;
    this.serverTimeOffset = 0;
    
    this.init();
  }
  
  init() {
    // Set up retry mechanism for pending messages
    this.retryInterval = setInterval(() => {
      this.retryPendingMessages();
    }, 5000);
    
    // Listen for connection changes
    this.socketManager.onConnectionChange((connected) => {
      if (connected) {
        this.retryPendingMessages();
      }
    });
  }
  
  addPendingMessage(message, recipientId) {
    this.pendingMessages.push({
      message,
      recipientId,
      attempts: 0,
      timestamp: Date.now()
    });
    
    // Try to send immediately
    this.sendMessage(this.pendingMessages.length - 1);
  }
  
  async sendMessage(index) {
    if (index >= this.pendingMessages.length) return;
    
    const pending = this.pendingMessages[index];
    pending.attempts++;
    
    try {
      if (!this.socketManager.isConnected()) {
        console.log('Socket not connected, will retry later');
        return;
      }
      
      await this.socketManager.sendMessage(pending.recipientId, pending.message);
      
      // Message sent successfully, remove from pending
      this.pendingMessages.splice(index, 1);
    } catch (err) {
      console.error('Failed to send message, will retry later:', err);
      
      // If too many attempts, give up
      if (pending.attempts >= 5) {
        console.error('Too many failed attempts, removing message from queue');
        this.pendingMessages.splice(index, 1);
      }
    }
  }
  
  retryPendingMessages() {
    if (this.pendingMessages.length === 0) return;
    
    console.log(`Retrying ${this.pendingMessages.length} pending messages`);
    
    // Try to send all pending messages
    for (let i = 0; i < this.pendingMessages.length; i++) {
      this.sendMessage(i);
    }
  }
  
  cleanup() {
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
    }
  }
}

// Create singleton instance
const messageSync = new MessageSync(socketManager);