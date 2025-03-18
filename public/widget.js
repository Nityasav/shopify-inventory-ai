class InventoryAIWidget {
    constructor() {
        this.widget = document.getElementById('inventory-chat-widget');
        this.messagesContainer = document.getElementById('chat-messages');
        this.userInput = document.getElementById('user-input');
        this.sendButton = document.getElementById('send-message');
        this.minimizeButton = document.getElementById('minimize-chat');
        
        this.setupEventListeners();
        this.initialize();
    }

    initialize() {
        // Add welcome message
        this.addMessage("Hi! I'm your inventory assistant. Ask me about any product's availability!", 'bot');
        
        // Listen for Shopify checkout events
        document.addEventListener('Shopify:checkout:done', (event) => {
            this.handleOrderConfirmation();
        });
    }

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.handleUserMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.handleUserMessage();
            }
        });
        this.minimizeButton.addEventListener('click', () => this.toggleMinimize());
    }

    async handleUserMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        // Add user message to chat
        this.addMessage(message, 'user');
        this.userInput.value = '';

        // Process the message
        await this.processUserQuery(message);
    }

    async processUserQuery(query) {
        try {
            // Send query to backend for processing
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message: query })
            });

            const data = await response.json();
            this.addMessage(data.response, 'bot');
        } catch (error) {
            this.addMessage('Sorry, I encountered an error while processing your request.', 'bot');
            console.error('Error processing query:', error);
        }
    }

    async handleOrderConfirmation() {
        try {
            // Get order details from Shopify.checkout object
            const checkout = Shopify.checkout;
            console.log('Processing order:', checkout);
            
            // Process each line item
            for (const item of checkout.line_items) {
                const response = await fetch('/api/order-confirmed', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        quantity: item.quantity,
                        productId: 'eclipse-tag',
                        orderNumber: checkout.order_id
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    console.log(`Inventory updated successfully. New count: ${result.newInventoryCount}`);
                } else {
                    console.error('Error updating inventory:', result.error);
                }
            }
        } catch (error) {
            console.error('Error confirming order:', error);
        }
    }

    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', `${sender}-message`);
        messageDiv.textContent = text;
        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    toggleMinimize() {
        this.widget.classList.toggle('minimized');
        this.minimizeButton.textContent = this.widget.classList.contains('minimized') ? '+' : '−';
    }
}

// Initialize the widget when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new InventoryAIWidget();
});