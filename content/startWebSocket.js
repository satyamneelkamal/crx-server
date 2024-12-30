import { SofascoreWebSocket } from './fetchSofascore.js';

const wsClient = new SofascoreWebSocket('12196746');
wsClient.connect();

// Handle process termination
process.on('SIGINT', () => {
    console.log('Disconnecting WebSocket...');
    wsClient.disconnect();
    process.exit();
}); 