const API_BASE =
    process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === 'production'
        ? 'https://api.letletme.top'
        : 'http://localhost:3000');

export async function apiGet<T>(path: string): Promise<T> {
    const url = `${API_BASE}${path}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
    return res.json() as Promise<T>;
}

// --- Response Types ---

export interface EventDeadlineResponse {
    event: number;
    utcDeadline: string;
}

export interface EventOverallResultResponse {
    event: number;
    averageScore: number;
    highestScore: number;
    highestScoringEntry: number;
    mostViceCaptainedPlayerName: string | null;
    mostTransferInPlayerName: string | null;
    topElementInfo: { element: number; points: number; playerName: string } | null;
    transfersMade: number;
    chipPlays: Array<{ chipName: string; numberPlayed: number }>;
}

export interface PlayerValueItem {
    elementId: number;
    webName: string;
    elementType: number;
    elementTypeName: string;
    teamName: string;
    teamShortName: string;
    value: number;
    lastValue: number;
    changeDate: string;
    changeType: string;
}

export interface PlayerValuesResponse {
    rises: PlayerValueItem[];
    fallers: PlayerValueItem[];
}

export interface TopTransferItem {
    elementId: number;
    webName: string;
    elementType: number;
    elementTypeName: string;
    teamName: string;
    teamShortName: string;
    value: number;
    transfersInEvent: number;
    transfersOutEvent: number;
}

export interface NextGameweekFixture {
    event: number;
    teamId: number;
    teamName: string;
    teamShortName: string;
    againstTeamId: number;
    againstTeamName: string;
    againstTeamShortName: string;
    difficulty: number;
    kickoffTime: string;
    started: boolean;
    finished: boolean;
    wasHome: boolean;
    teamScore: number;
    againstTeamScore: number;
    score: string;
    result: string;
    bgw: boolean;
    dgw: boolean;
}

export interface LiveScoreItem {
    elementId: number;
    webName: string;
    elementType: number;
    teamId: number;
    minutes: number;
    totalPoints: number;
    goalsScored: number;
    assists: number;
    cleanSheets: number;
    bonus: number;
    inDreamTeam: boolean;
}

export interface LiveMatchItem {
    teamId: number;
    teamName: string;
    teamShortName: string;
    teamScore: number;
    teamPosition: number;
    againstId: number;
    againstName: string;
    againstShortName: string;
    againstTeamScore: number;
    againstTeamPosition: number;
    kickoffTime: string;
    wasHome: boolean;
    playStatus: string;
}

export interface LiveMatchesApiResponse {
    notStarted: LiveMatchItem[];
    playing: LiveMatchItem[];
    finished: LiveMatchItem[];
}
