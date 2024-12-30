export const selectors = {
  player: {
    stats: '.player-stats',
    name: '.player-name',
    battingStats: '.batting-stats',
    bowlingStats: '.bowling-stats',
    recentForm: '.recent-form .innings'
  },
  team: {
    stats: '.team-stats',
    recentForm: '.team-recent-form .match',
    headToHead: '.head-to-head-stats',
    tournamentStats: '.tournament-stats'
  },
  venue: {
    stats: '.venue-stats',
    recentMatches: '.venue-recent-matches .match'
  }
};

export const extractors = {
  cleanText: (text) => text?.trim().replace(/\s+/g, ' ') || '',
  
  parseNumber: (text) => {
    const num = parseFloat(text?.replace(/[^\d.-]/g, ''));
    return isNaN(num) ? null : num;
  },
  
  parseDate: (text) => {
    try {
      return new Date(text).toISOString();
    } catch {
      return null;
    }
  }
}; 