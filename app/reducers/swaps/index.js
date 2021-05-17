import { createSelector } from 'reselect';
import contractMetadata from '@metamask/contract-metadata';
import { isMainnetByChainId } from '../../util/networks';
import { safeToChecksumAddress } from '../../util/address';
import { toLowerCaseCompare } from '../../util/general';

// * Constants
export const SWAPS_SET_LIVENESS = 'SWAPS_SET_LIVENESS';
export const SWAPS_SET_HAS_ONBOARDED = 'SWAPS_SET_HAS_ONBOARDED';
const MAX_TOKENS_WITH_BALANCE = 5;

// * Action Creator
export const setSwapsLiveness = (live, chainId) => ({ type: SWAPS_SET_LIVENESS, payload: { live, chainId } });
export const setSwapsHasOnboarded = hasOnboarded => ({ type: SWAPS_SET_HAS_ONBOARDED, payload: hasOnboarded });

// * Functions

function addMetadata(chainId, tokens) {
	if (!isMainnetByChainId(chainId)) {
		return tokens;
	}
	return tokens.map(token => {
		const tokenMetadata = contractMetadata[safeToChecksumAddress(token.address)];
		if (tokenMetadata) {
			return { ...token, name: tokenMetadata.name };
		}

		return token;
	});
}

// * Selectors

const chainIdSelector = state => state.engine.backgroundState.NetworkController.provider.chainId;
const swapsStateSelector = state => state.swaps;
/**
 * Returns the swaps liveness state
 */

export const swapsLivenessSelector = createSelector(
	swapsStateSelector,
	chainIdSelector,
	(swapsState, chainId) => swapsState[chainId]?.isLive || false
);

/**
 * Returns the swaps onboarded state
 */

export const swapsHasOnboardedSelector = createSelector(
	swapsStateSelector,
	swapsState => swapsState.hasOnboarded
);

/**
 * Returns the swaps tokens from the state
 */
const swapsControllerTokens = state => state.engine.backgroundState.SwapsController.tokens;
export const swapsTokensSelector = createSelector(
	chainIdSelector,
	swapsControllerTokens,
	(chainId, tokens) => {
		if (!tokens) {
			return [];
		}

		return addMetadata(chainId, tokens);
	}
);

const topAssets = state => state.engine.backgroundState.SwapsController.topAssets;

/**
 * Returns a memoized object that only has the addesses of the tokens as keys
 * and undefined as value. Useful to check if a token is supported by swaps.
 */
export const swapsTokensObjectSelector = createSelector(
	swapsControllerTokens,
	tokens => (tokens?.length > 0 ? tokens.reduce((acc, token) => ({ ...acc, [token.address]: undefined }), {}) : {})
);

/**
 * Balances
 */

const balances = state => state.engine.backgroundState.TokenBalancesController.contractBalances;

/**
 * Returns an array of tokens to display by default on the selector modal
 * based on the current account's balances.
 */
export const swapsTokensWithBalanceSelector = createSelector(
	chainIdSelector,
	swapsControllerTokens,
	balances,
	(chainId, tokens, balances) => {
		if (!tokens) {
			return [];
		}
		const baseTokens = tokens;
		const tokensAddressesWithBalance = Object.entries(balances)
			.filter(([, balance]) => Boolean(balance) && balance?.isZero && !balance.isZero())
			.sort(([, balanceA], [, balanceB]) => (balanceB.lte(balanceA) ? -1 : 1))
			.map(([address]) => address.toLowerCase());
		const tokensWithBalance = [];
		const originalTokens = [];

		for (let i = 0; i < baseTokens.length; i++) {
			if (tokensAddressesWithBalance.includes(baseTokens[i].address)) {
				tokensWithBalance.push(baseTokens[i]);
			} else {
				originalTokens.push(baseTokens[i]);
			}

			if (
				tokensWithBalance.length === tokensAddressesWithBalance.length &&
				tokensWithBalance.length + originalTokens.length >= MAX_TOKENS_WITH_BALANCE
			) {
				break;
			}
		}

		const result = [...tokensWithBalance, ...originalTokens].slice(
			0,
			Math.max(tokensWithBalance.length, MAX_TOKENS_WITH_BALANCE)
		);
		return addMetadata(chainId, result);
	}
);

/**
 * Returns an array of tokens to display by default on the selector modal
 * based on the current account's balances.
 */
export const swapsTopAssetsSelector = createSelector(
	chainIdSelector,
	swapsControllerTokens,
	topAssets,
	(chainId, tokens, topAssets) => {
		if (!topAssets || !tokens) {
			return [];
		}
		const result = topAssets
			.map(({ address }) => tokens?.find(token => toLowerCaseCompare(token.address, address)))
			.filter(Boolean);
		return addMetadata(chainId, result);
	}
);

// * Reducer
export const initialState = {
	isLive: true, // TODO: should we remove it?
	hasOnboarded: false,

	'1': {
		isLive: true
	}
};

function swapsReducer(state = initialState, action) {
	switch (action.type) {
		case SWAPS_SET_LIVENESS: {
			const { live, chainId } = action.payload;
			const data = state[chainId];
			return {
				...state,
				[chainId]: {
					...data,
					isLive: live
				}
			};
		}
		case SWAPS_SET_HAS_ONBOARDED: {
			return {
				...state,
				hasOnboarded: Boolean(action.payload)
			};
		}
		default: {
			return state;
		}
	}
}

export default swapsReducer;
