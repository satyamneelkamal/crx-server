let lastData = null;

// Define observer configuration
const observerConfig = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['class', 'data-*', 'src']
};

// Add this function at the top level
function getTeamLogoPath(teamName) {
  if (!teamName) return '';
  
  // Normalize team name to match file naming convention
  const normalizedName = teamName.toLowerCase().trim();
  
  // Return a URL path that will be handled by the server
  return `https://192.168.1.11:5000/teams/${normalizedName}`;
}

// Add this function at the top level
function getPlayerImagePath(playerName) {
  if (!playerName) return '';
  
  // Normalize player name to match file naming convention
  // Remove spaces and special characters, convert to lowercase
  const normalizedName = playerName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
  
  // Return a URL path that will be handled by the server
  return `https://192.168.1.11:5000/players/${normalizedName}`;
}

function extractData() {
  try {
    const data = {
      matchTitle: '',
      teams: {
        team1: {
          name: '',
          score: '',
          overs: '',
          logo: ''
        },
        team2: {
          name: '',
          score: '',
          overs: '', 
          logo: ''
        }
      },
      currentInnings: {},
      batsmen: [],
      bowler: {},
      recentOvers: [],
      projectedScore: {},
      winProbability: {},
      matchInfo: {},
      commentary: [],
      testMatchInfo: {},
      matchStatus: ''
    };

    // Debug logs for team sections
    console.log('Starting data extraction...');

    // Match Title
    data.matchTitle = document.querySelector('.series-name .name-wrapper')?.textContent?.trim() || '';

    // Extract team names from match title with defensive programming
    let team1NameFromTitle = '';
    let team2NameFromTitle = '';

    try {
        if (data.matchTitle) {
            // Take only the first part before comma (e.g., "SA vs SL 1st TEST")
            const firstPart = data.matchTitle.split(',')[0];
            const matchTitleParts = firstPart.split(' vs ');
            if (matchTitleParts.length >= 2) {
                // Get first word of each part
                team1NameFromTitle = matchTitleParts[0]?.trim() || '';
                team2NameFromTitle = matchTitleParts[1]?.split(' ')?.[0]?.trim() || '';
            }
        }
    } catch (error) {
        console.error('Error parsing match title:', error);
    }

    // Team 1 Info
    const team1Section = document.querySelector('.team-inning');
    console.log('Team 1 section found:', !!team1Section);
    
    if (team1Section) {
      const teamNameElement = team1Section.querySelector('.team-name.team-1');
      const runsElement = team1Section.querySelector('.runs.f-runs');
      const scoreSpans = runsElement?.querySelectorAll('span');
      
      console.log('Team 1 elements found:', {
        nameElement: !!teamNameElement,
        name: teamNameElement?.textContent,
        scoreSpans: scoreSpans?.length || 0,
        runsFound: !!runsElement
      });
      
      const cleanTeamName = teamNameElement?.textContent?.split(/\s+\d/)?.[0]?.trim() || '';
      
      data.teams.team1 = {
        name: cleanTeamName || '',
        score: scoreSpans?.[0]?.textContent?.trim() || '',
        overs: scoreSpans?.[1]?.textContent?.trim() || '',
        logo: getTeamLogoPath(cleanTeamName) // Use local logo path instead of URL
      };

      // Only set team2 name if we successfully extracted both names from title
      if (team1NameFromTitle && team2NameFromTitle) {
        // If team1's name matches either name from title, use the other name for team2
        if (cleanTeamName === team1NameFromTitle) {
          data.teams.team2.name = team2NameFromTitle;
        } else if (cleanTeamName === team2NameFromTitle) {
          data.teams.team2.name = team1NameFromTitle;
        } else {
          // If no match found, use team2NameFromTitle as fallback
          data.teams.team2.name = team2NameFromTitle;
        }
      }

      // Debug log for team name assignment
      console.log('Team name assignment:', {
        matchTitle: data.matchTitle,
        team1FromTitle: team1NameFromTitle,
        team2FromTitle: team2NameFromTitle,
        cleanTeam1Name: cleanTeamName,
        finalTeam2Name: data.teams.team2.name
      });
    }

    // Team 2 Info
    const team2Section = document.querySelector('.team-inning.second-inning');
    console.log('Team 2 section found:', !!team2Section);
    
    if (team2Section) {
      const teamNameElement = team2Section.querySelector('.team-content.second-team .team-name.team-2 div');
      const runsElement = team2Section.querySelector('.team-score.text-right .runs.second-innings');
      const scoreSpans = runsElement?.querySelectorAll('span');
      
      console.log('Team 2 elements found:', {
        nameElement: !!teamNameElement,
        name: teamNameElement?.textContent,
        scoreSpans: scoreSpans?.length || 0,
        runsFound: !!runsElement,
        scores: Array.from(scoreSpans || []).map(span => span.textContent)
      });
      
      // Don't overwrite the name if we already set it from match title
      if (!data.teams.team2.name || data.teams.team2.name === 'CRR :') {
        // Extract team name from the full text that includes "CRR" and other info
        const fullText = teamNameElement?.textContent?.trim() || '';
        if (fullText.includes('opt to Bowl')) {
          // Extract team name from the text containing "opt to Bowl"
          const teamName = fullText.split('opt to Bowl')[0]
                                 .split('CRR :')[1]
                                 ?.trim()
                                 ?.split(' ')[1]; // Get the team name after CRR value
          if (teamName) {
            data.teams.team2.name = teamName;
          }
        }
      }
      
      // Get the last span for score and first span for overs
      const spans = Array.from(scoreSpans || []);
      const score = spans[spans.length - 1]?.textContent?.trim() || '';
      const overs = spans[0]?.textContent?.trim() || '';
      
      data.teams.team2 = {
        ...data.teams.team2, // Preserve the name we set earlier
        score: score,
        overs: overs,
        logo: getTeamLogoPath(data.teams.team2.name) // Use local logo path instead of URL
      };
    }

    // Log final team data
    console.log('Final team data:', {
      team1: data.teams.team1,
      team2: data.teams.team2
    });

    // Add custom styling to match title element
    const titleElement = document.querySelector('.series-name');
    if (titleElement) {
      titleElement.style.backgroundColor = '#cecfd0';
      titleElement.style.color = '#000'; // Setting text color to black for better contrast
    }

    // Current Event/Status in the middle box
    const middleStatusBox = document.querySelector('.team-result');
    if (middleStatusBox) {
      const resultBox = middleStatusBox.querySelector('.result-box');
      if (resultBox) {
        data.currentEvent = {
          text: resultBox.querySelector('.font2')?.textContent?.trim() || '',
          additionalInfo: resultBox.textContent?.trim() || ''
        };
      }
    }

    // Enhanced batsmen extraction with immediate updates
    const batsmenData = [];
    document.querySelectorAll('.batsmen-partnership').forEach(partnership => {
      if (!partnership.querySelector('.bowler')) {
        const batsmanInfo = partnership.querySelector('.batsmen-info-wrapper');
        if (batsmanInfo) {
          const nameElement = batsmanInfo.querySelector('.batsmen-name a');
          const shortName = nameElement?.querySelector('p')?.textContent?.trim() || '';
          // Extract full name from href
          const profileUrl = nameElement?.getAttribute('href') || '';
          const fullName = profileUrl
            .split('/')
            .pop() // Get last part of URL
            .replace(/-/g, ' ') // Replace hyphens with spaces
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize words
            .join(' ');

          const batsman = {
            id: batsmanInfo.getAttribute('data-player-id') || generatePlayerId(shortName),
            name: shortName,
            fullName: fullName || shortName,
            runs: '',
            balls: '',
            fours: '',
            sixes: '',
            strikeRate: '',
            onStrike: false,
            image: partnership.querySelector('.playerProfileDefault img')?.src,
            lastUpdated: Date.now()
          };

          // Extract score details
          const scoreText = batsmanInfo.querySelector('.batsmen-score')?.textContent.trim();
          if (scoreText) {
            const [runs, balls] = scoreText.match(/(\d+)\((\d+)\)/)?.slice(1) || [];
            batsman.runs = runs;
            batsman.balls = balls;
          }

          // Strike rate and boundaries
          const strikeWrapper = partnership.querySelector('.player-strike-wrapper');
          if (strikeWrapper) {
            const stats = strikeWrapper.querySelectorAll('.strike-rate');
            stats.forEach(stat => {
              const text = stat.textContent.trim();
              if (text.includes('4s:')) batsman.fours = text.split(':')[1].trim();
              if (text.includes('6s:')) batsman.sixes = text.split(':')[1].trim();
              if (text.includes('SR:')) batsman.strikeRate = text.split(':')[1].trim();
            });
          }

          batsman.onStrike = !!batsmanInfo.querySelector('.circle-strike-icon');
          batsmenData.push(batsman);
        }
      }
    });
    data.batsmen = batsmenData;

    // Enhanced bowler extraction with immediate updates
    const bowlerSection = document.querySelector('.batsmen-partnership .bowler');
    if (bowlerSection) {
      const bowlerInfo = bowlerSection.closest('.batsmen-partnership').querySelector('.batsmen-info-wrapper');
      if (bowlerInfo) {
        const nameElement = bowlerInfo.querySelector('.batsmen-name a');
        const shortName = nameElement?.querySelector('p')?.textContent?.trim() || '';
        // Extract full name from href
        const profileUrl = nameElement?.getAttribute('href') || '';
        const fullName = profileUrl
          .split('/')
          .pop()
          .replace(/-/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        // Get the full figures text (e.g. "3-22(2.0)")
        const bowlerFigures = bowlerInfo.querySelector('.batsmen-score.bowler')?.textContent?.trim() || '';
        
        // Split figures into main score and overs
        const [mainScore, oversInBrackets] = bowlerFigures.split('(');
        const overs = oversInBrackets ? oversInBrackets.replace(')', '') : '0.0';
        
        // Split main score into wickets and runs
        const [wickets, runs] = mainScore.split('-').map(s => s.trim());
        
        const economyText = bowlerSection.closest('.batsmen-partnership').querySelector('.player-strike-wrapper .strike-rate')?.textContent || '';
        
        data.bowler = {
          id: bowlerInfo.getAttribute('data-player-id') || generatePlayerId(shortName),
          name: shortName,
          fullName: fullName || shortName,
          wickets: wickets || '0',
          runs: runs || '0',
          overs: overs,
          economy: economyText.includes('Econ:') ? economyText.split(':')[1]?.trim() : '0.00',
          image: bowlerSection.querySelector('.playerProfileDefault img')?.src || '',
          lastUpdated: Date.now()
        };
      }
    }

    // Current Run Rate (CRR) and Required Run Rate (RRR) extraction
    const runRateData = document.querySelectorAll('.team-run-rate .data');
    if (runRateData.length > 0) {
      data.currentInnings = {
        ...data.currentInnings,
        CRR: runRateData[0].textContent.trim(),
        RRR: runRateData[1]?.textContent.trim() || ''  // Get second run rate if it exists
      };
    }

    // Recent Overs
    document.querySelectorAll('.overs-slide').forEach(over => {
      const overData = {
        type: over.querySelector('.content')?.firstChild?.textContent.trim(),
        balls: [],
        total: over.querySelector('.total')?.textContent.replace('=', '').trim(),
        wasThisOver: false,
        totalChanged: false,
        isCurrentOver: false
      };

      // Check if this is "This Over"
      if (over.querySelector('.content')?.firstChild?.textContent.trim() === 'This Over') {
        overData.isCurrentOver = true;
        const totalElement = over.querySelector('.total');
        overData.isComplete = totalElement?.classList.contains('complete') || false;
        
        // Get actual balls that have been bowled (excluding empty ones)
        const actualBalls = Array.from(over.querySelectorAll('.over-ball')).filter(ball => {
          const ballText = ball.textContent.trim();
          return ballText !== '' && ballText !== '•' && !ball.classList.contains('empty');
        });

        if (actualBalls.length > 0) {
          // If we have actual balls, use them
          overData.balls = actualBalls.map(ball => ({
            value: ball.textContent.trim(),
            type: ball.className.includes('ml-o-b-w') ? 'wicket' :
                  ball.className.includes('ml-o-b-4') ? 'four' :
                  ball.className.includes('ml-o-b-6') ? 'six' :
                  ball.className.includes('ml-o-b-wd') ? 'wide' :
                  ball.className.includes('ml-o-b-nb') ? 'noball' :
                  ball.className.includes('ml-o-b-lb') ? 'legbye' : 'regular'
          }));
        } else if (!overData.isComplete) {
          // If no actual balls and over is not complete, show just one dot
          overData.balls = [{
            value: '•',
            type: 'regular'
          }];
        }
      } else {
        // For past overs, get all actual balls
        overData.isComplete = true;
        overData.balls = Array.from(over.querySelectorAll('.over-ball'))
          .filter(ball => {
            const ballText = ball.textContent.trim();
            return ballText !== '' && ballText !== '•';
          })
          .map(ball => ({
            value: ball.textContent.trim(),
            type: ball.className.includes('ml-o-b-w') ? 'wicket' :
                  ball.className.includes('ml-o-b-4') ? 'four' :
                  ball.className.includes('ml-o-b-6') ? 'six' :
                  ball.className.includes('ml-o-b-wd') ? 'wide' :
                  ball.className.includes('ml-o-b-nb') ? 'noball' :
                  ball.className.includes('ml-o-b-lb') ? 'legbye' : 'regular'
          }));
      }

      data.recentOvers.push(overData);
    });

    // Projected Score
    const projectedScoreSection = document.querySelector('.projected-score');
    if (projectedScoreSection) {
      // Get all over labels
      const overLabels = Array.from(projectedScoreSection.querySelectorAll('.over-text'));
      
      // Get the last over label text (e.g., "10 Overs")
      const lastOverLabel = overLabels[overLabels.length - 1]?.textContent.trim() || '10 Overs';
      
      const formattedData = {
        'Run Rate': [],
        [lastOverLabel]: []  // Use the exact label text
      };

      // Get run rates from first row
      const runRates = Array.from(projectedScoreSection.querySelectorAll('.rr-data'))
        .map(rate => rate.textContent.trim())
        .filter(rate => !isNaN(parseFloat(rate.replace('*', ''))));
      formattedData['Run Rate'] = runRates.slice(0, 4); // Only take first 4 rates

      // Find the row containing the full innings projection (last set of 4 numbers)
      const allProjections = Array.from(projectedScoreSection.querySelectorAll('.over-data'))
        .map(proj => proj.textContent.trim());
      
      // Get only the last 4 values which represent the final over projections
      const lastFourProjections = allProjections.slice(-4);
      formattedData[lastOverLabel] = lastFourProjections;

      data.projectedScore = formattedData;
    }

    // Win Probability
    const probabilitySection = document.querySelector('.odds-session-left');
    if (probabilitySection) {
      const teams = {};
      const teamElements = probabilitySection.querySelectorAll('.teamNameScreenText');
      const percentages = probabilitySection.querySelectorAll('.percentageScreenText');
      
      if (teamElements.length === 2 && percentages.length === 2) {
        teams[teamElements[0].textContent.trim()] = percentages[0].textContent.trim().replace('%', '');
        teams[teamElements[1].textContent.trim()] = percentages[1].textContent.trim().replace('%', '');
      } else {
        // Fallback to existing method if structure doesn't match
        teamElements.forEach(teamElement => {
          const teamName = Array.from(teamElement.childNodes)
            .find(node => node.nodeType === Node.TEXT_NODE)?.textContent?.trim();
          const percentage = teamElement.querySelector('.perSpan')?.textContent?.trim();
          if (teamName && percentage) {
            teams[teamName] = percentage.replace('%', '');
          }
        });
      }
      
      if (Object.keys(teams).length > 0) {
        data.winProbability = teams;
      }
    }

    // Test Match Data
    const testDataSection = document.querySelector('.live-test-data');
    if (testDataSection) {
      const testData = {
        daySession: '',
        oversLeft: ''
      };

      // Get Day/Session info
      const daySessionElement = testDataSection.querySelector('.test-data.text-left');
      if (daySessionElement) {
        const spans = daySessionElement.querySelectorAll('span');
        testData.daySession = Array.from(spans)
          .map(span => span.textContent.trim())
          .join('');
      }

      // Get Overs Left info - Updated selector to match new structure
      const oversLeftElement = testDataSection.querySelector('.test-data.text-right');
      if (oversLeftElement) {
        const spans = oversLeftElement.querySelectorAll('span');
        // Get just the number value from the second span
        const oversValue = spans[1]?.textContent?.trim() || '';
        testData.oversLeft = `Overs left today: ${oversValue}`;
      }

      data.testMatchInfo = testData;
    }

    // Get match status from the final-result element
    const matchStatusElement = document.querySelector('.final-result.m-none');
    if (matchStatusElement) {
      data.matchStatus = matchStatusElement.textContent?.trim() || '';
      
      // Debug logging
      console.log('Match Status Element:', {
        element: matchStatusElement,
        text: data.matchStatus
      });
    }

    // Inside extractData function, add this section to properly get additionalInfo:
    const additionalInfoElement = document.querySelector('.final-result.m-none, .result-box');
    if (additionalInfoElement) {
      data.additionalInfo = additionalInfoElement.textContent?.trim() || '';
      console.log('📢 Additional Info found:', data.additionalInfo); // Debug log
    }

    // Update batsmen image URLs
    if (data.batsmen) {
      data.batsmen = data.batsmen.map(batsman => ({
        ...batsman,
        image: getPlayerImagePath(batsman.name)
      }));
    }

    // Update bowler image URL
    if (data.bowler) {
      data.bowler = {
        ...data.bowler,
        image: getPlayerImagePath(data.bowler.name)
      };
    }

    return data;
  } catch (error) {
    console.error('Error extracting data:', error);
    return {};
  }
}

// Helper function to generate consistent player IDs
function generatePlayerId(name) {
  return name ? `player_${name.toLowerCase().replace(/\s+/g, '_')}` : `unknown_${Date.now()}`;
}

// Enhanced data comparison function
function hasDataChanged(oldData, newData) {
  // Compare player-specific data separately for more granular updates
  const hasPlayerDataChanged = (old, current) => {
    if (!old || !current) return true;
    return JSON.stringify({
      image: current.image,
      name: current.name,
      id: current.id
    }) !== JSON.stringify({
      image: old.image,
      name: old.name,
      id: old.id
    });
  };

  // Check if any batsman data changed
  const batsmenChanged = newData.batsmen?.some(newBatsman => {
    const oldBatsman = oldData?.batsmen?.find(old => old.id === newBatsman.id);
    return hasPlayerDataChanged(oldBatsman, newBatsman);
  });

  // Check if bowler data changed
  const bowlerChanged = hasPlayerDataChanged(oldData?.bowler, newData?.bowler);

  // Combine with other essential checks
  return batsmenChanged || 
         bowlerChanged || 
         JSON.stringify([
           newData.teams,
           newData.currentInnings,
           newData.recentOvers,
           newData.currentEvent
         ]) !== JSON.stringify([
           oldData?.teams,
           oldData?.currentInnings,
           oldData?.recentOvers,
           oldData?.currentEvent
         ]);
}

// Add reconnection logic
let retryCount = 0;
const MAX_RETRIES = 3;

// Add these constants at the top of the file
const ADDITIONAL_URLS = {
  PLAYER_STATS: (playerId) => `https://crex.live/cricket/player/${playerId}/stats`,
  TEAM_STATS: (teamId) => `https://crex.live/cricket/team/${teamId}/stats`,
  HEAD_TO_HEAD: (team1Id, team2Id) => `https://crex.live/cricket/teams/${team1Id}-vs-${team2Id}/stats`,
  VENUE_STATS: (venueId) => `https://crex.live/cricket/ground/${venueId}/stats`
};

// Add this function to extract additional data using Playwright
async function extractAdditionalData(data) {
  try {
    // Only proceed if we have valid team or player data
    if (!data?.teams?.team1?.name && !data?.batsmen?.length) {
      return data;
    }

    // Send message to background script to initiate Playwright scraping
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({
        type: 'SCRAPE_ADDITIONAL_DATA',
        data: {
          teams: {
            team1: data.teams.team1?.name,
            team2: data.teams.team2?.name
          },
          players: [
            ...data.batsmen.map(b => b.name),
            data.bowler?.name
          ].filter(Boolean),
          matchUrl: window.location.href
        }
      });
    }

    return data;
  } catch (error) {
    console.error('Error extracting additional data:', error);
    return data;
  }
}

// Modify the sendDirectUpdate function
const sendDirectUpdate = async (data) => {
  console.log('📤 Content Script: Sending update via DOM:', {
    timestamp: Date.now(),
    data: data
  });
  
  try {
    // Enhance data with additional information
    const enhancedData = await extractAdditionalData(data);
    
    // Primary method: DOM Events
    const event = new CustomEvent('CRICKET_DATA_UPDATE', { detail: enhancedData });
    document.dispatchEvent(event);
    
    // Secondary method: Try Chrome messaging if available
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({
        type: 'LIVE_CRICKET_UPDATE',
        source: 'crex',
        data: enhancedData,
        timestamp: Date.now()
      }).catch(error => {
        console.log('Chrome messaging unavailable - continuing with DOM events only');
      });
    }

    // Update HTTP request to use HTTPS and correct IP
    fetch('https://192.168.1.11:5000/update-data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'crex',
        ...enhancedData,
        timestamp: Date.now()
      })
    }).catch(error => {
      console.log('Express server update failed - continuing with WebSocket');
    });

  } catch (error) {
    console.error('❌ Failed to send update:', error);
  }
};

// Modify startObserving to handle extension context
function startObserving() {
  // Check extension context before starting
  if (!chrome.runtime?.id) {
    console.warn('Extension context invalid on start, using DOM events only');
    return;
  }
  
  const scoreCard = document.querySelector('.live-score-card');
  
  if (scoreCard) {
    observer.observe(scoreCard, observerConfig);
  } else {
    observer.observe(document.body, observerConfig);
  }
}

// Modify observer to handle errors
const observer = new MutationObserver((mutations) => {
  try {
    const data = extractData();
    
    if (hasDataChanged(lastData, data)) {
      lastData = data;
      sendDirectUpdate(data);
    }
  } catch (error) {
    console.error('Error:', error);
    if (error.message.includes('Extension context invalidated')) {
      observer.disconnect();
      startObserving();
    }
  }
});

// Initialize when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startObserving);
} else {
  startObserving();
}