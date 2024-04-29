import { type FormEvent, useState } from "react";

import { contactMailSend } from "../../../api/contact";

import { GinParseErrors } from "../util/gin-errors";
import useForm from "../util/form.hooks";
import { useTranslation } from "react-i18next";
import { addToastError } from "../../../stores/toast";
import useLocalizePath from "../util/localize_path.hooks";

const Contacts = () => {
  const { t, i18n } = useTranslation();
  const localizePath = useLocalizePath(i18n);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [values, setValue] = useForm({
    name: "",
    email: "",
    message: "",
    accept: false,
  });

  const CHARACTER_LIMIT = 2000;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    console.info("sending mail: ", values.email);

    (async () => {
      try {
        await contactMailSend(values.name, values.email, values.message);
        setSubmitted(true);
      } catch (err: any) {
        console.error("Unable to send contact mail", err, values);
        setError("submit");

        addToastError(GinParseErrors(t, err), err?.status);
      }
    })();
  }

  if (submitted) {
    window.location.href = localizePath("/message-submitted");
    return <div></div>;
  }

  return (
    <>
      <main className="max-w-screen-sm mx-auto pt-10 px-4">
        <h1 className="font-serif font-bold text-secondary text-6xl mb-8">
          {t("contactUs")}
        </h1>
        <p className="mb-6">{t("contactUsSubheading")}</p>

        <form className="flex flex-col" onSubmit={onSubmit}>
          <input
            placeholder={t("name")!}
            name="name"
            type="text"
            value={values.name}
            onChange={(e) => setValue("name", e.target.value)}
            min={2}
            className="input input-secondary mb-4"
            required
          />
          <input
            placeholder={t("email")!}
            name="email"
            type="text"
            value={values.email}
            onChange={(e) => setValue("email", e.target.value)}
            className="input input-secondary mb-4"
            required
          />
          <textarea
            placeholder={t("yourMessage")!}
            name="message"
            value={values.message}
            onChange={(e) => setValue("message", e.target.value)}
            required
            minLength={2}
            maxLength={CHARACTER_LIMIT}
            className="textarea textarea-secondary mb-4"
            rows={10}
          />

          <input
            name="accept"
            type="checkbox"
            className="invisible absolute -z-10"
            value={values.accept ? "checked" : "unchecked"}
            autoComplete="off"
            tabIndex={-1}
            onChange={(e) => {
              setValue("accept", e.target.value == "checked");
            }}
          />

          <button
            type="submit"
            className={`btn btn-primary ${
              error ? "ring-2 ring-offset-2 ring-error" : ""
            }`}
          >
            {t("submit")}
            <span className="icon-arrow-right ml-4 rtl:hidden"></span>
            <span className="icon-arrow-left mr-4 ltr:hidden"></span>
          </button>
        </form>
      </main>
    </>
  );
};

export default Contacts;
