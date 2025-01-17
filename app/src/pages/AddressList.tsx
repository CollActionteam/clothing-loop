import {
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItem,
  IonList,
  IonModal,
  IonPage,
  IonRadio,
  IonRadioGroup,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonTitle,
  IonToolbar,
  RefresherEventDetail,
} from "@ionic/react";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { StoreContext } from "../stores/Store";
import { mapOutline, openOutline, searchOutline, shield } from "ionicons/icons";
import IsPrivate from "../utils/is_private";
import OverlayPaused from "../components/OverlayPaused";
import OverlayAppDisabled from "../components/OverlayChainAppDisabled";
import EditHeaders from "../components/EditHeaders";
import HeaderTitle from "../components/HeaderTitle";
import AddressListItem, {
  AddressListItemProps,
} from "../components/AddressList/AddressListItem";
import wrapIndex from "../utils/wrap_index";
import { useDebounce } from "@uidotdev/usehooks";
import IsPaused from "../utils/is_paused";
import { Sleep } from "../utils/sleep";
import RouteMapPopup from "../components/RouteMap/RouteMapPopup";

export default function AddressList() {
  const {
    chain,
    setChain,
    getChainHeader,
    chainUsers,
    route,
    authUser,
    bags,
    isChainAdmin,
    isThemeDefault,
    shouldBlur,
    routeListView,
    setRouteListView,
  } = useContext(StoreContext);
  const { t } = useTranslation();
  const headerSheetModal = useRef<HTMLIonModalElement>(null);
  const refRouteMapPopup = useRef<HTMLIonModalElement>(null);

  const headerKey = "addressList";

  const headerText = getChainHeader("addressList", t("addresses"));

  function updateChain() {
    setChain(chain?.uid, authUser);
  }

  const [search, setSearch] = useState("");
  const slowSearch = useDebounce(search, 500);

  useEffect(() => {
    if (authUser) {
      const el = document.querySelector("ali-" + authUser.uid);
      el?.scrollIntoView({
        block: "center",
      });
    }
  }, []);

  const routeListItems = useMemo(() => {
    const routeLength = route.length;
    if (!chain || routeLength === 0) return [];
    let meRouteIndex = -1;
    if (authUser) {
      meRouteIndex = route.findIndex((uid) => uid === authUser.uid);
    }
    let topRouteIndex = 0;
    if (routeListView === "dynamic") {
      topRouteIndex =
        routeLength < 6
          ? routeLength - 1
          : wrapIndex(meRouteIndex - 6, routeLength);
      console.log("topRouteIndex", topRouteIndex);
    }

    let arr = [] as AddressListItemProps[];
    let i = topRouteIndex;
    do {
      const userUID = route[i];
      const user = chainUsers.find((u) => u.uid === userUID);
      if (!user) {
        console.error("User not found in chainUsers", userUID);
        i = wrapIndex(i + 1, routeLength);
        continue;
      }

      if (
        slowSearch
          ? user.name.toLowerCase().includes(slowSearch.toLowerCase())
          : true
      ) {
        const isMe = user.uid === authUser?.uid;
        const userBags = bags.filter((b) => b.user_uid === user.uid);
        const isHost =
          user.chains.find((uc) => uc.chain_uid === chain?.uid)
            ?.is_chain_admin || false;

        const isWarden =
          user.chains.find((uc) => uc.chain_uid === chain?.uid)
            ?.is_chain_warden || false;
        const isPrivate = IsPrivate(user.email!);
        const isAddressPrivate = IsPrivate(user.address);
        const isUserPaused = IsPaused(user, chain.uid);

        arr.push({
          user,
          bags: userBags,
          isMe,
          isHost,
          isWarden,
          isAddressPrivate,
          number: i + 1,
          isUserPaused,
          routerLink: isPrivate ? undefined : "/address/" + user.uid,
          isChainAdmin,
        });
      }

      i = wrapIndex(i + 1, routeLength);
    } while (i !== topRouteIndex);
    return arr;
  }, [route, chainUsers, routeListView, slowSearch]);

  const countActiveMembers = useMemo(() => {
    return routeListItems.filter((r) => !r.isUserPaused).length;
  }, [routeListItems]);

  function handleRefresh(e: CustomEvent<RefresherEventDetail>) {
    const refreshPromise = setChain(chain?.uid, authUser);
    const sleepPromise = Sleep(500);
    Promise.all([refreshPromise, sleepPromise]).then(() => {
      e.detail.complete();
    });
  }

  function onClickFab() {
    refRouteMapPopup.current?.present();
  }

  return (
    <IonPage>
      <OverlayPaused />
      <OverlayAppDisabled />
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons>
            <IonButton id="sheet-address-options">
              <IonIcon icon={searchOutline} />
              {slowSearch ? (
                <div className="tw-rounded-full tw-w-2 tw-h-2 tw-absolute tw-bottom-1 tw-right-0 tw-bg-danger"></div>
              ) : null}
            </IonButton>
            <IonModal
              trigger="sheet-address-options"
              initialBreakpoint={0.4}
              breakpoints={[0, 0.4, 0.8]}
            >
              <IonContent color="light">
                <IonList>
                  <IonItem lines="full">
                    <IonSearchbar
                      onIonInput={(e) => setSearch(e.detail.value as string)}
                      onIonClear={() => setSearch("")}
                      value={search}
                      placeholder={t("search")}
                    ></IonSearchbar>
                  </IonItem>
                  <IonItem lines="full" color="light">
                    <p className="tw-font-bold">{t("sort")}</p>
                  </IonItem>
                  <IonRadioGroup
                    value={routeListView}
                    onIonChange={(e: any) => setRouteListView(e.detail.value)}
                  >
                    <IonItem lines="full">
                      <IonRadio
                        value="dynamic"
                        labelPlacement="start"
                        className={`tw-text-lg ${
                          routeListView === "dynamic" ? "!tw-font-semibold" : ""
                        }`}
                      >
                        {t("automatic")}
                      </IonRadio>
                    </IonItem>
                    <IonItem lines="full">
                      <IonRadio
                        className={`tw-text-lg ${
                          routeListView === "list" ? "!tw-font-semibold" : ""
                        }`}
                        value="list"
                      >
                        {t("routeOrder")}
                      </IonRadio>
                    </IonItem>
                  </IonRadioGroup>
                </IonList>
              </IonContent>
            </IonModal>
          </IonButtons>
          <IonTitle>{headerText}</IonTitle>
          {isChainAdmin ? (
            <IonButtons
              slot="end"
              className={`${
                isThemeDefault
                  ? "tw-text-red dark:tw-text-red-contrast"
                  : "primary"
              }`}
            >
              <IonButton
                target="_blank"
                href={`https://www.clothingloop.org/loops/${chain?.uid}/members`}
                color={
                  isThemeDefault
                    ? "tw-text-red dark:tw-text-red-contrast"
                    : "primary"
                }
              >
                {t("routeOrder")}
                <IonIcon icon={openOutline} className="tw-text-sm tw-ml-1" />
              </IonButton>
            </IonButtons>
          ) : null}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher
          slot="fixed"
          onIonRefresh={handleRefresh}
          className="tw-z-0"
        >
          <IonRefresherContent />
        </IonRefresher>
        <div className="tw-relative tw-min-h-full tw-flex tw-flex-col">
          <IonHeader collapse="condense">
            <IonToolbar>
              <HeaderTitle
                headerText={headerText}
                onEdit={() => headerSheetModal.current?.present()}
                isChainAdmin={isChainAdmin}
                className={"tw-font-serif".concat(
                  isThemeDefault
                    ? " tw-text-red dark:tw-text-red-contrast"
                    : "",
                )}
              />
            </IonToolbar>
          </IonHeader>
          <IonList
            className={"tw-flex-grow".concat(shouldBlur ? " tw-blur" : "")}
          >
            {routeListItems.map((props) => {
              return <AddressListItem {...props} key={props.number} />;
            })}
          </IonList>
          {chain && authUser ? (
            <RouteMapPopup
              chain={chain}
              modal={refRouteMapPopup}
              authUserUID={authUser.uid}
              isChainAdmin={isChainAdmin}
            />
          ) : null}
          {isChainAdmin ? (
            <EditHeaders
              modal={headerSheetModal}
              didDismiss={updateChain}
              headerKey={headerKey}
              initialHeader={headerText}
            />
          ) : null}
          <div className="tw-relative tw-w-full -tw-mb-2">
            <IonIcon
              aria-hidden="true"
              icon="/the_clothing_loop_logo_cropped.svg"
              style={{ fontSize: 150 }}
              className="tw-w-full  tw-invert-[60%] tw-overflow-hidden tw-stroke-text dark:tw-stroke-light-tint"
            />
            <div className="tw-absolute tw-w-full tw-bottom-0 tw-mb-6 tw-text-center tw-text-sm">
              {t("activeMembers") + ": " + countActiveMembers}
            </div>
          </div>
        </div>
        {isChainAdmin || chain?.allow_map ? (
          <IonFab slot="fixed" horizontal="end" vertical="bottom">
            <IonFabButton
              color={chain?.allow_map && isThemeDefault ? "danger" : ""}
              onClick={onClickFab}
              style={
                chain?.allow_map
                  ? {}
                  : {
                      "--background": "var(--ion-color-blue-contrast)",
                      "--background-hover": "var(--ion-color-light-shade)",
                      "--color": "var(--ion-color-blue)",
                    }
              }
            >
              <IonIcon icon={mapOutline} />
            </IonFabButton>
          </IonFab>
        ) : null}
      </IonContent>
    </IonPage>
  );
}
