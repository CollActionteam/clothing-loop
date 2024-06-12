import { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { Trans, useTranslation } from "react-i18next";

import type { Event } from "../../../api/types";
import {
  type EventGetPreviousResponse,
  eventGetAll,
  eventGetPrevious,
} from "../../../api/event";
import CategoriesDropdown from "../components/CategoriesDropdown";
import { SizeBadgeLoading, SizeBadges } from "../components/Badges";
import useForm from "../util/form.hooks";
import { GinParseErrors } from "../util/gin-errors";

import dayjs from "../util/dayjs";
import type { LocationValues } from "../components/LocationModal";
import { useDebouncedCallback } from "use-debounce";
import { useStore } from "@nanostores/react";
import { $authUser } from "../../../stores/auth";
import { addModal, addToastError } from "../../../stores/toast";
import useLocalizePath from "../util/localize_path.hooks";
import { PRICE_TYPE_I18N } from "../components/EventChangeForm";
import { GenderI18nKeys, Genders } from "../../../api/enums";
const LocationModal = lazy(() => import("../components/LocationModal"));

interface SearchValues {
  genders: string[];
  latitude: number;
  longitude: number;
  distance: number;
}

// Media
const ClothesImage =
  "https://images.clothingloop.org/768x/nichon_zelfportret.jpg";

const MAX_RADIUS = 5000;
const DEFAULT_LATITUDE = 52.377956;
const DEFAULT_LONGITUDE = 4.89707;

export default function Events() {
  const [instaView, setInstaView] = useState(false);
  const { t, i18n } = useTranslation();
  const localizePath = useLocalizePath(i18n);

  const authUser = useStore($authUser);
  const [events, setEvents] = useState<Event[] | null | undefined>();
  const [prevEvents, setPrevEvents] = useState<EventGetPreviousResponse | null>(
    null,
  );
  const [nMorePrevEvents, setNMorePrevEvents] = useState(0);
  const [values, setValue, setValues] = useForm<SearchValues>(() => {
    const urlParams = new URLSearchParams();
    let latitude =
      Number.parseFloat(urlParams.get("lat") || "") || DEFAULT_LATITUDE;
    let longitude =
      Number.parseFloat(urlParams.get("long") || "") || DEFAULT_LONGITUDE;
    let distance = Number.parseInt(urlParams.get("d") || "") || -1;

    console.log({
      genders: urlParams.getAll("g"),
      latitude,
      longitude,
      distance,
    });

    return {
      genders: urlParams.getAll("g"),
      latitude,
      longitude,
      distance,
    };
  });
  const search = useDebouncedCallback(() => {
    load(values.genders, values.latitude, values.longitude, values.distance);
  }, 700);

  useEffect(() => {
    load(values.genders, values.latitude, values.longitude, values.distance);
  }, []);

  async function load(
    filterGenders: string[],
    latitude: number,
    longitude: number,
    distance: number,
  ) {
    const radius = distance <= 0 ? MAX_RADIUS : distance;
    writeUrlSearchParams({
      genders: filterGenders,
      latitude,
      longitude,
      distance,
    });
    try {
      const [allData, prevData] = await Promise.all([
        eventGetAll({ latitude, longitude, radius }),
        eventGetPrevious({ latitude, longitude, radius, include_total: true }),
      ]);
      const filterFunc = createFilterFunc(filterGenders);
      setEvents(allData.data?.filter(filterFunc));
      setPrevEvents(prevData.data);
      {
        let nMorePrevEvents = 0;
        if (prevData.data?.previous_events) {
          nMorePrevEvents =
            prevData.data.previous_total - prevData.data.previous_events.length;
          if (nMorePrevEvents < 0) nMorePrevEvents = 0;
        }
        setNMorePrevEvents(nMorePrevEvents);
      }
    } catch (err: any) {
      setEvents(null);
      addToastError(GinParseErrors(t, err), err.status);
    }
  }

  function handleOpenModalGetLocation() {
    addModal({
      message: "Select your location",
      content: () => (
        <div>
          <Suspense fallback={null}>
            <LocationModal
              setValues={setLocationValues}
              latitude={values.latitude}
              longitude={values.longitude}
              radius={values.distance}
            />
          </Suspense>
        </div>
      ),
      actions: [
        {
          text: t("select"),
          type: "primary",
          fn() {
            search();
          },
        },
      ],
    });
  }

  function setLocationValues(distanceValues: LocationValues) {
    setValues((v) => ({
      genders: v.genders,
      latitude: distanceValues.latitude,
      longitude: distanceValues.longitude,
      distance: distanceValues.radius,
    }));
  }

  return (
    <>
      <main>
        <div className="max-w-screen-xl min-h-screen mx-auto py-10 px-6 md:px-20">
          <div className="">
            <h1 className="font-serif font-bold text-secondary text-4xl md:text-6xl mb-4">
              {t("upcomingSwapEvents")}
            </h1>

            <div
              className="block text-sm max-w-5xl mb-4"
              dangerouslySetInnerHTML={{
                __html: t("welcomeOverviewLiveSwap")!,
              }}
            ></div>
          </div>

          <div className="flex flex-col-reverse md:flex-row justify-start md:justify-between pb-4 md:pb-8">
            <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
              <button
                type="button"
                className="btn btn-secondary btn-outline"
                onClick={handleOpenModalGetLocation}
              >
                {t("selectLocation")}
              </button>
              <CategoriesDropdown
                className="w-[150px] md:w-[170px]"
                selectedGenders={values.genders}
                handleChange={(gs) => {
                  setValue("genders", gs);
                  search();
                }}
              />
            </div>
            <div className="mb-4 md:mb-0 flex justify-end">
              {authUser?.is_root_admin ? (
                <label
                  key="btn-insa-toggle"
                  className={"btn me-3".concat(
                    instaView
                      ? " bg-instagram"
                      : " btn-outline border-blue hover:bg-blue-light/25",
                  )}
                >
                  <input
                    className={"checkbox me-3".concat(
                      instaView ? " border-white" : " border-blue",
                    )}
                    type="checkbox"
                    checked={instaView}
                    onClick={() => setInstaView((s) => !s)}
                  />
                  <span
                    className={"icon-instagram text-3xl ".concat(
                      instaView ? "text-white" : "text-blue",
                    )}
                  />
                </label>
              ) : null}
              {authUser ? (
                <a
                  key="btn-create-event"
                  href={localizePath("/events/create")}
                  className="btn btn-primary"
                >
                  <span className="pr-2 rtl:pr-0 rtl:pl-2 icon-plus" />
                  {t("createEvent")}
                </a>
              ) : (
                <div
                  key="btn-reg-event"
                  className="btn btn-primary"
                  onClick={() =>
                    addModal({
                      message: t("mustBeRegistered"),
                      actions: [
                        {
                          text: t("signup"),
                          type: "primary",
                          fn: () => {
                            window.location.href =
                              localizePath("/users/signup");
                          },
                        },
                        {
                          text: t("login"),
                          type: "secondary",
                          fn: () => {
                            window.location.href = localizePath("/users/login");
                          },
                        },
                      ],
                    })
                  }
                >
                  <span className="pr-2 rtl:pr-0 rtl:pl-2 icon-plus" />
                  {t("createEvent")}
                </div>
              )}
            </div>
          </div>

          {events === null ? (
            <div
              className="max-w-screen-sm mx-auto flex-grow flex flex-col justify-center items-center"
              key="noevent"
            >
              <h1 className="font-serif text-secondary text-4xl font-bold my-10 text-center">
                {t("sorryNoEvents")}
              </h1>
              <div className="flex mx-auto">
                <a href={localizePath("/")} className="btn btn-primary mx-4">
                  {t("home")}
                </a>
                <a
                  href={localizePath("/events")}
                  className="btn btn-primary mx-4"
                >
                  {t("allEvents")}
                </a>
              </div>
            </div>
          ) : events === undefined ? (
            <div
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
              key="eventloading"
            >
              {[1, 2, 3, 4].map((v) => (
                <EventItemLoading key={v} />
              ))}
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 gap-8 ${instaView ? "justify-items-center lg:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-3"}`}
              key="event"
            >
              {events
                .sort((a, b) => (new Date(a.date) > new Date(b.date) ? 1 : -1))
                .map((event) =>
                  instaView ? (
                    <EventItemInstagram event={event} key={event.uid} />
                  ) : (
                    <EventItem event={event} key={event.uid} />
                  ),
                )}
            </div>
          )}
          {prevEvents?.previous_events ? (
            <div key="event-prev">
              <div className="sticky top-0 z-20 bg-white/50 flex justify-center">
                <h4
                  className="font-semibold text-black/90 px-3 my-6 relative
               before:border-b-2 before:w-6 before:block before:absolute before:left-full before:top-3
               after:border-b-2 after:w-6 after:block after:absolute after:right-full after:top-3
               "
                >
                  {t("previousEvents")}
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 opacity-70">
                {prevEvents.previous_events
                  .sort((a, b) =>
                    new Date(a.date) < new Date(b.date) ? 1 : -1,
                  )
                  .map((event) => (
                    <EventItem event={event} key={event.uid} />
                  ))}
              </div>
              {nMorePrevEvents ? (
                <div className="flex justify-center">
                  <h4 className="font-semibold text-black/90 px-3 my-6">
                    <Trans
                      i18nKey="nMoreEventsPrev"
                      values={{
                        n: nMorePrevEvents,
                      }}
                      components={{
                        s: (
                          <span className="text-4xl text-accent ms-1.5 me-0.5" />
                        ),
                      }}
                    />
                  </h4>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}

function createFilterFunc(genders: string[]): (e: Event) => boolean {
  return (e: Event) => {
    if (genders.length) {
      let found = false;
      for (let g of genders) {
        if (e.genders?.includes(g)) found = true;
      }
      if (!found) return false;
    }
    return true;
  };
}

// write params to browser url location
function writeUrlSearchParams(search: SearchValues) {
  const queryParams = new URLSearchParams();
  for (const gender of search.genders) {
    queryParams.append("g", gender);
  }
  if (search.distance && search.latitude && search.longitude) {
    queryParams.append("d", search.distance + "");
    queryParams.append("lat", search.latitude + "");
    queryParams.append("long", search.longitude + "");
  }
  const params = "?" + queryParams.toString();

  window.history.replaceState(
    {},
    "",
    window.location.origin + window.location.pathname + params,
  );
}

function EventItem({ event }: { event: Event }) {
  const { t, i18n } = useTranslation();
  const localizePath = useLocalizePath(i18n);
  const date = dayjs(event.date);
  const eventURL = localizePath("/events/details/?event=" + event.uid);

  const eventPriceValue =
    event.price_value % 1 === 0
      ? event.price_value
      : event.price_value.toFixed(2);

  let isSfSeason2024 =
    date.isAfter("2024-01-01") && date.isBefore("2024-03-01");

  let image = ClothesImage;
  if (event.image_url) image = event.image_url;
  return (
    <article className="flex flex-col bg-teal-light">
      <div className="relative flex">
        <a href={eventURL} className="relative aspect-[4/3] w-full">
          <div className=" text-md absolute mt-4 right-4 text-center z-10">
            <p className="bg-teal text-white py-2 px-3">
              <span className="inline-block pr-1 font-extrabold">
                {date.format("MMMM")}
              </span>
              <span>{" " + date.format("D")}</span>
            </p>
            {event.price_type === "free" ? (
              <p className="py-1 px-3 bg-white/90 text-black">
                <span className="inline-block pr-1 font-semibold">
                  {t("priceFree")}
                </span>
              </p>
            ) : event.price_type === "entrance" ? (
              <p className="py-1 px-3 bg-yellow-dark text-black">
                <span className="inline-block pr-1 font-bold">
                  {event.price_currency}
                </span>
                <span className="inline-block pr-1 font-bold">
                  {eventPriceValue}
                </span>
              </p>
            ) : event.price_type === "donation" ? (
              <p className="py-1 px-3 bg-purple-lighter/90 text-black">
                <span className="inline-block pr-1 font-bold">
                  {t(PRICE_TYPE_I18N["donation"])}
                </span>
              </p>
            ) : event.price_type === "perswap" ? (
              <p className="py-1 px-3 bg-lilac-light/90 text-black">
                <span className="inline-block pr-1 font-bold">
                  {t(PRICE_TYPE_I18N["perswap"])}
                </span>
              </p>
            ) : null}
          </div>
          <img
            src={image}
            className="w-full h-full object-cover"
            alt="event cover image"
          />
        </a>
        {isSfSeason2024 ? (
          <a
            target="_blank"
            href="https://slowfashion.global/campaign-sfm/"
            className="absolute -bottom-4 left-2 group"
          >
            <span className="group-hover:animate-[ping-sm_1s_ease-in-out_1] absolute inline-flex h-full w-full rounded-full bg-purple-light opacity-0 group-hover:opacity-75"></span>
            <img
              src="https://images.clothingloop.org/192x192/sf_season_2024.png"
              className="w-24 rotate-[-22deg]"
              alt="Part of Slow Fashion Season 2024"
            />
          </a>
        ) : null}
      </div>

      <div className="m-4 mb-2">
        <h2 className="text-xl text-teal font-bold">
          <a href={eventURL}>{event.name}</a>
        </h2>
      </div>
      <div className="flex-grow mx-4 mb-2">
        <span className="icon-map-pin mr-2 rtl:mr-0 rtl:ml-2"></span>
        <address className="inline">{event.address}</address>
      </div>
      <div className="m-4 mt-0">
        {event.genders?.length ? <SizeBadges g={event.genders} /> : null}
      </div>
    </article>
  );
}

function EventItemLoading() {
  return (
    <article className="flex flex-col bg-teal-light opacity-80">
      <div className="relative flex">
        <div className="relative aspect-[4/3] w-full bg-grey-light animate-pulse">
          <div className="text-md absolute mt-4 right-4 text-center z-10">
            <div className="bg-teal h-10 w-24 py-2 px-3"></div>
          </div>
        </div>
      </div>

      <div className="m-4 mb-2">
        <div className="h-[26px] w-44 bg-teal animate-pulse"></div>
      </div>
      <div className="flex-grow mx-4 mb-8">
        <span className="icon-map-pin mr-2 rtl:mr-0 rtl:ml-2"></span>
        <span
          className="inline-block w-8 bg-grey animate-pulse"
          style={{ height: "21px" }}
        />
      </div>
      <div className="m-4 mt-0 animate-pulse">
        <SizeBadgeLoading />
      </div>
    </article>
  );
}

function EventItemInstagram({ event }: { event: Event }) {
  // genders sorted by children, women then men
  const genders = useMemo(() => {
    return Object.keys(GenderI18nKeys).filter((g) =>
      event.genders?.includes(g),
    );
  }, [event]);
  const date = dayjs(event.date).format("DD-MM-YYYY");
  const address = useMemo(() => {
    if (!event.address) return "";
    const re = / ?([^,]+,[^,]+)$/.exec(event.address);
    return re?.at(1) || event.address;
  }, [event]);
  let genderColor = "bg-purple";
  let genderColorLight = "bg-purple-lighter";
  if (event.genders && event.genders.length === 1) {
    if (event.genders[0] === Genders.children) {
      genderColor = "bg-orange";
      genderColorLight = "bg-orange-light";
    }
    if (event.genders[0] === Genders.women) {
      genderColor = "bg-mint";
      genderColorLight = "bg-mint-light";
    }
  }

  return (
    <article
      className={`relative flex flex-col items-center ${genderColorLight}`}
      style={{ width: 400, height: 700 }}
    >
      <div className="font-bold flex flex-col text-center text-purple">
        <span className="mt-11 mb-3 font-serif text-4xl">
          Upcoming <br />
          Swap Event
        </span>
        <span className="mb-3 text-lg">{date}</span>
      </div>
      <div className={`py-5 px-6 w-full ${genderColor}`}>
        <img
          className="object-contain w-full"
          style={{ height: 200 }}
          src={event.image_url || ClothesImage}
        />
      </div>

      <div className="">
        <h2
          className="my-4 font-bold text-purple uppercase text-ellipsis overflow-hidden whitespace-nowrap px-4 text-center"
          style={{ width: 400 }}
        >
          {event.name}
        </h2>
      </div>

      <div className="mb-4 flex flex-row gap-3">
        {genders?.map((gender) => {
          let src = "";
          let alt = "";
          switch (gender) {
            case Genders.children:
              src = "/images/categories/baby-50.png";
              alt = "Baby";
              break;
            case Genders.women:
              src = "/images/categories/woman-50.png";
              alt = "Woman";
              break;
            case Genders.men:
              alt = "Men";
              src = "/images/categories/man-50.png";
          }
          return (
            <img
              src={src}
              alt={alt}
              className="h-9 bg-white rounded-full p-1"
            />
          );
        })}
      </div>
      <div>
        <span
          className="block mb-2 px-4 text-lg text-ellipsis overflow-hidden whitespace-nowrap"
          style={{ width: 400 }}
        >
          <i className="icon-map-pin" /> {address}
        </span>
      </div>
      <div
        className="block bg-white rounded-full"
        style={{ width: 320, height: 50 }}
      >
        &nbsp;
      </div>
      <img
        className="w-24"
        alt="clothing loop logo"
        src="https://images.clothingloop.org/original/the_clothing_loop_logo.png"
      />
    </article>
  );
}
