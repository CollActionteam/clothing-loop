import { useEffect, useState, useContext } from "react";
import { useHistory } from "react-router-dom";
import ReactMapGL, { Marker, Popup } from "react-map-gl";
import { useTranslation } from "react-i18next";

// Material UI
import { Button } from "@material-ui/core";
import Typography from "@material-ui/core/Typography";
import Card from "@material-ui/core/Card";
import CardActions from "@material-ui/core/CardActions";
import CardContent from "@material-ui/core/CardContent";
import Paper from "@material-ui/core/Paper";
import InputBase from "@material-ui/core/InputBase";
import IconButton from "@material-ui/core/IconButton";
import SearchIcon from "@material-ui/icons/Search";
import FormControl from "@material-ui/core/FormControl";
import FormGroup from "@material-ui/core/FormGroup";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Checkbox from "@material-ui/core/Checkbox";
import Divider from "@material-ui/core/Divider";
import LocationOnOutlinedIcon from "@material-ui/icons/LocationOnOutlined";
import LocalOfferOutlinedIcon from "@material-ui/icons/LocalOfferOutlined";

// Project resources
import { getChains } from "../util/firebase/chain";
import { AuthContext } from "../components/AuthProvider";
import { addUserToChain } from "../util/firebase/chain";

const accessToken = {
  mapboxApiAccessToken: process.env.REACT_APP_MAPBOX_KEY
};

const categories = [
  { gender: "women" },
  { gender: "men" },
  { gender: "no gender" },
];

const Map = () => {
  const history = useHistory();
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);

  const styles = (theme) => ({
    ...theme.spreadThis,
  });

  const [viewport, setViewport] = useState([]);
  const [chainData, setChainData] = useState([]);
  const [selectedChain, setSelectedChain] = useState(null);
  const [showPopup, setShowPopup] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [value, setValue] = useState("");

  const [gender, setGender] = useState([]);
  const [filteredChains, setFilteredChains] = useState([]);

  useEffect(() => {
    (async () => {
      const chainResponse = await getChains();
      setChainData(chainResponse);
      setFilteredChains(chainResponse);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setViewport({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            width: "100vw",
            height: "100vh",
            zoom: 10,
          });
        },
        (err) => {
          console.error(`Couldn't receive location: ${err.message}`);
        });
    })();
  }, []);

  const handleChange = (e) => {
    if (e.target.checked) {
      setGender([...gender, e.target.value]);
    } else {
      setGender(gender.filter((id) => id !== e.target.value));
    }
  };

  useEffect(() => {
    if (gender.length === 0) {
      setFilteredChains(chainData);
      return;
    }

    let filteredArray = chainData.filter((chain) => {
      if (!chain.categories) {
        return false; //TODO: do something if a chain has no categories
      }

      return gender.some((category) => {
        return chain.categories.gender.includes(category);
      });
    });

    setFilteredChains(filteredArray);
  }, [gender]);

  if (!accessToken.mapboxApiAccessToken) {
    return <div>Access tokens not configured</div>;
  }

  //get search term from input
  const onChange = (e) => {
    setSearchTerm(e.target.value);

    chainData.filter((val) => {
      if (searchTerm == "") {
      } else if (val.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return setValue(val);
      }
    });
  };

  //render location on result selection
  const handleSelect = () => {
    setViewport({
      latitude: value.latitude,
      longitude: value.longitude,
      width: "100vw",
      height: "100vh",
      zoom: 8,
    });
  };

  const signupToChain = async (e) => {
    e.preventDefault();
    if (user) {
      await addUserToChain(selectedChain.id, user.uid);
      history.push({ pathname: "/thankyou" });
    } else {
      history.push({
        pathname: `/users/signup/${selectedChain.id}`,
        state: {
          chainId: selectedChain.id,
        },
      });
    }
  };

  return (
    <ReactMapGL
      mapboxApiAccessToken={accessToken.mapboxApiAccessToken}
      mapStyle="mapbox://styles/mapbox/streets-v11"
      {...viewport}
      onViewportChange={(newView) => setViewport(newView)}
    >
      <div className={"filter-wrapper"}>
        <Paper component="form" className={styles.root2}>
          <InputBase
            className={styles.input}
            placeholder="Search For Chain"
            inputProps={{ "aria-label": "search for chain" }}
            onChange={onChange}
          />
          <IconButton
            type="submit"
            className={styles.iconButton}
            aria-label="search"
          >
            <SearchIcon />
          </IconButton>
        </Paper>
        {value ? <Button onClick={handleSelect}>{value.name}</Button> : null}

        <FormControl>
          <FormGroup>
            {categories.map((cat) => (
              <FormControlLabel
                control={<Checkbox onChange={handleChange} />}
                label={cat.gender}
                value={cat.gender}
                key={cat.gender}
              />
            ))}
          </FormGroup>
        </FormControl>
      </div>

      {filteredChains.map((chain) =>
        chain.published ? (
          <Marker
            key={chain.id}
            latitude={chain.latitude}
            longitude={chain.longitude}
            onClick={(e) => {
              e.preventDefault();
              setSelectedChain(chain);
              setShowPopup(true);
            }}
          >
            {" "}
            <img
              id="marker"
              src="https://cdn0.iconfinder.com/data/icons/small-n-flat/24/678111-map-marker-512.png"
              alt="Map Marker"
            />
          </Marker>
        ) : null
      )}

      {selectedChain && showPopup ? (
        <Popup
          latitude={selectedChain.latitude}
          longitude={selectedChain.longitude}
          closeOnClick={false}
          onClose={() => setShowPopup(false)}
          dynamicPosition={false}
        >
          <Card className={styles.root}>
            <CardContent>
              <Typography
                className={styles.title}
                component="p"
                variant="h4"
                gutterBottom
              >
                {selectedChain.name}
              </Typography>
              <Typography
                variant="body2"
                component="p"
                className={"chain-address"}
              >
                <LocationOnOutlinedIcon />
                {selectedChain.address}
              </Typography>
              <Typography variant="body2" component="p">
                {selectedChain.description}
              </Typography>
              <Divider variant="middle" />
              <div className={"chain-categories"}>
                {selectedChain.categories
                  ? selectedChain.categories.gender.map((category) => {
                      return (
                        <Typography
                          variant="body2"
                          component="p"
                          display="inline"
                        >
                          <LocalOfferOutlinedIcon display="inline" />
                          {category}
                        </Typography>
                      );
                    })
                  : null}
              </div>
            </CardContent>

            <CardActions>
              <Button
                variant="contained"
                color="primary"
                className={"card-button"}
                onClick={(e) => signupToChain(e)}>
                {t("signup")}
              </Button>{" "}
              <Button
                variant="contained"
                color="secondary"
                className={"card-button"}
                onClick={(e) => {
                  e.preventDefault();
                  history.push(`/chains/members/${selectedChain.id}`);
                }}
              >
                {t("viewChain")}
              </Button>{" "}
            </CardActions>
          </Card>
        </Popup>
      ) : null}
    </ReactMapGL>
  );
};

export default Map;
