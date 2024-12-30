import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import https from 'https';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function monitorSofascoreWebSocket(matchId = '12196747') {
    // First fetch the initial data
    console.log('Fetching initial match data...');
    await fetchSofascoreData(matchId);

    const browser = await chromium.launch({ headless: true });
    try {
        const context = await browser.newContext();
        const page = await context.newPage();

        // Listen to WebSocket connections
        page.on('websocket', ws => {
            console.log('WebSocket connected:', ws.url());

            ws.on('framesent', data => {
                const message = data.payload.toString();
                // Only log important messages, skip PING/PONG
                if (!message.includes('PING') && !message.includes('PONG')) {
                    console.log('Frame sent:', message);
                }

                if (message.startsWith('CONNECT')) {
                    console.log('Connection details sent');
                } else if (message.startsWith('SUB')) {
                    console.log('Subscribed to:', message.split(' ')[1]);
                }
            });

            ws.on('framereceived', async data => {
                const message = data.payload.toString();
                // Only log important messages, skip PING/PONG
                if (!message.includes('PING') && !message.includes('PONG')) {
                    console.log('Frame received:', message);
                }

                if (message.startsWith('INFO')) {
                    const infoData = JSON.parse(message.substring(5));
                    console.log('Server Info:', {
                        server: infoData.server_name,
                        clientId: infoData.client_id,
                        cluster: infoData.cluster
                    });
                } 
                else if (message.startsWith('MSG')) {
                    const [header, payload] = message.split('\r\n');
                    const [_, subject, sid, size] = header.split(' ');

                    if (subject.startsWith(`event.${matchId}`)) {
                        console.log('\nMatch update received');
                        try {
                            // Immediately fetch and update full data
                            console.log('Fetching full match data...');
                            const newData = await fetchSofascoreData(matchId);
                            if (newData) {
                                console.log('Match data updated successfully\n');
                            }
                        } catch (error) {
                            console.error('Error updating match data:', error);
                        }
                    }
                }
            });
        });

        // Go to Sofascore match page
        await page.goto(`https://www.sofascore.com/event/${matchId}`);
        console.log('Monitoring WebSocket for match updates...\n');
        
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

async function fetchSofascoreData(matchId = '12196746') {
    const browser = await chromium.launch();
    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        const page = await context.newPage();

        // Add cache control headers
        await page.route('**/*', route => {
            const request = route.request();
            const headers = {
                ...request.headers(),
                'accept': '*/*',
                'accept-language': 'en-US,en;q=0.9',
                'sec-fetch-site': 'same-origin',
                'x-requested-with': '002e6d',
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            };
            route.continue({ headers });
        });

        // Add timestamp to URL to prevent caching
        const timestamp = Date.now();
        const response = await page.goto(
            `https://www.sofascore.com/api/v1/event/${matchId}/innings?_=${timestamp}`,
            { waitUntil: 'networkidle' } // Wait for network to be idle
        );
        
        // Add small delay to ensure data is ready
        await new Promise(resolve => setTimeout(resolve, 500));

        if (!response.ok()) {
            throw new Error(`HTTP error! status: ${response.status()}`);
        }

        const rawData = await response.json();
        const formattedData = rawData.innings.map(inning => {
            // Get fall of wickets in order
            const fallOfWickets = inning.battingLine
                .filter(bat => bat.fowScore !== undefined && bat.fowOver !== undefined)  // Only include batters who were out
                .sort((a, b) => Number(a.fowOver) - Number(b.fowOver))  // Sort by over number
                .map((bat, index) => ({
                    wicketNumber: index + 1,
                    score: Number(bat.fowScore),
                    player: bat.player?.name || bat.playerName,
                    shortName: bat.player?.shortName || bat.playerName,
                    over: Number(bat.fowOver),
                    wicketType: bat.wicketTypeName
                }));

            // Log for debugging
            console.log('Raw batting line:', inning.battingLine);
            console.log('Processed FOW:', fallOfWickets);

            return {
                teamName: `${inning.battingTeam.name} (Innings ${inning.number})`,
                summary: {
                    score: Number(inning.score),
                    wickets: Number(inning.wickets),
                    overs: Number(inning.overs),
                    extras: {
                        total: Number(inning.extra) || 0,
                        wide: Number(inning.wide) || 0,
                        noBall: Number(inning.noBall) || 0,
                        bye: Number(inning.bye) || 0,
                        legBye: Number(inning.legBye) || 0,
                        penalty: Number(inning.penalty) || 0
                    }
                },
                batting: inning.battingLine
                    .map(bat => {
                        // Skip processing if player did not bat
                        if (bat.wicketTypeName === 'Did not bat') {
                            return {
                                name: bat.player?.name || bat.playerName,
                                runs: null,
                                balls: null,
                                fours: null,
                                sixes: null,
                                dismissal: null,
                                strikeRate: null
                            };
                        }

                        // Format dismissal details based on wicket type
                        let dismissalDetails = 'Not out';
                        if (bat.wicketTypeName) {
                            if (bat.wicketTypeName === 'Caught') {
                                // Use shortName for catcher but full name for bowler
                                const catcherShortName = bat.wicketCatch?.shortName || bat.wicketCatchName;
                                dismissalDetails = `c ${catcherShortName} b ${bat.wicketBowlerName}`;
                            } else if (bat.wicketTypeName === 'Run Out') {
                                const fielderShortName = bat.wicketCatch?.shortName || bat.wicketCatchName;
                                dismissalDetails = `run out (${fielderShortName})`;
                            } else if (bat.wicketTypeName === 'Stumped') {
                                const stumperShortName = bat.wicketCatch?.shortName || bat.wicketCatchName;
                                dismissalDetails = `st ${stumperShortName} b ${bat.wicketBowlerName}`;
                            } else if (bat.wicketTypeName === 'LBW') {
                                dismissalDetails = `lbw b ${bat.wicketBowlerName}`;
                            } else if (bat.wicketTypeName === 'Bowled') {
                                dismissalDetails = `b ${bat.wicketBowlerName}`;
                            }
                        }

                        return {
                            name: bat.player?.name || bat.playerName,
                            runs: Number(bat.score),
                            balls: Number(bat.balls),
                            fours: Number(bat.s4),
                            sixes: Number(bat.s6),
                            dismissal: dismissalDetails,
                            strikeRate: bat.balls > 0 ? ((Number(bat.score) / Number(bat.balls)) * 100).toFixed(2) : null
                        };
                    })
                    .filter(bat => bat.name),

                bowling: inning.bowlingLine
                    .map(bowl => ({
                        name: bowl.player?.name || bowl.playerName,
                        overs: Number(bowl.over),
                        maidens: Number(bowl.maiden),
                        runs: Number(bowl.run),
                        wickets: Number(bowl.wicket),
                        wides: Number(bowl.wide),
                        noBalls: Number(bowl.noBall),
                        economy: (Number(bowl.run) / Number(bowl.over)).toFixed(2)
                    }))
                    .filter(bowl => bowl.name),

                partnerships: inning.partnerships
                    .map(p => ({
                        player1: p.player1?.name || '',
                        player2: p.player2?.name || '',
                        runs: Number(p.score),
                        balls: Number(p.balls)
                    }))
                    .filter(p => p.player1 && p.player2),

                fallOfWickets: fallOfWickets
            };
        });

        // Create HTTPS agent that ignores certificate verification
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });

        // After formatting data, send it to the server with SSL verification disabled
        try {
            const response = await fetch('https://192.168.1.11:5000/update-sofascore', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    data: formattedData,
                    timestamp: Date.now()
                }),
                agent: httpsAgent // Add the HTTPS agent here
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            console.log('🔄 Sent update to server');
        } catch (error) {
            console.error('Failed to send update to server:', error);
        }

        // Write to file after server update
        const filePath = path.join(__dirname, '..', 'sofascore_data.json');
        const jsonString = JSON.stringify(formattedData, null, 2);
        
        fs.writeFileSync(filePath, jsonString, { flag: 'w' });
        
        // Verify the write and broadcast update
        const writtenData = fs.readFileSync(filePath, 'utf8');
        if (writtenData === jsonString) {
            // Broadcast WebSocket update to all clients
            if (global.wss) {
                const updateMessage = JSON.stringify({
                    type: 'sofascoreUpdate',
                    timestamp: Date.now(),
                    data: formattedData
                });
                global.wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(updateMessage);
                    }
                });
                console.log('📡 Broadcasted update via WebSocket');
            }

            // Add timestamp to event
            if (typeof document !== 'undefined') {
                const event = new CustomEvent('CRICKET_DATA_UPDATED', {
                    detail: { 
                        source: 'sofascore',
                        timestamp: Date.now(),
                        data: formattedData
                    }
                });
                document.dispatchEvent(event);
                console.log(`🕒 [${new Date().toISOString()}] Dispatched update event`);
            }
        } else {
            throw new Error('Data verification failed');
        }

        return formattedData;

    } catch (error) {
        console.error('Error:', error);
        return null;
    } finally {
        await browser.close();
    }
}

// Export functions
export { monitorSofascoreWebSocket, fetchSofascoreData };

// Run if main module
if (import.meta.url === `file://${process.argv[1]}`) {
    monitorSofascoreWebSocket();
}