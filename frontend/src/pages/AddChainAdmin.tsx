import React, { useState } from "react";
import {
  FormControl,
  Select,
  OutlinedInput,
  MenuItem,
  Typography,
  Button,
  Alert,
} from "@mui/material";
import { makeStyles } from "@mui/styles";

import RightArrow from "../images/right-arrow-white.svg";

import theme from "../util/theme";

import { Title } from "../components/Typography";
import { chainAddUser } from "../api/chain";
import { UID, User } from "../api/types";
import { useHistory } from "react-router-dom";

interface State {
  users: User[];
  chainUID: UID;
}

export default function AddChainAdmin({ location }: { location: any }) {
  const classes = makeStyles(theme as any)();

  const history = useHistory();

  const { state } = location;
  const { users, chainUID } = state as State;

  const [selectedUser, setSelectedUser] = useState<UID>();
  const [error, setError] = useState<string>();

  const handleSelectedUserChange = (event: { target: any }) => {
    setSelectedUser(event.target.value);
  };

  const handleSubmitAddChainAdmin = async () => {
    if (selectedUser) {
      try {
        await chainAddUser(chainUID, selectedUser, true);
        history.goBack();
      } catch (err: any) {
        setError(err?.data || "error");
      }
    }
  };

  return (
    <div className="tw-flex tw-flex-col tw-items-center tw-pt-24">
      <Title>Select Co-Host</Title>

      <div className="tw-mt-24 tw-w-[428px]">
        <FormControl classes={{ root: classes.specificSpacing }} fullWidth>
          <Select
            displayEmpty
            input={
              <OutlinedInput
                classes={{
                  root: classes.selectInputOutlined,
                }}
              />
            }
            classes={{
              select: classes.selectOutlined,
            }}
            variant="outlined"
            value={selectedUser}
            onChange={handleSelectedUserChange}
            renderValue={(selected: string) =>
              selected ?? (
                <Typography
                  component="span"
                  classes={{ root: classes.emptyRenderValue }}
                >
                  Select co-host
                </Typography>
              )
            }
          >
            {users.map((u) => (
              <MenuItem
                key={u.uid}
                classes={{
                  root: classes.menuItemSpacingAndColor,
                  selected: classes.selected,
                }}
                value={u.uid}
              >
                {u.name} - {u.email}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </div>

      {error && (
        <Alert sx={{ marginTop: 4 }} severity="error">
          {error}
        </Alert>
      )}

      <div className="tw-mt-20">
        <Button
          className={classes.button}
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          onClick={handleSubmitAddChainAdmin}
        >
          Confirm
          <img src={RightArrow} />
        </Button>
      </div>
    </div>
  );
}
