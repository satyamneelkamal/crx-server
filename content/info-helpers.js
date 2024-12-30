import { SELECTORS } from './selectors.js';

export async function getTeamPlayers(page) {
  console.log('Getting playing XI...');
  
  // Get playing XI first with additional player info
  const playingXI = await page.$$eval('.playingxi-card-row', rows => {
    return rows.map(row => {
      const nameElement = row.querySelector('.p-name');
      const name = nameElement?.textContent?.trim();
      const fullName = nameElement?.closest('a')?.getAttribute('title')?.trim() || name;
      const role = row.querySelector('.bat-ball-type div')?.textContent?.trim();
      const extraInfo = row.querySelector('.name-h .flex div:nth-child(2)')?.textContent?.trim() || '';
      
      // Get player profile link and extract ID properly
      const profileLink = nameElement?.closest('a')?.href || '';
      const playerId = profileLink.split('/player-profile/')?.pop()?.split('/')?.[0] || '';
      
      return {
        name: fullName,
        shortName: name,
        role,
        isCaptain: extraInfo.includes('(C)'),
        isWicketkeeper: extraInfo.includes('(WK)'),
        playerId,
        profileUrl: profileLink
      };
    });
  });

  console.log('Getting bench players...');
  let benchPlayers = [];
  
  try {
    // Click "On Bench" button
    const benchButton = await page.$('.bench-toggle');
    if (benchButton) {
      await benchButton.click();
      await page.waitForTimeout(1000); // Wait for animation

      // Wait for bench section to be visible
      await page.waitForSelector('.on-bench-wrap', { timeout: 5000 });

      // Get bench players with more specific selector and additional info
      benchPlayers = await page.$$eval('.on-bench-wrap .playingxi-card-row', rows => {
        return rows.map(row => {
          const nameElement = row.querySelector('.p-name');
          const name = nameElement?.textContent?.trim();
          const fullName = nameElement?.closest('a')?.getAttribute('title')?.trim() || name;
          const role = row.querySelector('.bat-ball-type div')?.textContent?.trim();
          
          // Get player profile link and extract ID properly
          const profileLink = nameElement?.closest('a')?.href || '';
          const playerId = profileLink.split('/player-profile/')?.pop()?.split('/')?.[0] || '';
          
          return {
            name: fullName,
            shortName: name,
            role,
            isBench: true,
            playerId,
            profileUrl: profileLink
          };
        });
      });

      // Click bench button again to close it
      await benchButton.click();
      await page.waitForTimeout(500);
    }
  } catch (error) {
    console.error('Error getting bench players:', error);
  }

  return {
    playingXI: playingXI.filter(Boolean),
    benchPlayers: benchPlayers.filter(p => p.name && p.role)
  };
}

export async function getPlayingXI(page) {
  const teams = {};
  
  // Get first team
  const team1Name = await page.$eval('.playingxi-button.selected', el => el.textContent.trim());
  const team1Players = await getTeamPlayers(page);
  teams[team1Name] = team1Players;
  
  // Click second team's button
  const team2Button = await page.$('.playingxi-button:not(.selected)');
  if (team2Button) {
    await team2Button.click();
    await page.waitForTimeout(1000);
    
    // Get second team's players
    const team2Name = await page.$eval('.playingxi-button.selected', el => el.textContent.trim());
    const team2Players = await getTeamPlayers(page);
    teams[team2Name] = team2Players;
  }
  
  return teams;
}

export async function getComparisonStats($, type) {
  const title = {
    main: $(SELECTORS.teamComparison.title.main).clone().children().remove().end().text().trim(),
    subtitle: $(SELECTORS.teamComparison.title.subtitle).text().trim()
  };

  const teams = {
    team1: {
      name: $(SELECTORS.teamComparison.teams.team1.name)
        .text()
        .trim()
        .replace(/([A-Z])\1+/g, '$1')
        .substring(0, 2),
      context: $(SELECTORS.teamComparison.teams.team1.context).text().trim()
    },
    team2: {
      name: $(SELECTORS.teamComparison.teams.team2.name)
        .text()
        .trim()
        .replace(/([A-Z])\1+/g, '$1')
        .substring(0, 2),
      context: $(SELECTORS.teamComparison.teams.team2.context).text().trim()
    }
  };

  const stats = $(SELECTORS.teamComparison.stats.rows).map((i, row) => {
    const $row = $(row);
    const label = $row.find(SELECTORS.teamComparison.stats.columns.label).text().trim();
    if (label) {
      return {
        team1Value: $row.find(SELECTORS.teamComparison.stats.columns.team1).text().trim(),
        label: label,
        team2Value: $row.find(SELECTORS.teamComparison.stats.columns.team2).text().trim()
      };
    }
  }).get().filter(Boolean);

  return {
    type,
    title,
    teams,
    stats
  };
} 