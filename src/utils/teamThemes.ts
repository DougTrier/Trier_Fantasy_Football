// teamThemes.ts - Official NFL Color Mappings & Assets

export interface TeamTheme {
    primary: string;
    secondary: string;
    accent: string;
    logoUrl: string; // ESPN CDN standard
    fullName: string;
}

export const getTeamTheme = (teamAbbr: string): TeamTheme => {
    const code = teamAbbr.toUpperCase();
    return TEAM_THEMES[code] || TEAM_THEMES['NFL'];
};

const TEAM_THEMES: Record<string, TeamTheme> = {
    'ARI': { primary: '#97233F', secondary: '#000000', accent: '#FFB612', fullName: 'Arizona Cardinals', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/ari.png' },
    'ATL': { primary: '#A71930', secondary: '#000000', accent: '#A5ACAF', fullName: 'Atlanta Falcons', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/atl.png' },
    'BAL': { primary: '#241773', secondary: '#000000', accent: '#9E7C0C', fullName: 'Baltimore Ravens', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/bal.png' },
    'BUF': { primary: '#00338D', secondary: '#C60C30', accent: '#FFFFFF', fullName: 'Buffalo Bills', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/buf.png' },
    'CAR': { primary: '#0085CA', secondary: '#101820', accent: '#bfc0bf', fullName: 'Carolina Panthers', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/car.png' },
    'CHI': { primary: '#0B162A', secondary: '#C83803', accent: '#FFFFFF', fullName: 'Chicago Bears', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/chi.png' },
    'CIN': { primary: '#FB4F14', secondary: '#000000', accent: '#FFFFFF', fullName: 'Cincinnati Bengals', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/cin.png' },
    'CLE': { primary: '#311D00', secondary: '#FF3C00', accent: '#FFFFFF', fullName: 'Cleveland Browns', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/cle.png' },
    'DAL': { primary: '#003594', secondary: '#869397', accent: '#FFFFFF', fullName: 'Dallas Cowboys', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/dal.png' },
    'DEN': { primary: '#FB4F14', secondary: '#002244', accent: '#FFFFFF', fullName: 'Denver Broncos', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/den.png' },
    'DET': { primary: '#0076B6', secondary: '#B0B7BC', accent: '#000000', fullName: 'Detroit Lions', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/det.png' },
    'GB': { primary: '#203731', secondary: '#FFB612', accent: '#FFFFFF', fullName: 'Green Bay Packers', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/gb.png' },
    'HOU': { primary: '#03202F', secondary: '#A71930', accent: '#FFFFFF', fullName: 'Houston Texans', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/hou.png' },
    'IND': { primary: '#002C5F', secondary: '#A2AAAD', accent: '#FFFFFF', fullName: 'Indianapolis Colts', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/ind.png' },
    'JAX': { primary: '#006778', secondary: '#D7A22A', accent: '#101820', fullName: 'Jacksonville Jaguars', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/jax.png' },
    'KC': { primary: '#E31837', secondary: '#FFB81C', accent: '#FFFFFF', fullName: 'Kansas City Chiefs', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/kc.png' },
    'LV': { primary: '#000000', secondary: '#A5ACAF', accent: '#FFFFFF', fullName: 'Las Vegas Raiders', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/lv.png' },
    'LAC': { primary: '#0080C6', secondary: '#FFC20E', accent: '#FFFFFF', fullName: 'Los Angeles Chargers', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/lac.png' },
    'LAR': { primary: '#003594', secondary: '#FFA300', accent: '#FFFFFF', fullName: 'Los Angeles Rams', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/lar.png' },
    'MIA': { primary: '#008E97', secondary: '#FC4C02', accent: '#005778', fullName: 'Miami Dolphins', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/mia.png' },
    'MIN': { primary: '#4F2683', secondary: '#FFC62F', accent: '#FFFFFF', fullName: 'Minnesota Vikings', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/min.png' },
    'NE': { primary: '#002244', secondary: '#C60C30', accent: '#B0B7BC', fullName: 'New England Patriots', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/ne.png' },
    'NO': { primary: '#D3BC8D', secondary: '#101820', accent: '#FFFFFF', fullName: 'New Orleans Saints', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/no.png' },
    'NYG': { primary: '#0B2265', secondary: '#A71930', accent: '#A5ACAF', fullName: 'New York Giants', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/nyg.png' },
    'NYJ': { primary: '#125740', secondary: '#000000', accent: '#FFFFFF', fullName: 'New York Jets', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/nyj.png' },
    'PHI': { primary: '#004C54', secondary: '#A5ACAF', accent: '#ACC0C6', fullName: 'Philadelphia Eagles', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/phi.png' },
    'PIT': { primary: '#FFB612', secondary: '#101820', accent: '#FFFFFF', fullName: 'Pittsburgh Steelers', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/pit.png' },
    'SF': { primary: '#AA0000', secondary: '#B3995D', accent: '#FFFFFF', fullName: 'San Francisco 49ers', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/sf.png' },
    'SEA': { primary: '#002244', secondary: '#69BE28', accent: '#A5ACAF', fullName: 'Seattle Seahawks', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/sea.png' },
    'TB': { primary: '#D50A0A', secondary: '#FF7900', accent: '#0A0A08', fullName: 'Tampa Bay Buccaneers', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/tb.png' },
    'TEN': { primary: '#0C2340', secondary: '#4B92DB', accent: '#C8102E', fullName: 'Tennessee Titans', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/ten.png' },
    'WAS': { primary: '#5A1414', secondary: '#FFB612', accent: '#FFFFFF', fullName: 'Washington Commanders', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/teamlogos/nfl/500/was.png' },

    // Default / Free Agent
    'NFL': { primary: '#013369', secondary: '#D50A0A', accent: '#FFFFFF', fullName: 'Free Agent', logoUrl: 'https://a.espncdn.com/combiner/i?img=/i/league/nfl.png' }
};
