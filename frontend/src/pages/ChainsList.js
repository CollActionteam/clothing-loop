import { useState, useEffect } from "react";
import { useHistory, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet";

// Material UI
import Table from "@material-ui/core/Table";
import TableHead from "@material-ui/core/TableHead";
import TableBody from "@material-ui/core/TableBody";
import TableRow from "@material-ui/core/TableRow";
import TableCell from "@material-ui/core/TableCell";
import { Button } from "@material-ui/core";
import TablePagination from "@material-ui/core/TablePagination";
import Paper from "@material-ui/core/Paper";
import TableContainer from "@material-ui/core/TableContainer";
import Alert from "@material-ui/lab/Alert";

// Project resources
import { getChains } from "../util/firebase/chain";
import { Typography } from "@material-ui/core";
import { getUsersForChain } from "../util/firebase/user";
import {DataExport} from "../components/DataExport";

const rows = ["name", "location", "status", "active users"];

const ChainsList = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [chains, setChains] = useState();

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [error, setError] = useState("");

  const handleChangePage = (e, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (e) => {
    setRowsPerPage(+e.target.value);
    setPage(0);
  };

  useEffect(() => {
    (async () => {
      let chains = await getChains();

      let activeUsers = 0;
      for (const chain of chains) {
        try {
          const getUsersForChainRes = await getUsersForChain(chain.id);
          activeUsers = getUsersForChainRes.length;
          chain.activeUsers = activeUsers;
        } catch (error) {
          setError(`an error occurred when trying to get all active users`);
          console.error("error in getting users for chain with id", chain.id);
        }
      }
      let sortedChains = chains.sort((a, b) => a.name.localeCompare(b.name));
      setChains(sortedChains);
    })();
  }, []);

  return chains ? (
    <>
      <Helmet>
        <title>Clothing-Loop | Loops List</title>
        <meta name="description" content="Loops List" />
      </Helmet>
      <div className="table-container">
        <div className="table-head">
          <Typography variant="h5">{`${chains.length} Clothing Loops`}</Typography>
          <Typography
            component="p"
            variant="body2"
            className="explanatory-text"
          >
            {
              "All available clothing loops are listed below. To select a specific clothing loop and make any change, click on 'view'."
            }
          </Typography>
          <DataExport />
        </div>
        {error ? <Alert severity="error">{error}</Alert> : null}
        <TableContainer component={Paper}>
          <Table aria-label="simple table">
            <TableHead>
              <TableRow className="table-row-head">
                {rows.map((row, i) => {
                  return (
                    <TableCell component="th" key={i}>
                      {row}
                    </TableCell>
                  );
                })}
              </TableRow>
            </TableHead>
            <TableBody>
              {chains
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((chain, i) => (
                  <TableRow key={chain.name} className="chains-list__table-row">
                    <TableCell component="th" scope="row">
                      {chain.name}
                    </TableCell>
                    <TableCell key="chain-address" align="left">
                      {chain.address}
                    </TableCell>
                    <TableCell key="chain-status" align="left">
                      {" "}
                      {chain.published ? (
                        <div style={{ display: "flex" }}>
                          <span className="dot-active"></span>
                          <Typography variant="body2">{"published"}</Typography>
                        </div>
                      ) : (
                        <div style={{ display: "flex" }}>
                          <span className="dot-not-active"></span>
                          <Typography variant="body2">
                            {"unpublished"}
                          </Typography>
                        </div>
                      )}
                    </TableCell>
                    <TableCell key="chain-users" align="left">
                      {chain.activeUsers}
                    </TableCell>
                    <TableCell align="left">
                      <Button
                        variant="contained"
                        color="secondary"
                        onClick={(e) => {
                          e.preventDefault();
                          history.push(`/loops/members/${chain.id}`);
                        }}
                      >
                        {"view"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={chains.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onChangeRowsPerPage={handleChangeRowsPerPage}
          />
        </TableContainer>
      </div>
    </>
  ) : null;
};

export default ChainsList;
