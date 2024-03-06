import { useContext } from "react";
import { Helmet } from "react-helmet";
import { Redirect, useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";

import ProgressBar from "../components/ProgressBar";
import ChainDetailsForm, {
  RegisterChainForm,
} from "../components/ChainDetailsForm";
import {
  registerChainAdmin,
  RequestRegisterChain,
  RequestRegisterUser,
} from "../api/login";
import { AuthContext } from "../providers/AuthProvider";
import { chainCreate } from "../api/chain";
import { ToastContext } from "../providers/ToastProvider";
import { GinParseErrors } from "../util/gin-errors";
import { chainGetNear } from "../api/chain";

export interface State {
  only_create_chain: boolean;
  register_user?: RequestRegisterUser;
}

const VITE_BASE_URL = import.meta.env.VITE_BASE_URL;

const NewChainLocation = ({ location }: { location: any }) => {
  const history = useHistory();
  const { t } = useTranslation();
  const state = location.state as State | undefined;
  const { authUser, authUserRefresh } = useContext(AuthContext);
  const { addToastError, addModal } = useContext(ToastContext);

  const onSubmit = async (values: RegisterChainForm) => {
    let user = state!.only_create_chain ? authUser : state!.register_user;
    if (!user) {
      addToastError("User is not availible", 400);
      return;
    }
    const newChain: RequestRegisterChain = {
      name: values.name,
      description: values.description,
      address: values.address,
      country_code: values.country_code,
      latitude: values.latitude,
      longitude: values.longitude,
      radius: values.radius,
      open_to_new_members: true,
      sizes: values.sizes,
      genders: values.genders,
      allow_toh: true,
    };

    if (!(newChain.address?.length > 5)) {
      addToastError(t("required") + ": " + t("loopLocation"), 400);
      return;
    }

    let nearbyChains = (
      await chainGetNear({
        latitude: values.latitude,
        longitude: values.longitude,
        radius: 3,
      })
    ).data;

    const funcCreateChain = state!.only_create_chain
      ? async () => {
          try {
            await chainCreate(newChain);
            await authUserRefresh();

            window.goatcounter?.count({
              path: "new-chain",
              title: "New chain",
              event: true,
            });
            history.replace("/loops/new/confirmation?name=" + newChain.name);
          } catch (err: any) {
            console.error("Error creating chain:", err, newChain);
            addToastError(GinParseErrors(t, err), err?.status);
          }
        }
      : async () => {
          console.info("creating user: ", user);
          try {
            if (!user)
              throw "Could not find user when running the create user function";
            await registerChainAdmin(
              {
                name: user.name,
                email: user.email,
                address: user.address,
                phone_number: user.phone_number,
                newsletter: state!.register_user?.newsletter || false,
                sizes: values.sizes || [],
                latitude: user.latitude || 0,
                longitude: user.longitude || 0,
              },
              newChain
            );
            if (window.goatcounter) {
              window.goatcounter.count({
                path: "new-chain",
                title: "New chain",
                event: true,
              });
              window.goatcounter.count({
                path: "new-user",
                title: "New user",
                event: true,
              });
            }
            history.replace("/loops/new/confirmation?name=" + newChain.name);
          } catch (err: any) {
            console.error(
              `Error creating user and chain: ${JSON.stringify(err)}`
            );
            addToastError(GinParseErrors(t, err), err?.status);
          }
        };
    if (nearbyChains.length > 0) {
      addModal({
        message: t("similarLoopNearby"),
        content: () => (
          <ul
            className={`text-sm font-semibold mx-8 ${
              nearbyChains.length > 1 ? "list-disc" : "list-none text-center"
            }`}
          >
            {nearbyChains.map((c) => (
              <li key={c.uid}>
                <a
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  target="_blank"
                  href={`${VITE_BASE_URL}/loops/${c.uid}/users/signup`}
                >
                  {c.name}
                </a>
              </li>
            ))}
          </ul>
        ),
        actions: [
          {
            text: t("create"),
            type: "primary",
            fn: () => {
              funcCreateChain();
            },
          },
        ],
      });
    } else {
      await funcCreateChain();
    }
  };

  if (!state || (state.only_create_chain === false && !state.register_user)) {
    return <Redirect to="/loops/new/users/signup" />;
  }

  return (
    <>
      <Helmet>
        <title>The Clothing Loop | Create New Loop</title>
        <meta name="description" content="Create New Loop" />
      </Helmet>
      <main className="container lg:max-w-screen-lg mx-auto md:px-20 pt-4">
        <div className="bg-teal-light p-8">
          <h1 className="text-center font-medium text-secondary text-5xl mb-6">
            {t("startNewLoop")}
          </h1>
          <div className="text-center mb-6">
            <ProgressBar
              activeStep={1}
              disabledStep={state.only_create_chain ? 0 : undefined}
            />
          </div>
          <ChainDetailsForm
            onSubmit={onSubmit}
            //submitError={error}
            showBack={!state.only_create_chain}
            showAllowedTOH={!authUser?.accepted_toh}
            showAllowedDPA={!authUser?.accepted_dpa}
            submitText={t("submit")}
          />
        </div>
      </main>
    </>
  );
};

export default NewChainLocation;