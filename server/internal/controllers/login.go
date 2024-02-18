package controllers

import (
	"net/http"

	"github.com/golang/glog"
	"github.com/the-clothing-loop/website/server/internal/app"
	"github.com/the-clothing-loop/website/server/internal/app/auth"
	"github.com/the-clothing-loop/website/server/internal/app/goscope"
	"github.com/the-clothing-loop/website/server/internal/models"
	"github.com/the-clothing-loop/website/server/internal/services"
	"github.com/the-clothing-loop/website/server/internal/views"

	"github.com/gin-gonic/gin"
	uuid "github.com/satori/go.uuid"
	"gopkg.in/guregu/null.v3/zero"
)

func LoginEmail(c *gin.Context) {
	db := getDB(c)

	var body struct {
		Email    string `binding:"required,email" json:"email"`
		IsApp    bool   `json:"app"`
		ChainUID string `json:"chain_uid" binding:"omitempty,uuid"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.String(http.StatusBadRequest, "Email required")
		return
	}

	// make sure that this email exists in db
	user, err := models.UserGetByEmail(db, body.Email)
	if err != nil {
		c.String(http.StatusUnauthorized, "Email is not yet registered")
		return
	}

	token, err := auth.TokenCreateUnverified(db, user.ID)
	if err != nil {
		c.String(http.StatusInternalServerError, "Unable to create token")
		return
	}
	if body.Email == app.Config.APPSTORE_REVIEWER_EMAIL {
		c.String(http.StatusOK, token)
		return
	}

	err = views.EmailLoginVerification(c, db, user.Name, user.Email.String, token, body.IsApp, body.ChainUID)
	if err != nil {
		glog.Errorf("Unable to send email: %v", err)
		c.String(http.StatusInternalServerError, "Unable to send email")
		return
	}
}

func LoginValidate(c *gin.Context) {
	db := getDB(c)

	var query struct {
		Key      string `form:"apiKey,required"`
		ChainUID string `form:"c" binding:"omitempty,uuid"`
	}
	if err := c.ShouldBindQuery(&query); err != nil {
		c.String(http.StatusBadRequest, "Malformed url: apiKey required")
		return
	}
	token := query.Key

	ok, user, newToken := auth.TokenVerify(db, token)
	if !ok {
		c.String(http.StatusUnauthorized, "Invalid token")
		return
	}

	err := user.AddUserChainsToObject(db)
	if err != nil {
		goscope.Log.Errorf("%v: %v", models.ErrAddUserChainsToObject, err)
		c.String(http.StatusInternalServerError, models.ErrAddUserChainsToObject.Error())
		return
	}

	// Is the first time verifying the user account
	if user.Email.Valid && !user.IsEmailVerified {
		db.Exec(`UPDATE chains SET published = TRUE WHERE id IN (
			SELECT chain_id FROM user_chains WHERE user_id = ? AND is_chain_admin = TRUE
	   )`, user.ID)

		// Reset joined-at time
		db.Exec(`UPDATE user_chains SET created_at = NOW() WHERE user_id = ?`, user.ID)

		// Add all chains to be notified
		chainIDs := []uint{}
		for _, uc := range user.Chains {
			if !uc.IsChainAdmin {
				chainIDs = append(chainIDs, uc.ChainID)
			}
		}

		if len(chainIDs) > 0 {
			err = services.EmailLoopAdminsOnUserJoin(db, user, chainIDs...)
			if err != nil {
				goscope.Log.Errorf("Unable to send email to associated loop admins: %v", err)
				// This doesn't return because it would be impossible to login if attempting to join a loop without admins.
			}

			chainNames, _ := models.ChainGetNamesByIDs(db, chainIDs...)
			go services.EmailYouSignedUpForLoop(db, user, chainNames...)
		}
	} else if query.ChainUID != "" {
		chainID, found, err := models.ChainCheckIfExist(db, query.ChainUID, true)
		if err != nil {
			goscope.Log.Errorf("Chain cannot be found: %v", err)
			c.String(http.StatusInternalServerError, "Loop does not exist")
			return
		}
		if !found {
			c.String(http.StatusFailedDependency, "Loop does not exist")
			return
		}
		_, found, err = models.UserChainCheckIfRelationExist(db, chainID, user.ID, false)
		if err != nil {
			goscope.Log.Errorf("Chain connection unable to lookup: %v", err)
			c.String(http.StatusInternalServerError, "Loop connection unable to lookup")
			return
		}
		if !found {
			db.Create(&models.UserChain{
				UserID:       user.ID,
				ChainID:      chainID,
				IsChainAdmin: false,
				IsApproved:   false,
			})

			chainNames, _ := models.ChainGetNamesByIDs(db, chainID)
			services.EmailYouSignedUpForLoop(db, user, chainNames...)
			services.EmailLoopAdminsOnUserJoin(db, user, chainID)
		}
	}

	// re-add IsEmailVerified, see TokenVerify
	user.IsEmailVerified = true

	// set token as cookie
	auth.CookieSet(c, newToken)
	c.JSON(200, gin.H{
		"user":  user,
		"token": newToken,
	})
}

// Sizes and Address is set to the user and the chain
func RegisterChainAdmin(c *gin.Context) {
	db := getDB(c)

	var body struct {
		Chain ChainCreateRequestBody `json:"chain" binding:"required"`
		User  UserCreateRequestBody  `json:"user" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}

	if ok := models.ValidateAllSizeEnum(body.User.Sizes); !ok {
		c.String(http.StatusBadRequest, models.ErrSizeInvalid.Error())
		return
	}
	if ok := models.ValidateAllSizeEnum(body.Chain.Sizes); !ok {
		c.String(http.StatusBadRequest, models.ErrSizeInvalid.Error())
		return
	}

	if ok := models.ValidateAllGenderEnum(body.Chain.Genders); !ok {
		c.String(http.StatusBadRequest, models.ErrGenderInvalid.Error())
		return
	}

	if !body.User.Newsletter {
		c.String(http.StatusBadRequest, "Newsletter-Box must be checked to create a new loop admin.")
		return
	}
	if !body.Chain.AllowTOH {
		c.String(http.StatusBadRequest, ErrAllowTOHFalse)
		return
	}

	chain := &models.Chain{
		UID:              uuid.NewV4().String(),
		Name:             body.Chain.Name,
		Description:      body.Chain.Description,
		Address:          body.Chain.Address,
		Latitude:         body.Chain.Latitude,
		Longitude:        body.Chain.Longitude,
		Radius:           body.Chain.Radius,
		Published:        false,
		OpenToNewMembers: body.Chain.OpenToNewMembers,
		CountryCode:      body.Chain.CountryCode,
		Sizes:            body.Chain.Sizes,
		Genders:          body.Chain.Genders,
		RoutePrivacy:     2, // default route_privacy
	}
	user := &models.User{
		UID:             uuid.NewV4().String(),
		Email:           zero.StringFrom(body.User.Email),
		IsEmailVerified: false,
		IsRootAdmin:     false,
		Name:            body.User.Name,
		PhoneNumber:     body.User.PhoneNumber,
		Sizes:           body.User.Sizes,
		Address:         body.User.Address,
		Latitude:        body.User.Latitude,
		Longitude:       body.User.Longitude,
		AcceptedTOH:     true,
		AcceptedDPA:     true,
	}
	if err := db.Create(user).Error; err != nil {
		goscope.Log.Warningf("User already exists: %v", err)
		c.String(http.StatusConflict, "User already exists")
		return
	}
	chain.UserChains = []models.UserChain{{
		UserID:       user.ID,
		IsChainAdmin: true,
		IsApproved:   true,
	}}
	db.Create(chain)

	db.Create(&models.Newsletter{
		Email:    body.User.Email,
		Name:     body.User.Name,
		Verified: false,
	})

	token, err := auth.TokenCreateUnverified(db, user.ID)
	if err != nil {
		goscope.Log.Errorf("Unable to create token: %v", err)
		c.String(http.StatusInternalServerError, "Unable to create token")
		return
	}

	go views.EmailRegisterVerification(c, db, user.Name, user.Email.String, token)
}

func RegisterBasicUser(c *gin.Context) {
	db := getDB(c)

	var body struct {
		ChainUID string                `json:"chain_uid" binding:"omitempty,uuid"`
		User     UserCreateRequestBody `json:"user" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.String(http.StatusBadRequest, err.Error())
		return
	}
	if ok := models.ValidateAllSizeEnum(body.User.Sizes); !ok {
		c.String(http.StatusBadRequest, models.ErrSizeInvalid.Error())
		return
	}

	var chainID uint
	if body.ChainUID != "" {
		var row struct {
			ID uint `gorm:"id"`
		}
		err := db.Raw("SELECT id FROM chains WHERE uid = ? AND deleted_at IS NULL AND open_to_new_members = TRUE LIMIT 1", body.ChainUID).Scan(&row).Error
		chainID = row.ID
		if chainID == 0 {
			goscope.Log.Warningf("Chain does not exist: %v", err)
			c.String(http.StatusBadRequest, "Chain does not exist")
			return
		}
	}

	user := &models.User{
		UID:             uuid.NewV4().String(),
		Email:           zero.StringFrom(body.User.Email),
		IsEmailVerified: false,
		IsRootAdmin:     false,
		Name:            body.User.Name,
		PhoneNumber:     body.User.PhoneNumber,
		Sizes:           body.User.Sizes,
		Address:         body.User.Address,
		Latitude:        body.User.Latitude,
		Longitude:       body.User.Longitude,
	}
	if res := db.Create(user); res.Error != nil {
		goscope.Log.Warningf("User already exists: %v", res.Error)
		c.String(http.StatusConflict, "User already exists")
		return
	}
	if body.ChainUID != "" {
		db.Create(&models.UserChain{
			UserID:       user.ID,
			ChainID:      chainID,
			IsChainAdmin: false,
			IsApproved:   false,
		})
	}
	if body.User.Newsletter {
		n := &models.Newsletter{
			Email:    body.User.Email,
			Name:     body.User.Name,
			Verified: false,
		}
		n.CreateOrUpdate(db)
	}

	token, err := auth.TokenCreateUnverified(db, user.ID)
	if err != nil {
		goscope.Log.Errorf("Unable to create token: %v", err)
		c.String(http.StatusInternalServerError, "Unable to create token")
		return
	}
	views.EmailRegisterVerification(c, db, user.Name, user.Email.String, token)
}

func Logout(c *gin.Context) {
	db := getDB(c)

	token, ok := auth.TokenReadFromRequest(c)
	if !ok {
		c.String(http.StatusBadRequest, "No token received")
		return
	}

	auth.TokenDelete(db, token)
	auth.CookieRemove(c)
}
