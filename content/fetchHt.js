import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Add retry logic and better error handling
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2 seconds

async function sendUpdateToServer(data, retryCount = 0) {
  try {
    const response = await fetch('YOUR_SERVER_ENDPOINT', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    console.log('Successfully sent update to server');
    return true;

  } catch (error) {
    console.error(`Attempt ${retryCount + 1} failed:`, error.message);

    if (retryCount < MAX_RETRIES) {
      console.log(`Retrying in ${RETRY_DELAY/1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return sendUpdateToServer(data, retryCount + 1);
    }

    // Log the final failure
    console.error('Failed to send update after all retries:', error.message);
    return false;
  }
}

// Modify the existing update function to use the retry logic
async function updateServer(data) {
  const success = await sendUpdateToServer(data);
  if (success) {
    console.log('Data successfully sent to server');
  } else {
    // Save failed updates for later retry
    saveFailedUpdate(data);
  }
}

// Add function to save failed updates
function saveFailedUpdate(data) {
  try {
    const failedUpdates = JSON.parse(localStorage.getItem('failedUpdates') || '[]');
    failedUpdates.push({
      timestamp: new Date().toISOString(),
      data: data
    });
    localStorage.setItem('failedUpdates', JSON.stringify(failedUpdates));
    console.log('Failed update saved for later retry');
  } catch (error) {
    console.error('Error saving failed update:', error);
  }
}

// Add function to retry failed updates periodically
async function retryFailedUpdates() {
  try {
    const failedUpdates = JSON.parse(localStorage.getItem('failedUpdates') || '[]');
    if (failedUpdates.length === 0) return;

    const successfulRetries = [];
    
    for (let i = 0; i < failedUpdates.length; i++) {
      const success = await sendUpdateToServer(failedUpdates[i].data);
      if (success) {
        successfulRetries.push(i);
      }
    }

    // Remove successful retries from failed updates
    const remainingUpdates = failedUpdates.filter((_, index) => !successfulRetries.includes(index));
    localStorage.setItem('failedUpdates', JSON.stringify(remainingUpdates));

  } catch (error) {
    console.error('Error retrying failed updates:', error);
  }
}

// Set up periodic retry of failed updates
setInterval(retryFailedUpdates, 5 * 60 * 1000); // Retry every 5 minutes

async function monitorHindustanTimes(matchId = '244852') {
    const browser = await chromium.launch({ headless: true });
    let lastSpeedUpdate = '';
    let lastLiveUpdate = '';
    
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });
        
        const page = await context.newPage();

        // Listen to all responses
        page.on('response', async response => {
            const url = response.url();
            try {
                if (url.includes('.json')) {
                    const data = await response.json();
                    
                    if (url.includes('commentary')) {
                        // Extract all balls data from commentary array
                        const simplifiedData = data.commentary
                            .filter(ball => ball.Isball)
                            .map(ball => ({
                                Detail: ball.Detail || "",
                                Ball_Speed_This_Over: ball.Ball_Speed_This_Over || "",
                                Runs: ball.Runs || "",
                                This_Over: ball.This_Over || "",
                                Over: ball.Over || "",
                                Ball_Speed: ball.Ball_Speed || "",
                                Ball_Line_Length: ball.Ball_Line_Length || "",
                                Bowler_Name: ball.Bowler_Name || "",
                                Bowler_Short_Name: ball.Bowler_Short_Name || ""
                            }));

                        // Only update if data has changed
                        const currentUpdate = JSON.stringify(simplifiedData);
                        if (currentUpdate !== lastSpeedUpdate) {
                            const speedFilePath = path.join(__dirname, '..', 'match-info', 'HT-speed.json');
                            fs.writeFileSync(speedFilePath, JSON.stringify(simplifiedData, null, 2));
                            console.log('Speed data saved to HT-speed.json successfully');

                            // Send to server
                            try {
                                const httpsAgent = new https.Agent({
                                    rejectUnauthorized: false
                                });

                                const response = await fetch('https://192.168.1.11:5000/update-speed', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        data: simplifiedData,
                                        timestamp: Date.now()
                                    }),
                                    agent: httpsAgent
                                });

                                if (!response.ok) {
                                    throw new Error(`HTTP error! status: ${response.status}`);
                                }
                                console.log('🔄 Sent speed update to server');
                                lastSpeedUpdate = currentUpdate;
                            } catch (error) {
                                console.error('Failed to send update to server:', error);
                            }
                        }
                    } else if (url.includes('static-content/10s')) {
                        // Check if live data has changed
                        const currentLiveUpdate = JSON.stringify(data);
                        if (currentLiveUpdate !== lastLiveUpdate) {
                            const liveFilePath = path.join(__dirname, '..', 'match-info', 'HT-live.json');
                            fs.writeFileSync(liveFilePath, JSON.stringify(data, null, 2));
                            console.log('Live data saved to HT-live.json successfully');

                            // Send only the live match data to server
                            try {
                                const httpsAgent = new https.Agent({
                                    rejectUnauthorized: false
                                });

                                const liveMatchesData = data.live || [];

                                const response = await fetch('https://192.168.1.11:5000/update-live', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                        data: liveMatchesData,
                                        timestamp: Date.now()
                                    }),
                                    agent: httpsAgent
                                });

                                if (!response.ok) {
                                    throw new Error(`HTTP error! status: ${response.status}`);
                                }
                                console.log('🔄 Sent live matches update to server');
                                lastLiveUpdate = currentLiveUpdate;
                            } catch (error) {
                                console.error('Failed to send update to server:', error);
                            }
                        }
                    }

                    // Dispatch event if in browser context
                    if (typeof document !== 'undefined') {
                        const event = new CustomEvent('CRICKET_DATA_UPDATED', {
                            detail: {
                                source: 'hindustantimes',
                                timestamp: Date.now(),
                                data: data
                            }
                        });
                        document.dispatchEvent(event);
                        console.log(`🕒 [${new Date().toISOString()}] Dispatched update event`);
                    }
                }
            } catch (error) {
                console.error('Error processing response:', error);
            }
        });

        // Add headers
        await page.route('**/*', route => {
            const headers = {
                ...route.request().headers(),
                'cookie': 'ht-location=IN; Meta-Geo=IN--DL--NEWDELHI',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            };
            route.continue({ headers });
        });

        // Navigate to the actual match page instead of the JSON endpoint
        await page.goto('https://www.hindustantimes.com/cricket/commentary-live-nz-vs-sl-sl-in-nz-3-t20is-202425-2nd-t20i-new-zealand-vs-sri-lanka-t20-nzsl12302024248570');
        console.log('Monitoring HT live commentary page for updates...\n');

        // Handle cleanup
        process.on('SIGINT', async () => {
            console.log('\nClosing browser...');
            await browser.close();
            process.exit();
        });

    } catch (error) {
        console.error('Error:', error);
        await browser.close();
    }
}

// Export function
export { monitorHindustanTimes };

// Run if main module
if (import.meta.url === `file://${process.argv[1]}`) {
    monitorHindustanTimes();
}