import { useState } from "react";

import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TablePagination,
  TableContainer,
} from "@mui/material";
import {
  EditOutlined as EditIcon,
  Clear as DeleteIcon,
} from "@mui/icons-material";

import { makeStyles } from "@mui/styles";

import theme from "../util/theme";
import { UID, User } from "../api/types";
import { SizeI18nKeys } from "../api/enums";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";

const useStyles = makeStyles(theme as any);

export interface TableUserColumn {
  headerName: string;
  propertyName: keyof User;
}

interface Props {
  columns: TableUserColumn[];
  authUser: User | null;
  users: User[];
  initialPage: number;
  chainUID: string;
  edit: boolean;
  remove: boolean;
  onRemoveUser?: (uid: UID) => void;
}

export const ChainParticipantsTable = ({
  columns,
  authUser,
  users,
  chainUID,
  initialPage,
  edit,
  remove,
  onRemoveUser,
}: Props) => {
  const [page, setPage] = useState(initialPage);
  const rowsPerPage = 20;

  const { t } = useTranslation();

  const handleChangePage = (e: any, newPage: any) => {
    setPage(newPage);
  };

  return (
    <>
      <TableContainer className="tw-mt-10">
        <Table>
          <TableHead>
            <TableRow>
              {columns.map(({ headerName }) => {
                return (
                  <HeadRowTableCell key={headerName}>
                    {headerName}
                  </HeadRowTableCell>
                );
              })}

              {authUser?.is_root_admin && (
                <>
                  {edit && <HeadRowTableCell />}
                  {remove && <HeadRowTableCell />}
                </>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {users
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((u: User) => (
                <TableRow key={u.uid}>
                  {columns.map(({ propertyName }) => {
                    let text = u[propertyName] as string;
                    if (propertyName === "sizes") {
                      text = u.sizes
                        .filter((v) => Object.hasOwn(SizeI18nKeys, v))
                        .map((v) => SizeI18nKeys[v])
                        .join(", ");
                    }
                    return (
                      <BorderlessTableCell key={u.uid + propertyName}>
                        {text}
                      </BorderlessTableCell>
                    );
                  })}

                  {authUser?.is_root_admin && (
                    <>
                      {edit && (
                        <BorderlessTableCell key={u.uid + "editlink"}>
                          <Link
                            to={{
                              pathname: `/users/${u.uid}/edit`,
                              state: {
                                chainUID,
                              },
                            }}
                          >
                            <EditIcon />
                          </Link>
                        </BorderlessTableCell>
                      )}
                      {remove && onRemoveUser && (
                        <BorderlessTableCell key={u.uid + "dellink"}>
                          <DeleteIcon
                            onClick={() => onRemoveUser(u.uid as string)}
                          />
                        </BorderlessTableCell>
                      )}
                    </>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>

        <TablePagination
          rowsPerPageOptions={[rowsPerPage]}
          component="div"
          count={users.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          labelDisplayedRows={({ from, to, count }) => {
            let currentPage = page + 1;
            let totalPages = Math.floor(count / rowsPerPage) + 1;

            if (totalPages < 2) {
              return "";
            }

            return `${t("page")} ${currentPage} - ${totalPages}`;
          }}
          nextIconButtonProps={{ size: "large" }}
          backIconButtonProps={{ size: "large" }}
        />
      </TableContainer>
    </>
  );
};

const BorderlessTableCell = ({ children, ...props }: { children: any }) => {
  const classes = useStyles();

  return (
    <TableCell classes={{ root: classes.borderlessTableCellRoot }} {...props}>
      {children}
    </TableCell>
  );
};

const HeadRowTableCell = ({ children, ...props }: { children?: any }) => {
  const classes = useStyles();

  return (
    <TableCell
      classes={{ root: classes.headRowTableCellRoot }}
      variant="head"
      {...props}
    >
      {children}
    </TableCell>
  );
};
