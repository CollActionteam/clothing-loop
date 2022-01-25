import { useTranslation } from "react-i18next";

// Material ui
import {
  MenuItem,
  FormControl,
  Select,
  ListItemText,
  Checkbox,
  TextField,
  InputAdornment,
} from "@mui/material";
import { Button, Paper, makeStyles } from "@material-ui/core";
import { Search } from "@mui/icons-material";

import SizesDropdown from "../SizesDropdown";

// Project resources
import theme from "../../util/theme";
import categories from "../../util/categories";

interface IProps {
  searchTerm: string;
  handleSearchTermChange: React.ChangeEventHandler<HTMLInputElement>;
  selectedGenders: string[];
  handleSelectedGenderChange: any;
  selectedSizes: string[];
  setSelectedSizes: (el: string[]) => void;
  handleSearch: any;
}

export const SearchBar: React.FC<IProps> = ({
  searchTerm,
  handleSearchTermChange,
  selectedGenders,
  handleSelectedGenderChange,
  selectedSizes,
  setSelectedSizes,
  handleSearch,
}: IProps) => {
  const classes = makeStyles(theme as any)();

  const { t } = useTranslation();

  return (
    <Paper className={classes.root2}>
      <TextField
        id="outlined-basic"
        placeholder={t("searchLocation")}
        variant="outlined"
        className={classes.input}
        value={searchTerm}
        onChange={handleSearchTermChange}
        InputProps={{
          style: {
            color: "#48808B",
          },
          startAdornment: (
            <InputAdornment position="start" className={classes.inputAdornment}>
              <Search />
            </InputAdornment>
          ),
        }}
      />

      <FormControl className={classes.formControl}>
        <Select
          displayEmpty
          className={classes.select}
          labelId="demo-multiple-checkbox-label"
          id="demo-multiple-checkbox"
          multiple
          variant="outlined"
          value={selectedGenders}
          onChange={handleSelectedGenderChange}
          renderValue={(selected) => {
            if (Array.isArray(selected)) {
              if (selected.length === 0) {
                return <em className={classes.em}>{t("categories")}</em>;
              }

              return selected.map(t).join(", ");
            }
          }}
        >
          {Object.keys(categories).map((value: any) => (
            <MenuItem key={value} value={value}>
              <Checkbox
                className={classes.checkbox}
                checked={selectedGenders.includes(value) ? true : false}
              />
              <ListItemText
                primary={t(value)}
                className={classes.listItemText}
              />
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <div className={classes.formControl}>
        <SizesDropdown
          className={classes.select}
          genders={selectedGenders}
          sizes={selectedSizes}
          setSizes={setSelectedSizes}
          label={t("sizes")}
          fullWidth={false}
          inputVisible={false}
          variantVal={false}
        />
      </div>

      <Button
        className={classes.button}
        variant="contained"
        color="primary"
        onClick={handleSearch}
      >
        {t("search")}
      </Button>
    </Paper>
  );
};
