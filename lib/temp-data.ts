import { Player } from "@/types/player";

// Sort players by position order: GKP, DEF, MID, FWD
const positionOrder = { GKP: 1, DEF: 2, MID: 3, FWD: 4 };

// Starting XI
const unsortedStartingPlayers: Player[] = [
  {
    id: "1",
    name: "Sánchez",
    team: "Nottingham Forest",
    teamShort: "NFO",
    position: "GKP",
    stats: {
      minutes: 90,
      goals: 0,
      assists: 0,
      savePenalty: 1,
      saves: 3,
      cleanSheets: 1,
      yellowCards: 0,
      redCards: 0,
      points: 6,
      bonusPoints: 0
    },
    playingStatus: "FINISHED"
  },
  {
    id: "2",
    name: "Gabriel",
    team: "Arsenal",
    teamShort: "ARS",
    position: "DEF",
    stats: {
      minutes: 90,
      goals: 0,
      assists: 0,
      cleanSheets: 1,
      yellowCards: 0,
      redCards: 0,
      points: 6,
      bonusPoints: 0
    },
    playingStatus: "PLAYING"
  },
  {
    id: "3",
    name: "Gvardiol",
    team: "Manchester City",
    teamShort: "MCI",
    position: "DEF",
    stats: {
      minutes: 90,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 2,
      bonusPoints: 0
    },
    playingStatus: "PLAYING"
  },
  {
    id: "4",
    name: "Muñoz",
    team: "Crystal Palace",
    teamShort: "CRY",
    position: "DEF",
    stats: {
      minutes: 90,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 2,
      bonusPoints: 0
    },
    playingStatus: "NOT_STARTED"
  },
  {
    id: "5",
    name: "Palmer",
    team: "Chelsea",
    teamShort: "CHE",
    position: "MID",
    stats: {
      minutes: 90,
      goals: 1,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 10,
      bonusPoints: 3
    },
    playingStatus: "FINISHED",
    isViceCaptain: true
  },
  {
    id: "6",
    name: "Sávio",
    team: "Manchester City",
    teamShort: "MCI",
    position: "MID",
    stats: {
      minutes: 90,
      goals: 1,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 8,
      bonusPoints: 1
    },
    playingStatus: "PLAYING"
  },
  {
    id: "7",
    name: "Amad",
    team: "Manchester United",
    teamShort: "MUN",
    position: "MID",
    stats: {
      minutes: 90,
      goals: 1,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 1,
      redCards: 0,
      points: 9,
      bonusPoints: 3
    },
    playingStatus: "FINISHED"
  },
  {
    id: "8",
    name: "M.Salah",
    team: "Liverpool",
    teamShort: "LIV",
    position: "MID",
    stats: {
      minutes: 90,
      goals: 1,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 7,
      bonusPoints: 0
    },
    playingStatus: "PLAYING",
    isCaptain: true
  },
  {
    id: "9",
    name: "Haaland",
    team: "Manchester City",
    teamShort: "MCI",
    position: "FWD",
    stats: {
      minutes: 90,
      goals: 1,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 6,
      bonusPoints: 0
    },
    playingStatus: "PLAYING"
  },
  {
    id: "10",
    name: "Wissa",
    team: "Brentford",
    teamShort: "BRE",
    position: "FWD",
    stats: {
      minutes: 90,
      goals: 1,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 6,
      bonusPoints: 0
    },
    playingStatus: "NOT_STARTED"
  },
  {
    id: "11",
    name: "Raúl",
    team: "Fulham",
    teamShort: "FUL",
    position: "FWD",
    stats: {
      minutes: 90,
      goals: 1,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 6,
      bonusPoints: 0
    },
    playingStatus: "NOT_STARTED"
  }
];

// Bench players
const unsortedBenchPlayers: Player[] = [
  {
    id: "12",
    name: "Raya",
    team: "Arsenal",
    teamShort: "ARS",
    position: "GKP",
    stats: {
      minutes: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 0,
      bonusPoints: 0
    },
    playingStatus: "NOT_STARTED"
  },
  {
    id: "13",
    name: "Van den Berg",
    team: "Brentford",
    teamShort: "BRE",
    position: "DEF",
    stats: {
      minutes: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 0,
      bonusPoints: 0
    },
    playingStatus: "NOT_STARTED"
  },
  {
    id: "14",
    name: "Mbeumo",
    team: "Brentford",
    teamShort: "BRE",
    position: "MID",
    stats: {
      minutes: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 0,
      bonusPoints: 0
    },
    playingStatus: "NOT_STARTED"
  },
  {
    id: "15",
    name: "Barkley",
    team: "Aston Villa",
    teamShort: "AVL",
    position: "MID",
    stats: {
      minutes: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 0,
      bonusPoints: 0
    },
    playingStatus: "NOT_STARTED"
  },
  {
    id: "16",
    name: "N.Jackson",
    team: "Chelsea",
    teamShort: "CHE",
    position: "FWD",
    stats: {
      minutes: 0,
      goals: 0,
      assists: 0,
      cleanSheets: 0,
      yellowCards: 0,
      redCards: 0,
      points: 0,
      bonusPoints: 0
    },
    playingStatus: "NOT_STARTED"
  }
];

// Sort players by position
export const startingPlayers = [...unsortedStartingPlayers].sort(
  (a, b) => positionOrder[a.position] - positionOrder[b.position]
);

export const benchPlayers = [...unsortedBenchPlayers].sort(
  (a, b) => positionOrder[a.position] - positionOrder[b.position]
);

export const teamStats = {
  teamName: "let let red arrow↓↑↓",
  playerName: "tong",
  points: 54,
  totalPoints: 1213,
  playersPlayed: 11,
  playersToPlay: 0,
  chips: {
    bench: false,
    triple: false,
    wildcard: false
  }
};