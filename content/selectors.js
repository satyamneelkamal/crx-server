// Store working selectors
export const SELECTORS = {
  basicInfo: {
    seriesName: '.series-name .name-wrapper span',
    matchDate: '.match-date',
    venue: '.match-venue'
  },
  teamForm: {
    container: '.format-match',
    teamName: '.form-team-name',
    shortForm: '.match',
    shortFormResult: 'span',
    recentMatches: {
      container: '.team-form-card',
      team1: {
        container: '.form-team-detail.form-mweb-team',
        name: '.team-name',
        scores: '.team-score'
      },
      team2: {
        container: '.form-team-detail:not(.form-mweb-team)',
        name: '.team-name',
        scores: '.team-score'
      },
      result: '.form-match-no .match span',
      matchInfo: {
        number: '.match-name',
        series: '.series-name'
      }
    }
  },
  headToHead: {
    container: '.team-header-card',
    stats: {
      team1: {
        name: '.team1 .team-name',
        wins: '.team1-wins'
      },
      team2: {
        name: '.team2 .team-name',
        wins: '.team2-wins'
      }
    },
    matches: {
      container: '.global-card-wrap',
      team1: {
        name: '.global-match-team .team-name',
        scores: '.global-match-team .team-score'
      },
      team2: {
        name: '.global-match-end .team-name',
        scores: '.global-match-end .team-score'
      },
      result: '.match-dec-text',
      matchInfo: '.series-name.text-center'
    }
  },
  venueStats: {
    matches: {
      count: '.match-count',
      text: '.match-level'
    },
    winPercentages: {
      batFirst: '.win-bat-first .match-win-per',
      bowlFirst: '.venue-per:not(.win-bat-first) .match-win-per'
    },
    averageScores: {
      container: '.venue-avg-wrap',
      firstInnings: '.venue-right-content:first-child .venue-avg-wrap:first-child .venue-avg-val',
      secondInnings: '.venue-right-content:first-child .venue-avg-wrap:last-child .venue-avg-val',
      thirdInnings: '.venue-right-content-sec .venue-avg-wrap:first-child .venue-avg-val',
      fourthInnings: '.venue-right-content-sec .venue-avg-wrap:last-child .venue-avg-val'
    },
    totals: {
      highest: {
        score: '.venue-score:first',
        teams: '.venue-vs-team-text:first'
      },
      lowest: {
        score: '.venue-score:last',
        teams: '.venue-vs-team-text:last'
      }
    },
    recentMatches: {
      container: '.venue-heading + div .global-card-wrap',
      team1: {
        name: '.global-match-team .team-name',
        scores: '.global-match-team .team-score'
      },
      team2: {
        name: '.global-match-end .team-name',
        scores: '.global-match-end .team-score'
      },
      result: '.match-dec-text',
      matchInfo: '.series-name.text-center'
    }
  },
  weatherInfo: {
    temperature: '.weather-temp',
    condition: '.weather-cloudy-text:first',
    humidity: '.humidity-text',
    precipitation: '.weather-place-hum-text:last'
  },
  recentMatches: {
    container: '.format-match-exp .team-form-card',
    team1: {
      name: '.form-team-detail.form-mweb-team .team-name',
      scores: '.form-team-detail.form-mweb-team .team-score'
    },
    team2: {
      name: '.form-team-detail:not(.form-mweb-team) .team-name',
      scores: '.form-team-detail:not(.form-mweb-team) .team-score'
    },
    result: '.form-match-no .match span',
    matchInfo: {
      number: '.match-name',
      series: '.series-name'
    }
  },
  teamComparison: {
    title: {
      main: '.team-form-comp .title-text',
      subtitle: '.last-match-text'
    },
    container: '.team-form.team-form-comp',
    buttons: {
      overall: '.team-comp-type:first-child',
      onVenue: '.team-comp-type:nth-child(2)'
    },
    teams: {
      team1: {
        name: '.team1 .team-name',
        context: '.team1 .all-team-txt'
      },
      team2: {
        name: '.team2 .team-name',
        context: '.team2 .all-team-txt'
      }
    },
    stats: {
      table: '.table-responsive table',
      rows: '.table-responsive table tr',
      columns: {
        team1: 'td:first-child',
        label: 'td:nth-child(2)',
        team2: 'td:last-child'
      }
    }
  },
  tossInfo: {
    container: '.toss-wrap',
    text: '.toss-wrap p'
  },
  playingXI: {
    container: '.playingxi',
    teamButtons: '.playingxi-button',
    players: {
      container: '.playingxi-card-row',
      name: '.p-name',
      role: '.bat-ball-type div',
      captain: '.name-h .flex div:nth-child(2)',
      wicketkeeper: '.name-h .flex div:nth-child(2)'
    },
    bench: {
      button: '.bench-toggle',
      container: '.playingxi-card-row',
      players: {
        name: '.p-name',
        role: '.bat-ball-type div'
      }
    }
  },
  umpires: {
    container: '.content-wrap',
    sections: '.pb24',
    key: '.umpire-key',
    value: '.umpire-val'
  }
}; 