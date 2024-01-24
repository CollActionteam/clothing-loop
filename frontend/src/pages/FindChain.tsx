import {
  useEffect,
  useState,
  useContext,
  useRef,
  MouseEvent,
  MouseEventHandler,
} from "react";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";
import type * as GeoJSONTypes from "geojson";
import mapboxgl from "mapbox-gl";

// Project resources
import { AuthContext, AuthProps } from "../providers/AuthProvider";
import { Chain, UID, User } from "../api/types";
import { chainAddUser, chainGetAll } from "../api/chain";
import { ToastContext } from "../providers/ToastProvider";
import SearchBar, {
  SearchValues,
  toUrlSearchParams,
} from "../components/FindChain/SearchBar";
import { SizeBadges } from "../components/Badges";
import {
  GEOJSON_LATITUDE_INDEX,
  GEOJSON_LONGITUDE_INDEX,
  circleRadiusKm,
  useMapZoom,
} from "../util/maps";
import { GinParseErrors } from "../util/gin-errors";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_KEY;

const MAX_ZOOM = 13;
const MIN_ZOOM = 3;

export type ChainPredicate = (chain: Chain) => boolean;

type GeoJSONChains = GeoJSONTypes.FeatureCollection<
  GeoJSONTypes.Point,
  {
    uid: UID;
    chainIndex: number;
    radius: number;
    gender: string;
    size: string;
    open_to_new_members: boolean;
    cluster?: boolean;
  }
>;

function mapToGeoJSONChains(
  chains: Chain[],
  filterFunc: (c: Chain) => boolean = () => true
): GeoJSONChains {
  return {
    type: "FeatureCollection",
    features: chains.filter(filterFunc).map((chain, chainIndex) => {
      return {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [chain.longitude, chain.latitude],
        },
        properties: {
          uid: chain.uid,
          chainIndex: chainIndex,
          radius: circleRadiusKm((chain.radius * 1000) / 6, chain.latitude),
          gender: chain.genders?.join("") || "",
          size: chain.sizes?.join("") || "",
          open_to_new_members: chain.open_to_new_members,
        },
      };
    }),
  };
}

function createFilterFunc(
  genders: string[],
  sizes: string[]
): (c: Chain) => boolean {
  let filterFunc = (c: Chain) => true;
  if (sizes?.length) {
    filterFunc = (c) => {
      for (let s of sizes) {
        if (c.sizes?.includes(s)) return true;
      }
      if (c.uid === "f3dc978d-8bf3-4c75-835a-1e24324f2be2") {
        console.log("not found", c.sizes, sizes);
      }
      return false;
    };
  } else if (genders?.length) {
    filterFunc = (c) => {
      for (let g of genders) {
        if (c.genders?.includes(g)) return true;
      }
      return false;
    };
  }
  return filterFunc;
}

export default function FindChain({ location }: { location: Location }) {
  const history = useHistory();
  const urlParams = new URLSearchParams(location.search);

  const { t } = useTranslation();
  const { authUser, authUserRefresh } = useContext(AuthContext);
  const { addToastError, addModal } = useContext(ToastContext);

  const [chains, setChains] = useState<Chain[]>();
  const [map, setMap] = useState<mapboxgl.Map>();
  const { zoom, setZoom, mapZoom } = useMapZoom(4, MIN_ZOOM, MAX_ZOOM);
  const [locationLoading, setLocationLoading] = useState(false);
  const [selectedChains, setSelectedChains] = useState<Chain[]>([]);
  const [focusedChain, setFocusedChain] = useState<Chain | null>(null);
  const [visibleChains, setVisibleChains] = useState<Chain[]>([]);
  const [chainDetailsOpen, setChainDetailsOpen] = useState(false);

  const mapRef = useRef<any>();

  useEffect(() => {
    const _center = [
      Number.parseFloat(urlParams.get("lo") || ""),
      Number.parseFloat(urlParams.get("la") || ""),
    ];
    const hasCenter = !!(
      _center[GEOJSON_LONGITUDE_INDEX] && _center[GEOJSON_LATITUDE_INDEX]
    );
    const _map = new mapboxgl.Map({
      accessToken: MAPBOX_TOKEN,
      container: mapRef.current,
      projection: { name: "mercator" },
      zoom: hasCenter ? 10 : 4,
      minZoom: 1,
      maxZoom: 13,
      center: (hasCenter
        ? _center
        : [4.8998197, 52.3673008]) as mapboxgl.LngLatLike,
      style: "mapbox://styles/mapbox/light-v11",
    });

    setZoom(4);

    const clusterMaxZoom = 8;
    chainGetAll({ filter_out_unpublished: true }).then((res) => {
      const _chains = res.data;

      _map.on("zoomend", (e) => {
        setZoom(e.target.getZoom());
      });

      const filterFunc = createFilterFunc(
        urlParams.getAll("g"),
        urlParams.getAll("s")
      );

      _map.on("load", () => {
        _map.addSource("chains", {
          type: "geojson",
          data: mapToGeoJSONChains(_chains, filterFunc),
          cluster: true,
          clusterMaxZoom: clusterMaxZoom,
          clusterMinPoints: 1,
          clusterRadius: 25,
          generateId: true,
        });

        _map.addLayer({
          id: "chain-cluster",
          type: "circle",
          source: "chains",
          filter: ["<=", ["zoom"], clusterMaxZoom],
          paint: {
            "circle-color": ["rgba", 239, 149, 61, 0.6], // #ef953d
            "circle-radius": 15,
            "circle-stroke-width": 0,
          },
        });

        _map.addLayer({
          id: "chain-cluster-count",
          type: "symbol",
          source: "chains",
          filter: ["<=", ["zoom"], clusterMaxZoom],
          layout: {
            "text-field": ["coalesce", ["get", "point_count_abbreviated"], "1"],
            "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
            "text-size": 12,
          },
        });
        _map.addLayer({
          id: "chain-single",
          type: "circle",
          source: "chains",
          filter: [">", ["zoom"], clusterMaxZoom],
          paint: {
            "circle-color": [
              "case",
              ["==", ["feature-state", "clicked"], true],
              ["rgba", 72, 128, 139, 0.4],
              [
                "case",
                ["get", "open_to_new_members"],
                ["rgba", 240, 196, 73, 0.4], // #f0c449
                ["rgba", 0, 0, 0, 0.1],
              ],
            ],
            "circle-radius": [
              "interpolate",
              ["exponential", 2],
              ["zoom"],
              0,
              0,
              20,
              ["get", "radius"],
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": [
              "case",
              ["==", ["feature-state", "clicked"], true],
              ["rgba", 72, 128, 139, 0.4],
              [
                "case",
                ["get", "open_to_new_members"],
                ["rgba", 240, 196, 73, 0.4], // #f0c449
                ["rgba", 0, 0, 0, 0.1],
              ],
            ],
          },
        });

        // Initalize chainsInView
        _map.on("idle", () => {
          getVisibleChains(_map, _chains);
        });

        _map.on("moveend", () => {
          getVisibleChains(_map, _chains);
        });

        _map.on("click", "chain-single", (e) => {
          if (e.features) {
            let uids = e.features
              .map((f) => f.properties?.uid)
              .filter((f) => f) as UID[];
            // filter unique
            uids = [...new Set(uids)];

            let _selectedChains = uids.map((uid) =>
              _chains.find((c) => c.uid === uid)
            ) as Chain[];
            if (_selectedChains.length) {
              _selectedChains.forEach((c) => console.info(c.name, c.uid));
              setSelectedChains(_selectedChains);
            }
            let _sortedChains = _selectedChains.sort((a, b) => {
              let aLngLat = new mapboxgl.LngLat(a.longitude, a.latitude);
              let bLngLat = new mapboxgl.LngLat(b.longitude, b.latitude);
              let aDistance = aLngLat.distanceTo(e.lngLat);
              let bDistance = bLngLat.distanceTo(e.lngLat);
              return Math.min(aDistance, bDistance);
            });
            let _focusedChain = _sortedChains[0];

            e.clickOnLayer = true;
            setChainDetailsOpen(true);

            handleSetFocusedChain(_focusedChain, _map);
          }
        });

        _map.on("click", (e) => {
          if (!e.clickOnLayer) {
            setChainDetailsOpen(false);
          }
        });

        // zoom during click on a cluster
        _map.on("click", "chain-cluster", (e) => {
          console.log("cluster click event", e);
          const features = _map.queryRenderedFeatures(e.point, {
            layers: ["chain-cluster"],
          });
          console.log("features", features);
          const clusterId = features[0].properties?.cluster_id;

          try {
            if (!clusterId) throw "no cluster id";
            (
              _map.getSource("chains") as mapboxgl.GeoJSONSource
            ).getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err) return;
              _map.easeTo({
                center: (features[0].geometry as any).coordinates,
                zoom: zoom * 1.2,
              });
            });
          } catch (err) {
            try {
              if (!features[0].properties?.uid) throw "no chain uid found";
              const chain = _chains.find(
                (c) => c.uid === features[0].properties!.uid
              );
              if (!chain) throw "no chain found";
              _map.easeTo({
                center: [chain.longitude, chain.latitude],
                zoom: 11,
              });

              // auto select
              setSelectedChains([chain]);

              const uniqueFeatures = [...new Set(features.map((f) => f.id))];
              if (uniqueFeatures.length === 1) {
                handleSetFocusedChain(chain, _map);
              }
            } catch (err) {
              console.warn(err);
              _map.easeTo({
                center: e.lngLat,
                zoom: 11,
              });
            }
          }
        });
      });
      setChains(_chains);
    });

    setMap(_map);

    return () => {
      _map.remove();
      setMap(undefined);
    };
  }, []);

  function handleSetFocusedChain(_focusedChain: Chain, _map?: mapboxgl.Map) {
    _map = _map || map;

    const features = _map!.queryRenderedFeatures(undefined, {
      layers: ["chain-cluster", "chain-single"],
    }) as any as GeoJSONChains["features"];

    // unset the previous focused Feature
    if (focusedChain) {
      let featPrev = features.find(
        (f) => f.properties.uid === focusedChain.uid
      );
      if (featPrev)
        _map!.setFeatureState(
          {
            source: "chains",
            id: featPrev.id,
          },
          {
            clicked: false,
          }
        );
    }

    // set the State
    setFocusedChain(_focusedChain);

    // set the Feature
    features.forEach((f) => {
      _map!.setFeatureState(
        {
          source: "chains",
          id: f.id,
        },
        {
          clicked: f.properties.uid === _focusedChain.uid,
        }
      );
    });

    _map!.easeTo({
      duration: 700,
      animate: true,
      essential: true,
      center: [_focusedChain.longitude, _focusedChain.latitude],
    });
  }

  function getVisibleChains(map: mapboxgl.Map, chains: Chain[]) {
    const center = map.getCenter();
    const features = map!.queryRenderedFeatures(undefined, {
      layers: ["chain-cluster", "chain-single"],
    }) as any as GeoJSONChains["features"];
    let visibleFeatures: GeoJSONChains["features"] = [];
    if (features.length) {
      // Get UID of each chain in view
      for (let i = 0; i < features.length; i++) {
        let f = features[i];
        if (!f.properties?.cluster) {
          if (f.geometry.type !== "Point") continue;
          let fLngLat = new mapboxgl.LngLat(
            f.geometry.coordinates[GEOJSON_LONGITUDE_INDEX],
            f.geometry.coordinates[GEOJSON_LATITUDE_INDEX]
          );
          if (center.distanceTo(fLngLat) > 8000) continue;
          visibleFeatures.push(f as any);
        }
      }
    }
    let ans = visibleFeatures
      .sort((a, b) => {
        let aLngLat = new mapboxgl.LngLat(
          a.geometry.coordinates[GEOJSON_LONGITUDE_INDEX],
          a.geometry.coordinates[GEOJSON_LATITUDE_INDEX]
        );
        let bLngLat = new mapboxgl.LngLat(
          b.geometry.coordinates[GEOJSON_LONGITUDE_INDEX],
          b.geometry.coordinates[GEOJSON_LATITUDE_INDEX]
        );
        return aLngLat.distanceTo(bLngLat);
      })
      .map((f) => f.properties.chainIndex)
      .filter((value, index, arr) => arr.indexOf(value) === index)
      .map((chainIndex) => chains[chainIndex])
      .filter((c) => c) as Chain[];

    setVisibleChains(ans);
  }

  // https://docs.mapbox.com/mapbox-gl-js/style-spec/other/#set-membership-filters
  function handleSearch(
    search: SearchValues,
    longLat: GeoJSON.Position | undefined
  ) {
    if (!chains || !map) return;

    // filter map by gender or sizes
    (map.getSource("chains") as mapboxgl.GeoJSONSource).setData(
      mapToGeoJSONChains(chains, createFilterFunc(search.genders, search.sizes))
    );

    // search
    if (longLat) {
      map.setCenter(longLat as mapboxgl.LngLatLike);
      map.setZoom(10);
    }

    window.history.replaceState(
      {},
      "",
      window.location.origin +
        window.location.pathname +
        toUrlSearchParams(search, longLat)
    );

    setSelectedChains([]);
  }

  function handleClickJoin(e: MouseEvent<HTMLButtonElement>, chain: Chain) {
    e.preventDefault();
    if (authUser && chain.uid) {
      addModal({
        message: t("AreYouSureJoinLoop", {
          chainName: chain.name,
        }),
        actions: [
          {
            text: t("join"),
            type: "secondary",
            fn: () => {
              chainAddUser(chain.uid, authUser.uid, false)
                .then(() => {
                  authUserRefresh();
                  history.push({ pathname: "/thankyou" });
                })
                .catch((err) => {
                  addToastError(GinParseErrors(t, err), err?.status);
                });
            },
          },
        ],
      });
    } else {
      history.push({
        pathname: `/loops/${chain.uid}/users/signup`,
        state: {
          chainId: chain.uid,
        },
      });
    }
  }

  function handleClickViewChain(
    e: MouseEvent<HTMLButtonElement>,
    chainUID: UID
  ) {
    e.preventDefault();
    history.push(`/loops/${chainUID}/members`);
  }

  function handleLocation() {
    setLocationLoading(true);
    window.navigator.geolocation.getCurrentPosition(
      (pos) => {
        map?.setZoom(10);
        map?.setCenter([pos.coords.longitude, pos.coords.latitude]);
        setLocationLoading(false);
      },
      (err) => {
        setLocationLoading(false);
        console.error("Couldn't receive location:", err.message);
      }
    );
  }

  if (!MAPBOX_TOKEN) {
    addToastError("Access tokens not configured", 500);
    return <div></div>;
  }
  const selectedFocusedChains = visibleChains
    .filter((c) => c.uid !== focusedChain?.uid)
    .map((chain) => {
      const selected = !!selectedChains.find((c) => chain.uid === c.uid);
      return { selected, chain };
    })
    .sort((a, b) => (a.selected === b.selected ? 0 : b.selected ? 1 : -1));

  return (
    <>
      <Helmet>
        <title>The Clothing Loop | Find Loop</title>
        <meta name="description" content="Find Loop" />
      </Helmet>

      <main>
        <SearchBar
          initialValues={{
            searchTerm: urlParams.get("q") || "",
            sizes: urlParams.getAll("s") || [],
            genders: urlParams.getAll("g") || [],
          }}
          onSearch={handleSearch}
        />

        <div className="relative h-[80vh]">
          <div ref={mapRef} className="h-full"></div>

          <div className="flex flex-col absolute z-30 bottom-[5%] right-2.5 rtl:right-auto rtl:left-2.5">
            <button
              className="btn btn-circle btn-outline glass bg-white/70 hover:bg-white/90 mb-4"
              onClick={() => handleLocation()}
            >
              <span
                className={`feather text-base-content text-lg ${
                  locationLoading
                    ? "feather-loader animate-spin"
                    : "feather-navigation"
                }`}
              />
            </button>
            <div className="btn-group btn-group-vertical">
              <button
                className={`btn rounded-t-full p-0 w-12 h-12 ${
                  zoom >= MAX_ZOOM
                    ? "btn-disabled bg-white/30"
                    : "glass bg-white/60 hover:bg-white/90 btn-outline"
                }`}
                onClick={() => mapZoom(map, "+")}
              >
                <span className="feather feather-plus text-base-content text-lg" />
              </button>
              <button
                className={`btn rounded-b-full p-0 w-12 h-12 ${
                  zoom <= MIN_ZOOM
                    ? "btn-disabled bg-white/30"
                    : "glass bg-white/60 hover:bg-white/90 btn-outline"
                }`}
                onClick={() => mapZoom(map, "-")}
              >
                <span className="feather feather-minus text-base-content text-lg" />
              </button>
            </div>
          </div>
          <dialog
            open={chainDetailsOpen}
            className="sm:invisible absoluete w-72 align-center overflow-y-auto overflow-x-visible inset-0 z-50 justify-center items-center p-0 open:flex bg-white/80"
            tabIndex={-1}
          >
            <form className="w-full z-10">
              {focusedChain ? (
                <FocusedChain
                  chain={focusedChain}
                  authUser={authUser}
                  onClickJoin={(e) => handleClickJoin(e, focusedChain)}
                  onClickViewChain={(e) =>
                    handleClickViewChain(e, focusedChain.uid)
                  }
                />
              ) : null}
              <div>
                {selectedFocusedChains.filter(({ selected }) => selected)
                  .length ? (
                  <div className="text-xs bg-grey/20 p-1 text-center font-semibold">
                    {t("selectLoop")}
                  </div>
                ) : null}
                {selectedFocusedChains.map(({ chain, selected }) => {
                  return (
                    <button
                      className={`p-1.5 block w-full border-t border-b border-grey/10 last:border-none text-secondary text-ellipsis overflow-hidden whitespace-nowrap ${
                        selected ? "font-semibold" : "hidden md:block"
                      }`}
                      key={chain.uid}
                      onClick={() => handleSetFocusedChain(chain)}
                    >
                      {chain.name}
                    </button>
                  );
                })}
              </div>
              <button
                key="close"
                type="reset"
                className="btn btn-sm btn-ghost float-right mr-4 mb-4"
                onClick={() => setChainDetailsOpen(false)}
              >
                {t("close")}
              </button>
            </form>
          </dialog>
          <div
            className={`absolute z-30 top-4 left-4 rtl:left-auto rtl:right-4 max-h-full w-72 overflow-y-auto overflow-x-visible invisible sm:visible ${
              visibleChains.length ? "" : "hidden"
            }`}
          >
            <button
              key="close"
              type="button"
              onClick={() => {
                setSelectedChains([]);
                setVisibleChains([]);
                setFocusedChain(null);
              }}
              className="absolute md:hidden top-2 right-2 rtl:right-auto rtl:left-2 btn btn-sm btn-circle btn-outline"
            >
              <span className="feather feather-x"></span>
            </button>
            {focusedChain ? (
              <FocusedChain
                chain={focusedChain}
                authUser={authUser}
                onClickJoin={(e) => handleClickJoin(e, focusedChain)}
                onClickViewChain={(e) =>
                  handleClickViewChain(e, focusedChain.uid)
                }
              />
            ) : null}

            <div className="glass shadow-md">
              {selectedFocusedChains.map(({ chain, selected }) => {
                return (
                  <button
                    className={`p-1.5 block w-full border-b border-grey/10 last:border-none text-secondary text-ellipsis overflow-hidden whitespace-nowrap ${
                      selected ? "font-semibold bg-white" : "hidden md:block"
                    }`}
                    key={chain.uid}
                    onClick={() => handleSetFocusedChain(chain)}
                  >
                    {chain.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div
            className={`absolute z-30 top-4 left-4 rtl:left-auto rtl:right-4 max-h-full w-72 overflow-y-auto overflow-x-visible ${
              selectedChains.length ? "" : "hidden"
            }`}
          >
            <button
              key="close"
              type="button"
              onClick={() => setSelectedChains([])}
              className="absolute top-2 right-2 rtl:right-auto rtl:left-2 btn btn-sm btn-circle btn-outline"
            >
              <span className="feather feather-arrow-left rtl:hidden"></span>
              <span className="feather feather-arrow-right ltr:hidden"></span>
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

function FocusedChain({
  chain,
  authUser,
  onClickJoin,
  onClickViewChain,
}: {
  chain: Chain;
  authUser: AuthProps["authUser"];
  onClickJoin: MouseEventHandler<HTMLButtonElement>;
  onClickViewChain: MouseEventHandler<HTMLButtonElement>;
}) {
  function handleClickShortenedDesc(e: MouseEvent) {
    let input = (e.target as HTMLParagraphElement).parentElement?.querySelector(
      "input"
    );

    if (input) input.checked = true;
  }

  const { t } = useTranslation();
  const userChain = authUser?.chains.find((uc) => uc.chain_uid === chain.uid);

  return (
    <div className="p-4 w-full mb-1 sm:bg-white sm:shadow-md" key={chain.uid}>
      <div className="sm:mb-2">
        <h1 className="font-semibold text-secondary mb-3 pr-10 rtl:pr-0 rtl:pl-10 break-words">
          {chain.name}
        </h1>

        {chain.description ? (
          chain.description.length > 200 ? (
            <div className="mb-3">
              <input
                type="checkbox"
                className="hidden peer"
                id={"checkbox-desc-more-" + chain.uid}
              />
              <p
                className="overflow-hidden peer-checked:max-h-fit text-sm break-words max-h-12 relative before:block before:absolute before:h-8 before:w-full before:bg-gradient-to-t before:from-white/90 before:to-transparent before:bottom-0 peer-checked:before:hidden"
                tabIndex={0}
                onClick={handleClickShortenedDesc}
              >
                {chain.description.split("\n").map((s, i) => {
                  if (i === 0) return s;

                  return (
                    <>
                      <br />
                      {s}
                    </>
                  );
                })}
              </p>
              <label
                htmlFor={"checkbox-desc-more-" + chain.uid}
                aria-label="expand"
                className="btn btn-xs btn-ghost bg-teal-light feather feather-more-horizontal peer-checked:hidden"
                onClick={handleClickShortenedDesc}
              ></label>
            </div>
          ) : (
            <p className="mb-3 text-sm break-words">{chain.description}</p>
          )
        ) : null}

        <div>
          <div className="flex flex-col w-full text-sm">
            {chain.sizes?.length ? (
              <>
                <h2 className="mb-1">{t("sizes")}:</h2>
                <div className="mb-2">
                  <SizeBadges s={chain.sizes} g={chain.genders} />
                </div>
              </>
            ) : null}
          </div>
          <div className="flex flex-col items-start">
            {authUser?.is_root_admin || userChain?.is_chain_admin ? (
              <button
                key={"btn-view"}
                className="btn btn-sm btn-secondary btn-outline mb-3"
                onClick={onClickViewChain}
              >
                {t("viewLoop")}
                <span className="feather feather-shield ml-3"></span>
              </button>
            ) : null}
          </div>
        </div>

        {userChain ? (
          userChain.is_approved ? (
            <p className="bg-primary px-3 font-semibold text-sm border border-primary h-8 flex items-center">
              {t("joined")}
              <span className="feather feather-check ml-3"></span>
            </p>
          ) : (
            <p className="px-3 font-semibold text-sm border border-secondary h-8 flex items-center text-secondary">
              {t("pendingApproval")}
              <span className="feather feather-user-check ml-3"></span>
            </p>
          )
        ) : chain.open_to_new_members ? (
          <button
            onClick={onClickJoin}
            type="button"
            className="btn btn-sm btn-primary"
          >
            {t("join")}
            <span className="feather feather-arrow-right ml-3 rtl:hidden"></span>
            <span className="feather feather-arrow-left mr-3 ltr:hidden"></span>
          </button>
        ) : (
          <p className="px-3 font-semibold text-sm border border-secondary h-8 flex items-center text-secondary">
            {t("closed")}
            <span className="feather feather-lock ml-3 rtl:ml-0 rtl:mr-3"></span>
          </p>
        )}
      </div>
    </div>
  );
}
