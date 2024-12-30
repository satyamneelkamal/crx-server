import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function fetchCricinfoData(matchId, seriesId, seriesName, matchName, shouldCloseBrowser = true) {
    let browser;
    try {
        console.log('1. Starting script...');
        
        browser = await chromium.launch({ 
            headless: true
        });
        
        const context = await browser.newContext();
        const page = await context.newPage();
        
        let scoreData = null;

        // Log all requests to see what's happening
        page.on('request', request => {
            if (request.url().includes('hs-consumer-api.espncricinfo.com')) {
                console.log('\nRequest URL:', request.url());
                console.log('Request headers:', request.headers());
            }
        });

        // Log all responses
        page.on('response', async response => {
            const url = response.url();
            if (url.includes('hs-consumer-api.espncricinfo.com')) {
                console.log('\nResponse URL:', url);
                console.log('Response status:', response.status());
                try {
                    if (url.includes('/match/scorecard')) {
                        const json = await response.json();
                        scoreData = json;
                        console.log('Captured scorecard data from response');
                    }
                } catch (error) {
                    console.error('Error parsing response:', error);
                }
            }
        });

        // Route handler for the scorecard API
        await page.route('**/*hs-consumer-api.espncricinfo.com/v1/pages/match/scorecard*', async route => {
            console.log('\nScorecard API call intercepted');
            try {
                const response = await route.fetch();
                const json = await response.json();
                scoreData = json;
                console.log('Captured scorecard data from route');
                await route.fulfill({ response });
            } catch (error) {
                console.error('Error in route handler:', error);
                await route.continue();
            }
        });

        // First navigate to live score page
        const liveScoreUrl = `https://www.espncricinfo.com/series/${seriesName}-${seriesId}/${matchName}-${matchId}/live-cricket-score`;
        console.log('\n2. Navigating to live score:', liveScoreUrl);
        
        await page.goto(liveScoreUrl);
        console.log('3. Live score page loaded');

        // Wait and click on scorecard tab if it exists
        try {
            await page.waitForSelector('a:has-text("Scorecard")', { timeout: 5000 });
            console.log('Found Scorecard tab');
            await page.click('a:has-text("Scorecard")');
            console.log('Clicked Scorecard tab');
        } catch (error) {
            console.log('No Scorecard tab found, proceeding with direct navigation');
        }

        await page.waitForTimeout(2000);

        // Now navigate to full scorecard
        const scorecardUrl = `https://www.espncricinfo.com/series/${seriesName}-${seriesId}/${matchName}-${matchId}/full-scorecard`;
        console.log('\n4. Navigating to full scorecard:', scorecardUrl);
        
        await page.goto(scorecardUrl);
        console.log('5. Scorecard page loaded');

        // Wait longer for the scorecard API call
        await page.waitForTimeout(10000);

        if (!scoreData) {
            // Try to find and click any scorecard-related elements
            try {
                await page.click('button:has-text("Scorecard")');
                await page.waitForTimeout(2000);
            } catch (error) {
                console.log('No scorecard button found');
            }

        }

        if (!scoreData) {
            throw new Error('Failed to capture scorecard data');
        }

        // Save the data
        console.log('\n6. Writing data to file...');
        const filePath = path.join(__dirname, '..', 'match-info', 'cricinfo-live.json');
        
        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        
        fs.writeFileSync(filePath, JSON.stringify(scoreData, null, 2));
        console.log('7. Data saved to:', filePath);

        // Only close browser if shouldCloseBrowser is true
        if (shouldCloseBrowser) {
            await browser.close();
            console.log('\n8. Browser closed');
        }

        return scoreData;

    } catch (error) {
        console.error('Error:', error);
        // Only close browser on error if shouldCloseBrowser is true
        if (shouldCloseBrowser && browser) {
            await browser.close();
        }
        throw error;
    }
}

// Helper function to extract IDs and match details from URL
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

// Keep the command-line execution logic separate
if (import.meta.url === `file://${process.argv[1]}`) {
    const matchUrl = process.argv[2] || 'https://www.espncricinfo.com/series/new-zealand-women-vs-australia-women-2024-25-1443558/new-zealand-women-vs-australia-women-3rd-odi-1443567/live-cricket-score';
    const { seriesId, matchId, seriesName, matchName } = extractIdsFromUrl(matchUrl);
    
    console.log('Script starting...');
    fetchCricinfoData(matchId, seriesId, seriesName, matchName)
        .then(data => {
            console.log('✅ Success:', data ? 'Data received' : 'No data');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Fatal error:', error);
            process.exit(1);
        });
}
