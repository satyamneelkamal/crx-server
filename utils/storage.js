const MATCH_STATES = {
  INDICATORS: {
    INNINGS_START: 'player entering',
    INNINGS_BREAK: 'Innings break',
    ALL_OUT: '10'
  }
};

const MatchStorage = {
  KEYS: {
    INNINGS_STATE: 'innings_state',
    FIRST_INNINGS: 'first_innings',
    LAST_TRANSITION: 'last_transition'
  },

  // Store first innings data when it ends
  storeFirstInnings(data) {
    try {
      const firstInningsData = {
        team: data.team,
        score: data.score,
        overs: data.overs,
        timestamp: Date.now()
      };
      localStorage.setItem(this.KEYS.FIRST_INNINGS, JSON.stringify(firstInningsData));
      return true;
    } catch (error) {
      console.error('Failed to store first innings:', error);
      return false;
    }
  },

  // Get stored first innings
  getFirstInnings() {
    try {
      const data = localStorage.getItem(this.KEYS.FIRST_INNINGS);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get first innings:', error);
      return null;
    }
  },

  // Detect innings transitions
  detectInningsTransition(eventText, wickets) {
    try {
      if (!eventText) return null;
      
      const lowerEventText = eventText.toLowerCase();
      const currentState = this.getInningsState();

      // Check for innings end
      if (
        lowerEventText.includes(MATCH_STATES.INDICATORS.INNINGS_BREAK) ||
        wickets === MATCH_STATES.INDICATORS.ALL_OUT
      ) {
        // Store first innings data before transitioning
        if (!this.getFirstInnings()) {
          this.storeFirstInnings(currentState);
        }
        return 'INNINGS_END';
      }

      // Check for second innings start
      if (lowerEventText.includes(MATCH_STATES.INDICATORS.INNINGS_START)) {
        const firstInnings = this.getFirstInnings();
        if (firstInnings) {
          return 'INNINGS_START';
        }
      }

      return null;
    } catch (error) {
      console.error('Error detecting innings transition:', error);
      return null;
    }
  },

  // Get current match display state
  getMatchDisplayState() {
    try {
      const currentInnings = this.getInningsState();
      const firstInnings = this.getFirstInnings();

      // Always show current innings on left
      const leftTeam = currentInnings ? {
        name: currentInnings.team,
        score: currentInnings.score,
        overs: currentInnings.overs
      } : null;

      // Show first innings on right if it exists
      const rightTeam = firstInnings ? {
        name: firstInnings.team,
        score: firstInnings.score,
        overs: firstInnings.overs
      } : null;

      return {
        leftTeam,
        rightTeam,
        inningsNumber: firstInnings ? 2 : 1
      };
    } catch (error) {
      console.error('Failed to get match display state:', error);
      return {
        leftTeam: null,
        rightTeam: null,
        inningsNumber: 0
      };
    }
  },

  // Clear stored data
  clearMatchData() {
    try {
      localStorage.removeItem(this.KEYS.INNINGS_STATE);
      localStorage.removeItem(this.KEYS.FIRST_INNINGS);
      localStorage.removeItem(this.KEYS.LAST_TRANSITION);
    } catch (error) {
      console.error('Failed to clear match data:', error);
    }
  }
}; 