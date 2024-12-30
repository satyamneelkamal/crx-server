import { chromium } from 'playwright';
import { SELECTORS } from './selectors.js';
import { getPlayingXI, getComparisonStats } from './info-helpers.js';
import { load } from 'cheerio';
import fs from 'fs/promises';
import https from 'https';
import fetch from 'node-fetch';

// Helper function to clean team names
function cleanTeamName(name) {
  const cleanedName = name.trim().split(/\s+/)[0];
  
  if (cleanedName.length === 4) {
    return cleanedName.substring(0, 2);
  } else if (cleanedName.length === 6) {
    return cleanedName.substring(0, 3);
  } else if (cleanedName.length === 8) {
    return cleanedName.substring(0, 4);
  }
  
  return cleanedName.replace(/([A-Z])\1+/g, '$1');
}

async function saveToJson(data, filename = 'current-match.json') {
  try {
    // Save to file
    const dir = '../match-info';
    await fs.mkdir(dir, { recursive: true });
    const filepath = `${dir}/${filename}`;
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    console.log(`Data saved successfully to ${filepath}`);

    // Send to server with SSL verification disabled
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    });

    const response = await fetch('https://192.168.1.11:5000/update-match-info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      agent: httpsAgent
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Dispatch event to notify UI that new data is available
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('CRICKET_DATA_UPDATED'));
    }
  } catch (error) {
    console.error('Error saving/sending data:', error);
  }
}

export async function scrapeMatchInfo(page) {
  try {
    // Wait for initial content to load
    await page.waitForSelector('.format-match', { timeout: 10000, state: 'visible' });

    // Find and click each team's dropdown arrow
    const teamSections = await page.$$('.format-match');

    for (const section of teamSections) {
      try {
        const teamName = await section.$eval('.form-team-name', el => el.textContent.trim());
        const dropdownArrow = await section.$('img[alt="All Team Matches Arrow"]');
        
        if (dropdownArrow) {
          await dropdownArrow.scrollIntoViewIfNeeded();
          await page.waitForSelector('img[alt="All Team Matches Arrow"]', { state: 'visible' });
          await dropdownArrow.click();
          
          // Wait for content to load after click
          await page.waitForSelector('.global-card-wrap', { 
            state: 'visible',
            timeout: 5000 
          });
        }
      } catch (error) {
        console.error(`Error processing team section:`, error);
      }
    }

    // Get HTML and parse
    const html = await page.content();
    const $ = load(html);

    // Click "Overall" button for team comparison and wait for data
    const overallButton = await page.$(SELECTORS.teamComparison.buttons.overall);
    let overallStats = null;
    
    if (overallButton) {
      await overallButton.click();
      await page.waitForSelector(SELECTORS.teamComparison.buttons.overall, { 
        state: 'visible',
        timeout: 5000 
      });
      overallStats = await getComparisonStats($, 'Overall');
    }

    // Click "On Venue" button and get venue stats
    const onVenueButton = await page.$(SELECTORS.teamComparison.buttons.onVenue);
    let onVenueStats = null;
    
    if (onVenueButton) {
      await onVenueButton.click();
      await page.waitForSelector(SELECTORS.teamComparison.buttons.onVenue, {
        state: 'visible',
        timeout: 5000
      });
      
      const venueHtml = await page.content();
      const $venue = load(venueHtml);
      onVenueStats = await getComparisonStats($venue, 'On Venue');
    }

    // Parse all sections
    const matchInfo = {
      basicInfo: {
        seriesName: $(SELECTORS.basicInfo.seriesName).first().text().trim(),
        matchDate: $(SELECTORS.basicInfo.matchDate).first().text().trim(),
        venue: $(SELECTORS.basicInfo.venue).first().text().trim()
      },
      
      teamForm: $(SELECTORS.teamForm.container).map((i, section) => {
        const teamData = {
          teamName: $(section).find(SELECTORS.teamForm.teamName).text().trim(),
          shortForm: $(section).find(SELECTORS.teamForm.shortForm).map((j, match) => ({
            result: $(match).find(SELECTORS.teamForm.shortFormResult).text().trim(),
            type: $(match).hasClass('win') ? 'win' : 
                  $(match).hasClass('loss') ? 'loss' : 'draw'
          })).get().filter(match => match.result !== '*'),
          recentMatches: []
        };

        const recentMatchesSection = $(section).next('.format-match-exp');
        if (recentMatchesSection.length) {
          teamData.recentMatches = recentMatchesSection.find('.team-form-card').map((j, match) => ({
            teams: {
              team1: {
                name: $(match).find('.form-team-detail.form-mweb-team .team-name').text().trim(),
                scores: $(match).find('.form-team-detail.form-mweb-team .team-score')
                  .map((k, score) => $(score).text().trim())
                  .get()
                  .filter(score => score !== '&' && score !== '')
              },
              team2: {
                name: $(match).find('.form-team-detail:not(.form-mweb-team) .team-name').text().trim(),
                scores: $(match).find('.form-team-detail:not(.form-mweb-team) .team-score')
                  .map((k, score) => $(score).text().trim())
                  .get()
                  .filter(score => score !== '&' && score !== '')
              }
            },
            result: $(match).find('.form-match-no .match span').text().trim(),
            matchInfo: {
              number: $(match).find('.match-name').text().trim(),
              series: $(match).find('.series-name').text().trim()
            }
          })).get();
        }

        return teamData;
      }).get(),

      headToHead: {
        stats: {
          team1: {
            name: cleanTeamName($(SELECTORS.headToHead.stats.team1.name).text()),
            wins: $(SELECTORS.headToHead.stats.team1.wins).text().trim()
          },
          team2: {
            name: cleanTeamName($(SELECTORS.headToHead.stats.team2.name).text()),
            wins: $(SELECTORS.headToHead.stats.team2.wins).text().trim()
          }
        },
        matches: $(SELECTORS.headToHead.matches.container).map((i, match) => ({
          teams: {
            team1: {
              name: cleanTeamName($(match).find(SELECTORS.headToHead.matches.team1.name).text()),
              scores: $(match).find(SELECTORS.headToHead.matches.team1.scores)
                .map((k, score) => $(score).text().trim())
                .get()
                .filter(score => score !== '&' && score !== '')
            },
            team2: {
              name: cleanTeamName($(match).find(SELECTORS.headToHead.matches.team2.name).text()),
              scores: $(match).find(SELECTORS.headToHead.matches.team2.scores)
                .map((k, score) => $(score).text().trim())
                .get()
                .filter(score => score !== '&' && score !== '')
            }
          },
          result: $(match).find(SELECTORS.headToHead.matches.result).text().trim(),
          matchInfo: $(match).find(SELECTORS.headToHead.matches.matchInfo).text().trim()
        })).slice(0, 5).get()
      },

      venueStats: {
        matches: {
          count: $(SELECTORS.venueStats.matches.count).text().trim(),
          text: $(SELECTORS.venueStats.matches.text).text().trim()
        },
        winPercentages: {
          batFirst: $(SELECTORS.venueStats.winPercentages.batFirst).text().trim(),
          bowlFirst: $(SELECTORS.venueStats.winPercentages.bowlFirst).text().trim()
        },
        averageScores: {
          firstInnings: $(SELECTORS.venueStats.averageScores.firstInnings).text().trim(),
          secondInnings: $(SELECTORS.venueStats.averageScores.secondInnings).text().trim(),
          thirdInnings: $(SELECTORS.venueStats.averageScores.thirdInnings).text().trim(),
          fourthInnings: $(SELECTORS.venueStats.averageScores.fourthInnings).text().trim()
        },
        totals: {
          highest: {
            score: $(SELECTORS.venueStats.totals.highest.score).text().trim(),
            teams: $(SELECTORS.venueStats.totals.highest.teams).text().trim()
          },
          lowest: {
            score: $(SELECTORS.venueStats.totals.lowest.score).text().trim(),
            teams: $(SELECTORS.venueStats.totals.lowest.teams).text().trim()
          }
        },
        recentMatches: $(SELECTORS.venueStats.recentMatches.container).map((i, match) => ({
          teams: {
            team1: {
              name: cleanTeamName($(match).find(SELECTORS.venueStats.recentMatches.team1.name).text()),
              scores: $(match).find(SELECTORS.venueStats.recentMatches.team1.scores)
                .map((k, score) => $(score).text().trim())
                .get()
                .filter(score => score !== '&' && score !== '')
            },
            team2: {
              name: cleanTeamName($(match).find(SELECTORS.venueStats.recentMatches.team2.name).text()),
              scores: $(match).find(SELECTORS.venueStats.recentMatches.team2.scores)
                .map((k, score) => $(score).text().trim())
                .get()
                .filter(score => score !== '&' && score !== '')
            }
          },
          result: $(match).find(SELECTORS.venueStats.recentMatches.result).text().trim(),
          matchInfo: $(match).find(SELECTORS.venueStats.recentMatches.matchInfo).text().trim()
        })).get()
      },

      weatherInfo: {
        temperature: $(SELECTORS.weatherInfo.temperature).text().trim(),
        condition: $(SELECTORS.weatherInfo.condition).text().trim(),
        humidity: $(SELECTORS.weatherInfo.humidity).text().trim(),
        precipitation: $(SELECTORS.weatherInfo.precipitation).text().trim()
      },

      teamComparison: {
        overall: overallStats,
        onVenue: onVenueStats
      },

      toss: {
        result: $(SELECTORS.tossInfo.text).text().trim()
      },

      playingXI: {
        teams: await getPlayingXI(page)
      },

      umpires: {
        onField: $(SELECTORS.umpires.sections).filter((i, el) => 
          $(el).find(SELECTORS.umpires.key).text().trim() === 'On-field Umpire'
        ).find(SELECTORS.umpires.value).text().trim(),
        
        thirdUmpire: $(SELECTORS.umpires.sections).filter((i, el) => 
          $(el).find(SELECTORS.umpires.key).text().trim() === 'Third Umpire'
        ).find(SELECTORS.umpires.value).text().trim(),
        
        referee: $(SELECTORS.umpires.sections).filter((i, el) => 
          $(el).find(SELECTORS.umpires.key).text().trim() === 'Referee'
        ).find(SELECTORS.umpires.value).text().trim()
      }
    };

    return matchInfo;

  } catch (error) {
    console.error('Scraping failed:', error);
    throw error;
  }
}

// Main function to run the scraper
export async function runScraper(url, options = {}) {
  if (!url) {
    console.error('No URL provided to scraper');
    return;
  }

  console.log('Starting scraper with URL:', url);
  
//this is where headless behaviour can be changed
  const browser = await chromium.launch({
    headless: options.headless ?? true
  });
  
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ...options.context
  });
  
  const page = await context.newPage();
  
  try {
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: options.timeout ?? 30000
    });
    
    const result = await scrapeMatchInfo(page);
    await saveToJson(result);
    return result;
    
  } catch (error) {
    console.error('Error running scraper:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

// Default test URL - you can modify this as needed
const DEFAULT_TEST_URL = 'https://crex.live/scoreboard/OVX/1KL/4th-TEST/O/Q/aus-vs-ind-4th-test-india-tour-of-australia-2024-25/info';

// Browser environment: Listen for URL updates from crex-content.js
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  document.addEventListener('CRICKET_URL_UPDATE', async (event) => {
    const { infoUrl } = event.detail;
    if (infoUrl && infoUrl.includes('/info')) {
      console.log('Received new URL to scrape:', infoUrl);
      try {
        const result = await runScraper(infoUrl, { headless: true });
        console.log('Scraping completed for:', infoUrl);
        // Handle the result as needed
      } catch (error) {
        console.error('Error running scraper for URL:', infoUrl, error);
      }
    }
  });
}

// Node.js environment: Run scraper if file is executed directly
if (import.meta.url === new URL(import.meta.url).href) {
  // Get URL from command line or use default
  const url = process.argv[2] || DEFAULT_TEST_URL;
  console.log('Running scraper with URL:', url);
  
  runScraper(url, { headless: true })
    .then(result => {
      console.log('Scraping result:');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('Scraper failed:', error);
      process.exit(1);
    });
} 