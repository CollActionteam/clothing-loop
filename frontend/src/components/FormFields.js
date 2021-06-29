import TextField from "@material-ui/core/TextField";
import { makeStyles } from "@material-ui/core/styles";
import theme from "../util/theme";
import { useTranslation } from "react-i18next";
import MuiPhoneInput from "material-ui-phone-number";
import Checkbox from "@material-ui/core/Checkbox";
import { ErrorMessage, useField } from "formik";
import FormGroup from "@material-ui/core/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";

const TextFormField = ({ name, inputRef, email }) => {
  const { t } = useTranslation();
  const classes = makeStyles(theme)();

  return (
    <TextField
      id={name}
      name={name}
      type={email ? "email" : "text"}
      label={t(name)}
      className={classes.textField}
      inputRef={inputRef}
      required={true}
      fullWidth
    ></TextField>
  );
};

const PhoneFormField = ({ label, ...props }) => {
  const { t } = useTranslation();

  const [field, meta] = useField(props);

  return (
    <div>
      {" "}
      <MuiPhoneInput
        defaultCountry="nl"
        regions={"europe"}
        fullWidth
        label={label}
        required={true}
        htmlFor={field.name}
        {...field}
        {...props}
      />
      <ErrorMessage name={field.name} />
    </div>
  );
};

const TextForm = ({ label, ...props }) => {
  const [field, meta] = useField(props);
  const { t } = useTranslation();
  const classes = makeStyles(theme)();

  return (
    <div>
      {/* <label htmlFor={field.name}>{t(label)}</label> */}
      <TextField
        {...field}
        {...props}
        autoComplete="off"
        label={label}
        fullWidth
      />
      <ErrorMessage component="div" name={field.name} className="error" />
    </div>
  );
};

const CheckboxField = ({ label, state, ...props }) => {
  const [field, meta] = useField(props);
  const { t } = useTranslation();

  return (
    <FormGroup row>
      <FormControlLabel
        control={<Checkbox checked={state} name={field.name} />}
        {...field}
        {...props}
        label={label}
      />
    </FormGroup>
  );
};

export { TextFormField, PhoneFormField, TextForm, CheckboxField };
