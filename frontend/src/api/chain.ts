import type { Chain, UID } from "./types";
import type { RequestRegisterChain } from "./login";
import axios from "./axios";

export function chainGet(
  chainUID: UID,
  o: {
    addTotals?: boolean;
    addIsAppDisabled?: boolean;
    addRules?: boolean;
    addHeaders?: boolean;
    addTheme?: boolean;
    addRoutePrivacy?: boolean;
  } = {},
) {
  return axios.get<Chain>("/v2/chain", {
    params: {
      chain_uid: chainUID,
      add_totals: o.addTotals || false,
      add_is_app_disabled: o.addIsAppDisabled || false,
      add_rules: o.addRules || false,
      add_theme: o.addTheme || false,
      add_headers: o.addHeaders || false,
      add_route_privacy: o.addRoutePrivacy || false,
    },
  });
}

interface RequestChainGetAllParams {
  filter_sizes?: string[];
  filter_genders?: string[];
  filter_out_unpublished?: boolean;
  add_rules?: boolean;
  add_headers?: boolean;
  add_totals?: boolean;
}
export function chainGetAll(params?: RequestChainGetAllParams) {
  return axios.get<Chain[]>("/v2/chain/all", { params });
}

interface RequestChainGetNearParams {
  latitude: number;
  longitude: number;
  radius: number;
}

export function chainGetNear(params?: RequestChainGetNearParams) {
  return axios.get<Chain[]>("/v2/chain/near", { params });
}

export function chainCreate(chain: RequestRegisterChain) {
  return axios.post<never>("/v2/chain", chain);
}

export type ChainUpdateBody = Partial<Chain> & { uid: UID };

export function chainUpdate(chain: ChainUpdateBody) {
  return axios.patch<never>("/v2/chain", chain);
}

export function chainDelete(chainUID: UID) {
  return axios.delete<never>(`/v2/chain?chain_uid=${chainUID}`);
}

export function chainAddUser(
  chainUID: UID,
  userUID: UID,
  isChainAdmin: boolean,
) {
  return axios.post<never>("/v2/chain/add-user", {
    user_uid: userUID,
    chain_uid: chainUID,
    is_chain_admin: isChainAdmin,
  });
}

export function chainRemoveUser(chainUID: UID, userUID: UID) {
  return axios.post<never>("/v2/chain/remove-user", {
    user_uid: userUID,
    chain_uid: chainUID,
  });
}

export function chainUserApprove(chainUID: UID, userUID: UID) {
  return axios.patch<never>("/v2/chain/approve-user", {
    user_uid: userUID,
    chain_uid: chainUID,
  });
}

export enum UnapprovedReason {
  OTHER = "other",
  TOO_FAR_AWAY = "too_far_away",
  SIZES_GENDERS = "sizes_genders",
  LOOP_NOT_ACTIVE = "loop_not_active",
}

export function chainDeleteUnapproved(
  chainUID: UID,
  userUID: UID,
  reason: UnapprovedReason,
) {
  return axios.delete<never>(
    `/v2/chain/unapproved-user?user_uid=${userUID}&chain_uid=${chainUID}&reason=${reason}`,
  );
}

export function chainPoke(chainUID: UID) {
  return axios.post<never>("/v2/chain/poke", {
    chain_uid: chainUID,
  });
}
export function chainGetLargest() {
  return axios.get<{name: string; description: string; number_of_participants: number}[]>("/v2/chain/largest");
}