import { fetchCricinfoData } from './fetchCricinfo.js';

export class CricinfoWebSocket {
    constructor(matchId, seriesId, seriesName, matchName) {
        this.matchId = matchId;
        this.seriesId = seriesId;
        this.seriesName = seriesName;
        this.matchName = matchName;
        this.browser = null;
        this.page = null;
    }

    async connect() {
        const { chromium } = await import('playwright');
        
        try {
            // First fetch initial data with shouldCloseBrowser = false
            console.log('Fetching initial match data...');
            await fetchCricinfoData(
                this.matchId, 
                this.seriesId, 
                this.seriesName, 
                this.matchName,
                false  // Don't close browser after initial fetch
            );

            this.browser = await chromium.launch({ headless: true });
            const context = await this.browser.newContext();
            this.page = await context.newPage();

            // Monitor network requests for live updates
            await this.page.route('**/*hs-consumer-api.espncricinfo.com/v1/pages/match/*', async route => {
                const request = route.request();
                console.log('Intercepted API call:', request.url());
                
                try {
                    const response = await route.fetch();
                    const json = await response.json();
                    
                    // If this is a live update, fetch fresh data
                    if (json.match?.status === 'Live') {
                        console.log('\nLive match update detected');
                        await fetchCricinfoData(this.matchId, this.seriesId, this.seriesName, this.matchName);
                    }
                    
                    await route.fulfill({ response });
                } catch (error) {
                    console.error('Error handling route:', error);
                    await route.continue();
                }
            });

            // Go to match page and stay there
            const liveScoreUrl = `https://www.espncricinfo.com/series/${this.seriesName}-${this.seriesId}/${this.matchName}-${this.matchId}/live-cricket-score`;
            await this.page.goto(liveScoreUrl);
            console.log('Monitoring Cricinfo for match updates...\n');

        } catch (error) {
            console.error('Connection error:', error);
            await this.disconnect();
        }
    }

    async disconnect() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
} 