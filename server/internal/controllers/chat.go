package controllers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/the-clothing-loop/website/server/internal/app"
	"github.com/the-clothing-loop/website/server/internal/app/auth"
	"github.com/the-clothing-loop/website/server/internal/services"
	"github.com/the-clothing-loop/website/server/pkg/httperror"
)

func ChatPatchUser(c *gin.Context) {
	db := getDB(c)

	var body struct {
		ChainUID string `json:"chain_uid" binding:"required,uuid"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}

	ok, user, chain := auth.Authenticate(c, db, auth.AuthState2UserOfChain, body.ChainUID)
	if !ok {
		return
	}

	err := services.ChatPatchUser(db, c.Request.Context(), app.ChatTeamId, user)
	if err != nil {
		httperror.New(http.StatusInternalServerError, err).StatusWithError(c)
		return
	}
	if user.ChatPass == nil {
		c.AbortWithError(http.StatusTeapot, fmt.Errorf("password is not set"))
		return
	}

	// Create a new channel if none exists
	if len(chain.ChatRoomIDs) == 0 {
		_, isChainAdmin := user.IsPartOfChain(chain.UID)
		if isChainAdmin {
			_, err := services.ChatCreateChannel(db, c.Request.Context(), chain, *user.ChatUserID, "General", "#fff")
			if err != nil {
				c.String(http.StatusInternalServerError, err.Error())
				return
			}
		}
	}

	json := gin.H{
		"chat_team": app.ChatTeamId,
		"chat_user": *user.ChatUserID,
		"chat_pass": *user.ChatPass,
	}
	c.JSON(http.StatusOK, json)
}

func ChatCreateChannel(c *gin.Context) {
	db := getDB(c)

	var body struct {
		ChainUID string `json:"chain_uid" binding:"required,uuid"`
		Name     string `json:"name" binding:"required"`
		Color    string `json:"color" binding:"required,hexcolor"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}

	ok, user, chain := auth.Authenticate(c, db, auth.AuthState3AdminChainUser, body.ChainUID)
	if !ok {
		return
	}

	mmChannel, err := services.ChatCreateChannel(db, c.Request.Context(), chain, *user.ChatUserID, body.Name, body.Color)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"chat_channel": mmChannel.Id,
	})
}

func ChatDeleteChannel(c *gin.Context) {
	db := getDB(c)

	var body struct {
		ChainUID  string `json:"chain_uid" binding:"required,uuid"`
		ChannelID string `json:"channel_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}

	ok, _, chain := auth.Authenticate(c, db, auth.AuthState3AdminChainUser, body.ChainUID)
	if !ok {
		return
	}

	err := services.ChatDeleteChannel(db, c.Request.Context(), chain, body.ChannelID)
	if err != nil {
		c.AbortWithError(http.StatusInternalServerError, err)
		return
	}

	c.Status(http.StatusOK)
}

func ChatJoinChannels(c *gin.Context) {
	db := getDB(c)

	var body struct {
		ChainUID string `json:"chain_uid" binding:"required,uuid"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.AbortWithError(http.StatusBadRequest, err)
		return
	}

	ok, user, chain := auth.Authenticate(c, db, auth.AuthState2UserOfChain, body.ChainUID)
	if !ok {
		return
	}

	_, isChainAdmin := user.IsPartOfChain(chain.UID)
	if !isChainAdmin && len(chain.ChatRoomIDs) == 0 {
		c.String(http.StatusExpectationFailed, "The Loop host must first enable chat")
		return
	}

	for _, mmChannelId := range chain.ChatRoomIDs {
		err := services.ChatJoinChannel(db, c.Request.Context(), chain, user, isChainAdmin, mmChannelId)
		if err != nil {
			httperror.New(http.StatusInternalServerError, err).StatusWithError(c)
			return
		}
	}
}