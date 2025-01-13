package controllers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/the-clothing-loop/website/server/internal/app/auth"
	"github.com/the-clothing-loop/website/server/internal/models"
	"github.com/the-clothing-loop/website/server/internal/services"
	"github.com/the-clothing-loop/website/server/internal/views"
	"github.com/the-clothing-loop/website/server/pkg/tsp"
	"github.com/the-clothing-loop/website/server/sharedtypes"

	"github.com/gin-gonic/gin"
	uuid "github.com/satori/go.uuid"
)

const (
	UnapprovedReasonOther         = "other"
	UnapprovedReasonOutOfAria     = "out_of_aria"
	UnapprovedReasonSizesGenders  = "sizes_genders"
	UnapprovedReasonLoopNotActive = "loop_not_active"
)

const ErrAllowTOHFalse = "The Terms of the Hosts must be approved"

func ChainCreate(c *gin.Context) {
	db := getDB(c)
	ok, user, _ := auth.Authenticate(c, db, auth.AuthState1AnyUser, "")
	if !ok {
		return
	}

	var body sharedtypes.ChainCreateRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}
	if ok := models.ValidateAllSizeEnum(body.Sizes); !ok {
		c.String(http.StatusBadRequest, models.ErrSizeInvalid.Error())
		return
	}
	if ok := models.ValidateAllGenderEnum(body.Genders); !ok {
		c.String(http.StatusBadRequest, models.ErrGenderInvalid.Error())
		return
	}
	if !body.AllowTOH {
		c.String(http.StatusBadRequest, ErrAllowTOHFalse)
		return
	}

	chain := models.Chain{
		UID:              uuid.NewV4().String(),
		Name:             body.Name,
		Description:      body.Description,
		Address:          body.Address,
		CountryCode:      body.CountryCode,
		Latitude:         body.Latitude,
		Longitude:        body.Longitude,
		Radius:           body.Radius,
		Published:        true,
		OpenToNewMembers: true,
		Sizes:            body.Sizes,
		Genders:          body.Genders,
		UserChains: []sharedtypes.UserChain{
			{
				UserID:       user.ID,
				IsChainAdmin: true,
				IsApproved:   true,
				RouteOrder:   0,
			},
		},
		RoutePrivacy: 2, // default route_privacy
	}
	if err := db.Create(&chain).Error; err != nil {
		slog.Warn("Unable to create chain", "err", err)
		c.String(http.StatusInternalServerError, "Unable to create chain")
		return
	}

	if err := user.AcceptLegal(db); err != nil {
		slog.Error("Unable to set toh to true, during chain creation", "err", err)
	}

	c.Status(200)
}

func ChainGet(c *gin.Context) {
	db := getDB(c)

	var query struct {
		ChainUID         string `form:"chain_uid" binding:"required"`
		AddRules         bool   `form:"add_rules" binding:"omitempty"`
		AddHeaders       bool   `form:"add_headers" binding:"omitempty"`
		AddTotals        bool   `form:"add_totals" binding:"omitempty"`
		AddTheme         bool   `form:"add_theme" binding:"omitempty"`
		AddIsAppDisabled bool   `form:"add_is_app_disabled" binding:"omitempty"`
		AddRoutePrivacy  bool   `form:"add_route_privacy" binding:"omitempty"`
	}
	if err := c.ShouldBindQuery(&query); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	chain := &models.Chain{}
	sql := models.ChainResponseSQLSelect
	if query.AddRules {
		sql += `,
		chains.rules_override`
	}
	if query.AddHeaders {
		sql += `,
		chains.headers_override`
	}
	if query.AddTheme {
		sql += `,
		chains.theme,
		chains.allow_map`
	}
	if query.AddIsAppDisabled {
		sql += `,
		chains.is_app_disabled,
		chains.chat_room_ids`
	}
	if query.AddRoutePrivacy {
		sql += `,
		chains.route_privacy`
	}
	sql += ` FROM chains WHERE uid = ? LIMIT 1`
	err := db.Raw(sql, query.ChainUID).Scan(chain).Error
	if err != nil || chain.ID == 0 {
		c.String(http.StatusBadRequest, models.ErrChainNotFound.Error())
		return
	}

	body := sharedtypes.ChainResponse{
		UID:              chain.UID,
		Name:             chain.Name,
		Description:      chain.Description,
		Address:          chain.Address,
		Image:            chain.Image,
		Latitude:         chain.Latitude,
		Longitude:        chain.Longitude,
		Radius:           chain.Radius,
		Sizes:            chain.Sizes,
		Genders:          chain.Genders,
		Published:        chain.Published,
		OpenToNewMembers: chain.OpenToNewMembers,
	}

	if query.AddRules {
		body.RulesOverride = &chain.RulesOverride
	}
	if query.AddHeaders {
		body.HeadersOverride = &chain.HeadersOverride
	}
	// this is used on all app requests
	if query.AddTheme {
		body.Theme = &chain.Theme
		body.AllowMap = &chain.AllowMap
	}
	if query.AddTotals {
		result := chain.GetTotals(db)
		body.TotalMembers = &result.TotalMembers
		body.TotalHosts = &result.TotalHosts
	}
	if query.AddIsAppDisabled {
		body.IsAppDisabled = &chain.IsAppDisabled
		body.ChatRoomIDs = chain.ChatRoomIDs
	}
	if query.AddRoutePrivacy {
		body.RoutePrivacy = &chain.RoutePrivacy
	}
	c.JSON(200, body)
}

func ChainGetAll(c *gin.Context) {
	db := getDB(c)

	var query struct {
		FilterSizes     []string `form:"filter_sizes"`
		FilterGenders   []string `form:"filter_genders"`
		FilterPublished bool     `form:"filter_out_unpublished"`
		AddTotals       bool     `form:"add_totals"`
	}
	if err := c.ShouldBindQuery(&query); err != nil && err != io.EOF {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	if ok := models.ValidateAllSizeEnum(query.FilterSizes); !ok {
		c.String(http.StatusBadRequest, models.ErrSizeInvalid.Error())
		return
	}
	if ok := models.ValidateAllGenderEnum(query.FilterGenders); !ok {
		c.String(http.StatusBadRequest, models.ErrGenderInvalid.Error())
		return
	}

	chains := []*sharedtypes.ChainResponse{}
	sql := models.ChainResponseSQLSelect
	whereOrSql := []string{}
	args := []any{}

	if query.AddTotals {
		sql = fmt.Sprintf(`%s, 
(
	SELECT COUNT(uc1.id) FROM user_chains AS uc1
	WHERE uc1.chain_id = chains.id AND uc1.is_approved = TRUE
) AS total_members,
(
	SELECT COUNT(uc2.id)
	FROM user_chains AS uc2
	WHERE uc2.chain_id = chains.id AND uc2.is_approved = TRUE AND uc2.is_chain_admin = TRUE
) AS total_hosts
		`, sql)
	}
	sql = fmt.Sprintf(`%s FROM chains`, sql)

	// filter sizes and genders
	isGendersEmpty := len(query.FilterGenders) == 0
	isSizesEmpty := len(query.FilterSizes) == 0
	if !isSizesEmpty || !isGendersEmpty {
		var whereAndSql []string
		if !isSizesEmpty {
			for _, size := range query.FilterSizes {
				whereAndSql = append(whereAndSql, "chains.sizes LIKE ?")
				args = append(args, fmt.Sprintf("%%%s%%", size))
			}
		}
		if !isGendersEmpty {
			for _, gender := range query.FilterGenders {
				whereAndSql = append(whereAndSql, "chains.genders LIKE ?")
				args = append(args, fmt.Sprintf("%%%s%%", gender))
			}
		}

		whereOrSql = append(whereOrSql, fmt.Sprintf("( %s )", strings.Join(whereAndSql, " AND ")))
	}

	if query.FilterPublished {
		whereOrSql = append(whereOrSql, "chains.published = TRUE")
	}
	if len(whereOrSql) > 0 {
		sql = fmt.Sprintf("%s WHERE %s", sql, strings.Join(whereOrSql, " OR "))
	}
	if err := db.Raw(sql, args...).Scan(&chains).Error; err != nil {
		slog.Warn("Chain not found", "err", err)
		c.String(http.StatusBadRequest, models.ErrChainNotFound.Error())
		return
	}

	c.JSON(200, chains)
}

func ChainGetNear(c *gin.Context) {
	db := getDB(c)

	var query struct {
		Latitude  float32 `form:"latitude" binding:"required,latitude"`
		Longitude float32 `form:"longitude" binding:"required,longitude"`
		Radius    float32 `form:"radius" binding:"required"`
	}
	if err := c.ShouldBindQuery(&query); err != nil && err != io.EOF {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	chains := []models.Chain{}
	sql := "SELECT uid, name, genders FROM chains"
	args := []any{}

	sql = fmt.Sprintf("%s WHERE %s <= ? AND chains.published = TRUE", sql, sqlCalcDistance("chains.latitude", "chains.longitude", "?", "?"))
	args = append(args, query.Latitude, query.Longitude, query.Radius)

	if err := db.Raw(sql, args...).Scan(&chains).Error; err != nil {
		slog.Warn("Chain not found", "err", err)
		c.String(http.StatusBadRequest, models.ErrChainNotFound.Error())
		return
	}

	chainsJson := []*gin.H{}
	for _, chain := range chains {
		chainsJson = append(chainsJson, &gin.H{
			"uid":     chain.UID,
			"name":    chain.Name,
			"genders": chain.Genders,
		})
	}

	c.JSON(200, chainsJson)
}

func ChainUpdate(c *gin.Context) {
	db := getDB(c)

	var body sharedtypes.ChainUpdateRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	if body.Sizes != nil {
		if ok := models.ValidateAllSizeEnum(*(body.Sizes)); !ok {
			c.String(http.StatusBadRequest, models.ErrSizeInvalid.Error())
			return
		}
	}
	if body.Genders != nil {
		if ok := models.ValidateAllGenderEnum(*(body.Genders)); !ok {
			c.String(http.StatusBadRequest, models.ErrGenderInvalid.Error())
			return
		}
	}

	ok, _, chain := auth.Authenticate(c, db, auth.AuthState3AdminChainUser, body.UID)
	if !ok {
		return
	}

	valuesToUpdate := map[string]any{}
	if body.Name != nil {
		valuesToUpdate["name"] = *(body.Name)
	}
	if body.Description != nil {
		valuesToUpdate["description"] = *(body.Description)
	}
	if body.Address != nil {
		valuesToUpdate["address"] = *(body.Address)
	}
	if body.Image != nil {
		image := *(body.Image)
		valuesToUpdate["image"] = sql.NullString{String: image, Valid: image != ""}
	}
	if body.CountryCode != nil {
		valuesToUpdate["country_code"] = *(body.CountryCode)
	}
	if body.Latitude != nil {
		valuesToUpdate["latitude"] = *(body.Latitude)
	}
	if body.Longitude != nil {
		valuesToUpdate["longitude"] = *(body.Longitude)
	}
	if body.Radius != nil {
		valuesToUpdate["radius"] = *(body.Radius)
	}
	if body.AllowMap != nil {
		valuesToUpdate["allow_map"] = *(body.AllowMap)
	}
	if body.Sizes != nil {
		j, _ := json.Marshal(body.Sizes)
		valuesToUpdate["sizes"] = string(j)
	}
	if body.Genders != nil {
		j, _ := json.Marshal(body.Genders)
		valuesToUpdate["genders"] = string(j)
	}
	if body.RulesOverride != nil {
		valuesToUpdate["rules_override"] = *(body.RulesOverride)
	}
	if body.HeadersOverride != nil {
		valuesToUpdate["headers_override"] = *(body.HeadersOverride)
	}
	if body.Published != nil {
		valuesToUpdate["published"] = *(body.Published)

		// reset abandoned status to NULL
		if *(body.Published) && chain.LastAbandonedAt.Valid {
			valuesToUpdate["last_abandoned_at"] = sql.NullTime{}
			valuesToUpdate["last_abandoned_recruitment_email"] = sql.NullTime{}
		}
	}
	if body.OpenToNewMembers != nil {
		valuesToUpdate["open_to_new_members"] = *(body.OpenToNewMembers)
	}
	if body.Theme != nil {
		valuesToUpdate["theme"] = *(body.Theme)
	}
	if body.RoutePrivacy != nil {
		valuesToUpdate["route_privacy"] = *(body.RoutePrivacy)
	}
	if body.IsAppDisabled != nil {
		valuesToUpdate["is_app_disabled"] = *(body.IsAppDisabled)
	}
	err := db.Model(chain).Updates(valuesToUpdate).Error
	if err != nil {
		slog.Error("Unable to update loop values", "err", err)
		c.String(http.StatusInternalServerError, "Unable to update loop values")
	}
}

func ChainDelete(c *gin.Context) {
	db := getDB(c)

	var query struct {
		ChainUID string `form:"chain_uid" binding:"required,uuid"`
	}
	if err := c.ShouldBindQuery(&query); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	ok, authUser, chain := auth.Authenticate(c, db, auth.AuthState3AdminChainUser, query.ChainUID)
	if !ok {
		return
	}

	totals := chain.GetTotals(db)

	// ensure that there is only one chain admin in the loop
	if !authUser.IsRootAdmin && totals.TotalHosts > 1 {
		c.String(http.StatusFailedDependency, "A Loop can only be deleted if there are no co-hosts")
		return
	}

	httperr := services.ChainDelete(db, chain)
	if httperr != nil {
		httperr.StatusWithError(c)
		return
	}
}

func ChainAddUser(c *gin.Context) {
	db := getDB(c)

	var body sharedtypes.ChainAddUserRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	var ok bool
	var chain *models.Chain
	if body.IsChainAdmin {
		ok, _, chain = auth.Authenticate(c, db, auth.AuthState3AdminChainUser, body.ChainUID)
	} else {
		ok, _, _, chain = auth.AuthenticateUserOfChain(c, db, body.ChainUID, body.UserUID)
	}
	if !ok {
		return
	}

	user, err := models.UserGetByUID(db, body.UserUID, true)
	userChain := &sharedtypes.UserChain{}
	if err == nil {
		db.Raw(`
SELECT * FROM user_chains
WHERE user_id = ? AND chain_id = ?
LIMIT 1
	`, user.ID, chain.ID).Scan(userChain)
	}

	// If patch is editing an existing userChain instead of creating a new one, then conflict will be ignored
	if !chain.OpenToNewMembers && userChain.ID == 0 {
		c.String(http.StatusConflict, "Loop is not open to new members")
		return
	}
	if err != nil {
		c.String(http.StatusBadRequest, models.ErrUserNotFound.Error())
		return
	}

	if userChain.ID != 0 {
		if (!userChain.IsChainAdmin && body.IsChainAdmin) || (userChain.IsChainAdmin && !body.IsChainAdmin) {
			userChain.IsChainAdmin = body.IsChainAdmin
			db.Save(userChain)
		}
	} else {
		if err := db.Create(&sharedtypes.UserChain{
			UserID:       user.ID,
			ChainID:      chain.ID,
			IsChainAdmin: false,
		}).Error; err != nil {
			slog.Error("User could not be added to chain", "err", err)
			c.String(http.StatusInternalServerError, "User could not be added to chain due to unknown error")
			return
		}
		err := services.EmailLoopAdminsOnUserJoin(db, user, chain.ID)
		if err != nil {
			slog.Error("Unable to send email to associated loop admins", "err", err)
			c.String(http.StatusInternalServerError, err.Error())
			return
		}
		services.EmailYouSignedUpForLoop(db, user, chain.Name)
	}
}

func ChainRemoveUser(c *gin.Context) {
	db := getDB(c)

	var body sharedtypes.ChainRemoveUserRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	ok, user, authUser, chain := auth.AuthenticateUserOfChain(c, db, body.ChainUID, body.UserUID)
	if !ok {
		return
	}

	if authUser.ID == user.ID && !authUser.IsRootAdmin {
		if _, isChainAdmin := user.IsPartOfChain(chain.UID); isChainAdmin {
			amountChainAdmins := -1
			err := db.Raw(`SELECT COUNT(*) FROM user_chains WHERE chain_id = ? AND is_chain_admin = TRUE`, chain.ID).Scan(&amountChainAdmins).Error

			if amountChainAdmins == 1 {
				slog.Warn("Unable to remove last host of loop", "err", err)
				c.String(http.StatusConflict, "Unable to remove last host of loop")
				return
			}
		}
	}

	err := chain.RemoveUser(db, user.ID)
	if err != nil {
		slog.Error("User could not be removed from chain", "err", err)
		c.String(http.StatusInternalServerError, "User could not be removed from chain due to unknown error")
		return
	}

	chain.ClearAllLastNotifiedIsUnapprovedAt(db)

	// send email to chain admins
	services.EmailLoopAdminsOnUserLeft(db,
		user.Name,
		*user.Email,
		*user.Email,
		chain.ID,
	)
}

func ChainApproveUser(c *gin.Context) {
	db := getDB(c)

	var body sharedtypes.ChainApproveUserRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	ok, user, _, chain := auth.AuthenticateUserOfChain(c, db, body.ChainUID, body.UserUID)
	if !ok {
		return
	}

	db.Exec(`
UPDATE user_chains
SET is_approved = TRUE, created_at = NOW()
WHERE user_id = ? AND chain_id = ?
	`, user.ID, chain.ID)

	chain.ClearAllLastNotifiedIsUnapprovedAt(db)

	// Given a ChainID and the UID of the new user returns the list of UserUIDs of the chain considering the addition of the new user
	cities := retrieveChainUsersAsTspCities(db, chain.ID)
	newRoute, _ := tsp.RunAddOptimalOrderNewCity(cities.ToTspCities(), user.UID)
	chain.SetRouteOrderByUserUIDs(db, newRoute) // update the route order

	if user.Email != nil {
		views.EmailAnAdminApprovedYourJoinRequest(db, user.I18n, user.Name, *user.Email, chain.Name)
	}
}

func ChainDeleteUnapproved(c *gin.Context) {
	db := getDB(c)
	var query struct {
		UserUID  string `form:"user_uid" binding:"required,uuid"`
		ChainUID string `form:"chain_uid" binding:"required,uuid"`
		Reason   string `form:"reason" binding:"required,oneof='other' 'too_far_away' 'sizes_genders' 'loop_not_active'"`
	}
	if err := c.ShouldBindQuery(&query); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	ok, user, _, chain := auth.AuthenticateUserOfChain(c, db, query.ChainUID, query.UserUID)
	if !ok {
		return
	}

	err := chain.RemoveUserUnapproved(db, user.ID)
	if err != nil {
		slog.Error("User could not be removed from chain", "err", err)
		c.String(http.StatusInternalServerError, "User could not be removed from chain due to unknown error")
		return
	}

	chain.ClearAllLastNotifiedIsUnapprovedAt(db)

	if user.Email != nil {
		views.EmailAnAdminDeniedYourJoinRequest(db, user.I18n, user.Name, *user.Email, chain.Name,
			query.Reason)
	}
}

func ChainChangeUserNote(c *gin.Context) {
	db := getDB(c)
	var body struct {
		UserUID  string `json:"user_uid" binding:"required,uuid"`
		ChainUID string `json:"chain_uid" binding:"required,uuid"`
		Note     string `json:"note"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	ok, user, _, chain := auth.AuthenticateUserOfChain(c, db, body.ChainUID, body.UserUID)
	if !ok {
		return
	}

	err := models.UserChainSetNote(db, user.ID, chain.ID, body.Note)
	if err != nil {
		slog.Error("Unable to change user note", "error", err)
		c.String(http.StatusInternalServerError, "Unable to change user note")
		return
	}
}
func ChainGetUserNote(c *gin.Context) {
	db := getDB(c)
	var query struct {
		UserUID  string `form:"user_uid" binding:"required,uuid"`
		ChainUID string `form:"chain_uid" binding:"required,uuid"`
	}
	if err := c.ShouldBindQuery(&query); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	ok, _, chain := auth.Authenticate(c, db, auth.AuthState2UserOfChain, query.ChainUID)
	if !ok {
		return
	}
	user, err := models.UserGetByUID(db, query.UserUID, true)
	if err != nil {
		c.String(http.StatusExpectationFailed, "Could not get user")
		return
	}

	note, err := models.UserChainGetNote(db, user.ID, chain.ID)
	if err != nil {
		slog.Error("Unable to change user note", "error", err)
		c.String(http.StatusInternalServerError, "Unable to change user note")
		return
	}
	c.String(http.StatusOK, note)
}

func ChainChangeUserWarden(c *gin.Context) {
	db := getDB(c)
	var body sharedtypes.ChainChangeUserWardenRequest
	if err := c.ShouldBindJSON(&body); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	ok, _, chain := auth.Authenticate(c, db, auth.AuthState3AdminChainUser, body.ChainUID)
	if !ok {
		return
	}
	user, err := models.UserGetByUID(db, body.UserUID, true)
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	user.AddUserChainsToObject(db)
	if err != nil {
		c.String(http.StatusInternalServerError, err.Error())
		return
	}
	ok, isUserChainAdmin := user.IsPartOfChain(body.ChainUID)
	if !ok {
		c.String(http.StatusBadRequest, "User is not a member of this loop")
		return
	}
	if isUserChainAdmin {
		c.String(http.StatusInternalServerError, "Hosts cannot be assigned wardens")
		return
	}

	err = models.UserChainSetWarden(db, user.ID, chain.ID, body.Warden)
	if err != nil {
		slog.Error("Unable to change user warden", "error", err)
		c.String(http.StatusInternalServerError, "Unable to change user warden")
		return
	}
}

func ChainGetLargest(c *gin.Context) {

	db := getDB(c)
	type ChainSummary struct {
		Name                 string `json:"name"`
		Description          string `json:"description"`
		NumberOfParticipants int    `json:"number_of_participants"`
	}
	const limit = 10
	var result []ChainSummary

	query := `SELECT name, description, number_of_participants FROM chains c JOIN (SELECT chain_id, COUNT(*) as number_of_participants FROM user_chains GROUP BY chain_id ORDER BY COUNT(*) DESC LIMIT ?) AS top_chains ON c.id = top_chains.chain_id ORDER BY number_of_participants DESC `

	if err := db.Raw(query, limit).Scan(&result).Error; err != nil {
		slog.Warn("Unable to fetch largest chains", "err", err)
		c.String(http.StatusInternalServerError, "Unable to fetch largest chains")
		return
	}

	c.JSON(http.StatusOK, result)

}
