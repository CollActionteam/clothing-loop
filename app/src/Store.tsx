import { createContext, useState } from "react";
import { Storage } from "@ionic/storage";
import {
  chainGet,
  userGetByUID,
  User,
  Chain,
  logout,
  loginValidate,
  userGetAllByChain,
  UID,
  routeGetOrder,
  Bag,
  bagGetAllByChain,
  BulkyItem,
  bulkyItemGetAllByChain,
  userUpdate,
  chainUpdate,
} from "./api";
import dayjs from "./dayjs";
import { OverlayState } from "./utils/overlay_open";

interface StorageAuth {
  user_uid: string;
  token: string;
}

type BagListView = "dynamic" | "list" | "card";

export const StoreContext = createContext({
  isAuthenticated: null as boolean | null,
  isChainAdmin: false,
  authUser: null as null | User,
  setPause: (date: Date | boolean) => {},
  setTheme: (c: string) => {},
  chain: null as Chain | null,
  chainUsers: [] as Array<User>,
  listOfChains: [] as Array<Chain>,
  route: [] as UID[],
  bags: [] as Bag[],
  bulkyItems: [] as BulkyItem[],
  setChain: (c: Chain | null, uid: UID) => Promise.reject<void>(),
  authenticate: () => Promise.reject<void>(),
  login: (token: string) => Promise.reject<void>(),
  logout: () => Promise.reject<void>(),
  init: () => Promise.reject<void>(),
  refresh: (tab: string) => Promise.reject<void>(),
  overlayState: OverlayState.OPEN_ALL,
  closeOverlay: (s: OverlayState) => {},
  bagListView: "dynamic" as BagListView,
  setBagListView: (v: BagListView) => {},
});

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [chain, setChain] = useState<Chain | null>(null);
  const [chainUsers, setChainUsers] = useState<Array<User>>([]);
  const [listOfChains, setListOfChains] = useState<Array<Chain>>([]);
  const [route, setRoute] = useState<UID[]>([]);
  const [bags, setBags] = useState<Bag[]>([]);
  const [bulkyItems, setBulkyItems] = useState<BulkyItem[]>([]);
  const [storage, setStorage] = useState(new Storage({ name: "store_v1" }));
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isChainAdmin, setIsChainAdmin] = useState(false);
  const [overlayState, setOverlayState] = useState(OverlayState.OPEN_ALL);
  const [bagListView, setBagListView] = useState<BagListView>("dynamic");

  // Get storage from IndexedDB or LocalStorage
  async function _init() {
    const _storage = await storage.create();

    const version = (await _storage.get("version")) as number | null;
    if (version !== 1) {
      await _storage.set("version", 1);
    }
    setBagListView((await _storage.get("bag_list_view")) || "dynamic");
    setStorage(_storage);
  }

  async function _logout() {
    window.plugins?.OneSignal?.removeExternalUserId();
    logout().catch((err) => {
      console.warn(err);
    });
    window.axios.defaults.auth = undefined;

    await storage.set("auth", null);
    await storage.set("chain_uid", null);
    setAuthUser(null);
    setChain(null);
    setListOfChains([]);
    setRoute([]);
    setBags([]);
    setBulkyItems([]);
    setIsAuthenticated(false);
    setIsChainAdmin(false);
    setBagListView("dynamic");
  }

  async function _login(token: string) {
    const res = await loginValidate(token);
    window.axios.defaults.auth = "Bearer " + res.data.token;
    await storage.set("auth", {
      user_uid: res.data.user.uid,
      token: res.data.token,
    } as StorageAuth);
    setAuthUser(res.data.user);
    setIsAuthenticated(true);
    _refresh("settings", res.data.user);
  }

  async function _authenticate() {
    console.log("run authenticate");
    const auth = (await storage.get("auth")) as StorageAuth | null;

    let _authUser: typeof authUser = null;
    let _chain: typeof chain = null;
    let _isAuthenticated: typeof isAuthenticated = null;
    let _isChainAdmin: typeof isChainAdmin = false;
    try {
      if (auth && auth.user_uid && auth.token) {
        window.axios.defaults.auth = "Bearer " + auth.token;

        _authUser = (await userGetByUID(undefined, auth.user_uid)).data;

        _isAuthenticated = true;
      } else {
        throw new Error("Not authenticated");
      }
    } catch (err) {
      window.axios.defaults.auth = undefined;
      _isAuthenticated = false;
    }

    if (_isAuthenticated && _authUser)
      window.plugins?.OneSignal?.setExternalUserId(_authUser.uid);

    try {
      const chainUID: string | null = await storage.get("chain_uid");
      if (_isAuthenticated && chainUID) {
        _chain = (await chainGet(chainUID, false, true)).data;
        await _setChain(_chain, _authUser!.uid);
        _isChainAdmin = IsChainAdmin(_authUser, _chain);
      } else if (chainUID) {
        throw new Error("Not authenticated but still has chain_uid");
      }
    } catch (err) {
      throwError(err);
      await storage.set("chain_uid", null);
    }

    setAuthUser(_authUser);
    setIsChainAdmin(_isChainAdmin);
    setIsAuthenticated(_isAuthenticated);
  }

  async function _setChain(c: Chain | null, _authUserUID: UID | null) {
    let _chain = c;
    let _chainUsers: typeof chainUsers = [];
    let _route: typeof route = [];
    let _bags: typeof bags = [];
    let _bulkyItems: typeof bulkyItems = [];
    if (c && _authUserUID) {
      try {
        const res = await Promise.all([
          chainGet(c.uid, true, true, true),
          userGetAllByChain(c.uid),
          routeGetOrder(c.uid),
          bagGetAllByChain(c.uid, _authUserUID),
          bulkyItemGetAllByChain(c.uid, _authUserUID),
        ]);
        _chain = res[0].data;
        _chainUsers = res[1].data;
        _route = res[2].data;
        _bags = res[3].data;
        _bulkyItems = res[4].data;
      } catch (err) {
        throwError(err);
      }
    }

    await storage.set("chain_uid", c ? c.uid : null);
    setChain(_chain);
    setChainUsers(_chainUsers);
    setRoute(_route);
    setBags(_bags);
    setBulkyItems(_bulkyItems);
    setIsChainAdmin(IsChainAdmin(authUser, _chain));
  }

  async function _setTheme(c: string) {
    if (!chain) throw Error("No loop selected");
    const oldTheme = chain.theme;
    setChain((s) => ({ ...(s as Chain), theme: c }));
    chainUpdate({
      uid: chain.uid,
      theme: c,
    }).catch((e) => {
      setChain((s) => ({ ...(s as Chain), theme: oldTheme }));
    });
  }

  async function _setPause(pause: Date | boolean) {
    if (!authUser) return;

    let pauseUntil = dayjs();
    if (pause === true) {
      pauseUntil = pauseUntil.add(100, "years");
    } else if (pause === false || pause < new Date()) {
      pauseUntil = pauseUntil.add(-1, "week");
    } else {
      pauseUntil = dayjs(pause);
    }
    await userUpdate({
      user_uid: authUser.uid,
      paused_until: pauseUntil.format(),
    });
    const _authUser = (await userGetByUID(undefined, authUser.uid)).data;
    setAuthUser(_authUser);

    if (chain) {
      const _chainUsers = (await userGetAllByChain(chain.uid)).data;
      setChainUsers(_chainUsers);
    }
  }

  async function _refresh(tab: string, __authUser: User | null): Promise<void> {
    if (!__authUser) _logout();

    if (tab === "help") {
      if (!chain)
        throw "You must have first selected a Loop in the settings tab.";

      let _chain = await chainGet(chain.uid, true, true, true);
      setChain(_chain.data);
    } else if (tab === "address" || tab === "bags") {
      if (!chain)
        throw "You must have first selected a Loop in the settings tab.";

      const [_chainUsers, _route, _bags] = await Promise.all([
        userGetAllByChain(chain.uid),
        routeGetOrder(chain.uid),
        bagGetAllByChain(chain.uid, __authUser!.uid),
      ]);
      setChainUsers(_chainUsers.data);
      setRoute(_route.data);
      setBags(_bags.data);
    } else if (tab === "bulky-items") {
      if (!chain)
        throw "You must have first selected a Loop in the settings tab.";

      const [_chainUsers, _bulkyItems] = await Promise.all([
        userGetAllByChain(chain.uid),
        bulkyItemGetAllByChain(chain.uid, __authUser!.uid),
      ]);
      setChainUsers(_chainUsers.data);
      setBulkyItems(_bulkyItems.data);
    } else if (tab === "settings") {
      const _authUser = await userGetByUID(undefined, __authUser!.uid).catch(
        (e) => {
          console.warn(e);
          return null;
        },
      );
      if (_authUser === null) return _logout();
      let _chain: Chain | null = null;
      const _listOfChains = await Promise.all(
        _authUser.data.chains
          .filter((uc) => uc.is_approved)
          .map((uc) => {
            const isCurrentChain = uc.chain_uid === chain?.uid;
            return chainGet(uc.chain_uid, isCurrentChain, isCurrentChain, true);
          }),
      ).then((chains) =>
        chains.map((c) => {
          if (c.data.uid === chain?.uid) {
            _chain = c.data;
          }
          return c.data;
        }),
      );

      setAuthUser(_authUser.data);
      setListOfChains(_listOfChains);
      setChain(_chain);
    }
  }

  function closeOverlay(sTo: OverlayState) {
    setOverlayState((s) => {
      let newTo = s + sTo;
      if (newTo > OverlayState.CLOSE_ALL) newTo = OverlayState.CLOSE_ALL;
      return newTo;
    });
    setTimeout(
      () => {
        setOverlayState(OverlayState.OPEN_ALL);
      },
      1000 * 60 * 60, // 1 hour
    );
  }

  function _setBagListView(v: BagListView) {
    setBagListView(v);
    storage.set("bag_list_view", v);
  }

  return (
    <StoreContext.Provider
      value={{
        authUser,
        setPause: _setPause,
        setTheme: _setTheme,
        route,
        bags,
        bulkyItems,
        chain,
        chainUsers,
        listOfChains,
        setChain: _setChain,
        isAuthenticated,
        isChainAdmin,
        logout: _logout,
        authenticate: _authenticate,
        login: _login,
        init: _init,
        refresh: (t) => _refresh(t, authUser),
        overlayState: overlayState,
        closeOverlay,
        bagListView,
        setBagListView: _setBagListView,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

function throwError(err: any) {
  document.getElementById("root")?.dispatchEvent(
    new CustomEvent("store-error", {
      detail: err,
    }),
  );
}

export function IsChainAdmin(user: User | null, chain: Chain | null) {
  const userChain = user?.chains.find((uc) => uc.chain_uid === chain?.uid);
  return userChain?.is_chain_admin || false;
}
