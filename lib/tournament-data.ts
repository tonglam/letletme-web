import { Tournament, TournamentEntry } from "@/types/tournament";

// Sample tournament data
export const tournaments: Tournament[] = [
  {
    id: "t1",
    name: "Premier League Fan Cup",
    gameweek: 21,
    averagePoints: 41,
    highestPoints: 78,
    totalEntries: 21568,
    entries: [
      {
        id: "1",
        rank: 1,
        previousRank: 3,
        teamName: "Arsenal Guangzhou FC",
        managerName: "Gunners Fan",
        captainName: "M.Salah",
        captainTeam: "LIV",
        captainPoints: 16,
        livePoints: 78,
        totalPoints: 1788,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: true,
          wildcard: false
        }
      },
      {
        id: "2",
        rank: 2,
        previousRank: 1,
        teamName: "沉迷于搬砖不想披",
        managerName: "Brick Layer",
        captainName: "M.Salah",
        captainTeam: "LIV",
        captainPoints: 14,
        livePoints: 77,
        totalPoints: 1684,
        playersPlayed: 12,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "3",
        rank: 3,
        previousRank: 2,
        teamName: "世俱杯冠军阿森纳",
        managerName: "Arsenal Champion",
        captainName: "M.Salah",
        captainTeam: "LIV",
        captainPoints: 14,
        livePoints: 76,
        totalPoints: 1909,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: true
        }
      },
      {
        id: "4",
        rank: 4,
        previousRank: 8,
        teamName: "Lord Bendtner",
        managerName: "Nick B",
        captainName: "M.Salah",
        captainTeam: "LIV",
        captainPoints: 12,
        livePoints: 73,
        totalPoints: 1555,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "5",
        rank: 5,
        previousRank: 4,
        teamName: "JackieHooooooo",
        managerName: "Jackie H",
        captainName: "M.Salah",
        captainTeam: "LIV",
        captainPoints: 14,
        livePoints: 71,
        totalPoints: 1836,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "6",
        rank: 5,
        previousRank: 5,
        teamName: "WHY NOT",
        managerName: "Just Because",
        captainName: "M.Salah",
        captainTeam: "LIV",
        captainPoints: 14,
        livePoints: 71,
        totalPoints: 1810,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "7",
        rank: 5,
        previousRank: 6,
        teamName: "杀猪会 tong牛合屋之人",
        managerName: "Tong",
        captainName: "M.Salah",
        captainTeam: "LIV",
        captainPoints: 12,
        livePoints: 71,
        totalPoints: 1779,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "8",
        rank: 5,
        previousRank: 10,
        teamName: "Arminia Bielefeld",
        managerName: "German Fan",
        captainName: "M.Salah",
        captainTeam: "LIV",
        captainPoints: 16,
        livePoints: 71,
        totalPoints: 1861,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "9",
        rank: 9,
        previousRank: 7,
        teamName: "Chelsea Forever Blue",
        managerName: "Blues Fan",
        captainName: "Haaland",
        captainTeam: "MCI",
        captainPoints: 12,
        livePoints: 68,
        totalPoints: 1723,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: true,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "10",
        rank: 10,
        previousRank: 9,
        teamName: "Spurs Are On Fire",
        managerName: "Tottenham Loyal",
        captainName: "Son",
        captainTeam: "TOT",
        captainPoints: 18,
        livePoints: 67,
        totalPoints: 1690,
        playersPlayed: 10,
        playersToPlay: 1,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "11",
        rank: 11,
        previousRank: 13,
        teamName: "Manchester is Red",
        managerName: "United Fan",
        captainName: "Fernandes",
        captainTeam: "MUN",
        captainPoints: 14,
        livePoints: 65,
        totalPoints: 1644,
        playersPlayed: 10,
        playersToPlay: 1,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "12",
        rank: 12,
        previousRank: 11,
        teamName: "Citizens Army",
        managerName: "City Fan",
        captainName: "Haaland",
        captainTeam: "MCI",
        captainPoints: 12,
        livePoints: 64,
        totalPoints: 1678,
        playersPlayed: 9,
        playersToPlay: 2,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      }
    ]
  },
  {
    id: "t2",
    name: "Champions League Fantasy",
    gameweek: 21,
    averagePoints: 36,
    highestPoints: 72,
    totalEntries: 15784,
    entries: [
      {
        id: "2",
        rank: 1,
        previousRank: 2,
        teamName: "沉迷于搬砖不想披",
        managerName: "Brick Layer",
        captainName: "M.Salah",
        captainTeam: "LIV",
        captainPoints: 14,
        livePoints: 74,
        totalPoints: 1624,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "1",
        rank: 2,
        previousRank: 1,
        teamName: "Arsenal Guangzhou FC",
        managerName: "Gunners Fan",
        captainName: "M.Salah",
        captainTeam: "LIV",
        captainPoints: 16,
        livePoints: 72,
        totalPoints: 1702,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: true,
          wildcard: false
        }
      },
      {
        id: "12",
        rank: 3,
        previousRank: 5,
        teamName: "Citizens Army",
        managerName: "City Fan",
        captainName: "Haaland",
        captainTeam: "MCI",
        captainPoints: 12,
        livePoints: 70,
        totalPoints: 1618,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "5",
        rank: 4,
        previousRank: 3,
        teamName: "JackieHooooooo",
        managerName: "Jackie H",
        captainName: "M.Salah",
        captainTeam: "LIV",
        captainPoints: 14,
        livePoints: 68,
        totalPoints: 1756,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "9",
        rank: 5,
        previousRank: 8,
        teamName: "Chelsea Forever Blue",
        managerName: "Blues Fan",
        captainName: "Haaland",
        captainTeam: "MCI",
        captainPoints: 12,
        livePoints: 67,
        totalPoints: 1693,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: true,
          triple: false,
          wildcard: false
        }
      }
    ]
  },
  {
    id: "t3",
    name: "FPL Content Creators Cup",
    gameweek: 21,
    averagePoints: 44,
    highestPoints: 85,
    totalEntries: 7631,
    entries: [
      {
        id: "8",
        rank: 1,
        previousRank: 4,
        teamName: "Arminia Bielefeld",
        managerName: "German Fan",
        captainName: "M.Salah",
        captainTeam: "LIV",
        captainPoints: 16,
        livePoints: 85,
        totalPoints: 1921,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "3",
        rank: 2,
        previousRank: 1,
        teamName: "世俱杯冠军阿森纳",
        managerName: "Arsenal Champion",
        captainName: "M.Salah",
        captainTeam: "LIV",
        captainPoints: 14,
        livePoints: 82,
        totalPoints: 1953,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: true
        }
      },
      {
        id: "10",
        rank: 3,
        previousRank: 2,
        teamName: "Spurs Are On Fire",
        managerName: "Tottenham Loyal",
        captainName: "Son",
        captainTeam: "TOT",
        captainPoints: 18,
        livePoints: 78,
        totalPoints: 1768,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "11",
        rank: 4,
        previousRank: 3,
        teamName: "Manchester is Red",
        managerName: "United Fan",
        captainName: "Fernandes",
        captainTeam: "MUN",
        captainPoints: 14,
        livePoints: 76,
        totalPoints: 1702,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      },
      {
        id: "6",
        rank: 5,
        previousRank: 5,
        teamName: "WHY NOT",
        managerName: "Just Because",
        captainName: "M.Salah",
        captainTeam: "LIV",
        captainPoints: 14,
        livePoints: 74,
        totalPoints: 1834,
        playersPlayed: 11,
        playersToPlay: 0,
        chips: {
          bench: false,
          triple: false,
          wildcard: false
        }
      }
    ]
  }
];

// Default tournament data for backward compatibility
const tournamentData = tournaments[0];