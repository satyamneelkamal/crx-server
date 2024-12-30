import { CricinfoWebSocket } from './CricinfoWebSocket.js';

// Helper function to extract IDs from URL
function extractIdsFromUrl(url) {
    const matches = url.match(/series\/([^/]+)-(\d+)\/([^/]+)-(\d+)/);
    if (matches) {
        return {
            seriesName: matches[1],
            seriesId: matches[2],
            matchName: matches[3],
            matchId: matches[4]
        };
    }
    throw new Error('Invalid URL format');
}

// Get match URL from command line or use default
const matchUrl = process.argv[2] || 'https://www.espncricinfo.com/series/west-indies-women-in-india-2024-25-1459886/india-women-vs-west-indies-women-2nd-odi-1459895/live-cricket-score';

// Extract match details from URL
const { matchId, seriesId, seriesName, matchName } = extractIdsFromUrl(matchUrl);

// Create WebSocket client with extracted details
const wsClient = new CricinfoWebSocket(
    matchId,
    seriesId, 
    seriesName,
    matchName
);

wsClient.connect();

// Handle process termination
process.on('SIGINT', async () => {
    console.log('Disconnecting from Cricinfo...');
    await wsClient.disconnect();
    process.exit();
}); 