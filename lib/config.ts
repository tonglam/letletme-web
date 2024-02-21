const LETLETME_BASE_URL: string = process.env.LETLETME_BASE!
const LETLETME_BASE_COMMON_URL: string = LETLETME_BASE_URL + 'common/'
const LETLETME_BASE_STAT_URL: string = LETLETME_BASE_URL + 'stat/'

// common
const CURRENT_EVENT_AND_NEXT_UTC_DEADLINE: string =
	LETLETME_BASE_COMMON_URL + 'qryCurrentEventAndNextUtcDeadline'

const QRY_NEXT_FIXTURE: string = LETLETME_BASE_COMMON_URL + 'qryNextFixture'

export const API_COMMON = {
	CURRENT_EVENT_AND_NEXT_UTC_DEADLINE,
	QRY_NEXT_FIXTURE
}

// stat
const QRY_PLAYER_PRICE_CHANGE: string =
	LETLETME_BASE_STAT_URL + 'qryPlayerPriceChange'

export const API_STAT = {
	QRY_PLAYER_PRICE_CHANGE
}

// Premeir League Teams Logos
const PL_RESOURCE_BASE: string = process.env.PL_RESOURCE_BASE!
const PL_TEAMS_LOGO_BASE: string = PL_RESOURCE_BASE + 'badges/rb/'

const ARS_LOGO: string = PL_TEAMS_LOGO_BASE + 't3.svg'
const AVL_LOGO: string = PL_TEAMS_LOGO_BASE + 't7.svg'
const BOU_LOGO: string = PL_TEAMS_LOGO_BASE + 't91.svg'
const BRE_LOGO: string = PL_TEAMS_LOGO_BASE + 't94.svg'
const BHA_LOGO: string = PL_TEAMS_LOGO_BASE + 't36.svg'
const BUR_LOGO: string = PL_TEAMS_LOGO_BASE + 't90.svg'
const CHE_LOGO: string = PL_TEAMS_LOGO_BASE + 't8.svg'
const CRY_LOGO: string = PL_TEAMS_LOGO_BASE + 't31.svg'
const EVE_LOGO: string = PL_TEAMS_LOGO_BASE + 't11.svg'
const FUL_LOGO: string = PL_TEAMS_LOGO_BASE + 't54.svg'
const LIV_LOGO: string = PL_TEAMS_LOGO_BASE + 't14.svg'
const LUT_LOGO: string = PL_TEAMS_LOGO_BASE + 't102.svg'
const MCI_LOGO: string = PL_TEAMS_LOGO_BASE + 't43.svg'
const MUN_LOGO: string = PL_TEAMS_LOGO_BASE + 't1.png'
const NEW_LOGO: string = PL_TEAMS_LOGO_BASE + 't4.png'
const NFO_LOGO: string = PL_TEAMS_LOGO_BASE + 't17.svg'
const SHU_LOGO: string = PL_TEAMS_LOGO_BASE + 't49.svg'
const TOT_LOGO: string = PL_TEAMS_LOGO_BASE + 't6.svg'
const WHU_LOGO: string = PL_TEAMS_LOGO_BASE + 't21.svg'
const WOL_LOGO: string = PL_TEAMS_LOGO_BASE + 't39.svg'

export const PL_TEAMS_LOGO = {
	ARS_LOGO,
	AVL_LOGO,
	BOU_LOGO,
	BRE_LOGO,
	BHA_LOGO,
	BUR_LOGO,
	CHE_LOGO,
	CRY_LOGO,
	EVE_LOGO,
	FUL_LOGO,
	LIV_LOGO,
	LUT_LOGO,
	MCI_LOGO,
	MUN_LOGO,
	NEW_LOGO,
	NFO_LOGO,
	SHU_LOGO,
	TOT_LOGO,
	WHU_LOGO,
	WOL_LOGO
}
