import {
  IonAlert,
  IonButton,
  IonButtons,
  IonCard,
  IonChip,
  IonContent,
  IonDatetime,
  IonHeader,
  IonIcon,
  IonItem,
  IonItemDivider,
  IonLabel,
  IonList,
  IonModal,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonText,
  IonTitle,
  IonToggle,
  IonToolbar,
  SelectChangeEventDetail,
  useIonActionSheet,
  useIonAlert,
  useIonToast,
} from "@ionic/react";
import {
  isPlatform,
  type IonSelectCustomEvent,
  DatetimeChangeEventDetail,
  IonDatetimeCustomEvent,
  IonModalCustomEvent,
  OverlayEventDetail,
} from "@ionic/core";
import { RefObject, useContext, useEffect, useMemo, useRef, useState } from "react";
import { StoreContext } from "../Store";
import UserCard from "../components/UserCard";
import { Trans, useTranslation } from "react-i18next";
import {
  alertCircleOutline,
  compassOutline,
  copyOutline,
  ellipsisHorizontal,
  eyeOffOutline,
  eyeOutline,
  lockClosedOutline,
  logoAndroid,
  logoApple,
  openOutline,
  shareOutline,
  sparkles,
  warningOutline,
} from "ionicons/icons";
import dayjs from "../dayjs";
import isPaused from "../utils/is_paused";
import Badges from "../components/SizeBadge";
import { Share } from "@capacitor/share";
import { Clipboard } from "@capacitor/clipboard";
import Theme from "../components/Theme";
import { useLocation } from "react-router";
import { useLongPress } from "use-long-press";
import { getHeader } from "../components/EditHeaders";
const VERSION = import.meta.env.VITE_APP_VERSION;

type State = { openChainSelect?: boolean } | undefined;

export default function Settings() {
  const { t, i18n } = useTranslation();
  const {
    authUser,
    chain,
    isAuthenticated,
    setPause,
    logout,
    setChain,
    isChainAdmin,
    isThemeDefault,
    listOfChains,
  } = useContext(StoreContext);
  const [present] = useIonToast();
  const { state } = useLocation<State>();
  const [presentActionSheet] = useIonActionSheet();
  const [presentAlert] = useIonAlert();
  const refSelectPauseExpiryModal = useRef<HTMLIonModalElement>(null);
  const headerSheetModal = useRef<HTMLIonModalElement>(null);
  const subHeaderSheetModal = useRef<HTMLIonModalElement>(null);
  const refChainSelect = useRef<HTMLIonSelectElement>(null);
  const [isCapacitor] = useState(isPlatform("capacitor"));
  const [isIos] = useState(isPlatform("ios"));
  const [expandedDescription, setExpandedDescription] = useState(false);
  useEffect(() => {
    if (!authUser) return;
    if (!chain || state?.openChainSelect) {
      refChainSelect.current?.open();
    }
  }, [authUser, state]);


  const longPressHeader = useLongPress(() => {
    headerSheetModal.current?.present();
  });
  const longPressSubHeader = useLongPress(() => {
    subHeaderSheetModal.current?.present();
  });


  const headerKey = "settings";
  const subHeaderKey = "settingsSub";

  const header = useMemo(() => {
    return getHeader(chain, headerKey) || t("account");
  }, [chain]);

  const subHeader = useMemo(() => {
    return getHeader(chain, subHeaderKey) || t("loopInformation");
  }, [chain]);


  function handleChainSelect(
    e: IonSelectCustomEvent<SelectChangeEventDetail<any>>,
  ) {
    const chainUID = e.detail.value;
    const c = listOfChains.find((c) => c.uid === chainUID) || null;

    setChain(c?.uid, authUser);
  }

  function handlePauseButton(isUserPaused: boolean) {
    if (isUserPaused) {
      presentAlert(t("areYouSureUnPause"), [
        {
          text: t("cancel"),
          role: "cancel",
        },
        {
          text: t("unPause"),
          handler: () => setPause(false),
          role: "destructive",
        },
      ]);
    } else {
      presentActionSheet({
        header: t("pauseUntil"),

        buttons: [
          {
            text: t("selectPauseDuration"),
            handler: () =>
              setTimeout(
                () => refSelectPauseExpiryModal.current?.present(),
                100,
              ),
          },
          {
            text: t("untilITurnItBackOn"),
            handler: () => {
              setPause(true);
            },
          },
          {
            text: t("cancel"),
            role: "cancel",
          },
        ],
      });
    }
  }

  function handleShareLoop() {
    if (!chain) return;
    let url = `https://www.clothingloop.org/loops/${chain.uid}/users/signup`;
    if (!isCapacitor) {
      Clipboard.write({ url });
      present({
        message: t("copiedToClipboard"),
        color: "primary",
        duration: 1300,
      });
      return;
    }
    Share.share({ url });
  }

  let isUserPaused = isPaused(authUser?.paused_until || null);
  let pausedDayjs = isUserPaused ? dayjs(authUser!.paused_until) : null;
  let showExpandButton = (chain?.description.length || 0) > 200;
  let pausedFromNow = "";
  {
    const now = dayjs();
    if (pausedDayjs) {
      if (pausedDayjs.year() < now.add(20, "year").year()) {
        if (pausedDayjs.isBefore(now.add(7, "day"))) {
          pausedFromNow = t("day", { count: pausedDayjs.diff(now, "day") + 1 });
        } else {
          pausedFromNow = t("week", {
            count: pausedDayjs.diff(now, "week"),
          });
        }
      } else {
        pausedFromNow = t("untilITurnItBackOn");
      }
    }
  }

  return (
    <IonPage>
      <IonHeader collapse="fade">
        <IonToolbar>
          <IonTitle
            className={`${
              isThemeDefault ? "tw-text-orange tw-bg-orange-shade" : ""
            }`}
            color={"background"}
          >
            {t("information")}
          </IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent
        fullscreen
        class={isThemeDefault ? "tw-bg-orange-contrast" : ""}
      >
        <IonItemDivider
          className={`tw-relative ion-margin-start ion-margin-top tw-bg-transparent tw-text-4xl tw-font-serif tw-font-bold ${
            isThemeDefault ? "tw-text-orange dark:tw-text-orange" : ""
          }`}
        >
          {header}
          <IonButton
            fill="clear"
            className="tw-absolute tw-top tw-right-0 tw-normal-case tw-mr-8 tw-text-base"
            href={`https://www.clothingloop.org/${i18n.resolvedLanguage}/users/me/edit`}
            target="_blank"
          >
            {t("edit")}
            <IonIcon icon={openOutline} className="tw-text-sm tw-ml-1" />
          </IonButton>
        </IonItemDivider>
        <IonCard
          className={`tw-mt-1.5 tw-rounded-none tw-relative ion-card ${
            isThemeDefault ? "tw-bg-orange-contrast" : "tw-bg-background"
          }`}
          color={"background"}
        >
          {authUser ? (
            <UserCard
              user={authUser}
              chain={chain}
              isUserPaused={isUserPaused}
            />
          ) : null}
          <IonList>
            <IonItem
              lines="none"
              button
              onClick={() => handlePauseButton(isUserPaused)}
              detail={false}
            >
              <IonLabel className="ion-text-wrap">
                <h3 className="!tw-font-bold">{t("pauseParticipation")}</h3>
                <p className="ion-no-wrap">
                  <span>
                    {isUserPaused
                      ? t("yourParticipationIsPausedClick")
                      : t("setTimerForACoupleOfWeeks")}
                  </span>
                </p>
                {pausedFromNow ? (
                  <IonChip>
                    <IonLabel>{pausedFromNow}</IonLabel>
                  </IonChip>
                ) : null}
              </IonLabel>
              <IonToggle
                slot="end"
                className="ion-toggle-pause"
                color="medium"
                checked={isUserPaused}
                onIonChange={(e) => {
                  e.target.checked = !e.detail.checked;
                }}
              />
            </IonItem>
            <SelectPauseExpiryModal
              modal={refSelectPauseExpiryModal}
              submit={(d) => setPause(d)}
            />
          </IonList>
        </IonCard>
        <IonList style={{ "--ion-item-background": "transparent" }}>
          <IonItemDivider
            className={`ion-margin-start tw-bg-transparent tw-text-2xl tw-font-serif tw-font-bold
            ${isThemeDefault ? "tw-text-orange" : ""}`}
          >
            {subHeader}
          </IonItemDivider>
          <IonCard
            className={`tw-mt-1.5 tw-rounded-none ${
              isThemeDefault ? "tw-bg-orange-contrast" : "tw-bg-background"
            }`}
            color="background"
          >
            <IonList>
              <IonItem lines="none">
                <IonSelect
                  ref={refChainSelect}
                  aria-label={t("selectALoop")}
                  className="tw-text-2xl"
                  labelPlacement="floating"
                  justify="space-between"
                  value={chain?.uid || ""}
                  onIonChange={handleChainSelect}
                  interface="action-sheet"
                >
                  {listOfChains.map((c) => {
                    return (
                      <IonSelectOption value={c.uid} key={c.uid}>
                        {c.name}
                      </IonSelectOption>
                    );
                  })}
                </IonSelect>
              </IonItem>
              {chain && chain.is_app_disabled ? (
                <IonItem lines="none" color="danger">
                  <IonIcon
                    size="small"
                    icon={isIos ? logoApple : logoAndroid}
                  />
                  <span className="ion-margin-end tw-ms-1.5">
                    {t("loopIsNotUsingThisApp")}
                  </span>
                </IonItem>
              ) : null}
              {chain && (!chain.open_to_new_members || !chain.published) ? (
                <IonItem
                  lines="none"
                  color={
                    chain.published
                      ? "warning"
                      : chain.is_app_disabled
                      ? "medium"
                      : "danger"
                  }
                >
                  {!chain.open_to_new_members ? (
                    <>
                      <IonIcon size="small" icon={lockClosedOutline} />
                      <span key="closed" className="ion-margin-end tw-ms-1.5">
                        {t("closed")}
                      </span>
                    </>
                  ) : null}
                  {!chain.published ? (
                    <>
                      <IonIcon size="small" icon={eyeOffOutline} />
                      <span key="closed" className="tw-ms-1.5">
                        {t("draft")}
                      </span>
                    </>
                  ) : (
                    <>
                      <IonIcon size="small" icon={eyeOutline} />
                      <span key="visible" className="tw-ms-1.5">
                        {t("visible")}
                      </span>
                    </>
                  )}
                </IonItem>
              ) : null}
              {isChainAdmin && chain ? (
                <>
                  <IonItem
                    lines="none"
                    button
                    id="open-modal-theme"
                    detail={false}
                  >
                    <IonLabel>{t("setLoopTheme")}</IonLabel>
                    <IonIcon slot="end" icon={sparkles} color="primary" />
                  </IonItem>
                  <Theme />

                  <IonItem
                    lines="none"
                    button
                    detail={false}
                    target="_blank"
                    href={`https://www.clothingloop.org/loops/${chain.uid}/members`}
                  >
                    <IonLabel>{t("goToAdminPortal")}</IonLabel>
                    <IonIcon icon={compassOutline} />
                  </IonItem>
                </>
              ) : null}
              {chain?.published ? (
                <IonItem
                  lines="none"
                  button
                  detail={false}
                  onClick={handleShareLoop}
                >
                  <IonLabel>{t("shareLoop")}</IonLabel>
                  <IonIcon
                    slot="end"
                    icon={isCapacitor ? shareOutline : copyOutline}
                  />
                </IonItem>
              ) : null}
              <IonItem lines="none" className="ion-align-items-start">
                <IonLabel>{t("interestedSizes")}</IonLabel>
                <div className="ion-margin-top ion-margin-bottom" slot="end">
                  {chain ? (
                    <Badges genders={chain.genders} sizes={chain.sizes} />
                  ) : null}
                </div>
              </IonItem>
              <IonItem lines="none">
                <IonLabel>
                  <h3>{t("description")}</h3>
                  <p
                    className={`tw-whitespace-pre-wrap tw-overflow-hidden tw-block ${
                      !expandedDescription && showExpandButton
                        ? "tw-max-h-[60px]"
                        : ""
                    }`}
                  >
                    {chain?.description}
                  </p>
                  {!expandedDescription && showExpandButton ? (
                    <IonButton
                      onClick={() => setExpandedDescription((s) => !s)}
                      size="small"
                      color="clear"
                      expand="block"
                      className="-tw-mt-1.5 tw-ps-0"
                    >
                      <IonIcon icon={ellipsisHorizontal} color="primary" />
                    </IonButton>
                  ) : null}
                </IonLabel>
              </IonItem>
            </IonList>
          </IonCard>
        </IonList>

        <div className="ion-padding tw-mt-4">
          <IonButton id="settings-logout-btn" expand="block" color="danger">
            {t("logout")}
          </IonButton>
        </div>
        <div className="relative">
          {/* Background SVGs */}
          <IonIcon
            aria-hidden="true"
            icon="/v2_o_pattern_green.svg"
            style={{ fontSize: 400 }}
            color={isThemeDefault ? "" : "light"}
            className={`tw-absolute -tw-left-28 -tw-bottom-[190px] -tw-z-10 ${
              isThemeDefault
                ? "tw-text-orange-shade dark:tw-text-red-shade"
                : ""
            }`}
          />
          <IonIcon
            aria-hidden="true"
            icon="/v2_o.svg"
            style={{ fontSize: 500 }}
            color={isThemeDefault ? "" : "light"}
            className="tw-absolute tw-opacity-60 -tw-right-64 tw-top-[90px] -tw-z-10 tw-text-orange-shade dark:tw-text-red-shade"
          />
        </div>
        <IonAlert
          trigger="settings-logout-btn"
          header={t("logout")!}
          message={t("areYouSureYouWantToLogout")!}
          buttons={[
            {
              text: t("cancel"),
            },
            {
              text: t("logout"),
              role: "destructive",
              handler: logout,
            },
          ]}
        ></IonAlert>
        <IonText className="ion-text-center tw-block tw-text-medium tw-text-sm">
          version: {VERSION}
        </IonText>
        <IonList className="ion-margin-top">
          <IonItem
            lines="full"
            routerLink="/settings/privacy-policy"
            style={{ "--border-width": "0.55px 0px 0.55px 0px" }}
          >
            <IonLabel color="medium">{t("privacyPolicy")}</IonLabel>
          </IonItem>
          <IonItem lines="full" routerLink="/settings/open-source">
            <IonLabel color="medium">{t("openSource")}</IonLabel>
          </IonItem>
          <IonItem lines="none" detail={false}>
            <IonLabel color="medium" className="ion-text-wrap">
              <h3 className="mb-3">
                {t("deleteAccount")}
                <IonIcon
                  color="danger"
                  icon={warningOutline}
                  className="tw-ml-1"
                />
              </h3>
              <p>
                <Trans
                  t={t}
                  i18nKey="deleteAccountExplanation"
                  components={{
                    "1": (
                      <a
                        href="https://clothingloop.org/admin/dashboard"
                        target="_blank"
                        className="tw-text-danger tw-font-medium"
                      />
                    ),
                  }}
                />
              </p>
            </IonLabel>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
}

function SelectPauseExpiryModal({
  modal,
  submit,
}: {
  modal: RefObject<HTMLIonModalElement>;
  submit: (endDate: Date | boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const [endDate, setEndDate] = useState<Date>(new Date());
  function willPresent() {
    setEndDate(new Date());
  }
  function handleChangeDatetime(
    e: IonDatetimeCustomEvent<DatetimeChangeEventDetail>,
  ) {
    let datetime = new Date(e.detail.value + "");
    setEndDate(datetime);
  }

  function didDismiss(e: IonModalCustomEvent<OverlayEventDetail<any>>) {
    if (e.detail.role === "submit") submit(e.detail.data);
  }
  return (
    <IonModal
      ref={modal}
      onIonModalDidDismiss={didDismiss}
      onIonModalWillPresent={willPresent}
      style={{
        "--width": "350px",
        "--height": "394px",
        "--border-radius": "10px",
      }}
    >
      <IonHeader>
        <IonToolbar style={{ "--ion-safe-area-top": 0 }}>
          <IonButtons slot="start">
            <IonButton onClick={() => modal.current?.dismiss(null, "dismiss")}>
              {t("cancel")}
            </IonButton>
          </IonButtons>
          <IonTitle>{t("pauseUntil")}</IonTitle>
          <IonButtons slot="end">
            <IonButton
              onClick={() => modal.current?.dismiss(endDate, "submit")}
            >
              {t("save")}
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent
        color="light"
        style={{
          width: 350,
          height: 350,
        }}
      >
        <IonDatetime
          className="tw-mx-auto"
          presentation="date"
          firstDayOfWeek={1}
          min={dayjs().add(1, "day").toISOString()}
          locale={i18n.language}
          onIonChange={handleChangeDatetime}
        ></IonDatetime>
      </IonContent>
    </IonModal>
  );
}