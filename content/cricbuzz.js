import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get match ID and slug from command line arguments
const matchId = process.argv[2];
const matchSlug = process.argv[3] || 'all-players'; // default to all-players if not provided

if (!matchId) {
    console.error('Please provide a match ID');
    process.exit(1);
}

// Add this helper function to format the stats
function formatStats(stats, innings = null) {
    if (!stats || !Array.isArray(stats)) return {};
    
    const formattedStats = {};
    
    // Add innings information first if provided
    if (innings) {
        formattedStats.innings = innings;
    }
    
    for (const stat of stats) {
        if (stat.label && stat.value) {
            let key = stat.label.toLowerCase()
                .replace(/[^a-zA-Z0-9]/g, ' ')
                .trim()
                .replace(/\s+(.)/g, (match, group) => group.toUpperCase());
                
            // Convert specific keys to more readable format
            key = key.replace('5W', 'fiveWickets')
                    .replace('50S', 'fifties')
                    .replace('100S', 'hundreds');
                
            formattedStats[key] = stat.value;
        }
    }

    return formattedStats;
}

// Add this helper function to format badges
function formatBadges(badges) {
    if (!badges || !Array.isArray(badges)) return [];
    
    const badgeLabels = badges.map(badge => badge.label);
    const cvcBadge = badges.find(b => b.label === 'C/VC');
    
    return {
        badges: badgeLabels,
        ...(cvcBadge?.desc && { desc: cvcBadge.desc })
    };
}

async function main() {
    let browser;
    try {
        const authPath = path.join(__dirname, '..', 'auth.json');
        console.log('Loading authentication from:', authPath);
        console.log(`Starting data capture for match ${matchId} (${matchSlug})`);
        
        const authData = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        const cricbuzzData = authData.origins.find(o => o.origin === "https://www.cricbuzz.com");
        const accessToken = cricbuzzData?.localStorage.find(i => i.name === "accessToken")?.value;

        browser = await chromium.launchPersistentContext('', {
            headless: false,
            args: ['--no-sandbox'],
            viewport: { width: 1280, height: 720 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        });

        const page = await browser.newPage();

        // Authentication setup
        await page.goto('https://www.cricbuzz.com');
        await page.evaluate((data) => {
            if (data && data.localStorage) {
                for (const item of data.localStorage) {
                    localStorage.setItem(item.name, item.value);
                }
            }
        }, cricbuzzData);

        if (authData.cookies && Array.isArray(authData.cookies)) {
            for (const cookie of authData.cookies) {
                if (cookie.domain.includes('cricbuzz.com')) {
                    await page.context().addCookies([cookie]);
                }
            }
        }

        // Verify login
        console.log('🔐 Verifying login...');
        await page.goto('https://www.cricbuzz.com/premium-subscription/user/account-info');
        await page.waitForLoadState('networkidle');

        const isOnAccountPage = await page.evaluate(() => {
            return window.location.href.includes('/premium-subscription/user/account-info');
        });

        if (!isOnAccountPage) {
            console.log('⚠️ Not logged in, attempting to login...');
            await page.goto('https://www.cricbuzz.com/premium-subscription/user/login');
            await page.evaluate((data) => {
                if (data && data.localStorage) {
                    for (const item of data.localStorage) {
                        localStorage.setItem(item.name, item.value);
                    }
                }
            }, cricbuzzData);
            console.log('🔑 Please complete login if needed...');
            await page.waitForURL('**/premium-subscription/user/account-info', { timeout: 60000 });
        }

        // Navigate directly to match fantasy handbook with slug
        console.log(`\n📱 Navigating to match ${matchId}...`);
        await page.goto(`https://www.cricbuzz.com/cricket-fantasy-handbook/${matchId}/${matchSlug}#!/all-players`);
        await page.waitForLoadState('networkidle');
        console.log('✅ Loaded match Fantasy Handbook page');

        // Click on All Players tab
        console.log('\n👥 Clicking All Players tab...');
        await page.waitForSelector('text=All Players');
        await page.click('text=All Players');
        await page.waitForLoadState('networkidle');
        console.log('✅ Loaded All Players tab');

        console.log('\n🔄 Starting player data capture...');
        
        // Set up network interception for player profiles
        await page.route('**/premium-content/fantasy-handbook/player-profile/**', async route => {
            const request = route.request();
            
            // Add required headers including authorization
            const headers = {
                ...request.headers(),
                'accept': 'application/json, text/plain, */*',
                'content-type': 'application/json;charset=UTF-8',
                'Authorization': `Bearer ${accessToken}`
            };

            try {
                // Get username from localStorage
                const username = cricbuzzData?.localStorage.find(i => i.name === "username")?.value;

                // Forward the request with our headers and body
                const response = await route.fetch({ 
                    headers,
                    method: 'POST',
                    body: JSON.stringify({
                        username: username,
                        AccessToken: accessToken
                    })
                });
                
                const data = await response.json();
                
                // Extract match ID and player ID from URL
                const urlParts = request.url().split('/');
                const playerId = urlParts[urlParts.length - 2];
                const matchId = urlParts[urlParts.length - 1];
                
                // Format the data, only include what's available
                const formattedData = {
                    // Basic info section - use optional chaining
                    id: data?.id,
                    fullName: data?.fullName,
                    country: data?.country,
                    role: data?.role,
                    faceImageId: data?.faceImageId,

                    // Batting section - include all available batting data
                    ...(data?.batStyle && {
                        batting: {
                            batStyle: data?.batStyle,
                            battingRole: data?.battingRole,
                            battingPosition: data?.battingPosition
                        }
                    }),

                    // Bowling section - include all available bowling data
                    ...(data?.bowlStyle && {
                        bowling: {
                            bowlStyle: data?.bowlStyle,
                            bowlingRole: data?.bowlingRole,
                            bowlingVariations: data?.bowlingVariations,
                            stockDelivery: data?.stockDelivery
                        }
                    }),

                    // Keep existing sections unchanged
                    keyInfo: data?.keyInfo,
                    badges: data?.badges?.map(badge => badge.label) || [],
                    description: data?.description,

                    // Stats sections remain unchanged
                    careerStats: data?.careerStats?.subCard && {
                        matches: data.careerStats.cardLabel,
                        batting: data.careerStats.subCard[0]?.stats ? 
                            formatStats(
                                data.careerStats.subCard[0].stats,
                                data.careerStats.subCard[0].subCardLabel
                            ) : null,
                        bowling: data.careerStats.subCard[1]?.stats ? 
                            formatStats(
                                data.careerStats.subCard[1].stats,
                                data.careerStats.subCard[1].subCardLabel
                            ) : null
                    },
                    
                    // Keep recent performance data
                    recentBatting: data?.recentBatting,
                    recentBowling: data?.recentBowling
                };

                // Add opponent stats if exists
                if (data?.opponentStats?.subCard) {
                    formattedData[data.opponentStats.cardHeading] = {
                        matches: data.opponentStats.cardLabel,
                        batting: data.opponentStats.subCard[0]?.stats ? 
                            formatStats(
                                data.opponentStats.subCard[0].stats,
                                data.opponentStats.subCard[0].subCardLabel
                            ) : null,
                        bowling: data.opponentStats.subCard[1]?.stats ? 
                            formatStats(
                                data.opponentStats.subCard[1].stats,
                                data.opponentStats.subCard[1].subCardLabel
                            ) : null
                    };
                }

                // Add venue stats if exists
                if (data?.venueStats?.subCard) {
                    formattedData[data.venueStats.cardHeading] = {
                        matches: data.venueStats.cardLabel,
                        batting: data.venueStats.subCard[0]?.stats ? 
                            formatStats(
                                data.venueStats.subCard[0].stats,
                                data.venueStats.subCard[0].subCardLabel
                            ) : null,
                        bowling: data.venueStats.subCard[1]?.stats ? 
                            formatStats(
                                data.venueStats.subCard[1].stats,
                                data.venueStats.subCard[1].subCardLabel
                            ) : null
                    };
                }

                // Save formatted data
                if (data?.fullName) {  // Only save if we at least have a name
                    const fileName = data.fullName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                    const apiDataPath = path.join(__dirname, '..', 'fantasy-data', matchId, 'players');
                    await fs.promises.mkdir(apiDataPath, { recursive: true });
                    await fs.promises.writeFile(
                        path.join(apiDataPath, `${fileName}.json`),
                        JSON.stringify(formattedData, null, 2)
                    );
                    console.log(`📥 Captured API data for ${data.fullName}`);
                }
            } catch (error) {
                console.log(`⚠️ Could not process player data: ${error.message}`);
                await route.continue();
            }
        });

        // Wait for Angular to finish loading the player list
        await page.waitForSelector('.cb-bg-white.disp-flex.pad12.cb-pos-rel.cb-cursor-pointer.ng-binding.ng-scope', { 
            state: 'visible', 
            timeout: 30000 
        });
        console.log('✅ Player list loaded');

        // Get all player rows
        const playerRows = await page.$$('.cb-bg-white.disp-flex.pad12.cb-pos-rel.cb-cursor-pointer.ng-binding.ng-scope');
        console.log(`Found ${playerRows.length} players`);

        // Process each player
        for (let i = 0; i < playerRows.length; i++) {
            let playerName = 'Unknown Player';
            
            try {
                playerName = await playerRows[i].evaluate(el => {
                    const nameEl = el.querySelector('.cb-font-16.text-bold');
                    return nameEl ? nameEl.textContent.trim() : 'Unknown Player';
                });
                
                console.log(`\nProcessing player ${i + 1} of ${playerRows.length}`);
                console.log(`👤 Processing: ${playerName}`);

                // Click the player row
                await playerRows[i].click();
                await page.waitForTimeout(2000);

                // Close modal using close button
                try {
                    await page.click('.cb-plus-ico.cb-ico-close-no-border.cb-cursor-pointer');
                } catch (closeError) {
                    console.log('⚠️ Could not find close button, using Escape key');
                    await page.keyboard.press('Escape');
                }
                
                // Wait for modal to close
                await page.waitForTimeout(2000);

            } catch (error) {
                console.error(`Error processing ${playerName}:`, error);
                // Try to close modal if it's stuck
                try {
                    await page.click('.cb-plus-ico.cb-ico-close-no-border.cb-cursor-pointer');
                } catch (e) {
                    await page.keyboard.press('Escape');
                }
                await page.waitForTimeout(2000);
            }
        }

        console.log('\n✅ Finished processing all players');

        // Click on Venue tab
        console.log('\n🏟️ Clicking Venue tab...');
        
        // Set up network interception for venue data
        await page.route('**/premium-content/fantasy-handbook/venue/**', async route => {
            const request = route.request();
            
            // Add required headers including authorization
            const headers = {
                ...request.headers(),
                'accept': 'application/json, text/plain, */*',
                'content-type': 'application/json;charset=UTF-8',
                'Authorization': `Bearer ${accessToken}`
            };

            try {
                // Forward the request with our headers
                const response = await route.fetch({ headers });
                const data = await response.json();
                
                // Extract match ID from URL
                const urlParts = request.url().split('/');
                const matchId = urlParts[urlParts.length - 1];
                
                // Save venue data
                const venuePath = path.join(__dirname, '..', 'fantasy-data', matchId);
                await fs.promises.mkdir(venuePath, { recursive: true });
                await fs.promises.writeFile(
                    path.join(venuePath, 'venue.json'),
                    JSON.stringify(data, null, 2)
                );
                
                console.log(`📥 Captured venue data`);
                
                // Continue with the response
                await route.fulfill({ response });
                
            } catch (error) {
                console.error('Error intercepting venue data:', error);
                await route.continue();
            }
        });

        // Create a promise that will resolve when venue data is received
        const venueDataPromise = new Promise(resolve => {
            page.once('response', async response => {
                if (response.url().includes('/premium-content/fantasy-handbook/venue/')) {
                    resolve();
                }
            });
        });

        // Click the venue tab
        await page.waitForSelector('text=Venue');
        await page.click('text=Venue');
        
        // Wait for venue data to be received
        await venueDataPromise;
        console.log('✅ Captured venue data');

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    } finally {
        // Make sure to close both context and browser
        if (browser) {
            try {
                await browser.close();
                console.log('✅ Browser closed successfully');
            } catch (closeError) {
                console.error('Error closing browser:', closeError);
            }
        }
    }
}

// Run the script
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
