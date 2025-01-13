import { useEffect, useRef, useState } from "react";
import Counters from "../components/Counters/Counters";
import Carousel from "../components/Carousel";
import Testimonials from "../components/Testimonials";
import StandaloneSearchBar from "../components/FindChain/StandaloneSearchBar";
import useIntersectionObserver from "../components/Counters/hooks";
import { useTranslation } from "react-i18next";
import useLocalizePath from "../util/localize_path.hooks";
import useHydrated from "../util/hydrated.hooks";
import { $authUser } from "../../../stores/auth";
import getLanguages from "../../../languages";
import { chainGetLargest } from "../../../api/chain";

const IS_PRODUCTION =
  import.meta.env.PUBLIC_BASE_URL === "https://www.clothingloop.org";

const CirclesFrame = "https://images.clothingloop.org/0x0/circles.png";

interface Supporter {
  logo: string;
  url: string;
  alt: string;
  class: string;
}
interface TopLoop {
  name: string;
  description: string;
  number_of_participants: number;
}
export default function Home() {
  const { t, i18n } = useTranslation();
  const localizePath = useLocalizePath(i18n);
  const ref = useRef() as any;
  const [topLoops, setTopLoops] = useState<TopLoop[]>();

  const isVisible = useIntersectionObserver(ref, {
    root: null,
    rootMargin: "-70px",
    threshold: 0.5,
  });

  // redirect to the users language home page
  useHydrated(() => {
    if (window.location.pathname === "/") {
      //@ts-ignore
      var browserLang = navigator.language || navigator.userLanguage;
      let lang = $authUser.get()?.i18n || browserLang || "en";
      if (!getLanguages(IS_PRODUCTION).find((l) => l === lang)) lang = "en";

      window.location.href = localizePath("/", lang);
    }
  });
  async function fetchLargestLoops() {
    try {
      const largest_loops = await chainGetLargest();
      setTopLoops(largest_loops.data);
    } catch (err: any) {
      console.warn(err);
    }
  }

  useEffect(() => {
    fetchLargestLoops();
  }, []);

  const maxInput = topLoops ? topLoops[0].number_of_participants : 100;
  const minInput = topLoops ? topLoops[9].number_of_participants : 50;

  function adjustValue(inputValue: number) {
    const range = 9 - 5;
    return range + ((inputValue - minInput) / (maxInput - minInput)) * range;
  }

  const maxOuput = adjustValue(maxInput) / 0.9;

  const supporters: Supporter[] = [
    {
      logo: "https://images.clothingloop.org/160x/sfm_logo.png",
      url: "https://slowfashion.global/",
      alt: "Slow Fashion Movement",
      class: "ps-[8.333333%] w-3/12 md:ps-0 md:w-3/12 lg:w-2/12",
    },
    {
      logo: "https://images.clothingloop.org/x100/npl_buurtfonds_logo_2023.png",
      url: "https://www.doen.nl/en",
      alt: "Stichting Doen",
      class: "w-8/12 md:w-5/12 lg:w-4/12",
    },
    {
      logo: "https://images.clothingloop.org/160x,jpeg/logo_wdcd.png",
      url: "https://www.whatdesigncando.com/",
      alt: "What Design Can Do",
      class: "w-1/2 md:w-4/12 lg:w-2/12",
    },
    {
      logo: "https://images.clothingloop.org/160x/logo_impact_hub.png",
      url: "https://impacthub.net/",
      alt: "Impact Hub",
      class: "w-1/2 md:w-3/12 lg:w-2/12",
    },
    {
      logo: "https://images.clothingloop.org/208x/pnh_logo.png",
      url: "https://www.noord-holland.nl/",
      alt: "Provincie Noord-Holland",
      class: "pt-4 md:pt-0 w-full md:w-5/12 lg:w-4/12",
    },
    {
      logo: "https://images.clothingloop.org/x74/logo_collaction.png",
      url: "https://www.collaction.org/",
      alt: "CollAction",
      class: "w-1/2 md:w-4/12 lg:w-4/12",
    },
    {
      logo: "https://images.clothingloop.org/208x/meax_logo.png",
      url: "https://maex.nl/#/initiative/8be552d9-8b8a-4b9e-ac00-9d425e627696",
      alt: "MEAX",
      class: "w-1/2 md:w-4/12 lg:w-4/12",
    },
    {
      logo: "https://images.clothingloop.org/x120/de_duurzame_100.jpg",
      url: "https://verhalen.trouw.nl/duurzame100/",
      alt: "Trouw - Duurzame 100",
      class: "w-1/2 md:w-4/12 lg:w-2/6",
    },
    {
      logo: "https://images.clothingloop.org/120x/duurzame_dinsdag.jpg",
      url: "https://www.duurzamedinsdag.nl/",
      alt: "Duurzame dinsdag",
      class: "w-1/2 md:w-1/2 lg:w-2/6",
    },
    {
      logo: "https://images.clothingloop.org/140x/zerowastelogo.png",
      url: "https://zerowastenederland.nl/",
      alt: "Zero Waste Nederland",
      class: "pt-4 md:pt-0 w-full md:w-1/2 lg:w-2/6",
    },
  ];

  return (
    <>
      <StandaloneSearchBar />

      <div className="max-w-screen-xl mx-auto">
        <section className="mb-12 md:mb-24">
          <div className="hidden md:block overflow-hidden w-full absolute bg-teal-light left-0">
            <div className="p-8 ms-[40%] pb-14 flex">
              <img src={CirclesFrame} alt="" />
              <img className="pl-2" src={CirclesFrame} alt="" />
            </div>
          </div>
          <div className="relative z-10 flex flex-col md:flex-row">
            <div className="p-6 md:pt-20 md:ps-40 md:pe-20 md:w-1/2 flex justify-center md:justify-end">
              <div className="max-w-screen-xs md:max-w-[500px]">
                <h1
                  className="font-serif font-bold text-accent text-8xl md:text-9xl [&_span]:text-stroke-accent mb-8 rtl:text-end"
                  dir="ltr"
                >
                  Swap, <br />
                  <span>
                    don't <br />
                    shop!
                  </span>
                </h1>
                <p>{t("swapDontShopMessage")}</p>
                <a
                  className="btn btn-primary btn-outline mt-4"
                  href={localizePath("/loops/find")}
                >
                  {t("findALoop")}
                  <span className="icon-arrow-right ml-3 rtl:hidden" />
                  <span className="icon-arrow-left mr-3 ltr:hidden" />
                </a>
              </div>
            </div>
            <div className="md:pt-16 md:pe-20 lg:pe-40 md:w-1/2">
              <img
                className="w-full lg:max-w-[600px] sm:h-96 md:h-auto object-cover object-top"
                src="https://images.clothingloop.org/900x/kirsten_en_rosan.jpg"
                alt="Bringing a bag full clothes to another's doorstep"
              />
              <p className="text-sm my-1">
                {t("photo")}: Martijn van den Dobbelsteen/de Brug
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex flex-col-reverse md:flex-row items-center md:items-start md:mb-16">
            <div className="flex w-full md:w-1/2 md:justify-end">
              <iframe
                title="video about what is the Clothing Loop"
                src="https://player.vimeo.com/video/673700502?h=90c8532936&amp;badge=0&amp;autopause=0&amp;player_id=0&amp;app_id=58479&portrait=0&title=0&byline=0"
                allow="autoplay; fullscreen; picture-in-picture"
                className="w-full sm:w-[600px] aspect-video"
              ></iframe>
            </div>

            <div className="w-full md:w-1/2 px-6 mb-6 md:mb-0">
              <h2 className="text-accent font-serif font-bold text-4xl md:text-6xl mb-4">
                <span className="inline md:block mr-4 font-serif font-bold text-9xl text-stroke-accent">
                  1
                </span>
                <span
                  className="[&_br]:hidden md:[&_br]:block"
                  dangerouslySetInnerHTML={{ __html: t("findOutHowItWorks")! }}
                ></span>
              </h2>
              <a
                className="link link-accent text-lg"
                href={localizePath("/loops/find")}
              >
                {t("findALoopNearYou")}
              </a>
            </div>
          </div>

          <div
            className="flex flex-col md:flex-row items-center md:mb-20"
            ref={ref}
          >
            <div className="text-secondary w-full md:w-1/2 x-10 flex justify-end">
              <div className="md:max-w-[600px] p-6 pt-0">
                <h2 className="font-serif font-bold text-4xl md:text-6xl mb-6">
                  <span className="inline md:block mr-4 text-9xl text-stroke-secondary">
                    2
                  </span>
                  <span>{t("joinALoop")}</span>
                </h2>
                <p className="text-lg">{t("joinALoopMessage")}</p>
                <a
                  href={localizePath("/loops/find")}
                  className="hidden md:flex btn btn-outline btn-circle btn-secondary mt-6"
                  aria-label="find loop"
                >
                  <span className="icon-arrow-right rtl:hidden"></span>
                  <span className="icon-arrow-left ltr:hidden"></span>
                </a>
              </div>
            </div>
            <div className="flex md:w-1/2 justify-center items-center p-20">
              <div className="relative w-full md:max-w-[600px]">
                <a
                  href={localizePath("/loops/find")}
                  className={`hover:ring-[2rem] ring-secondary transition-[box-shadow] z-20 block ${
                    isVisible ? "ring-[1rem] md:ring-0" : "ring-0"
                  }`}
                >
                  <img
                    src="https://images.clothingloop.org/600x,jpeg/map_image_5.jpg"
                    alt="map"
                  />
                </a>
                <img
                  className="-z-10 absolute -right-20 -top-20"
                  src={CirclesFrame}
                  aria-hidden
                  alt=""
                />
                <img
                  className="-z-10 absolute -left-20 -bottom-20"
                  aria-hidden
                  alt=""
                  src={CirclesFrame}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col-reverse md:flex-row items-center mb-8 md:mb-40">
            <div className="relative w-full md:w-1/2 md:pr-20 flex justify-end">
              <img
                src="https://images.clothingloop.org/900x/numbered_bag_outdoors.jpg"
                className="w-full md:max-w-[600px] object-cover object-bottom h-96"
                alt="A numbered bag in front of a door and another in front of some letterboxes"
              />

              <div className="hidden md:block absolute -z-10 bg-yellow/30 w-[600px] h-5/6 bottom-[-4rem] right-[2rem]">
                &nbsp;
              </div>
            </div>

            <div className="md:w-1/2">
              <div className="w-full md:max-w-[600px] p-6">
                <h2 className="font-serif font-bold text-4xl md:text-6xl text-yellow-darkest mb-6">
                  <span className="inline md:block md:mb-4 mr-4 text-9xl text-stroke-yellow-darkest">
                    3
                  </span>
                  {t("getReadyToSwap")}
                </h2>
                <p className="text-lg">{t("getReadyToSwapMessage")}</p>
              </div>
            </div>
          </div>
        </section>
        <section className="mb-12 md:mb-24">
          <div className="flex flex-col md:flex-row mx-6">
            <iframe
              className="w-full h-[800px] px-6 overflow-hidden border-8 border-secondary sm:w-[600px] aspect-video mx-auto mb-16"
              scrolling="no"
              id="instagram-embed"
              src="https://www.instagram.com/p/DDZ5jrdxoRy/embed"
            ></iframe>
            <div className="mx-auto my-auto w-full md:w-1/2 px-6">
              {topLoops?.map((tp) => {
                const value = adjustValue(tp.number_of_participants);
                return (
                  <div className="mb-4">
                    <div className="flex justify-between">
                      <div className="font-bold text-sm truncate">
                        {tp.name}
                      </div>
                      <div className="text-xs min-w-24 text-right">
                        {tp.number_of_participants} {t("participants")}
                      </div>
                    </div>
                    <progress
                      className="progress progress-secondary w-full"
                      value={value}
                      max={maxOuput}
                    ></progress>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
      <div className="bg-turquoise">
        <div className="w-full sm:max-md:max-w-screen-sm md:max-w-screen-xl mx-auto">
          <section
            className="flex flex-col md:flex-row items-center mb-6 md:mb-20 font-bold"
            id="impactreport"
          >
            <div className="w-full md:w-1/2 flex justify-end p-6 md:px-10 text-base-100">
              <div className="w-full md:max-w-screen-sm">
                <h2 className="text-6xl md:text-8xl font-serif mb-6">
                  {t("ourImpact")}
                </h2>
                <Counters />
              </div>
            </div>
            <div className="md:w-1/2 sm:max-md:pb-8">
              <img
                className="object-cover object-top w-full max-h-[600px]"
                src="https://images.clothingloop.org/0x0/2024_ourimpact_cropped_optimized.webp"
                alt="slides of a book displaying different pages previewing the downloadable impact report pdf"
              />
              {/* <video
                autoPlay
                loop
                muted
                playsInline
                className="object-cover object-top w-full max-h-[600px]"
                title="pages of the impact report"
                poster="https://images.clothingloop.org/x768,jpeg/impact_rapport_preview.png"
              >
                <source
                  src="https://images.clothingloop.org/original/impact_rapport.webm"
                  type="video/webm"
                />
                <source
                  src="https://images.clothingloop.org/original/impact_rapport.mp4"
                  type="video/mp4"
                />
              </video> */}
            </div>
          </section>
        </div>
      </div>
      <div className="max-w-screen-xl mx-auto">
        <section className="flex flex-col-reverse md:flex-row items-center mb-12 md:mb-20">
          <div className="md:w-1/2">
            <img
              src="https://images.clothingloop.org/768x/nichon_zelfportret.jpg"
              className="object-cover object-top w-full max-h-[600px]"
              alt="Nichon taking clothes out of a Clothing Loop bag"
            />
          </div>
          <div className="md:w-1/2 px-6 md:px-10 text-secondary mb-6 md:mb-0">
            <div className="w-full md:max-w-[600px]">
              <h2 className="font-serif font-bold text-4xl md:text-6xl mb-6">
                {t("fromLocalLockdownToSuccess")}
              </h2>
              <p className="text-base mb-3">
                {t("fromLocalLockdownToSuccessMessage")}
              </p>
              <a
                className="link link-secondary font-bold"
                href={localizePath("/about")}
              >
                {t("readMoreAboutUs")}
              </a>
            </div>
          </div>
        </section>

        <Testimonials />

        <section className="flex flex-col md:flex-row items-center md:items-end mb-8 md:mb-20">
          <div className="w-full md:w-1/2 flex justify-center md:justify-end">
            <img
              src="https://images.clothingloop.org/900x/selfies.jpg"
              alt="selfies of different people wearing clothes shared via their local Loop"
              className="w-full md:max-w-[500px] max-md:object-cover object-top h-60 md:h-auto"
            />
          </div>

          <div className="md:w-1/2 flex">
            <div className="relative p-10 md:max-w-[400px] bg-yellow/10 md:bg-transparent">
              <div className="hidden md:block -z-10 absolute w-full h-[300px] bg-yellow/10 ltr:-left-5 rtl:-right-5 bottom-0"></div>
              <h2
                className="font-serif font-bold text-4xl text-primary-focus [&_span]:text-2xl mb-7"
                dangerouslySetInnerHTML={{
                  __html: t("smallActsCanChangeTheWorld")!,
                }}
              ></h2>
              <p className="mb-4">
                {t("weAreWorkingOnMakingTheClothingLoopBetter")}
              </p>
              <a
                href={localizePath("/donate")}
                className="btn btn-outline btn-primary text-base border-2"
              >
                {t("donate")}
              </a>
            </div>
          </div>
        </section>

        <section>
          <div className="relative container mx-auto font-serif font-bold text-secondary mb-6 px-6 md:px-0">
            <div className="hidden md:block bg-teal-light absolute ltr:-left-10 rtl:-right-10 top-10 -z-10 w-[600px] h-[200px]">
              &nbsp;
            </div>
            <h2 className="text-6xl md:text-7xl mb-4">
              {t("Partners & Sponsors")}
            </h2>
            <p className="text-xl">
              {t("wantToSupportUsToo") + " "}
              <a className="link" href="mailto:hello@clothingloop.org">
                {t("wedLoveToHearFromYou")}
              </a>{" "}
            </p>
          </div>
          <ul className="max-w-screen-md mx-auto flex flex-wrap items-center justify-evenly mb-2 sm:mb-20">
            {supporters.map((el, i) => {
              return (
                <li
                  className={el.class + " flex justify-center mb-4 md:mb-8"}
                  key={i}
                >
                  <a href={el.url} target="_blank" rel="noreferrer">
                    <img className="w-full" src={el.logo} alt={el.alt} />
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      <Carousel />
    </>
  );
}
